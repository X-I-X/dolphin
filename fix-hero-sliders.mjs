#!/usr/bin/env node
/**
 * Fix hero sliders on section pages.
 * Uses cheerio to surgically clean broken remnants and insert correct sliders.
 */
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = __dirname;
const log = m => console.log(`[hero] ${m}`);

const CMAP   = JSON.parse(fs.readFileSync(path.join(B, 'cloudinary-map.json'), 'utf8'));
const AI_MAP = JSON.parse(fs.readFileSync(path.join(B, 'ai-image-map.json'), 'utf8'));
const DEDUP  = JSON.parse(fs.readFileSync(path.join(B, 'gen-targets-deduped.json'), 'utf8'));

// Case-insensitive original image lookup
function origUrl(fn) {
  const norm = fn.toLowerCase().replace(/\.jpeg$/, '.jpg');
  for (const [k, v] of Object.entries(CMAP)) {
    const kn = path.basename(k).toLowerCase().replace(/\.jpeg$/, '.jpg');
    if (kn === norm) return v.secureUrl || v;
  }
  return null;
}

function aiUrl(groupId) {
  const d = DEDUP.find(x => x.id === groupId);
  if (!d) return null;
  const e = AI_MAP[d.filenames[0]];
  return e?.ai_url || null;
}

const HEROES = {
  'cetacean.html':     { origFn: 'dolphinwindow01.JPEG', group: 'group-02', caption: 'Bottlenose dolphin, Communications Research Institute, St. Thomas — 1960s' },
  'interspecies.html': { origFn: 'margaretpeter3T.gif',  group: 'group-04', caption: 'Margaret Howe and Peter the dolphin, flooded laboratory — 1965' },
  'isolation.html':    { origFn: 'isotank02.gif',        group: 'group-05', caption: 'Flotation tank prototype, National Institute of Mental Health, Bethesda — 1954' },
  'mind.html':         { origFn: 'brainbody.gif',        group: 'group-06', caption: 'Brain research documentation, NIMH — 1950s' },
  'ecco.html':         { origFn: 'eccos.gif',            group: 'group-09', caption: 'E.C.C.O. — Earth Coincidence Control Office' },
  'bio.html':          { origFn: 'bt_jcl_icerc1999.jpg', group: 'group-01', caption: 'John C. Lilly at the International Cetacean Research Conference — 1999' },
  'writings.html':     { origFn: 'bt_jcl_icerc1999.jpg', group: 'group-01', caption: 'Dr. John C. Lilly — five decades of published research' },
  'memorial.html':     { origFn: 'memorial01.jpg',       group: 'group-07', caption: 'John C. Lilly · January 6, 1915 — September 30, 2001' },
  'vortex.html':       { origFn: 'sofar.gif',            group: 'group-11', caption: 'SOFAR channel — deep ocean acoustic mapping' },
  'thestory.html':     { origFn: 'dolphinwindow01.JPEG', group: 'group-02', caption: 'The story of John C. Lilly and the dolphins' },
  'photos.html':       { origFn: 'dolphinwindow01.JPEG', group: 'group-02', caption: 'Original photographs from the research archive' },
  'gallery.html':      { origFn: 'earth01.jpg',          group: 'group-03', caption: 'Art and visual archive from the Lilly collection' },
  'index.html':        { origFn: 'dolphinwindow01.JPEG', group: 'group-02', caption: 'John C. Lilly Archive — 1915–2001' },
};

function buildHeroSlider(archiveImageUrl, aiImageUrl, caption) {
  return `<div class="hero-slider-wrap" style="position:relative;z-index:1;background:#000;">
  <div class="img-slider" style="aspect-ratio:21/9;border-radius:0;border:none;border-bottom:1px solid var(--border);" aria-label="Drag right to reveal original archive photograph">
    <div class="img-slider-original" style="position:absolute;inset:0;background:#fff;">
      <img src="${archiveImageUrl}" alt="Original archive photograph" loading="eager" style="width:100%;height:100%;object-fit:cover;">
    </div>
    <div class="img-slider-ai" style="position:absolute;inset:0;overflow:hidden;clip-path:inset(0 0 0 0%);">
      <img src="${aiImageUrl}" alt="AI reinterpretation" loading="eager" style="width:100%;height:100%;object-fit:cover;">
      <div class="slider-ai-overlay" style="position:absolute;inset:0;background:linear-gradient(to top,rgba(8,14,24,0.35) 0%,transparent 50%);pointer-events:none;"></div>
    </div>
    <div class="img-slider-handle" style="position:absolute;top:0;bottom:0;width:3px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,0.15),0 2px 12px rgba(0,0,0,0.25);z-index:10;left:0%;transform:translateX(-50%);" aria-hidden="true"></div>
    <span class="slider-label slider-label-ai" style="position:absolute;bottom:10px;left:12px;z-index:20;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;border-radius:99px;background:linear-gradient(135deg,#0A4D8C,#0A9AA4);color:#fff;pointer-events:none;">✦ AI</span>
    <span class="slider-label slider-label-orig" style="position:absolute;bottom:10px;right:12px;z-index:20;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;border-radius:99px;background:rgba(255,255,255,0.92);color:#0A4D8C;border:1px solid rgba(0,0,0,0.09);pointer-events:none;">📷 Original</span>
  </div>
  <p style="padding:8px 28px;margin:0;font-size:12px;color:var(--text-soft);background:var(--bg-soft);border-bottom:1px solid var(--border);font-style:italic;">${caption}</p>
</div>`;
}

for (const [fn, config] of Object.entries(HEROES)) {
  const fp = path.join(B, fn);
  if (!fs.existsSync(fp)) { log(`SKIP: ${fn}`); continue; }

  const archive = origUrl(config.origFn);
  const ai      = aiUrl(config.group);

  if (!archive) { log(`WARN no archive URL for ${config.origFn} in ${fn}`); continue; }
  if (!ai)      { log(`WARN no AI URL for ${config.group} in ${fn}`); continue; }

  let html = fs.readFileSync(fp, 'utf8');
  const $ = load(html, { decodeEntities: false });

  // 1. Remove ALL orphaned slider remnants (handles, labels, hero-slider-wrap)
  //    Anything that was part of a broken slider
  $('.img-slider-handle').each((_, el) => {
    const $el = $(el);
    if (!$el.closest('.img-slider').length) $el.remove();  // orphaned
  });
  $('.slider-label').each((_, el) => {
    const $el = $(el);
    if (!$el.closest('.img-slider').length) $el.remove();  // orphaned
  });
  $('.hero-slider-wrap').remove();
  $('.slider-caption').each((_, el) => {
    const $el = $(el);
    if (!$el.closest('.hero-slider-wrap').length) $el.remove();
  });
  // Remove any stray closing divs after the hero section
  // Remove empty divs
  $('div:empty').each((_, el) => {
    const $el = $(el);
    if (!$el.attr('class') && !$el.attr('style')) $el.remove();
  });

  // 2. Find the hero <section> and insert hero slider after it
  const heroSection = $('section').first();
  if (heroSection.length) {
    heroSection.after(buildHeroSlider(archive, ai, config.caption));
    log(`✓ ${fn}: archive=${archive.split('/').pop()} / ai=${ai.split('/').pop()}`);
  } else {
    log(`WARN no <section> in ${fn}`);
  }

  fs.writeFileSync(fp, $.html());
}

log('Hero slider fix complete.');
