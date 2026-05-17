#!/usr/bin/env node
/**
 * Fix section pages: add hero images with sliders, remove stub text.
 * Also inject sliders for icons/symbols previously skipped.
 */
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = __dirname;
const log = m => console.log(`[fix] ${m}`);

const AI_MAP = JSON.parse(fs.readFileSync(path.join(B, 'ai-image-map.json'), 'utf8'));
const DEDUPED = JSON.parse(fs.readFileSync(path.join(B, 'gen-targets-deduped.json'), 'utf8'));

// Build group-slug → cloudinary URL
const groupUrl = {};
for (const d of DEDUPED) {
  const sample = d.filenames[0];
  const entry = AI_MAP[sample];
  if (entry?.ai_url) groupUrl[d.id] = entry.ai_url;
}

const g = id => groupUrl[id];

// Section pages: which AI image to use as hero
const SECTION_HERO = {
  'cetacean.html':     { orig: 'dolphinwindow01.jpg', ai: g('group-02'), alt: 'Dolphin research',   caption: 'Cetacean intelligence research — Virgin Islands, 1960s' },
  'interspecies.html': { orig: 'margaretpeter3t.gif', ai: g('group-04'), alt: 'Margaret Howe',       caption: 'Margaret Howe and Peter the dolphin — 1965' },
  'isolation.html':    { orig: 'isotank02.gif',        ai: g('group-05'), alt: 'Isolation tank',      caption: 'Lilly\'s flotation tank — designed 1954, NIMH' },
  'mind.html':         { orig: 'mindchart01.jpg',      ai: g('group-06'), alt: 'Neural network',      caption: 'Brain mapping and consciousness research' },
  'ecco.html':         { orig: 'eccos.gif',            ai: g('group-09'), alt: 'E.C.C.O. cosmos',     caption: 'Earth Coincidence Control Office' },
  'bio.html':          { orig: 'bt_jcl_icerc1999.jpg', ai: g('group-01'), alt: 'John C. Lilly',       caption: 'John C. Lilly at the ICERC, 1999' },
  'writings.html':     { orig: 'bt_jcl_icerc1999.jpg', ai: g('group-01'), alt: 'JCL writings',        caption: 'Scientific papers and books, 1955–2001' },
  'memorial.html':     { orig: 'memorial01.jpg',       ai: g('group-07'), alt: 'Memorial',            caption: 'John C. Lilly · January 6, 1915 — September 30, 2001' },
  'vortex.html':       { orig: 'sofar.gif',            ai: g('group-11'), alt: 'SOFAR sonar',         caption: 'SOFAR channel and deep ocean sound mapping' },
  'thestory.html':     { orig: 'dolphinwindow01.jpg',  ai: g('group-02'), alt: 'Dolphin research',    caption: 'The story of John C. Lilly and the dolphins' },
  'photos.html':       { orig: 'dolphinwindow01.jpg',  ai: g('group-02'), alt: 'Archive photos',      caption: 'Original photographs from the research archive' },
  'gallery.html':      { orig: 'earth01.jpg',          ai: g('group-03'), alt: 'Gallery',             caption: 'Art and visual archive' },
  'music.html':        { orig: 'eccos.gif',            ai: g('group-09'), alt: 'Music',               caption: 'Audio and video recordings from the archive' },
  'inventions.html':   { orig: 'isotank02.gif',        ai: g('group-05'), alt: 'Inventions',          caption: 'The isolation tank — invented 1954' },
  'index.html':        { orig: 'dolphinwindow01.jpg',  ai: g('group-02'), alt: 'JCL Archive',         caption: 'John C. Lilly — 1915–2001' },
};

// Cloudinary URLs for original images (from cloudinary-map.json)
const CMAP = JSON.parse(fs.readFileSync(path.join(B, 'cloudinary-map.json'), 'utf8'));
function resolveOrig(fn) {
  for (const [k, v] of Object.entries(CMAP)) {
    if (k.endsWith('/' + fn) || k.endsWith('/' + fn.toLowerCase())) return v.secureUrl || v;
  }
  // fallback: use ai version as both panels (no original available)
  return null;
}

