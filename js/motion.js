/* Ascend: motion layer.
   Lenis inertial scroll, GSAP choreography, custom cursor, magnetic buttons,
   tilt cards, word-mask text reveals, route curtain and the intro. */
(function () {
  'use strict';
  const A = window.A;
  const $ = A.$;
  const $$ = A.$$;
  const gsap = window.gsap;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const M = (A.motion = {});
  M.ok = !!gsap && !reduced;

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  M.lenis = () => lenis;
  M.initScroll = () => {
    if (!M.ok || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, touchMultiplier: 1.3, smoothWheel: true });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.on('scroll', (e) => A.bus.emit('scroll', e.scroll));
  };
  M.lock = (on) => lenis && (on ? lenis.stop() : lenis.start());
  M.scrollTo = (y, immediate) => (lenis ? lenis.scrollTo(y, { immediate: !!immediate, duration: 1.2 }) : window.scrollTo(0, y));

  /* ---------- cursor ---------- */
  M.initCursor = () => {
    if (!fine || !gsap || !A.S.settings.cursor) return;
    const c = $('#cursor');
    const dot = $('.dot', c);
    const ring = $('.ring', c);
    document.documentElement.classList.add('has-cursor');
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let rx = x;
    let ry = y;
    addEventListener('pointermove', (e) => {
      x = e.clientX;
      y = e.clientY;
      c.classList.remove('hide');
      if (document.documentElement.dataset.theme === 'rose' && A.fx) A.fx.trail(x, y);
    }, { passive: true });
    document.addEventListener('pointerleave', () => c.classList.add('hide'));
    addEventListener('pointerdown', () => c.classList.add('down'));
    addEventListener('pointerup', () => c.classList.remove('down'));
    document.addEventListener('pointerover', (e) => {
      const hot = e.target.closest && e.target.closest('a, button, [data-act], input, select, textarea, .cell[data-d], .note-head, .check');
      c.classList.toggle('hot', !!hot);
    });
    gsap.ticker.add(() => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      dot.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;
    });
  };

  /* ---------- magnetic buttons + tilt cards ---------- */
  M.initInteractions = () => {
    if (!gsap || reduced || !fine) return;
    let mag = null;
    document.addEventListener('pointermove', (e) => {
      const t = e.target.closest && e.target.closest('.btn.primary, .btn.lg, [data-magnetic]');
      if (mag && mag !== t) {
        gsap.to(mag, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
        mag = null;
      }
      if (t) {
        mag = t;
        const r = t.getBoundingClientRect();
        gsap.to(t, { x: (e.clientX - (r.left + r.width / 2)) * 0.22, y: (e.clientY - (r.top + r.height / 2)) * 0.3, duration: 0.4, ease: 'power3.out' });
      }
    }, { passive: true });

    let tilt = null;
    document.addEventListener('pointermove', (e) => {
      const rose = document.documentElement.dataset.theme === 'rose';
      const t = e.target.closest && e.target.closest(rose ? '[data-tilt], .panels .card, .shop-item, .quest-card, .alarm-card, .trophy' : '[data-tilt]');
      if (tilt && tilt !== t) {
        gsap.to(tilt, { rotationX: 0, rotationY: 0, duration: 1.1, ease: 'elastic.out(1, 0.5)' });
        tilt = null;
      }
      if (t) {
        tilt = t;
        const r = t.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(t, { rotationY: px * 9, rotationX: -py * 9, transformPerspective: 1000, transformOrigin: 'center', duration: 0.5, ease: 'power2.out' });
      }
    }, { passive: true });
  };

  /* ---------- word-mask split ---------- */
  M.split = (el) => {
    if (!el || el.dataset.split) return [];
    el.dataset.split = '1';
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) frag.appendChild(document.createTextNode(' '));
            else {
              const w = document.createElement('span');
              w.className = 'w';
              w.innerHTML = `<span class="wi">${tok}</span>`;
              frag.appendChild(w);
            }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          if (n.tagName === 'EM') n.setAttribute('data-split-em', '');
          walk(n);
        }
      });
    };
    walk(el);
    return $$('.wi', el);
  };

  /* ---------- reveals ---------- */
  const SEL = '.page-head > .eyebrow, .page-head > .sub, .page-head > .btn, .tile, .quest, .card, .section-head, .quest-card, .alarm-card, .trophy, .shop-item, .mini-month, .seg, .board, .heat-scroll, [data-reveal]';
  let io = null;
  M.enter = (root, delay = 0) => {
    if (!gsap || reduced) return;
    // headline words
    $$('.page-head h1, .hero h1, [data-split]', root).forEach((h) => {
      const words = M.split(h);
      gsap.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.07, delay: delay + 0.05 });
    });
    const all = $$(SEL, root);
    const els = all.filter((el) => !all.some((o) => o !== el && o.contains(el)));
    const vh = innerHeight;
    const now = [];
    const later = [];
    els.forEach((el) => (el.getBoundingClientRect().top < vh * 1.05 ? now : later).push(el));
    gsap.set(els, { opacity: 0, y: 34 });
    gsap.to(now, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: { each: 0.055, amount: 0.7 }, delay: delay + 0.12, clearProps: 'transform,opacity' });
    if (later.length) {
      io && io.disconnect();
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          gsap.to(en.target, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', clearProps: 'transform,opacity' });
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      later.forEach((el) => io.observe(el));
    }
  };

  /* ---------- route curtain ---------- */
  M.curtain = (mid) =>
    new Promise((resolve) => {
      if (!M.ok) {
        mid();
        return resolve();
      }
      const cols = $$('#curtain i');
      gsap.killTweensOf(cols);
      gsap.set(cols, { transformOrigin: '50% 100%' });
      gsap.to(cols, {
        scaleY: 1, duration: 0.55, ease: 'power3.inOut', stagger: { each: 0.045, from: 'edges' },
        onComplete: () => {
          mid();
          gsap.set(cols, { transformOrigin: '50% 0%' });
          gsap.to(cols, { scaleY: 0, duration: 0.65, ease: 'power3.inOut', stagger: { each: 0.045, from: 'edges' }, onComplete: resolve });
        },
      });
      setTimeout(resolve, 1800);
    });

  /* ---------- intro ---------- */
  M.intro = async (fast) => {
    const pl = $('#preloader');
    if (!pl) return;
    if (!gsap || reduced) return pl.remove();
    const word = $('.pl-word span', pl);
    const bar = $('.pl-bar i', pl);
    const t0 = performance.now();
    gsap.set(word, { yPercent: 105 });
    gsap.to(word, { yPercent: 0, duration: 1.3, ease: 'expo.out' });
    gsap.to(bar, { scaleX: 1, duration: fast ? 0.5 : 1.5, ease: 'power2.inOut' });
    await Promise.all([document.fonts ? document.fonts.ready : 0, new Promise((r) => setTimeout(r, fast ? 450 : 1500))]);
    const tl = gsap.timeline();
    tl.to(word, { yPercent: -110, duration: 0.7, ease: 'expo.in' }, 0)
      .to(bar, { opacity: 0, duration: 0.3 }, 0)
      .to(pl, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, 0.45)
      .add(() => pl.remove());
    return new Promise((r) => setTimeout(r, 650));
  };

  /* ---------- small helpers ---------- */
  M.pop = (el) => gsap && el && gsap.fromTo(el, { scale: 0.9 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)' });
  M.to = (...a) => (gsap ? gsap.to(...a) : null);
})();
