#!/usr/bin/env node
/**
 * Rebuild the 19 core section pages with clean structure.
 * Pulls rich content from Apify records where available.
 * Uses style-jcl.css design system throughout.
 */
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = __dirname;
const log = m => console.log(`[sections] ${m}`);

const CMAP = JSON.parse(fs.readFileSync(path.join(B,'cloudinary-map.json'),'utf8'));
const APIFY = JSON.parse(fs.readFileSync(path.join(B,'apify-full.json'),'utf8'));
const apifyMap = new Map(APIFY.map(r=>[path.basename(r.url).replace(/\.htm$/,'.html'), r]));

function resolveImg(src) {
  if (!src || src.startsWith('https://res.cloudinary.com')) return src;
  for (const [orig, d] of Object.entries(CMAP)) {
    if (orig===src || path.basename(orig)===path.basename(src)) return d.secureUrl||d;
  }
  return src;
}

const NAV = `<header class="site-header">
<div class="container">
  <a href="index.html" class="logo-zone"><span class="logo-icon">🐬</span><span class="logo-text">John C. Lilly Archive</span></a>
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
  <button class="hamburger" id="hamburger" aria-label="Menu"><span></span><span></span><span></span></button>
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

const FOOTER = `<footer class="site-footer">
<div class="container">
  <div class="footer-grid">
    <div><div class="footer-brand">🐬 John C. Lilly Archive</div><p>A permanent archive of Dr. John C. Lilly's life and research. Preserved for research and education.</p></div>
    <div><h4>Research</h4><a href="cetacean.html">Cetacean Nation</a><a href="interspecies.html">Interspecies Comm.</a><a href="isolation.html">Isolation Tanks</a><a href="mind.html">Brain &amp; Mind</a></div>
    <div><h4>Archive</h4><a href="bio.html">Biography</a><a href="writings.html">Writings</a><a href="photos.html">Photos</a><a href="gallery.html">Gallery</a></div>
    <div><h4>Site</h4><a href="index.html">Home</a><a href="memorial.html">1915–2001</a><a href="ecco.html">E.C.C.O.</a><a href="sitemap.xml">Sitemap</a></div>
  </div>
  <div class="footer-bottom">
    <span>John C. Lilly · 1915–2001 · Preserved for research and education</span>
    <span>Original: <a href="http://www.johnclilly.com" target="_blank" rel="noopener">johnclilly.com</a></span>
  </div>
</div>
</footer>`;

const SCRIPT = `<script>
(function(){
  var h=document.getElementById('hamburger'),d=document.getElementById('navDrawer'),o=document.getElementById('navOverlay'),c=document.getElementById('drawerClose');
  function open(){d.classList.add('open');o.classList.add('active');h&&h.classList.add('open');}
  function close(){d.classList.remove('open');o.classList.remove('active');h&&h.classList.remove('open');}
  if(h)h.addEventListener('click',open);
  if(c)c.addEventListener('click',close);
  if(o)o.addEventListener('click',close);
})();
</script>`;

const OCEAN = `<div class="ocean-bg" aria-hidden="true"><svg viewBox="0 0 1400 900" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><circle cx="700" cy="450" r="80" fill="none" stroke="#0A4D8C" stroke-width="1.2"/><circle cx="700" cy="450" r="260" fill="none" stroke="#0A4D8C" stroke-width="0.9"/><circle cx="700" cy="450" r="520" fill="none" stroke="#0A9AA4" stroke-width="0.7"/><path d="M0,200 Q175,160 350,200 Q525,240 700,200 Q875,160 1050,200 Q1225,240 1400,200" fill="none" stroke="#0A9AA4" stroke-width="1"/><path d="M0,700 Q200,660 400,700 Q600,740 800,700 Q1000,660 1200,700 Q1300,720 1400,700" fill="none" stroke="#0A9AA4" stroke-width="0.9"/></svg></div>`;

function head(title, desc, origUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — John C. Lilly Archive</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${title} — John C. Lilly Archive">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="article">
  <link rel="stylesheet" href="style-jcl.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap" rel="stylesheet">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐬</text></svg>">
</head>
<body>`;
}

function vob(origUrl) {
  return `<a class="view-original-btn" href="${origUrl}" target="_blank" rel="noopener" title="View original">
  <span class="vob-icon">🔗</span><span class="vob-label">View Original</span></a>`;
}

function heroSection(title, subtitle, eyebrow) {
  return `<section style="background:var(--bg-soft);border-bottom:1px solid var(--border);padding:72px 28px 52px;text-align:center;position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;background:var(--grad);opacity:0.04;pointer-events:none;"></div>
  <div class="container" style="position:relative;z-index:1;">
    <span class="hero-eyebrow">${eyebrow}</span>
    <h1 style="font-family:var(--font-serif);font-size:clamp(2rem,5vw,3.4rem);font-weight:600;line-height:1.1;margin-bottom:14px;">${title}</h1>
    <p style="font-size:clamp(0.95rem,2vw,1.1rem);color:var(--text-soft);max-width:580px;margin:0 auto;line-height:1.7;">${subtitle}</p>
  </div>
</section>`;
}

