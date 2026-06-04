/* ═══════════════════════════════════════════════════════════════
   JCL Archive — Enhancement Layer v1 (Batch O)
   Reading Mode · Citation Helper · Search Overlay · Nav Wiring
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── UTILITIES ── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function(c) { e.appendChild(c); });
    return e;
  }

  /* ── NAV DRAWER WIRING ── */
  function initNav() {
    var hamburger = document.getElementById('hamburger');
    var navDrawer  = document.getElementById('navDrawer');
    var navOverlay = document.getElementById('navOverlay');
    var drawerClose = document.getElementById('drawerClose');
    // Skip if existing inline wiring already attached (pages have inline scripts)
    if (!hamburger || !navDrawer) return;
    if (hamburger.dataset.navWired) return;
    hamburger.dataset.navWired = '1';

    function openNav() {
      navDrawer.classList.add('open');
      // Existing CSS uses .active for overlay, .open for drawer
      if (navOverlay) { navOverlay.classList.add('active'); navOverlay.classList.add('open'); }
      hamburger.classList.add('open');
    }
    function closeNav() {
      navDrawer.classList.remove('open');
      if (navOverlay) { navOverlay.classList.remove('active'); navOverlay.classList.remove('open'); }
      hamburger.classList.remove('open');
    }

    hamburger.addEventListener('click', openNav);
    if (drawerClose) drawerClose.addEventListener('click', closeNav);
    if (navOverlay) navOverlay.addEventListener('click', closeNav);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && navDrawer.classList.contains('open')) closeNav();
    });
  }

  /* ── READING MODE ── */
  function initReadingMode() {
    // Only inject on pages with substantial prose content
    var prose = document.querySelector('.prose, .page, .page-prose');
    if (!prose) return;

    var active = localStorage.getItem('jcl-reading-mode') === '1';

    var btn = el('button', {
      'class': 'reading-mode-btn',
      'aria-label': 'Toggle reading mode',
      'title': 'Reading Mode'
    });
    var icon = el('span', { 'class': 'rmb-icon', 'text': '📖' });
    var label = el('span', { 'text': 'Read' });
    btn.appendChild(icon);
    btn.appendChild(label);

    function applyMode() {
      if (active) {
        document.body.classList.add('reading-mode');
        label.textContent = 'Exit';
        btn.title = 'Exit Reading Mode';
      } else {
        document.body.classList.remove('reading-mode');
        label.textContent = 'Read';
        btn.title = 'Reading Mode';
      }
    }

    btn.addEventListener('click', function() {
      active = !active;
      localStorage.setItem('jcl-reading-mode', active ? '1' : '0');
      applyMode();
    });

    applyMode();
    document.body.appendChild(btn);
  }

  /* ── CITATION HELPER ── */
  function initCitation() {
    // Only on pages with prose content (not gallery, photo pages)
    var prose = document.querySelector('.prose, .page, .page-prose');
    if (!prose) return;

    // Gather page metadata
    var pageTitle = document.title || 'John C. Lilly Archive';
    var ogTitle = (document.querySelector('meta[property="og:title"]') || {}).content || pageTitle;
    var desc = (document.querySelector('meta[name="description"]') || {}).content || '';
    var canonicalPath = window.location.pathname.replace(/\.html$/, '').replace(/^\//, '') || 'index';
    var archiveUrl = 'https://dolphins-jcl.netlify.app/' + canonicalPath;
    var fn = window.location.pathname.split('/').pop() || 'index.html';
    var originalUrl = 'http://www.johnclilly.com/' + fn;

    // Build citation strings
    var year = new Date().getFullYear();
    var accessDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    var mla = 'Lilly, John C. "' + ogTitle.replace(' — John C. Lilly Archive', '').replace(' — John C. Lilly', '') + '." ' +
      'John C. Lilly Archive, dolphins-jcl.netlify.app/' + canonicalPath + '. ' +
      'Originally published at www.johnclilly.com. Accessed ' + accessDate + '.';

    var apa = 'Lilly, J. C. (' + year + '). ' + ogTitle.replace(' — John C. Lilly Archive', '').replace(' — John C. Lilly', '') + '. ' +
      'John C. Lilly Archive. ' + archiveUrl + ' (Original: ' + originalUrl + ')';

    var chicago = 'Lilly, John C. "' + ogTitle.replace(' — John C. Lilly Archive', '').replace(' — John C. Lilly', '') + '." ' +
      'John C. Lilly Archive. Accessed ' + accessDate + '. ' + archiveUrl + '.';

    var citations = { mla: mla, apa: apa, chicago: chicago };
    var currentStyle = 'mla';

    // Citation button
    var cBtn = el('button', {
      'class': 'citation-btn',
      'aria-label': 'Cite this page',
      'title': 'Cite this page'
    });
    cBtn.innerHTML = '<span style="font-size:14px">📋</span> <span>Cite</span>';

    // Citation widget
    var widget = el('div', { 'class': 'citation-widget', 'role': 'dialog', 'aria-label': 'Citation helper' });
    widget.innerHTML =
      '<div class="citation-widget-header">' +
        '<span class="citation-widget-title">Cite This Page</span>' +
        '<button class="citation-widget-close" aria-label="Close">✕</button>' +
      '</div>' +
      '<div class="citation-tabs">' +
        '<button class="citation-tab active" data-style="mla">MLA</button>' +
        '<button class="citation-tab" data-style="apa">APA</button>' +
        '<button class="citation-tab" data-style="chicago">Chicago</button>' +
      '</div>' +
      '<div class="citation-text" id="citation-output">' + mla + '</div>' +
      '<button class="citation-copy-btn">Copy Citation</button>' +
      '<p class="citation-note">Archive URL: <a href="' + archiveUrl + '" style="color:var(--teal)">' + archiveUrl + '</a></p>';

    // Tab switching
    $$('.citation-tab', widget).forEach(function(tab) {
      tab.addEventListener('click', function() {
        currentStyle = tab.dataset.style;
        $$('.citation-tab', widget).forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('citation-output').textContent = citations[currentStyle];
      });
    });

    // Copy button
    widget.querySelector('.citation-copy-btn').addEventListener('click', function() {
      var text = citations[currentStyle];
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
          widget.querySelector('.citation-copy-btn').textContent = '✓ Copied!';
          setTimeout(function() { widget.querySelector('.citation-copy-btn').textContent = 'Copy Citation'; }, 2000);
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        widget.querySelector('.citation-copy-btn').textContent = '✓ Copied!';
        setTimeout(function() { widget.querySelector('.citation-copy-btn').textContent = 'Copy Citation'; }, 2000);
      }
    });

    // Close button
    widget.querySelector('.citation-widget-close').addEventListener('click', function() {
      widget.classList.remove('open');
    });

    // Toggle widget
    cBtn.addEventListener('click', function() {
      widget.classList.toggle('open');
    });

    document.body.appendChild(cBtn);
    document.body.appendChild(widget);

    // Close on outside click
    document.addEventListener('click', function(e) {
      if (!widget.contains(e.target) && e.target !== cBtn) {
        widget.classList.remove('open');
      }
    });

    // Add print-only citation block to prose
    var printCite = el('div', { 'class': 'citation-print-block' });
    printCite.innerHTML =
      '<strong>Citation (MLA):</strong> ' + mla + '<br>' +
      '<strong>Archive URL:</strong> ' + archiveUrl + ' · ' +
      '<strong>Original:</strong> ' + originalUrl;
    var lastProse = $$('.prose, .page, .page-prose').pop();
    if (lastProse) lastProse.appendChild(printCite);
  }

  /* ── SEARCH OVERLAY ── */
  function initSearch() {
    // Inject search trigger into nav area
    var siteNav = document.querySelector('.site-nav');
    if (!siteNav) return;

    // Check if search trigger already exists
    if (document.querySelector('.search-trigger')) return;

    var trigger = el('button', {
      'class': 'search-trigger',
      'aria-label': 'Search archive',
      'title': 'Search the archive'
    });
    trigger.innerHTML = '<span>🔍</span> <span>Search</span>';
    siteNav.appendChild(trigger);

    // Also add to nav drawer
    var drawer = document.getElementById('navDrawer');
    if (drawer) {
      var drawerSearch = el('a', { 'href': 'search.html' });
      drawerSearch.innerHTML = '🔍 Search Archive';
      var closeBtn = drawer.querySelector('.drawer-close');
      if (closeBtn && closeBtn.nextSibling) {
        drawer.insertBefore(drawerSearch, closeBtn.nextSibling);
      } else {
        drawer.appendChild(drawerSearch);
      }
    }

    // Build search overlay
    var overlay = el('div', { 'class': 'search-overlay', 'role': 'dialog', 'aria-label': 'Search' });
    overlay.innerHTML =
      '<div class="search-box">' +
        '<div class="search-input-row">' +
          '<span class="search-icon">🔍</span>' +
          '<input class="search-input" type="text" placeholder="Search John C. Lilly Archive…" autocomplete="off" spellcheck="false">' +
          '<button class="search-close-btn" aria-label="Close search">✕</button>' +
        '</div>' +
        '<div class="search-results" id="search-results"></div>' +
        '<div class="search-footer">Search across 150+ pages · <a href="search.html" style="color:var(--teal)">Advanced search →</a></div>' +
      '</div>';

    document.body.appendChild(overlay);

    var input = overlay.querySelector('.search-input');
    var resultsEl = overlay.querySelector('#search-results');
    var closeBtn = overlay.querySelector('.search-close-btn');

    var searchIndex = null;

    function openSearch() {
      overlay.classList.add('open');
      input.focus();
      // Lazy-load index
      if (!searchIndex) {
        fetch('search-index.json')
          .then(function(r) { return r.json(); })
          .then(function(data) {
            searchIndex = data;
            if (input.value.trim().length >= 2) doSearch(input.value.trim());
          })
          .catch(function() {
            searchIndex = [];
          });
      }
    }

    function closeSearch() {
      overlay.classList.remove('open');
      input.value = '';
      resultsEl.innerHTML = '';
    }

    function doSearch(q) {
      if (!searchIndex || q.length < 2) {
        resultsEl.innerHTML = '';
        return;
      }
      var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      var results = searchIndex.filter(function(item) {
        var text = ((item.title || '') + ' ' + (item.description || '') + ' ' + (item.keywords || '') + ' ' + (item.category || '')).toLowerCase();
        return terms.every(function(t) { return text.includes(t); });
      }).slice(0, 12);

      if (!results.length) {
        resultsEl.innerHTML = '<div class="search-empty">No results for "' + q + '"</div>';
        return;
      }

      resultsEl.innerHTML = results.map(function(item) {
        return '<a class="search-result" href="' + item.url + '">' +
          (item.category ? '<div class="search-result-cat">' + item.category + '</div>' : '') +
          '<div class="search-result-title">' + (item.title || item.url) + '</div>' +
          (item.description ? '<div class="search-result-desc">' + item.description.slice(0, 120) + (item.description.length > 120 ? '…' : '') + '</div>' : '') +
          '</a>';
      }).join('');
    }

    trigger.addEventListener('click', openSearch);
    closeBtn.addEventListener('click', closeSearch);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeSearch();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeSearch();
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        if (!overlay.classList.contains('open')) {
          e.preventDefault();
          openSearch();
        }
      }
    });

    input.addEventListener('input', function() {
      var q = input.value.trim();
      if (q.length >= 2) doSearch(q);
      else resultsEl.innerHTML = '';
    });
  }

  /* ── INIT ── */
  function init() {
    initNav();
    initReadingMode();
    initCitation();
    initSearch();
    // Re-init sliders in case any were added after page load
    if (window.initSliders) window.initSliders();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
