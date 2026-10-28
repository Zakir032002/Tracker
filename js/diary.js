/* Ascend: diary + day plans. Data layer shared by the Diary view, the Insights calendar,
   Today's agenda card and the side-panel bridge.
     A.S.diary[date] = { title, text, mood, words, rewarded, updatedAt }
     A.S.plans       = [{ id, date, text, time, done, rewarded }] */
(function () {
  'use strict';
  const A = window.A;
  const G = A.G;
  const D = (A.diary = {});

  D.MOODS = [
    { v: 1, e: '😞', name: 'Rough' },
    { v: 2, e: '😕', name: 'Meh' },
    { v: 3, e: '😐', name: 'Okay' },
    { v: 4, e: '🙂', name: 'Good' },
    { v: 5, e: '🤩', name: 'Great' },
  ];
  D.PROMPTS = [
    'What made today worth it?',
    'What is one thing you would do differently?',
    'Who are you grateful for today, and why?',
    'What drained your energy? What gave it back?',
    'Describe a small moment you want to remember.',
    'What did you avoid today? What is it really about?',
    'What are you proud of this week?',
    'Write to yourself one year from now.',
    'What is the one thing that would make tomorrow great?',
    'What did you learn today?',
    'Where did your attention go today?',
    'What would the best version of you have done today?',
    'What are you looking forward to?',
    'What is weighing on your mind? Put it on paper.',
    'Describe your perfect ordinary day.',
  ];
  D.prompt = (date, shuffle = 0) => {
    let h = shuffle;
    for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0;
    return D.PROMPTS[h % D.PROMPTS.length];
  };

  const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  const entries = () => A.S.diary || (A.S.diary = {});
  const plans = () => A.S.plans || (A.S.plans = []);

  D.entry = (date) => entries()[date] || null;
  D.hasEntry = (date) => {
    const e = entries()[date];
    return !!(e && (e.text.trim() || e.title.trim()));
  };
  D.mood = (v) => D.MOODS.find((m) => m.v === v) || null;

  /* silent: typing must not re-render the view under the cursor */
  D.save = (date, patch, silent) => {
    const all = entries();
    const e = all[date] || (all[date] = { title: '', text: '', mood: 0, words: 0, rewarded: false, updatedAt: 0 });
    Object.assign(e, patch);
    e.words = words(e.text);
    e.updatedAt = Date.now();
    if (!e.text.trim() && !e.title.trim() && !e.mood) delete all[date];
    let rewarded = false;
    if (all[date] && !e.rewarded && e.words >= 15) {
      e.rewarded = true;
      rewarded = true;
      G.addXp(8);
      G.addCoins(2);
      G.log('diary', 'Wrote a diary entry', { xp: 8 });
      A.sfx && A.sfx('check');
      A.ui.toast('<b>Entry saved</b><small>+8 XP · +2 coins</small>', { icon: '📖' });
      G.checkAch();
    }
    A.save(silent && !rewarded);
    return rewarded;
  };
  D.remove = (date) => {
    delete entries()[date];
    A.save();
  };

  /* ---- plans ---- */
  D.plansOn = (date) =>
    plans()
      .filter((p) => p.date === date)
      .sort((a, b) => (a.done === b.done ? (a.time || '99').localeCompare(b.time || '99') : a.done ? 1 : -1));
  D.hasPlan = (date) => plans().some((p) => p.date === date);
  D.addPlan = (date, text, time) => {
    text = String(text || '').trim().slice(0, 140);
    if (!text) return null;
    const p = { id: A.uid(), date, text, time: time || '', done: false, rewarded: false };
    plans().push(p);
    A.save();
    return p;
  };
  D.togglePlan = (id) => {
    const p = plans().find((x) => x.id === id);
    if (!p) return;
    p.done = !p.done;
    if (p.done && !p.rewarded) {
      p.rewarded = true;
      G.addXp(4);
      G.log('plan', `Did: ${p.text}`, { xp: 4 });
      A.bus.emit('plan-done', p);
    }
    G.checkAch();
    A.save();
  };
  D.delPlan = (id) => {
    A.S.plans = plans().filter((x) => x.id !== id);
    A.save();
  };
  D.editPlan = (id, text) => {
    const p = plans().find((x) => x.id === id);
    if (p && String(text).trim()) {
      p.text = String(text).trim().slice(0, 140);
      A.save(true);
    }
  };
  /* open plans between today and today+n (excluding today) */
  D.upcoming = (n = 14) => {
    const t = A.today();
    const end = A.addDays(t, n);
    return plans().filter((p) => p.date > t && p.date <= end && !p.done).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  };
  D.overdue = () => plans().filter((p) => p.date < A.today() && !p.done);

  /* ---- stats ---- */
  D.stats = () => {
    const days = Object.keys(entries()).filter(D.hasEntry).sort();
    const set = new Set(days);
    let streak = 0;
    let d = A.today();
    if (!set.has(d)) d = A.addDays(d, -1);
    while (set.has(d)) {
      streak++;
      d = A.addDays(d, -1);
    }
    let longest = 0;
    let run = 0;
    let prev = null;
    days.forEach((x) => {
      run = prev && A.addDays(prev, 1) === x ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = x;
    });
    const w = days.reduce((a, x) => a + (entries()[x].words || 0), 0);
    return { entries: days.length, words: w, streak, longest, plansDone: plans().filter((p) => p.done).length };
  };

  /* "On this day": same date a month / a year ago, if you wrote then */
  D.memories = (date) => {
    const d = A.parse(date);
    const out = [];
    [[0, 1, 'A month ago'], [0, 3, '3 months ago'], [0, 6, '6 months ago'], [1, 0, 'A year ago'], [2, 0, '2 years ago']].forEach(([y, m, label]) => {
      const x = new Date(d.getFullYear() - y, d.getMonth() - m, d.getDate());
      const k = A.fmt(x);
      if (D.hasEntry(k)) out.push({ date: k, label, entry: entries()[k] });
    });
    return out;
  };

  /* gentle reminder when a timed plan comes due (no penalty: plans are promises to yourself) */
  const notified = {};
  function tick() {
    if (!A.S.onboarded) return;
    const t = A.today();
    const nowM = A.nowMin();
    plans().forEach((p) => {
      if (p.date !== t || p.done || !p.time || notified[p.id]) return;
      const m = A.hmToMin(p.time);
      if (nowM < m || nowM - m > 60) return;
      notified[p.id] = 1;
      A.sfx && A.sfx('bell');
      A.ui.toast(`<b>${A.esc(p.text)}</b><small>Planned for ${A.time12(p.time)}</small>`, { icon: '🗓️', ms: 9000 });
      try {
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('🗓️ ' + p.text, { body: 'You planned this for now.', tag: 'ascend-plan-' + p.id, icon: 'assets/icon.svg' });
      } catch (e) {}
    });
  }
  setInterval(tick, 20000);
  setTimeout(tick, 4000);

  /* ---- shared UI helpers (Diary view, Insights day panel, Today agenda) ---- */
  const esc = A.esc;
  const icon = A.icon;
  D.planRows = (list, { showDate = false, empty = '' } = {}) =>
    list.length
      ? `<ul class="plan-list">${list
          .map(
            (p) => `<li class="plan ${p.done ? 'done' : ''}" data-id="${p.id}">
          <button class="plan-check" data-act="planToggle" data-id="${p.id}" data-quiet aria-label="${p.done ? 'Mark not done' : 'Mark done'}: ${esc(p.text)}">${p.done ? icon('check', 13) : ''}</button>
          <span class="plan-text">${esc(p.text)}</span>
          <small class="plan-when">${showDate ? A.prettyDate(p.date, { weekday: 'short', month: 'short', day: 'numeric' }) : ''}${showDate && p.time ? ' · ' : ''}${p.time ? A.time12(p.time) : ''}</small>
          <button class="plan-x" data-act="planDel" data-id="${p.id}" data-quiet aria-label="Remove plan">${icon('x', 13)}</button></li>`
          )
          .join('')}</ul>`
      : empty
      ? `<p class="muted small plan-empty">${empty}</p>`
      : '';
  D.planForm = (date, placeholder = 'Something to do that day…') =>
    `<div class="plan-add" data-date="${date}"><input class="input" maxlength="140" placeholder="${esc(placeholder)}" aria-label="New plan"><input class="input t" type="time" aria-label="Optional time"><button class="btn soft sm" data-act="planAdd" data-quiet>${icon('plus', 14)} Add</button></div>`;

  A.actions.planAdd = (el) => {
    const f = el.closest('.plan-add');
    if (!f) return;
    const [i, t] = f.querySelectorAll('input');
    const date = f.dataset.date;
    if (!i.value.trim()) {
      i.focus();
      return;
    }
    D.addPlan(date, i.value, t.value);
    A.sfx('pop');
    setTimeout(() => {
      const n = document.querySelector(`.plan-add[data-date="${date}"] input`);
      if (n) n.focus({ preventScroll: true });
    }, 80);
  };
  A.actions.planToggle = (el) => {
    D.togglePlan(el.dataset.id);
    const p = A.S.plans.find((x) => x.id === el.dataset.id);
    A.sfx(p && p.done ? 'check' : 'click');
  };
  A.actions.planDel = (el) => {
    D.delPlan(el.dataset.id);
    A.sfx('click');
  };
  /* open the Diary on a given day */
  A.actions.diaryOpen = (el) => {
    D.sel = el.dataset.d || A.today();
    D.month = D.sel.slice(0, 7) + '-01';
    A.ui.closeTop && A.ui.closeTop();
    A.go('diary');
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('.plan-add') && e.target.matches('input')) {
      e.preventDefault();
      e.target.closest('.plan-add').querySelector('button').click();
    }
  });
})();
