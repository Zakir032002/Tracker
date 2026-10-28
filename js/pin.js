/* Ascend: "Pin to screen". A small always-on-top window (Document Picture-in-Picture in Chrome/Edge,
   a compact popup elsewhere) with today's quests and your pinned sticky notes. It lives in the same
   page as the app, so it is always in sync. */
(function () {
  'use strict';
  const A = window.A;
  const esc = A.esc;
  let win = null;
  let off = null;
  let timer = 0;

  const abs = (href) => new URL(href, location.href).href;

  function html(s) {
    const pct = s.progress.total ? Math.round((s.progress.done / s.progress.total) * 100) : 0;
    const q = s.quests
      .map(
        (h) => `<li class="pq ${h.done ? 'done' : ''} ${h.late ? 'late' : ''}" style="--c:${h.hue}">
          <button class="pq-check" data-p="toggle" data-id="${h.id}" aria-label="${h.done ? 'Undo' : 'Complete'} ${esc(h.name)}">${h.done ? '✓' : ''}</button>
          <div class="pq-main"><span class="pq-name">${esc(h.icon)} ${esc(h.name)}</span>
          <small>${h.target > 1 ? `${h.n}/${h.target}${h.unit ? ' ' + esc(h.unit) : ''}` : esc(h.diff)}${h.reminder ? ' · ' + A.time12(h.reminder) : ''}${h.late ? ' · overdue' : ''}</small></div>
          ${h.target > 1 && !h.done ? `<button class="pq-step" data-p="inc" data-id="${h.id}" aria-label="One more">+1</button>` : ''}
        </li>`
      )
      .join('');
    const notes = s.notes
      .map(
        (n) => `<li class="pn" style="--n:${n.hue}"><span class="pn-text" contenteditable="plaintext-only" data-p="edit" data-id="${n.id}" spellcheck="false">${esc(n.text)}</span>
          <button class="pn-x" data-p="del" data-id="${n.id}" aria-label="Remove note" title="Remove">×</button></li>`
      )
      .join('');
    return `<div class="pin">
      <header><div><b>${esc(s.profile.avatar)} ${esc(s.profile.name)}</b><small>Lv ${s.level.n} · ${esc(s.level.rank)}</small></div>
        <div class="pin-stats"><span>♥ ${s.hp}</span><span>◎ ${A.fmtNum(s.coins)}</span><span>🔥 ${s.streak}</span></div></header>
      <div class="pin-bar"><i style="width:${pct}%"></i></div>
      <p class="pin-sub">${s.progress.done} of ${s.progress.total} quests · ${pct}%</p>
      <ul class="pin-list">${q || '<li class="empty">No quests left today.</li>'}</ul>
      <h4>Sticky notes</h4>
      <ul class="pin-notes">${notes || '<li class="empty">Nothing stuck here yet.</li>'}</ul>
      <form class="pin-add" data-p="addform"><input name="t" maxlength="200" placeholder="Stick a note…" autocomplete="off"><button type="submit">Add</button></form>
    </div>`;
  }

  function render() {
    if (!win || win.closed) return cleanup();
    const doc = win.document;
    const s = A.bridge.snapshot();
    doc.documentElement.dataset.theme = s.theme;
    doc.documentElement.style.setProperty('--h', s.hue);
    const root = doc.getElementById('pin-root');
    if (!root) return;
    // don't clobber a note someone is typing in
    if (doc.activeElement && doc.activeElement.matches && doc.activeElement.matches('[contenteditable], input')) return;
    root.innerHTML = html(s);
  }

  function wire(doc) {
    doc.addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      const id = b.dataset.id;
      const k = b.dataset.p;
      if (k === 'toggle') A.bridge.exec({ t: 'toggle', id });
      else if (k === 'inc') A.bridge.exec({ t: 'inc', id, d: 1 });
      else if (k === 'del') A.bridge.exec({ t: 'noteDel', id });
      A.sfx(k === 'toggle' ? 'check' : 'click');
    });
    doc.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = e.target.elements.t.value.trim();
      if (t) A.bridge.exec({ t: 'noteAdd', text: t });
      e.target.elements.t.value = '';
    });
    doc.addEventListener('focusout', (e) => {
      const el = e.target;
      if (el.dataset && el.dataset.p === 'edit') {
        A.bridge.exec({ t: 'noteEdit', id: el.dataset.id, text: el.textContent });
        setTimeout(render, 50);
      }
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.dataset && e.target.dataset.p === 'edit') {
        e.preventDefault();
        e.target.blur();
      }
    });
  }

  function cleanup() {
    if (off) off();
    off = null;
    clearInterval(timer);
    win = null;
  }

  async function open() {
    if (win && !win.closed) {
      win.focus && win.focus();
      return;
    }
    let w = null;
    try {
      if ('documentPictureInPicture' in window) w = await window.documentPictureInPicture.requestWindow({ width: 340, height: 580 });
    } catch (e) {
      w = null;
    }
    if (!w) {
      w = window.open('', 'ascend-pin', 'popup=yes,width=340,height=580');
      if (!w) {
        A.ui.toast('Your browser blocked the pin window. Allow pop-ups for this page.', { icon: '📌', kind: 'warn' });
        return;
      }
      w.document.title = 'Ascend';
    }
    win = w;
    const doc = w.document;
    doc.head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ascend</title>';
    ['css/theme.css', 'css/rose.css', 'css/pin.css'].forEach((h) => {
      const l = doc.createElement('link');
      l.rel = 'stylesheet';
      l.href = abs(h);
      doc.head.appendChild(l);
    });
    doc.body.innerHTML = '<div id="pin-root"></div>';
    doc.body.className = 'pin-body';
    wire(doc);
    render();
    off = A.bus.on('change', A.debounce(render, 120));
    timer = setInterval(render, 30000);
    w.addEventListener('pagehide', cleanup);
    A.ui.toast('Pinned. It stays on top of your other windows.', { icon: '📌', ms: 2600 });
  }

  A.pin = { open, get active() { return !!(win && !win.closed); } };
  A.actions.pinOpen = () => open();
})();
