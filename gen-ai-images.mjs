#!/usr/bin/env node
/**
 * gen-ai-images.mjs
 * For each meaningful content image, generates a DALL-E reinterpretation,
 * uploads to Cloudinary jcl-archive/ai/, and writes ai-image-map.json.
 *
 * Usage: node gen-ai-images.mjs [--limit=N] [--test]
 * --test: run 3 images only, print prompts, don't upload
 * --limit=N: process at most N images
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = __dirname;
const MAP_FILE = path.join(B, 'ai-image-map.json');
const CMAP_FILE = path.join(B, 'cloudinary-map.json');
const STATE_FILE = path.join(B, 'ai-gen-state.json');

const args = process.argv.slice(2);
const testMode = args.includes('--test');
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '9999');

const log = m => console.log(`[ai-gen] ${m}`);

// Load existing state
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { done: {}, failed: [] }; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

function loadAiMap() {
  try { return JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')); }
  catch { return {}; }
}
function saveAiMap(m) { fs.writeFileSync(MAP_FILE, JSON.stringify(m, null, 2)); }

const cloudinaryCreds = JSON.parse(fs.readFileSync(path.join(B, '../../secrets/cloudinary.json'), 'utf8'));

// ── Prompt generation ─────────────────────────────────────────────────────

function buildPrompt(filename, originalUrl) {
  const fn = filename.toLowerCase().replace(/\.(jpg|jpeg|gif|png)$/, '');

  // Navigation / UI elements — skip
  const skipPatterns = ['menu','arrow','button','newbutton','greenline','nav','logo','spacer','blank','bullet','dot'];
  if (skipPatterns.some(p => fn.includes(p))) return null;

  // Dolphin / cetacean images
  if (/dolphin|dol(?!t)|porpois|whale|cetac|sperm|beluga|orca/.test(fn)) {
    if (/face|smile|portrait/.test(fn))
      return 'Ultra-realistic close-up underwater portrait of a bottlenose dolphin, bioluminescent ocean water, rays of deep blue light filtering through the surface above, bubbles, photorealistic, 8K, cinematic';
    if (/jump|leap|fly|aerial/.test(fn))
      return 'Dramatic photograph of a dolphin mid-leap out of the ocean at golden hour, spray catching sunlight, dark blue ocean below, photorealistic, cinematic wide angle, 8K';
    if (/brain|mind/.test(fn))
      return 'Scientific illustration of a dolphin brain anatomy, cross-section view, bioluminescent neural pathways, dark background, ultra-detailed, medical illustration style';
    if (/glyph|art|paint/.test(fn))
      return 'Abstract artistic interpretation of dolphin intelligence, sacred geometry, deep ocean blues and teals, luminous glowing lines, digital art, high resolution';
    return 'Ultra-realistic underwater photograph of a bottlenose dolphin swimming in clear deep blue ocean water, bioluminescent particles, shafts of light from the surface, photorealistic, award-winning nature photography, 8K';
  }

  // Tank / isolation / floating
  if (/tank|isola|float|samadhi|pool|water/.test(fn)) {
    return 'Modern sensory deprivation flotation pod in a spa-like research laboratory, dramatic architectural lighting, dark water reflecting light, minimalist design, photorealistic interior photography, 8K';
  }

  // John Lilly portraits
  if (/john|jcl|lilly|scientist|biog|grad|portrait/.test(fn)) {
    if (/young|baby|child/.test(fn))
      return 'Formal black and white portrait of a young scientist in the 1930s, clean background, natural light, timeless photographic style';
    if (/japan/.test(fn))
      return 'Photorealistic portrait of a distinguished Western scientist in Japan, 1960s, architectural background, natural light, Magnum Photos style';
    return 'Professional portrait of a visionary scientist in a 1960s research laboratory, warm natural lighting, books and scientific equipment in background, photorealistic, cinematic';
  }

  // Margaret Howe / woman and dolphin
  if (/woman|marg|howe|wom|mar/.test(fn)) {
    return 'A woman researcher in a flooded research facility interacting with a dolphin, 1960s aesthetic, warm documentary photography style, water reflections, photorealistic';
  }

  // Lab / laboratory
  if (/lab|laborat|research|institute|cri/.test(fn)) {
    return 'Modernist research laboratory from the 1960s, scientific equipment, large windows overlooking tropical water, clean architectural lines, photorealistic interior photography';
  }

  // Brain / mind / neural
  if (/brain|mind|neuro|cogni|metaprog|simula/.test(fn)) {
    return 'Abstract visualization of neural networks and consciousness, bioluminescent pathways connecting nodes, dark background, scientific illustration meets generative art, 8K';
  }

  // Ecco / cosmic / vortex
  if (/ecco|vortex|cosmic|cyclone|spiral|galaxy|universe|space/.test(fn)) {
    return 'Cosmic visualization — Earth from orbit surrounded by energy field patterns, bioluminescent blue and teal light waves, deep space background, photorealistic CGI, 8K';
  }

  // Sound / sonar / wave
  if (/sound|sonar|wave|sofar|freq|signal|vibra/.test(fn)) {
    return 'Abstract visualization of underwater sound waves, sonar rings emanating through deep ocean water, bioluminescent particles, ultra high detail, scientific illustration, 8K';
  }

  // Australia / travel
  if (/austral|japan|travel|trip|maui|hawaii|ocean/.test(fn)) {
    return 'Dramatic landscape photograph of a remote ocean coastline, wild dramatic sky, crystal clear water, photorealistic nature photography, 8K';
  }

  // Memorial / tribute
  if (/memorial|tribute|rememb|ashes|sunset/.test(fn)) {
    return 'Serene ocean sunset with soft golden light reflecting off calm water, a single dolphin silhouetted against the horizon, photorealistic, cinematic';
  }

  // Art / painting / fractal
  if (/art|paint|fractal|spiral|glyph|trispiral/.test(fn)) {
    return 'Abstract generative art inspired by ocean patterns and dolphin intelligence, sacred geometry, deep blues and teals, luminous, high resolution digital artwork';
  }

  // People / colleagues
  if (/peter|toni|barbara|lou|wood|takako|hofman|esalen|sissie|david|george|colleague/.test(fn)) {
    return 'Two people sharing a meaningful moment in a 1960s research environment, warm documentary photography style, natural light, photorealistic';
  }

  // Books
  if (/book/.test(fn)) {
    return 'A stack of scientific books and research papers in a study, warm lamp light, deep focus, photorealistic still life photography';
  }

  // Default — ocean / research
  return 'Dramatic underwater ocean photograph, deep blue water, rays of light filtering through surface, marine research aesthetic, photorealistic, 8K, award-winning photography';
}

// ── Cloudinary upload ─────────────────────────────────────────────────────

async function uploadToCloudinary(imageUrl, publicId) {
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', imageUrl);
  form.append('upload_preset', 'unsigned_preset'); // may need to create this
  form.append('public_id', publicId);
  form.append('folder', 'jcl-archive/ai');

  // Use signed upload
  const timestamp = Math.floor(Date.now() / 1000);
  const crypto = await import('crypto');
  const sigStr = `folder=jcl-archive/ai&public_id=${publicId}&timestamp=${timestamp}${cloudinaryCreds.api_secret}`;
  const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

  form.append('timestamp', timestamp.toString());
  form.append('api_key', cloudinaryCreds.api_key);
  form.append('signature', signature);

  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${cloudinaryCreds.cloud_name}/image/upload`,
      headers: form.getHeaders(),
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Cloudinary response parse error: ' + data.slice(0,200))); }
      });
    });
    req.on('error', reject);
    form.pipe(req);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────

// Collect all unique meaningful images from pages
const { load } = await import('cheerio');
const allImages = new Map(); // filename → { src, pages }

for (const f of fs.readdirSync(B).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(B, f), 'utf8');
  const $ = load(html, { decodeEntities: false });
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!src.startsWith('http') && !src.startsWith('/')) return;
    const fn = path.basename(src).toLowerCase();
    if (!fn.match(/\.(jpg|jpeg|gif|png)$/)) return;
    if (!allImages.has(fn)) allImages.set(fn, { src, pages: new Set() });
    allImages.get(fn).pages.add(f);
  });
}

// Filter to content-only images and add prompts
const targets = [];
for (const [fn, data] of allImages) {
  const prompt = buildPrompt(fn, data.src);
  if (!prompt) { log(`  skip (nav): ${fn}`); continue; }
  targets.push({ fn, src: data.src, prompt, pages: [...data.pages] });
}

log(`Total candidate images: ${allImages.size}`);
log(`After filtering nav/UI: ${targets.length}`);
log(`Mode: ${testMode ? 'TEST (no generation)' : 'PRODUCTION'}`);
log(`Limit: ${limitArg}`);

if (testMode) {
  log('\n── TEST MODE — Sample prompts (no generation) ──');
  targets.slice(0, 5).forEach((t,i) => {
    log(`\n[${i+1}] ${t.fn}`);
    log(`  Prompt: ${t.prompt}`);
    log(`  Used on: ${t.pages.slice(0,3).join(', ')}...`);
  });
  log('\nTotal cost estimate:');
  log(`  Standard quality (1024x1024): ${targets.length} × $0.04 = $${(targets.length * 0.04).toFixed(2)}`);
  log(`  HD quality (1792x1024):       ${targets.length} × $0.08 = $${(targets.length * 0.08).toFixed(2)}`);
  process.exit(0);
}

// Load state & map
const state = loadState();
const aiMap = loadAiMap();
let processed = 0;

for (const target of targets) {
  if (processed >= limitArg) break;
  if (state.done[target.fn]) {
    log(`  skip (done): ${target.fn}`);
    continue;
  }

  try {
    log(`[${processed + 1}/${Math.min(targets.length, limitArg)}] Generating: ${target.fn}`);
    log(`  Prompt: ${target.prompt.slice(0, 80)}...`);

    // DALL-E generation via OpenAI
    const openaiKey = (function(){ const d=JSON.parse(fs.readFileSync(path.join(B,'../../secrets/openai.json'),'utf8')); return d.api_key||d.key||d.OPENAI_API_KEY; })()
                   || process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error('No OpenAI API key found');

    const dalleResponse = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'dall-e-3',
        prompt: target.prompt,
        n: 1,
        size: '1792x1024',
        quality: 'hd',
      });
      const req = https.request({
        method: 'POST',
        hostname: 'api.openai.com',
        path: '/v1/images/generations',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Length': Buffer.byteLength(body),
        }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('OpenAI parse error: ' + data.slice(0,200))); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    if (!dalleResponse.data?.[0]?.url) {
      throw new Error('No image URL in response: ' + JSON.stringify(dalleResponse).slice(0,200));
    }
    const aiUrl = dalleResponse.data[0].url;
    log(`  ✓ Generated: ${aiUrl.slice(0,60)}...`);

    // Upload to Cloudinary
    const publicId = 'ai-' + target.fn.replace(/\.(jpg|jpeg|gif|png)$/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
    const uploadResult = await uploadToCloudinary(aiUrl, publicId);
    if (!uploadResult.secure_url) throw new Error('Upload failed: ' + JSON.stringify(uploadResult).slice(0,200));

    const cloudinaryUrl = uploadResult.secure_url;
    log(`  ✓ Uploaded: ${cloudinaryUrl}`);

    // Save to map and state
    aiMap[target.fn] = {
      original_src: target.src,
      ai_url: cloudinaryUrl,
      prompt: target.prompt,
      pages: target.pages.slice(0, 10),
      generated_at: new Date().toISOString(),
    };
    state.done[target.fn] = cloudinaryUrl;
    saveAiMap(aiMap);
    saveState(state);
    processed++;

    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 1200));

  } catch (err) {
    log(`  ✗ ${target.fn}: ${err.message}`);
    state.failed.push({ fn: target.fn, error: err.message, at: new Date().toISOString() });
    saveState(state);
  }
}

log(`\nDone: ${processed} images generated and uploaded.`);
log(`AI map: ${Object.keys(aiMap).length} entries in ai-image-map.json`);
