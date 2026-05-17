#!/usr/bin/env node
/**
 * inject-sliders.mjs
 * Wraps every content image on every page in a comparison slider.
 * Requires ai-image-map.json to exist (run gen-ai-images.mjs first).
 *
 * Usage: node inject-sliders.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = __dirname;
const log = m => console.log(`[sliders] ${m}`);
const DRY = process.argv.includes('--dry-run');

const AI_MAP = JSON.parse(fs.readFileSync(path.join(B, 'ai-image-map.json'), 'utf8'));
const aiByFilename = new Map(Object.entries(AI_MAP).map(([fn, d]) => [fn, d.ai_url]));

// Skip tiny nav/UI images
const SKIP_FN = new Set(['menusplash.gif','menunew.gif','menuhome.gif','menuoutline.gif',
  'arrowl.gif','arrowr.gif','newbutton.gif','greenline.gif','dolphinnn3.gif',
  'dolphinback.gif','menusplash.gif','cetaceanlogo.gif','isolationlogo2.gif',
  'garagelogo.gif','dolphinlogo.gif','januslogo.gif','brainlogo3.gif']);

function shouldSkip(src) {
  const fn = path.basename(src).toLowerCase();
  if (SKIP_FN.has(fn)) return true;
  // Skip very small UI elements by name pattern
  if (/^(menu|arrow|button|logo|nav|icon|dot|bullet|spacer|blank|new|green)/i.test(fn)) return true;
  return false;
}

function buildSlider(originalSrc, aiSrc, altText) {
  const safeAlt = (altText || '').replace(/"/g, '&quot;');
  return `<div class="slider-wrap">
  <div class="img-slider" role="img" aria-label="Image comparison: AI reinterpretation vs original archive photo">
    <div class="img-slider-original">
      <img src="${originalSrc}" alt="${safeAlt} — original archive image" loading="lazy">
    </div>
    <div class="img-slider-ai">
      <img src="${aiSrc}" alt="${safeAlt} — AI reinterpretation" loading="lazy">
      <div class="slider-ai-overlay"></div>
    </div>
    <div class="img-slider-handle" aria-hidden="true"></div>
    <span class="slider-label slider-label-ai">✦ AI</span>
    <span class="slider-label slider-label-orig">📷 Original</span>
  </div>
</div>`;
}

function buildNoAiSlider(originalSrc, altText) {
  const safeAlt = (altText || '').replace(/"/g, '&quot;');
  return `<div class="slider-wrap">
  <div class="img-slider no-ai">
    <div class="img-slider-original">
      <img src="${originalSrc}" alt="${safeAlt}" loading="lazy">
    </div>
  </div>
</div>`;
}

const htmlFiles = fs.readdirSync(B).filter(f => f.endsWith('.html'));
let totalSliders = 0, totalNoAi = 0, filesUpdated = 0;

for (const file of htmlFiles) {
  const fp = path.join(B, file);
  const html = fs.readFileSync(fp, 'utf8');
  const $ = load(html, { decodeEntities: false });
  let changed = false;

  // Add slider CSS and JS if not present
  if (!html.includes('slider.css')) {
    $('link[href="style-jcl.css"]').after('\n  <link rel="stylesheet" href="slider.css">');
    changed = true;
  }
  if (!html.includes('slider.js')) {
    $('body').append('\n<script src="slider.js"></script>');
    changed = true;
  }

  // Process each img
  $('img[src]').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') || '';
    const alt = $el.attr('alt') || '';
    const fn = path.basename(src).toLowerCase();

    // Skip if already in a slider
    if ($el.closest('.img-slider').length) return;
    // Skip nav/UI
    if (shouldSkip(src)) { $el.addClass('slider-skip'); return; }
    // Skip very tiny images (no meaningful content)
    if ($el.attr('width') && parseInt($el.attr('width')) < 50) { $el.addClass('slider-skip'); return; }
    if ($el.attr('height') && parseInt($el.attr('height')) < 50) { $el.addClass('slider-skip'); return; }

    const aiUrl = aiByFilename.get(fn);

    if (aiUrl) {
      $el.replaceWith(buildSlider(src, aiUrl, alt));
      totalSliders++;
    } else {
      $el.replaceWith(buildNoAiSlider(src, alt));
      totalNoAi++;
    }
    changed = true;
  });

  if (changed) {
    if (!DRY) fs.writeFileSync(fp, $.html());
    filesUpdated++;
    if (filesUpdated % 50 === 0) log(`  ${filesUpdated} files processed...`);
  }
}

log(`Done: ${filesUpdated} files updated`);
log(`  With AI slider: ${totalSliders}`);
log(`  Original only: ${totalNoAi}`);
if (DRY) log('  (DRY RUN — no files written)');
