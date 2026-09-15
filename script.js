/* Qiongkura · personal space
   章节切换 / 指示器 / 悬停预览 / 声波绘制
   所有效果都是渐进增强：脚本失效时页面仍可正常滚动与浏览。 */
(() => {
  const doc = document;

  const sections = Array.from(doc.querySelectorAll('[data-section]'));
  if (!sections.length) return;

  const navLinks = Array.from(doc.querySelectorAll('.nav-link[href^="#"]'));
  const indexItems = Array.from(doc.querySelectorAll('.index-item'));
  const menuToggle = doc.querySelector('.menu-toggle');
  const nav = doc.getElementById('primary-nav');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let current = 0;
  let wheelLocked = false;
  let wheelTimer = null;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const behavior = () => (reduced.matches ? 'auto' : 'smooth');

  /* ------------------------------------------------------------ 章节切换 */

  const applyActive = (index) => {
    current = index;
    const id = sections[index] ? sections[index].id : '';

    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
    });
    indexItems.forEach((item, i) => {
      const active = i === index;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });

    if (id && window.location.hash !== `#${id}`) {
      history.replaceState(null, '', `#${id}`);
    }
  };

  const goTo = (index) => {
    const next = clamp(index, 0, sections.length - 1);
    closeMenu();
    applyActive(next);
    sections[next].scrollIntoView({ behavior: behavior(), block: 'start' });
  };

  const step = (delta) => goTo(current + delta);

  /* 滚动位置跟踪：以viewport中部为准，兼容超出屏幕高度的章节 */
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = sections.indexOf(entry.target);
          if (index >= 0 && index !== current) applyActive(index);
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    sections.forEach((section) => spy.observe(section));
  }

  /* 锚点链接统一走 goTo，避免和 scroll-snap 打架 */
  Array.from(doc.querySelectorAll('a[href^="#"]')).forEach((link) => {
    const target = doc.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const index = sections.indexOf(target);
      if (index >= 0) goTo(index);
      else target.scrollIntoView({ behavior: behavior(), block: 'start' });
    });
  });

  /* --------------------------------------------------------------- 滚轮 */

  const hasOwnScroll = (node) => {
    let el = node instanceof Element ? node : null;
    while (el && el !== doc.body) {
      const style = window.getComputedStyle(el);
      const scrollable = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 4;
      if (scrollable) return true;
      el = el.parentElement;
    }
    return false;
  };

  const wheelEnabled = () =>
    !reduced.matches && window.matchMedia('(min-width: 981px)').matches;

  /* 章节高于视口时，先让用户在章节内部读完，再在边界处翻到下一章 */
  const sectionFitsViewport = () => {
    const rect = sections[current].getBoundingClientRect();
    return rect.height <= window.innerHeight + 8;
  };

  const atSectionEdge = (direction) => {
    const rect = sections[current].getBoundingClientRect();
    if (direction > 0) return rect.bottom <= window.innerHeight + 8;
    return rect.top >= -8;
  };

  window.addEventListener(
    'wheel',
    (event) => {
      if (!wheelEnabled() || event.ctrlKey || event.metaKey) return;
      if (Math.abs(event.deltaY) < 4) return;
      if (hasOwnScroll(event.target)) return;

      const direction = event.deltaY > 0 ? 1 : -1;

      if (!sectionFitsViewport() && !atSectionEdge(direction)) return;

      event.preventDefault();
      if (wheelLocked) return;

      const next = clamp(current + direction, 0, sections.length - 1);
      if (next === current) return;

      wheelLocked = true;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelLocked = false;
      }, 720);

      goTo(next);
    },
    { passive: false }
  );

  /* -------------------------------------------------------------- 键盘 */

  const isTyping = (node) => {
    const el = node instanceof Element ? node : null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  };

  window.addEventListener('keydown', (event) => {
    if (isTyping(event.target)) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'PageDown':
        event.preventDefault();
        step(1);
        break;
      case 'ArrowUp':
      case 'PageUp':
        event.preventDefault();
        step(-1);
        break;
      case 'Home':
        event.preventDefault();
        goTo(0);
        break;
      case 'End':
        event.preventDefault();
        goTo(sections.length - 1);
        break;
      case 'Escape':
        closeMenu();
        break;
      default:
        break;
    }
  });

  /* ---------------------------------------------------------- 移动端菜单 */

  function closeMenu() {
    if (!menuToggle || !nav) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });

    doc.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || menuToggle.contains(event.target)) return;
      closeMenu();
    });
  }

  /* --------------------------------------------------------- 进入视口动画 */

  const revealItems = Array.from(doc.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window) {
    const revealer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );
    revealItems.forEach((item) => revealer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }
  /* 兜底：即使观察器没有触发，也保证内容可见 */
  setTimeout(() => revealItems.forEach((item) => item.classList.add('is-visible')), 2500);

  /* -------------------------------------------------------------- 视差 */

  const parallaxItems = Array.from(doc.querySelectorAll('[data-parallax]'));
  let parallaxFrame = null;

  const drawParallax = () => {
    parallaxFrame = null;
    const disabled = reduced.matches || window.innerWidth < 981;
    parallaxItems.forEach((item) => {
      if (disabled) {
        item.style.transform = '';
        return;
      }
      const rect = item.getBoundingClientRect();
      const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      const depth = parseFloat(item.dataset.parallax) || 0;
      const shift = clamp(progress, -1, 1) * depth * -1 * window.innerHeight;
      item.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
    });
  };

  if (parallaxItems.length) {
    window.addEventListener(
      'scroll',
      () => {
        if (parallaxFrame !== null) return;
        parallaxFrame = requestAnimationFrame(drawParallax);
      },
      { passive: true }
    );
    window.addEventListener('resize', drawParallax);
    drawParallax();
  }

  /* ------------------------------------------------------- 作品悬停预览 */

  const workRows = Array.from(doc.querySelectorAll('.work-row'));
  const workPanels = Array.from(doc.querySelectorAll('.work-panel'));

  if (workRows.length && workPanels.length) {
    const showWork = (index) => {
      workRows.forEach((row, i) => row.classList.toggle('is-active', i === index));
      workPanels.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
    };

    workRows.forEach((row, index) => {
      row.addEventListener('mouseenter', () => showWork(index));
      row.addEventListener('focus', () => showWork(index));
      row.addEventListener('touchstart', () => showWork(index), { passive: true });
    });

    showWork(0);
  }

  /* --------------------------------------------------------- 声波绘制 */

  const canvas = doc.querySelector('#waveform canvas');

  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    let height = 66;
    let width = 520;
    let frame = null;
    let running = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(canvas.clientWidth || 520, 120);
      height = Math.max(canvas.clientHeight || 66, 40);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.beginPath();

      const mid = height / 2;
      const amp = height * 0.34;
      const t = reduced.matches ? 0 : time;

      for (let x = 0; x <= width; x += 2) {
        const p = x / width;
        const envelope = Math.sin(Math.PI * p);
        const y =
          mid +
          Math.sin(p * Math.PI * 6 + t * 0.0011) * amp * envelope * 0.72 +
          Math.sin(p * Math.PI * 17 - t * 0.0016) * amp * envelope * 0.26;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    };

    const loop = (time) => {
      if (!running) return;
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduced.matches) return;
      running = true;
      frame = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };

    resize();
    draw(0);
    window.addEventListener('resize', () => {
      resize();
      draw(0);
    });

    const hifi = doc.getElementById('hifi');
    if (hifi && 'IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
        },
        { threshold: 0.1 }
      ).observe(hifi);
    } else {
      start();
    }

    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) stop();
      else start();
    });

    if (typeof reduced.addEventListener === 'function') {
      reduced.addEventListener('change', () => {
        if (reduced.matches) {
          stop();
          draw(0);
        } else {
          start();
        }
      });
    }
  }

  /* ------------------------------------------------------------- 年份 */

  const year = doc.getElementById('current-year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* 支持直接带 hash 打开，例如 qiongkura.xyz/#projects */
  const initialIndex = sections.findIndex((section) => `#${section.id}` === window.location.hash);
  if (initialIndex > 0) {
    applyActive(initialIndex);
    sections[initialIndex].scrollIntoView({ behavior: 'auto', block: 'start' });
  } else {
    applyActive(0);
  }
})();
