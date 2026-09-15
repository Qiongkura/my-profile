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
  const root = doc.documentElement;

  /* -------------------------------------------------------------- 语言切换 */

  const langButtons = Array.from(doc.querySelectorAll('[data-lang-set]'));
  const langChangeHooks = [];
  const metas = {
    zh: {
      title: 'Qiongkura · 个人主页',
      description:
        'Qiongkura 的个人主页：华南农业大学电子信息工程学生，关注人工智能、软件开发、模拟赛车与音频技术。'
    },
    en: {
      title: 'Qiongkura · Personal Space',
      description:
        'Personal site of Qiongkura — an Electronic Information Engineering student into AI, software, sim racing and audio.'
    }
  };

  const applyLang = (lang) => {
    const next = lang === 'en' ? 'en' : 'zh';
    root.setAttribute('data-lang', next);
    root.setAttribute('lang', next === 'en' ? 'en' : 'zh-CN');

    if (metas[next]) {
      doc.title = metas[next].title;
      const meta = doc.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', metas[next].description);
    }

    doc.querySelectorAll('[data-alt-zh]').forEach((el) => {
      const value = next === 'en' ? el.getAttribute('data-alt-en') : el.getAttribute('data-alt-zh');
      if (value) el.setAttribute('alt', value);
    });

    doc.querySelectorAll('[data-aria-zh]').forEach((el) => {
      const value = next === 'en' ? el.getAttribute('data-aria-en') : el.getAttribute('data-aria-zh');
      if (value) el.setAttribute('aria-label', value);
    });

    langButtons.forEach((button) => {
      const on = button.getAttribute('data-lang-set') === next;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', String(on));
    });

    try {
      localStorage.setItem('qiongkura-lang', next);
    } catch (error) {
      /* 隐私模式下忽略存储失败 */
    }

    langChangeHooks.forEach((hook) => hook(next));
  };

  langButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyLang(button.getAttribute('data-lang-set'));
    });
  });

  applyLang(root.getAttribute('data-lang') || 'zh');

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
  const workBriefs = Array.from(doc.querySelectorAll('.work-brief-item'));

  if (workRows.length && workPanels.length) {
    const showWork = (index) => {
      workRows.forEach((row, i) => row.classList.toggle('is-active', i === index));
      workPanels.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
      workBriefs.forEach((item, i) => item.classList.toggle('is-active', i === index));
    };

    workRows.forEach((row, index) => {
      row.addEventListener('mouseenter', () => showWork(index));
      row.addEventListener('focus', () => showWork(index));
      row.addEventListener('touchstart', () => showWork(index), { passive: true });
    });

    showWork(0);

    /* ------------------------------------------ 作品简介：悬停 2 秒后展开 */

    const works = doc.querySelector('.works');
    const workList = doc.querySelector('.work-list');
    const workBrief = doc.querySelector('#work-brief');
    const stacked = window.matchMedia('(max-width: 900px), (max-width: 1180px) and (orientation: portrait)');
    const DWELL = 2000;

    if (works && workList && workBrief) {
      let timer = null;
      let opened = -1;
      let measured = false;

      /* 左栏收到「最长文字 + 箭头」的宽度，剩下的宽度六成给模块、四成给简介 */
      const measure = () => {
        const gap = parseFloat(window.getComputedStyle(works).columnGap) || 0;
        const total = works.clientWidth;
        const avail = Math.max(0, total - gap);
        const idle = Math.round(avail * 0.525);
        works.style.setProperty('--list-w-idle', idle + 'px');

        const wasOpen = works.classList.contains('is-open');
        if (wasOpen) works.classList.remove('is-open');

        /* 量文字本身而不是元素盒子：元素盒子会被拉伸满栏，量不出真实文字宽度 */
        const listLeft = workList.getBoundingClientRect().left;
        const range = doc.createRange();
        let textRight = 0;
        workList.querySelectorAll('.work-num, .work-name').forEach((el) => {
          const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node) {
            if (node.nodeValue && node.nodeValue.trim()) {
              range.selectNodeContents(node);
              const rect = range.getBoundingClientRect();
              if (rect.width) textRight = Math.max(textRight, rect.right - listLeft);
            }
            node = walker.nextNode();
          }
        });

        const hug = Math.round(Math.min(textRight + 56, idle));
        const rest = Math.max(0, total - gap * 2 - hug);
        /* 矮窗口里简介窄了会不停换行、把章节顶超一屏，所以让它占宽一些 */
        const share = window.matchMedia('(max-height: 820px)').matches ? 0.62 : 0.44;
        works.style.setProperty('--list-w-hug', hug + 'px');
        works.style.setProperty('--brief-w', Math.round(rest * share) + 'px');

        if (wasOpen) works.classList.add('is-open');
      };

      /* 展开只切一个类：测量放在别处做，避免在悬停那一刻触发同步重排造成顿挫 */
      const open = (index) => {
        if (stacked.matches) return;
        opened = index;
        works.classList.add('is-open');
      };

      const close = () => {
        window.clearTimeout(timer);
        timer = null;
        opened = -1;
        works.classList.remove('is-open');
      };

      workRows.forEach((row, index) => {
        row.addEventListener('mouseenter', () => {
          window.clearTimeout(timer);
          if (!measured) {
            measure();          /* 提前到悬停瞬间量，远离 2 秒后的动画，避免动画起步时强制重排 */
            measured = true;
          }
          timer = window.setTimeout(() => open(index), DWELL);
        });
        row.addEventListener('mouseleave', () => {
          if (opened === -1) window.clearTimeout(timer);
        });
        row.addEventListener('focus', () => {
          window.clearTimeout(timer);
          open(index);
        });
      });

      works.addEventListener('mouseleave', close);
      works.addEventListener('focusout', (event) => {
        if (!works.contains(event.relatedTarget)) close();
      });
      doc.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
      });

      const relayout = () => {
        if (stacked.matches) {
          close();
          measured = false;
        } else {
          measure();
          measured = true;
        }
      };
      window.addEventListener('resize', relayout);
      if (stacked.addEventListener) stacked.addEventListener('change', relayout);

      measure();
      measured = true;
    }
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

  /* ------------------------------------------------- 图片轮播（首页 / 赛车） */

  Array.from(doc.querySelectorAll('[data-slideshow]')).forEach((slideshow) => {
    const slides = Array.from(slideshow.querySelectorAll('.slide'));
    const capZh = slideshow.querySelector('[data-slide-cap-zh]');
    const capEn = slideshow.querySelector('[data-slide-cap-en]');
    const counter = slideshow.querySelector('[data-slide-count]');
    const prevBtn = slideshow.querySelector('[data-slide-prev]');
    const nextBtn = slideshow.querySelector('[data-slide-next]');
    const INTERVAL = 4800;

    let slideIndex = 0;
    let slideTimer = null;
    let slideVisible = false;
    let slidePaused = false;
    const preloaded = new Set();

    const pad = (value) => String(value).padStart(2, '0');

    const refreshCaption = () => {
      const img = slides[slideIndex];
      if (!img) return;
      const zh = img.getAttribute('data-cap-zh') || '';
      const en = img.getAttribute('data-cap-en') || zh;
      if (capZh) capZh.textContent = zh;
      if (capEn) capEn.textContent = en;
      if (counter) counter.textContent = `${pad(slideIndex + 1)} / ${pad(slides.length)}`;
    };

    const preloadNext = () => {
      const next = slides[(slideIndex + 1) % slides.length];
      const src = next && next.getAttribute('src');
      if (!src || preloaded.has(src)) return;
      preloaded.add(src);
      const image = new Image();
      image.src = src;
    };

    const showSlide = (target, restart = true) => {
      slideIndex = (target + slides.length) % slides.length;
      slides.forEach((img, i) => {
        const active = i === slideIndex;
        img.classList.toggle('is-active', active);
        img.setAttribute('aria-hidden', String(!active));
      });
      refreshCaption();
      preloadNext();
      if (restart) startSlides();
    };

    const stopSlides = () => {
      if (slideTimer !== null) clearInterval(slideTimer);
      slideTimer = null;
    };

    function startSlides() {
      stopSlides();
      if (reduced.matches || slidePaused || !slideVisible || slides.length < 2) return;
      slideTimer = setInterval(() => showSlide(slideIndex + 1, false), INTERVAL);
    }

    slideshow.addEventListener('mouseenter', () => {
      slidePaused = true;
      stopSlides();
    });
    slideshow.addEventListener('mouseleave', () => {
      slidePaused = false;
      startSlides();
    });
    slideshow.addEventListener('focusin', () => {
      slidePaused = true;
      stopSlides();
    });
    slideshow.addEventListener('focusout', () => {
      slidePaused = false;
      startSlides();
    });

    slideshow.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showSlide(slideIndex - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showSlide(slideIndex + 1);
      }
    });

    if (prevBtn) prevBtn.addEventListener('click', () => showSlide(slideIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => showSlide(slideIndex + 1));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            slideVisible = entry.isIntersecting;
            if (slideVisible) startSlides();
            else stopSlides();
          });
        },
        { threshold: 0.25 }
      ).observe(slideshow);
    } else {
      slideVisible = true;
      startSlides();
    }

    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) stopSlides();
      else startSlides();
    });

    if (typeof reduced.addEventListener === 'function') {
      reduced.addEventListener('change', () => {
        if (reduced.matches) stopSlides();
        else startSlides();
      });
    }

    langChangeHooks.push(refreshCaption);
    showSlide(0, false);
    preloadNext();
  });

  /* ------------------------------------------------------ HI-FI 试听播放 */

  const hifiAudio = doc.getElementById('hifi-audio');
  const hifiRows = Array.from(doc.querySelectorAll('[data-track]'));

  if (hifiAudio && hifiRows.length) {
    /* 音频文件没就位时的去处：打开音乐站的搜索页 */
    const SEARCH_URL = 'https://music.163.com/#/search/m/?s=';

    const tracks = hifiRows.map((row) => ({
      row,
      src: row.getAttribute('data-src'),
      query: row.getAttribute('data-query') || '',
      btn: row.querySelector('[data-pick-btn]'),
      time: row.querySelector('[data-pick-time]'),
      seek: row.querySelector('[data-pick-seek]'),
      bar: row.querySelector('[data-pick-bar]'),
      fill: row.querySelector('[data-pick-fill]'),
      knob: row.querySelector('[data-pick-knob]')
    }));

    let playing = null;

    const clock = (seconds) => {
      if (!isFinite(seconds) || seconds < 0) return '0:00';
      const whole = Math.floor(seconds);
      return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
    };

    const setButton = (track, on) => {
      const zh = `${on ? '暂停' : '播放'} ${track.query}`.trim();
      const en = `${on ? 'Pause' : 'Play'} ${track.query}`.trim();
      track.btn.textContent = on ? '❚❚' : '▶';
      track.btn.setAttribute('data-aria-zh', zh);
      track.btn.setAttribute('data-aria-en', en);
      track.btn.setAttribute('aria-label', root.getAttribute('data-lang') === 'en' ? en : zh);
      track.row.classList.toggle('is-playing', on);
    };

    const paint = (track, ratio) => {
      const clamped = Math.min(1, Math.max(0, ratio));
      const percent = `${(clamped * 100).toFixed(2)}%`;
      track.fill.style.width = percent;
      track.knob.style.left = percent;
      track.bar.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    };

    const reset = (track) => {
      setButton(track, false);
      paint(track, 0);
      track.seek.hidden = true;
      track.time.textContent = '';
    };

    const update = () => {
      if (!playing) return;
      const duration = hifiAudio.duration;
      const ratio = isFinite(duration) && duration > 0 ? hifiAudio.currentTime / duration : 0;
      paint(playing, ratio);
      playing.time.textContent = `${clock(hifiAudio.currentTime)} / ${clock(duration)}`;
    };

    const start = (track) => {
      if (playing !== track) {
        if (playing) reset(playing);
        playing = track;
        hifiAudio.src = track.src;
        track.seek.hidden = false;
      }
      const played = hifiAudio.play();
      if (played && typeof played.catch === 'function') played.catch(() => {});
    };

    const seekTo = (track, clientX) => {
      const box = track.bar.getBoundingClientRect();
      if (!box.width) return;
      const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
      const duration = hifiAudio.duration;
      if (playing === track && isFinite(duration) && duration > 0) {
        hifiAudio.currentTime = ratio * duration;
      }
      paint(track, ratio);
    };

    hifiAudio.addEventListener('play', () => { if (playing) setButton(playing, true); });
    hifiAudio.addEventListener('pause', () => { if (playing) setButton(playing, false); });
    hifiAudio.addEventListener('timeupdate', update);
    hifiAudio.addEventListener('loadedmetadata', update);
    hifiAudio.addEventListener('ended', () => { if (playing) paint(playing, 1); });

    /* 文件不存在或格式不支持时打开搜索页，避免点了没反应 */
    hifiAudio.addEventListener('error', () => {
      const track = playing;
      if (!track) return;
      playing = null;
      reset(track);
      if (track.query) window.open(SEARCH_URL + encodeURIComponent(track.query), '_blank', 'noopener');
    });

    tracks.forEach((track) => {
      track.btn.addEventListener('click', () => {
        if (playing === track && !hifiAudio.paused) hifiAudio.pause();
        else start(track);
      });

      track.bar.addEventListener('pointerdown', (event) => {
        if (playing !== track) return;
        event.preventDefault();
        track.bar.dataset.dragging = '1';
        try {
          track.bar.setPointerCapture(event.pointerId);
        } catch (error) {
          /* 指针已经释放时忽略：按 clientX 计算拖动依然成立 */
        }
        seekTo(track, event.clientX);
      });
      track.bar.addEventListener('pointermove', (event) => {
        if (track.bar.dataset.dragging !== '1') return;
        seekTo(track, event.clientX);
      });
      const releaseBar = (event) => {
        if (track.bar.dataset.dragging !== '1') return;
        delete track.bar.dataset.dragging;
        if (track.bar.hasPointerCapture(event.pointerId)) track.bar.releasePointerCapture(event.pointerId);
      };
      track.bar.addEventListener('pointerup', releaseBar);
      track.bar.addEventListener('pointercancel', releaseBar);

      track.bar.addEventListener('keydown', (event) => {
        if (playing !== track) return;
        const duration = hifiAudio.duration;
        if (!isFinite(duration) || duration <= 0) return;
        let step = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') step = 5;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') step = -5;
        else if (event.key === 'Home') step = -Infinity;
        else if (event.key === 'End') step = Infinity;
        if (step === null) return;
        event.preventDefault();
        const next = step === -Infinity ? 0 : step === Infinity ? duration : hifiAudio.currentTime + step;
        hifiAudio.currentTime = Math.min(duration, Math.max(0, next));
        update();
      });
    });
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