function linkGrid(links) {
  return `<div class="link-grid">${links.map(([href,label])=>`<a href="${href}" class="link-item">${label}</a>`).join('\n')}</div>`;
}

function pullQuote(text, cite) {
  return `<div class="pull-quote"><p>${text}</p>${cite?`<cite>— ${cite}</cite>`:''}</div>`;
}

function sectionH2(text) { return `<h2 style="font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--border);padding-bottom:10px;margin:36px 0 16px;color:var(--text);">${text}</h2>`; }

// ─── PAGE DEFINITIONS ────────────────────────────────────────────────────────

const pages = {

'cetacean.html': () => {
const rec = apifyMap.get('cetacean.html');
const intro = rec?.text?.slice(0,600) || 'Over 70% of the Earth\'s surface is covered by ocean. In this ocean lives an intelligence that, by many scientific measures, rivals or exceeds that of humans — the cetaceans. Lilly devoted decades to understanding their minds.';
return head('Cetacean Nation','John C. Lilly\'s dolphin and whale research — the other intelligences of Earth.','http://www.johnclilly.com/cetacean.html') +
OCEAN + NAV +
heroSection('Cetacean <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Nation</em>',
  'The study of dolphins, porpoises, and whales — intelligences that have called Earth home for 50 million years longer than we have.',
  'CETACEAN RESEARCH · 1955–2001') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/cetacean.html" target="_blank" rel="noopener">johnclilly.com/cetacean.html</a></div>
${pullQuote('"The cetaceans are not alien visitors — they are our oldest intelligent neighbors, and we have barely begun to listen."','John C. Lilly')}
${sectionH2('About Cetacean Research')}
<p style="color:var(--text-soft);line-height:1.8;margin-bottom:24px;">${intro.slice(0,400)}</p>
${sectionH2('Dolphin Science')}
${linkGrid([['dolphin01.html','Dolphins Overview'],['dolbrains.html','Dolphin Brains'],['dolcomm.html','Dolphin Communication'],['dollife.html','Dolphin Life'],['dolsex.html','Dolphin Sexual Behavior'],['spermwhale.html','Sperm Whale — World\'s Largest Brain'],['discoveries.html','Chronological Discoveries'],['dolphingifs.html','Dolphin Animations'],['dolphinglyph.html','Dolphin Glyph']])}
${sectionH2('Dolphin Experiments')}
${linkGrid([['doljump01x.html','Dolphin Jump #1'],['doljump02x.html','Dolphin Jump #2'],['doltankCG01x.html','Dolphin Tank CG #1'],['doltankCG02x.html','Dolphin Tank CG #2'],['dolsmilex.html','Dolphin Smile'],['mandolph01.html','Man and Dolphin'],['oahudolx.html','Oahu Dolphin'],['dolphinjump.html','Dolphin Jump']])}
${sectionH2('Cetacean Nation')}
${linkGrid([['cetacean01.html','Cetacean Intelligence'],['cetacean05.html','Cetacean Nation Vol. 5'],['cetacean06.html','Cetacean Nation Vol. 6'],['cetacean07.html','Cetacean Nation Vol. 7'],['cetacean03.html','Cetacean Science Vol. 3'],['cetacean04.html','Cetacean Science Vol. 4'],['cetbibliox.html','Cetacean Bibliography']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/cetacean.html') + '</body></html>';
},

'interspecies.html': () => {
const rec = apifyMap.get('interspeciesx.html');
const intro = rec?.text?.slice(0,500) || 'The Communications Research Institute, established in 1959 on St. Thomas in the Virgin Islands, became the world\'s first laboratory dedicated to interspecies communication. Lilly\'s work here would capture the imagination of the world.';
return head('Interspecies Communication','The Margaret Howe experiment, JANUS project, and four decades of attempts to build a shared language with dolphins.','http://www.johnclilly.com/interspecies.html') +
OCEAN + NAV +
heroSection('Interspecies <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Communication</em>',
  'Building a shared language between two species. The most ambitious scientific experiment of the 20th century.',
  'COMMUNICATION RESEARCH · 1959–1975') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/interspecies.html" target="_blank" rel="noopener">johnclilly.com/interspecies.html</a></div>
${pullQuote('"Eventually it may be possible for humans to speak with another species. I have come to this conclusion after careful consideration of evidence gained through my research experiments with dolphins."','John C. Lilly')}
<p style="color:var(--text-soft);line-height:1.8;margin-bottom:8px;">${intro.slice(0,400)}</p>
${sectionH2('Man and Dolphin')}
${linkGrid([['interspeciesx.html','The Opening of Our Minds'],['lab00x.html','Communications Research Lab'],['laboratoryx.html','Photo Sequence of the Lab'],['laboratory04x.html','Conditions for Co-existence'],['encountersx.html','Dolphin and Human Interaction'],['paddlex.html','Dogpaddle'],['davidsissy01x.html','David and Sissy #1'],['davidsissy02x.html','David and Sissy #2'],['johnsissy01x.html','John and Sissy'],['drowningx.html','Sissy Saves Drowning Human']])}
${sectionH2('Woman and Dolphin — The Margaret Howe Experiment')}
<p style="color:var(--text-soft);line-height:1.8;margin-bottom:16px;">In 1965, Margaret Howe moved into a flooded house with a young dolphin named Peter. For ten weeks she kept a daily diary of what happened. This is that diary.</p>
${linkGrid([['womandolph01x.html','Introduction'],['womandolph03x.html','Preliminary Observations'],['womandolph04x.html','Daily Schedule'],['womandolph05x.html','Vocabulary'],['womandolph06x.html','Week One'],['womandolph07x.html','Week Two'],['womandolph08x.html','Week Three'],['womandolph09x.html','Week Four'],['womandolph10x.html','Week Five'],['womandolph11x.html','Weeks Six and Seven'],['womandolph12x.html','Weeks Eight through Ten']])}
${sectionH2('JANUS Project — Computer-Assisted Communication')}
${linkGrid([['janus02x.html','JANUS Background'],['janus03x.html','JANUS Design'],['janus04x.html','JANUS Implementation'],['janus05x.html','JANUS Results'],['janus06x.html','JANUS Conclusions'],['janus00x.html','JANUS Overview']])}
${sectionH2('Videophone & Touchscreen Research')}
${linkGrid([['videophone01x.html','Videophone Study #1'],['videophone02x.html','Videophone Study #2'],['videophone03x.html','Videophone Study #3'],['touchscreen00.html','Touchscreen Overview'],['touchscreen01.html','Touchscreen #1'],['touchscreen03.html','Touchscreen #3'],['teachersx.html','Dolphin Teachers']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/interspecies.html') + '</body></html>';
},

'isolation.html': () => {
const rec = apifyMap.get('isolationx.html');
const intro = rec?.text?.slice(0,400) || 'In 1954, Lilly designed and built the first sensory deprivation flotation tank at the National Institute of Mental Health in Bethesda, Maryland. What began as a neuroscience experiment to study consciousness in the absence of external stimuli became one of the most influential inventions in modern wellness culture.';
return head('Isolation Tanks','John C. Lilly invented the sensory deprivation flotation tank in 1954. Five decades of inner exploration followed.','http://www.johnclilly.com/isolation.html') +
OCEAN + NAV +
heroSection('Isolation <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Tanks</em>',
  'Lilly invented sensory deprivation flotation in 1954. He called it the samadhi tank — and spent the rest of his life inside it.',
  'FLOTATION RESEARCH · 1954–2001') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/isolation.html" target="_blank" rel="noopener">johnclilly.com/isolation.html</a></div>
${pullQuote('"In the province of the mind, what one believes to be true either is true or becomes true."','John C. Lilly — discovered in the isolation tank')}
<p style="color:var(--text-soft);line-height:1.8;margin-bottom:8px;">${intro.slice(0,350)}</p>
${sectionH2('The History of the Tank')}
${linkGrid([['tanks01.html','Tank History'],['tanks00.html','Early Tanks'],['tankx.html','The Tank'],['moderntankx.html','Modern Tank'],['tanksketch01.html','Tank Sketch #1'],['tanksketch02.html','Tank Sketch #2'],['tanksketch03.html','Tank Sketch #3'],['tankopen.html','Tank Open'],['tankclose.html','Tank Close']])}
${sectionH2('Inner Explorations')}
${linkGrid([['isolationx.html','Isolation Overview'],['lsdtankx.html','LSD in the Tank'],['stagesx.html','Stages of Consciousness'],['meltingx.html','The Melting'],['deepself01.html','The Deep Self'],['observerx.html','The Observer'],['isotank02x.html','Isolation Tank #2'],['isotank03x.html','Isolation Tank #3'],['isotank03.html','Isolation Tank #3 (alt)']])}
${sectionH2('Tank Logs & Records')}
${linkGrid([['tanklogsx.html','Tank Logs'],['johntankx.html','John in the Tank'],['poolCGx.html','Pool CG'],['poolCG.html','Pool CG (alt)'],['drowningx.html','Drowning'],['lsdtankx.html','LSD Tank'],['conferencex.html','Conference']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/isolation.html') + '</body></html>';
},

'mind.html': () => {
const rec = apifyMap.get('mindx.html');
const intro = rec?.text?.slice(0,400) || 'Lilly proposed that the human brain operates as a programmable biological computer — and that human consciousness is software running on it. His metaprogramming theory, developed through isolation tank experiments and psychedelic research, anticipated decades of cognitive science.';
return head('Brain & Mind','John C. Lilly\'s neuroscience — the biocomputer theory, metaprogramming, and the architecture of consciousness.','http://www.johnclilly.com/mind.html') +
OCEAN + NAV +
heroSection('Brain &amp; <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Mind</em>',
  'The human brain as a biological computer. Metaprogramming. Simulations of God. The deepest architecture of consciousness.',
  'NEUROSCIENCE · CONSCIOUSNESS · 1950–2001') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/mind.html" target="_blank" rel="noopener">johnclilly.com/mind.html</a></div>
${pullQuote('"The brain is a biocomputer. You are the programmer."','John C. Lilly')}
<p style="color:var(--text-soft);line-height:1.8;margin-bottom:8px;">${intro.slice(0,350)}</p>
${sectionH2('Neuroscience & Brain Research')}
${linkGrid([['brainx.html','Brain Research'],['brain.html','The Brain'],['brain02.html','Brain #2'],['brainsize.html','Brain Size'],['melonbrains.html','Melon Brains'],['nmrscanx.html','NMR Brain Scans'],['cognitivex.html','Cognitive Research']])}
${sectionH2('Metaprogramming & the Biocomputer')}
${linkGrid([['metaprogx.html','Metaprogramming'],['metaprog.html','Metaprogramming (full)'],['metaprog00.html','Metaprog Ch.0'],['metaprog01.html','Metaprog Ch.1'],['metaprog02.html','Metaprog Ch.2'],['metaprog03.html','Metaprog Ch.3'],['programming01.html','Programming the Brain'],['programming00.html','Programming Overview']])}
${sectionH2('Simulations of God')}
${linkGrid([['simulations01.html','Simulations of God'],['simulations00.html','Simulations Overview'],['simulationsIntro.html','Simulations Intro'],['simulationsPreface.html','Simulations Preface'],['simulationsPrologue.html','Simulations Prologue'],['simulationsChap01.html','Simulations Ch.1'],['simulationsNotes.html','Simulations Notes']])}
${sectionH2('Mind & Consciousness')}
${linkGrid([['mindx.html','The Mind'],['mind01.html','Mind #1'],['mind00.html','Mind Overview'],['mindCh0701.html','Mind Ch.7-1'],['mindCh0702.html','Mind Ch.7-2'],['mindCh0703.html','Mind Ch.7-3'],['experiment02x.html','Experiment #2'],['experimentx.html','Experiments']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/mind.html') + '</body></html>';
},

'ecco.html': () => {
const rec = apifyMap.get('eccox.html');
const intro = rec?.text?.slice(0,400) || 'E.C.C.O. — Earth Coincidence Control Office. A cosmological framework Lilly developed from his deepest isolation tank and psychedelic experiences. The theory that meaningful coincidences are organized by an intelligence operating at the level of the entire planet.';
return head('E.C.C.O.','Earth Coincidence Control Office — John C. Lilly\'s cosmological framework for understanding organized coincidence.','http://www.johnclilly.com/ecco.html') +
OCEAN + NAV +
heroSection('<em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">E.C.C.O.</em>',
  'Earth Coincidence Control Office — the organizing intelligence behind meaningful coincidences.',
  'COSMOLOGY · E.C.C.O. · VORTEX') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/ecco.html" target="_blank" rel="noopener">johnclilly.com/ecco.html</a></div>
${pullQuote('"I am not alone in the universe. E.C.C.O. is managing the earth\'s project."','John C. Lilly')}
<p style="color:var(--text-soft);line-height:1.8;margin-bottom:8px;">${intro.slice(0,350)}</p>
${sectionH2('E.C.C.O.')}
${linkGrid([['eccox.html','E.C.C.O. Overview'],['eccoCD.html','E.C.C.O. CD'],['eccoCDx.html','E.C.C.O. CD (x)']])}
${sectionH2('Vortex')}
${linkGrid([['vortex.html','Vortex Overview'],['mapping.html','Mapping'],['mappingx.html','Mapping (x)'],['sofar01.html','SOFAR Channel'],['sofar00.html','SOFAR Overview'],['neptune01x.html','Neptune'],['cyclone01.html','Cyclone'],['cyclone00.html','Cyclone Overview']])}
${sectionH2('Deep Space & Cosmos')}
${linkGrid([['deepself01.html','The Deep Self'],['deepself00.html','Deep Self Overview'],['innerx.html','Inner Space'],['geosis.html','Geosis'],['geosisx.html','Geosis (x)'],['agents.html','Agents'],['matrix01.html','The Matrix']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/ecco.html') + '</body></html>';
},

'bio.html': () => {
const rec = apifyMap.get('biogx.html');
const intro = rec?.text?.slice(0,400) || 'John Cunningham Lilly was born January 6, 1915 in St. Paul, Minnesota, the son of a banker. He attended CalTech, earned his M.D. at the University of Pennsylvania, and went on to become one of the most unconventional and influential scientists of the twentieth century.';
return head('Biography','The life of John C. Lilly — from St. Paul to Caltech, NIMH, the Virgin Islands, Esalen, and beyond.','http://www.johnclilly.com/bio.html') +
OCEAN + NAV +
heroSection('A Life in <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Science</em>',
  'January 6, 1915 — September 30, 2001. The life of John C. Lilly.',
  'BIOGRAPHICAL ARCHIVE · 86 YEARS') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/bio.html" target="_blank" rel="noopener">johnclilly.com/bio.html</a></div>
<div class="steps">
  <div class="step"><div class="step-num">1</div><div><h4>Early Life & Education</h4><p style="color:var(--text-soft);font-size:14px;">St. Paul, Minnesota · CalTech (physics) · University of Pennsylvania Medical School · Dartmouth</p></div></div>
  <div class="step"><div class="step-num">2</div><div><h4>NIMH & Brain Research</h4><p style="color:var(--text-soft);font-size:14px;">National Institute of Mental Health, Bethesda · First isolation tank, 1954 · Brain electrode research · Neurophysiology</p></div></div>
  <div class="step"><div class="step-num">3</div><div><h4>The Virgin Islands</h4><p style="color:var(--text-soft);font-size:14px;">Communications Research Institute, St. Thomas · Dolphin research · Margaret Howe experiment · The flooded lab</p></div></div>
  <div class="step"><div class="step-num">4</div><div><h4>Esalen & the Human Potential Movement</h4><p style="color:var(--text-soft);font-size:14px;">Big Sur, California · Isolation tank research · LSD and ketamine sessions · Metaprogramming theory · E.C.C.O.</p></div></div>
  <div class="step"><div class="step-num">5</div><div><h4>Later Life & Legacy</h4><p style="color:var(--text-soft);font-size:14px;">Malibu, California · Human Software Inc. · Samadhi tanks worldwide · September 30, 2001</p></div></div>
</div>
${sectionH2('Photo Archive — Early Life')}
${linkGrid([['yngJL01x.html','Young John #1'],['yngJL02x.html','Young John #2'],['yngJL03x.html','Young John #3'],['babyjohnx.html','Baby John'],['johngradx.html','Graduation'],['caltechx.html','Caltech'],['penn.html','Penn']])}
${sectionH2('Photo Archive — At Work')}
${linkGrid([['laboratoryx.html','Lab Photo Sequence'],['lab00x.html','Lab Overview'],['labCGx.html','Lab CG'],['johntankx.html','John in the Tank'],['johnjanusx.html','John with JANUS'],['johnboatx.html','John on Boat']])}
${sectionH2('Photo Archive — Colleagues & Family')}
${linkGrid([['marpeterx.html','Margaret & Peter'],['marpeter02x.html','Margaret & Peter #2'],['marpeter03x.html','Margaret & Peter #3'],['hofmannx.html','Albert Hofmann'],['JLEsalenx.html','Esalen'],['JL&Barbarax.html','John & Barbara'],['JL&Loux.html','John & Lou'],['JL&Woodx.html','John & Toni Wood'],['JL&takakox.html','John & Takako']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/bio.html') + '</body></html>';
},

'writings.html': () => {
return head('Writings','Books, papers, lectures, and transcripts by John C. Lilly — five decades of research published.','http://www.johnclilly.com/writings.html') +
OCEAN + NAV +
heroSection('<em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Writings</em>',
  'Books, scientific papers, conference lectures, and transcripts spanning five decades.',
  'PUBLICATIONS · PAPERS · TRANSCRIPTS') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/writings.html" target="_blank" rel="noopener">johnclilly.com/writings.html</a></div>
${sectionH2('Books')}
${linkGrid([['books01.html','Books Overview'],['books02.html','Books #2']])}
${sectionH2('Scientific Papers')}
${linkGrid([['scientificx.html','Scientific Papers Index'],['scientist01.html','Scientist #1'],['discoveries.html','Chronological Discoveries'],['lillywave.html','The Lilly Wave'],['lillywavex.html','Lilly Wave (x)'],['dyadic01.html','Dyadic Cyclone'],['dyadic00.html','Dyadic Overview'],['dyadic15.html','The Dolphins Revisited']])}
${sectionH2('Lectures & Conferences')}
${linkGrid([['conferencex.html','Conferences'],['BT_JCL_ICERC1999.html','ICERC 1999'],['InstOfEcotConf1998.html','Inst. of Ecotourism 1998'],['JCL_AFDB_Basel.html','Basel Conference'],['JCL_JA_InstOfEcot.html','Institute of Ecology'],['icercJapan01.html','ICERC Japan #1'],['icercJapan02.html','ICERC Japan #2'],['japanTrip01.html','Japan Trip #1']])}
${sectionH2('Transcripts & Interviews')}
${linkGrid([['thestory.html','The Story'],['interspeciesx.html','The Opening of Our Minds'],['askjohn.html','Ask John'],['history01.html','History #1'],['AtoZ.html','A to Z'],['economics.html','Economics']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/writings.html') + '</body></html>';
},

'memorial.html': () => {
const rec = apifyMap.get('jcl1915-2001.html');
const intro = rec?.text?.slice(0,600) || 'John C. Lilly died on September 30, 2001 in Los Angeles, California. He was 86 years old. He left behind a body of work unlike any other in science: dolphin communication research, the isolation tank, metaprogramming theory, E.C.C.O., and a dozen books that continue to shape how we think about intelligence and consciousness.';
return head('1915–2001','In memoriam — John C. Lilly, January 6, 1915 — September 30, 2001.','http://www.johnclilly.com/memorial.html') +
OCEAN + NAV +
heroSection('John C. <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Lilly</em>',
  'January 6, 1915 — September 30, 2001',
  'IN MEMORIAM') +
`<div class="page" style="max-width:780px;">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/memorial.html" target="_blank" rel="noopener">johnclilly.com/memorial.html</a></div>
${pullQuote('"John Lilly was a true explorer of the universe — inner and outer. He never stopped pushing the boundaries of what it means to be conscious."','')}
<p style="color:var(--text-soft);line-height:1.8;font-size:1.05rem;">${intro.slice(0,500)}</p>
${sectionH2('Memorial Pages')}
${linkGrid([['jcl1915-2001.html','John C. Lilly 1915–2001'],['memorial00.html','Memorial Overview'],['memorial01.html','Memorial #1'],['memorial02.html','Memorial #2'],['memorial03.html','Memorial #3'],['memorial04.html','Memorial #4']])}
${sectionH2('Tributes & Obituaries')}
${linkGrid([['nyTimes.html','New York Times Obituary'],['washingtonPost.html','Washington Post'],['wsjletter.html','Wall Street Journal Letter'],['koontz01.html','Koontz Tribute'],['loehrx.html','Loehr Tribute'],['sayonara.html','Sayonara'],['ashes00.html','Ashes']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/memorial.html') + '</body></html>';
},

'vortex.html': () => {
return head('Vortex','Vortex, SOFAR, deep ocean mapping, and cetacean long-range communication — John C. Lilly.','http://www.johnclilly.com/vortex.html') +
OCEAN + NAV +
heroSection('<em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Vortex</em>',
  'Deep ocean mapping, SOFAR channels, cetacean long-range communication, and the cosmic perspective.',
  'VORTEX · DEEP OCEAN · COSMOS') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/vortex.html" target="_blank" rel="noopener">johnclilly.com/vortex.html</a></div>
${sectionH2('Vortex & Deep Ocean')}
${linkGrid([['vortex.html','Vortex Overview'],['sofar01.html','SOFAR Channel'],['sofar00.html','SOFAR Overview'],['lowband.html','Low Band Communication'],['sound01x.html','Sound #1'],['sound02x.html','Sound #2'],['sound03x.html','Sound #3'],['sound04x.html','Sound #4'],['sound05x.html','Sound #5']])}
${sectionH2('Mapping & Deep Structure')}
${linkGrid([['mapping.html','Mapping'],['mappingx.html','Mapping (x)'],['neptune01x.html','Neptune'],['cyclone01.html','Cyclone'],['cyclone00.html','Cyclone Overview'],['geosis.html','Geosis'],['matrix01.html','The Matrix']])}
${sectionH2('E.C.C.O. Connection')}
${linkGrid([['ecco.html','E.C.C.O.'],['deepself01.html','The Deep Self'],['innerx.html','Inner Space'],['stagesx.html','Stages']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/vortex.html') + '</body></html>';
},

'thestory.html': () => {
const rec = apifyMap.get('thestory.html') || apifyMap.get('thestory.md');
const intro = rec?.text?.slice(0,600) || 'John C. Lilly\'s story is unlike any other in the history of science. A child prodigy from Minnesota who became a neurosurgeon, then abandoned his career at the height of success to study dolphins, then invented the isolation tank, then descended into the most controversial psychedelic research in history, then emerged as one of the most original cosmological thinkers of the 20th century.';
return head('The Story','The complete narrative of John C. Lilly\'s life and extraordinary career.','http://www.johnclilly.com/thestory.html') +
OCEAN + NAV +
heroSection('The <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Story</em>',
  'How one scientist\'s curiosity launched the global dolphin consciousness movement — and changed how we understand the mind.',
  'NARRATIVE HISTORY') +
`<div class="page" style="max-width:800px;">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/thestory.html" target="_blank" rel="noopener">johnclilly.com/thestory.html</a></div>
<p style="color:var(--text-soft);line-height:1.85;font-size:1.05rem;margin-bottom:24px;">${intro.slice(0,500)}</p>
${pullQuote('"My entire life has been an experiment. I don\'t know where it\'s taking me, but I know it\'s worth following."','John C. Lilly')}
${sectionH2('Start Here')}
${linkGrid([['bio.html','Biography'],['cetacean.html','Dolphin Research'],['isolation.html','Isolation Tanks'],['mind.html','The Mind'],['ecco.html','E.C.C.O.'],['writings.html','Writings'],['memorial.html','1915–2001']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/thestory.html') + '</body></html>';
},

'photos.html': () => {
return head('Photo Archive','Historical photographs from the John C. Lilly research archive.','http://www.johnclilly.com/photos.html') +
OCEAN + NAV +
heroSection('Photo <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Archive</em>',
  'Original photographs from the Lilly research archives — lab, dolphins, colleagues, and expeditions.',
  'PHOTOGRAPHIC ARCHIVE') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/photos.html" target="_blank" rel="noopener">johnclilly.com/photos.html</a></div>
${sectionH2('1960s Lab & Research')}
${linkGrid([['laboratoryx.html','Lab Photo Sequence'],['lab00x.html','Lab Overview'],['labCGx.html','Lab CG'],['poolCGx.html','Pool CG'],['doltankCG01x.html','Dolphin Tank CG #1'],['doltankCG02x.html','Dolphin Tank CG #2']])}
${sectionH2('Dolphins')}
${linkGrid([['dolphingifs.html','Dolphin Animations'],['dolphinglyph.html','Dolphin Glyph'],['dolphinjump.html','Dolphin Jump'],['doljump01x.html','Dolphin Jump #1'],['doljump02x.html','Dolphin Jump #2'],['dolsmilex.html','Dolphin Smile'],['Qdolphins.html','Dolphins Gallery']])}
${sectionH2('People')}
${linkGrid([['marpeterx.html','Margaret & Peter'],['davidsissy01x.html','David and Sissy #1'],['johnsissy01x.html','John and Sissy'],['JL&Barbarax.html','John & Barbara'],['JL&Loux.html','John & Lou'],['yngJL01x.html','Young John #1'],['yngJL02x.html','Young John #2']])}
${sectionH2('Art & Paintings')}
${linkGrid([['dolphart01.html','Dolphin Art #1'],['dolphart02.html','Dolphin Art #2'],['dolphart03.html','Dolphin Art #3'],['dolphart04.html','Dolphin Art #4'],['dolphart05.html','Dolphin Art #5'],['painting00.html','Painting #0'],['painting01.html','Painting #1'],['johnartx.html','John\'s Art']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/photos.html') + '</body></html>';
},

'gallery.html': () => {
return head('Gallery','Visual archive — art, photography, and visual materials from the John C. Lilly collection.','http://www.johnclilly.com/gallery.html') +
OCEAN + NAV +
heroSection('<em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Gallery</em>',
  'Art, photography, and visual materials from the John C. Lilly collection.',
  'VISUAL ARCHIVE') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/gallery.html" target="_blank" rel="noopener">johnclilly.com/gallery.html</a></div>
${sectionH2('Dolphin Art')}
${linkGrid([['dolphart01.html','Dolphin Art #1'],['dolphart02.html','Dolphin Art #2'],['dolphart03.html','Dolphin Art #3'],['dolphart04.html','Dolphin Art #4'],['dolphart05.html','Dolphin Art #5'],['fractalpixx.html','Fractal Pix']])}
${sectionH2('Paintings & Visual Art')}
${linkGrid([['painting00.html','Painting Overview'],['painting01.html','Painting #1'],['painting02.html','Painting #2'],['painting03.html','Painting #3'],['painting04.html','Painting #4'],['johnartx.html','John\'s Art'],['johnwizard.html','John Wizard'],['johnspiral.html','John Spiral'],['trispiral01.html','Trispiral']])}
${sectionH2('Photography')}
${linkGrid([['dolphingifs.html','Dolphin Animations'],['Qdolphins.html','Q-Dolphins Gallery'],['01_99images.html','1990s Images'],['australia01.html','Australia #1'],['australia04.html','Australia #4']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/gallery.html') + '</body></html>';
},

'music.html': () => {
return head('Music & Video','Audio and video recordings from the John C. Lilly archive — lectures, interviews, and music.','http://www.johnclilly.com/music.html') +
OCEAN + NAV +
heroSection('Music &amp; <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Video</em>',
  'Audio and video recordings — lectures, interviews, and music from the archive.',
  'AUDIO · VIDEO · RECORDINGS') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/music.html" target="_blank" rel="noopener">johnclilly.com/music.html</a></div>
${sectionH2('Music')}
${linkGrid([['callingCD.html','Calling CD'],['callingCDx.html','Calling CD (x)'],['eccoCDx.html','E.C.C.O. CD'],['eccoCD.html','E.C.C.O. CD (full)'],['ymoCDx.html','YMO CD']])}
${sectionH2('Video')}
${linkGrid([['musicvidx.html','Music Video'],['musicvid.html','Music Video (full)'],['dolphinMind03.html','Dolphin Mind #3']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/music.html') + '</body></html>';
},

'inventions.html': () => {
return head('Inventions','John C. Lilly\'s inventions — the isolation tank, the Lilly Wave, and more.','http://www.johnclilly.com/inventions.html') +
OCEAN + NAV +
heroSection('<em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Inventions</em>',
  'The isolation tank. The Lilly Wave. JANUS. The tools of inner and outer exploration.',
  'INVENTIONS · PATENTS · DEVICES') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/inventions.html" target="_blank" rel="noopener">johnclilly.com/inventions.html</a></div>
${sectionH2('Major Inventions')}
<div class="card-grid cols-3">
  <div class="card"><div class="card-icon">🛁</div><h3>Isolation Tank</h3><p>1954 — Designed at NIMH to study consciousness without external stimuli. Later developed into commercial samadhi tanks used worldwide.</p></div>
  <div class="card"><div class="card-icon">⚡</div><h3>The Lilly Wave</h3><p>A biphasic electrical waveform for brain stimulation that minimizes tissue damage. Still used in neuroscience research today.</p></div>
  <div class="card"><div class="card-icon">🔊</div><h3>JANUS System</h3><p>Joint Analog Numerical Understanding System — a computer-assisted communication device designed for human-dolphin language exchange.</p></div>
</div>
${sectionH2('Detailed Records')}
${linkGrid([['inventionsx.html','Inventions Overview'],['lillywave.html','The Lilly Wave'],['lillywavex.html','Lilly Wave (x)'],['tanks01.html','Tank History'],['janus02x.html','JANUS Design'],['tanksketch01.html','Tank Sketches']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/inventions.html') + '</body></html>';
},

'current.html': () => {
return head('Events & Current','Current events, news, and updates related to the John C. Lilly legacy.','http://www.johnclilly.com/current.html') +
OCEAN + NAV +
heroSection('Events &amp; <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Current</em>',
  'Events, news, and current activities related to the Lilly archive and legacy.',
  'EVENTS · NEWS · ARCHIVE') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — This page reflects the state of johnclilly.com at time of archiving.</div>
${sectionH2('Current Activities')}
${linkGrid([['currentx.html','Current (x)'],['whatsnew.html','What\'s New'],['whatsnew0201.html','What\'s New 02/01'],['whatsnew0199.html','What\'s New 01/99'],['whatsnew0997.html','What\'s New 09/97'],['whatsnew0403.html','What\'s New 04/03'],['mauiNews.html','Maui News']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/current.html') + '</body></html>';
},

'links.html': () => {
return head('Links','External links and references related to John C. Lilly and cetacean research.','http://www.johnclilly.com/links.html') +
OCEAN + NAV +
heroSection('<em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Links</em>',
  'External resources, related organizations, and reference material.',
  'EXTERNAL LINKS · RESOURCES') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — External links may no longer be active. Archive maintained independently.</div>
${sectionH2('Related Archives & Organizations')}
${linkGrid([['linklibrary.html','Link Library'],['photosynthesis-profile.html','Photosynthesis.com Profile'],['outline2.html','Site Outline'],['AtoZ.html','A to Z Index']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/links.html') + '</body></html>';
},

'maui.html': () => {
return head('Maui','John C. Lilly\'s time in Maui, Hawaii — dolphin encounters and research.','http://www.johnclilly.com/maui.html') +
OCEAN + NAV +
heroSection('<em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Maui</em>',
  'Dolphin encounters and research in the waters of Hawaii.',
  'MAUI · HAWAII · FIELD RESEARCH') +
`<div class="page">
<div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/maui.html" target="_blank" rel="noopener">johnclilly.com/maui.html</a></div>
${sectionH2('Maui Research')}
${linkGrid([['maui01.html','Maui #1'],['maui02.html','Maui #2'],['mauiNews.html','Maui News'],['oahudolx.html','Oahu Dolphins'],['australia01.html','Australia Dolphins']])}
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/maui.html') + '</body></html>';
},

'hub.html': () => {
return head('Hub','John C. Lilly Archive hub — all sections.','http://www.johnclilly.com/hub.html') +
OCEAN + NAV +
heroSection('Archive <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Hub</em>',
  'All sections of the John C. Lilly archive.',
  'ARCHIVE HUB') +
`<div class="page">
<div class="hub-grid">
  <a href="cetacean.html" class="hub-card"><div class="label">Research</div><div class="title">🐬 Cetacean Nation</div><div class="desc">Dolphin & whale intelligence research</div></a>
  <a href="interspecies.html" class="hub-card"><div class="label">Research</div><div class="title">🗣️ Interspecies</div><div class="desc">Human-dolphin communication</div></a>
  <a href="isolation.html" class="hub-card"><div class="label">Research</div><div class="title">🛁 Isolation Tanks</div><div class="desc">Flotation & consciousness exploration</div></a>
  <a href="mind.html" class="hub-card"><div class="label">Research</div><div class="title">🧠 Brain & Mind</div><div class="desc">Biocomputer theory & metaprogramming</div></a>
  <a href="ecco.html" class="hub-card"><div class="label">Cosmology</div><div class="title">✦ E.C.C.O.</div><div class="desc">Earth Coincidence Control Office</div></a>
  <a href="bio.html" class="hub-card"><div class="label">Biography</div><div class="title">📷 Biography</div><div class="desc">Life, photos, colleagues</div></a>
  <a href="writings.html" class="hub-card"><div class="label">Publications</div><div class="title">📝 Writings</div><div class="desc">Books, papers, lectures</div></a>
  <a href="memorial.html" class="hub-card"><div class="label">Memorial</div><div class="title">🕊️ 1915–2001</div><div class="desc">In memoriam</div></a>
</div>
</div>` + FOOTER + SCRIPT + vob('http://www.johnclilly.com/hub.html') + '</body></html>';
},

};

// Write all pages
for (const [fn, builder] of Object.entries(pages)) {
  try {
    const html = builder();
    fs.writeFileSync(path.join(B, fn), html);
    log(`✓ ${fn}`);
  } catch(e) {
    log(`✗ ${fn}: ${e.message}`);
  }
}
log(`Done: ${Object.keys(pages).length} core section pages rebuilt.`);
