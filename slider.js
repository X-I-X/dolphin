/* ═══════════════════════════════════════════════
   JCL Archive — Image Comparison Slider v2
   Default: AI image fully visible
   Drag RIGHT → original archive image revealed
   ═══════════════════════════════════════════════ */
(function () {
  'use strict';

  function initSlider(el) {
    var aiLayer = el.querySelector('.img-slider-ai');
    var handle  = el.querySelector('.img-slider-handle');
    if (!aiLayer || !handle) return;

    var dragging = false;
    var rect;

    // pct = 0:   handle at left  → AI fully visible (default)
    // pct = 100: handle at right → AI fully hidden → original shows
    function setPosition(pct) {
      var p = Math.max(0, Math.min(pct, 100));
      // Clip the AI layer from the LEFT side as handle moves right
      aiLayer.style.clipPath = 'inset(0 0 0 ' + p + '%)';
      handle.style.left = p + '%';
    }

    function getPercent(clientX) {
      rect = el.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * 100;
    }

    function start(clientX) {
      el.classList.remove('hint-anim');
      dragging = true;
      rect = el.getBoundingClientRect();
      setPosition(getPercent(clientX));
    }
    function move(clientX) {
      if (!dragging) return;
      setPosition(getPercent(clientX));
    }
    function end() { dragging = false; }

    el.addEventListener('mousedown',  e => { e.preventDefault(); start(e.clientX); });
    window.addEventListener('mousemove', e => move(e.clientX));
    window.addEventListener('mouseup', end);

    el.addEventListener('touchstart', e => { e.preventDefault(); start(e.touches[0].clientX); }, { passive: false });
    el.addEventListener('touchmove',  e => { e.preventDefault(); move(e.touches[0].clientX);  }, { passive: false });
    el.addEventListener('touchend', end);

    // Click toggle
    var startX, startT;
    el.addEventListener('mousedown', e => { startX = e.clientX; startT = Date.now(); });
    el.addEventListener('mouseup', e => {
      if (Date.now() - startT < 200 && Math.abs(e.clientX - startX) < 8) {
        var cur = parseFloat(handle.style.left || '0');
        setPosition(cur < 50 ? 100 : 0);
      }
    });

    // Keyboard
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-label', 'Drag right to see original archive image, drag left for AI version');
    el.addEventListener('keydown', e => {
      var cur = parseFloat(handle.style.left || '0');
      if (e.key === 'ArrowRight') { setPosition(Math.min(100, cur + 10)); e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { setPosition(Math.max(0,   cur - 10)); e.preventDefault(); }
      if (e.key === 'End')   { setPosition(100); e.preventDefault(); }
      if (e.key === 'Home')  { setPosition(0);   e.preventDefault(); }
    });

    // Default: AI fully visible (pct = 0, handle at left)
    setPosition(0);

    // Hint animation — slightly reveals original then snaps back
    el.classList.add('hint-anim');
  }

  function initAll() {
    document.querySelectorAll('.img-slider:not(.no-ai):not([data-slider-init])')
      .forEach(el => {
        el.setAttribute('data-slider-init', '1');
        initSlider(el);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  window.initSliders = initAll;
})();
