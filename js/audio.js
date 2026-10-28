/* Ascend — procedural audio. No sample files: every sound is synthesized with
   the Web Audio API, so it works offline and loads instantly. */
(function () {
  'use strict';
  const A = window.A;
  let ctx = null;
  let master = null;
  let unlocked = false; // becomes true after the first user gesture
  let pendingTone = null; // alarm waiting for the browser to allow sound

  function ensure(force) {
    if (!ctx) {
      if (!unlocked && !force) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    return ctx;
  }
  const vol = () => (A.S.settings.sound ? A.S.settings.volume : 0);
  const note = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* one enveloped oscillator */
  function tone({ f = 440, t = 0, d = 0.2, type = 'sine', g = 0.25, slide = 0, attack = 0.005, force = false, out }) {
    const c = ensure();
    if (!c) return;
    const v = force ? A.S.settings.volume : vol();
    if (!v) return;
    const t0 = c.currentTime + t;
    const o = c.createOscillator();
    const e = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t0 + d);
    e.gain.setValueAtTime(0.0001, t0);
    e.gain.exponentialRampToValueAtTime(g * v, t0 + attack);
    e.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(e);
    e.connect(out || master);
    o.start(t0);
    o.stop(t0 + d + 0.05);
  }
  function noise({ t = 0, d = 0.3, g = 0.2, hp = 800 }) {
    const c = ensure();
    if (!c || !vol()) return;
    const len = Math.floor(c.sampleRate * d);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const e = c.createGain();
    e.gain.value = g * vol();
    s.connect(f);
    f.connect(e);
    e.connect(master);
    s.start(c.currentTime + t);
  }
  const arp = (notes, step, opts) => notes.forEach((m, i) => tone({ f: note(m), t: i * step, ...opts }));

  /* ---------- game sound effects ---------- */
  const SFX = {
    click: () => tone({ f: 1200, d: 0.04, type: 'triangle', g: 0.08 }),
    tab: () => tone({ f: 660, d: 0.07, type: 'sine', g: 0.1, slide: 220 }),
    pop: () => tone({ f: 520, d: 0.09, type: 'sine', g: 0.14, slide: 400 }),
    check: () => {
      arp([76, 83], 0.07, { d: 0.22, type: 'triangle', g: 0.22 });
      tone({ f: note(88), t: 0.14, d: 0.35, type: 'sine', g: 0.12 });
    },
    uncheck: () => tone({ f: 330, d: 0.15, type: 'triangle', g: 0.14, slide: -120 }),
    crit: () => {
      arp([76, 80, 83, 88, 95], 0.055, { d: 0.3, type: 'square', g: 0.1 });
      noise({ d: 0.25, g: 0.1, hp: 5000 });
    },
    coin: () => {
      tone({ f: note(88), d: 0.08, type: 'square', g: 0.07 });
      tone({ f: note(95), t: 0.07, d: 0.3, type: 'square', g: 0.07 });
    },
    level: () => {
      arp([60, 64, 67, 72, 76, 79, 84], 0.085, { d: 0.45, type: 'triangle', g: 0.22 });
      arp([72, 76, 79, 84], 0.085, { d: 0.9, type: 'sine', g: 0.1, t: 0.4 });
    },
    achievement: () => {
      arp([79, 84, 88], 0.11, { d: 0.9, type: 'sine', g: 0.2 });
      arp([91, 96], 0.11, { d: 1.1, type: 'triangle', g: 0.08, t: 0.35 });
    },
    perfect: () => {
      arp([72, 76, 79, 84, 88, 91, 96], 0.07, { d: 0.6, type: 'triangle', g: 0.2 });
      noise({ d: 0.5, g: 0.06, hp: 6000, t: 0.3 });
    },
    damage: () => {
      tone({ f: 190, d: 0.4, type: 'sawtooth', g: 0.28, slide: -140 });
      noise({ d: 0.25, g: 0.2, hp: 200 });
    },
    death: () => {
      arp([55, 53, 50, 46, 41], 0.28, { d: 1.2, type: 'sawtooth', g: 0.22 });
      tone({ f: 55, d: 2.4, type: 'sine', g: 0.35, t: 0.2 });
    },
    buy: () => {
      tone({ f: note(84), d: 0.1, type: 'square', g: 0.07 });
      tone({ f: note(91), t: 0.08, d: 0.1, type: 'square', g: 0.07 });
      tone({ f: note(96), t: 0.16, d: 0.35, type: 'square', g: 0.07 });
    },
    error: () => {
      tone({ f: 200, d: 0.14, type: 'square', g: 0.12 });
      tone({ f: 150, t: 0.14, d: 0.2, type: 'square', g: 0.12 });
    },
    chest: () => {
      noise({ d: 0.4, g: 0.12, hp: 3000 });
      arp([67, 71, 74, 79, 83, 86, 91], 0.06, { d: 0.5, type: 'triangle', g: 0.18, t: 0.2 });
    },
    boss: () => {
      tone({ f: 80, d: 0.5, type: 'sawtooth', g: 0.3, slide: -30 });
      noise({ d: 0.2, g: 0.2, hp: 400 });
    },
    victory: () => {
      arp([60, 60, 60, 64, 67, 72], 0.14, { d: 0.5, type: 'square', g: 0.12 });
      arp([72, 76, 79, 84], 0.12, { d: 1.2, type: 'triangle', g: 0.16, t: 0.9 });
    },
    focusEnd: () => arp([72, 76, 79, 84, 79, 84], 0.14, { d: 0.6, type: 'sine', g: 0.25 }),
  };
  A.sfx = (name) => {
    try {
      const f = SFX[name];
      if (f && ensure()) {
        if (ctx.state === 'suspended') ctx.resume();
        f();
      }
    } catch (e) {}
  };

  /* ---------- alarm tones ---------- */
  const TONES = {
    sunrise: { name: 'Sunrise', every: 2.4, play: () => arp([72, 76, 79, 84, 79, 76], 0.2, { d: 1.0, type: 'sine', g: 0.3, force: true }) },
    beacon: {
      name: 'Beacon',
      every: 1.0,
      play: () => {
        tone({ f: 880, d: 0.18, type: 'square', g: 0.2, force: true });
        tone({ f: 1175, t: 0.22, d: 0.18, type: 'square', g: 0.2, force: true });
      },
    },
    siren: {
      name: 'Siren',
      every: 1.6,
      play: () => {
        tone({ f: 600, d: 0.75, type: 'sawtooth', g: 0.22, slide: 500, attack: 0.05, force: true });
        tone({ f: 1100, t: 0.78, d: 0.75, type: 'sawtooth', g: 0.22, slide: -500, attack: 0.05, force: true });
      },
    },
    arcade: {
      name: 'Arcade',
      every: 1.5,
      play: () => arp([84, 88, 91, 96, 91, 88, 84], 0.09, { d: 0.12, type: 'square', g: 0.14, force: true }),
    },
    bell: {
      name: 'Temple Bell',
      every: 3,
      play: () => {
        [1, 2.76, 5.4, 8.9].forEach((r, i) => tone({ f: 330 * r, d: 2.4 / (i + 1), type: 'sine', g: 0.28 / (i + 1), force: true }));
      },
    },
    klaxon: {
      name: 'Klaxon',
      every: 0.9,
      play: () => {
        tone({ f: 140, d: 0.4, type: 'sawtooth', g: 0.3, force: true });
        tone({ f: 146, d: 0.4, type: 'sawtooth', g: 0.3, force: true });
      },
    },
  };
  A.TONES = TONES;

  let loop = null;
  A.alarmStart = (key = 'sunrise') => {
    A.alarmStop();
    if (!ensure(true)) return;
    if (ctx.state !== 'running') {
      // Autoplay policy: wait until a gesture (or resume) lets us make noise.
      pendingTone = key;
      ctx.resume().then(flush).catch(() => {});
      return;
    }
    const T = TONES[key] || TONES.sunrise;
    const fire = () => {
      try {
        T.play();
      } catch (e) {}
    };
    fire();
    loop = setInterval(fire, T.every * 1000);
  };
  A.alarmStop = () => {
    if (loop) clearInterval(loop);
    loop = null;
    pendingTone = null;
  };
  A.previewTone = (key) => {
    ensure(true);
    if (ctx && ctx.state === 'suspended') ctx.resume();
    const T = TONES[key];
    if (T) T.play();
  };

  /* Browsers block audio until a user gesture. Unlock on first interaction. */
  A.audioReady = () => !!ctx && ctx.state === 'running';
  let readyFired = false;
  function flush() {
    if (!readyFired) {
      readyFired = true;
      A.bus.emit('audio-ready');
    }
    if (pendingTone) {
      const k = pendingTone;
      pendingTone = null;
      A.alarmStart(k);
    }
  }
  const unlock = () => {
    unlocked = true;
    const c = ensure();
    if (!c) return;
    if (c.state === 'running') flush();
    else c.resume().then(flush).catch(() => {});
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));
})();
