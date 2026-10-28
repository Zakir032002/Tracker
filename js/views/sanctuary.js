/* Ascend: Sanctuary. Layered ambient sounds + brainwave generator.
   The 3D ocean behind this page is driven by whatever you play. */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon } = { esc: A.esc, icon: A.icon };
  const snd = () => A.sound;
  const S = () => A.S.sound;

  const CH_ICON = { 'rain-light': 'rain', 'rain-window': 'rain', 'rain-heavy': 'rain', thunder: 'bolt2', waves: 'waves', temple: 'bell', bowl: 'bell' };
  let offs = [];
  let vizRaf = 0;
  let uiTimer = 0;

  /* beat slider is logarithmic so the 1-12 Hz range (where most of the action is) gets the resolution */
  const hzFromPos = (v) => Math.round(0.5 * Math.pow(80, v / 100) * 10) / 10;
  const posFromHz = (hz) => (Math.log(hz / 0.5) / Math.log(80)) * 100;
  const pct = (el) => ((el.value - el.min) / (el.max - el.min)) * 100 + '%';

  function mixer() {
    const s = snd();
    const playing = s.count;
    return `<section class="card glass mixer">
      <div class="card-head"><div><p class="eyebrow">01 · Soundscape</p><h3>Layer your world</h3></div>
        ${playing ? `<button class="btn soft sm" data-act="sndStopAll" data-quiet><span>${icon('stop', 13)} Stop all</span></button>` : ''}</div>
      <div class="mix-presets">${s.MIXES.map((m) => `<button class="chip" data-act="sndMix" data-id="${m.id}" data-quiet style="cursor:pointer">${esc(m.name)}</button>`).join('')}</div>
      <div class="chan-grid">${s.CHANNELS.map((ch) => {
        const on = s.isPlaying(ch.id);
        const ld = s.isLoading(ch.id);
        const v = S().mix[ch.id] ?? 0.6;
        return `<div class="chan ${on ? 'on' : ''} ${ld ? 'loading' : ''}" data-ch="${ch.id}">
          <div class="chan-top"><div><div class="chan-name">${esc(ch.name)}</div><div class="chan-hint">${ld ? 'Loading…' : esc(ch.hint)}</div></div>
            <button class="chan-btn" data-act="sndToggle" data-id="${ch.id}" data-quiet aria-label="${on ? 'Stop' : 'Play'} ${esc(ch.name)}">${icon(on ? 'pause' : 'play', 14)}</button></div>
          <input type="range" min="0" max="1" step="0.01" value="${v}" style="--pct:${v * 100}%" data-snd-vol="${ch.id}" aria-label="${esc(ch.name)} volume">
        </div>`;
      }).join('')}</div>
      <div class="deck-foot">
        <div class="grp"><label for="snd-master">Master</label><input id="snd-master" type="range" min="0" max="1" step="0.01" value="${S().master}" style="--pct:${S().master * 100}%" data-snd-master></div>
        <div class="grp"><label>Sleep timer</label><div class="timer-chips">${[0, 15, 30, 60].map((m) => `<button data-act="sndTimer" data-m="${m}" data-quiet class="${(m === 0 && !s.timerLeft) ? 'on' : ''}">${m ? m + 'm' : 'Off'}</button>`).join('')}</div>
          <span class="mono small muted" id="timer-left">${s.timerLeft ? A.fmtDur(s.timerLeft / 1000) + ' left' : ''}</span></div>
      </div>
    </section>`;
  }

  function binaural() {
    const s = snd();
    const B = S().binaural;
    const on = s.binaural.on;
    const band = s.bandOf(B.beat);
    const L = B.carrier - B.beat / 2;
    const R = B.carrier + B.beat / 2;
    const prog = s.binaural.program;
    return `<section class="card glass binaural">
      <div class="card-head"><div><p class="eyebrow">02 · Brainwave generator</p><h3>Tune the beat</h3></div>
        <button class="btn ${on ? 'soft' : 'primary'} sm" data-act="binToggle" data-quiet><span>${icon(on ? 'stop' : 'play', 13)} ${on ? 'Stop' : 'Start session'}</span></button></div>
      <p class="headphones-note">${icon('headphones', 18)} Use stereo headphones. Binaural beats only exist when each ear hears a different tone.</p>
      <div class="bin-readout"><div class="bin-hz"><span id="bin-hz">${B.beat.toFixed(1)}</span><small>Hz</small></div>
        <div class="bin-band"><b id="bin-band">${band.name}</b><span class="eyebrow" id="bin-use">${band.use}</span></div></div>
      <canvas class="bin-viz" id="bin-viz" width="800" height="150" aria-hidden="true"></canvas>
      <div class="bin-ears"><span>Left ${L.toFixed(1)} Hz</span><span>Right ${R.toFixed(1)} Hz</span></div>
      <div class="bands">${s.BANDS.map((b) => `<button class="band ${b.id === band.id ? 'on' : ''}" data-act="binBand" data-hz="${b.hz}" data-quiet><b>${b.name}</b><small>${b.range[0]}–${b.range[1]}</small></button>`).join('')}</div>
      <p class="bin-blurb" id="bin-blurb">${esc(band.blurb)}</p>
      <div class="bin-row"><label>Beat</label><input type="range" min="0" max="100" step="0.5" value="${posFromHz(B.beat)}" style="--pct:${posFromHz(B.beat)}%" data-bin="beat"><output id="o-beat">${B.beat.toFixed(1)} Hz</output></div>
      <div class="bin-row"><label>Carrier</label><input type="range" min="100" max="500" step="5" value="${B.carrier}" style="--pct:${((B.carrier - 100) / 400) * 100}%" data-bin="carrier"><output id="o-carrier">${B.carrier} Hz</output></div>
      <div class="bin-row"><label>Volume</label><input type="range" min="0" max="1" step="0.01" value="${B.vol}" style="--pct:${B.vol * 100}%" data-bin="vol"><output>${Math.round(B.vol * 100)}%</output></div>
      <div class="bin-row"><label>Noise bed</label><input type="range" min="0" max="1" step="0.01" value="${B.noise}" style="--pct:${B.noise * 100}%" data-bin="noise"><output>${Math.round(B.noise * 100)}%</output></div>
      <div class="bin-row"><label>Mode</label><div class="seg compact"><button class="seg-btn ${B.mode === 'binaural' ? 'on' : ''}" data-act="binMode" data-m="binaural" data-quiet>Binaural</button><button class="seg-btn ${B.mode === 'iso' ? 'on' : ''}" data-act="binMode" data-m="iso" data-quiet>Isochronic</button></div></div>
      <div class="section-head" style="margin:22px 0 12px;padding-bottom:10px"><p class="eyebrow">Guided journeys · the beat glides, never jumps</p></div>
      <div class="progs">${s.PROGRAMS.map((p) => `<button class="prog ${prog && prog.id === p.id ? 'on' : ''}" data-act="binProg" data-id="${p.id}" data-quiet><b>${esc(p.name)}</b><small>${esc(p.blurb)}</small></button>`).join('')}</div>
      <p class="mono small muted" id="prog-live">${prog ? `${esc(prog.name)} · ${Math.floor(s.binaural.progMinutes)} min in` : ''}</p>
      <div class="bin-science"><b>What the research says.</b> A 2019 meta-analysis of 22 studies found a medium overall effect (g ≈ 0.45) of binaural beats on attention, memory, anxiety and pain, but it depends on the frequency, how long you listen, and whether you listen before or during the task. Later work on memory and attention is more mixed. Treat it as a relaxation and focus aid, not medicine. If you have epilepsy or a seizure disorder, check with a doctor first. Keep the volume low.
        <a href="https://pubmed.ncbi.nlm.nih.gov/30073406/" target="_blank" rel="noopener">Garcia-Argibay et al., 2019</a></div>
    </section>`;
  }

  function deck() {
    return `<div class="deck" id="deck">${mixer()}${binaural()}</div>`;
  }

  /* ---------- visualizer: the two tones and their sum (slow, calm drift; no strobing) ---------- */
  function startViz() {
    cancelAnimationFrame(vizRaf);
    let t0 = performance.now();
    const loop = () => {
      vizRaf = requestAnimationFrame(loop);
      const cv = document.getElementById('bin-viz');
      if (!cv) return;
      const g = cv.getContext('2d');
      const W = cv.width;
      const H = cv.height;
      const t = (performance.now() - t0) / 1000;
      const B = S().binaural;
      const on = snd().binaural.on;
      g.clearRect(0, 0, W, H);
      const css = getComputedStyle(document.body);
      const accent = css.getPropertyValue('--accent').trim() || '#d9955f';
      const ink = css.getPropertyValue('--ink').trim() || '#efe9df';
      const f1 = 14;
      const f2 = 14 + Math.min(10, Math.max(0.6, B.beat / 3.2));
      const draw = (fn, color, w, alpha) => {
        g.beginPath();
        for (let x = 0; x <= W; x += 2) {
          const y = fn(x / W);
          x ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.strokeStyle = color;
        g.globalAlpha = alpha;
        g.lineWidth = w;
        g.stroke();
      };
      const mid = H / 2;
      const amp = H * 0.18;
      const drift = t * 0.35; // slow, constant
      draw((u) => mid - Math.sin(u * f1 * Math.PI * 2 + drift) * amp * 0.9 - H * 0.2, ink, 1, on ? 0.35 : 0.15);
      draw((u) => mid - Math.sin(u * f2 * Math.PI * 2 + drift) * amp * 0.9 + H * 0.2, ink, 1, on ? 0.35 : 0.15);
      draw((u) => mid - (Math.sin(u * f1 * Math.PI * 2 + drift) + Math.sin(u * f2 * Math.PI * 2 + drift)) * amp * 0.5, accent, 1.6, on ? 1 : 0.4);
      g.globalAlpha = 1;
    };
    loop();
  }

  function refreshDeck() {
    const root = document.getElementById('deck');
    if (!root) return;
    root.outerHTML = deck();
  }

  A.views.sanctuary = {
    title: 'Sanctuary',
    mode: 'sanctuary',
    render(root) {
      root.innerHTML = `
      <div class="sanct">
        <section class="sanct-hero">
          <p class="eyebrow">Sanctuary</p>
          <h1 data-split>Rain, <em>waves</em><br>&amp; stillness.</h1>
          <p class="sub">Layer real recordings of rain, thunder, ocean and temple, then tune a brainwave generator underneath. The water behind this page listens to every sound you play.</p>
        </section>
        ${deck()}
        <p class="credits">Recordings from <a href="https://github.com/remvze/moodist" target="_blank" rel="noopener">Moodist</a> by remvze (MIT licence); individual sounds are Pixabay Content License or CC0.<br>Brainwave tones are synthesized live in your browser.</p>
      </div>`;
    },
    update() {
      /* live view: the deck refreshes itself on sound events */
    },
    mount() {
      offs.forEach((o) => o());
      offs = [
        A.bus.on('sound-change', refreshDeck),
        A.bus.on('sound-tick', () => {
          const t = document.getElementById('timer-left');
          if (t) t.textContent = snd().timerLeft ? A.fmtDur(snd().timerLeft / 1000) + ' left' : '';
          const pl = document.getElementById('prog-live');
          const p = snd().binaural.program;
          if (pl && p) pl.textContent = `${p.name} · ${Math.floor(snd().binaural.progMinutes)} min in · now ${S().binaural.beat.toFixed(1)} Hz`;
          setBeatUi(S().binaural.beat, false);
        }),
      ];
      startViz();
    },
    unmount() {
      offs.forEach((o) => o());
      offs = [];
      cancelAnimationFrame(vizRaf);
      document.body.classList.remove('night');
    },
  };

  function setBeatUi(hz, sliderToo) {
    const band = snd().bandOf(hz);
    const set = (id, v) => {
      const e = document.getElementById(id);
      if (e) e.textContent = v;
    };
    set('bin-hz', hz.toFixed(1));
    set('o-beat', hz.toFixed(1) + ' Hz');
    set('bin-band', band.name);
    set('bin-use', band.use);
    set('bin-blurb', band.blurb);
    document.querySelectorAll('.band').forEach((b, i) => b.classList.toggle('on', snd().BANDS[i].id === band.id));
    const c = S().binaural.carrier;
    const ears = document.querySelector('.bin-ears');
    if (ears) ears.innerHTML = `<span>Left ${(c - hz / 2).toFixed(1)} Hz</span><span>Right ${(c + hz / 2).toFixed(1)} Hz</span>`;
    if (sliderToo) {
      const sl = document.querySelector('[data-bin="beat"]');
      if (sl) {
        sl.value = posFromHz(hz);
        sl.style.setProperty('--pct', pct(sl));
      }
    }
  }

  /* ---------- sliders ---------- */
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.matches) return;
    if (t.matches('[data-snd-vol]')) {
      const id = t.dataset.sndVol;
      t.style.setProperty('--pct', pct(t));
      const v = parseFloat(t.value);
      if (snd().isPlaying(id)) snd().setVol(id, v);
      else if (v > 0.02) snd().play(id, v);
      else S().mix[id] = v;
    } else if (t.matches('[data-snd-master]')) {
      t.style.setProperty('--pct', pct(t));
      snd().setMaster(parseFloat(t.value));
    } else if (t.matches('[data-bin]')) {
      t.style.setProperty('--pct', pct(t));
      const k = t.dataset.bin;
      const v = parseFloat(t.value);
      const o = t.parentElement.querySelector('output');
      if (k === 'beat') {
        const hz = hzFromPos(v);
        snd().binaural.stopProgram();
        snd().binaural.setBeat(hz, 0.15);
        setBeatUi(hz, false);
      } else if (k === 'carrier') {
        snd().binaural.setCarrier(v);
        o.textContent = v + ' Hz';
        setBeatUi(S().binaural.beat, false);
      } else if (k === 'vol') {
        snd().binaural.setVol(v);
        o.textContent = Math.round(v * 100) + '%';
      } else if (k === 'noise') {
        snd().binaural.setNoise(v);
        o.textContent = Math.round(v * 100) + '%';
      }
      A.save(true);
    }
  });

  A.actions.sndToggle = (el) => {
    A.sfx('click');
    snd().toggle(el.dataset.id);
  };
  A.actions.sndStopAll = () => snd().stopAll();
  A.actions.sndMix = (el) => snd().loadMix(snd().MIXES.find((m) => m.id === el.dataset.id));
  A.actions.sndTimer = (el) => {
    snd().setTimer(+el.dataset.m);
    if (+el.dataset.m) A.ui.toast(`Sleep timer set for ${el.dataset.m} minutes`, { icon: '🌙', ms: 2500 });
  };
  A.actions.binToggle = () => (snd().binaural.on ? snd().binaural.stop() : snd().binaural.start());
  A.actions.binBand = (el) => {
    const hz = parseFloat(el.dataset.hz);
    snd().binaural.stopProgram();
    snd().binaural.setBeat(hz, 0.3);
    setBeatUi(hz, true);
    A.save(true);
  };
  A.actions.binMode = (el) => {
    snd().binaural.setMode(el.dataset.m);
    refreshDeck();
  };
  A.actions.binProg = (el) => {
    snd().binaural.runProgram(el.dataset.id);
    A.ui.toast('Journey started. Close your eyes.', { icon: '🎧', ms: 2600 });
  };
})();
