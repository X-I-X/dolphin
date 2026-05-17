#!/usr/bin/env node
/**
 * Upload a local file to Cloudinary jcl-archive/ai/
 * Usage: node upload-to-cloudinary.mjs <localPath> <publicId>
 * Outputs: JSON with secure_url on stdout
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '../../secrets/cloudinary.json'), 'utf8'));

const [localPath, publicId] = process.argv.slice(2);
if (!localPath || !publicId) { console.error('Usage: upload-to-cloudinary.mjs <path> <publicId>'); process.exit(1); }

const fileData = fs.readFileSync(localPath);
const base64 = fileData.toString('base64');
const mimeType = localPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
const dataUri = `data:${mimeType};base64,${base64}`;

const timestamp = Math.floor(Date.now() / 1000);
const folder = 'jcl-archive/ai';
const sigStr = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${creds.api_secret}`;
const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

const body = new URLSearchParams({
  file: dataUri,
  folder,
  public_id: publicId,
  timestamp: timestamp.toString(),
  api_key: creds.api_key || creds.key,
  signature,
}).toString();

const result = await new Promise((resolve, reject) => {
  const req = https.request({
    method: 'POST',
    hostname: 'api.cloudinary.com',
    path: `/v1_1/${creds.cloud_name}/image/upload`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

console.log(JSON.stringify(result));
