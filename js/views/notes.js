/* Ascend — Sticky notes board (drag, resize, pin, colour, auto-save) */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon } = { esc: A.esc, icon: A.icon };

  const HUES = [48, 340, 160, 200, 270, 25];
  let lastDeleted = null;
  let zTop = 10;

  const find = (id) => A.S.notes.find((n) => n.id === id);
  const boardEl = () => document.getElementById('board');

  function noteHtml(n) {
    return `<div class="note glass ${n.pinned ? 'pinned' : ''}" data-id="${n.id}" style="--n:${n.hue};--rot:${n.rot}deg;z-index:${n.z || 1}">
      <div class="note-head"><span class="grip" aria-hidden="true"><i></i><i></i><i></i></span>
        <div class="note-tools">
          <button class="icon-btn xs ${n.pinned ? 'on' : ''}" data-act="notePin" data-id="${n.id}" data-quiet aria-label="Pin to Today" title="Pin to Today">${icon('pin', 14)}</button>
          <button class="icon-btn xs" data-act="noteColor" data-id="${n.id}" data-quiet aria-label="Change colour" title="Change colour"><i class="dot"></i></button>
          <button class="icon-btn xs" data-act="noteDel" data-id="${n.id}" data-quiet aria-label="Delete note" title="Delete">${icon('x', 14)}</button>
        </div></div>
      <textarea class="note-text" data-id="${n.id}" placeholder="Write something…" spellcheck="false" aria-label="Note text">${esc(n.text)}</textarea>
      <div class="note-foot"><small>${A.ago(n.updatedAt || n.createdAt)}</small></div>
      <span class="note-resize" aria-hidden="true"></span>
    </div>`;
  }

  function layout() {
    const b = boardEl();
    if (!b) return;
    const W = b.clientWidth;
    let maxY = 520;
    b.querySelectorAll('.note').forEach((el) => {
      const n = find(el.dataset.id);
      if (!n) return;
      const w = Math.min(n.w, W - 8);
      el.style.width = w + 'px';
      el.style.height = n.h + 'px';
      el.style.left = A.clamp(n.x, 0, Math.max(0, W - w)) + 'px';
      el.style.top = n.y + 'px';
      maxY = Math.max(maxY, n.y + n.h + 140);
    });
    b.style.minHeight = maxY + 'px';
  }

  function renderBoard() {
    const b = boardEl();
    if (!b) return;
    b.innerHTML = A.S.notes.map(noteHtml).join('');
    const empty = document.getElementById('notes-empty');
    if (empty) empty.hidden = A.S.notes.length > 0;
    layout();
  }

  function addNote(text = '') {
    const b = boardEl();
    const W = b ? b.clientWidth : 800;
    const cw = 250;
    const cols = Math.max(1, Math.floor(W / cw));
    let x = 0;
    let y = 0;
    for (let i = 0; i < 80; i++) {
      x = (i % cols) * cw;
      y = Math.floor(i / cols) * 230;
      if (!A.S.notes.some((n) => Math.abs(n.x - x) < 50 && Math.abs(n.y - y) < 50)) break;
    }
    const n = {
      id: A.uid(),
      text,
      hue: HUES[A.S.notes.length % HUES.length],
      x,
      y,
      w: 224,
      h: 210,
      z: ++zTop,
      rot: +A.rand(-1.8, 1.8).toFixed(1),
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    A.S.notes.push(n);
    A.G.checkAch();
    A.save(true);
    renderBoard();
    A.sfx('pop');
    const ta = b && b.querySelector(`.note[data-id="${n.id}"] textarea`);
    if (ta) {
      ta.focus();
      ta.closest('.note').classList.add('born');
    }
  }

  A.views.notes = {
    title: 'Notes',
    render(root) {
      zTop = Math.max(10, ...A.S.notes.map((n) => n.z || 1));
      root.innerHTML = `
      <div class="page-head row between wrap">
        <div><p class="eyebrow">Brain dump</p><h1>Sticky <em>notes</em></h1>
        <p class="sub">Drag by the top bar, resize from the corner. Pin a note to keep it on your Today screen. Everything saves as you type.</p></div>
        <button class="btn primary" data-act="noteNew">${icon('plus', 18)} New note</button>
      </div>
      <div id="notes-empty" class="card glass empty-state" ${A.S.notes.length ? 'hidden' : ''}><div class="big-emoji">🗒️</div><h3>No notes yet</h3><p class="muted">Capture ideas, reminders, motivation quotes. Anything.</p><button class="btn primary" data-act="noteNew">${icon('plus', 16)} Create a note</button></div>
      <div id="board" class="board">${A.S.notes.map(noteHtml).join('')}</div>`;
      bindBoard();
      layout();
    },
    update() {
      /* live view: the board manages its own DOM */
    },
    mount() {
      layout();
    },
  };

  function bindBoard() {
    const b = boardEl();
    b.addEventListener('input', (e) => {
      const ta = e.target.closest('.note-text');
      if (!ta) return;
      const n = find(ta.dataset.id);
      if (!n) return;
      n.text = ta.value;
      n.updatedAt = Date.now();
      A.save(true);
    });
    b.addEventListener('focusin', (e) => {
      const el = e.target.closest('.note');
      if (el) front(el);
    });
    b.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.note');
      if (!el) return;
      const n = find(el.dataset.id);
      if (!n) return;
      const handle = e.target.closest('.note-resize');
      const head = e.target.closest('.note-head');
      if (!handle && !(head && !e.target.closest('button'))) return;
      e.preventDefault();
      front(el);
      const sx = e.clientX;
      const sy = e.clientY;
      const o = { x: n.x, y: n.y, w: n.w, h: n.h };
      const W = b.clientWidth;
      el.classList.add(handle ? 'resizing' : 'dragging');
      const target = handle || head;
      try {
        target.setPointerCapture(e.pointerId);
      } catch (err) {}
      const mv = (ev) => {
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;
        if (handle) {
          n.w = A.clamp(o.w + dx, 170, Math.min(560, W));
          n.h = A.clamp(o.h + dy, 130, 640);
        } else {
          n.x = A.clamp(o.x + dx, 0, Math.max(0, W - Math.min(n.w, W)));
          n.y = Math.max(0, o.y + dy);
        }
        layout();
      };
      const up = () => {
        target.removeEventListener('pointermove', mv);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        el.classList.remove('dragging', 'resizing');
        A.save(true);
      };
      target.addEventListener('pointermove', mv);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    });
  }

  function front(el) {
    const n = find(el.dataset.id);
    if (!n) return;
    if ((n.z || 0) < zTop || !n.z) {
      n.z = ++zTop;
      el.style.zIndex = n.z;
    }
  }

  A.actions.noteNew = () => addNote();
  A.actions.notePin = (el) => {
    const n = find(el.dataset.id);
    if (!n) return;
    n.pinned = !n.pinned;
    A.sfx(n.pinned ? 'pop' : 'click');
    A.save(true);
    const note = el.closest('.note');
    note.classList.toggle('pinned', n.pinned);
    el.classList.toggle('on', n.pinned);
    if (n.pinned) A.ui.toast('Pinned to your Today screen', { icon: '📌', ms: 2200 });
  };
  A.actions.noteColor = (el) => {
    const n = find(el.dataset.id);
    if (!n) return;
    n.hue = HUES[(HUES.indexOf(n.hue) + 1) % HUES.length];
    el.closest('.note').style.setProperty('--n', n.hue);
    A.sfx('click');
    A.save(true);
  };
  A.actions.noteDel = (el) => {
    const n = find(el.dataset.id);
    if (!n) return;
    lastDeleted = n;
    A.S.notes = A.S.notes.filter((x) => x.id !== n.id);
    A.save(true);
    A.sfx('uncheck');
    renderBoard();
    A.ui.toast(`Note deleted <button class="link" data-act="noteUndo">Undo</button>`, { icon: '🗑️', ms: 5000 });
  };
  A.actions.noteUndo = () => {
    if (!lastDeleted) return;
    A.S.notes.push(lastDeleted);
    lastDeleted = null;
    A.save(true);
    renderBoard();
    A.sfx('pop');
  };
})();
