/**
 * JCL Archive — Cloudinary Batch Uploader
 * Uploads all assets from asset-manifest.json to Cloudinary jcl-archive/ folder
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import FormData from 'form-data';

const BASE = '/home/node/.openclaw/workspace/builds/jcl-hub';
const MANIFEST_PATH = `${BASE}/asset-manifest.json`;
const MAP_PATH = `${BASE}/cloudinary-map.json`;
const LOG_PATH = `${BASE}/cloudinary-upload-log.json`;

// Load credentials
const creds = JSON.parse(fs.readFileSync('/home/node/.openclaw/workspace/secrets/cloudinary.json'));
const CLOUD_NAME = creds.cloud_name;
const API_KEY = creds.key;
const API_SECRET = creds.api_secret;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getSection(localPath) {
  const p = localPath.toLowerCase();
  if (p.includes('/gifs/')) return 'gifs';
  if (p.includes('photo') || p.match(/babyjohn|yngJL|johngradx|poolCG|doltank|labCG|johnboat|johnjanus|johnburg|john1960|marpeter|johnmar|johntoni|JLEsalen|johntim|doljump|videophone|oahudol|johntank|isotank|johnjapan|JL&|dolsmile|hofmann|australia|icercJapan|john_eiffel|albertJohn|PHB_JCL|JCL_/i)) return 'photos';
  if (p.includes('dolphin') || p.includes('cetacean') || p.includes('whale')) return 'cetacean';
  if (p.includes('isolation') || p.includes('tank')) return 'isolation';
  if (p.includes('janus')) return 'janus';
  if (p.includes('brain') || p.includes('mind') || p.includes('lilly')) return 'brain';
  if (p.match(/\.(gif|png|jpg|jpeg|webp)$/i)) return 'images';
  if (p.match(/\.(pdf|doc|docx)$/i)) return 'documents';
  if (p.match(/\.(mp3|wav|ogg|aif)$/i)) return 'audio';
  if (p.match(/\.(mp4|mov|webm|avi)$/i)) return 'video';
  return 'misc';
}

function makePublicId(localPath, section) {
  const base = path.basename(localPath);
  const noExt = base.replace(/\.[^.]+$/, '');
  const slug = noExt.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 60);
  return `jcl-archive/${section}/${slug}`;
}

function cloudinarySign(params) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(sorted + API_SECRET).digest('hex');
}

async function uploadToCloudinary(localPath, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const ext = path.extname(localPath).toLowerCase();

  let resourceType = 'image';
  if (['.pdf', '.doc', '.docx', '.txt'].includes(ext)) resourceType = 'raw';
  if (['.mp4', '.mov', '.webm', '.avi'].includes(ext)) resourceType = 'video';
  if (['.mp3', '.wav', '.ogg'].includes(ext)) resourceType = 'video';

  const signParams = { public_id: publicId, timestamp: timestamp.toString() };
  const signature = cloudinarySign(signParams);

  const form = new FormData();
  form.append('file', fs.createReadStream(localPath));
  form.append('public_id', publicId);
  form.append('timestamp', String(timestamp));
  form.append('api_key', API_KEY);
  form.append('signature', signature);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
      method: 'POST',
      headers: form.getHeaders()
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch(e) { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    form.pipe(req);
  });
}

// Load manifest
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH));
console.log(`📦 Loaded manifest: ${manifest.length} unique assets`);

// Load existing map if any (resume support)
let cloudinaryMap = {};
if (fs.existsSync(MAP_PATH)) {
  cloudinaryMap = JSON.parse(fs.readFileSync(MAP_PATH));
  console.log(`♻️  Resuming — ${Object.keys(cloudinaryMap).length} already uploaded`);
}

// Filter out non-uploadable and already done
const toUpload = manifest.filter(item => {
  if (!item || !item.localPath) return false;
  if (!fs.existsSync(item.localPath)) return false;
  if (cloudinaryMap[item.url]) return false; // already done
  const ext = path.extname(item.localPath).toLowerCase();
  // Skip HTML, CSS, JS — only upload media/documents
  if (['.html', '.css', '.js', '.htm'].includes(ext)) return false;
  const size = fs.statSync(item.localPath).size;
  if (size > 10 * 1024 * 1024) { console.log(`⚠️  Skipping large file (${(size/1024/1024).toFixed(1)}MB): ${item.localPath}`); return false; }
  if (size < 100) return false; // skip empty/tiny
  return true;
});

console.log(`🚀 Uploading ${toUpload.length} assets (${manifest.length - toUpload.length} skipped/done)`);
console.log(`Cloud: ${CLOUD_NAME}\n`);

let uploaded = 0;
let failed = 0;
let skipped = 0;
const errors = [];

for (let i = 0; i < toUpload.length; i++) {
  const item = toUpload[i];
  const section = getSection(item.localPath);
  const publicId = makePublicId(item.localPath, section);
  
  process.stdout.write(`[${i+1}/${toUpload.length}] ${path.basename(item.localPath)} → jcl-archive/${section}/... `);

  try {
    const result = await uploadToCloudinary(item.localPath, publicId);
    
    if (result.status === 200 && result.body.secure_url) {
      cloudinaryMap[item.url] = {
        publicId: result.body.public_id,
        secureUrl: result.body.secure_url,
        format: result.body.format,
        bytes: result.body.bytes,
        section
      };
      console.log(`✅ ${result.body.secure_url}`);
      uploaded++;
    } else if (result.body.error?.message?.includes('already exists')) {
      // Already uploaded under same public_id — record the URL
      cloudinaryMap[item.url] = {
        publicId,
        secureUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}`,
        section,
        cached: true
      };
      console.log(`♻️  exists`);
      skipped++;
    } else {
      console.log(`✗ ${result.status}: ${result.body.error?.message || 'unknown'}`);
      errors.push({ url: item.url, error: result.body.error?.message, status: result.status });
      failed++;
    }
  } catch(e) {
    console.log(`✗ ${e.message}`);
    errors.push({ url: item.url, error: e.message });
    failed++;
  }

  // Save map every 20 uploads
  if ((i + 1) % 20 === 0) {
    fs.writeFileSync(MAP_PATH, JSON.stringify(cloudinaryMap, null, 2));
    console.log(`  💾 Progress saved (${Object.keys(cloudinaryMap).length} total mapped)`);
  }

  // Rate limit: 4 concurrent max — we're doing sequential with small delay
  await sleep(300);
}

// Final save
fs.writeFileSync(MAP_PATH, JSON.stringify(cloudinaryMap, null, 2));
fs.writeFileSync(LOG_PATH, JSON.stringify({ uploaded, failed, skipped, errors, timestamp: new Date().toISOString() }, null, 2));

console.log(`\n✅ Upload complete`);
console.log(`   Uploaded: ${uploaded}`);
console.log(`   Already existed: ${skipped}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total mapped: ${Object.keys(cloudinaryMap).length}`);
console.log(`   Map: ${MAP_PATH}`);
if (errors.length) {
  console.log(`\n⚠️  Errors:`);
  errors.slice(0, 10).forEach(e => console.log(`   ${e.url}: ${e.error}`));
}
