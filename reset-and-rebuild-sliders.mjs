#!/usr/bin/env node
/**
 * reset-and-rebuild-sliders.mjs
 * 1. Strips ALL existing slider-wrap divs and icon-sliders from every page,
 *    restoring the original <img> tags
 * 2. Re-injects sliders cleanly with correct logic:
 *    - AI image on top (default visible)
 *    - Drag RIGHT → original archive image revealed
 *    - Original panel always contains the actual archive image (never AI)
 *    - Case-insensitive Cloudinary lookup
 */
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = __dirname;
const log = m => console.log(`[slider-reset] ${m}`);

const AI_MAP = JSON.parse(fs.readFileSync(path.join(B, 'ai-image-map.json'), 'utf8'));
const CMAP   = JSON.parse(fs.readFileSync(path.join(B, 'cloudinary-map.json'), 'utf8'));

// Case-insensitive filename lookup in Cloudinary map
// Returns the Cloudinary secure URL for the original archived image, or null
function findOriginalUrl(src) {
  if (!src) return null;
  const fn = path.basename(src).toLowerCase();
  for (const [key, val] of Object.entries(CMAP)) {
    const keyFn = path.basename(key).toLowerCase();
    // Normalise extension: .jpeg → .jpg for comparison
    const normKey = keyFn.replace(/\.jpeg$/, '.jpg');
    const normFn  = fn.replace(/\.jpeg$/, '.jpg');
    if (normKey === normFn) {
      return val.secureUrl || val;
    }
  }
  return null;
}

// Build the AI URL for a given filename from ai-image-map
function findAiUrl(fn) {
  const normFn = fn.toLowerCase().replace(/\.jpeg$/, '.jpg');
  // Direct match
  if (AI_MAP[normFn]) return AI_MAP[normFn].ai_url;
  // Try without extension normalisation
  for (const [key, val] of Object.entries(AI_MAP)) {
    if (key.toLowerCase().replace(/\.jpeg$/, '.jpg') === normFn) {
      return val.ai_url;
    }
  }
  return null;
}

// Images to always skip (nav UI)
const NAV_SKIP = new Set([
  'menusplash.gif','menunew.gif','menuhome.gif','menuoutline.gif',
  'menulinks.gif','menubio.gif','menuiso.gif','menueco.gif',
  'arrowl.gif','arrowr.gif','newbutton.gif','greenline.gif',
  'dolphinnn3.gif','cetaceanlogo.gif','isolationlogo2.gif',
  'garagelogo.gif','dolphinlogo.gif','januslogo.gif','brainlogo3.gif'
]);
function isNavImage(src) {
  const fn = path.basename(src).toLowerCase();
  if (NAV_SKIP.has(fn)) return true;
  if (/^(menu|logo|nav|spacer|blank|1x1|clear)/.test(fn)) return true;
  return false;
}

// ── Build slider HTML ────────────────────────────────────────────────────────

