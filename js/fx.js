/* Ascend — visual effects: confetti, floating rewards, shake, glass sheen */
(function () {
  'use strict';
  const A = window.A;
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.getElementById('fx');
  const c2 = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width = Math.floor(innerWidth * dpr);
    H = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  resize();
  addEventListener('resize', A.debounce(resize, 150));

  let parts = [];
  let raf = 0;
  const PALETTE = ['#efe9df', '#d9955f', '#e6c27a', '#a9c4ae', '#9db8cc', '#c97b6b', '#f6efe4'];
  const ROSE = ['#e9c46a', '#f3d98e', '#d98aa0', '#f4bccb', '#c99a3d', '#fff3d8', '#e6b0a0'];
  const palette = () => (document.documentElement.dataset.theme === 'rose' ? ROSE : PALETTE);
  const isRose = () => document.documentElement.dataset.theme === 'rose';

  function tick() {
    c2.clearRect(0, 0, W, H);
    parts = parts.filter((p) => p.life > 0 && p.y < H + 40);
    for (const p of parts) {
      p.vy += p.g;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 1;
      c2.save();
      c2.globalAlpha = Math.min(1, p.life / 30);
      c2.translate(p.x, p.y);
      c2.rotate(p.rot);
      c2.fillStyle = p.color;
      if (p.shape === 3) {
        // four-point sparkle
        const r = p.s * 0.7;
        c2.beginPath();
        c2.moveTo(0, -r);
        c2.quadraticCurveTo(0, 0, r, 0);
        c2.quadraticCurveTo(0, 0, 0, r);
        c2.quadraticCurveTo(0, 0, -r, 0);
        c2.quadraticCurveTo(0, 0, 0, -r);
        c2.fill();
      } else if (p.shape === 0) c2.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      else if (p.shape === 1) {
        c2.beginPath();
        c2.arc(0, 0, p.s / 3, 0, 6.3);
        c2.fill();
      } else {
        c2.beginPath();
        c2.moveTo(0, -p.s / 2);
        c2.lineTo(p.s / 2.5, p.s / 2);
        c2.lineTo(-p.s / 2.5, p.s / 2);
        c2.fill();
      }
      c2.restore();
    }
    if (parts.length) raf = requestAnimationFrame(tick);
    else {
      raf = 0;
      c2.clearRect(0, 0, W, H);
    }
  }

  const fx = (A.fx = {});

  fx.confetti = ({ x = innerWidth / 2, y = innerHeight / 3, count = 90, power = 11, spread = Math.PI * 2, angle = -Math.PI / 2, colors } = {}) => {
    colors = colors || palette();
    if (!A.S.settings.confetti || reduced()) return;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = power * (0.35 + Math.random() * 0.75) * dpr;
      parts.push({
        x: x * dpr,
        y: y * dpr,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 0.2 * dpr,
        s: (4 + Math.random() * 7) * dpr,
        rot: Math.random() * 6.3,
        vr: (Math.random() - 0.5) * 0.35,
        life: 90 + Math.random() * 70,
        color: colors[(Math.random() * colors.length) | 0],
        shape: isRose() && Math.random() < 0.55 ? 3 : (Math.random() * 3) | 0,
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  };

  /* tiny gold sparkles that follow the pointer (rose theme) */
  let lastTrail = 0;
  fx.trail = (x, y) => {
    const now = performance.now();
    if (now - lastTrail < 38 || reduced()) return;
    lastTrail = now;
    for (let i = 0; i < 2; i++) {
      parts.push({
        x: (x + (Math.random() - 0.5) * 10) * dpr, y: (y + (Math.random() - 0.5) * 10) * dpr,
        vx: (Math.random() - 0.5) * 0.9 * dpr, vy: (Math.random() * 0.6 + 0.1) * dpr, g: 0.012 * dpr,
        s: (3 + Math.random() * 4) * dpr, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.2,
        life: 28 + Math.random() * 22, color: ROSE[(Math.random() * ROSE.length) | 0], shape: 3,
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  };
  fx.sparkleBurst = (x, y) => fx.confetti({ x, y, count: 60, power: 9, spread: Math.PI * 2, colors: ROSE });

  fx.rain = (ms = 2200) => {
    const t0 = performance.now();
    const step = () => {
      fx.confetti({ x: Math.random() * innerWidth, y: -10, count: 7, power: 3, spread: 1, angle: Math.PI / 2 });
      if (performance.now() - t0 < ms) setTimeout(step, 90);
    };
    step();
  };

  fx.celebrate = () => {
    fx.confetti({ x: innerWidth * 0.25, y: innerHeight * 0.75, count: 80, power: 16, spread: 0.9, angle: -Math.PI / 3 });
    fx.confetti({ x: innerWidth * 0.75, y: innerHeight * 0.75, count: 80, power: 16, spread: 0.9, angle: (-2 * Math.PI) / 3 });
    setTimeout(() => fx.rain(1600), 250);
  };

  /* Floating "+20 XP" style text anchored to a viewport point */
  fx.float = (x, y, text, cls = '') => {
    const el = document.createElement('div');
    el.className = `float-text ${cls}`;
    el.innerHTML = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  };
  fx.floatAt = (el, text, cls) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    fx.float(r.left + r.width / 2, r.top + r.height / 2, text, cls);
  };

  fx.shake = (el = document.getElementById('app')) => {
    if (reduced()) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 600);
  };
  fx.vignette = (kind = 'damage') => {
    const v = document.getElementById('damage-vignette');
    v.className = '';
    void v.offsetWidth;
    v.className = 'on ' + kind;
    setTimeout(() => (v.className = ''), 1200);
  };
  fx.vibrate = (p) => {
    try {
      // only after the user has interacted, otherwise Chrome logs an intervention
      if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p);
    } catch (e) {}
  };

  /* animate a number inside an element */
  fx.countUp = (el, to, ms = 700) => {
    if (!el) return;
    const from = parseFloat(el.dataset.v || '0') || 0;
    el.dataset.v = to;
    if (reduced() || from === to) {
      el.textContent = A.fmtNum(to);
      return;
    }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = A.fmtNum(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* Liquid glass sheen: a specular highlight that follows the pointer */
  let pending = null;
  let queued = false;
  document.addEventListener(
    'pointermove',
    (e) => {
      const g = e.target.closest && e.target.closest('.glass');
      if (!g) return;
      pending = { g, x: e.clientX, y: e.clientY };
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const p = pending;
        if (!p) return;
        const r = p.g.getBoundingClientRect();
        p.g.style.setProperty('--mx', p.x - r.left + 'px');
        p.g.style.setProperty('--my', p.y - r.top + 'px');
      });
    },
    { passive: true }
  );
})();