function sliderHtml(aiUrl, origUrl, alt, caption) {
  const safeAlt = (alt || '').replace(/"/g, '&quot;');
  const origPanel = origUrl
    ? `<div class="img-slider-original" style="background:#fff;padding:0;">
        <img src="${origUrl}" alt="${safeAlt} — original" loading="lazy" style="width:100%;height:100%;object-fit:cover;">
      </div>`
    : `<div class="img-slider-original" style="background:var(--bg-soft);display:flex;align-items:center;justify-content:center;padding:24px;">
        <img src="${aiUrl}" alt="${safeAlt} — archive" loading="lazy" style="max-width:100%;max-height:100%;object-fit:contain;">
      </div>`;

  return `<div class="slider-wrap" style="margin:0 0 8px;">
  <div class="img-slider" style="aspect-ratio:16/7;border-radius:0;border:none;border-bottom:1px solid var(--border);">
    ${origPanel}
    <div class="img-slider-ai">
      <img src="${aiUrl}" alt="${safeAlt} — AI reinterpretation" loading="eager">
      <div class="slider-ai-overlay"></div>
    </div>
    <div class="img-slider-handle" aria-hidden="true"></div>
    <span class="slider-label slider-label-ai">✦ AI</span>
    <span class="slider-label slider-label-orig">📷 Archive</span>
  </div>
  ${caption ? `<p class="slider-caption">${caption}</p>` : ''}
</div>`;
}

// Mini slider for icons/symbols
function miniSliderHtml(aiUrl, origSrc, alt) {
  return `<span class="icon-slider" title="Drag to compare original">
  <img class="icon-ai" src="${aiUrl}" alt="${alt} AI" loading="lazy">
  <img class="icon-orig" src="${origSrc}" alt="${alt} original" loading="lazy">
</span>`;
}

let updated = 0;

// 1. Add hero sliders to section pages + remove stub text
for (const [file, heroData] of Object.entries(SECTION_HERO)) {
  const fp = path.join(B, file);
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');
  const $ = load(html, { decodeEntities: false });

  // Remove stub text
  $('*').each((_, el) => {
    const t = $(el).text();
    if (t.includes('Here is extra page content')) {
      const h = $(el).html() || '';
      $(el).html(h.replace(/Here is extra page content\.?\s*/g, ''));
    }
  });

  // Add hero image slider right after the hero-panel/hero section
  const heroSection = $('section').first();
  const aiUrl = heroData.ai;
  const origUrl = resolveOrig(heroData.orig);
  if (aiUrl && !html.includes('img-slider')) {
    const slider = sliderHtml(aiUrl, origUrl, heroData.alt, heroData.caption);
    heroSection.after(slider);
    log(`  ✓ hero slider: ${file}`);
  }

  fs.writeFileSync(fp, $.html());
  updated++;
}

// 2. Re-run icon injection: include previously skipped icons with mini-slider treatment
// Icon images: any img NOT already in .img-slider or .icon-slider
const ICON_AI_MAP = {
  // dolphin navigation icons → group-12 (dolphin face)
  'dolphinnn3.gif':   g('group-12'),
  'dolphinback.gif':  g('group-02'),
  'dolphinlogo.gif':  g('group-12'),
  // nav arrows → generate a new one (use ocean art)
  'arrowl.gif':       g('group-11'),
  'arrowr.gif':       g('group-11'),
  // button/label icons → use abstract art
  'newbutton.gif':    g('group-03'),
  'greenline.gif':    g('group-11'),
  // logos
  'cetaceanlogo.gif': g('group-12'),
  'isolationlogo2.gif': g('group-05'),
  'garagelogo.gif':   g('group-00'),
  'januslogo.gif':    g('group-09'),
  'brainlogo3.gif':   g('group-06'),
};

// Add mini-slider CSS to style-jcl.css if not already there
const styleFile = path.join(B, 'style-jcl.css');
let styleContent = fs.readFileSync(styleFile, 'utf8');
if (!styleContent.includes('.icon-slider')) {
  styleContent += `
/* ── Mini icon slider ── */
.icon-slider {
  display: inline-block;
  position: relative;
  cursor: pointer;
  vertical-align: middle;
  overflow: hidden;
  border-radius: 4px;
}
.icon-slider .icon-ai {
  display: block;
  transition: opacity 0.25s;
}
.icon-slider .icon-orig {
  position: absolute; inset: 0;
  display: block; width: 100%; height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.25s;
  background: #fff;
}
.icon-slider:hover .icon-ai { opacity: 0; }
.icon-slider:hover .icon-orig { opacity: 1; }
.icon-slider::after {
  content: '⟷';
  position: absolute; bottom: 0; right: 0;
  font-size: 8px; color: #fff;
  background: rgba(10,77,140,0.5);
  padding: 1px 3px; border-radius: 2px;
  opacity: 0; transition: opacity 0.2s;
  pointer-events: none;
}
.icon-slider:hover::after { opacity: 1; }
`;
  fs.writeFileSync(styleFile, styleContent);
  log('  ✓ mini-slider CSS added to style-jcl.css');
}

// Process all pages for icon replacements
const htmlFiles = fs.readdirSync(B).filter(f => f.endsWith('.html'));
let iconCount = 0;
for (const file of htmlFiles) {
  const fp = path.join(B, file);
  let html = fs.readFileSync(fp, 'utf8');
  const $ = load(html, { decodeEntities: false });
  let changed = false;

  $('img.slider-skip, img[src]').each((_, el) => {
    const $el = $(el);
    // Skip if already in a slider
    if ($el.closest('.img-slider, .icon-slider').length) return;

    const src = $el.attr('src') || '';
    const fn = path.basename(src).toLowerCase();
    const aiUrl = ICON_AI_MAP[fn];
    if (!aiUrl) return;

    // Replace with mini hover-slider
    const alt = $el.attr('alt') || fn.replace('.gif','');
    const w = $el.attr('width') || '';
    const h = $el.attr('height') || '';
    const style = w ? `style="width:${w}px${h ? `;height:${h}px` : ''}"` : '';

    const mini = `<span class="icon-slider" ${style} title="Hover to see original">
      <img class="icon-ai" src="${aiUrl}" alt="${alt} AI" loading="lazy"${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''}>
      <img class="icon-orig" src="${src}" alt="${alt} original" loading="lazy"${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''}>
    </span>`;

    $el.replaceWith(mini);
    iconCount++;
    changed = true;
  });

  if (changed) {
    fs.writeFileSync(fp, $.html());
    updated++;
  }
}

log(`\nDone:`);
log(`  ${Object.keys(SECTION_HERO).length} section pages got hero sliders`);
log(`  ${iconCount} icon/symbol images wrapped in mini hover-sliders`);
log(`  ${updated} total files updated`);
