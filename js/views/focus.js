/* Ascend — Focus (Pomodoro) timer. Survives refresh: state is an absolute end time. */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon, G } = { esc: A.esc, icon: A.icon, G: A.G };
  const R = 104;
  const CIRC = 2 * Math.PI * R;
  let sel = null;
  let ui = null;

  const run = () => A.S.focus.running;
  const remainingMs = () => {
    const r = run();
    if (!r) return (sel || A.S.focus.lastMin || 25) * 60000;
    return r.paused ? r.remaining : Math.max(0, r.endsAt - Date.now());
  };

  function complete() {
    const r = run();
    if (!r) return;
    A.S.focus.running = null;
    const { xp, coins } = G.finishFocus(r.minutes);
    A.sfx('focusEnd');
    A.fx.celebrate();
    A.ui.toast(`<b>Focus complete: ${r.minutes} min</b><small>+${xp} XP · +${coins} coins</small>`, { icon: '🧘', kind: 'ach rare', ms: 6000 });
    try {
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Focus session complete', { body: `${r.minutes} minutes done. +${xp} XP`, icon: 'assets/icon.svg' });
    } catch (e) {}
    A.save();
    if (A.view === 'focus') A.navigate();
  }

  /* global ticker: completes sessions even when you are on another tab/view */
  A.focusTick = () => {
    const r = run();
    if (r && !r.paused && Date.now() >= r.endsAt) complete();
    if (ui && document.getElementById('focus-ring')) paint();
  };

  function paint() {
    const r = run();
    const ms = remainingMs();
    const total = (r ? r.minutes : sel || A.S.focus.lastMin || 25) * 60000;
    const frac = r ? 1 - ms / total : 0;
    const val = document.getElementById('focus-val');
    const txt = document.getElementById('focus-time');
    const st = document.getElementById('focus-state');
    if (!val) return;
    val.style.strokeDashoffset = CIRC * (1 - frac);
    txt.textContent = A.fmtDur(Math.ceil(ms / 1000));
    st.textContent = !r ? 'Ready' : r.paused ? 'Paused' : 'Focusing';
    if (r && !r.paused) document.title = `${A.fmtDur(Math.ceil(ms / 1000))} · Focus`;
  }

  A.views.focus = {
    title: 'Focus',
    render(root) {
      ui = true;
      sel = sel || A.S.focus.lastMin || 25;
      const r = run();
      const today = A.today();
      const todayMin = A.S.focus.sessions.filter((s) => s.date === today).reduce((a, s) => a + s.min, 0);
      const todayN = A.S.focus.sessions.filter((s) => s.date === today).length;
      const totalMin = A.S.stats.focusMin || 0;
      root.innerHTML = `
      <div class="page-head"><p class="eyebrow">Deep work</p><h1>Focus <em>mode</em></h1>
        <p class="sub">Finish a session to earn XP (1 per minute) and coins. Quit early and you earn nothing.</p></div>
      <div class="focus-grid">
        <section class="card glass focus-card ${r && !r.paused ? 'live' : ''}">
          <div class="focus-ring" id="focus-ring"><svg viewBox="0 0 240 240"><defs><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:hsl(var(--h) 95% 72%)"/><stop offset="1" style="stop-color:hsl(calc(var(--h) + 70) 95% 62%)"/></linearGradient></defs>
            <circle class="trk" cx="120" cy="120" r="${R}"/><circle id="focus-val" class="val" cx="120" cy="120" r="${R}" stroke="url(#fg)" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/></svg>
            <div class="focus-center"><span id="focus-state" class="eyebrow">Ready</span><b id="focus-time">25:00</b></div></div>
          ${
            r
              ? ''
              : `<div class="seg compact center-row" id="focus-presets">${[15, 25, 45, 60, 90].map((m) => `<button class="seg-btn ${sel === m ? 'on' : ''}" data-act="focusPreset" data-m="${m}" data-quiet>${m}m</button>`).join('')}</div>`
          }
          <div class="row gap center-row">
            ${
              !r
                ? `<button class="btn primary lg" data-act="focusStart" data-quiet>${icon('play', 18)} Start focus</button>`
                : r.paused
                ? `<button class="btn primary lg" data-act="focusResume" data-quiet>${icon('play', 18)} Resume</button>`
                : `<button class="btn soft lg" data-act="focusPause" data-quiet>${icon('pause', 18)} Pause</button>`
            }
            ${r ? `<button class="btn ghost danger-t" data-act="focusQuit" data-quiet>Give up</button>` : ''}
          </div>
          <p class="muted small center">${r ? 'Stay on this device. The timer keeps running even if you close the tab.' : `Reward: +${sel} XP · +${Math.floor(sel / 5)} coins`}</p>
        </section>
        <aside class="col">
          <section class="card glass"><div class="card-head"><h3>Today</h3></div>
            <div class="hero-stats"><div><b>${todayMin}</b><span>minutes</span></div><div><b>${todayN}</b><span>sessions</span></div><div><b>${(totalMin / 60).toFixed(1)}</b><span>hours total</span></div></div></section>
          <section class="card glass"><div class="card-head"><h3>Recent sessions</h3></div>
            ${
              A.S.focus.sessions.length
                ? `<ul class="mini-list">${A.S.focus.sessions.slice(0, 7).map((s) => `<li><span class="mi">🧘</span><span class="grow">${s.min} minutes</span><small>${A.ago(s.t)}</small></li>`).join('')}</ul>`
                : '<p class="muted small">No sessions yet. Your first one is worth a badge.</p>'
            }</section>
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
    },
  };

  A.actions.focusPreset = (el) => {
    sel = +el.dataset.m;
    A.S.focus.lastMin = sel;
    A.sfx('click');
    A.navigate();
  };
  A.actions.focusStart = () => {
    const min = sel || 25;
    A.S.focus.running = { minutes: min, endsAt: Date.now() + min * 60000, paused: false };
    A.S.focus.lastMin = min;
    A.sfx('pop');
    A.save(true);
    A.navigate();
  };
  A.actions.focusPause = () => {
    const r = run();
    if (!r) return;
    r.remaining = Math.max(0, r.endsAt - Date.now());
    r.paused = true;
    A.save(true);
    A.navigate();
  };
  A.actions.focusResume = () => {
    const r = run();
    if (!r) return;
    r.endsAt = Date.now() + r.remaining;
    r.paused = false;
    A.save(true);
    A.navigate();
  };
  A.actions.focusQuit = async () => {
    if (await A.ui.confirm({ title: 'Give up this session?', text: 'You will not earn any XP or coins for it.', ok: 'Give up', danger: true })) {
      A.S.focus.running = null;
      A.save(true);
      A.navigate();
    }
  };
})();
