#!/usr/bin/env node
/**
 * apply-design.mjs
 * 1. Replaces CSS references on all pages to style-jcl.css
 * 2. Injects ocean backdrop SVG after <body>
 * 3. Injects View Original button before </body>
 * 4. Rebuilds site header to Sierra style on all pages
 */
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = __dirname;
const log = m => console.log(`[design] ${m}`);

const OCEAN_SVG = `<div class="ocean-bg" aria-hidden="true">
<svg viewBox="0 0 1400 900" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <!-- Sonar rings emanating from centre -->
  <circle cx="700" cy="450" r="80"  fill="none" stroke="#0A4D8C" stroke-width="1.2"/>
  <circle cx="700" cy="450" r="160" fill="none" stroke="#0A4D8C" stroke-width="1"/>
  <circle cx="700" cy="450" r="260" fill="none" stroke="#0A4D8C" stroke-width="0.9"/>
  <circle cx="700" cy="450" r="380" fill="none" stroke="#0A4D8C" stroke-width="0.8"/>
  <circle cx="700" cy="450" r="520" fill="none" stroke="#0A9AA4" stroke-width="0.7"/>
  <circle cx="700" cy="450" r="680" fill="none" stroke="#0A9AA4" stroke-width="0.6"/>
  <!-- Ocean wave lines -->
  <path d="M0,200 Q175,160 350,200 Q525,240 700,200 Q875,160 1050,200 Q1225,240 1400,200" fill="none" stroke="#0A9AA4" stroke-width="1"/>
  <path d="M0,320 Q200,280 400,320 Q600,360 800,320 Q1000,280 1200,320 Q1350,350 1400,330" fill="none" stroke="#0A4D8C" stroke-width="0.8"/>
  <path d="M0,700 Q200,660 400,700 Q600,740 800,700 Q1000,660 1200,700 Q1300,720 1400,700" fill="none" stroke="#0A9AA4" stroke-width="0.9"/>
  <!-- Dolphin outline (simple, stylised) -->
  <path d="M600,430 Q620,410 650,415 Q680,418 700,430 Q720,442 740,438 Q760,434 770,422 Q780,410 775,425 Q768,445 750,452 Q730,458 710,450 Q690,442 670,448 Q650,454 635,445 Q618,436 600,430Z" fill="none" stroke="#0A4D8C" stroke-width="1.2"/>
  <!-- Tail fin -->
  <path d="M770,422 Q790,408 800,415 Q808,422 800,432 Q792,440 780,435 Q775,428 770,422Z" fill="none" stroke="#0A4D8C" stroke-width="1"/>
  <!-- Cross-hatch depth lines -->
  <line x1="0" y1="550" x2="1400" y2="550" stroke="#0A4D8C" stroke-width="0.5" stroke-dasharray="3,12"/>
  <line x1="0" y1="620" x2="1400" y2="620" stroke="#0A4D8C" stroke-width="0.4" stroke-dasharray="3,16"/>
  <!-- Frequency signal lines from sonar -->
  <line x1="700" y1="370" x2="700" y2="100" stroke="#0A9AA4" stroke-width="0.6" stroke-dasharray="4,8"/>
  <line x1="700" y1="530" x2="700" y2="800" stroke="#0A9AA4" stroke-width="0.6" stroke-dasharray="4,8"/>
  <line x1="620" y1="450" x2="100" y2="450" stroke="#0A9AA4" stroke-width="0.5" stroke-dasharray="4,10"/>
  <line x1="780" y1="450" x2="1300" y2="450" stroke="#0A9AA4" stroke-width="0.5" stroke-dasharray="4,10"/>
</svg>
</div>`;

const NAV_HTML = `<header class="site-header">
<div class="container">
  <a href="index.html" class="logo-zone">
    <span class="logo-icon">🐬</span>
    <span class="logo-text">John C. Lilly Archive</span>
  </a>
  <nav class="site-nav">
    <a href="thestory.html">The Story</a>
    <a href="cetacean.html">Cetacean Nation</a>
    <a href="interspecies.html">Interspecies</a>
    <a href="mind.html">Brain &amp; Mind</a>
    <a href="isolation.html">Isolation Tanks</a>
    <a href="ecco.html">E.C.C.O.</a>
    <a href="bio.html">Biography</a>
    <a href="writings.html">Writings</a>
    <a href="memorial.html">1915–2001</a>
  </nav>
  <button class="hamburger" id="hamburger" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
</div>
</header>
<div class="nav-overlay" id="navOverlay"></div>
<nav class="nav-drawer" id="navDrawer">
  <button class="drawer-close" id="drawerClose">✕</button>
  <a href="index.html">🐬 Home</a>
  <a href="thestory.html">The Story</a>
  <a href="cetacean.html">Cetacean Nation</a>
  <a href="interspecies.html">Interspecies</a>
  <a href="mind.html">Brain &amp; Mind</a>
  <a href="isolation.html">Isolation Tanks</a>
  <a href="ecco.html">E.C.C.O.</a>
  <a href="bio.html">Biography</a>
  <a href="writings.html">Writings</a>
  <a href="memorial.html">1915–2001</a>
  <a href="gallery.html">Gallery</a>
  <a href="photos.html">Photos</a>
</nav>`;

