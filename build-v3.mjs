#!/usr/bin/env node
/**
 * JCL Archive — Build v3 (Senate-approved)
 * Phases: P2 (design rebuild) | P3 (link rewrite) | P4 (TIER_A) | P5 (TIER_B+C) | P6 (verify)
 * All phases idempotent, state-tracked, cheerio-based.
 * Usage: node build-v3.mjs --phase=P2|P3|P4|P5|P6|all [--limit=N]
 */
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = __dirname;
const log = m => console.log(`[v3] ${m}`);
const MIRROR = path.join(B, 'mirror/www.johnclilly.com');
const STATE_FILE = path.join(B, 'build-state-v3.json');
const INVENTORY_FILE = path.join(B, 'page-inventory.json');
const CLOUDINARY_MAP = JSON.parse(fs.readFileSync(path.join(B, 'cloudinary-map.json'), 'utf8'));

const args = process.argv.slice(2);
const phase = args.find(a => a.startsWith('--phase='))?.split('=')[1] || 'all';
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '9999');

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { P2:{status:'pending',done:[]}, P3:{status:'pending',done:[]}, P4:{status:'pending',done:[]}, P5:{status:'pending',done:[]}, P6:{status:'pending'}, lastCheckpoint:null }; }
}
function saveState(s) { s.lastCheckpoint = new Date().toISOString(); fs.writeFileSync(STATE_FILE, JSON.stringify(s,null,2)); }
function loadInventory() { return JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8')); }

// ── Shared HTML helpers ──────────────────────────────────────────────────────

const NAV_HTML = `<nav class="topnav">
  <a href="index.html" class="nav-logo">🐬 JCL Archive</a>
  <div class="nav-links">
    <a href="thestory.html">The Story</a>
    <a href="cetacean.html">Cetacean Nation</a>
    <a href="interspecies.html">Interspecies</a>
    <a href="mind.html">Brain &amp; Mind</a>
    <a href="isolation.html">Isolation Tanks</a>
    <a href="ecco.html">E.C.C.O.</a>
    <a href="current.html">Events</a>
    <a href="music.html">Music &amp; Video</a>
    <a href="writings.html">Writings</a>
    <a href="inventions.html">Inventions</a>
    <a href="vortex.html">Vortex</a>
    <a href="bio.html">Biography</a>
    <a href="photos.html">Photos</a>
    <a href="gallery.html">Gallery</a>
    <a href="memorial.html">1915–2001</a>
  </div>
</nav>`;

const FOOTER_HTML = `<footer>
  <div class="footer-inner">
    <span class="footer-logo">🐬 John C. Lilly Archive</span>
    John C. Lilly · 1915–2001 · Preserved for research and education<br>
    <a href="index.html">Home</a> · <a href="memorial.html">Memorial</a> · <a href="writings.html">Writings</a> · <a href="sitemap.xml">Sitemap</a>
  </div>
</footer>`;

function headHtml({ title, desc, section }) {
  const d = desc || `From the archive of Dr. John C. Lilly — dolphin research pioneer and isolation tank inventor.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — John C. Lilly Archive</title>
  <meta name="description" content="${d}">
  <meta property="og:title" content="${title} — John C. Lilly Archive">
  <meta property="og:description" content="${d}">
  <meta property="og:type" content="article">
  <link rel="stylesheet" href="components.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐬</text></svg>">
</head>
<body>`;
}

// Resolve image URLs through Cloudinary map; fall back to mirror-relative path
function resolveImg(src) {
  if (!src) return src;
  if (src.startsWith('https://res.cloudinary.com')) return src;
  // Try full URL match
  for (const [orig, data] of Object.entries(CLOUDINARY_MAP)) {
    if (orig === src || orig.endsWith('/' + path.basename(src))) return data.secureUrl || data;
  }
  // Try basename match
  const bn = path.basename(src);
  for (const [orig, data] of Object.entries(CLOUDINARY_MAP)) {
    if (path.basename(orig) === bn) return data.secureUrl || data;
  }
  return src; // keep as-is if no match
}

// Normalize corrupted hrefs (markdown emphasis tags inside href)
function normalizeHref(raw) {
  return raw.replace(/<\/?em>/gi,'_').replace(/<\/?strong>/gi,'').replace(/<\/?[a-z]+>/gi,'').replace(/&amp;/gi,'&').trim();
}

function localFilename(href) {
  const n = normalizeHref(href);
  const m = n.match(/(?:https?:\/\/www\.johnclilly\.com\/)?([^?#/]+\.html?)/i);
  return m ? m[1].replace(/\.htm$/,'.html') : null;
}

// ── P2: Rebuild 19 core section pages ────────────────────────────────────────

const SECTION_DEFS = {
  'index.html': {
    title: 'John C. Lilly Archive',
    hero: { title: 'John C. <span>Lilly</span>', sub: 'Scientist · Explorer · Visionary · 1915–2001', meta: 'PERMANENT MEMORIAL ARCHIVE' },
    desc: 'The complete archive of Dr. John C. Lilly — dolphin communication pioneer, isolation tank inventor, consciousness researcher.',
    sections: [
      { label: 'Cetacean Nation', title: 'Dolphin & Whale Intelligence', desc: 'Half a century of research into the minds of cetaceans — the other intelligence on Earth.', link: 'cetacean.html', img: null },
      { label: 'Interspecies Communication', title: 'Human–Dolphin Language', desc: 'The Margaret Howe experiment and the JANUS project — attempts to build a shared language.', link: 'interspecies.html', img: null },
      { label: 'Isolation Tanks', title: 'Flotation & Consciousness', desc: 'Lilly invented the sensory deprivation tank in 1954. Decades of inner exploration followed.', link: 'isolation.html', img: null },
      { label: 'Brain & Mind', title: 'The Human Biocomputer', desc: 'Neuroscience, programming the brain, metaprogramming, and the nature of consciousness.', link: 'mind.html', img: null },
      { label: 'E.C.C.O.', title: 'Earth Coincidence Control Office', desc: 'A cosmological framework Lilly developed from his deepest isolation tank and psychedelic experiences.', link: 'ecco.html', img: null },
      { label: 'Biography', title: 'A Life in Science', desc: 'From medical school through Caltech, NIMH, the Virgin Islands lab, Esalen, and beyond.', link: 'bio.html', img: null },
    ]
  },
  'cetacean.html': {
    title: 'Cetacean Nation',
    hero: { title: 'Cetacean <span>Nation</span>', sub: 'The study of dolphins, porpoises, and whales — the other intelligences of Earth.', meta: 'CETACEAN RESEARCH · 1955–2001' },
    desc: 'John C. Lilly\'s cetacean research — dolphin intelligence, communication, and the case for recognizing non-human minds.'
  },
  'interspecies.html': {
    title: 'Interspecies Communication',
    hero: { title: 'Interspecies <span>Communication</span>', sub: 'Building a shared language between humans and dolphins — the JANUS project and the Margaret Howe experiment.', meta: 'COMMUNICATION RESEARCH · 1960–1975' },
    desc: 'The Margaret Howe experiment, JANUS, videophone, and touchscreen research — Lilly\'s attempts to communicate across species.'
  },
  'isolation.html': {
    title: 'Isolation Tanks',
    hero: { title: 'Isolation <span>Tanks</span>', sub: 'Lilly invented sensory deprivation flotation in 1954. Decades of consciousness exploration followed.', meta: 'FLOTATION RESEARCH · 1954–2001' },
    desc: 'The history of isolation tank research — from the first NIH prototype to LSD experiments to modern samadhi tanks.'
  },
  'mind.html': {
    title: 'Brain & Mind',
    hero: { title: 'Brain &amp; <span>Mind</span>', sub: 'The human biocomputer — neuroscience, metaprogramming, and the architecture of consciousness.', meta: 'NEUROSCIENCE RESEARCH · 1950–2001' },
    desc: 'Lilly\'s neuroscience work — brain mapping, the biocomputer metaphor, metaprogramming, and simulations of God.'
  },
  'ecco.html': {
    title: 'E.C.C.O.',
    hero: { title: '<span>E.C.C.O.</span>', sub: 'Earth Coincidence Control Office — a cosmological framework born from the deepest inner explorations.', meta: 'COSMOLOGY · CONSCIOUSNESS · ECCO' },
    desc: 'The Earth Coincidence Control Office — Lilly\'s framework for understanding the organizing intelligence behind meaningful coincidences.'
  },
  'bio.html': {
    title: 'Biography',
    hero: { title: 'A Life in <span>Science</span>', sub: 'January 6, 1915 — September 30, 2001', meta: 'BIOGRAPHICAL ARCHIVE' },
    desc: 'The biography of John C. Lilly — medical education, Caltech, NIMH, the Caribbean lab, Esalen, and a lifetime of exploration.'
  },
  'thestory.html': {
    title: 'The Story',
    hero: { title: 'The <span>Story</span>', sub: 'How one scientist\'s curiosity launched the global dolphin consciousness movement.', meta: 'NARRATIVE HISTORY' },
    desc: 'The story of John C. Lilly — the full narrative of his life, work, and legacy.'
  },
  'writings.html': {
    title: 'Writings',
    hero: { title: '<span>Writings</span>', sub: 'Books, papers, lectures, and transcripts spanning five decades of research.', meta: 'PUBLICATIONS · PAPERS · TRANSCRIPTS' },
    desc: 'The collected writings of John C. Lilly — books, scientific papers, conference talks, and unpublished transcripts.'
  },
  'memorial.html': {
    title: '1915–2001',
    hero: { title: 'John C. <span>Lilly</span>', sub: 'January 6, 1915 — September 30, 2001', meta: 'IN MEMORIAM' },
    desc: 'A memorial to Dr. John C. Lilly — tributes, obituaries, and remembrances.'
  },
  'vortex.html': {
    title: 'Vortex',
    hero: { title: '<span>Vortex</span>', sub: 'Deep mapping, SOFAR channels, cetacean long-range communication, and the cosmic perspective.', meta: 'VORTEX · DEEP OCEAN · COSMOS' },
    desc: 'Lilly\'s vortex research — SOFAR channel, deep ocean mapping, and the cosmic scale of cetacean communication.'
  },
  'photos.html': {
    title: 'Photo Archive',
    hero: { title: 'Photo <span>Archive</span>', sub: 'Original photographs from the Lilly research archives — lab, dolphins, colleagues, and expeditions.', meta: 'PHOTOGRAPHIC ARCHIVE' },
    desc: 'Historical photographs from the John C. Lilly research archive.'
  },
  'gallery.html': {
    title: 'Gallery',
    hero: { title: '<span>Gallery</span>', sub: 'Visual archive of the Communication Research Institute and associated work.', meta: 'VISUAL ARCHIVE' },
    desc: 'Gallery of images from the John C. Lilly archive.'
  },
};

async function runP2(state, inventory) {
  log('── P2: Rebuild core section pages with Sierra design');
  const done = new Set(state.P2.done);
  let count = 0;

  for (const [fn, def] of Object.entries(SECTION_DEFS)) {
    if (done.has(fn)) { log(`  skip: ${fn}`); continue; }

    // Load existing page body content from current built version
    let existingBody = '';
    if (fs.existsSync(path.join(B, fn))) {
      const existing = load(fs.readFileSync(path.join(B, fn), 'utf8'), {decodeEntities:false});
      // Extract the main content (skip nav, footer, archive-notice, breadcrumb)
      existing('.topnav, footer, .archive-notice, .breadcrumb, nav').remove();
      existingBody = existing('body').html() || '';
    }

    const hero = def.hero;
    const html = headHtml({title:def.title, desc:def.desc}) + `
${NAV_HTML}
<div class="hero-panel">
  <h1 class="hero-title">${hero.title}</h1>
  <p class="hero-sub">${hero.sub}</p>
  <span class="hero-meta">${hero.meta}</span>
</div>
<div class="page">
  <div class="archive-notice">
    ⚑ <strong>Permanent Archive</strong> — All content and assets are hosted independently.
    Original source: <a href="http://www.johnclilly.com" target="_blank" rel="noopener">johnclilly.com</a>
  </div>
  <div class="prose">
${existingBody || '<p>Content loading…</p>'}
  </div>
</div>
${FOOTER_HTML}
</body></html>`;

    fs.writeFileSync(path.join(B, fn), html);
    state.P2.done.push(fn);
    if (state.P2.done.length % 5 === 0) saveState(state);
    log(`  ✓ ${fn}`);
    count++;
  }

  state.P2.status = 'complete';
  state.P2.completedAt = new Date().toISOString();
  saveState(state);
  log(`P2 complete: ${count} core pages rebuilt.`);
}

// ── P3: Cheerio link rewrite ─────────────────────────────────────────────────

async function runP3(state, inventory) {
  log('── P3: Rewriting external johnclilly.com hrefs → local paths (cheerio)');
  const htmlFiles = fs.readdirSync(B).filter(f => f.endsWith('.html'));
  const done = new Set(state.P3.done);
  let totalFixed = 0, totalPending = 0, filesFixed = 0;

  // Build set of available local pages
  const localPages = new Set(fs.readdirSync(B).filter(f => f.endsWith('.html')));

  for (const file of htmlFiles) {
    if (done.has(file)) continue;
    const fp = path.join(B, file);
    let html = fs.readFileSync(fp, 'utf8');
    const $ = load(html, { decodeEntities: false });
    let changed = false;

    $('a[href]').each((_, el) => {
      const raw = $(el).attr('href') || '';
      if (!raw.includes('johnclilly.com') && !raw.startsWith('http://www.johnclilly')) return;
      const normalized = normalizeHref(raw);
      const fn = localFilename(normalized);
      if (!fn) return;

      $(el).attr('data-original-href', raw);

      if (localPages.has(fn)) {
        $(el).attr('href', fn);
        $(el).removeAttr('target');
        changed = true; totalFixed++;
      } else {
        // Page not yet built — mark as pending, keep href for now
        $(el).attr('href', fn);
        $(el).addClass('pending-page');
        $(el).removeAttr('target');
        changed = true; totalPending++;
      }
    });

    // Also fix img src
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (!src.includes('johnclilly.com')) return;
      const resolved = resolveImg(src);
      if (resolved !== src) { $(el).attr('src', resolved); changed = true; }
    });

    if (changed) {
      fs.writeFileSync(fp, $.html());
      filesFixed++;
    }
    state.P3.done.push(file);
    if (state.P3.done.length % 10 === 0) saveState(state);
  }

  state.P3.status = 'complete';
  state.P3.totalFixed = totalFixed;
  state.P3.totalPending = totalPending;
  state.P3.filesFixed = filesFixed;
  state.P3.completedAt = new Date().toISOString();
  saveState(state);
  log(`P3 complete: ${filesFixed} files updated, ${totalFixed} links fixed, ${totalPending} pending (not yet built).`);
}

// ── P4/P5: Convert mirror pages ──────────────────────────────────────────────

// XSS sanitisation — strip scripts and event handlers from mirror HTML
function sanitizeMirrorHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(iframe|object|embed|applet|form)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .trim();
}

// Extract body content from mirror HTML via cheerio
function extractMirrorBody(mirrorHtml) {
  const $ = load(sanitizeMirrorHtml(mirrorHtml), { decodeEntities: false });
  // Remove nav elements common in old site
  $('table[width="100%"]:first, #nav, .nav, #header, #footer, #menu, .menu').remove();
  // Try to find main content
  const candidates = ['#content','#main','main','.content','.main','td[valign="top"]','body'];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 100) {
      return el.html() || '';
    }
  }
  return $('body').html() || '';
}

