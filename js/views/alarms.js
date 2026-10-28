/* Ascend — Alarms view */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon, G } = { esc: A.esc, icon: A.icon, G: A.G };

  let timer = null;

  function allSchedules() {
    const out = [];
    A.S.alarms
      .filter((a) => a.enabled)
      .forEach((a) => out.push({ time: a.time, days: a.days, label: a.label || 'Alarm' }));
    A.S.habits
      .filter((h) => !h.archived && h.reminder)
      .forEach((h) => out.push({ time: h.reminder, days: h.days, label: h.name, habit: h }));
    return out;
  }
  /* next occurrence across all alarms + quest reminders */
  function nextUp() {
    const now = new Date();
    let best = null;
    allSchedules().forEach((s) => {
      for (let off = 0; off < 8; off++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
        if (!s.days.includes(d.getDay())) continue;
        const [h, m] = s.time.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        if (d <= now) continue;
        if (s.habit && off === 0 && G.isDone(s.habit, A.today())) continue;
        if (!best || d < best.at) best = { at: d, label: s.label };
        break;
      }
    });
    return best;
  }
  function untilText(at) {
    const s = Math.max(0, Math.floor((at - new Date()) / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h ? `${h}h ${m}m` : m ? `${m}m ${A.p2(sec)}s` : `${sec}s`;
  }

  function dayChips(a) {
    if (a.once) return '<span class="chip">Once</span>';
    if (a.days.length === 7) return '<span class="chip">Every day</span>';
    return [1, 2, 3, 4, 5, 6, 0].map((d) => `<span class="chip dow ${a.days.includes(d) ? 'on' : ''}">${A.DAYS1[d]}</span>`).join('');
  }

  function alarmCard(a) {
    const h = a.habitId ? A.S.habits.find((x) => x.id === a.habitId) : null;
    return `<article class="card glass alarm-card ${a.enabled ? '' : 'off'}">
      <div class="al-time"><b>${A.time12(a.time).split(' ')[0]}</b><small>${A.time12(a.time).split(' ')[1]}</small></div>
      <div class="grow al-info"><h3>${esc(a.label || 'Alarm')}</h3>
        <div class="q-meta">${dayChips(a)}<span class="chip">${icon('bell', 12)} ${esc((A.TONES[a.tone] || A.TONES.sunrise).name)}</span>
        ${h ? `<span class="chip fire">${esc(h.icon)} ${esc(h.name)}</span>` : ''}</div></div>
      <div class="al-actions">
        <button class="switch ${a.enabled ? 'on' : ''}" data-act="alarmToggle" data-id="${a.id}" data-quiet role="switch" aria-checked="${a.enabled}" aria-label="Enable alarm"><i></i></button>
        <button class="icon-btn sm" data-act="alarmEdit" data-id="${a.id}" aria-label="Edit">${icon('edit', 16)}</button>
        <button class="icon-btn sm danger" data-act="alarmDel" data-id="${a.id}" aria-label="Delete">${icon('trash', 16)}</button>
      </div></article>`;
  }

  function notifCard() {
    const supported = 'Notification' in window;
    const perm = supported ? Notification.permission : 'denied';
    return `<section class="card glass notif-card"><div class="grow">
      <h3>${icon('bell', 18)} Make sure you hear it</h3>
      <p class="muted small">Alarms ring with sound while Ascend is open (keep the tab or installed app running). Browsers only allow sound after you've tapped something once. ${
        supported ? (perm === 'granted' ? 'Notifications are on, so you’ll also get a banner if the tab is in the background.' : perm === 'denied' ? 'Notifications are blocked in your browser settings.' : 'Turn on notifications for a banner when the tab is in the background.') : ''
      }</p></div>
      <div class="row gap wrap">
        <button class="btn soft" data-act="alarmTest">${icon('play', 14)} Test alarm</button>
        ${supported && perm === 'default' ? `<button class="btn primary" data-act="enableNotif">Enable notifications</button>` : ''}
      </div></section>`;
  }

  A.views.alarms = {
    title: 'Alarms',
    render(root) {
      const n = nextUp();
      const habitRem = A.S.habits.filter((h) => !h.archived && h.reminder);
      root.innerHTML = `
      <div class="page-head row between wrap">
        <div><p class="eyebrow">Hold yourself accountable</p><h1>Alarms &amp; <em>reminders</em></h1>
        <p class="sub">Ignore an alarm tied to a quest and you take damage. Snoozing costs a coin.</p></div>
        <button class="btn primary" data-act="alarmNew">${icon('plus', 18)} New alarm</button>
      </div>
      <section class="card glass next-card"><div class="next-ic">${icon('alarm', 34)}</div>
        <div class="grow"><p class="eyebrow">Next up</p>${n ? `<h2>${esc(n.label)}</h2><p class="muted">at ${A.time12(`${A.p2(n.at.getHours())}:${A.p2(n.at.getMinutes())}`)} · in <b id="next-in">${untilText(n.at)}</b></p>` : '<h2>Nothing scheduled</h2><p class="muted">Add an alarm, or set a reminder time on a quest.</p>'}</div></section>
      ${notifCard()}
      <div class="section-head"><h2>Alarms</h2></div>
      ${A.S.alarms.length ? `<div class="alarm-list">${A.S.alarms.slice().sort((a, b) => a.time.localeCompare(b.time)).map(alarmCard).join('')}</div>` : `<div class="card glass empty-state"><div class="big-emoji">⏰</div><h3>No alarms yet</h3><p class="muted">Create one for gym time, bedtime, or a daily check-in.</p><button class="btn primary" data-act="alarmNew">${icon('plus', 16)} Create alarm</button></div>`}
      <div class="section-head"><h2>Quest reminders</h2></div>
      ${
        habitRem.length
          ? `<div class="card glass"><ul class="mini-list">${habitRem.map((h) => `<li><span class="mi">${esc(h.icon)}</span><span class="grow">${esc(h.name)}</span><b>${A.time12(h.reminder)}</b><button class="icon-btn sm" data-act="editQuest" data-id="${h.id}" aria-label="Edit reminder">${icon('edit', 14)}</button></li>`).join('')}</ul></div>`
          : '<p class="muted">Set a reminder time when editing a quest and it will ring here automatically.</p>'
      }`;
    },
    mount() {
      clearInterval(timer);
      timer = setInterval(() => {
        const el = document.getElementById('next-in');
        const n = nextUp();
        if (el && n) el.textContent = untilText(n.at);
      }, 1000);
    },
    unmount() {
      clearInterval(timer);
    },
  };

  A.actions.alarmToggle = (el) => {
    const a = A.S.alarms.find((x) => x.id === el.dataset.id);
    if (!a) return;
    a.enabled = !a.enabled;
    A.sfx(a.enabled ? 'pop' : 'click');
    A.save();
  };
  A.actions.alarmDel = async (el) => {
    const a = A.S.alarms.find((x) => x.id === el.dataset.id);
    if (!a) return;
    if (await A.ui.confirm({ title: 'Delete this alarm?', text: esc(a.label || A.time12(a.time)), ok: 'Delete', danger: true })) {
      A.S.alarms = A.S.alarms.filter((x) => x.id !== a.id);
      A.save();
    }
  };
  A.actions.alarmNew = () => editor();
  A.actions.alarmEdit = (el) => editor(A.S.alarms.find((x) => x.id === el.dataset.id));
  A.actions.alarmTest = () => A.alarmEngine.test();
  A.actions.enableNotif = async () => {
    const r = await Notification.requestPermission();
    A.S.settings.notifications = r === 'granted';
    A.save();
    if (r === 'granted') A.ui.toast('Notifications enabled', { icon: '🔔' });
  };

  function editor(alarm) {
    const edit = !!alarm;
    const f = edit
      ? { ...alarm, days: alarm.days.slice() }
      : { label: '', time: (() => { const d = new Date(Date.now() + 3600e3); return `${A.p2(d.getHours())}:00`; })(), days: [0, 1, 2, 3, 4, 5, 6], tone: 'sunrise', habitId: '', once: false, enabled: true };
    const m = A.ui.modal({
      cls: 'editor',
      html: `<div class="modal-head"><h2>${edit ? 'Edit alarm' : 'New alarm'}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
        <div class="time-pick"><input id="al-time" type="time" class="input time-big" value="${esc(f.time)}"></div>
        <label class="field"><span>Label</span><input id="al-label" class="input" maxlength="40" placeholder="e.g. Time to hit the gym" value="${esc(f.label)}"></label>
        <div class="field"><span>Repeat</span><div class="days" id="al-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="day ${f.days.includes(d) ? 'on' : ''}" data-d="${d}">${A.DAYS[d].slice(0, 3)}</button>`).join('')}</div>
          <label class="check-row"><input type="checkbox" id="al-once" ${f.once ? 'checked' : ''}> <span>Ring only once, then switch off</span></label></div>
        <div class="field"><span>Sound</span><div class="tone-grid" id="al-tones">${Object.entries(A.TONES).map(([k, t]) => `<button type="button" class="tone ${f.tone === k ? 'on' : ''}" data-t="${k}">${icon('play', 12)} ${t.name}</button>`).join('')}</div></div>
        <label class="field"><span>Link to a quest <small class="muted">— ignoring the alarm then costs HP</small></span>
          <select id="al-habit" class="input"><option value="">None</option>${G.activeHabits().map((h) => `<option value="${h.id}" ${f.habitId === h.id ? 'selected' : ''}>${esc(h.icon)} ${esc(h.name)}</option>`).join('')}</select></label>
        <div class="row end gap sticky-actions"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="al-save">${edit ? 'Save' : 'Create alarm'}</button></div>`,
    });
    const $ = (s) => m.el.querySelector(s);
    m.el.addEventListener('click', (e) => {
      const d = e.target.closest('.day');
      if (d) {
        const v = +d.dataset.d;
        f.days = f.days.includes(v) ? f.days.filter((x) => x !== v) : [...f.days, v];
        d.classList.toggle('on');
        return A.sfx('click');
      }
      const t = e.target.closest('.tone');
      if (t) {
        f.tone = t.dataset.t;
        m.el.querySelectorAll('.tone').forEach((x) => x.classList.toggle('on', x === t));
        return A.previewTone(f.tone);
      }
      if (e.target.closest('#al-save')) {
        if (!$('#al-time').value) return A.sfx('error');
        if (!f.days.length) {
          A.sfx('error');
          return A.ui.toast('Pick at least one day', { icon: '📅', kind: 'warn' });
        }
        const data = { label: $('#al-label').value.trim(), time: $('#al-time').value, days: f.days, tone: f.tone, habitId: $('#al-habit').value, once: $('#al-once').checked, enabled: true };
        if (edit) Object.assign(alarm, data);
        else A.S.alarms.push({ id: A.uid(), ...data });
        // allow today's firing again if the time was moved
        Object.keys(A.S.alarmFired).forEach((k) => edit && k.startsWith('a:' + alarm.id) && delete A.S.alarmFired[k]);
        G.checkAch();
        A.sfx('pop');
        A.save();
        m.close();
      }
    });
  }
})();
