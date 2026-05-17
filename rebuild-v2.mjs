#!/usr/bin/env node
/**
 * Rebuild section pages with proper feature card grids,
 * fix deep archive pages (strip old HTML, improve layout).
 */
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = __dirname;
const log = m => console.log(`[v2] ${m}`);

const AI_MAP = JSON.parse(fs.readFileSync(path.join(B, 'ai-image-map.json'), 'utf8'));
const DEDUPED = JSON.parse(fs.readFileSync(path.join(B, 'gen-targets-deduped.json'), 'utf8'));
const groupUrl = {};
for (const d of DEDUPED) {
  const url = AI_MAP[d.filenames[0]]?.ai_url;
  if (url) groupUrl[d.id] = url;
}
const g = id => groupUrl[id];

// ── Shared partials ──────────────────────────────────────────────────────────

function head(title, desc) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — John C. Lilly Archive</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${title} — JCL Archive">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="article">
  <link rel="stylesheet" href="style-jcl.css">
  <link rel="stylesheet" href="slider.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap" rel="stylesheet">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐬</text></svg>">
</head>
<body>`;
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
    <div><div class="footer-brand">🐬 John C. Lilly Archive</div><p>Permanent archive of Dr. John C. Lilly's life and research. Preserved for research and education.</p></div>
    <div><h4>Research</h4><a href="cetacean.html">Cetacean Nation</a><a href="interspecies.html">Interspecies Comm.</a><a href="isolation.html">Isolation Tanks</a><a href="mind.html">Brain &amp; Mind</a></div>
    <div><h4>Archive</h4><a href="bio.html">Biography</a><a href="writings.html">Writings</a><a href="photos.html">Photos</a><a href="gallery.html">Gallery</a></div>
    <div><h4>Site</h4><a href="index.html">Home</a><a href="memorial.html">1915–2001</a><a href="ecco.html">E.C.C.O.</a><a href="sitemap.xml">Sitemap</a></div>
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
  if(h)h.addEventListener('click',open);if(c)c.addEventListener('click',close);if(o)o.addEventListener('click',close);
})();
</script>
<script src="slider.js"></script>`;

function vob(url) {
  return `<a class="view-original-btn" href="${url}" target="_blank" rel="noopener" title="View original">
  <span class="vob-icon">🔗</span><span class="vob-label">View Original</span></a>`;
}

function heroSlider(aiUrl, origUrl, caption) {
  const origPanel = origUrl
    ? `<div class="img-slider-original"><img src="${origUrl}" alt="Archive original" loading="eager" style="width:100%;height:100%;object-fit:cover;"></div>`
    : `<div class="img-slider-original" style="background:var(--bg-mid);display:flex;align-items:center;justify-content:center;"><img src="${aiUrl}" alt="Archive" loading="eager" style="max-width:100%;max-height:100%;object-fit:contain;"></div>`;
  return `<div class="hero-slider-wrap" style="position:relative;z-index:1;">
  <div class="img-slider" style="aspect-ratio:21/9;border-radius:0;border:none;border-bottom:1px solid var(--border);">
    ${origPanel}
    <div class="img-slider-ai"><img src="${aiUrl}" alt="AI reinterpretation" loading="eager" style="width:100%;height:100%;object-fit:cover;"><div class="slider-ai-overlay"></div></div>
    <div class="img-slider-handle" aria-hidden="true"></div>
    <span class="slider-label slider-label-ai">✦ AI</span>
    <span class="slider-label slider-label-orig">📷 Archive</span>
  </div>
  ${caption ? `<p class="slider-caption" style="padding:8px 32px;text-align:right;font-size:12px;color:var(--text-soft);background:var(--bg-soft);border-bottom:1px solid var(--border);">${caption}</p>` : ''}
</div>`;
}

function heroSection(titleHtml, subtitle, eyebrow) {
  return `<section style="background:var(--bg-soft);border-bottom:1px solid var(--border);padding:64px 32px 48px;text-align:center;position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;background:var(--grad);opacity:0.04;pointer-events:none;"></div>
  <div class="container" style="position:relative;z-index:1;max-width:800px;">
    <span class="hero-eyebrow">${eyebrow}</span>
    <h1 style="font-family:var(--font-serif);font-size:clamp(2.2rem,5vw,3.6rem);font-weight:600;line-height:1.1;margin-bottom:16px;">${titleHtml}</h1>
    <p style="font-size:clamp(1rem,2vw,1.2rem);color:var(--text-soft);line-height:1.75;max-width:640px;margin:0 auto;">${subtitle}</p>
  </div>
</section>`;
}

