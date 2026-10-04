(function () {
  const loadedScripts = new Set(
    Array.from(document.scripts)
      .map(script => script.src)
      .filter(Boolean)
  );
  const appScriptUrl = new URL('/js/app.js', location.origin).href;
  const themeStorageKey = 'jellybean-theme';

  function cleanPageUrl(value) {
    const url = new URL(value, location.href);
    if (url.origin !== location.origin) return url.href;

    // GitHub Pages serves section directories; display their clean URLs.
    url.pathname = url.pathname.replace(/\/index\.html$/, '/');
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '');
    return url.pathname + url.search + url.hash;
  }

  const initialUrl = cleanPageUrl(location.href);
  if (initialUrl !== location.pathname + location.search + location.hash) {
    history.replaceState(history.state, '', initialUrl);
  }

  applyTheme(getInitialTheme());

  function getInitialTheme() {
    try {
      const saved = localStorage.getItem(themeStorageKey);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}

    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;

    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(nextTheme === 'light'));
      toggle.title = nextTheme === 'light' ? 'switch to dark mode' : 'switch to light mode';
    }
  }

  function setupThemeToggle() {
    const toggle = document.querySelector('.theme-toggle');
    if (!toggle || toggle.dataset.themeReady === 'true') return;
    toggle.dataset.themeReady = 'true';
    applyTheme(document.documentElement.dataset.theme);

    toggle.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try {
        localStorage.setItem(themeStorageKey, next);
      } catch (e) {}
    });
  }

  function absoluteUrl(value, base = location.href) {
    return new URL(value, base).href;
  }

  function dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (e) {
      const event = document.createEvent('Event');
      event.initEvent(name, true, true);
      event.detail = detail;
      window.dispatchEvent(event);
    }
  }

  async function loadInclude(node) {
    const includePath = node.getAttribute('data-include');
    if (!includePath) return;

    try {
      const res = await fetch(includePath, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`Failed to fetch ${includePath}: ${res.status}`);
      node.innerHTML = await res.text();
    } catch (err) {
      console.error(err);
      node.innerHTML = `<!-- include failed: ${err.message} -->`;
    }
  }

  async function runIncludes(container = document) {
    const nodes = Array.from(container.querySelectorAll('[data-include]'));
    await Promise.all(nodes.map(loadInclude));
    dispatch('includes-loaded');
  }

  function syncPageStyles(doc, pageUrl) {
    const current = new Set(
      Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))
        .map(link => link.href)
    );

    doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach(link => {
      const href = absoluteUrl(link.getAttribute('href'), pageUrl);
      if (current.has(href)) return;

      const next = document.createElement('link');
      next.rel = 'stylesheet';
      next.href = href;
      document.head.appendChild(next);
      current.add(href);
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  async function syncPageScripts(doc, pageUrl) {
    const scripts = Array.from(doc.querySelectorAll('script[src]'))
      .map(script => absoluteUrl(script.getAttribute('src'), pageUrl))
      .filter(src => src !== appScriptUrl);

    for (const src of scripts) {
      if (loadedScripts.has(src)) continue;
      await loadScript(src);
      loadedScripts.add(src);
    }
  }

  function initPageWidgets(container = document) {
    if (typeof initProjectsPagination === 'function') {
      initProjectsPagination(container);
    }
  }

  async function navigateTo(url, opts = {}) {
    try {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      url = cleanPageUrl(url);
      const pageUrl = absoluteUrl(url);
      const res = await fetch(pageUrl);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const newMain = doc.querySelector('main');
      const oldMain = document.querySelector('main');

      if (!newMain || !oldMain) {
        if (!opts.replace) location.href = url;
        return;
      }

      syncPageStyles(doc, pageUrl);

      oldMain.style.transition = 'opacity 180ms ease';
      oldMain.style.opacity = '0';
      await new Promise(resolve => setTimeout(resolve, 180));

      oldMain.className = newMain.className;
      oldMain.innerHTML = newMain.innerHTML;
      oldMain.style.opacity = '1';

      const newTitle = doc.querySelector('title');
      if (newTitle) document.title = newTitle.textContent;

      if (opts.replace) {
        history.replaceState({}, '', url);
      } else {
        history.pushState({}, '', url);
      }

      await runIncludes(oldMain);
      await syncPageScripts(doc, pageUrl);
      initPageWidgets(oldMain);

      try {
        window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      } catch (e) {
        window.scrollTo(0, scrollY);
      }
    } catch (err) {
      console.error(err);
      location.href = url;
    }
  }

  function setupSpaNav() {
    const header = document.querySelector('header');
    if (!header || header.dataset.navReady === 'true') return;
    header.dataset.navReady = 'true';

    header.addEventListener('click', async (e) => {
      const anchor = e.target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();

      const nav = document.querySelector('.site-nav');
      let matchingNavAnchor = null;
      if (nav) {
        const navLinks = Array.from(nav.querySelectorAll('a'));
        const targetPath = absoluteUrl(href).replace(/\/$/, '');
        matchingNavAnchor = navLinks.find(link => link.href.replace(/\/$/, '') === targetPath) || null;
      }

      updateNavUnderline(true, matchingNavAnchor);
      dispatch('section-change-start', { href });
      await navigateTo(href);
      dispatch('section-change-end', { href });
      updateNavUnderline(false);
    });

    window.addEventListener('popstate', () => {
      const url = location.pathname + location.search + location.hash;
      navigateTo(url, { replace: true }).then(() => updateNavUnderline());
    });
  }

  function updateNavUnderline(burst = false, targetAnchor = null) {
    const nav = document.querySelector('.site-nav');
    const underline = nav && nav.querySelector('.nav-underline');
    if (!nav || !underline) return;

    const links = Array.from(nav.querySelectorAll('a'));
    const currentPath = location.pathname.replace(/\/$/, '');
    const active = targetAnchor ||
      links.find(link => new URL(link.href, location.origin).pathname.replace(/\/$/, '') === currentPath) ||
      links[0];

    if (!active) return;

    links.forEach(link => link.classList.toggle('active', link === active));

    const rect = active.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 - navRect.left;

    underline.style.width = rect.width + 'px';
    underline.style.left = centerX + 'px';

    if (burst && targetAnchor) {
      underline.style.transition = 'left 360ms cubic-bezier(.25,.8,.25,1), transform 120ms ease-out';
      underline.style.transform = 'translateX(-50%) scaleX(0.45)';

      window.setTimeout(() => {
        underline.style.transition = 'transform 420ms cubic-bezier(.2, .0, .2, 1)';
        underline.style.transform = 'translateX(-50%) scaleX(1)';
        underline.classList.add('nav-underline--glow');
        window.setTimeout(() => underline.classList.remove('nav-underline--glow'), 440);
      }, 120);
      return;
    }

    underline.style.transition = 'left 280ms cubic-bezier(.2,.8,.2,1), transform 220ms cubic-bezier(.2,.8,.2,1)';
    underline.style.transform = 'translateX(-50%) scaleX(1)';
  }

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
    const poolSize = 36;
    const minVisible = 8;
    const baseDur = 36;
    const durVariance = 0.12;
    const starState = [];
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < poolSize; i++) {
      const star = document.createElement('div');
      star.className = 'site-star' + (Math.random() > 0.78 ? ' purple' : '');
      star.style.left = (Math.random() * 100) + 'vw';

      const fallDur = baseDur * (1 + (Math.random() * durVariance * 2 - durVariance));
      const phase = (i / poolSize) * fallDur + (Math.random() * 0.03 - 0.015) * fallDur;
      const drift = Math.random() * 160 - 80;
      const clampedSpeed = Math.max(0, Math.min(1, 1 - ((fallDur - baseDur * (1 - durVariance)) / (baseDur * (2 * durVariance)))));
      const alpha = (0.04 + (0.14 - 0.04) * clampedSpeed).toFixed(3);
      const shadowAlpha = (0.08 + 0.32 * clampedSpeed).toFixed(3);
      const bgAlpha = (0.36 + 0.4 * clampedSpeed).toFixed(3);

      star.classList.add('anim', 'twinkle');
      star.style.setProperty('--drift', drift.toFixed(1) + 'px');
      star.style.opacity = alpha;
      star.style.boxShadow = `0 0 ${6 + 6 * clampedSpeed}px rgba(255,255,255,${shadowAlpha})`;
      star.style.background = `rgba(255,255,255,${bgAlpha})`;
      star.style.animationDuration = `${3 + Math.random() * 3}s`;
      star.style.animationDelay = `-${Math.random() * 4}s`;

      fragment.appendChild(star);
      starState.push({ el: star, dur: fallDur, phase, drift });
    }

    starsContainer.appendChild(fragment);

    window.addEventListener('section-change-end', () => {
      const variants = 3;
      const current = Array.from(bg.classList).find(className => className.startsWith('variant-'));
      let next = 0;

      if (current) {
        next = (parseInt(current.split('-')[1], 10) + 1) % variants;
        bg.classList.remove(current);
      }

      bg.classList.add('variant-' + next);
      bg.classList.remove('active');
      void bg.offsetWidth;
      bg.classList.add('active');
      window.setTimeout(() => bg.classList.remove('active'), 560);
    });

    let rafStart = null;
    function rafLoop(ts) {
      if (document.visibilityState === 'hidden') {
        requestAnimationFrame(rafLoop);
        return;
      }

      if (!rafStart) rafStart = ts;
      const now = (ts - rafStart) / 1000;
      const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      const visibleTop = -0.12 * height;
      const visibleBottom = height;
      let visibleCount = 0;

      const positions = starState.map(star => {
        const local = (((now + star.phase) % star.dur) + star.dur) % star.dur;
        const y = -0.12 * height + (local / star.dur) * (height + 1.6 * height);
        const visible = y >= visibleTop && y <= visibleBottom;
        if (visible) visibleCount++;
        return { star, y, visible };
      });

      if (visibleCount < minVisible) {
        positions
          .filter(position => !position.visible)
          .sort((a, b) => {
            const aDistance = Math.min(Math.abs(a.y - visibleTop), Math.abs(a.y - visibleBottom));
            const bDistance = Math.min(Math.abs(b.y - visibleTop), Math.abs(b.y - visibleBottom));
            return aDistance - bDistance;
          })
          .slice(0, minVisible - visibleCount)
          .forEach(position => {
            position.star.phase = (position.star.phase + (0.08 + Math.random() * 0.06) * position.star.dur) % position.star.dur;
          });
      }

      positions.forEach(position => {
        position.star.el.style.transform = `translateX(${position.star.drift}px) translateY(${position.y}px) scale(1)`;
      });

      requestAnimationFrame(rafLoop);
    }

    requestAnimationFrame(rafLoop);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await runIncludes();
    setupSpaNav();
    setupThemeToggle();
    initBackgroundStars();
    updateNavUnderline();
    initPageWidgets(document);
    document.body.classList.add('loaded');
  });

  window.addEventListener('includes-loaded', () => {
    setupSpaNav();
    setupThemeToggle();
    updateNavUnderline();
  });

  window.addEventListener('section-change-end', () => {
    updateNavUnderline();
  });
})();
