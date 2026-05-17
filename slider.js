/* ═══════════════════════════════════════════════
   JCL Archive — Image Slider Runtime
   Handles drag/touch for all .img-slider elements
   ═══════════════════════════════════════════════ */
(function() {
  'use strict';

  function initSlider(el) {
    var aiLayer = el.querySelector('.img-slider-ai');
    var handle  = el.querySelector('.img-slider-handle');
    if (!aiLayer || !handle) return;

    var dragging = false;
    var rect;

    function getPercent(clientX) {
      rect = el.getBoundingClientRect();
      var x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return (x / rect.width) * 100;
    }

    function setPosition(pct) {
      // pct = 0: handle far left (original fully visible)
      // pct = 100: handle far right (AI fully visible — default)
      var reveal = Math.max(0, Math.min(pct, 100));
      // Clip AI layer: clip from right, revealing from right = show (100-reveal)% from right
      var clipRight = 100 - reveal;
      aiLayer.style.clipPath = 'inset(0 ' + clipRight + '% 0 0)';
      handle.style.left = reveal + '%';
    }

    function onStart(clientX) {
      el.classList.remove('hint-anim');
      dragging = true;
      rect = el.getBoundingClientRect();
      setPosition(getPercent(clientX));
    }

    function onMove(clientX) {
      if (!dragging) return;
      setPosition(getPercent(clientX));
    }

    function onEnd() {
      dragging = false;
    }

    // Mouse
    el.addEventListener('mousedown', function(e) {
      e.preventDefault();
      onStart(e.clientX);
    });
    window.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      onMove(e.clientX);
    });
    window.addEventListener('mouseup', onEnd);

    // Touch
    el.addEventListener('touchstart', function(e) {
      e.preventDefault();
      onStart(e.touches[0].clientX);
    }, { passive: false });
    el.addEventListener('touchmove', function(e) {
      e.preventDefault();
      onMove(e.touches[0].clientX);
    }, { passive: false });
    el.addEventListener('touchend', onEnd);

    // Click toggle (fast tap without drag)
    var startX, startT;
    el.addEventListener('mousedown', function(e) { startX = e.clientX; startT = Date.now(); });
    el.addEventListener('mouseup', function(e) {
      if (Date.now() - startT < 200 && Math.abs(e.clientX - startX) < 8) {
        // Toggle
        var cur = parseFloat(aiLayer.style.clipPath.replace(/inset\(0 ([0-9.]+)%.*/, '$1') || '0');
        setPosition(cur > 50 ? 0 : 100);
      }
    });

    // Keyboard accessible
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-label', 'Drag to compare AI reinterpretation with original archive image');
    el.addEventListener('keydown', function(e) {
      var cur = parseFloat(handle.style.left || '100');
      if (e.key === 'ArrowLeft')  { setPosition(Math.max(0,   cur - 10)); e.preventDefault(); }
      if (e.key === 'ArrowRight') { setPosition(Math.min(100, cur + 10)); e.preventDefault(); }
      if (e.key === 'Home')       { setPosition(0);   e.preventDefault(); }
      if (e.key === 'End')        { setPosition(100); e.preventDefault(); }
    });

    // Default: AI fully visible, play hint animation once
    setPosition(100);
    el.classList.add('hint-anim');
  }

  function initAll() {
    document.querySelectorAll('.img-slider:not(.no-ai):not([data-slider-init])')
      .forEach(function(el) {
        el.setAttribute('data-slider-init', '1');
        initSlider(el);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Re-run for dynamically added sliders
  window.initSliders = initAll;
})();