function sectionH2(label, title) {
  return `<div style="margin:48px 0 20px;">
  <span style="display:block;font-size:0.7rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--teal);margin-bottom:6px;">${label}</span>
  <h2 style="font-size:1.35rem;font-weight:800;color:var(--text);line-height:1.2;">${title}</h2>
  <div style="height:3px;width:48px;background:var(--grad);border-radius:2px;margin-top:10px;"></div>
</div>`;
}

function pullQuote(text, cite) {
  return `<div class="pull-quote" style="margin:36px 0;"><p>${text}</p>${cite ? `<cite>— ${cite}</cite>` : ''}</div>`;
}

function featureCard(href, icon, title, desc, cta) {
  return `<a href="${href}" class="feature-card">
  <span class="fc-icon">${icon}</span>
  <span class="fc-title">${title}</span>
  <span class="fc-desc">${desc}</span>
  <span class="fc-cta">${cta || 'Read more'}</span>
</a>`;
}

// ── SECTION PAGES ──────────────────────────────────────────────────────────

const CMAP = JSON.parse(fs.readFileSync(path.join(B, 'cloudinary-map.json'), 'utf8'));
function cOrig(fn) {
  for (const [k,v] of Object.entries(CMAP)) {
    if (k.endsWith('/'+fn) || k.endsWith('/'+fn.toLowerCase())) return v.secureUrl||v;
  }
  return null;
}

