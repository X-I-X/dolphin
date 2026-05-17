#!/usr/bin/env node
/**
 * JCL Archive — Master Build Script
 * Tiers: T2 (URL rewrite), T3 (page conversions), T4 (sitemap/meta), T5 (external)
 * Fully resumable via build-state.json
 * Usage: node build-master.mjs [--tier T2|T3|T4|T5|all] [--limit N]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = __dirname;
const STATE_FILE = path.join(BASE, 'build-state.json');
const CLOUDINARY_MAP = path.join(BASE, 'cloudinary-map.json');
const CONTENT_DIR = path.join(BASE, 'content');
const MIRROR_DIR = path.join(BASE, 'mirror');

// Parse args
const args = process.argv.slice(2);
const tierArg = args.find(a => a.startsWith('--tier='))?.split('=')[1] || 'all';
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '9999');

function log(msg) { console.log(`[BUILD] ${msg}`); }
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { t2: { status: 'pending', pagesRewritten: [] }, t3: { status: 'pending', converted: [], failed: [] }, t4: { status: 'pending' }, t5: { status: 'pending' } }; }
}
function saveState(state) {
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
function loadCloudinaryMap() {
  try { return JSON.parse(fs.readFileSync(CLOUDINARY_MAP, 'utf8')); }
  catch { return {}; }
}

// ─────────────────────────────────────────────
// T2: Rewrite existing HTML pages with Cloudinary URLs + new style
// ─────────────────────────────────────────────
function rewriteCloudinaryUrls(html, cloudMap) {
  let out = html;
  for (const [origUrl, data] of Object.entries(cloudMap)) {
    const secureUrl = data.secureUrl || data;
    // Escape special regex chars in URL
    const escaped = origUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), secureUrl);
  }
  return out;
}

function upgradeStyle(html) {
  // Replace old style reference
  return html.replace(/href="style\.css"/g, 'href="style-v2.css"');
}

function addArchiveNotice(html) {
  const notice = `<div class="archive-notice">
    <strong>⚑ Archival Note:</strong> This is a preserved archive of Dr. John C. Lilly's original work.
    All assets are hosted permanently. Original site: <a href="http://www.johnclilly.com" target="_blank" rel="noopener">johnclilly.com</a>
  </div>`;
  return html.replace(/(<div class="page">)/i, `$1\n${notice}`);
}

async function runT2(state, cloudMap) {
  log('── T2: Rewriting existing HTML pages with Cloudinary URLs + v2 style');
  const htmlFiles = fs.readdirSync(BASE).filter(f => f.endsWith('.html'));
  const done = new Set(state.t2.pagesRewritten || []);
  let count = 0;

  for (const file of htmlFiles) {
    if (done.has(file)) { log(`  skip (done): ${file}`); continue; }
    const fp = path.join(BASE, file);
    let html = fs.readFileSync(fp, 'utf8');
    html = rewriteCloudinaryUrls(html, cloudMap);
    html = upgradeStyle(html);
    html = addArchiveNotice(html);
    fs.writeFileSync(fp, html);
    state.t2.pagesRewritten.push(file);
    saveState(state);
    log(`  ✓ ${file}`);
    count++;
  }

  state.t2.status = 'complete';
  state.t2.completedAt = new Date().toISOString();
  saveState(state);
  log(`T2 complete: ${count} pages rewritten.`);
}

// ─────────────────────────────────────────────
// T3: Convert content/*.md files to HTML pages
// ─────────────────────────────────────────────

// Section routing table: maps filename patterns to section slugs
const SECTION_MAP = {
  womandolph: 'cetacean',
  doljump: 'cetacean',
  dolsmile: 'cetacean',
  doltank: 'cetacean',
  oahadol: 'cetacean',
  mandolph: 'cetacean',
  cetacean: 'cetacean',
  communication: 'cetacean',
  spermwhale: 'cetacean',
  dolphin: 'cetacean',
  janus: 'interspecies',
  interspecies: 'interspecies',
  interspeciesx: 'interspecies',
  encountersx: 'interspecies',
  teachersx: 'interspecies',
  videophone: 'interspecies',
  touchscreen: 'interspecies',
  isolation: 'isolation',
  isotank: 'isolation',
  moderntank: 'isolation',
  tanks: 'isolation',
  tanklog: 'isolation',
  lsdtank: 'isolation',
  tankx: 'isolation',
  tank: 'isolation',
  poolcg: 'isolation',
  drowning: 'isolation',
  stages: 'isolation',
  melting: 'isolation',
  deepself: 'isolation',
  observer: 'isolation',
  mind: 'mind',
  brain: 'mind',
  cognitive: 'mind',
  metaprog: 'mind',
  programming: 'mind',
  simulations: 'mind',
  nmrscan: 'mind',
  ecco: 'ecco',
  vortex: 'vortex',
  mapping: 'vortex',
  sofar: 'vortex',
  cyclone: 'vortex',
  neptune: 'vortex',
  science: 'writings',
  scientific: 'writings',
  discoveries: 'writings',
  writings: 'writings',
  lilly: 'writings',
  lillywave: 'writings',
  outline: 'writings',
  economics: 'writings',
  dyadic: 'writings',
  experiment: 'cetacean',
  labcg: 'bio',
  laboratory: 'bio',
  lab: 'bio',
  john: 'bio',
  janus: 'bio',
  bio: 'bio',
  scientist: 'bio',
  history: 'bio',
  yngjl: 'bio',
  johnboat: 'bio',
  johntank: 'bio',
  johnjapan: 'bio',
  johnmar: 'bio',
  johngrad: 'bio',
  babyjohn: 'bio',
  johnmit: 'bio',
  marpeter: 'bio',
  davidsissy: 'bio',
  johnsissy: 'bio',
  johntim: 'bio',
  johntoni: 'bio',
  johnburgess: 'bio',
  hofmann: 'bio',
  JLEsalen: 'bio',
  maui: 'maui',
  music: 'music',
  musicvid: 'music',
  eccox: 'ecco',
  eccocd: 'ecco',
};

const SECTION_LABELS = {
  cetacean: 'Cetacean Nation',
  interspecies: 'Interspecies Communication',
  isolation: 'Isolation Tanks',
  mind: 'Brain & Mind',
  ecco: 'E.C.C.O.',
  vortex: 'Vortex',
  writings: 'Writings',
  bio: 'Biography',
  maui: 'Maui',
  music: 'Music & Video',
};

const SECTION_BACK = {
  cetacean: 'cetacean.html',
  interspecies: 'interspecies.html',
  isolation: 'isolation.html',
  mind: 'mind.html',
  ecco: 'ecco.html',
  vortex: 'vortex.html',
  writings: 'writings.html',
  bio: 'bio.html',
  maui: 'maui.html',
  music: 'music.html',
};

function detectSection(filename) {
  const lower = filename.toLowerCase().replace(/\.md$/, '');
  for (const [pattern, section] of Object.entries(SECTION_MAP)) {
    if (lower.startsWith(pattern.toLowerCase()) || lower.includes(pattern.toLowerCase())) {
      return section;
    }
  }
  return 'writings';
}

function mdToHtml(mdText) {
  // Simple markdown → HTML conversion
  let html = mdText
    // Remove URL header line
    .replace(/^URL:.*\n/m, '')
    // Headers
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Links with images
    .replace(/\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g, '<a href="$3"><img src="$2" alt="$1" loading="lazy"></a>')
    // Inline images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr>')
    // Blockquote
    .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    // Clean up excessive blank lines
    .replace(/\n{3,}/g, '\n\n');

  // Wrap paragraphs (lines not already in tags)
  const lines = html.split('\n');
  const result = [];
  let inBlock = false;
  let para = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (para.length) { result.push('<p>' + para.join(' ') + '</p>'); para = []; }
      continue;
    }
    if (/^<(h[1-6]|hr|ul|ol|li|blockquote|div|table|img)/.test(trimmed)) {
      if (para.length) { result.push('<p>' + para.join(' ') + '</p>'); para = []; }
      result.push(trimmed);
    } else {
      para.push(trimmed);
    }
  }
  if (para.length) result.push('<p>' + para.join(' ') + '</p>');

  return result.join('\n');
}

function rewriteImageUrls(html, cloudMap) {
  let out = html;
  for (const [origUrl, data] of Object.entries(cloudMap)) {
    const secureUrl = data.secureUrl || data;
    const escaped = origUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), secureUrl);
    // Also handle relative paths
    const filename = path.basename(origUrl);
    const relEscaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(src=["'])(?:[^"']*/)?(${relEscaped})`, 'gi'), `$1${secureUrl}`);
  }
  return out;
}

function buildPageHtml({ title, section, sectionLabel, backLink, bodyHtml, sourceUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — John C. Lilly Archive</title>
  <meta name="description" content="${title} — from the archive of Dr. John C. Lilly, pioneer of dolphin communication research and isolation tank inventor.">
  <meta property="og:title" content="${title} — John C. Lilly Archive">
  <meta property="og:description" content="Archived material from the John C. Lilly collection.">
  <meta property="og:type" content="article">
  <link rel="stylesheet" href="style-v2.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐬</text></svg>">
</head>
<body>
<nav class="topnav">
  <a href="index.html" class="nav-logo">🐬 JCL</a>
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
    <a href="links.html">Links</a>
    <a href="gallery.html">Gallery</a>
    <a href="memorial.html">1915–2001</a>
  </div>
</nav>

<div class="page">
  <div class="archive-notice">
    <strong>⚑ Archival Note:</strong> This is a preserved archive of Dr. John C. Lilly's original work.
    All assets are hosted permanently. Original: <a href="${sourceUrl || 'http://www.johnclilly.com'}" target="_blank" rel="noopener">${sourceUrl || 'johnclilly.com'}</a>
  </div>

  <p style="font-family:var(--font-mono);font-size:0.78rem;color:var(--ink-light);margin-bottom:28px;">
    <a href="index.html">Home</a> › <a href="${backLink}">${sectionLabel}</a> › ${title}
  </p>

${bodyHtml}

  <div class="divider">· · · ✦ · · ·</div>

</div>

<footer>
  <div class="footer-rule">— ✦ ✦ ✦ —</div>
  John C. Lilly Archive · 1915–2001 · Preserved for research and education<br>
  <a href="index.html">Home</a> · <a href="${backLink}">${sectionLabel}</a> · <a href="memorial.html">Memorial</a>
</footer>
</body>
</html>`;
}

