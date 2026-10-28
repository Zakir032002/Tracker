/* Ascend — Settings */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon } = { esc: A.esc, icon: A.icon };

  const toggle = (k, label, hint) => {
    const on = A.S.settings[k] !== false && !!A.S.settings[k];
    return `<div class="set-row"><div class="grow"><b>${label}</b>${hint ? `<p class="muted small">${hint}</p>` : ''}</div>
      <button class="switch ${on ? 'on' : ''}" data-act="setToggle" data-k="${k}" data-quiet role="switch" aria-checked="${on}" aria-label="${label}"><i></i></button></div>`;
  };

  let storageInfo = '';
  async function loadStorage() {
    try {
      const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      const kb = Math.round(JSON.stringify(A.S).length / 1024);
      storageInfo = `${kb} KB of data · ${persisted ? 'protected from browser clean-up' : 'standard browser storage'}${est ? '' : ''}`;
      const el = document.getElementById('storage-info');
      if (el) el.textContent = storageInfo;
    } catch (e) {}
  }

  A.views.settings = {
    title: 'Settings',
    render(root) {
      const s = A.S.settings;
      root.innerHTML = `
      <div class="page-head"><p class="eyebrow">Make it yours</p><h1>Settings</h1></div>
      ${A.memoryOnly ? `<div class="card glass warn-card">${icon('shield', 18)} <span>Your browser is blocking storage, so progress <b>won’t be saved</b>. Open Ascend in a normal window or allow site data, then export a backup below.</span></div>` : ''}
      <div class="settings-grid">
        <section class="card glass">
          <div class="card-head"><h3>Profile</h3></div>
          <label class="field"><span>Hero name</span><input class="input" maxlength="20" data-set="profile.name" value="${esc(A.S.profile.name)}"></label>
          <div class="field"><span>Avatar</span><div class="emoji-grid">${A.ui.AVATARS.map((e) => `<button type="button" class="emo ${e === A.S.profile.avatar ? 'on' : ''}" data-act="setAvatar" data-e="${e}" data-quiet>${e}</button>`).join('')}</div></div>
        </section>

        <section class="card glass">
          <div class="card-head"><h3>Appearance</h3></div>
          <div class="field"><span>Theme</span><div class="seg compact">${[...A.THEMES.map((t) => [t.id, t.name]), ['auto', 'Auto']].map(([k, l]) => `<button class="seg-btn ${s.theme === k ? 'on' : ''}" data-act="setTheme" data-v="${k}" data-quiet>${l}</button>`).join('')}</div></div>
          <div class="field"><span>Accent ${A.resolvedTheme() === 'rose' ? '<small class="muted">· Rosé Aurum keeps its signature rose-gold</small>' : ''}</span><div class="swatches" ${A.resolvedTheme() === 'rose' ? 'style="opacity:.35;pointer-events:none"' : ''}>${A.ui.ACCENTS.map((a) => `<button class="sw ${s.accent === a.h ? 'on' : ''}" data-act="setAccent" data-h="${a.h}" style="--c:${a.h}" data-quiet aria-label="${a.name}" title="${a.name}"></button>`).join('')}</div></div>
          <div class="field"><span>3D graphics</span><div class="seg compact">${[['high', 'High'], ['low', 'Battery saver'], ['off', 'Off']].map(([k, l]) => `<button class="seg-btn ${s.quality === k ? 'on' : ''}" data-act="setQuality" data-v="${k}" data-quiet>${l}</button>`).join('')}</div></div>
          ${toggle('cursor', 'Custom cursor', 'A smooth follower on desktop. Reload to apply.')}
          ${toggle('confetti', 'Confetti & effects')}
        </section>

        <section class="card glass">
          <div class="card-head"><h3>Sound &amp; alerts</h3></div>
          ${toggle('sound', 'Sound effects & alarms')}
          <div class="set-row"><div class="grow"><b>Volume</b></div><input type="range" min="0" max="1" step="0.05" value="${s.volume}" style="--pct:${s.volume * 100}%" data-set="settings.volume" data-num="1" data-preview="coin" aria-label="Volume"></div>
          <div class="set-row"><div class="grow"><b>Snooze length</b><p class="muted small">Each snooze costs more coins than the last.</p></div>
            <div class="num-step"><button class="icon-btn sm" data-act="setSnooze" data-n="-1" data-quiet>${icon('minus', 14)}</button><b>${s.snoozeMin}m</b><button class="icon-btn sm" data-act="setSnooze" data-n="1" data-quiet>${icon('plus', 14)}</button></div></div>
          <div class="set-row"><div class="grow"><b>Browser notifications</b><p class="muted small">${'Notification' in window ? (Notification.permission === 'granted' ? 'Enabled' : Notification.permission === 'denied' ? 'Blocked in browser settings' : 'Get a banner when an alarm rings in the background') : 'Not supported here'}</p></div>
            ${'Notification' in window && Notification.permission === 'default' ? `<button class="btn soft sm" data-act="enableNotif">Enable</button>` : ''}</div>
          <div class="row gap"><button class="btn soft sm" data-act="alarmTest">${icon('play', 13)} Test alarm</button><button class="btn soft sm" data-act="testLevel">Preview level-up</button></div>
        </section>

        <section class="card glass">
          <div class="card-head"><h3>Game rules</h3></div>
          ${toggle('penalties', 'Penalties for missed quests', 'Skipping a quest costs HP, XP and coins when the day ends. Turn off for a gentle mode.')}
          ${toggle('hardcore', 'Hardcore mode', 'Double penalties. Dying also costs you a whole level.')}
          <div class="set-row"><div class="grow"><b>Streak threshold</b><p class="muted small">A day keeps your streak when you finish at least <b id="thr-val">${s.streakThreshold}%</b> of its quests.</p></div>
            <input type="range" min="10" max="100" step="10" value="${s.streakThreshold}" style="--pct:${((s.streakThreshold - 10) / 90) * 100}%" data-set="settings.streakThreshold" data-num="1" data-live="thr-val" data-suffix="%" aria-label="Streak threshold"></div>
          <div class="set-row"><div class="grow"><b>Week starts on</b></div><div class="seg compact">${[1, 0, 6].map((d) => `<button class="seg-btn ${s.weekStart === d ? 'on' : ''}" data-act="setWeek" data-d="${d}" data-quiet>${A.DAYS[d]}</button>`).join('')}</div></div>
        </section>

        <section class="card glass wide">
          <div class="card-head"><h3>Stick to your screen</h3></div>
          <p class="muted small">Quests and sticky notes can stay beside you while you browse. <b>Pin to screen</b> opens a small always-on-top window. For a panel docked to the side of Chrome itself, load the <code>extension/</code> folder (chrome://extensions → Developer mode → Load unpacked) — it stays in sync with this page.</p>
          <div class="row gap sm-top"><button class="btn soft sm" data-act="pinOpen"><span>📌 Pin to screen</span></button></div>
        </section>

        <section class="card glass wide">
          <div class="card-head"><h3>Your data</h3></div>
          <p class="muted small">Everything is stored on this device, in this browser, and saved automatically as you play. <span id="storage-info">${esc(storageInfo)}</span></p>
          <div class="row gap wrap">
            <button class="btn soft" data-act="exportData">${icon('download', 16)} Export backup</button>
            <button class="btn soft" data-act="importData">${icon('upload', 16)} Import backup</button>
            <input type="file" id="import-file" accept="application/json,.json" hidden>
            <button class="btn ghost danger-t" data-act="resetData">${icon('trash', 16)} Reset everything</button>
            ${A.installPrompt ? `<button class="btn primary" data-act="installApp">Install app</button>` : ''}
          </div>
        </section>
      </div>
      <p class="muted small center sm-top">Ascend · made for people who keep their promises.</p>`;
      loadStorage();
      const f = root.querySelector('#import-file');
      f.addEventListener('change', async () => {
        const file = f.files[0];
        if (!file) return;
        try {
          A.importJSON(await file.text());
          A.applyTheme();
          A.G.rollover();
          A.ui.toast('Backup restored', { icon: '✅' });
          A.save();
          A.navigate(true);
        } catch (e) {
          A.sfx('error');
          A.ui.toast('That file is not a valid Ascend backup', { icon: '🚫', kind: 'warn' });
        }
      });
    },
  };

  const setPath = (path, v) => {
    const parts = path.split('.');
    let o = A.S;
    while (parts.length > 1) o = o[parts.shift()];
    o[parts[0]] = v;
  };
  document.addEventListener('input', (e) => {
    const el = e.target.closest && e.target.closest('[data-set]');
    if (!el) return;
    const v = el.dataset.num ? parseFloat(el.value) : el.value;
    setPath(el.dataset.set, el.dataset.set === 'profile.name' ? String(v).slice(0, 20) : v);
    if (el.type === 'range') el.style.setProperty('--pct', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
    if (el.dataset.live) document.getElementById(el.dataset.live).textContent = v + (el.dataset.suffix || '');
    A.save(true);
    if (el.dataset.preview && !el._t) {
      el._t = setTimeout(() => {
        el._t = null;
        A.sfx(el.dataset.preview);
      }, 120);
    }
    if (el.dataset.set === 'profile.name') A.renderChrome();
  });

  A.actions.setToggle = (el) => {
    const k = el.dataset.k;
    A.S.settings[k] = !(A.S.settings[k] !== false && A.S.settings[k]);
    A.sfx('click');
    A.save();
    if (A.view === 'settings') A.navigate(true);
  };
  A.actions.setAvatar = (el) => {
    A.S.profile.avatar = el.dataset.e;
    A.sfx('pop');
    A.save();
    A.navigate(true);
  };
  A.actions.setTheme = (el, e) => {
    A.setTheme(el.dataset.v, e);
    setTimeout(() => A.view === 'settings' && A.navigate(true), 1500);
  };
  A.actions.setQuality = (el) => {
    A.S.settings.quality = el.dataset.v;
    document.documentElement.classList.toggle('no-webgl', el.dataset.v === 'off');
    if (window.A3D && window.A3D.ready) window.A3D.quality(el.dataset.v === 'low' ? 'low' : 'high');
    A.save();
    A.navigate(true);
  };
  A.actions.setAccent = (el) => {
    A.S.settings.accent = +el.dataset.h;
    A.applyTheme();
    A.sfx('pop');
    A.save();
    A.navigate(true);
  };
  A.actions.setWeek = (el) => {
    A.S.settings.weekStart = +el.dataset.d;
    A.G.ensureBoss();
    A.save();
    A.navigate(true);
  };
  A.actions.setSnooze = (el) => {
    A.S.settings.snoozeMin = A.clamp(A.S.settings.snoozeMin + +el.dataset.n * (A.S.settings.snoozeMin >= 10 && +el.dataset.n > 0 ? 5 : 1), 1, 60);
    A.save();
    A.navigate(true);
  };
  A.actions.testLevel = () => {
    A.sfx('level');
    A.fx.celebrate();
  };
  A.actions.exportData = () => {
    A.exportJSON();
    A.ui.toast('Backup downloaded', { icon: '💾' });
  };
  A.actions.importData = () => document.getElementById('import-file').click();
  A.actions.installApp = async () => {
    if (!A.installPrompt) return;
    A.installPrompt.prompt();
    await A.installPrompt.userChoice;
    A.installPrompt = null;
    A.navigate(true);
  };
  A.actions.resetData = () => {
    const m = A.ui.modal({
      cls: 'modal-sm',
      html: `<h3>Reset everything?</h3><p class="muted">This permanently deletes all quests, streaks, notes, alarms and progress. Consider exporting a backup first.</p>
        <label class="field"><span>Type <b>RESET</b> to confirm</span><input id="rs-in" class="input" autocomplete="off"></label>
        <div class="row end gap"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="rs-go" disabled>Delete all data</button></div>`,
    });
    const inp = m.el.querySelector('#rs-in');
    const go = m.el.querySelector('#rs-go');
    inp.addEventListener('input', () => (go.disabled = inp.value.trim() !== 'RESET'));
    go.addEventListener('click', () => {
      A.resetAll();
      location.hash = 'today';
      location.reload();
    });
  };
})();