const pages = {

'cetacean.html': () => {
  const origUrl = cOrig('dolphinwindow01.jpeg') || cOrig('dolphinwindow01.jpg');
  return head('Cetacean Nation','Five decades of dolphin and whale intelligence research by John C. Lilly.') +
  `<div class="ocean-bg" aria-hidden="true"><svg viewBox="0 0 1400 900" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><circle cx="700" cy="450" r="260" fill="none" stroke="#0A4D8C" stroke-width="0.9" opacity="0.035"/><circle cx="700" cy="450" r="520" fill="none" stroke="#0A9AA4" stroke-width="0.7" opacity="0.035"/><path d="M0,200 Q175,160 350,200 Q525,240 700,200 Q875,160 1050,200 Q1225,240 1400,200" fill="none" stroke="#0A9AA4" stroke-width="1" opacity="0.035"/></svg></div>` +
  NAV +
  heroSection('Cetacean <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Nation</em>',
    'The study of dolphins, porpoises, and whales — intelligences that have called Earth home for 50 million years longer than we have.',
    'CETACEAN RESEARCH · 1955–2001') +
  heroSlider(g('group-02'), origUrl, 'Bottlenose dolphin, Communications Research Institute, St. Thomas, Virgin Islands — 1960s') +
  `<div class="page">
  <div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/cetacean.html" target="_blank" rel="noopener">johnclilly.com/cetacean.html</a></div>
  ${pullQuote('"The cetaceans are not alien visitors — they are our oldest intelligent neighbors, and we have barely begun to listen."','John C. Lilly')}
  <p class="section-intro">Over 70% of Earth\'s surface is covered by ocean. In this ocean lives an intelligence that, by many scientific criteria, rivals or exceeds that of humans. The cetaceans — dolphins, porpoises, and whales — have had brains as large or larger than humans for 50 to 100 million years longer than we have. John C. Lilly devoted half a century to understanding their minds.</p>

  ${sectionH2('DOLPHIN SCIENCE', 'Research & Discoveries')}
  <div class="feature-grid">
    ${featureCard('dolphin01.html','🐬','Dolphins Overview','The comprehensive guide to Lilly\'s dolphin research — biology, intelligence, and communication.','Explore')}
    ${featureCard('dolbrains.html','🧠','Dolphin Brains','The adult bottlenose dolphin has a brain weighing 1,700g — larger than the adult human brain at 1,450g.','Read research')}
    ${featureCard('dolcomm.html','📡','Dolphin Communication','Lilly\'s systematic study of dolphin vocalisations and attempts to decode their language.','Explore')}
    ${featureCard('dollife.html','🌊','Dolphin Life','Behavioural observations from the Virgin Islands laboratory — how dolphins live, socialise, and think.','Read more')}
    ${featureCard('dolsex.html','🔬','Sexual Behaviour','Scientific study of dolphin reproductive behaviour, social bonding, and inter-species contact.','Read research')}
    ${featureCard('spermwhale.html','🐋','Sperm Whale','The sperm whale has the largest brain on Earth — six times the size of a human brain.','Read more')}
    ${featureCard('discoveries.html','📋','Chronological Discoveries','A complete timeline of Lilly\'s cetacean discoveries from 1955 through 2001.','View timeline')}
    ${featureCard('dolphingifs.html','✨','Dolphin Animations','Original animated illustrations from the archive — dolphin movement and behaviour studies.','View gallery')}
  </div>

  ${sectionH2('FIELD RESEARCH', 'Experiments & Observations')}
  <div class="feature-grid">
    ${featureCard('doljump01x.html','🌊','Dolphin Jump Study #1','High-speed photography and analysis of dolphin leap behaviour and aerial acrobatics.','Read')}
    ${featureCard('doljump02x.html','🌊','Dolphin Jump Study #2','Continuation of the jump series — comparing individual dolphin athletic capabilities.','Read')}
    ${featureCard('doltankCG01x.html','🎞️','Tank Study CG #1','Computer-generated documentation of dolphin behaviour in the research tank environment.','View')}
    ${featureCard('doltankCG02x.html','🎞️','Tank Study CG #2','Second in the CG series — detailed movement analysis and behavioural mapping.','View')}
    ${featureCard('dolsmilex.html','😊','The Dolphin Smile','Lilly\'s analysis of the fixed "smile" on dolphin faces — anatomical fact vs anthropomorphic interpretation.','Read')}
    ${featureCard('mandolph01.html','🤝','Man and Dolphin','The foundational paper — Lilly\'s case for cetacean intelligence and the call for interspecies communication.','Read')}
  </div>

  ${sectionH2('CETACEAN NATION SERIES', 'Published Volumes')}
  <div class="feature-grid">
    ${featureCard('cetacean01.html','📖','Cetacean Intelligence Vol. 1','Opening the scientific case for recognising non-human intelligence in marine mammals.','Read')}
    ${featureCard('cetacean05.html','📖','Cetacean Nation Vol. 5','Advanced intelligence studies — language, consciousness, and long-term memory.','Read')}
    ${featureCard('cetacean06.html','📖','Cetacean Nation Vol. 6','Cross-species comparison — cetacean vs primate intelligence metrics.','Read')}
    ${featureCard('cetacean07.html','📖','Cetacean Nation Vol. 7','The political and moral case: recognising the Cetacean Nation as Earth\'s second civilization.','Read')}
    ${featureCard('cetbibliox.html','📚','Bibliography','Complete bibliography of cetacean intelligence research cited by Lilly across his career.','View')}
  </div>
</div>` + FOOTER + vob('http://www.johnclilly.com/cetacean.html') + '</body></html>';
},

'interspecies.html': () => {
  const origUrl = cOrig('margaretpeter3t.gif') || cOrig('margaretpeter3.gif');
  return head('Interspecies Communication','The Margaret Howe experiment, JANUS project, and four decades of attempts to build a shared language with dolphins.') +
  NAV +
  heroSection('Interspecies <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Communication</em>',
    'Ten weeks, one woman, one dolphin, and an attempt to build a shared language across the species barrier.',
    'COMMUNICATION RESEARCH · 1959–1975') +
  heroSlider(g('group-04'), origUrl, 'Margaret Howe and Peter the dolphin, flooded laboratory, St. Thomas, Virgin Islands — 1965') +
  `<div class="page">
  <div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/interspecies.html" target="_blank" rel="noopener">johnclilly.com/interspecies.html</a></div>
  ${pullQuote('"Eventually it may be possible for humans to speak with another species. I have come to this conclusion after careful consideration of evidence gained through my research experiments with dolphins."','John C. Lilly')}
  <p class="section-intro">In 1959, Lilly founded the Communications Research Institute on St. Thomas in the Virgin Islands — the world\'s first laboratory dedicated entirely to interspecies communication. Over the following decade, he and his colleagues would attempt the most ambitious scientific experiment of the 20th century: teaching a dolphin to speak English.</p>

  ${sectionH2('THE MAIN SERIES', 'Man and Dolphin Research')}
  <div class="feature-grid">
    ${featureCard('interspeciesx.html','🔬','The Opening of Our Minds','Lilly\'s foundational paper establishing the scientific basis for treating dolphins as communicative intelligences.','Read paper')}
    ${featureCard('lab00x.html','🏛️','Communications Research Lab','Photo documentation of the St. Thomas laboratory — the world\'s first interspecies communication facility.','View lab')}
    ${featureCard('laboratoryx.html','📷','Photo Sequence of the Lab','Complete photographic sequence of the lab environment, equipment, and dolphin habitats.','View photos')}
    ${featureCard('laboratory04x.html','🤝','Conditions for Co-existence','The environmental and ethical conditions Lilly established for productive human-dolphin co-habitation.','Read')}
    ${featureCard('encountersx.html','🐬','Dolphin and Human Interaction','Direct observation records of dolphin-initiated interactions with human researchers.','Read')}
    ${featureCard('drowningx.html','🌊','Sissy Saves a Drowning Human','The remarkable incident where a research dolphin rescued a drowning human researcher — documented in full.','Read')}
  </div>

  ${sectionH2('THE MARGARET HOWE EXPERIMENT', 'Woman and Dolphin — 1965')}
  <p class="section-intro" style="margin-bottom:20px;">In 1965, researcher Margaret Howe volunteered to live in a flooded house with a young male dolphin named Peter for ten weeks. She kept a daily diary. This is it.</p>
  <div class="feature-grid">
    ${featureCard('womandolph01x.html','📖','Introduction','The experimental design and Howe\'s motivations for undertaking the unprecedented live-in study.','Read')}
    ${featureCard('womandolph03x.html','📋','Preliminary Observations','First contact records — Peter\'s initial responses, vocalisation patterns, and social overtures.','Read')}
    ${featureCard('womandolph04x.html','🗓️','Daily Schedule','The rigid daily schedule Howe established to maximise language-learning opportunities.','Read')}
    ${featureCard('womandolph05x.html','💬','Vocabulary','The proto-vocabulary that began to emerge — English words Peter appeared to reproduce.','Read')}
    ${featureCard('womandolph06x.html','1️⃣','Week One','Day-by-day account of the first week — adjustment, communication attempts, breakthroughs.','Read diary')}
    ${featureCard('womandolph07x.html','2️⃣','Week Two','Accelerating progress — Peter begins producing recognisable English phonemes.','Read diary')}
    ${featureCard('womandolph08x.html','3️⃣','Week Three','Critical developments — social bonding deepens, language attempts become more structured.','Read diary')}
    ${featureCard('womandolph09x.html','4️⃣','Week Four','Mid-point assessment — what had been achieved, what remained elusive.','Read diary')}
    ${featureCard('womandolph10x.html','5️⃣','Week Five','Plateau and breakthrough — communication patterns stabilise into something consistent.','Read diary')}
    ${featureCard('womandolph11x.html','6️⃣','Weeks Six and Seven','The final weeks of intensive communication work — remarkable progress and real frustration.','Read diary')}
    ${featureCard('womandolph12x.html','7️⃣','Weeks Eight Through Ten','The experiment concludes — what it proved, what it didn\'t, and what it suggested.','Read diary')}
  </div>

  ${sectionH2('JANUS PROJECT', 'Computer-Assisted Communication')}
  <p class="section-intro" style="margin-bottom:20px;">JANUS — Joint Analog Numerical Understanding System. A computer-mediated real-time translation device designed to bridge dolphin and human vocalisations.</p>
  <div class="feature-grid">
    ${featureCard('janus02x.html','💻','JANUS Background','The scientific and technological rationale for computer-mediated interspecies communication.','Read')}
    ${featureCard('janus03x.html','🔧','JANUS Design','Technical architecture of the JANUS system — hardware, software, and acoustic processing.','Read')}
    ${featureCard('janus04x.html','⚙️','JANUS Implementation','How JANUS was deployed in the laboratory and integrated into communication sessions.','Read')}
    ${featureCard('janus05x.html','📊','JANUS Results','What the data showed — patterns, anomalies, and the contested question of language.','Read')}
    ${featureCard('janus06x.html','🎯','JANUS Conclusions','Lilly\'s final assessment of JANUS — its successes, limitations, and implications.','Read')}
  </div>

  ${sectionH2('ADVANCED RESEARCH', 'Videophone & Touchscreen Studies')}
  <div class="feature-grid">
    ${featureCard('videophone01x.html','📺','Videophone Study #1','Could dolphins respond meaningfully to visual communication via television screens?','Read')}
    ${featureCard('videophone02x.html','📺','Videophone Study #2','Continued videophone research — dolphins demonstrate screen-recognition capability.','Read')}
    ${featureCard('touchscreen00.html','👆','Touchscreen Overview','Introduction to the touchscreen communication system — a potential shared interface.','Read')}
    ${featureCard('touchscreen01.html','🖥️','Touchscreen Study #1','First sessions using touchscreen pads as a communication medium between species.','Read')}
    ${featureCard('teachersx.html','🎓','Dolphin Teachers','The profound reversal — evidence that dolphins were actively attempting to teach humans.','Read')}
  </div>
</div>` + FOOTER + vob('http://www.johnclilly.com/interspecies.html') + '</body></html>';
},

'isolation.html': () => {
  const origUrl = cOrig('isotank02.gif') || cOrig('isotank03.gif');
  return head('Isolation Tanks','John C. Lilly invented sensory deprivation flotation in 1954. Five decades of inner exploration followed.') +
  NAV +
  heroSection('Isolation <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Tanks</em>',
    'In 1954, Lilly built the first isolation tank. He spent the rest of his life inside it.',
    'FLOTATION RESEARCH · NIMH · 1954–2001') +
  heroSlider(g('group-05'), origUrl, 'Early flotation tank prototype, National Institute of Mental Health, Bethesda, Maryland — 1954') +
  `<div class="page">
  <div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/isolation.html" target="_blank" rel="noopener">johnclilly.com/isolation.html</a></div>
  ${pullQuote('"In the province of the mind, what one believes to be true either is true or becomes true."','John C. Lilly — discovered in the isolation tank')}
  <p class="section-intro">In 1954 at the National Institute of Mental Health, Lilly designed and built the first sensory deprivation flotation tank. The scientific question: what happens to consciousness when all external stimuli are removed? The answer changed his life — and eventually, through the commercial samadhi tank, millions of others.</p>

  ${sectionH2('THE TECHNOLOGY', 'Tank History & Design')}
  <div class="feature-grid">
    ${featureCard('tanks01.html','🛁','Tank History','The complete history of the isolation tank — from the first NIMH prototype to commercial flotation centers.','Read history')}
    ${featureCard('tanksketch01.html','📐','Tank Sketch #1','Original engineering sketches for the first isolation tank design — Lilly\'s own drawings.','View drawings')}
    ${featureCard('tanksketch02.html','📐','Tank Sketch #2','Second iteration designs — improvements to the water circulation and temperature systems.','View')}
    ${featureCard('moderntankx.html','⚗️','Modern Tank','How the original 1954 design evolved into the commercial samadhi tank of the 1970s-80s.','Read')}
    ${featureCard('tankopen.html','🔓','Tank Open','Photographic documentation of the tank in its open configuration — design and access.','View')}
    ${featureCard('tankclose.html','🔒','Tank Closed','The sealed configuration — what the user experiences from inside.','View')}
  </div>

  ${sectionH2('INNER EXPLORATIONS', 'Sessions, States & Discoveries')}
  <div class="feature-grid">
    ${featureCard('isolationx.html','🌊','Isolation Overview','Lilly\'s systematic account of states of consciousness encountered in the tank.','Read')}
    ${featureCard('lsdtankx.html','🔬','LSD in the Tank','Lilly\'s controversial combination of LSD and flotation — what he found, what it cost him.','Read')}
    ${featureCard('stagesx.html','📊','Stages of Consciousness','A taxonomy of the altered states accessible through extended flotation — levels 1 through 6.','Read')}
    ${featureCard('meltingx.html','💧','The Melting','A first-person account of ego dissolution in the tank — one of Lilly\'s most intense recorded sessions.','Read')}
    ${featureCard('deepself01.html','✦','The Deep Self','Lilly\'s theory of the deeper self encountered in profound isolation — what it is and what it knows.','Read')}
    ${featureCard('observerx.html','👁️','The Observer','The split consciousness phenomenon — Lilly\'s experience of watching himself from an external vantage.','Read')}
  </div>

  ${sectionH2('TANK LOGS', 'Session Records')}
  <div class="feature-grid">
    ${featureCard('tanklogsx.html','📓','Tank Logs','Verbatim records of Lilly\'s isolation tank sessions — unedited first-person documentation.','Read logs')}
    ${featureCard('johntankx.html','📷','John in the Tank','Photographic documentation of Lilly entering, floating in, and emerging from the tank.','View photos')}
    ${featureCard('isotank02x.html','📋','Session Records #2','Second series of session documentation — deeper states, longer durations, recurring entities.','Read')}
    ${featureCard('isotank03x.html','📋','Session Records #3','Third series — the ketamine sessions and their relationship to the earlier LSD work.','Read')}
    ${featureCard('conferencex.html','🎤','Conference Presentations','Lilly presenting his isolation tank research to the scientific community — transcripts.','Read')}
  </div>
</div>` + FOOTER + vob('http://www.johnclilly.com/isolation.html') + '</body></html>';
},

'mind.html': () => {
  const origUrl = cOrig('mindchart01.jpg') || cOrig('brainbody.gif');
  return head('Brain & Mind','John C. Lilly — the human biocomputer theory, metaprogramming, and the architecture of consciousness.') +
  NAV +
  heroSection('Brain &amp; <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Mind</em>',
    'The human brain as a programmable biological computer. Long before Silicon Valley — Lilly said it first.',
    'NEUROSCIENCE · METAPROGRAMMING · 1950–2001') +
  heroSlider(g('group-06'), origUrl, 'Brain mapping and neural research — National Institute of Mental Health, Bethesda — 1950s') +
  `<div class="page">
  <div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/mind.html" target="_blank" rel="noopener">johnclilly.com/mind.html</a></div>
  ${pullQuote('"The brain is a biocomputer. The software is the belief system."','John C. Lilly')}
  <p class="section-intro">In the early 1950s, Lilly proposed something radical: the human brain operates as a programmable biological computer, and human consciousness is software running on it. He called the process of reprogramming consciousness "metaprogramming." The theory — developed through isolation tank sessions, psychedelic research, and decades of neuroscience — anticipated cognitive science by decades.</p>

  ${sectionH2('NEUROSCIENCE', 'Brain Research')}
  <div class="feature-grid">
    ${featureCard('brainx.html','🧠','Brain Research Overview','Lilly\'s systematic neuroscience career — from early electrode mapping to the biocomputer model.','Read')}
    ${featureCard('brain.html','🔬','The Brain','In-depth examination of brain architecture and Lilly\'s theories about consciousness emergence.','Read')}
    ${featureCard('brainsize.html','📏','Brain Size & Intelligence','Critical mass theory: why brain size matters for language, consciousness, and cognitive capability.','Read research')}
    ${featureCard('melonbrains.html','🐋','Melon Brains','The remarkable acoustic-focusing organ in cetacean skulls — its role in echolocation and communication.','Read')}
    ${featureCard('nmrscanx.html','🔭','NMR Brain Scans','Lilly\'s use of NMR (now MRI) technology to map brain activity during altered states.','View scans')}
    ${featureCard('cognitivex.html','💡','Cognitive Research','The cognitive science foundations of Lilly\'s metaprogramming theory.','Read')}
  </div>

  ${sectionH2('METAPROGRAMMING', 'The Human Biocomputer')}
  <div class="feature-grid">
    ${featureCard('metaprogx.html','💻','Metaprogramming Overview','The foundational theory — how the brain programs itself and how to consciously reprogram it.','Read theory')}
    ${featureCard('metaprog00.html','📖','Programming and Metaprogramming — Intro','The introduction to Lilly\'s landmark 1967 work on the human biocomputer.','Read')}
    ${featureCard('metaprog01.html','📖','Chapter 1','The basic model: stimulus-response programs and how they accumulate into personality.','Read')}
    ${featureCard('metaprog02.html','📖','Chapter 2','The metaprogram — the layer above programs that can observe and modify them.','Read')}
    ${featureCard('programming01.html','⚙️','Programming the Brain','How external inputs — experience, psychedelics, isolation — write new programs into the biocomputer.','Read')}
  </div>

  ${sectionH2('SIMULATIONS OF GOD', 'Consciousness at its Limits')}
  <div class="feature-grid">
    ${featureCard('simulations01.html','✦','Simulations of God','Lilly\'s exploration of the entities and states encountered at the deepest levels of altered consciousness.','Read')}
    ${featureCard('simulationsIntro.html','📖','Introduction','Setting the philosophical context for the simulation hypothesis — years before it became mainstream.','Read')}
    ${featureCard('simulationsChap01.html','📖','Chapter 1','The first encounters — what lies at the limit of consciousness when the brain runs out of programs.','Read')}
    ${featureCard('experiment02x.html','🔬','Consciousness Experiments','Documented experiments pushing at the boundary between self and simulation.','Read')}
  </div>

  ${sectionH2('MIND SERIES', 'Published Research')}
  <div class="feature-grid">
    ${featureCard('mindx.html','📚','The Mind','Lilly\'s comprehensive treatment of mind-body interaction and the theory of consciousness.','Read')}
    ${featureCard('mind01.html','📚','Mind #1','Volume 1 of the Mind series — foundations of the biocomputer model.','Read')}
    ${featureCard('mindCh0701.html','📖','The Mind of the Dolphin Ch. 7-1','The chapter connecting dolphin cognition to the biocomputer model.','Read')}
    ${featureCard('mindCh0702.html','📖','The Mind of the Dolphin Ch. 7-2','Continuation — parallel architecture between cetacean and human neural processing.','Read')}
  </div>
</div>` + FOOTER + vob('http://www.johnclilly.com/mind.html') + '</body></html>';
},

'bio.html': () => {
  const origUrl = cOrig('bt_jcl_icerc1999.jpg');
  return head('Biography','The life of John C. Lilly — 86 years of relentless exploration.') +
  NAV +
  heroSection('A Life in <em style="font-style:normal;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Science</em>',
    'January 6, 1915 — September 30, 2001 · Neurosurgeon · Dolphin Researcher · Psychonaut · Visionary',
    'BIOGRAPHICAL ARCHIVE · 86 YEARS') +
  heroSlider(g('group-01'), origUrl, 'John C. Lilly at the International Cetacean Research Conference, 1999') +
  `<div class="page">
  <div class="archive-notice">⚑ <strong>Permanent Archive</strong> — Original: <a href="http://www.johnclilly.com/bio.html" target="_blank" rel="noopener">johnclilly.com/bio.html</a></div>

  <div class="steps" style="margin-bottom:48px;">
    <div class="step"><div class="step-num" style="background:var(--grad);color:#fff;font-size:14px;font-weight:700;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">1</div><div><h4 style="font-size:1rem;margin-bottom:5px;">Early Life & Education</h4><p style="font-size:14px;color:var(--text-soft);margin:0;">St. Paul, Minnesota · Caltech (physics, 1938) · University of Pennsylvania Medical School (M.D., 1942) · Dartmouth · Johns Hopkins</p></div></div>
    <div class="step"><div class="step-num" style="background:var(--grad);color:#fff;font-size:14px;font-weight:700;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">2</div><div><h4 style="font-size:1rem;margin-bottom:5px;">NIMH & The First Tank</h4><p style="font-size:14px;color:var(--text-soft);margin:0;">National Institute of Mental Health, Bethesda · First isolation tank, 1954 · Brain electrode research · Neurophysiology pioneer</p></div></div>
    <div class="step"><div class="step-num" style="background:var(--grad);color:#fff;font-size:14px;font-weight:700;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">3</div><div><h4 style="font-size:1rem;margin-bottom:5px;">The Virgin Islands</h4><p style="font-size:14px;color:var(--text-soft);margin:0;">Communications Research Institute, St. Thomas, 1959 · Dolphin research · Margaret Howe experiment · The flooded laboratory</p></div></div>
    <div class="step"><div class="step-num" style="background:var(--grad);color:#fff;font-size:14px;font-weight:700;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">4</div><div><h4 style="font-size:1rem;margin-bottom:5px;">Esalen & The Human Potential Movement</h4><p style="font-size:14px;color:var(--text-soft);margin:0;">Big Sur, California · LSD and ketamine research · Metaprogramming theory · E.C.C.O. cosmology · International influence</p></div></div>
    <div class="step"><div class="step-num" style="background:var(--grad);color:#fff;font-size:14px;font-weight:700;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">5</div><div><h4 style="font-size:1rem;margin-bottom:5px;">Later Life & Legacy</h4><p style="font-size:14px;color:var(--text-soft);margin:0;">Malibu, California · Human Software Inc. · Samadhi tanks worldwide · Died September 30, 2001</p></div></div>
  </div>

  ${sectionH2('EARLY LIFE PHOTOS', 'Youth & Education')}
  <div class="feature-grid">
    ${featureCard('yngJL01x.html','👦','Young John #1','Photographs of John Lilly as a child and young man in St. Paul, Minnesota.','View photos')}
    ${featureCard('yngJL02x.html','👦','Young John #2','Adolescence and early intellectual development — the formation of a scientific mind.','View photos')}
    ${featureCard('babyjohnx.html','🍼','Baby John','The earliest photographs — John Lilly as an infant in Minnesota, 1915.','View')}
    ${featureCard('johngradx.html','🎓','Graduation','Medical school graduation photographs — the making of Dr. John C. Lilly.','View photos')}
  </div>

  ${sectionH2('AT WORK', 'Research & Laboratory')}
  <div class="feature-grid">
    ${featureCard('laboratoryx.html','🏛️','Lab Photo Sequence','The complete photographic record of the Communications Research Institute in the Virgin Islands.','View photos')}
    ${featureCard('lab00x.html','🔬','Lab Overview','Overview photography of the research facilities, equipment, and dolphin environments.','View')}
    ${featureCard('johntankx.html','🛁','John in the Tank','Documentary photographs of Lilly in the isolation tank — the explorer exploring himself.','View photos')}
    ${featureCard('johnjanusx.html','💻','John with JANUS','Lilly at the JANUS computer system during active communication sessions.','View')}
    ${featureCard('johnboatx.html','⛵','John on the Water','Lilly in his natural environment — photographs from the Virgin Islands field research period.','View')}
    ${featureCard('JLEsalenx.html','🌿','Esalen','Photographs from Lilly\'s long association with the Esalen Institute in Big Sur.','View')}
  </div>

  ${sectionH2('COLLEAGUES & FAMILY', 'People in the Archive')}
  <div class="feature-grid">
    ${featureCard('marpeterx.html','🐬','Margaret & Peter','Margaret Howe and Peter the dolphin — the central relationship of the interspecies experiment.','View photos')}
    ${featureCard('hofmannx.html','🧪','Albert Hofmann','Photographs and records of Lilly\'s relationship with LSD inventor Albert Hofmann.','View')}
    ${featureCard('JL&Barbarax.html','❤️','John & Barbara','Photographs of John Lilly with his wife Barbara Brown Lilly.','View')}
    ${featureCard('JL&Loux.html','👥','John & Lou','John Lilly with Lou Gasnier — later life photographs from the Malibu period.','View')}
    ${featureCard('JL&takakox.html','🌏','John & Takako','Photographs with Takako Takase during the Japanese research visits.','View')}
  </div>
</div>` + FOOTER + vob('http://www.johnclilly.com/bio.html') + '</body></html>';
},

};

