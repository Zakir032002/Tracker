/* Ascend: command palette. Ctrl/Cmd+K (or "/"): jump anywhere, complete a quest, add a plan,
   switch theme, or search your diary and notes. */
(function () {
  'use strict';
  const A = window.A;
  const G = A.G;
  const { esc, icon } = { esc: A.esc, icon: A.icon };

  const NAVS = [['today', 'Today'], ['quests', 'Quests'], ['insights', 'Insights'], ['diary', 'Diary'], ['notes', 'Notes'], ['alarms', 'Alarms'], ['focus', 'Focus'], ['sanctuary', 'Sanctuary'], ['vault', 'Vault'], ['settings', 'Settings']];

  function commands() {
    const out = [];
    const t = A.today();
    NAVS.forEach(([id, label]) => out.push({ g: 'Go to', icon: id === 'sanctuary' ? 'waves' : id === 'vault' ? 'trophy' : id, label, run: () => A.go(id) }));
    out.push({ g: 'Create', icon: 'plus', label: 'New quest', hint: 'N', run: () => A.openQuestEditor() });
    out.push({ g: 'Create', icon: 'diary', label: "Write today's diary", run: () => A.actions.diaryOpen({ dataset: { d: t } }) });
    out.push({
      g: 'Create',
      icon: 'calendar',
      label: 'Add a plan for today…',
      run: () => {
        A.actions.diaryOpen({ dataset: { d: t } });
        setTimeout(() => {
          const i = document.querySelector('.plan-add input');
          if (i) i.focus();
        }, 900);
      },
    });
    out.push({ g: 'Create', icon: 'notes', label: 'New sticky note', run: () => (A.go('notes'), setTimeout(() => A.actions.noteNew && A.actions.noteNew(), 900)) });
    G.scheduledOn(t)
      .filter((h) => !G.isDone(h, t))
      .forEach((h) => out.push({ g: 'Complete quest', icon: 'check', label: `${h.icon} ${h.name}`, run: () => G.toggle(h.id) }));
    out.push({ g: 'Do', icon: 'pin', label: 'Pin quests to screen', run: () => A.pin && A.pin.open() });
    out.push({ g: 'Do', icon: 'spark', label: 'Switch theme', hint: 'Obsidian · Bone · Rosé', run: () => A.actions.cycleTheme(null, null) });
    out.push({ g: 'Do', icon: 'focus', label: 'Start a focus session', run: () => (A.go('focus'), setTimeout(() => A.actions.focusStart && A.actions.focusStart(), 900)) });
    out.push({ g: 'Do', icon: 'download', label: 'Export backup', run: () => A.exportJSON && A.exportJSON() });
    return out;
  }

  /* subsequence match with a bonus for word starts; returns a score or -1 */
  function score(q, text) {
    q = q.toLowerCase();
    text = text.toLowerCase();
    if (!q) return 0;
    const at = text.indexOf(q);
    if (at >= 0) return 100 - at - text.length * 0.1;
    let i = 0;
    let s = 0;
    for (let j = 0; j < text.length && i < q.length; j++) {
      if (text[j] === q[i]) {
        s += j === 0 || text[j - 1] === ' ' ? 3 : 1;
        i++;
      }
    }
    return i === q.length ? s : -1;
  }

  function search(q) {
    const cmds = commands();
    const out = [];
    cmds.forEach((c) => {
      const s = score(q, c.label + ' ' + c.g);
      if (s >= 0) out.push({ ...c, s });
    });
    out.sort((a, b) => b.s - a.s);
    let res = out.slice(0, q ? 8 : 12);
    if (q.length >= 2) {
      const low = q.toLowerCase();
      Object.keys(A.S.diary || {})
        .sort()
        .reverse()
        .filter((k) => (A.S.diary[k].title + ' ' + A.S.diary[k].text).toLowerCase().includes(low))
        .slice(0, 3)
        .forEach((k) => {
          const e = A.S.diary[k];
          res.push({ g: 'Diary', icon: 'diary', label: (e.title || e.text).slice(0, 60), hint: A.prettyDate(k, { month: 'short', day: 'numeric', year: 'numeric' }), run: () => A.actions.diaryOpen({ dataset: { d: k } }) });
        });
      (A.S.plans || [])
        .filter((p) => p.text.toLowerCase().includes(low))
        .slice(0, 3)
        .forEach((p) => res.push({ g: 'Plan', icon: 'calendar', label: p.text, hint: A.prettyDate(p.date, { month: 'short', day: 'numeric' }), run: () => A.actions.diaryOpen({ dataset: { d: p.date } }) }));
      A.S.notes
        .filter((n) => n.text.toLowerCase().includes(low))
        .slice(0, 3)
        .forEach((n) => res.push({ g: 'Note', icon: 'notes', label: n.text.slice(0, 60), run: () => A.go('notes') }));
    }
    return res;
  }

  let open = false;
  function show() {
    if (open) return;
    if (document.querySelector('#ring')) return;
    open = true;
    A.sfx && A.sfx('tab');
    const m = A.ui.modal({
      cls: 'palette',
      onClose: () => (open = false),
      html: `<label class="pal-in">${icon('search', 18)}<input id="pal-q" placeholder="Type a command, a quest, or search your diary…" autocomplete="off" spellcheck="false" aria-label="Command palette"><kbd>esc</kbd></label><ul class="pal-list" id="pal-list" role="listbox"></ul>
        <p class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> run</span><span class="grow"></span><span>Ascend</span></p>`,
    });
    const q = m.el.querySelector('#pal-q');
    const list = m.el.querySelector('#pal-list');
    let items = [];
    let at = 0;
    const paint = () => {
      let last = '';
      list.innerHTML = items.length
        ? items
            .map((c, i) => {
              const head = c.g !== last ? `<li class="pal-g" role="presentation">${esc(c.g)}</li>` : '';
              last = c.g;
              return `${head}<li><button class="pal-i ${i === at ? 'on' : ''}" data-i="${i}" role="option" aria-selected="${i === at}"><i>${icon(c.icon, 16)}</i><span>${esc(c.label)}</span>${c.hint ? `<small>${esc(c.hint)}</small>` : ''}</button></li>`;
            })
            .join('')
        : '<li class="pal-empty">Nothing matches that.</li>';
      const on = list.querySelector('.on');
      if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const refresh = () => {
      items = search(q.value.trim());
      at = 0;
      paint();
    };
    const run = (i) => {
      const c = items[i];
      if (!c) return;
      m.close();
      setTimeout(() => c.run(), 120);
    };
    q.addEventListener('input', refresh);
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        at = (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
        paint();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        run(at);
      }
    });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) run(+b.dataset.i);
    });
    list.addEventListener('pointermove', (e) => {
      const b = e.target.closest('[data-i]');
      if (b && +b.dataset.i !== at) {
        at = +b.dataset.i;
        list.querySelectorAll('.pal-i').forEach((x) => x.classList.toggle('on', +x.dataset.i === at));
      }
    });
    refresh();
    setTimeout(() => q.focus(), 60);
  }

  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches && e.target.matches('input, textarea, select, [contenteditable]');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (!open) show();
      return;
    }
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !document.querySelector('.modal-wrap')) {
      e.preventDefault();
      show();
    }
  });
  A.actions.palette = () => show();
  A.palette = { open: show };
})();
