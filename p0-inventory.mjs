#!/usr/bin/env node
/**
 * P0 — Page Inventory Graph
 * Builds a complete map of all pages, their inbound link counts, and conversion status.
 * Output: page-inventory.json
 */
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = __dirname;
const MIRROR_JCL = path.join(BASE, 'mirror/www.johnclilly.com');
const CLOUDINARY_MAP = JSON.parse(fs.readFileSync(path.join(BASE, 'cloudinary-map.json'), 'utf8'));

const log = msg => console.log(`[P0] ${msg}`);

// 1. All built pages
const builtPages = new Set(
  fs.readdirSync(BASE).filter(f => f.endsWith('.html'))
);

// 2. All mirror pages
const mirrorPages = new Set(
  fs.existsSync(MIRROR_JCL)
    ? fs.readdirSync(MIRROR_JCL).filter(f => f.endsWith('.html') || f.endsWith('.htm'))
    : []
);

// 3. Apify pages
const apifyData = JSON.parse(fs.readFileSync(path.join(BASE, 'apify-full.json'), 'utf8'));
const apifyMap = new Map(); // filename → record
for (const rec of apifyData) {
  const fn = path.basename(rec.url).replace(/\.htm$/, '.html') || 'index.html';
  apifyMap.set(fn, rec);
}

// 4. Extract all external johnclilly.com hrefs from built pages
const externalRefs = new Map(); // target filename → Set of source pages
const hrefCorruptionMap = new Map(); // corrupted href → normalized href

function normalizeHref(raw) {
  // Remove embedded HTML tags (markdown emphasis corruption: BT<em>JCL</em>... → BT_JCL_...)
  let normalized = raw
    .replace(/<\/?em>/gi, '_')
    .replace(/<\/?strong>/gi, '')
    .replace(/<\/?[a-z]+>/gi, '')
    .replace(/&amp;/gi, '&')
    .trim();
  return normalized;
}

function extractJclFilename(href) {
  const match = href.match(/(?:https?:\/\/www\.johnclilly\.com\/)?([^?#]+\.html?)/i);
  if (!match) return null;
  return path.basename(match[1]).replace(/\.htm$/, '.html');
}

for (const file of builtPages) {
  const html = fs.readFileSync(path.join(BASE, file), 'utf8');
  const $ = load(html, { decodeEntities: false });
  $('a[href]').each((_, el) => {
    const raw = $(el).attr('href') || '';
    if (!raw.includes('johnclilly.com')) return;
    const normalized = normalizeHref(raw);
    if (normalized !== raw) hrefCorruptionMap.set(raw, normalized);
    const fn = extractJclFilename(normalized);
    if (!fn) return;
    if (!externalRefs.has(fn)) externalRefs.set(fn, new Set());
    externalRefs.get(fn).add(file);
  });
}

log(`Built pages: ${builtPages.size}`);
log(`Mirror pages: ${mirrorPages.size}`);
log(`Apify records: ${apifyMap.size}`);
log(`Unique external johnclilly.com targets: ${externalRefs.size}`);
log(`Corrupted href instances: ${hrefCorruptionMap.size}`);

// 5. Build inventory
const inventory = {};
const allTargets = new Set([...builtPages, ...mirrorPages, ...externalRefs.keys()]);

for (const fn of allTargets) {
  const inboundRefs = externalRefs.get(fn)?.size || 0;
  const isBuilt = builtPages.has(fn);
  const inMirror = mirrorPages.has(fn);
  const inApify = apifyMap.has(fn);

  let tier = 'TIER_C';
  if (inboundRefs >= 3) tier = 'TIER_A';
  else if (inboundRefs >= 1) tier = 'TIER_B';

  let status = 'unknown';
  if (isBuilt) status = 'built';
  else if (inMirror && inApify) status = 'mirror+apify';
  else if (inMirror) status = 'mirror_only';
  else if (inApify) status = 'apify_only';
  else status = 'not_found';

  // Detect content type from mirror if available
  let contentType = 'unknown';
  if (inMirror) {
    try {
      const mirrorHtml = fs.readFileSync(path.join(MIRROR_JCL, fn), 'utf8');
      const $m = load(mirrorHtml);
      const imgCount = $m('img').length;
      const pText = $m('p').text().length;
      const hasDates = /\b(19[6-9]\d|200[01])\b/.test($m('body').text());
      const hasTable = $m('table').length > 0;
      if (imgCount > 8 && pText < 500) contentType = 'photo_gallery';
      else if (hasDates && pText > 1000) contentType = 'diary_excerpt';
      else if (hasTable) contentType = 'conference_record';
      else if (pText > 2000) contentType = 'essay';
      else if (imgCount > 3) contentType = 'biographical_photo';
      else contentType = 'link_index';
    } catch {}
  }

  inventory[fn] = { fn, status, tier, inboundRefs, isBuilt, inMirror, inApify, contentType };
}

// 6. Stats
const stats = {
  total: Object.keys(inventory).length,
  built: Object.values(inventory).filter(p => p.isBuilt).length,
  mirrorOnly: Object.values(inventory).filter(p => !p.isBuilt && p.inMirror).length,
  notFound: Object.values(inventory).filter(p => p.status === 'not_found').length,
  tierA: Object.values(inventory).filter(p => p.tier === 'TIER_A' && !p.isBuilt).length,
  tierB: Object.values(inventory).filter(p => p.tier === 'TIER_B' && !p.isBuilt).length,
  tierC: Object.values(inventory).filter(p => p.tier === 'TIER_C' && !p.isBuilt).length,
  externalRefCount: [...externalRefs.values()].reduce((a, s) => a + s.size, 0),
  corruptedHrefs: hrefCorruptionMap.size,
};

fs.writeFileSync(path.join(BASE, 'page-inventory.json'), JSON.stringify({ stats, inventory, hrefCorruptions: Object.fromEntries(hrefCorruptionMap) }, null, 2));
log(`Inventory written. Stats: ${JSON.stringify(stats)}`);