function extractTitleFromMd(mdText) {
  const match = mdText.match(/^#\s+(.+)$/m);
  if (match) return match[1].replace(/\*\*/g, '').trim();
  // Try first non-empty line after URL
  const lines = mdText.replace(/^URL:.*\n/m, '').split('\n').map(l => l.trim()).filter(Boolean);
  return lines[0]?.replace(/^#+\s*/, '').replace(/\*\*/g, '') || 'Archive Page';
}

async function runT3(state, cloudMap, limit = 9999) {
  log('── T3: Converting content/*.md files to HTML pages');
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const done = new Set(state.t3.converted || []);
  const failed = new Set(state.t3.failed || []);
  let count = 0;
  let errorCount = 0;

  for (const file of files) {
    if (count >= limit) { log(`  limit reached (${limit})`); break; }
    if (done.has(file)) continue;

    try {
      const mdPath = path.join(CONTENT_DIR, file);
      const mdText = fs.readFileSync(mdPath, 'utf8');

      const section = detectSection(file);
      const sectionLabel = SECTION_LABELS[section] || 'Archive';
      const backLink = SECTION_BACK[section] || 'index.html';
      const title = extractTitleFromMd(mdText);

      // Extract source URL
      const urlMatch = mdText.match(/^URL:\s*(.+)$/m);
      const sourceUrl = urlMatch ? urlMatch[1].trim() : null;

      // Convert md → html body
      let bodyHtml = mdToHtml(mdText);
      // Rewrite image URLs to Cloudinary
      bodyHtml = rewriteImageUrls(bodyHtml, cloudMap);

      // Wrap in full page
      const pageName = file.replace('.md', '.html');
      const fullHtml = buildPageHtml({ title, section, sectionLabel, backLink, bodyHtml, sourceUrl });
      fs.writeFileSync(path.join(BASE, pageName), fullHtml);

      state.t3.converted.push(file);
      saveState(state);
      log(`  ✓ ${file} → ${pageName} [${section}]`);
      count++;
    } catch (err) {
      log(`  ✗ ${file}: ${err.message}`);
      state.t3.failed.push(file);
      saveState(state);
      errorCount++;
    }
  }

  const remaining = files.filter(f => !done.has(f) && !failed.has(f) && !state.t3.converted.includes(f)).length;
  if (remaining === 0) {
    state.t3.status = 'complete';
    state.t3.completedAt = new Date().toISOString();
    saveState(state);
  }
  log(`T3: ${count} pages built, ${errorCount} errors, ~${remaining - count} remaining.`);
  return { count, errorCount, remaining };
}

// ─────────────────────────────────────────────
// T4: Sitemap, robots, 404, favicon, OG tags
// ─────────────────────────────────────────────
async function runT4(state) {
  log('── T4: Site polish (sitemap, 404, robots)');
  const htmlFiles = fs.readdirSync(BASE).filter(f => f.endsWith('.html'));

  // Sitemap
  const sitemapUrls = htmlFiles.map(f => `  <url><loc>https://jcl-archive.netlify.app/${f}</loc></url>`).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>`;
  fs.writeFileSync(path.join(BASE, 'sitemap.xml'), sitemap);
  log('  ✓ sitemap.xml');

  // Robots
  fs.writeFileSync(path.join(BASE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: https://jcl-archive.netlify.app/sitemap.xml\n`);
  log('  ✓ robots.txt');

  // 404
  const html404 = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>404 — John C. Lilly Archive</title>
  <link rel="stylesheet" href="style-v2.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐬</text></svg>">
</head>
<body>
<nav class="topnav">
  <a href="index.html" class="nav-logo">🐬 JCL</a>
</nav>
<div class="page" style="text-align:center;padding-top:120px;">
  <div class="retro-stamp">404</div>
  <h1 style="margin-top:24px;">Page Not Found</h1>
  <p style="color:var(--ink-light);font-family:var(--font-mono);font-size:0.9rem;">This page may have drifted into the isolation tank.</p>
  <p style="margin-top:24px;"><a href="index.html">← Return to Archive Home</a></p>
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(BASE, '404.html'), html404);
  log('  ✓ 404.html');

  // _redirects (Netlify)
  fs.writeFileSync(path.join(BASE, '_redirects'), `/* /404.html 404\n`);
  log('  ✓ _redirects');

  state.t4.status = 'complete';
  state.t4.completedAt = new Date().toISOString();
  saveState(state);
  log('T4 complete.');
}

