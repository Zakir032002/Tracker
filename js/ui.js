/* Ascend: UI shell. Theme, HUD, nav, router with curtain, modals, toasts,
   3D placement/sync, and reactions to game events. */
(function () {
  'use strict';
  const A = window.A;
  const { $, $$, esc, icon } = A;
  const ui = (A.ui = {});
  A.views = {};
  A.actions = {};
  const M = () => A.motion;

  /* ---------- theme ---------- */
  A.THEMES = [
    { id: 'dark', name: 'Obsidian', bg: '#0a0908' },
    { id: 'light', name: 'Bone', bg: '#ece6da' },
    { id: 'rose', name: 'Rosé Aurum', bg: '#f8e8e6' },
  ];
  A.resolvedTheme = () => {
    const t = A.S.settings.theme;
    return t === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  };
  A.accentHue = () => (A.resolvedTheme() === 'rose' ? 343 : A.S.settings.accent);
  A.applyTheme = () => {
    const s = A.S.settings;
    if (!s.v2) {
      s.v2 = true;
      s.accent = 24; // v1 shipped neon hues; reset to the new palette once
    }
    const t = A.resolvedTheme();
    const root = document.documentElement;
    root.dataset.theme = t;
    root.style.setProperty('--h', A.accentHue());
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = (A.THEMES.find((x) => x.id === t) || A.THEMES[0]).bg;
    sync3D();
  };

  A.setTheme = (id, ev) => {
    if (A.S.settings.theme === id) return;
    const from = A.resolvedTheme();
    A.S.settings.theme = id;
    const to = A.resolvedTheme();
    const commit = () => {
      A.applyTheme();
      A.save();
      A.rerender && A.rerender();
    };
    if (id === 'auto' || from === to || !window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) return commit();
    const x = ev && ev.clientX ? ev.clientX : innerWidth - 60;
    const y = ev && ev.clientY ? ev.clientY : 40;
    const wipe = document.createElement('div');
    wipe.style.cssText = `position:fixed;inset:0;z-index:9990;pointer-events:none;background:${(A.THEMES.find((t) => t.id === to) || A.THEMES[0]).bg};clip-path:circle(0px at ${x}px ${y}px)`;
    document.body.appendChild(wipe);
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 20;
    if (to === 'rose' && A.fx && A.fx.sparkleBurst) A.fx.sparkleBurst(x, y);
    A.sfx && A.sfx(to === 'rose' ? 'check' : 'click');
    gsap.to(wipe, {
      clipPath: `circle(${r}px at ${x}px ${y}px)`,
      duration: 0.7,
      ease: 'power3.inOut',
      onComplete: () => {
        commit();
        gsap.to(wipe, { opacity: 0, duration: 0.45, ease: 'power1.out', onComplete: () => wipe.remove() });
      },
    });
  };
  A.actions.cycleTheme = (el, e) => {
    const ids = A.THEMES.map((t) => t.id);
    const cur = A.resolvedTheme();
    A.setTheme(ids[(ids.indexOf(cur) + 1) % ids.length], e);
  };

  /* ---------- modal system ---------- */
  const stack = [];
  const queue = [];
  const apis = new WeakMap();
  ui.modal = ({ html, cls = '', dismiss = true, onClose } = {}) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal-scrim"></div><div class="modal glass ${cls}" role="dialog" aria-modal="true" tabindex="-1" data-lenis-prevent>${html}</div>`;
    $('#overlay').appendChild(wrap);
    M().lock(true);
    let closed = false;
    const api = {
      el: wrap.querySelector('.modal'),
      dismiss,
      close(result) {
        if (closed) return;
        closed = true;
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        wrap.classList.remove('in');
        setTimeout(() => {
          wrap.remove();
          if (!stack.length) M().lock(false);
          if (onClose) onClose(result);
          pump();
        }, 400);
      },
    };
    apis.set(wrap, api);
    stack.push(api);
    requestAnimationFrame(() => {
      wrap.classList.add('in');
      api.el.focus({ preventScroll: true });
    });
    wrap.querySelector('.modal-scrim').addEventListener('click', () => api.dismiss && api.close());
    return api;
  };
  ui.closeTop = () => {
    const t = stack[stack.length - 1];
    if (t && t.dismiss) t.close();
  };
  document.addEventListener('keydown', (e) => e.key === 'Escape' && ui.closeTop());
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-close]');
    if (!c) return;
    const wrap = c.closest('.modal-wrap');
    const api = wrap && apis.get(wrap);
    if (api) api.close(c.dataset.close);
  });
  function pump() {
    if (stack.length || !queue.length) return;
    queue.shift()();
  }
  ui.enqueue = (fn) => {
    queue.push(fn);
    pump();
  };
  ui.confirm = ({ title, text, ok = 'Confirm', danger = false, cancel = 'Cancel' }) =>
    new Promise((resolve) => {
      ui.modal({
        cls: 'modal-sm',
        html: `<h3>${esc(title)}</h3><p class="muted">${text || ''}</p>
          <div class="row end gap"><button class="btn ghost" data-close="no">${esc(cancel)}</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-close="yes"><span>${esc(ok)}</span></button></div>`,
        onClose: (r) => resolve(r === 'yes'),
      });
    });
  ui.toast = (msg, { icon: ic = '', kind = '', ms = 3600 } = {}) => {
    const t = document.createElement('div');
    t.className = `toast glass ${kind}`;
    t.innerHTML = `${ic ? `<span class="toast-ic">${ic}</span>` : ''}<span>${msg}</span>`;
    const box = $('#toasts');
    box.appendChild(t);
    while (box.children.length > 3) box.firstElementChild.remove();
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      setTimeout(() => t.remove(), 500);
    }, ms);
  };

  /* ---------- action dispatcher ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = A.actions[el.dataset.act];
    if (!fn) return;
    if (el.classList.contains('btn') && !el.hasAttribute('data-quiet')) A.sfx('click');
    fn(el, e);
  });
  A.actions.go = (el) => {
    ui.closeTop();
    A.go(el.dataset.to);
  };

  /* ---------- nav model ---------- */
  const NAV = [
    ['today', 'Today'],
    ['quests', 'Quests'],
    ['insights', 'Insights'],
    ['diary', 'Diary'],
    ['notes', 'Notes'],
    ['alarms', 'Alarms'],
    ['focus', 'Focus'],
    ['sanctuary', 'Sanctuary'],
    ['vault', 'Vault'],
  ];
  const DOCK = ['today', 'quests', 'insights', 'sanctuary'];
  const navIcon = (id) => (id === 'vault' ? 'trophy' : id === 'sanctuary' ? 'waves' : id);

  function initChrome() {
    $('#hud').innerHTML = `
      <a class="brand" href="#today" aria-label="Ascend home"><span class="mark"></span><span>Ascend</span></a>
      <nav class="topnav" aria-label="Primary">
        <i class="nav-pill"></i>
        ${NAV.map(([id, label], i) => `<a href="#${id}" data-nav="${id}"><i>0${i + 1}</i>${label}<b class="badge" hidden></b></a>`).join('')}
      </nav>
      <div class="hud-right" id="hud-right"></div>`;
    $('#dock').innerHTML =
      `<i class="dock-pill"></i>` +
      DOCK.map((id) => `<a href="#${id}" data-nav="${id}" aria-label="${id}">${icon(navIcon(id), 20)}<span>${NAV.find((n) => n[0] === id)[1]}</span><b class="badge" hidden></b></a>`).join('') +
      `<a href="#" data-act="menu" data-nav="more" aria-label="More">${icon('menu', 20)}<span>More</span></a>`;
    A.$$('#hud a[data-nav], #dock a[data-nav]').forEach((a) =>
      a.addEventListener('click', () => {
        if (a.getAttribute('href') === '#') return;
      })
    );
  }

  const CIRC = 2 * Math.PI * 19;
  function updateHud() {
    const P = A.S.player;
    const li = A.G.levelInfo();
    const sk = A.G.streak();
    const hpPct = Math.round((P.hp / P.maxHp) * 100);
    const playing = A.sound && A.sound.count > 0;
    $('#hud-right').innerHTML = `
      <div class="stat hp ${A.G.hpClass()}" title="Health. Missing quests costs HP; at 0 you are defeated."><span class="lbl">HP</span><span class="bar"><i style="width:${hpPct}%"></i></span><b>${P.hp}</b></div>
      <div class="stat coin" title="Coins">${icon('coin', 14)}<span class="lbl">Coins</span><b>${A.fmtNum(P.coins)}</b></div>
      <div class="stat streak ${sk.current ? 'lit' : ''}" title="Current streak">${icon('flame', 14)}<span class="lbl">Streak</span><b>${sk.current}</b></div>
      ${P.freezes ? `<div class="stat" title="Streak Freezes">${icon('snow', 14)}<b>${P.freezes}</b></div>` : ''}
      ${playing ? `<button class="mini-player" data-act="go" data-to="sanctuary" title="Open Sanctuary"><span class="eq"><i></i><i></i><i></i><i></i></span>Playing</button>` : ''}
      <button class="icon-btn search-btn" data-act="palette" data-quiet aria-label="Search and commands (Ctrl+K)" title="Search and commands · Ctrl+K">${icon('search', 18)}</button>
      <button class="icon-btn theme-btn" data-act="cycleTheme" aria-label="Change theme" title="Theme: ${esc((A.THEMES.find((x) => x.id === A.resolvedTheme()) || {}).name)}">${icon(A.resolvedTheme() === 'dark' ? 'moon' : A.resolvedTheme() === 'light' ? 'sun' : 'spark', 18)}</button>
      <button class="avatar-btn" data-act="go" data-to="settings" aria-label="Profile and settings" title="${esc(A.S.profile.name)}: level ${li.level}, ${esc(li.rank.name)}">
        <svg viewBox="0 0 44 44"><circle class="trk" cx="22" cy="22" r="19"/><circle class="val" cx="22" cy="22" r="19" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC * (1 - li.pct)}"/></svg>
        <span class="av">${esc(A.S.profile.avatar)}</span><em class="lv">${li.level}</em></button>`;
    const left = A.G.scheduledOn(A.today()).filter((h) => !A.G.isDone(h, A.today())).length;
    $$('[data-nav="today"] .badge').forEach((b) => {
      b.hidden = !left;
      b.textContent = left;
    });
    $$('#hud a[data-nav], #dock a[data-nav]').forEach((a) => {
      const on = a.dataset.nav === A.view;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    placePills();
  }
  function placePills() {
    [['#hud .topnav', 'a.active', '.nav-pill', 5], ['#dock', 'a.active', '.dock-pill', 0]].forEach(([box, sel, pillSel]) => {
      const b = $(box);
      if (!b || !b.getClientRects().length) return;
      const pill = $(pillSel, b);
      const a = $(sel, b);
      if (!pill) return;
      if (!a) {
        pill.style.opacity = 0;
        return;
      }
      pill.style.opacity = 1;
      pill.style.width = a.offsetWidth + 'px';
      pill.style.height = a.offsetHeight + 'px';
      pill.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
    });
  }
  addEventListener('resize', A.debounce(() => {
    placePills();
    place3D();
  }, 120));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placePills);

  A.actions.menu = () => {
    const items = [['diary', 'Diary'], ['notes', 'Notes'], ['alarms', 'Alarms'], ['focus', 'Focus'], ['vault', 'Vault'], ['settings', 'Settings']];
    ui.modal({
      cls: 'modal-sm menu-sheet',
      html: `<p class="eyebrow">Menu</p><ul class="menu-list">${items.map(([id, l], i) => `<li><button data-act="go" data-to="${id}" data-quiet><i>0${i + 1}</i><span>${l}</span></button></li>`).join('')}</ul>`,
    });
  };

  /* ---------- 3D placement + state sync ---------- */
  const g3 = () => (window.A3D && window.A3D.ready ? window.A3D : null);
  function place3D() {
    const s = g3();
    if (!s) return;
    const v = A.views[A.view];
    const root = $('#view');
    const mode = (v && v.mode) || 'core';
    const W = innerWidth;
    const H = innerHeight;
    if (mode === 'sanctuary') return s.mode('sanctuary', { cx: 0.5, cy: 0.5 });
    if (mode === 'medal') {
      const slot = $('[data-core-slot]', root);
      if (slot) {
        const r = slot.getBoundingClientRect();
        const zoom = A.clamp(Math.min(r.width, r.height) / H / 0.7, 0.2, 2.2);
        return s.mode('medal', { cx: (r.left + r.width / 2) / W, cy: (r.top + r.height / 2) / H, zoom });
      }
    }
    if (mode === 'skyline') {
      const slot = $('[data-skyline-slot]', root);
      const r = slot ? slot.getBoundingClientRect() : null;
      return s.mode('skyline', { cx: 0.5, cy: r ? (r.top + r.height * 0.52) / H : 0.4, zoom: 1 });
    }
    const slot = $('[data-core-slot]', root);
    if (slot) {
      const r = slot.getBoundingClientRect();
      const zoom = A.clamp(Math.min(r.width, r.height) / H / 0.8, 0.22, 1.7);
      return s.mode('core', { cx: (r.left + r.width / 2) / W, cy: (r.top + r.height / 2) / H, zoom });
    }
    // ambient: a quiet instrument in the corner
    if (W < 900) return s.mode('core', { cx: 0.82, cy: 0.9, zoom: 0.3 });
    s.mode('core', { cx: 0.9, cy: 0.82, zoom: 0.4 });
  }
  let sceneQueued = false;
  A.place3D = place3D;
  A.bus.on('scroll', () => {
    if (sceneQueued) return;
    sceneQueued = true;
    requestAnimationFrame(() => {
      sceneQueued = false;
      place3D();
    });
  });
  addEventListener('scroll', () => A.bus.emit('scroll'), { passive: true });

  function sync3D() {
    const s = g3();
    if (!s || !A.S.onboarded) return;
    const today = A.today();
    const sched = A.G.scheduledOn(today);
    const info = A.G.dayInfo(today);
    const ws = A.weekStart(today, A.S.settings.weekStart);
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = A.addDays(ws, i);
      const di = A.G.dayInfo(d);
      week.push({ kind: di ? di.status : 'future', today: d === today });
    }
    const li = A.G.levelInfo();
    s.medal({ level: li.level, rank: li.rank.name });
    s.set({
      progress: info && info.total ? info.done / info.total : 0,
      hp: A.S.player.hp / A.S.player.maxHp,
      quests: sched.map((h) => ({ done: A.G.isDone(h, today), hue: h.hue })),
      week,
      hue: A.accentHue(),
      theme: A.resolvedTheme(),
    });
  }
  A.sync3D = sync3D;
  document.addEventListener('a3d-ready', () => {
    const s = g3();
    if (s) s.quality(A.S.settings.quality === 'low' ? 'low' : 'high');
    if (A.S.settings.quality === 'off') document.documentElement.classList.add('no-webgl');
    sync3D();
    place3D();
    if (A.introPending) s && s.intro();
  });

  /* ---------- router ---------- */
  A.view = 'today';
  let prevView = null;
  A.go = (name) => {
    if (location.hash.slice(1) === name) renderView(true);
    else location.hash = name;
  };
  const fromHash = () => {
    const h = location.hash.slice(1);
    return A.views[h] ? h : 'today';
  };

  function renderView(enter, delay) {
    const root = $('#view');
    const v = A.views[A.view];
    if (!v) return;
    const y = window.scrollY;
    if (enter || !v.update) {
      root.dataset.view = A.view;
      document.body.classList.toggle('night', A.view === 'sanctuary' && A.resolvedTheme() !== 'rose');
      v.render(root);
      if (enter) {
        window.scrollTo(0, 0);
        const lz = M().lenis();
        if (lz) lz.scrollTo(0, { immediate: true });
        document.title = `${v.title || A.view} · Ascend`;
        place3D();
        M().enter(root, delay || 0);
        if (v.mount) v.mount(root);
      } else {
        window.scrollTo(0, y);
        place3D();
      }
    } else {
      v.update(root);
    }
    updateHud();
  }

  let queued = false;
  A.rerender = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync3D();
      renderView(false);
    });
  };

  A.navigate = (instant) => {
    const next = fromHash();
    const changed = next !== A.view || !prevView;
    const old = prevView && A.views[prevView];
    if (changed && old && old.unmount) old.unmount();
    const go = () => {
      A.view = next;
      renderView(true, instant ? 0 : 0.25);
      prevView = next;
    };
    if (changed && prevView && !instant) {
      A.sfx('tab');
      M().curtain(go);
    } else {
      go();
    }
  };
  addEventListener('hashchange', () => A.navigate());
  A.bus.on('change', A.rerender);
  A.renderChrome = () => updateHud();
  A.initChrome = initChrome;

  /* ---------- reactions to game events ---------- */
  A.bus.on('complete', ({ habit, xp, coins, crit }) => {
    const el = document.querySelector(`[data-habit="${habit.id}"] .check`);
    if (el) {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      A.fx.confetti({ x, y, count: crit ? 60 : 22, power: crit ? 11 : 6, spread: crit ? 6.3 : 2.2 });
      A.fx.float(x - 10, y - 14, `${crit ? 'Critical ' : ''}+${xp} XP`, crit ? 'crit' : 'xp');
      setTimeout(() => A.fx.float(x + 24, y + 12, `+${coins}c`, 'coin'), 180);
    }
    const s = g3();
    s && s.pulse(crit ? 'crit' : 'complete');
    A.fx.vibrate(crit ? [20, 30, 40] : 15);
  });
  A.bus.on('damage', ({ amount }) => {
    A.fx.shake();
    A.fx.vignette('damage');
    A.sfx('damage');
    A.fx.vibrate([60, 40, 90]);
    const s = g3();
    s && s.pulse('damage');
    const hp = document.querySelector('.hud .stat.hp');
    if (hp) {
      const r = hp.getBoundingClientRect();
      A.fx.float(r.left + 30, r.bottom + 14, `−${amount} HP`, 'dmg');
    }
  });
  A.bus.on('levelup', (d) => {
    const s = g3();
    s && s.pulse('level');
    ui.enqueue(() => {
      A.sfx('level');
      A.fx.celebrate();
      A.fx.vibrate([40, 40, 40, 40, 120]);
      ui.modal({
        cls: 'modal-sm levelup',
        html: `<div class="lu-burst"></div><div class="lu-badge"><span>${d.level}</span></div>
          <p class="eyebrow">Level up</p><h2>You reached <em>level ${d.level}</em></h2>
          <p class="rank-line">${esc(d.rank.name)}</p>
          <p class="muted">Bonus: <b class="gold">+${d.bonus} coins</b></p>
          <button class="btn primary lg" data-close><span>Keep climbing</span></button>`,
      });
    });
  });
  A.bus.on('achievement', (a) => {
    A.sfx('achievement');
    ui.toast(`<b>${esc(a.name)}</b><small>${esc(a.desc)}</small>`, { icon: a.icon, kind: `ach ${a.rarity}`, ms: 5000 });
  });
  A.bus.on('perfect', ({ xp, coins }) => {
    A.sfx('perfect');
    A.fx.celebrate();
    const s = g3();
    s && s.pulse('perfect');
    ui.toast(`<b>Perfect day</b><small>+${xp} XP · +${coins} coins bonus</small>`, { icon: '💎', kind: 'ach epic', ms: 5000 });
  });
  A.bus.on('chest-ready', () => ui.toast(`<b>Daily chest unlocked</b><small>Open it on the Today screen</small>`, { icon: '🎁', kind: 'ach' }));
  A.bus.on('boss-hit', () => {
    const b = document.querySelector('.boss-card');
    if (b) {
      b.classList.remove('hit');
      void b.offsetWidth;
      b.classList.add('hit');
    }
    A.sfx('boss');
  });
  A.bus.on('boss-defeated', (b) => {
    ui.enqueue(() => {
      A.sfx('victory');
      A.fx.celebrate();
      ui.modal({
        cls: 'modal-sm levelup',
        html: `<div class="lu-burst"></div><div class="boss-emoji big">${b.emoji}</div>
          <p class="eyebrow">Victory</p><h2>${esc(b.name)} <em>defeated</em></h2>
          <p class="muted">Reward: <b class="gold">+100 XP · +40 coins</b></p>
          <button class="btn primary lg" data-close><span>Claim glory</span></button>`,
      });
    });
  });
  A.bus.on('boss-escaped', (b) => ui.toast(`<b>${esc(b.name)} got away</b><small>You didn't finish it last week. A new boss approaches.</small>`, { icon: b.emoji, kind: 'warn', ms: 6000 }));
  A.bus.on('death', (d) => {
    const s = g3();
    s && s.pulse('death');
    ui.enqueue(() => {
      A.sfx('death');
      A.fx.vignette('death');
      A.fx.shake();
      A.fx.vibrate([200, 80, 300]);
      ui.modal({
        cls: 'modal-sm death',
        dismiss: false,
        html: `<div class="skull">${icon('skull', 64)}</div>
          <p class="eyebrow danger">Health reached zero</p><h2>You died</h2>
          <p class="muted">Slacking has consequences. You lost <b class="danger-t">${d.lostCoins} coins</b>${d.lostXp ? ` and <b class="danger-t">${d.lostXp} XP</b>` : ''}${d.levelDrop ? ' and a whole level (Hardcore)' : ''}.
          ${d.lostFreezes ? 'Your Streak Freezes shattered. ' : ''}You wake up at half health.</p>
          <button class="btn danger lg" data-close><span>Rise again</span></button>`,
      });
    });
  });
  A.bus.on('report', (r) => {
    const bad = r.hp || r.broken || r.xp || r.coins;
    if (!bad) {
      if (r.days) ui.toast(`<b>${r.days === 1 ? 'Yesterday' : r.days + ' days'} cleared</b><small>No penalties. Keep the streak alive.</small>`, { icon: '🛡️', kind: 'ach' });
      return;
    }
    ui.enqueue(() => {
      A.sfx('damage');
      A.fx.vignette('damage');
      A.fx.shake();
      const multi = r.days > 1;
      const missedHtml = r.missed
        .slice(0, 7)
        .map((m) => `<li><span>${esc(m.icon)}</span>${esc(m.name)}<small>${A.prettyDate(m.date, { month: 'short', day: 'numeric' })}</small></li>`)
        .join('');
      ui.modal({
        cls: 'modal-sm toll',
        html: `<p class="eyebrow danger">${multi ? `While you were away · ${r.days} days` : 'Yesterday’s toll'}</p>
          <h2>${r.missed.length ? `You skipped <em>${r.missed.length}</em> quest${r.missed.length > 1 ? 's' : ''}` : 'Your streak slipped'}</h2>
          <div class="toll-stats">
            ${r.hp ? `<div class="t">${icon('heart', 18)}<b>−${r.hp}</b><small>HP</small></div>` : ''}
            ${r.xp ? `<div class="t">${icon('bolt', 18)}<b>−${r.xp}</b><small>XP</small></div>` : ''}
            ${r.coins ? `<div class="t">${icon('coin', 18)}<b>−${r.coins}</b><small>coins</small></div>` : ''}
          </div>
          ${r.broken && r.prevStreak ? `<p class="streak-lost">${icon('flame', 18)} Your <b>${r.prevStreak}-day streak</b> has ended.</p>` : ''}
          ${r.frozen ? `<p class="freeze-saved">${icon('snow', 18)} ${r.frozen} Streak Freeze${r.frozen > 1 ? 's' : ''} saved your streak.</p>` : ''}
          ${missedHtml ? `<ul class="missed-list">${missedHtml}</ul>` : ''}
          <button class="btn danger lg" data-close><span>Redeem myself today</span></button>`,
      });
    });
  });
  A.bus.on('sound-change', () => updateHud());

  /* ---------- shared editor data ---------- */
  ui.EMOJI = ['💧', '🏃', '📖', '🧘', '💤', '💻', '🥗', '📝', '🚫', '🧹', '💪', '🎯', '🎸', '🎨', '📚', '🧠', '🍎', '🚴', '🏊', '☀️', '🌙', '🧴', '🦷', '🛏️', '💊', '📵', '🌱', '🐕', '☎️', '💰', '🗣️', '✍️', '🎧', '🧩', '🥦', '🚿', '🙏', '❤️', '⏰', '🔥'];
  ui.AVATARS = ['🦊', '🐺', '🦁', '🐯', '🐲', '🦉', '🦄', '🐼', '🐙', '🦅', '🤖', '👾', '🧙', '🥷', '🧑‍🚀', '🦸'];
  ui.HUES = [24, 8, 42, 85, 150, 190, 215, 255, 320]; // muted earth + cool tones
  ui.ACCENTS = [
    { h: 24, name: 'Copper' },
    { h: 150, name: 'Sage' },
    { h: 205, name: 'Glacier' },
    { h: 8, name: 'Clay' },
    { h: 255, name: 'Dusk' },
    { h: 42, name: 'Brass' },
  ];

  /* ---------- onboarding ---------- */
  const PRESETS = [
    { icon: '💧', name: 'Drink 8 glasses of water', diff: 'easy', hue: 205, target: 8, unit: 'glasses' },
    { icon: '🏃', name: 'Exercise 30 minutes', diff: 'hard', hue: 24, target: 1 },
    { icon: '📖', name: 'Read 20 pages', diff: 'medium', hue: 255, target: 1 },
    { icon: '🧘', name: 'Meditate', diff: 'easy', hue: 150, target: 1 },
    { icon: '💤', name: 'Sleep before 11 PM', diff: 'medium', hue: 215, target: 1 },
    { icon: '💻', name: 'Deep work: 2 hours', diff: 'hard', hue: 42, target: 1 },
    { icon: '🥗', name: 'Eat clean today', diff: 'medium', hue: 85, target: 1 },
    { icon: '📝', name: 'Write in journal', diff: 'easy', hue: 320, target: 1 },
    { icon: '📵', name: 'No doom-scrolling', diff: 'hard', hue: 8, target: 1 },
    { icon: '🧹', name: 'Tidy up 10 minutes', diff: 'easy', hue: 190, target: 1 },
  ];
  ui.PRESETS = PRESETS;
  ui.onboarding = () => {
    let avatar = A.S.profile.avatar;
    const picked = new Set([0, 1, 2, 3]);
    const m = ui.modal({
      cls: 'onboard',
      dismiss: false,
      html: `<p class="eyebrow">Welcome to</p><h1 class="display">Ascend<span>.</span></h1>
        <p class="muted lead">Turn your habits into a game. Complete quests to earn XP and coins, build streaks, and fight a weekly boss. Skip them and you lose health. Your progress is saved on this device automatically.</p>
        <label class="field"><span>Hero name</span><input id="ob-name" class="input" maxlength="20" placeholder="What should we call you?" value=""></label>
        <div class="field"><span>Avatar</span><div class="emoji-grid" id="ob-av">${ui.AVATARS.map((e) => `<button type="button" class="emo ${e === avatar ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
        <div class="field"><span>Starter quests <small class="muted">(edit anytime)</small></span>
          <div class="preset-grid" id="ob-presets">${PRESETS.map((p, i) => `<button type="button" class="preset ${picked.has(i) ? 'on' : ''}" data-i="${i}"><span>${p.icon}</span>${esc(p.name)}</button>`).join('')}</div></div>
        <button class="btn primary lg block" id="ob-go"><span>Begin the ascent</span></button>`,
    });
    m.el.addEventListener('click', (e) => {
      const em = e.target.closest('.emo');
      if (em) {
        avatar = em.dataset.e;
        m.el.querySelectorAll('.emo').forEach((x) => x.classList.toggle('on', x === em));
        A.sfx('pop');
      }
      const pr = e.target.closest('.preset');
      if (pr) {
        const i = +pr.dataset.i;
        picked.has(i) ? picked.delete(i) : picked.add(i);
        pr.classList.toggle('on', picked.has(i));
        A.sfx('click');
      }
      if (e.target.closest('#ob-go')) {
        const name = m.el.querySelector('#ob-name').value.trim() || 'Hero';
        A.S.profile = { name, avatar };
        A.S.onboarded = true;
        A.S.lastClosed = A.addDays(A.today(), -1);
        picked.forEach((i) => A.G.addHabit(PRESETS[i]));
        A.sfx('level');
        A.fx.celebrate();
        const s = g3();
        s && s.pulse('level');
        m.close();
        A.save();
        A.persistStorage();
      }
    });
    setTimeout(() => m.el.querySelector('#ob-name').focus({ preventScroll: true }), 600);
  };
})();
