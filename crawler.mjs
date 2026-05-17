/**
 * JCL Archive Crawler
 * Downloads all pages + assets from johnclilly.com and priority external sites
 * Outputs: mirror/ directory + asset-manifest.json
 */

import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { load } from 'cheerio';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BASE = '/home/node/.openclaw/workspace/builds/jcl-hub';
const MIRROR_DIR = `${BASE}/mirror`;
const MANIFEST_PATH = `${BASE}/asset-manifest.json`;

const SEEDS = [
  'http://www.johnclilly.com/'
];

const EXTERNAL_PRIORITY = [
  'http://www.photosynthesis.com/JOHN_C.html',
  'http://deoxy.org/lilly.htm',
  'http://www.roninpub.com/SciJoh.html',
  'http://www.earthtrust.org/delphis.html',
  'http://www.interspecies.com/',
  'http://www.samadhitank.com/',
  'http://www.floatation.com/',
  'http://www.garage.co.jp/lilly/'
];

const ALLOWED_HOSTS = new Set(['www.johnclilly.com', 'johnclilly.com']);

const visited = new Set();
const assetManifest = [];
const queue = [...SEEDS];

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9.]/g, '_').replace(/_+/g, '_').slice(0, 80);
}

function safePath(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    let p = u.pathname;
    if (p.endsWith('/')) p += 'index.html';
    if (!path.extname(p)) p += '.html';
    return path.join(MIRROR_DIR, host, p);
  } catch { return null; }
}

function fetch(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, {
      headers: { 'User-Agent': 'ArchiveBot/1.0 (memorial archive)' },
      timeout
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        resolve(fetch(redirectUrl, timeout));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        contentType: res.headers['content-type'] || '',
        body: Buffer.concat(chunks)
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isHtml(ct) { return ct.includes('text/html'); }

function extractLinks(html, baseUrl) {
  const $ = load(html);
  const links = new Set();
  const assets = [];

  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
      const abs = new URL(href, baseUrl).href;
      const host = new URL(abs).hostname;
      if (ALLOWED_HOSTS.has(host)) links.add(abs);
    } catch {}
  });

  const assetSelectors = [
    ['img', 'src'], ['link[rel="stylesheet"]', 'href'],
    ['script[src]', 'src'], ['source', 'src'],
    ['a[href$=".pdf"]', 'href'], ['a[href$=".gif"]', 'href'],
    ['a[href$=".jpg"]', 'href'], ['a[href$=".jpeg"]', 'href'],
    ['a[href$=".png"]', 'href'], ['a[href$=".mp3"]', 'href'],
    ['a[href$=".wav"]', 'href'],
  ];

  for (const [sel, attr] of assetSelectors) {
    $(sel).each((_, el) => {
      try {
        const val = $(el).attr(attr);
        if (!val || val.startsWith('data:')) return;
        const abs = new URL(val, baseUrl).href;
        assets.push(abs);
      } catch {}
    });
  }

  return { links, assets };
}

async function downloadAsset(url, sourcePage) {
  try {
    const fp = safePath(url);
    if (!fp) return;
    if (fs.existsSync(fp)) {
      const buf = fs.readFileSync(fp);
      return { url, localPath: fp, sha256: sha256(buf), cached: true };
    }
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    const res = await fetch(url, 10000);
    if (res.status !== 200) return;
    fs.writeFileSync(fp, res.body);
    const hash = sha256(res.body);
    const ext = path.extname(url.split('?')[0]) || '';
    const kind = res.contentType.split(';')[0].trim();
    return { url, localPath: fp, sha256: hash, sizeBytes: res.body.length, kind, sourcePage };
  } catch { return null; }
}

async function crawlPage(url) {
  if (visited.has(url)) return;
  visited.add(url);

  const fp = safePath(url);
  if (!fp) return;

  let body;
  if (fs.existsSync(fp)) {
    body = fs.readFileSync(fp);
    process.stdout.write(`C `);
  } else {
    try {
      const res = await fetch(url);
      if (res.status !== 200) { process.stdout.write(`✗ `); return; }
      body = res.body;
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, body);
      process.stdout.write(`✓ `);
    } catch (e) {
      process.stdout.write(`✗ `);
      return;
    }
  }

  const ct = '';
  const html = body.toString('utf8', 0, Math.min(body.length, 500000));
  if (!html.includes('<') ) return;

  const { links, assets } = extractLinks(html, url);

  for (const link of links) {
    if (!visited.has(link)) queue.push(link);
  }

  for (const assetUrl of assets) {
    const result = await downloadAsset(assetUrl, url);
    if (result) assetManifest.push(result);
    await sleep(100);
  }
}

// Main crawl loop
console.log('🐬 JCL Archive Crawler starting...');
console.log(`Seed: ${SEEDS[0]}`);
console.log(`Mirror dir: ${MIRROR_DIR}\n`);

fs.mkdirSync(MIRROR_DIR, { recursive: true });
fs.mkdirSync(`${BASE}/snapshots`, { recursive: true });

let pageCount = 0;
while (queue.length > 0) {
  const url = queue.shift();
  if (visited.has(url)) continue;
  process.stdout.write(`[${++pageCount}] ${url.replace('http://www.johnclilly.com', '')}\n  `);
  await crawlPage(url);
  console.log('');
  await sleep(800);
}

console.log(`\n✅ johnclilly.com crawl complete. Pages: ${pageCount}, Assets: ${assetManifest.length}`);

// Now crawl priority external sites (single page + assets only, no deep crawl)
console.log('\n🌐 Crawling priority external sites...');
for (const extUrl of EXTERNAL_PRIORITY) {
  try {
    console.log(`  → ${extUrl}`);
    const res = await fetch(extUrl, 12000);
    if (res.status !== 200) { console.log(`    ✗ ${res.status}`); continue; }
    const fp = safePath(extUrl);
    if (fp) {
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, res.body);
    }
    const html = res.body.toString('utf8', 0, 200000);
    const { assets } = extractLinks(html, extUrl);
    for (const assetUrl of assets) {
      const result = await downloadAsset(assetUrl, extUrl);
      if (result) assetManifest.push(result);
      await sleep(200);
    }
    console.log(`    ✓ ${assets.length} assets`);
    await sleep(2000);
  } catch(e) {
    console.log(`    ✗ ${e.message}`);
  }
}

// Write manifest
const deduped = [];
const seen = new Set();
for (const item of assetManifest) {
  if (!item) continue;
  const key = item.sha256;
  if (!seen.has(key)) { seen.add(key); deduped.push(item); }
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(deduped, null, 2));
console.log(`\n📋 Asset manifest written: ${deduped.length} unique assets`);
console.log(`   Path: ${MANIFEST_PATH}`);

// Summary stats
const byKind = {};
for (const item of deduped) {
  const k = (item.kind || 'unknown').split('/')[1] || 'unknown';
  byKind[k] = (byKind[k] || 0) + 1;
}
console.log('\nAsset breakdown:', byKind);