// ─────────────────────────────────────────────
// T5: External site integration (photosynthesis.com)
// ─────────────────────────────────────────────
async function runT5(state, cloudMap) {
  log('── T5: External site integration');

  const photosDir = path.join(MIRROR_DIR, 'www.photosynthesis.com');
  if (!fs.existsSync(photosDir)) {
    log('  photosynthesis mirror not found, skipping');
    state.t5.status = 'skipped';
    saveState(state);
    return;
  }

  // Read the mirrored photosynthesis page
  const sourceHtml = path.join(photosDir, 'JOHN_C.html');
  if (!fs.existsSync(sourceHtml)) {
    log('  JOHN_C.html not found in mirror');
    state.t5.status = 'skipped';
    saveState(state);
    return;
  }

  let html = fs.readFileSync(sourceHtml, 'utf8');

  // Extract body content using regex
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1] : html;

  // Clean up old navigation/ads
  let cleanBody = rawBody
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img[^>]+googlesyndication[^>]*>/gi, '')
    .trim();

  // Fix local image paths to use mirror or Cloudinary
  cleanBody = rewriteImageUrls(cleanBody, cloudMap);

  // Fix relative image paths for photosynthesis images
  const psImagesDir = path.join(photosDir, 'images');
  if (fs.existsSync(psImagesDir)) {
    const psImages = fs.readdirSync(psImagesDir);
    for (const img of psImages) {
      const localPath = `./mirror/www.photosynthesis.com/images/${img}`;
      cleanBody = cleanBody.replace(new RegExp(`(src=["'])(?:images/|./images/)?(${img.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), `$1${localPath}`);
    }
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>John C. Lilly — Photosynthesis Archive</title>
  <meta name="description" content="Archived profile of John C. Lilly from photosynthesis.com — preserved for research and education.">
  <link rel="stylesheet" href="style-v2.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐬</text></svg>">
</head>
<body>
<nav class="topnav">
  <a href="index.html" class="nav-logo">🐬 JCL</a>
  <div class="nav-links">
    <a href="thestory.html">The Story</a>
    <a href="cetacean.html">Cetacean Nation</a>
    <a href="interspecies.html">Interspecies</a>
    <a href="mind.html">Brain &amp; Mind</a>
    <a href="isolation.html">Isolation Tanks</a>
    <a href="ecco.html">E.C.C.O.</a>
    <a href="bio.html">Biography</a>
    <a href="memorial.html">1915–2001</a>
  </div>
</nav>

<div class="page">
  <div class="archive-notice">
    <strong>⚑ External Archive:</strong> Originally published at
    <a href="http://www.photosynthesis.com/JOHN_C.html" target="_blank" rel="noopener">photosynthesis.com/JOHN_C.html</a>.
    Preserved here as the original may be deactivated.
  </div>

  <p style="font-family:var(--font-mono);font-size:0.78rem;color:var(--ink-light);margin-bottom:28px;">
    <a href="index.html">Home</a> › <a href="bio.html">Biography</a> › Photosynthesis Profile
  </p>

  <div class="card">
    ${cleanBody}
  </div>

  <div class="divider">· · · ✦ · · ·</div>
</div>

<footer>
  <div class="footer-rule">— ✦ ✦ ✦ —</div>
  John C. Lilly Archive · 1915–2001 · Preserved for research and education<br>
  <a href="index.html">Home</a> · <a href="bio.html">Biography</a> · <a href="memorial.html">Memorial</a>
</footer>
</body>
</html>`;

  fs.writeFileSync(path.join(BASE, 'photosynthesis-profile.html'), fullHtml);
  log('  ✓ photosynthesis-profile.html');

  state.t5.status = 'complete';
  state.t5.completedAt = new Date().toISOString();
  saveState(state);
  log('T5 complete.');
}

// ─────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────
async function main() {
  const state = loadState();
  const cloudMap = loadCloudinaryMap();
  log(`Cloudinary map: ${Object.keys(cloudMap).length} entries`);
  log(`Tier: ${tierArg} | Limit: ${limitArg}`);

  const runTier = t => tierArg === 'all' || tierArg === t;

  if (runTier('T2') && state.t2.status !== 'complete') {
    await runT2(state, cloudMap);
  } else if (runTier('T2')) { log('T2 already complete.'); }

  if (runTier('T3') && state.t3.status !== 'complete') {
    const result = await runT3(state, cloudMap, limitArg);
    if (result.remaining > 0) {
      log(`T3 partial: ${result.remaining} pages still remaining.`);
      process.exit(2); // Signal: partial, needs re-run
    }
  } else if (runTier('T3')) { log('T3 already complete.'); }

  if (runTier('T4') && state.t4.status !== 'complete') {
    await runT4(state);
  } else if (runTier('T4')) { log('T4 already complete.'); }

  if (runTier('T5') && state.t5.status !== 'complete') {
    await runT5(state, cloudMap);
  } else if (runTier('T5')) { log('T5 already complete.'); }

  const allDone = ['t2','t3','t4','t5'].every(t => state[t].status === 'complete' || state[t].status === 'skipped');
  if (allDone) {
    log('✅ ALL TIERS COMPLETE. JCL Archive build finished.');
    process.exit(0);
  }
  log('Build run finished. Some tiers may need re-run.');
}

main().catch(err => { console.error(err); process.exit(1); });
