/* Ascend — Quests (habit manager + editor) */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon, G } = { esc: A.esc, icon: A.icon, G: A.G };

  function schedText(h) {
    const d = h.days;
    if (d.length === 7) return 'Every day';
    if (d.length === 5 && !d.includes(0) && !d.includes(6)) return 'Weekdays';
    if (d.length === 2 && d.includes(0) && d.includes(6)) return 'Weekends';
    return d.slice().sort().map((x) => A.DAYS[x]).join(' · ');
  }

  function card(h) {
    const D = G.DIFF[h.diff] || G.DIFF.medium;
    const st = G.habitStreak(h);
    const best = G.habitBest(h);
    const rate = G.habitRate(h, 30);
    return `<article class="card glass quest-card ${h.archived ? 'archived' : ''}" style="--c:${h.hue}">
      <div class="qc-top"><span class="q-icon lg">${esc(h.icon)}</span>
        <div class="grow"><h3>${esc(h.name)}</h3>
          <div class="q-meta"><span class="chip d-${h.diff}">${D.label}</span><span class="chip">${schedText(h)}</span>
          ${h.target > 1 ? `<span class="chip">${h.target} ${esc(h.unit || 'times')}</span>` : ''}
          ${h.reminder ? `<span class="chip time">${icon('clock', 12)} ${A.time12(h.reminder)}</span>` : ''}</div></div>
        <div class="qc-actions">
          <button class="icon-btn sm" data-act="editQuest" data-id="${h.id}" aria-label="Edit">${icon('edit', 16)}</button>
          <button class="icon-btn sm" data-act="${h.archived ? 'restoreQuest' : 'archiveQuest'}" data-id="${h.id}" aria-label="${h.archived ? 'Restore' : 'Archive'}">${icon(h.archived ? 'undo' : 'download', 16)}</button>
          <button class="icon-btn sm danger" data-act="deleteQuest" data-id="${h.id}" aria-label="Delete">${icon('trash', 16)}</button>
        </div></div>
      <div class="qc-stats">
        <div><b>${st}</b><span>streak</span></div><div><b>${best}</b><span>best</span></div>
        <div><b>${rate === null ? '–' : Math.round(rate * 100) + '%'}</b><span>30-day rate</span></div>
        <div class="spark">${spark(h)}</div>
      </div>
    </article>`;
  }

  /* last 28 days as tiny cells */
  function spark(h) {
    const today = A.today();
    let out = '';
    for (let i = 27; i >= 0; i--) {
      const d = A.addDays(today, -i);
      const sched = h.days.includes(A.dow(d)) && d >= h.createdAt;
      const done = G.isDone(h, d);
      out += `<i class="${!sched ? 'off' : done ? 'on' : d === today ? 'pend' : 'miss'}"></i>`;
    }
    return out;
  }

  A.views.quests = {
    title: 'Quests',
    render(root) {
      const act = A.S.habits.filter((h) => !h.archived);
      const arch = A.S.habits.filter((h) => h.archived);
      root.innerHTML = `
      <div class="page-head row between wrap">
        <div><p class="eyebrow">Your habits</p><h1>Quest <em>log</em></h1>
        <p class="sub">${act.length} active quest${act.length === 1 ? '' : 's'}. Harder quests pay more, and hurt more when skipped.</p></div>
        <button class="btn primary" data-act="newQuest">${icon('plus', 18)} New quest</button>
      </div>
      ${act.length ? `<div class="quest-cards">${act.map(card).join('')}</div>` : `<div class="card glass empty-state"><div class="big-emoji">📜</div><h3>No quests yet</h3><p class="muted">Pick a template below or craft your own.</p></div>`}
      <div class="section-head"><h2>Quick templates</h2></div>
      <div class="preset-grid wide">${A.ui.PRESETS.map((p, i) => `<button class="preset" data-act="addPreset" data-i="${i}" style="--c:${p.hue}"><span>${p.icon}</span>${esc(p.name)}</button>`).join('')}</div>
      ${arch.length ? `<div class="section-head"><h2>Archived</h2></div><div class="quest-cards">${arch.map(card).join('')}</div>` : ''}`;
    },
  };

  A.actions.addPreset = (el) => {
    const p = A.ui.PRESETS[+el.dataset.i];
    G.addHabit(p);
    A.sfx('pop');
    A.ui.toast(`Added <b>${esc(p.name)}</b>`, { icon: p.icon });
  };
  A.actions.newQuest = () => openEditor();
  A.actions.editQuest = (el) => openEditor(A.S.habits.find((h) => h.id === el.dataset.id));
  A.actions.archiveQuest = (el) => {
    G.archiveHabit(el.dataset.id, true);
    A.ui.toast('Quest archived. History is kept.', { icon: '📦' });
  };
  A.actions.restoreQuest = (el) => G.archiveHabit(el.dataset.id, false);
  A.actions.deleteQuest = async (el) => {
    const h = A.S.habits.find((x) => x.id === el.dataset.id);
    if (!h) return;
    const ok = await A.ui.confirm({
      title: `Delete “${h.name}”?`,
      text: 'This removes the quest for good. Consider archiving instead to keep its history.',
      ok: 'Delete',
      danger: true,
    });
    if (ok) {
      G.removeHabit(h.id);
      A.sfx('uncheck');
    }
  };

  function openEditor(habit) {
    const edit = !!habit;
    const f = edit
      ? { ...habit, days: habit.days.slice() }
      : { name: '', icon: '✨', hue: A.ui.HUES[A.S.habits.length % A.ui.HUES.length], diff: 'medium', days: [0, 1, 2, 3, 4, 5, 6], target: 1, unit: '', reminder: '', sticky: true };
    const dayBtns = () =>
      [1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="day ${f.days.includes(d) ? 'on' : ''}" data-d="${d}">${A.DAYS[d].slice(0, 3)}</button>`).join('');
    const diffBtns = () =>
      Object.entries(G.DIFF)
        .map(
          ([k, D]) => `<button type="button" class="seg-btn ${f.diff === k ? 'on' : ''}" data-diff="${k}"><b>${D.label}</b><small>+${D.xp} XP</small><small class="neg">−${D.hp} HP</small></button>`
        )
        .join('');
    const m = A.ui.modal({
      cls: 'editor',
      html: `<div class="modal-head"><h2>${edit ? 'Edit quest' : 'New quest'}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
        <div class="editor-preview" id="ed-prev"></div>
        <label class="field"><span>Name</span><input id="ed-name" class="input" maxlength="48" placeholder="e.g. Read 20 pages" value="${esc(f.name)}"></label>
        <div class="field"><span>Icon</span><div class="emoji-grid" id="ed-emo">${A.ui.EMOJI.map((e) => `<button type="button" class="emo ${e === f.icon ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
        <div class="field"><span>Colour</span><div class="swatches" id="ed-hue">${A.ui.HUES.map((h) => `<button type="button" class="sw ${h === f.hue ? 'on' : ''}" data-h="${h}" style="--c:${h}" aria-label="Hue ${h}"></button>`).join('')}</div></div>
        <div class="field"><span>Difficulty <small class="muted">— reward vs. penalty if you skip</small></span><div class="seg full" id="ed-diff">${diffBtns()}</div></div>
        <div class="field"><span>Repeat on</span><div class="days" id="ed-days">${dayBtns()}</div>
          <div class="row gap sm-top"><button type="button" class="link" data-q="all">Every day</button><button type="button" class="link" data-q="wk">Weekdays</button><button type="button" class="link" data-q="we">Weekends</button></div></div>
        <div class="row gap wrap">
          <div class="field grow"><span>Times per day</span>
            <div class="num-step"><button type="button" class="icon-btn sm" data-n="-1">${icon('minus', 16)}</button><b id="ed-target">${f.target}</b><button type="button" class="icon-btn sm" data-n="1">${icon('plus', 16)}</button></div></div>
          <label class="field grow"><span>Unit <small class="muted">(optional)</small></span><input id="ed-unit" class="input" maxlength="12" placeholder="glasses, pages…" value="${esc(f.unit)}"></label>
          <label class="field grow"><span>Reminder alarm</span><input id="ed-rem" type="time" class="input" value="${esc(f.reminder)}"></label>
        </div>
        <div class="field stick-row"><div><span>Keep it on my screen</span><small class="muted">Shows in the Chrome side panel and the pinned window until it's done or removed.</small></div>
          <button type="button" class="switch ${f.sticky !== false ? 'on' : ''}" id="ed-sticky" role="switch" aria-checked="${f.sticky !== false}" aria-label="Keep on my screen"><i></i></button></div>
        <div class="row between gap sticky-actions">
          ${edit ? `<button type="button" class="btn ghost danger-t" id="ed-del">${icon('trash', 16)} Delete</button>` : '<span></span>'}
          <div class="row gap"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="ed-save">${edit ? 'Save changes' : 'Create quest'}</button></div>
        </div>`,
    });
    const $ = (s) => m.el.querySelector(s);
    const preview = () => {
      const D = G.DIFF[f.diff];
      $('#ed-prev').style.setProperty('--c', f.hue);
      $('#ed-prev').innerHTML = `<span class="q-icon lg">${esc(f.icon)}</span><div><h3>${esc($('#ed-name').value || 'Your quest')}</h3><div class="q-meta"><span class="chip d-${f.diff}">${D.label}</span><span class="chip xp">+${D.xp} XP</span><span class="chip">${schedText(f)}</span></div></div>`;
    };
    preview();
    $('#ed-name').addEventListener('input', preview);
    m.el.addEventListener('click', async (e) => {
      const t = e.target;
      const emo = t.closest('#ed-emo .emo');
      if (emo) {
        f.icon = emo.dataset.e;
        m.el.querySelectorAll('#ed-emo .emo').forEach((x) => x.classList.toggle('on', x === emo));
        A.sfx('pop');
        return preview();
      }
      const sw = t.closest('.sw');
      if (sw) {
        f.hue = +sw.dataset.h;
        m.el.querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x === sw));
        A.sfx('click');
        return preview();
      }
      const df = t.closest('[data-diff]');
      if (df) {
        f.diff = df.dataset.diff;
        m.el.querySelectorAll('[data-diff]').forEach((x) => x.classList.toggle('on', x === df));
        A.sfx('click');
        return preview();
      }
      const dy = t.closest('.day');
      if (dy) {
        const d = +dy.dataset.d;
        f.days = f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d];
        dy.classList.toggle('on');
        A.sfx('click');
        return preview();
      }
      const q = t.closest('[data-q]');
      if (q) {
        f.days = q.dataset.q === 'all' ? [0, 1, 2, 3, 4, 5, 6] : q.dataset.q === 'wk' ? [1, 2, 3, 4, 5] : [0, 6];
        m.el.querySelectorAll('.day').forEach((x) => x.classList.toggle('on', f.days.includes(+x.dataset.d)));
        return preview();
      }
      const n = t.closest('[data-n]');
      if (n) {
        f.target = A.clamp(f.target + +n.dataset.n, 1, 99);
        $('#ed-target').textContent = f.target;
        return A.sfx('click');
      }
      const st = t.closest('#ed-sticky');
      if (st) {
        f.sticky = f.sticky === false;
        st.classList.toggle('on', f.sticky);
        st.setAttribute('aria-checked', f.sticky);
        return A.sfx('click');
      }
      if (t.closest('#ed-del')) {
        const ok = await A.ui.confirm({ title: `Delete “${habit.name}”?`, text: 'This cannot be undone.', ok: 'Delete', danger: true });
        if (ok) {
          G.removeHabit(habit.id);
          m.close();
        }
        return;
      }
      if (t.closest('#ed-save')) {
        const name = $('#ed-name').value.trim();
        if (!name) {
          A.sfx('error');
          $('#ed-name').classList.add('invalid');
          $('#ed-name').focus();
          return;
        }
        if (!f.days.length) {
          A.sfx('error');
          return A.ui.toast('Pick at least one day', { icon: '📅', kind: 'warn' });
        }
        const data = { name, icon: f.icon, hue: f.hue, diff: f.diff, days: f.days, target: f.target, unit: $('#ed-unit').value.trim(), reminder: $('#ed-rem').value, sticky: f.sticky !== false };
        if (edit) G.updateHabit(habit.id, data);
        else {
          G.addHabit(data);
          A.sfx('pop');
        }
        m.close();
      }
    });
    setTimeout(() => !edit && $('#ed-name').focus({ preventScroll: true }), 350);
  }
  A.openQuestEditor = openEditor;
})();