const FOOTER_HTML = `<footer class="site-footer">
<div class="container">
  <div class="footer-grid">
    <div>
      <div class="footer-brand">🐬 John C. Lilly Archive</div>
      <p>A permanent archive of Dr. John C. Lilly's life and research — dolphin communication, isolation tanks, consciousness, and E.C.C.O. Preserved for research and education.</p>
    </div>
    <div>
      <h4>Research</h4>
      <a href="cetacean.html">Cetacean Nation</a>
      <a href="interspecies.html">Interspecies Comm.</a>
      <a href="isolation.html">Isolation Tanks</a>
      <a href="mind.html">Brain &amp; Mind</a>
    </div>
    <div>
      <h4>Archive</h4>
      <a href="bio.html">Biography</a>
      <a href="writings.html">Writings</a>
      <a href="photos.html">Photos</a>
      <a href="gallery.html">Gallery</a>
    </div>
    <div>
      <h4>Site</h4>
      <a href="index.html">Home</a>
      <a href="memorial.html">1915–2001</a>
      <a href="ecco.html">E.C.C.O.</a>
      <a href="sitemap.xml">Sitemap</a>
    </div>
  </div>
  <div class="footer-bottom">
    <span>John C. Lilly · 1915–2001 · Preserved for research and education</span>
    <span>Original: <a href="http://www.johnclilly.com" target="_blank" rel="noopener">johnclilly.com</a></span>
  </div>
</div>
</footer>
<script>
(function(){
  var h=document.getElementById('hamburger'),d=document.getElementById('navDrawer'),o=document.getElementById('navOverlay'),c=document.getElementById('drawerClose');
  function open(){d.classList.add('open');o.classList.add('active');h&&h.classList.add('open');}
  function close(){d.classList.remove('open');o.classList.remove('active');h&&h.classList.remove('open');}
  if(h)h.addEventListener('click',open);
  if(c)c.addEventListener('click',close);
  if(o)o.addEventListener('click',close);
})();
</script>`;

const htmlFiles = fs.readdirSync(B).filter(f => f.endsWith('.html'));
let updated = 0;

for (const file of htmlFiles) {
  const fp = path.join(B, file);
  let html = fs.readFileSync(fp, 'utf8');
  const $ = load(html, { decodeEntities: false });

  // 1. Replace CSS
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.match(/style.*\.css/) || href === 'components.css' || href === 'tokens.css') {
      $(el).attr('href', 'style-jcl.css');
    }
  });
  // Remove duplicate stylesheet links
  let foundStyle = false;
  $('link[href="style-jcl.css"]').each((_, el) => {
    if (foundStyle) $(el).remove();
    else foundStyle = true;
  });

  // 2. Replace nav
  $('nav.topnav, .topnav, header.site-header').remove();
  $('.nav-overlay, .nav-drawer').remove();
  // Also remove old inline scripts for nav
  $('script').each((_, el) => {
    const t = $(el).html() || '';
    if (t.includes('hamburger') || t.includes('navDrawer')) $(el).remove();
  });
  $('body').prepend(OCEAN_SVG + '\n' + NAV_HTML);

  // 3. Get original URL for View Original button
  let originalUrl = null;
  // Try data-original-href first
  $('[data-original-href]').each((_, el) => {
    if (!originalUrl) {
      const h = $(el).attr('data-original-href') || '';
      if (h.includes('johnclilly.com')) originalUrl = h;
    }
  });
  // Fall back to archive-notice
  if (!originalUrl) {
    $('.archive-notice a[href*="johnclilly.com"]').each((_,el) => {
      const h = $(el).attr('href');
      if (h && h.includes('johnclilly.com') && h !== 'http://www.johnclilly.com') originalUrl = h;
    });
  }
  // Fall back to filename
  if (!originalUrl) {
    originalUrl = `http://www.johnclilly.com/${file}`;
  }

  // 4. Remove old footer + scripts, replace
  $('footer').remove();
  $('script:not([src])').each((_,el) => {
    const t = $(el).html() || '';
    if (!t.includes('hamburger')) $(el).remove();
  });

  // 5. Add View Original button
  const vobHtml = `\n<a class="view-original-btn" href="${originalUrl}" target="_blank" rel="noopener" title="View original page on johnclilly.com">
  <span class="vob-icon">🔗</span>
  <span class="vob-label">View Original</span>
</a>`;

  // 6. Replace old wrapper body with section class
  const bodyContent = $('body').html() || '';
  // Update body: ensure page wrapper has correct class
  if (!$('.page, .page-prose, .section, .container').length) {
    // No wrapper — wrap content
    const contentOnly = $('body').children().not('.ocean-bg, header, .nav-overlay, .nav-drawer, script').toArray();
    if (contentOnly.length) {
      const wrappedContent = `<div class="container section"><div class="prose">${contentOnly.map(el => $.html(el)).join('')}</div></div>`;
      $(contentOnly).remove();
      $('body').append(wrappedContent);
    }
  }
  $('body').append(FOOTER_HTML + vobHtml);

  // 7. Add Inter font if missing
  if (!$('link[href*="fonts.googleapis"]').length) {
    $('head').append('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap" rel="stylesheet">');
  }

  // 8. Upgrade body padding
  $('body').attr('style', '');

  fs.writeFileSync(fp, $.html());
  updated++;
  if (updated % 50 === 0) log(`  ${updated} pages updated...`);
}

log(`✅ Done: ${updated} pages updated with Sierra/Pottigalli design + View Original button.`);
