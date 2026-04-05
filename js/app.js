(function () {
  async function runIncludes() {
    const nodes = document.querySelectorAll('[data-include]');
    await Promise.all(Array.from(nodes).map(async node => {
      const url = node.getAttribute('data-include');
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
        const text = await res.text();
        node.innerHTML = text;
      } catch (err) {
        console.error(err);
        node.innerHTML = `<!-- include failed: ${err.message} -->`;
      }
    }));

    try {
      window.dispatchEvent(new CustomEvent('includes-loaded'));
    } catch (e) {
      const ev = document.createEvent('Event');
      ev.initEvent('includes-loaded', true, true);
      window.dispatchEvent(ev);
    }
  }

  async function navigateTo(url, opts = {}) {
    try {
      // capture current scroll position so SPA navigation doesn't shift the page
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const res = await fetch(url, {cache: 'no-store'});
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const newMain = doc.querySelector('main');
      const newTitle = doc.querySelector('title');

      if (!newMain) {
        if (!opts.replace) location.href = url;
        return;
      }

      const oldMain = document.querySelector('main');
      if (!oldMain) {
        if (!opts.replace) location.href = url;
        return;
      }

      oldMain.style.transition = 'opacity 180ms ease';
      oldMain.style.opacity = '0';
      await new Promise(r => setTimeout(r, 200));
      oldMain.innerHTML = newMain.innerHTML;
      oldMain.style.opacity = '1';

      if (newTitle) document.title = newTitle.textContent;

      if (opts.replace) {
        history.replaceState({}, '', url);
      } else {
        history.pushState({}, '', url);
      }

      const nodes = oldMain.querySelectorAll('[data-include]');
      if (nodes.length) {
        await Promise.all(Array.from(nodes).map(async node => {
          const u = node.getAttribute('data-include');
          try {
            const r = await fetch(u);
            const t = await r.text();
            node.innerHTML = t;
          } catch (err) {
            console.error('include failed during SPA navigate', err);
          }
        }));
      }

      // restore previous scroll position to avoid the page jumping as if the user scrolled
      try {
        window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      } catch (e) {
        // fallback for older browsers
        window.scrollTo(0, scrollY);
      }

    } catch (err) {
      console.error(err);
      location.href = url;
    }
  }

  function setupSpaNav() {
    const header = document.querySelector('header');
    if (!header) return;

    header.addEventListener('click', async (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // determine if there's a corresponding nav link (so logo clicks target the nav 'home')
      const nav = document.querySelector('.site-nav');
      let matchingNavAnchor = null;
      if (nav) {
        const navLinks = Array.from(nav.querySelectorAll('a'));
        const targetPath = (new URL(href, location.origin)).pathname.replace(/\/$/, '');
        matchingNavAnchor = navLinks.find(link => (new URL(link.href, location.origin)).pathname.replace(/\/$/, '') === targetPath) || null;
      }

      // start underline burst animation immediately, prefer matching nav anchor if present
      updateNavUnderline(true, matchingNavAnchor || null);
      // trigger background section-change start
      window.dispatchEvent(new CustomEvent('section-change-start', { detail: { href } }));
      await navigateTo(href);
      // trigger section-change end so background can react
      window.dispatchEvent(new CustomEvent('section-change-end', { detail: { href } }));
      // finalize underline position after navigation completes
      updateNavUnderline(false);
    });

    window.addEventListener('popstate', (e) => {
      const url = location.pathname + location.search;
      navigateTo(url, {replace: true}).then(() => updateNavUnderline());
    });
  }

  // burst: if burst===true and targetAnchor provided, start a shrink+move then expand animation.
  function updateNavUnderline(burst = false, targetAnchor = null) {
    const nav = document.querySelector('.site-nav');
    const underline = nav && nav.querySelector('.nav-underline');
    if (!nav || !underline) return;
    const links = Array.from(nav.querySelectorAll('a'));

    // determine active/target anchor
    let active;
    if (targetAnchor) {
      active = targetAnchor;
    } else {
      const path = location.pathname.replace(/\/$/, '');
      active = links.find(a => (new URL(a.href, location.origin)).pathname.replace(/\/$/, '') === path) || links[0];
    }
    links.forEach(a => a.classList.toggle('active', a === active));

    const rect = active.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    // compute center position
    const centerX = rect.left + rect.width / 2 - navRect.left;

    if (burst && targetAnchor) {
      // shrink via scaleX and move center simultaneously
      const shrinkFactor = 0.45; // scaleX factor during shrink
      // set center position (left = centerX)
      underline.style.transition = 'left 360ms cubic-bezier(.25,.8,.25,1), transform 120ms ease-out';
      underline.style.left = centerX + 'px';
      // set width to full size so scaling is symmetric
      underline.style.width = rect.width + 'px';
      // apply shrink using transform: translateX(-50%) scaleX(shrinkFactor)
      underline.style.transform = `translateX(-50%) scaleX(${shrinkFactor})`;

      // expand back to full scale
      setTimeout(() => {
        underline.style.transition = 'transform 420ms cubic-bezier(.2, .0, .2, 1)';
        underline.style.transform = 'translateX(-50%) scaleX(1)';
        // add glow during expand
        underline.classList.add('nav-underline--glow');
        // remove glow after expand animation
        setTimeout(() => underline.classList.remove('nav-underline--glow'), 440);
      }, 120);
    } else {
      // normal smooth move+resize: set width and center and reset transform
      underline.style.transition = 'left 280ms cubic-bezier(.2,.8,.2,1), transform 220ms cubic-bezier(.2,.8,.2,1)';
      underline.style.width = rect.width + 'px';
      underline.style.left = centerX + 'px';
      underline.style.transform = 'translateX(-50%) scaleX(1)';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await runIncludes();
    document.body.classList.add('loaded');
    setupSpaNav();
    initBackgroundStars();
    // position nav underline after includes and setup
    updateNavUnderline();
    // ensure hardware widgets initialize on first load (in case includes-loaded handlers missed)
    try { initHardwareWidgets(document); } catch (e) { /* ignore if fn not defined yet */ }
  });

  window.addEventListener('includes-loaded', () => setupSpaNav());
  window.addEventListener('includes-loaded', () => updateNavUnderline());

  // continuous falling stars background
  function initBackgroundStars() {
    if (window._backgroundInit) return;
    window._backgroundInit = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let bg = document.getElementById('site-bg');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'site-bg';
  bg.innerHTML = '<div class="cloud cloud--a"></div><div class="cloud cloud--b"></div><div class="cloud cloud--c"></div><div class="cloud cloud--d"></div><div class="cloud cloud--e"></div><div class="cloud cloud--f"></div><div class="stars"></div>';
      document.body.appendChild(bg);
    }

    const starsContainer = bg.querySelector('.stars');

  // create a pool of stars with consistent spacing and slower overall motion
  const poolSize = 36; // increase density to avoid visible gaps
  const baseDur = 36; // base duration in seconds (slower)
  const durVariance = 0.12; // +/-12% small variation to retain consistent spacing
    const starState = [];
    for (let i = 0; i < poolSize; i++) {
      const s = document.createElement('div');
      s.className = 'site-star' + (Math.random() > 0.78 ? ' purple' : '');
      // horizontal position across viewport
      s.style.left = (Math.random() * 100) + 'vw';

  // assign duration (slow, with small variation)
  const fallDur = baseDur * (1 + (Math.random() * durVariance * 2 - durVariance)); // baseDur +/- durVariance

  // spread phases evenly using a global normalized offset so stars are uniformly distributed
  const globalOffset = i / poolSize; // 0..1
  // minimal jitter to keep things organic but avoid corridors
  const jitter = (Math.random() * 0.03 - 0.015) * fallDur; // +/-1.5% of dur
  const phase = globalOffset * fallDur + jitter;

      // twinkle timings
      const twinkleDur = 3 + Math.random() * 3; // 3s - 6s for twinkle
      const twinkleDelay = Math.random() * 4;
      s.classList.add('anim', 'twinkle');

      // horizontal drift
      const drift = (Math.random() * 160 - 80).toFixed(1) + 'px';
      s.style.setProperty('--drift', drift);

  // map speed (dur) to brightness/opacity: faster (smaller dur) => lighter (higher opacity)
  // overall make stars darker by lowering opacity range
  const minOpacity = 0.04; // slowest star opacity (darker)
  const maxOpacity = 0.14; // fastest star opacity (still subtle)
  // speedNormalized: faster stars have smaller duration, so invert mapping
  const speedNormalized = 1 - ((fallDur - baseDur * (1 - durVariance)) / (baseDur * (2 * durVariance))); // 0..1 where 1 ~ fastest
  const clampedSpeed = Math.max(0, Math.min(1, speedNormalized));
  const alpha = (minOpacity + (maxOpacity - minOpacity) * clampedSpeed).toFixed(3);
  s.style.opacity = alpha;
  // tweak box-shadow to match brightness (subtle and darker overall)
  const shadowAlpha = (0.08 + 0.32 * clampedSpeed).toFixed(3); // 0.08..0.4
  s.style.boxShadow = `0 0 ${6 + 6 * clampedSpeed}px rgba(255,255,255,${shadowAlpha})`;
  // set background alpha so color follows brightness
  const bgAlpha = (0.36 + 0.4 * clampedSpeed).toFixed(3); // 0.36..0.76
  s.style.background = `rgba(255,255,255,${bgAlpha})`;

      // configure twinkle animation parameters via inline properties
      s.style.animationDuration = `${twinkleDur}s`;
      s.style.animationDelay = `-${twinkleDelay}s`;
      s.style.animationTimingFunction = 'ease-in-out';
      s.style.animationIterationCount = 'infinite';
      s.style.animationFillMode = 'both';

      // append element
      starsContainer.appendChild(s);

      // store star state for rAF-driven vertical motion
      starState.push({ el: s, dur: fallDur, phase, drift: parseFloat(drift) });
    }

    // when a section change finishes, briefly give the bg an 'active' state for smooth change
    window.addEventListener('section-change-end', () => {
      // persistent variant rotation
      const variants = 3;
      const cur = Array.from(bg.classList).find(c => c.startsWith('variant-'));
      let next = 0;
      if (cur) {
        const v = parseInt(cur.split('-')[1], 10);
        next = (v + 1) % variants;
        bg.classList.remove(cur);
      }
      bg.classList.add('variant-' + next);
  // (no transient star burst here — continuous stars remain active all the time)
      // brief active pulse as well
      bg.classList.remove('active'); // reset
      void bg.offsetWidth;
      bg.classList.add('active');
      setTimeout(() => bg.classList.remove('active'), 560);
    });

    // JS-driven primary loop to animate vertical motion of stars so they always fall
    let rafStart = null;
    const minVisible = 8; // guarantee at least this many stars are visible on screen
    function rafLoop(ts) {
      if (!rafStart) rafStart = ts;
      const now = (ts - rafStart) / 1000; // seconds since loop start
      const h = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      const visRangeTop = -0.12 * h;
      const visRangeBottom = 1.0 * h; // visible roughly 0..h (bottom threshold)

      // first compute positions and track visibility
      let visibleCount = 0;
      const positions = starState.map(s => {
        const localRaw = now + (s.phase || 0);
        const local = ((localRaw % s.dur) + s.dur) % s.dur; // 0..dur
        const progress = local / s.dur; // 0..1
        const y = -0.12 * h + progress * (h + 1.6 * h);
        const visible = (y >= visRangeTop && y <= visRangeBottom);
        if (visible) visibleCount++;
        return { s, y, visible, local };
      });

      // if we have too few visible stars, nudge some off-screen stars forward so they enter view
      if (visibleCount < minVisible) {
        const need = minVisible - visibleCount;
        // pick candidates that are just above or below view and advance their phase slightly
        const candidates = positions.filter(p => !p.visible).sort((a, b) => {
          // prefer those closest to the viewport edge (min distance)
          const da = Math.min(Math.abs(a.y - visRangeTop), Math.abs(a.y - visRangeBottom));
          const db = Math.min(Math.abs(b.y - visRangeTop), Math.abs(b.y - visRangeBottom));
          return da - db;
        });
        for (let i = 0; i < Math.min(need, candidates.length); i++) {
          const cand = candidates[i];
          // advance their phase by a small fraction of their duration to bring them into view smoothly
          const advance = (0.08 + Math.random() * 0.06) * cand.s.dur; // 8-14% of dur
          cand.s.phase = ((cand.s.phase || 0) + advance) % cand.s.dur;
        }
      }

      // apply transforms for all stars
      positions.forEach(p => {
        p.s.el.style.transform = `translateX(${p.s.drift}px) translateY(${p.y}px) scale(1)`;
      });

      requestAnimationFrame(rafLoop);
    }
    requestAnimationFrame(rafLoop);
  }

  // JS fallback: animate a star element if CSS animations aren't running
  function startStarFallback(el, fallDur, drift) {
    const vw = () => Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const totalTravel = vw() + 160; // in vh-ish units; we'll map to px
    const startTop = (parseFloat(el.style.top) || 0) / 100 * vw();
    const driftPx = parseFloat(drift || '0');
    let start = null;
    function loop(ts) {
      if (!start) start = ts;
      const t = (ts - start) / 1000; // seconds
      const progress = (t % fallDur) / fallDur; // 0..1 repeating
      const y = -0.12 * vw() + progress * (vw() + 1.6 * vw());
      el.style.transform = `translateX(${driftPx}px) translateY(${y}px) scale(1)`;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // no transient spawn function — stars are continuous and always active

  // hardware widgets: simple carousel/toggles for the hardware cards
  function initHardwareWidgets(container = document) {
    const carousels = container.querySelectorAll('[data-widget="carousel"]');
    carousels.forEach(root => {
      const items = Array.from(root.querySelectorAll('.hw-item'));
      if (!items.length) return;
      let idx = 0;
      const prev = root.querySelector('.hw-prev');
      const next = root.querySelector('.hw-next');
      function show(i) {
        items.forEach(it => it.hidden = true);
        const el = items[i];
        if (el) el.hidden = false;
      }
      show(idx);
      prev && prev.addEventListener('click', () => {
        idx = (idx - 1 + items.length) % items.length;
        show(idx);
      });
      next && next.addEventListener('click', () => {
        idx = (idx + 1) % items.length;
        show(idx);
      });
    });
  }

  // initialize hardware widgets after includes are loaded (so the footer/header exists)
  window.addEventListener('includes-loaded', () => initHardwareWidgets(document));

})();