function buildSlider(archiveSrc, aiSrc, altText) {
  const alt = (altText || '').replace(/"/g, '&quot;');
  return `<div class="slider-wrap">
  <div class="img-slider" role="img" aria-label="Drag right to reveal original archive image">
    <div class="img-slider-original">
      <img src="${archiveSrc}" alt="${alt} — original archive" loading="lazy">
    </div>
    <div class="img-slider-ai">
      <img src="${aiSrc}" alt="${alt} — AI reinterpretation" loading="lazy">
      <div class="slider-ai-overlay"></div>
    </div>
    <div class="img-slider-handle" aria-hidden="true"></div>
    <span class="slider-label slider-label-ai">✦ AI</span>
    <span class="slider-label slider-label-orig">📷 Original</span>
  </div>
</div>`;
}

// No-AI slider: just shows original with a subtle frame (no comparison chrome)
function buildOriginalOnly(archiveSrc, altText) {
  const alt = (altText || '').replace(/"/g, '&quot;');
  return `<figure class="archive-figure">
  <img src="${archiveSrc}" alt="${alt}" loading="lazy">
</figure>`;
}

// ── Strip existing sliders ───────────────────────────────────────────────────

function stripSliders($) {
  // Remove all .slider-wrap divs — extract the ARCHIVE original img inside
  $('.slider-wrap').each((_, el) => {
    const $el = $(el);
    // Get the archive original img (img-slider-original panel)
    const $origImg = $el.find('.img-slider-original img').first();
    if ($origImg.length) {
      const origSrc = $origImg.attr('src') || '';
      // Only restore if it's NOT an AI group image
      if (origSrc && !origSrc.includes('/ai/group-')) {
        const alt = $origImg.attr('alt') || '';
        const cleanAlt = alt.replace(/ ?— original archive.*$/, '').trim();
        $el.replaceWith(`<img src="${origSrc}" alt="${cleanAlt}" loading="lazy" data-restored="1">`);
      } else {
        // It was a bad slider (AI on both sides) — find the original in the ai panel
        const $aiImg = $el.find('.img-slider-ai img').first();
        const aiSrc = $aiImg.attr('src') || '';
        // We can't recover the original — just remove the wrapper
        // The original img will be looked up from Cloudinary map during re-injection
        $el.replaceWith(`<img src="${aiSrc}" alt="" loading="lazy" data-restored-ai="1">`);
      }
    } else {
      $el.remove();
    }
  });

  // Strip icon-sliders too — restore the AI img (which will be replaced with original during re-injection)
  $('.icon-slider').each((_, el) => {
    const $el = $(el);
    // Use the icon-orig src if available, otherwise icon-ai
    const origSrc = $el.find('.icon-orig').attr('src') || $el.find('.icon-ai').attr('src') || '';
    if (origSrc) {
      $el.replaceWith(`<img src="${origSrc}" alt="" loading="lazy" data-restored-icon="1">`);
    } else {
      $el.remove();
    }
  });

  // Remove archive-figure wrappers (from previous no-ai treatment)
  $('figure.archive-figure').each((_, el) => {
    const $el = $(el);
    const $img = $el.find('img').first();
    if ($img.length) $el.replaceWith($img);
    else $el.remove();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

const htmlFiles = fs.readdirSync(B).filter(f => f.endsWith('.html'));
let totalSliders = 0, totalOrigOnly = 0, totalSkipped = 0, filesChanged = 0;

for (const file of htmlFiles) {
  const fp = path.join(B, file);
  let html = fs.readFileSync(fp, 'utf8');
  const $ = load(html, { decodeEntities: false });

  // Step 1: Strip all existing sliders
  stripSliders($);

  // Step 2: Re-inject sliders on all content images
  let changed = false;

  $('img[src]').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') || '';
    const alt = $el.attr('alt') || '';
    const fn = path.basename(src).toLowerCase();

    // Skip if inside a partial we're building (shouldn't happen after strip)
    if ($el.closest('.img-slider, .icon-slider, .slider-wrap, figure.archive-figure').length) return;

    // Skip nav/UI images
    if (isNavImage(src)) { totalSkipped++; return; }

    // Skip AI group images that have been restored (they shouldn't show as originals)
    if (src.includes('/ai/group-') || $el.attr('data-restored-ai')) {
      $el.remove();
      changed = true;
      return;
    }

    // Find the REAL original from Cloudinary (case-insensitive)
    const archiveUrl = findOriginalUrl(src) || src; // fall back to current src

    // Find AI version
    const aiUrl = findAiUrl(fn);

    if (aiUrl && archiveUrl !== aiUrl) {
      // Both archive original AND ai version available — full slider
      $el.replaceWith(buildSlider(archiveUrl, aiUrl, alt));
      totalSliders++;
    } else {
      // No AI version, or same URL — show original only, no slider chrome
      $el.replaceWith(buildOriginalOnly(archiveUrl, alt));
      totalOrigOnly++;
    }
    changed = true;
  });

  // Step 3: Ensure slider.css and slider.js are linked
  if (!html.includes('slider.css')) {
    $('link[href="style-jcl.css"]').after('<link rel="stylesheet" href="slider.css">');
    changed = true;
  }
  if (!html.includes('slider.js') && totalSliders > 0) {
    $('body').append('<script src="slider.js"></script>');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(fp, $.html());
    filesChanged++;
    if (filesChanged % 100 === 0) log(`  ${filesChanged} files processed...`);
  }
}

log(`\nDone:`);
log(`  Files changed: ${filesChanged}`);
log(`  Full sliders (AI + original): ${totalSliders}`);
log(`  Original only (no AI version): ${totalOrigOnly}`);
log(`  Nav images skipped: ${totalSkipped}`);