function detectContentType(bodyHtml, fn) {
  const imgCount = (bodyHtml.match(/<img/gi) || []).length;
  const pLen = bodyHtml.replace(/<[^>]+>/g, '').length;
  if (fn.includes('photo') || fn.includes('photo') || (imgCount > 8 && pLen < 500)) return 'photo_gallery';
  if (fn.includes('womandolph') || fn.includes('diary')) return 'diary_excerpt';
  if (fn.startsWith('JCL_') || fn.startsWith('BT_') || fn.includes('Conference') || fn.includes('ICERC')) return 'conference_record';
  if (pLen > 2000) return 'essay';
  if (imgCount > 3) return 'biographical_photo';
  return 'link_index';
}

const SECTION_FOR_FILE = fn => {
  const f = fn.toLowerCase();
  if (/womandolph|cetacean|dolphin|doljump|dolsmile|doltank|spermwhale|mandaloph/.test(f)) return {label:'Cetacean Nation', back:'cetacean.html'};
  if (/janus|interspecies|encounter|videophone|touchscreen|teacher|paddl/.test(f)) return {label:'Interspecies Communication', back:'interspecies.html'};
  if (/isola|isotank|tank|lsdtank|stage|melting|drowning|pool|moderntank/.test(f)) return {label:'Isolation Tanks', back:'isolation.html'};
  if (/mind|brain|cognitiv|metaprog|program|simulat|nmr/.test(f)) return {label:'Brain & Mind', back:'mind.html'};
  if (/ecco|vortex|sofar|mapping|neptune|cyclone/.test(f)) return {label:'Vortex / E.C.C.O.', back:'vortex.html'};
  if (/john|bio|lab|scientist|history|yngjl|marpeter|davidsissy|hofmann|esalen/.test(f)) return {label:'Biography', back:'bio.html'};
  if (/photo|gallery|01_99/.test(f)) return {label:'Photo Archive', back:'photos.html'};
  return {label:'Writings', back:'writings.html'};
};