// Write section pages
for (const [fn, builder] of Object.entries(pages)) {
  try {
    fs.writeFileSync(path.join(B, fn), builder());
    log(`✓ ${fn}`);
  } catch(e) {
    log(`✗ ${fn}: ${e.message}`);
  }
}

// ── Fix deep archive pages: strip old HTML formatting ──────────────────────

function cleanMirrorHtml(html) {
  // Strip old presentational HTML
  return html
    .replace(/<font[^>]*>/gi, '')
    .replace(/<\/font>/gi, '')
    .replace(/<center>/gi, '<div style="text-align:center">')
    .replace(/<\/center>/gi, '</div>')
    .replace(/<b>(?!\w)/gi, '')  // lone <b> tags
    .replace(/style="color:#[0-9a-f]{3,6}"/gi, '') // old colour attrs
    .replace(/style="font-family:[^"]+"/gi, '')
    .replace(/style="font-size:\s*\d+pt[^"]*"/gi, '')
    .replace(/<table[^>]*width="100%"[^>]*>\s*<tbody>\s*<tr>\s*<td[^>]*>/gi, '<div class="content-block">')
    .replace(/<\/td>\s*<\/tr>\s*<\/tbody>\s*<\/table>/gi, '</div>');
}

// Fix archive-converted pages with tiny fonts and old vars
const mirrorPages = fs.readdirSync(B).filter(f => f.endsWith('.html'));
let fixedCount = 0;
for (const file of mirrorPages) {
  // Skip section pages we just rebuilt
  if (Object.keys(pages).includes(file)) continue;
  
  const fp = path.join(B, file);
  let html = fs.readFileSync(fp, 'utf8');
  
  const needsFix = html.includes('0.78rem') || html.includes('--ink-light') || 
                   html.includes('<font') || html.includes('<center>');
  if (!needsFix) continue;
  
  // Clean old HTML in prose sections
  const $ = load(html, { decodeEntities: false });
  $('.prose').each((_, el) => {
    const inner = $(el).html() || '';
    $(el).html(cleanMirrorHtml(inner));
  });
  
  // Fix tiny breadcrumb font (0.78rem → use .breadcrumb class)
  $('[style*="0.78rem"]').each((_, el) => {
    const $el = $(el);
    const existing = $el.attr('style') || '';
    $el.attr('style', existing.replace(/font-family[^;]+;?/g, '').replace(/font-size:\s*0\.78rem/g, 'font-size:0.82rem'));
    $el.addClass('breadcrumb');
  });
  
  fs.writeFileSync(fp, $.html());
  fixedCount++;
}

log(`✓ ${fixedCount} deep archive pages cleaned`);
log('Done.');
