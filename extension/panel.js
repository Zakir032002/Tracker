/* Ascend side panel. Renders the snapshot the content script keeps in chrome.storage.local and
   queues commands (toggle, +1, notes) for the Ascend tab to apply. Updates show instantly (optimistic). */
(function () {
  'use strict';
  const root = document.getElementById('pin-root');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time12 = (hm) => {
    const [h, m] = hm.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const todayKey = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  let state = { snap: null, owner: null, at: 0, cmds: [] };

  function banner() {
    const s = state.snap;
    if (!s) return '';
    const stale = s.date !== todayKey();
    const queued = state.cmds.length;
    const away = !state.owner || Date.now() - state.owner.ts > 60000;
    if (stale) return '<p class="pin-banner">It’s a new day. Open Ascend to refresh your quests.</p>';
    if (queued && away) return `<p class="pin-banner">${queued} change${queued > 1 ? 's' : ''} waiting. They’ll apply when you open Ascend.</p>`;
    return '';
  }

  function html() {
    const s = state.snap;
    if (!s)
      return `<div class="pin"><div class="pin-hello"><b>Ascend</b><p>Open your Ascend page once and your quests will dock here.</p></div></div>`;
    const done = s.progress.done;
    const total = s.progress.total;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const q = s.quests
      .map(
        (h) => `<li class="pq ${h.done ? 'done' : ''} ${h.late ? 'late' : ''}" style="--c:${h.hue}">
          <button class="pq-check" data-p="toggle" data-id="${esc(h.id)}" aria-label="${h.done ? 'Undo' : 'Complete'} ${esc(h.name)}">${h.done ? '✓' : ''}</button>
          <div class="pq-main"><span class="pq-name">${esc(h.icon)} ${esc(h.name)}</span>
          <small>${h.target > 1 ? `${h.n}/${h.target}${h.unit ? ' ' + esc(h.unit) : ''}` : esc(h.diff)}${h.reminder ? ' · ' + time12(h.reminder) : ''}${h.late ? ' · overdue' : ''}</small></div>
          ${h.target > 1 && !h.done ? `<button class="pq-step" data-p="inc" data-id="${esc(h.id)}" aria-label="One more">+1</button>` : ''}
        </li>`
      )
      .join('');
    const notes = s.notes
      .map(
        (n) => `<li class="pn" style="--n:${n.hue}"><span class="pn-text" contenteditable="plaintext-only" data-p="edit" data-id="${esc(n.id)}" spellcheck="false">${esc(n.text)}</span>
          <button class="pn-x" data-p="del" data-id="${esc(n.id)}" aria-label="Remove note" title="Remove">×</button></li>`
      )
      .join('');
    const plans = (s.plans || [])
      .map(
        (p) => `<li class="pq ${p.done ? 'done' : ''}"><button class="pq-check" data-p="plan" data-id="${esc(p.id)}" aria-label="${p.done ? 'Undo' : 'Complete'} ${esc(p.text)}">${p.done ? '✓' : ''}</button>
          <div class="pq-main"><span class="pq-name">${esc(p.text)}</span>${p.time ? `<small>${time12(p.time)}</small>` : ''}</div></li>`
      )
      .join('');
    return `<div class="pin">
      ${banner()}
      <header><div><b>${esc(s.profile.avatar)} ${esc(s.profile.name)}</b><small>Lv ${s.level.n} · ${esc(s.level.rank)}</small></div>
        <div class="pin-stats"><span>♥ ${s.hp}</span><span>◎ ${s.coins}</span><span>🔥 ${s.streak}</span></div></header>
      <div class="pin-bar"><i style="width:${pct}%"></i></div>
      <p class="pin-sub">${done} of ${total} quests · ${pct}%</p>
      <ul class="pin-list">${q || '<li class="empty">Nothing stuck here. Turn on “Keep it on my screen” for a quest.</li>'}</ul>
      ${plans ? `<h4>Plans for today</h4><ul class="pin-list">${plans}</ul>` : ''}
      <h4>Sticky notes</h4>
      <ul class="pin-notes">${notes || '<li class="empty">Nothing stuck here yet.</li>'}</ul>
      <form class="pin-add" data-p="addform"><input name="t" maxlength="200" placeholder="Stick a note…" autocomplete="off"><button type="submit">Add</button></form>
    </div>`;
  }

  function render() {
    const s = state.snap;
    if (s) {
      document.documentElement.dataset.theme = s.theme || 'dark';
      document.documentElement.style.setProperty('--h', s.hue);
    }
    const a = document.activeElement;
    if (a && a.matches && a.matches('[contenteditable], input') && (a.value || a.textContent)) return;
    const y = window.scrollY;
    root.innerHTML = html();
    window.scrollTo(0, y);
  }

  const queue = (cmd) => {
    state.cmds = state.cmds.concat({ cmd, ts: Date.now() });
    chrome.storage.local.set({ cmds: state.cmds });
  };

  /* optimistic local edit so the panel reacts at once */
  function optimistic(cmd) {
    const s = state.snap;
    if (!s) return;
    const q = s.quests.find((x) => x.id === cmd.id);
    if (cmd.t === 'toggle' && q) {
      q.done = !q.done;
      q.n = q.done ? q.target : 0;
      s.progress.done += q.done ? 1 : -1;
    } else if (cmd.t === 'inc' && q) {
      q.n = Math.min(q.target, q.n + 1);
      if (q.n >= q.target && !q.done) {
        q.done = true;
        s.progress.done += 1;
      }
    } else if (cmd.t === 'noteDel') s.notes = s.notes.filter((n) => n.id !== cmd.id);
    else if (cmd.t === 'noteAdd') s.notes.push({ id: 'tmp' + Date.now(), text: cmd.text, hue: 48, pinned: true });
    else if (cmd.t === 'noteEdit') {
      const n = s.notes.find((x) => x.id === cmd.id);
      if (n) n.text = cmd.text;
    }
  }
  function run(cmd) {
    optimistic(cmd);
    queue(cmd);
    render();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b || b.tagName === 'FORM') return;
    const id = b.dataset.id;
    if (b.dataset.p === 'toggle') run({ t: 'toggle', id });
    else if (b.dataset.p === 'plan') run({ t: 'planToggle', id });
    else if (b.dataset.p === 'inc') run({ t: 'inc', id, d: 1 });
    else if (b.dataset.p === 'del') run({ t: 'noteDel', id });
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = e.target.elements.t.value.trim();
    e.target.elements.t.value = '';
    if (t) {
      document.activeElement && document.activeElement.blur();
      run({ t: 'noteAdd', text: t });
    }
  });
  document.addEventListener('focusout', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.p === 'edit') {
      queue({ t: 'noteEdit', id: el.dataset.id, text: el.textContent });
      setTimeout(render, 60);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.p === 'edit') {
      e.preventDefault();
      e.target.blur();
    }
  });

  async function load() {
    const v = await chrome.storage.local.get(['snap', 'owner', 'cmds', 'snapAt']);
    state = { snap: v.snap || null, owner: v.owner || null, at: v.snapAt || 0, cmds: v.cmds || [] };
    render();
  }
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local') return;
    if (c.snap) state.snap = c.snap.newValue || null;
    if (c.owner) state.owner = c.owner.newValue || null;
    if (c.cmds) state.cmds = c.cmds.newValue || [];
    render();
  });
  setInterval(render, 30000);
  load();
})();