function buildMirrorPage({ fn, bodyHtml, title, sourceUrl, section }) {
  const contentType = detectContentType(bodyHtml, fn);
  const sec = section || SECTION_FOR_FILE(fn);

  // Rewrite images to Cloudinary
  const $ = load(bodyHtml, { decodeEntities: false });
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const resolved = resolveImg(src);
    if (resolved !== src) $(el).attr('src', resolved);
    $(el).attr('loading', 'lazy');
    if (!$(el).attr('alt')) $(el).attr('alt', '');
    // Wrap in photo-grid-item if in a group
  });

  // Fix local links — if sibling file exists, rewrite to local
  const localPages = new Set(fs.readdirSync(B).filter(f => f.endsWith('.html')));
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('johnclilly.com')) {
      const norm = normalizeHref(href);
      const target = localFilename(norm);
      if (target) {
        $(el).attr('data-original-href', href);
        $(el).attr('href', target);
        $(el).removeAttr('target');
        if (!localPages.has(target)) $(el).addClass('pending-page');
      }
    }
  });

  let rewrittenBody = $.html();

  // Wrap image-dense content in photo-grid
  if (contentType === 'photo_gallery' || contentType === 'biographical_photo') {
    rewrittenBody = `<div class="photo-grid">${rewrittenBody.replace(/<img /g, '<div class="photo-grid-item"><img ').replace(/(<img [^>]+>)/g, '$1</div>')}</div>`;
  }

  return headHtml({ title, desc: `${title} — from the John C. Lilly archive.` }) + `
${NAV_HTML}
<div class="hero-panel" style="padding:48px 28px 36px;">
  <h1 class="hero-title" style="font-size:clamp(1.4rem,4vw,2.4rem);">${title}</h1>
  <span class="hero-meta">${sec.label.toUpperCase()}</span>
</div>
<div class="page-prose">
  <div class="archive-notice">
    ⚑ Archived from <a href="${sourceUrl || 'http://www.johnclilly.com'}" target="_blank" rel="noopener">${sourceUrl || 'johnclilly.com'}</a>
  </div>
  <p class="breadcrumb"><a href="index.html">Home</a><span>›</span><a href="${sec.back}">${sec.label}</a><span>›</span>${title}</p>
  <div class="prose">
${rewrittenBody}
  </div>
</div>
${FOOTER_HTML}
</body></html>`;
}

