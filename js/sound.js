/* Ascend: ambient sound engine.
   - Moodist loops (rain, thunder, waves, temple, singing bowl) with seamless
     crossfaded looping, per-channel volume and loudness metering
   - a binaural / isochronic brainwave generator (Web Audio oscillators)
   - master volume, sleep timer, ducking for alarms
   Exposes A.sound and feeds A.sound.levels() to the 3D scene. */
(function () {
  'use strict';
  const A = window.A;

  const CHANNELS = [
    { id: 'rain-light', name: 'Light rain', file: 'light-rain', kind: 'rainLight', hint: 'Steady, soft' },
    { id: 'rain-window', name: 'Rain on window', file: 'rain-on-window', kind: 'rainWindow', hint: 'Indoors, cosy' },
    { id: 'rain-heavy', name: 'Heavy rain', file: 'heavy-rain', kind: 'rainHeavy', hint: 'Downpour' },
    { id: 'thunder', name: 'Thunder', file: 'thunder', kind: 'thunder', hint: 'Distant storm' },
    { id: 'waves', name: 'Ocean waves', file: 'waves', kind: 'waves', hint: 'Shore, slow swell' },
    { id: 'temple', name: 'Temple', file: 'temple', kind: 'temple', hint: 'Bells and stillness' },
    { id: 'bowl', name: 'Singing bowl', file: 'singing-bowl', kind: 'bowl', hint: 'Resonant tone' },
  ];

  /* Brainwave bands. The evidence is honest: a 2019 meta-analysis (Garcia-Argibay et al.) found a
     medium overall effect (g = 0.45) on attention, memory and anxiety, but results vary by frequency,
     exposure time and timing. This is a wellness tool, not a medical device. */
  const BANDS = [
    { id: 'delta', name: 'Delta', hz: 2, range: [0.5, 4], use: 'Deep sleep', blurb: 'Slow waves linked with deep sleep. Best used when going to bed.' },
    { id: 'theta', name: 'Theta', hz: 6, range: [4, 8], use: 'Meditation', blurb: 'Drowsy, dreamlike state. Used for meditation and creative drifting.' },
    { id: 'alpha', name: 'Alpha', hz: 10, range: [8, 13], use: 'Calm focus', blurb: 'Relaxed wakefulness. The most studied band for reducing anxiety.' },
    { id: 'beta', name: 'Beta', hz: 18, range: [13, 30], use: 'Alert focus', blurb: 'Active thinking and concentration. Keep sessions modest to avoid tension.' },
    { id: 'gamma', name: 'Gamma', hz: 40, range: [30, 50], use: 'Attention', blurb: '40 Hz is the most researched gamma rate for attention and memory.' },
  ];
  const bandOf = (hz) => BANDS.find((b) => hz < b.range[1]) || BANDS[BANDS.length - 1];

  /* timed programs: the beat glides between steps (entrainment protocols ramp, they don't jump) */
  const PROGRAMS = [
    { id: 'focus', name: 'Focus ramp', blurb: 'Alpha to low beta over 25 min, then hold.', steps: [{ hz: 10, min: 0 }, { hz: 14, min: 4 }, { hz: 16, min: 25 }] },
    { id: 'wind', name: 'Wind down', blurb: 'Alpha to theta over 18 min.', steps: [{ hz: 11, min: 0 }, { hz: 8, min: 8 }, { hz: 5.5, min: 18 }] },
    { id: 'sleep', name: 'Sleep descent', blurb: 'Alpha to delta over 30 min.', steps: [{ hz: 10, min: 0 }, { hz: 6, min: 10 }, { hz: 3, min: 22 }, { hz: 1.8, min: 30 }] },
  ];

  const S = () => A.S.sound;
  let ctx = null;
  let master = null;
  let masterAn = null;
  let comp = null;
  const loops = {}; // id -> Loop
  const buffers = {};
  const loading = {};
  const meters = {};
  const sm = {}; // smoothed levels
  let timer = { end: 0, handle: 0 };
  let ducked = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp);
    comp.connect(ctx.destination);
    master.gain.value = S().master;
    return ctx;
  }
  const resume = () => ctx && ctx.state === 'suspended' && ctx.resume();
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, resume, { passive: true }));

  /* ---------- seamless crossfaded loop ---------- */
  class Loop {
    constructor(buffer, out) {
      this.buf = buffer;
      this.out = out;
      this.xf = Math.min(3, buffer.duration / 3);
      this.srcs = [];
      this.next = 0;
      this.timer = 0;
    }
    spawn(when, first) {
      const src = ctx.createBufferSource();
      src.buffer = this.buf;
      const g = ctx.createGain();
      const d = this.buf.duration;
      if (first) g.gain.setValueAtTime(1, when);
      else {
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(1, when + this.xf);
      }
      g.gain.setValueAtTime(1, when + d - this.xf);
      g.gain.linearRampToValueAtTime(0, when + d);
      src.connect(g);
      g.connect(this.out);
      src.start(when);
      src.stop(when + d + 0.1);
      this.srcs.push({ src, g });
      src.onended = () => (this.srcs = this.srcs.filter((s) => s.src !== src));
      this.next = when + d - this.xf;
    }
    start() {
      this.spawn(ctx.currentTime + 0.02, true);
      this.timer = setInterval(() => {
        if (ctx.currentTime > this.next - 1.2) this.spawn(this.next, false);
      }, 250);
    }
    stop() {
      clearInterval(this.timer);
      const t = ctx.currentTime;
      this.srcs.forEach(({ src, g }) => {
        try {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + 0.6);
          src.stop(t + 0.7);
        } catch (e) {}
      });
    }
  }

  async function loadBuffer(ch) {
    if (buffers[ch.id]) return buffers[ch.id];
    if (loading[ch.id]) return loading[ch.id];
    loading[ch.id] = (async () => {
      const res = await fetch(`assets/sounds/${ch.file}.mp3`);
      const arr = await res.arrayBuffer();
      const buf = await new Promise((ok, no) => ctx.decodeAudioData(arr, ok, no));
      buffers[ch.id] = buf;
      return buf;
    })();
    try {
      return await loading[ch.id];
    } finally {
      delete loading[ch.id];
      A.bus.emit('sound-change');
    }
  }

  const chById = (id) => CHANNELS.find((c) => c.id === id);

  async function play(id, vol) {
    const ch = chById(id);
    if (!ch || !ensure()) return;
    resume();
    if (vol != null) S().mix[id] = vol;
    if (!S().mix[id]) S().mix[id] = 0.6;
    if (loops[id]) return setVol(id, S().mix[id]);
    loops[id] = { pending: true };
    A.bus.emit('sound-change');
    let buf;
    try {
      buf = await loadBuffer(ch);
    } catch (e) {
      console.warn('[sound] failed to load', id, e);
      delete loops[id];
      A.ui && A.ui.toast('Could not load that sound. Check your connection.', { icon: '⚠️', kind: 'warn' });
      A.bus.emit('sound-change');
      return;
    }
    if (!loops[id] || !loops[id].pending) return; // stopped while loading
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    const lp = new Loop(buf, an);
    an.connect(gain);
    gain.connect(master);
    lp.start();
    gain.gain.setTargetAtTime(S().mix[id], ctx.currentTime, 0.6);
    loops[id] = { loop: lp, gain, an, data: new Float32Array(an.fftSize), peak: 0.05 };
    A.S.stats.ambient = 1;
    A.save(true);
    A.bus.emit('sound-change');
    A.G && A.G.checkAch && A.G.checkAch();
  }

  function stop(id) {
    const l = loops[id];
    if (!l) return;
    delete loops[id];
    if (l.loop) {
      l.gain.gain.cancelScheduledValues(ctx.currentTime);
      l.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => {
        l.loop.stop();
        try {
          l.gain.disconnect();
        } catch (e) {}
      }, 900);
    }
    A.bus.emit('sound-change');
  }

  function setVol(id, v) {
    S().mix[id] = v;
    const l = loops[id];
    if (l && l.gain) l.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.08);
    A.save(true);
  }
  const isPlaying = (id) => !!loops[id];
  const isLoading = (id) => !!(loops[id] && loops[id].pending);

  /* ---------- binaural / isochronic generator ---------- */
  const bin = { on: false, nodes: null, program: null, progTimer: 0, progStart: 0 };

  function pinkNoise() {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  }

  function binStart() {
    if (!ensure()) return;
    resume();
    if (bin.on) return;
    const B = S().binaural;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(master);
    const n = { out };
    if (B.mode === 'iso') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = B.carrier;
      const amp = ctx.createGain();
      amp.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = B.beat;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.5;
      lfo.connect(lfoG);
      lfoG.connect(amp.gain);
      osc.connect(amp);
      amp.connect(out);
      osc.start();
      lfo.start();
      Object.assign(n, { osc, lfo });
    } else {
      const l = ctx.createOscillator();
      const r = ctx.createOscillator();
      l.type = r.type = 'sine';
      l.frequency.value = B.carrier - B.beat / 2;
      r.frequency.value = B.carrier + B.beat / 2;
      const merger = ctx.createChannelMerger(2);
      const gl = ctx.createGain();
      const gr = ctx.createGain();
      gl.gain.value = gr.gain.value = 0.5;
      l.connect(gl);
      r.connect(gr);
      gl.connect(merger, 0, 0);
      gr.connect(merger, 0, 1);
      merger.connect(out);
      l.start();
      r.start();
      Object.assign(n, { l, r });
    }
    // optional pink-noise bed
    const noise = ctx.createBufferSource();
    noise.buffer = pinkNoise();
    noise.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0;
    noise.connect(ng);
    ng.connect(master);
    noise.start();
    n.noise = noise;
    n.ng = ng;
    bin.nodes = n;
    bin.on = true;
    A.S.stats.binaural = 1;
    A.G && A.G.checkAch && A.G.checkAch();
    out.gain.setTargetAtTime(B.vol * 0.55, ctx.currentTime, 0.8); // slow fade-in
    ng.gain.setTargetAtTime(B.noise * 0.35, ctx.currentTime, 0.8);
    A.bus.emit('sound-change');
  }

  function binStop() {
    if (!bin.on) return;
    clearInterval(bin.progTimer);
    bin.program = null;
    const n = bin.nodes;
    bin.on = false;
    bin.nodes = null;
    n.out.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    n.ng.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => {
      ['l', 'r', 'osc', 'lfo', 'noise'].forEach((k) => {
        try {
          n[k] && n[k].stop();
        } catch (e) {}
      });
      try {
        n.out.disconnect();
        n.ng.disconnect();
      } catch (e) {}
    }, 1500);
    A.bus.emit('sound-change');
  }

  function applyBeat(hz, ramp = 0.4) {
    const B = S().binaural;
    B.beat = hz;
    if (!bin.on) return;
    const t = ctx.currentTime;
    const n = bin.nodes;
    if (n.l) {
      n.l.frequency.setTargetAtTime(B.carrier - hz / 2, t, ramp);
      n.r.frequency.setTargetAtTime(B.carrier + hz / 2, t, ramp);
    } else n.lfo.frequency.setTargetAtTime(hz, t, ramp);
  }
  function setCarrier(hz) {
    const B = S().binaural;
    B.carrier = hz;
    if (!bin.on) return;
    const t = ctx.currentTime;
    const n = bin.nodes;
    if (n.l) {
      n.l.frequency.setTargetAtTime(hz - B.beat / 2, t, 0.1);
      n.r.frequency.setTargetAtTime(hz + B.beat / 2, t, 0.1);
    } else n.osc.frequency.setTargetAtTime(hz, t, 0.1);
  }
  function setBinVol(v) {
    S().binaural.vol = v;
    if (bin.on) bin.nodes.out.gain.setTargetAtTime(v * 0.55, ctx.currentTime, 0.1);
  }
  function setNoise(v) {
    S().binaural.noise = v;
    if (bin.on) bin.nodes.ng.gain.setTargetAtTime(v * 0.35, ctx.currentTime, 0.1);
  }
  function setMode(mode) {
    const was = bin.on;
    if (was) binStop();
    S().binaural.mode = mode;
    if (was) setTimeout(binStart, 350);
    A.save(true);
  }

  function runProgram(id) {
    const p = PROGRAMS.find((x) => x.id === id);
    if (!p) return;
    if (!bin.on) binStart();
    clearInterval(bin.progTimer);
    bin.program = { id, name: p.name, steps: p.steps };
    bin.progStart = Date.now();
    applyBeat(p.steps[0].hz, 0.2);
    const tick = () => {
      const m = (Date.now() - bin.progStart) / 60000;
      const st = p.steps;
      let hz = st[st.length - 1].hz;
      for (let i = 0; i < st.length - 1; i++) {
        if (m >= st[i].min && m < st[i + 1].min) {
          const k = (m - st[i].min) / (st[i + 1].min - st[i].min);
          hz = st[i].hz + (st[i + 1].hz - st[i].hz) * k;
          break;
        }
      }
      applyBeat(Math.round(hz * 10) / 10, 1.2);
      A.bus.emit('sound-tick');
    };
    bin.progTimer = setInterval(tick, 4000);
    tick();
    A.bus.emit('sound-change');
  }
  function stopProgram() {
    clearInterval(bin.progTimer);
    bin.program = null;
    A.bus.emit('sound-change');
  }

  /* ---------- master, timer, ducking ---------- */
  function setMaster(v) {
    S().master = v;
    if (master) master.gain.setTargetAtTime(ducked ? v * 0.22 : v, ctx.currentTime, 0.1);
    A.save(true);
  }
  function duck(on) {
    ducked = on;
    if (master) master.gain.setTargetAtTime(on ? S().master * 0.22 : S().master, ctx.currentTime, 0.2);
  }
  function setTimer(min) {
    clearInterval(timer.handle);
    timer.end = min ? Date.now() + min * 60000 : 0;
    if (min) {
      timer.handle = setInterval(() => {
        const left = timer.end - Date.now();
        if (left <= 0) {
          clearInterval(timer.handle);
          timer.end = 0;
          stopAll();
        } else if (left < 20000 && master) master.gain.setTargetAtTime(S().master * (left / 20000) * 0.9, ctx.currentTime, 0.5);
        A.bus.emit('sound-tick');
      }, 1000);
    }
    A.bus.emit('sound-change');
  }
  function stopAll() {
    Object.keys(loops).forEach(stop);
    binStop();
    if (master) setTimeout(() => master.gain.setTargetAtTime(S().master, ctx.currentTime, 0.2), 1600);
    A.bus.emit('sound-change');
  }
  const anyPlaying = () => Object.keys(loops).length > 0 || bin.on;

  /* ---------- presets (mixes) ---------- */
  const MIXES = [
    { id: 'study', name: 'Rainy study', mix: { 'rain-window': 0.55, 'rain-light': 0.25 }, bin: { beat: 10, vol: 0.35 } },
    { id: 'storm', name: 'Storm night', mix: { 'rain-heavy': 0.6, thunder: 0.55, waves: 0.2 } },
    { id: 'temple', name: 'Temple dawn', mix: { temple: 0.7, bowl: 0.4 }, bin: { beat: 6, vol: 0.3 } },
    { id: 'shore', name: 'Quiet shore', mix: { waves: 0.7, 'rain-light': 0.15 } },
  ];
  async function loadMix(m) {
    stopAll();
    await new Promise((r) => setTimeout(r, 300));
    Object.entries(m.mix).forEach(([id, v]) => play(id, v));
    if (m.bin) {
      S().binaural.vol = m.bin.vol;
      S().binaural.beat = m.bin.beat;
      binStart();
    }
  }

  /* ---------- metering for the 3D scene ---------- */
  const LV = { rainLight: 0, rainWindow: 0, rainHeavy: 0, thunder: 0, thunderPulse: 0, waves: 0, temple: 0, templePulse: 0, bowl: 0, bowlPulse: 0, beatOn: false, beatHz: 10 };
  let lastMeter = 0;
  const damp = (a, b, k) => a + (b - a) * k;
  function levels() {
    const now = performance.now();
    if (now - lastMeter < 30) return LV;
    lastMeter = now;
    const m = S().master;
    CHANNELS.forEach((ch) => {
      const l = loops[ch.id];
      const target = l && l.gain ? S().mix[ch.id] * m : 0;
      LV[ch.kind] = damp(LV[ch.kind], target, 0.12);
      if (l && l.an && (ch.kind === 'thunder' || ch.kind === 'temple' || ch.kind === 'bowl')) {
        l.an.getFloatTimeDomainData(l.data);
        let s = 0;
        for (let i = 0; i < l.data.length; i++) s += l.data[i] * l.data[i];
        const rms = Math.sqrt(s / l.data.length);
        l.peak = Math.max(l.peak * 0.9995, rms, 0.02);
        const pulse = Math.min(1, rms / l.peak) * (target > 0.02 ? 1 : 0);
        const key = ch.kind + 'Pulse';
        LV[key] = pulse > LV[key] ? pulse : damp(LV[key], pulse, 0.25);
      } else if (ch.kind === 'thunder' || ch.kind === 'temple' || ch.kind === 'bowl') LV[ch.kind + 'Pulse'] = damp(LV[ch.kind + 'Pulse'], 0, 0.2);
    });
    LV.beatOn = bin.on;
    LV.beatHz = S().binaural.beat;
    return LV;
  }

  A.sound = {
    CHANNELS, BANDS, PROGRAMS, MIXES, bandOf,
    play, stop, setVol, isPlaying, isLoading, stopAll, anyPlaying,
    toggle: (id) => (isPlaying(id) ? stop(id) : play(id)),
    binaural: { start: binStart, stop: binStop, setBeat: applyBeat, setCarrier, setVol: setBinVol, setNoise, setMode, runProgram, stopProgram, get on() { return bin.on; }, get program() { return bin.program; }, get progMinutes() { return bin.program ? (Date.now() - bin.progStart) / 60000 : 0; } },
    setMaster, duck, setTimer, loadMix, levels,
    get timerLeft() { return timer.end ? Math.max(0, timer.end - Date.now()) : 0; },
    get count() { return Object.keys(loops).length + (bin.on ? 1 : 0); },
    get analyser() { return null; },
  };
})();
