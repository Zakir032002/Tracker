/* Ascend: Focus (Pomodoro) timer. Survives refresh: state is an absolute end time. */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon, G } = { esc: A.esc, icon: A.icon, G: A.G };
  const R = 118;
  const CIRC = 2 * Math.PI * R;
  let sel = null;
  let ui = false;
  let startedAmbient = false;

  const run = () => A.S.focus.running;
  const remainingMs = () => {
    const r = run();
    if (!r) return (sel || A.S.focus.lastMin || 25) * 60000;
    return r.paused ? r.remaining : Math.max(0, r.endsAt - Date.now());
  };

  function ambientOn() {
    if (A.S.sound.autoFocus && A.sound && !A.sound.anyPlaying()) {
      A.sound.loadMix(A.sound.MIXES[0]);
      startedAmbient = true;
    }
  }
  function ambientOff() {
    if (startedAmbient && A.sound) A.sound.stopAll();
    startedAmbient = false;
  }

  function complete() {
    const r = run();
    if (!r) return;
    A.S.focus.running = null;
    const { xp, coins } = G.finishFocus(r.minutes);
    A.sfx('focusEnd');
    A.fx.celebrate();
    ambientOff();
    A.ui.toast(`<b>Focus complete: ${r.minutes} min</b><small>+${xp} XP · +${coins} coins</small>`, { icon: '🧘', kind: 'ach', ms: 6000 });
    try {
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Focus session complete', { body: `${r.minutes} minutes done. +${xp} XP`, icon: 'assets/icon.svg' });
    } catch (e) {}
    A.save();
    if (A.view === 'focus') A.navigate(true);
  }

  /* global ticker: completes sessions even when you are on another tab/view */
  A.focusTick = () => {
    const r = run();
    if (r && !r.paused && Date.now() >= r.endsAt) complete();
    if (ui && A.view === 'focus' && document.getElementById('focus-ring')) paint();
  };

  function paint() {
    const r = run();
    const ms = remainingMs();
    const total = (r ? r.minutes : sel || A.S.focus.lastMin || 25) * 60000;
    const frac = r ? 1 - ms / total : 0;
    const val = document.getElementById('focus-val');
    if (!val) return;
    val.style.strokeDashoffset = CIRC * (1 - frac);
    document.getElementById('focus-time').textContent = A.fmtDur(Math.ceil(ms / 1000));
    document.getElementById('focus-state').textContent = !r ? 'Ready' : r.paused ? 'Paused' : 'In the zone';
    if (r && !r.paused) {
      document.title = `${A.fmtDur(Math.ceil(ms / 1000))} · Focus`;
      if (window.A3D && window.A3D.ready) window.A3D.set({ progress: 0.15 + frac * 0.85 });
    }
  }

  A.views.focus = {
    title: 'Focus',
    mode: 'core',
    render(root) {
      ui = true;
      sel = sel || A.S.focus.lastMin || 25;
      const r = run();
      const today = A.today();
      const todayMin = A.S.focus.sessions.filter((s) => s.date === today).reduce((a, s) => a + s.min, 0);
      const todayN = A.S.focus.sessions.filter((s) => s.date === today).length;
      const totalMin = A.S.stats.focusMin || 0;
      root.innerHTML = `
      <div class="page-head"><p class="eyebrow">Deep work</p><h1 data-split>Focus <em>mode.</em></h1>
        <p class="sub">Finish a session to earn XP (1 per minute) and coins. Quit early and you earn nothing.</p></div>
      <div class="focus-stage">
        <section class="focus-main">
          <div class="focus-ringbox">
            <div class="core-slot" data-core-slot aria-hidden="true"></div>
            <div class="focus-ring" id="focus-ring"><svg viewBox="0 0 240 240"><circle class="trk" cx="120" cy="120" r="${R}"/><circle id="focus-val" class="val" cx="120" cy="120" r="${R}" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/></svg></div>
          </div>
          <div class="focus-time" id="focus-time">25:00</div>
          <p class="eyebrow focus-state" id="focus-state">Ready</p>
          <div class="focus-controls">
            ${r ? '' : `<div class="seg compact" id="focus-presets">${[15, 25, 45, 60, 90].map((m) => `<button class="seg-btn ${sel === m ? 'on' : ''}" data-act="focusPreset" data-m="${m}" data-quiet>${m}m</button>`).join('')}</div>`}
            <div class="row gap center-row">
              ${!r ? `<button class="btn primary lg" data-act="focusStart" data-quiet><span>${icon('play', 16)} Start focus</span></button>`
                : r.paused ? `<button class="btn primary lg" data-act="focusResume" data-quiet><span>${icon('play', 16)} Resume</span></button>`
                : `<button class="btn soft lg" data-act="focusPause" data-quiet><span>${icon('pause', 16)} Pause</span></button>`}
              ${r ? `<button class="btn ghost danger-t" data-act="focusQuit" data-quiet><span>Give up</span></button>` : ''}
            </div>
            <label class="check-row"><input type="checkbox" data-act="focusAmbient" ${A.S.sound.autoFocus ? 'checked' : ''}> <span>Play a rain mix from the Sanctuary while I focus</span></label>
            <p class="muted small center">${r ? 'The timer keeps running even if you close the tab.' : `Reward: +${sel} XP · +${Math.floor(sel / 5)} coins`}</p>
          </div>
        </section>
        <aside class="focus-aside">
          <section class="card glass"><div class="card-head"><h3>Today</h3></div>
            <div class="hero-foot" style="border:0;padding:0"><div class="big-stat"><b>${todayMin}</b><span>minutes</span></div><div class="big-stat"><b>${todayN}</b><span>sessions</span></div><div class="big-stat"><b>${(totalMin / 60).toFixed(1)}</b><span>hours total</span></div></div></section>
          <section class="card glass"><div class="card-head"><h3>Recent sessions</h3></div>
            ${A.S.focus.sessions.length ? `<ul class="mini-list">${A.S.focus.sessions.slice(0, 7).map((s) => `<li><span class="mi">🧘</span><span class="grow">${s.min} minutes</span><small>${A.ago(s.t)}</small></li>`).join('')}</ul>` : '<p class="muted small">No sessions yet. Your first one is worth a trophy.</p>'}</section>
        </aside>
      </div>`;
      paint();
    },
    update() {
      /* ticker paints in place */
    },
    mount() {
      paint();
    },
    unmount() {
      document.title = document.title.replace(/^\d\d:\d\d · Focus/, 'Ascend');
      A.sync3D && A.sync3D();
    },
  };

  A.actions.focusPreset = (el) => {
    sel = +el.dataset.m;
    A.S.focus.lastMin = sel;
    A.sfx('click');
    A.navigate(true);
  };
  A.actions.focusAmbient = (el) => {
    A.S.sound.autoFocus = el.checked;
    A.save(true);
  };
  A.actions.focusStart = () => {
    const min = sel || 25;
    A.S.focus.running = { minutes: min, endsAt: Date.now() + min * 60000, paused: false };
    A.S.focus.lastMin = min;
    A.sfx('pop');
    ambientOn();
    A.save(true);
    A.navigate(true);
  };
  A.actions.focusPause = () => {
    const r = run();
    if (!r) return;
    r.remaining = Math.max(0, r.endsAt - Date.now());
    r.paused = true;
    A.save(true);
    A.navigate(true);
  };
  A.actions.focusResume = () => {
    const r = run();
    if (!r) return;
    r.endsAt = Date.now() + r.remaining;
    r.paused = false;
    A.save(true);
    A.navigate(true);
  };
  A.actions.focusQuit = async () => {
    if (await A.ui.confirm({ title: 'Give up this session?', text: 'You will not earn any XP or coins for it.', ok: 'Give up', danger: true })) {
      A.S.focus.running = null;
      ambientOff();
      A.save(true);
      A.navigate(true);
    }
  };
})();