async function convertMirrorPages(state, inventory, tiers, phaseName) {
  log(`── ${phaseName}: Converting mirror pages (${tiers.join(',')})`);
  const done = new Set(state[phaseName]?.done || []);
  const apifyData = JSON.parse(fs.readFileSync(path.join(B, 'apify-full.json'), 'utf8'));
  const apifyMap = new Map(apifyData.map(r => [path.basename(r.url).replace(/\.htm$/,'.html'), r]));
  const localPages = new Set(fs.readdirSync(B).filter(f => f.endsWith('.html')));

  const targets = Object.values(inventory.inventory).filter(p =>
    !p.isBuilt && p.inMirror && tiers.includes(p.tier)
  );

  let count = 0, errors = 0;
  for (const pg of targets) {
    if (count >= limit) break;
    if (done.has(pg.fn)) continue;
    const mirrorPath = path.join(MIRROR, pg.fn);
    if (!fs.existsSync(mirrorPath)) { log(`  ! not found in mirror: ${pg.fn}`); continue; }

    try {
      let mirrorHtml = fs.readFileSync(mirrorPath, 'utf8');
      const bodyHtml = extractMirrorBody(mirrorHtml);

      // Extract title from mirror
      const $m = load(mirrorHtml);
      let title = $m('title').text().replace(/\s*[-–|].*$/, '').trim() || pg.fn.replace('.html','').replace(/[_-]/g,' ');
      if (title.toLowerCase().includes('john c. lilly') && title.length > 30) {
        title = title.replace(/john c\. lilly[^a-z]*/i,'').trim() || title;
      }
      if (!title) title = pg.fn.replace('.html','');

      const sourceUrl = `http://www.johnclilly.com/${pg.fn}`;
      const pageHtml = buildMirrorPage({ fn: pg.fn, bodyHtml, title, sourceUrl, section: null });
      fs.writeFileSync(path.join(B, pg.fn), pageHtml);

      state[phaseName].done.push(pg.fn);
      if (state[phaseName].done.length % 10 === 0) saveState(state);
      log(`  ✓ [${pg.tier}|${pg.contentType}] ${pg.fn}`);
      count++;
    } catch (err) {
      log(`  ✗ ${pg.fn}: ${err.message}`);
      errors++;
    }
  }

  const remaining = targets.filter(p => !done.has(p.fn) && !state[phaseName].done.includes(p.fn)).length;
  if (remaining === 0) {
    state[phaseName].status = 'complete';
    state[phaseName].completedAt = new Date().toISOString();
  }
  saveState(state);
  log(`${phaseName}: ${count} built, ${errors} errors, ${remaining} remaining.`);
  if (remaining > 0) process.exit(2);
}

