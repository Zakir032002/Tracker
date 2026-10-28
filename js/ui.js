/* Ascend — UI shell: theme, HUD, dock, router, modals, toasts, reactions */
(function () {
  'use strict';
  const A = window.A;
  const { $, esc, icon } = A;
  const ui = (A.ui = {});
  A.views = {};
  A.actions = {};

  /* ---------- theme ---------- */
  A.applyTheme = () => {
    const s = A.S.settings;
    let t = s.theme;
    if (t === 'auto') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const root = document.documentElement;
    root.dataset.theme = t;
    root.style.setProperty('--h', s.accent);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === 'light' ? '#eef0fb' : '#07060f';
    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    const chromium = brands.some((b) => /Chromium/i.test(b.brand)) && !navigator.userAgentData.mobile;
    root.classList.toggle('refract', chromium && s.refract !== false);
  };

  /* ---------- modal system ---------- */
  const stack = [];
  const queue = [];
  const apis = new WeakMap();
  ui.modal = ({ html, cls = '', dismiss = true, onClose } = {}) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal-scrim"></div><div class="modal glass ${cls}" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
    $('#overlay').appendChild(wrap);
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
          if (onClose) onClose(result);
          pump();
        }, 240);
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
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ui.closeTop();
  });
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-close]');
    if (!c) return;
    const wrap = c.closest('.modal-wrap');
    const api = wrap && apis.get(wrap);
    if (api) api.close(c.dataset.close);
  });

  /* queued modals wait their turn (level up, penalties, boss, death…) */
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
      const m = ui.modal({
        cls: 'modal-sm',
        html: `<h3>${esc(title)}</h3><p class="muted">${text || ''}</p>
          <div class="row end gap"><button class="btn ghost" data-close="no">${esc(cancel)}</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-close="yes">${esc(ok)}</button></div>`,
        onClose: (r) => resolve(r === 'yes'),
      });
      return m;
    });

  ui.toast = (msg, { icon: ic = '', kind = '', ms = 3600 } = {}) => {
    const t = document.createElement('div');
    t.className = `toast glass ${kind}`;
    t.innerHTML = `${ic ? `<span class="toast-ic">${ic}</span>` : ''}<span>${msg}</span>`;
    const box = $('#toasts');
    box.appendChild(t);
    while (box.children.length > 3) box.firstElementChild.remove(); // never let toasts bury the UI
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      setTimeout(() => t.remove(), 400);
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
  A.actions.go = (el) => A.go(el.dataset.to);

  /* ---------- HUD ---------- */
  const CIRC = 2 * Math.PI * 21;
  function renderHud() {
    const P = A.S.player;
    const li = A.G.levelInfo();
    const sk = A.G.streak();
    const hpPct = Math.round((P.hp / P.maxHp) * 100);
    const hue = li.rank.hue;
    $('#hud').innerHTML = `
      <a class="brand" href="#today" aria-label="Ascend home"><span class="logo-mark"></span><b>Ascend</b></a>
      <button class="hud-player" data-act="go" data-to="settings" aria-label="Profile and settings" style="--rank:${hue}">
        <span class="ring"><svg viewBox="0 0 48 48"><circle class="trk" cx="24" cy="24" r="21"/><circle class="val" cx="24" cy="24" r="21" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC * (1 - li.pct)}"/></svg>
          <span class="av">${esc(A.S.profile.avatar)}</span><em class="lv">${li.level}</em></span>
        <span class="who"><b>${esc(A.S.profile.name)}</b><small>${esc(li.rank.name)} · ${A.fmtNum(li.into)}/${A.fmtNum(li.need)} XP</small></span>
      </button>
      <div class="hud-stats">
        <div class="stat hp ${A.G.hpClass()}" title="Health: missing quests costs HP. At 0 you are defeated.">
          ${icon('heart', 16)}<div class="bar"><i style="width:${hpPct}%"></i></div><span class="num">${P.hp}</span>
        </div>
        <div class="stat coin" title="Coins">${icon('coin', 16)}<span class="num">${A.fmtNum(P.coins)}</span></div>
        <div class="stat streak ${sk.current ? 'lit' : ''}" title="Current streak">${icon('flame', 16)}<span class="num">${sk.current}</span></div>
        ${P.freezes ? `<div class="stat ice" title="Streak Freezes">${icon('snow', 15)}<span class="num">${P.freezes}</span></div>` : ''}
        ${A.G.boostActive() ? `<div class="stat boost" title="Double XP active">${icon('bolt', 15)}<span class="num">2×</span></div>` : ''}
      </div>
      <div class="hud-tools">
        <button class="icon-btn" data-act="toggleSound" aria-label="Toggle sound" title="Sound">${icon(A.S.settings.sound ? 'sound' : 'mute', 18)}</button>
        <button class="icon-btn" data-act="toggleTheme" aria-label="Toggle theme" title="Theme">${icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun', 18)}</button>
        <button class="icon-btn" data-act="go" data-to="settings" aria-label="Settings" title="Settings">${icon('settings', 18)}</button>
      </div>`;
  }
  A.actions.toggleSound = () => {
    A.S.settings.sound = !A.S.settings.sound;
    if (A.S.settings.sound) A.sfx('pop');
    A.save();
  };
  A.actions.toggleTheme = () => {
    const cur = document.documentElement.dataset.theme;
    A.S.settings.theme = cur === 'light' ? 'dark' : 'light';
    A.applyTheme();
    A.save();
  };

  /* ---------- dock ---------- */
  const NAV = [
    ['today', 'Today'],
    ['quests', 'Quests'],
    ['insights', 'Insights'],
    ['notes', 'Notes'],
    ['alarms', 'Alarms'],
    ['focus', 'Focus'],
    ['vault', 'Vault'],
  ];
  function renderDock() {
    const left = A.G.scheduledOn(A.today()).filter((h) => !A.G.isDone(h, A.today())).length;
    $('#dock').innerHTML =
      `<i class="dock-pill"></i>` +
      NAV.map(
        ([id, label]) =>
          `<a href="#${id}" class="${A.view === id ? 'active' : ''}" data-nav="${id}" aria-label="${label}" ${A.view === id ? 'aria-current="page"' : ''}>
            ${icon(id === 'today' ? 'today' : id === 'vault' ? 'trophy' : id, 22)}<span>${label}</span>${id === 'today' && left ? `<b class="badge">${left}</b>` : ''}</a>`
      ).join('');
    placePill();
  }
  function placePill() {
    const dock = $('#dock');
    const pill = dock.querySelector('.dock-pill');
    const a = dock.querySelector('a.active');
    if (!pill) return;
    if (!a) {
      pill.style.opacity = 0;
      return;
    }
    pill.style.opacity = 1;
    pill.style.width = a.offsetWidth + 'px';
    pill.style.height = a.offsetHeight + 'px';
    pill.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
  }
  addEventListener('resize', A.debounce(placePill, 100));
  addEventListener('load', placePill);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placePill);

  /* ---------- router ---------- */
  A.view = 'today';
  A.go = (name) => {
    if (location.hash.slice(1) === name) renderView(true);
    else location.hash = name;
  };
  function currentFromHash() {
    const h = location.hash.slice(1);
    return A.views[h] ? h : 'today';
  }
  let prevView = null;
  function renderView(enter) {
    const root = $('#view');
    const name = A.view;
    const v = A.views[name];
    if (!v) return;
    if (enter && prevView && prevView !== name && A.views[prevView].unmount) A.views[prevView].unmount();
    const y = window.scrollY;
    if (enter || !v.update) {
      root.dataset.view = name;
      v.render(root);
      if (enter) {
        root.classList.remove('enter');
        void root.offsetWidth;
        root.classList.add('enter');
        window.scrollTo(0, 0);
        document.title = `${v.title || name} · Ascend`;
      } else window.scrollTo(0, y);
    } else v.update(root);
    if (enter && v.mount) v.mount(root);
    prevView = name;
  }
  let queued = false;
  A.rerender = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      renderHud();
      renderDock();
      renderView(false);
    });
  };
  A.navigate = () => {
    const next = currentFromHash();
    if (next !== A.view || !prevView) {
      A.view = next;
      A.sfx('tab');
    }
    renderHud();
    renderDock();
    renderView(true);
  };
  addEventListener('hashchange', A.navigate);
  A.bus.on('change', A.rerender);

  /* ---------- reactions to game events ---------- */
  A.bus.on('complete', ({ habit, xp, coins, crit }) => {
    const el = document.querySelector(`[data-habit="${habit.id}"] .check`) || document.querySelector(`[data-habit="${habit.id}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      A.fx.confetti({ x, y, count: crit ? 70 : 26, power: crit ? 12 : 7, spread: crit ? 6.3 : 2.4 });
      A.fx.float(x, y - 10, `${crit ? '<b>CRIT!</b> ' : ''}+${xp} XP`, crit ? 'crit' : 'xp');
      setTimeout(() => A.fx.float(x + 20, y + 14, `+${coins} ${icon('coin', 14)}`, 'coin'), 160);
    }
    A.fx.vibrate(crit ? [20, 30, 40] : 15);
  });
  A.bus.on('damage', ({ amount, reason }) => {
    A.fx.shake();
    A.fx.vignette('damage');
    A.sfx('damage');
    A.fx.vibrate([60, 40, 90]);
    const hp = document.querySelector('.hud .stat.hp');
    if (hp) {
      const r = hp.getBoundingClientRect();
      A.fx.float(r.left + 20, r.bottom + 6, `−${amount} HP`, 'dmg');
    }
  });
  A.bus.on('levelup', (d) => {
    ui.enqueue(() => {
      A.sfx('level');
      A.fx.celebrate();
      A.fx.vibrate([40, 40, 40, 40, 120]);
      ui.modal({
        cls: 'modal-sm levelup',
        html: `<div class="lu-burst"></div><div class="lu-badge" style="--rank:${d.rank.hue}"><span>${d.level}</span></div>
          <p class="eyebrow">Level up</p><h2>You reached <em>Level ${d.level}</em></h2>
          <p class="rank-line">${esc(d.rank.name)}</p>
          <p class="muted">Bonus reward: <b class="gold">+${d.bonus} coins</b></p>
          <button class="btn primary lg" data-close>Keep climbing</button>`,
      });
    });
  });
  A.bus.on('achievement', (a) => {
    A.sfx('achievement');
    A.fx.confetti({ x: innerWidth / 2, y: 80, count: 40, power: 8, spread: 3 });
    ui.toast(`<b>${esc(a.name)}</b><small>${esc(a.desc)}</small>`, { icon: a.icon, kind: `ach ${a.rarity}`, ms: 5000 });
  });
  A.bus.on('perfect', ({ xp, coins }) => {
    A.sfx('perfect');
    A.fx.celebrate();
    ui.toast(`<b>Perfect day!</b><small>+${xp} XP · +${coins} coins bonus</small>`, { icon: '💎', kind: 'ach epic', ms: 5000 });
  });
  A.bus.on('chest-ready', () => ui.toast(`<b>Daily chest unlocked</b><small>Open it on the Today screen</small>`, { icon: '🎁', kind: 'ach rare' }));
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
          <button class="btn primary lg" data-close>Claim glory</button>`,
      });
    });
  });
  A.bus.on('boss-escaped', (b) => ui.toast(`<b>${esc(b.name)} got away</b><small>You didn't finish it last week. A new boss approaches.</small>`, { icon: b.emoji, kind: 'warn', ms: 6000 }));
  A.bus.on('death', (d) => {
    ui.enqueue(() => {
      A.sfx('death');
      A.fx.vignette('death');
      A.fx.shake();
      A.fx.vibrate([200, 80, 300]);
      ui.modal({
        cls: 'modal-sm death',
        dismiss: false,
        html: `<div class="skull">${icon('skull', 64)}</div>
          <p class="eyebrow danger">Health reached zero</p><h2>YOU DIED</h2>
          <p class="muted">Slacking has consequences. You lost <b class="danger-t">${d.lostCoins} coins</b>${d.lostXp ? ` and <b class="danger-t">${d.lostXp} XP</b>` : ''}${d.levelDrop ? ' and a whole level (Hardcore)' : ''}.
          ${d.lostFreezes ? 'Your Streak Freezes shattered. ' : ''}You wake up at half health.</p>
          <button class="btn danger lg" data-close>Rise again</button>`,
      });
    });
  });
  A.bus.on('report', (r) => {
    const bad = r.hp || r.broken || r.xp || r.coins;
    if (!bad) {
      if (r.days) ui.toast(`<b>${r.days === 1 ? 'Yesterday' : r.days + ' days'} cleared</b><small>No penalties. Keep the streak alive.</small>`, { icon: '🛡️', kind: 'ach rare' });
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
            ${r.hp ? `<div class="t hp">${icon('heart', 18)}<b>−${r.hp}</b><small>HP</small></div>` : ''}
            ${r.xp ? `<div class="t xp">${icon('bolt', 18)}<b>−${r.xp}</b><small>XP</small></div>` : ''}
            ${r.coins ? `<div class="t coin">${icon('coin', 18)}<b>−${r.coins}</b><small>coins</small></div>` : ''}
          </div>
          ${r.broken && r.prevStreak ? `<p class="streak-lost">${icon('flame', 18)} Your <b>${r.prevStreak}-day streak</b> has ended.</p>` : ''}
          ${r.frozen ? `<p class="freeze-saved">${icon('snow', 18)} ${r.frozen} Streak Freeze${r.frozen > 1 ? 's' : ''} saved your streak.</p>` : ''}
          ${missedHtml ? `<ul class="missed-list">${missedHtml}</ul>` : ''}
          <button class="btn danger lg" data-close>Redeem myself today</button>`,
      });
    });
  });

  /* ---------- emoji / swatch data shared by editors ---------- */
  ui.EMOJI = ['💧', '🏃', '📖', '🧘', '💤', '💻', '🥗', '📝', '🚫', '🧹', '💪', '🎯', '🎸', '🎨', '📚', '🧠', '🍎', '🚴', '🏊', '☀️', '🌙', '🧴', '🦷', '🛏️', '💊', '📵', '🌱', '🐕', '☎️', '💰', '🗣️', '✍️', '🎧', '🧩', '🥦', '🚿', '🙏', '❤️', '⏰', '🔥'];
  ui.AVATARS = ['🦊', '🐺', '🦁', '🐯', '🐲', '🦉', '🦄', '🐼', '🐙', '🦅', '🤖', '👾', '🧙', '🥷', '🧑‍🚀', '🦸'];
  ui.HUES = [265, 200, 170, 140, 85, 45, 20, 350, 320];

  /* ---------- onboarding ---------- */
  const PRESETS = [
    { icon: '💧', name: 'Drink 8 glasses of water', diff: 'easy', hue: 200, target: 8, unit: 'glasses' },
    { icon: '🏃', name: 'Exercise 30 minutes', diff: 'hard', hue: 20, target: 1 },
    { icon: '📖', name: 'Read 20 pages', diff: 'medium', hue: 265, target: 1 },
    { icon: '🧘', name: 'Meditate', diff: 'easy', hue: 170, target: 1 },
    { icon: '💤', name: 'Sleep before 11 PM', diff: 'medium', hue: 240, target: 1 },
    { icon: '💻', name: 'Deep work: 2 hours', diff: 'hard', hue: 45, target: 1 },
    { icon: '🥗', name: 'Eat clean today', diff: 'medium', hue: 140, target: 1 },
    { icon: '📝', name: 'Write in journal', diff: 'easy', hue: 320, target: 1 },
    { icon: '📵', name: 'No doom-scrolling', diff: 'hard', hue: 350, target: 1 },
    { icon: '🧹', name: 'Tidy up 10 minutes', diff: 'easy', hue: 85, target: 1 },
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
        <div class="field"><span>Pick an avatar</span><div class="emoji-grid" id="ob-av">${ui.AVATARS.map((e) => `<button type="button" class="emo ${e === avatar ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
        <div class="field"><span>Choose starter quests <small class="muted">(you can edit them later)</small></span>
          <div class="preset-grid" id="ob-presets">${PRESETS.map((p, i) => `<button type="button" class="preset ${picked.has(i) ? 'on' : ''}" data-i="${i}" style="--c:${p.hue}"><span>${p.icon}</span>${esc(p.name)}</button>`).join('')}</div></div>
        <button class="btn primary lg block" id="ob-go">Begin the journey</button>`,
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
        m.close();
        A.save();
        A.persistStorage();
      }
    });
    setTimeout(() => m.el.querySelector('#ob-name').focus({ preventScroll: true }), 400);
  };

  A.renderChrome = () => {
    renderHud();
    renderDock();
  };
})();