// ── P6: Verification ─────────────────────────────────────────────────────────

async function runP6(state) {
  log('── P6: Verification');
  const htmlFiles = fs.readdirSync(B).filter(f => f.endsWith('.html'));
  let externalCount = 0, pendingCount = 0;

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(B, file), 'utf8');
    const $ = load(html, { decodeEntities: false });
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('johnclilly.com') && !href.includes('archive-notice')) externalCount++;
      if ($(el).hasClass('pending-page')) pendingCount++;
    });
  }

  const report = {
    totalPages: htmlFiles.length,
    externalJclRefs: externalCount,
    pendingLinks: pendingCount,
    cloudinaryAssets: Object.keys(CLOUDINARY_MAP).length,
    verifiedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(B, 'verification-report.json'), JSON.stringify(report, null, 2));
  state.P6.status = 'complete';
  state.P6.report = report;
  saveState(state);
  log(`P6: ${report.totalPages} pages, ${report.externalJclRefs} external JCL refs remaining, ${report.pendingLinks} pending links.`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const state = loadState();
  const inventory = fs.existsSync(INVENTORY_FILE) ? loadInventory() : null;
  const run = p => phase === 'all' || phase === p;

  if (run('P2') && state.P2.status !== 'complete') await runP2(state, inventory);
  if (run('P3') && state.P3.status !== 'complete') await runP3(state, inventory);
  if (run('P4') && state.P4.status !== 'complete') await convertMirrorPages(state, inventory, ['TIER_A'], 'P4');
  if (run('P5') && state.P5.status !== 'complete') await convertMirrorPages(state, inventory, ['TIER_B','TIER_C'], 'P5');
  if (run('P6') && state.P6.status !== 'complete') await runP6(state);

  const done = ['P2','P3','P4','P5','P6'].filter(p => state[p]?.status === 'complete').length;
  log(`Phases complete: ${done}/5`);
  if (done === 5) { log('✅ BUILD COMPLETE'); process.exit(0); }
}

main().catch(e => { console.error(e); process.exit(1); });
