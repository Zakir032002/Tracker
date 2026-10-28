/* Ascend — Today view */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon, G } = { esc: A.esc, icon: A.icon, G: A.G };

  const CIRC = 2 * Math.PI * 52;

  function riskTonight(list) {
    const S = A.S;
    if (!S.settings.penalties) return null;
    const mul = S.settings.hardcore ? 2 : 1;
    let hp = 0;
    let xp = 0;
    list.forEach((h) => {
      const D = G.DIFF[h.diff] || G.DIFF.medium;
      hp += D.hp * mul;
      xp += D.xpLoss * mul;
    });
    return { hp, xp };
  }

  function weekStrip() {
    const today = A.today();
    const start = A.weekStart(today, A.S.settings.weekStart);
    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = A.addDays(start, i);
      const info = G.dayInfo(d);
      let cls = 'future';
      let inner = '';
      if (info) {
        cls = info.status;
        if (info.status === 'kept') inner = icon('check', 14);
        else if (info.status === 'frozen') inner = icon('snow', 13);
        else if (info.status === 'broken') inner = icon('x', 13);
        else if (info.status === 'open') inner = info.total ? `<small>${info.done}/${info.total}</small>` : '';
      }
      html += `<div class="wd ${cls} ${d === today ? 'is-today' : ''}"><span>${A.DAYS[A.dow(d)].slice(0, 3)}</span><i>${inner}</i></div>`;
    }
    return `<div class="week-strip">${html}</div>`;
  }

  function questRow(h) {
    const today = A.today();
    const e = G.entry(today, h.id) || { n: 0, done: false };
    const D = G.DIFF[h.diff] || G.DIFF.medium;
    const target = h.target || 1;
    const done = !!e.done;
    const st = G.habitStreak(h);
    const late = !done && h.reminder && A.nowMin() > A.hmToMin(h.reminder);
    const fresh = done && e.t && Date.now() - e.t < 1200;
    const pct = Math.round((e.n / target) * 100);
    const multi = target > 1;
    return `<article class="quest glass ${done ? 'done' : ''} ${late ? 'late' : ''} ${fresh ? 'fresh' : ''}" data-habit="${h.id}" style="--c:${h.hue}">
      <button class="check ${multi && !done && e.n > 0 ? 'partial' : ''}" data-act="toggle" data-id="${h.id}" data-quiet aria-pressed="${done}" aria-label="${done ? 'Undo' : 'Complete'} ${esc(h.name)}" ${multi && !done && e.n > 0 ? `style="--p:${pct}"` : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
      </button>
      <div class="q-body">
        <div class="q-title"><span class="q-icon">${esc(h.icon)}</span><h3>${esc(h.name)}</h3></div>
        <div class="q-meta">
          <span class="chip d-${h.diff}">${D.label}</span>
          <span class="chip xp">+${D.xp} XP</span>
          ${st ? `<span class="chip fire">${icon('flame', 12)} ${st}</span>` : ''}
          ${h.reminder ? `<span class="chip ${late ? 'late' : 'time'}">${icon('clock', 12)} ${A.time12(h.reminder)}${late ? ' · overdue' : ''}</span>` : ''}
        </div>
      </div>
      ${
        multi
          ? `<div class="stepper" role="group" aria-label="Progress"><button class="icon-btn sm" data-act="dec" data-id="${h.id}" data-quiet aria-label="Less">${icon('minus', 16)}</button>
             <span class="count"><b>${e.n}</b>/${target}${h.unit ? `<small>${esc(h.unit)}</small>` : ''}</span>
             <button class="icon-btn sm" data-act="inc" data-id="${h.id}" data-quiet aria-label="More">${icon('plus', 16)}</button></div>`
          : ''
      }
    </article>`;
  }

  function bossCard() {
    const b = A.S.boss;
    if (!b) {
      return `<section class="card glass boss-card empty"><p class="eyebrow">Weekly boss</p><p class="muted">Add a few quests and a boss will appear to hunt this week.</p></section>`;
    }
    const left = Math.max(0, b.maxHp - b.dmg);
    const pct = Math.max(0, Math.min(100, (left / b.maxHp) * 100));
    const end = A.addDays(b.week, 7);
    const days = Math.max(0, A.diffDays(A.today(), end));
    return `<section class="card glass boss-card ${b.defeated ? 'dead' : ''}">
      <div class="boss-top"><p class="eyebrow">Weekly boss</p><span class="chip ${b.defeated ? 'xp' : 'time'}">${b.defeated ? 'Defeated' : days + (days === 1 ? ' day left' : ' days left')}</span></div>
      <div class="boss-body"><div class="boss-emoji">${b.emoji}</div>
        <div><h3>${esc(b.name)}</h3><p class="muted small">Every quest you complete lands a hit.</p></div></div>
      <div class="boss-hp"><i style="width:${pct}%"></i><span>${b.defeated ? 'Slain' : `${left} / ${b.maxHp} HP`}</span></div>
    </section>`;
  }

  function chestCard(info) {
    const dd = A.S.daily[A.today()] || { chest: 0 };
    const thr = A.S.settings.streakThreshold;
    if (dd.chest === 1)
      return `<section class="card glass chest-card ready"><button class="chest" data-act="openChest" data-quiet aria-label="Open daily chest"><span>🎁</span></button>
        <div><h3>Daily chest ready</h3><p class="muted small">Tap to open it.</p></div></section>`;
    if (dd.chest === 2)
      return `<section class="card glass chest-card opened"><div class="chest"><span>📭</span></div><div><h3>Chest opened</h3><p class="muted small">Come back tomorrow for another.</p></div></section>`;
    const need = Math.max(0, Math.ceil((info.total * thr) / 100) - info.done);
    return `<section class="card glass chest-card locked"><div class="chest"><span>${icon('lock', 26)}</span></div>
      <div><h3>Daily chest</h3><p class="muted small">${info.total ? `Complete ${need} more quest${need === 1 ? '' : 's'} to unlock it.` : 'Add quests to earn it.'}</p></div></section>`;
  }

  function consistency(sk) {
    return `<section class="card glass consistency"><div class="card-head"><div><h3>Consistency</h3><p class="muted small">${sk.current ? `${sk.current}-day streak 🔥` : 'Start a streak today'} · best ${sk.longest}</p></div><button class="link" data-act="go" data-to="insights">Insights</button></div>
      <div class="heat-scroll tight">${A.miniHeat(15, 13)}</div></section>`;
  }

  function upcoming() {
    const nowM = A.nowMin();
    const items = [];
    A.S.alarms
      .filter((a) => a.enabled && (!a.days.length || a.days.includes(new Date().getDay())))
      .forEach((a) => items.push({ t: a.time, label: a.label || 'Alarm', icon: '⏰' }));
    G.scheduledOn(A.today()).forEach((h) => {
      if (h.reminder && !G.isDone(h, A.today())) items.push({ t: h.reminder, label: h.name, icon: h.icon });
    });
    const future = items.filter((i) => A.hmToMin(i.t) >= nowM).sort((a, b) => a.t.localeCompare(b.t)).slice(0, 4);
    if (!future.length) return '';
    return `<section class="card glass"><div class="card-head"><h3>Coming up</h3><button class="link" data-act="go" data-to="alarms">Alarms</button></div>
      <ul class="mini-list">${future.map((i) => `<li><span class="mi">${esc(i.icon)}</span><span class="grow">${esc(i.label)}</span><b>${A.time12(i.t)}</b></li>`).join('')}</ul></section>`;
  }

  function pinned() {
    const list = A.S.notes.filter((n) => n.pinned).slice(0, 3);
    if (!list.length) return '';
    return `<section class="card glass"><div class="card-head"><h3>Pinned notes</h3><button class="link" data-act="go" data-to="notes">Open board</button></div>
      <div class="pin-stack">${list.map((n) => `<div class="pin-note" style="--n:${n.hue}">${esc(n.text || 'Empty note').slice(0, 140)}</div>`).join('')}</div></section>`;
  }

  function feed() {
    const f = A.S.feed.slice(0, 6);
    if (!f.length) return '';
    const label = (e) => {
      const bits = [];
      if (e.xp) bits.push(`<i class="${e.xp > 0 ? 'pos' : 'neg'}">${e.xp > 0 ? '+' : ''}${e.xp} XP</i>`);
      if (e.coins) bits.push(`<i class="${e.coins > 0 ? 'gold' : 'neg'}">${e.coins > 0 ? '+' : ''}${e.coins}c</i>`);
      if (e.hp) bits.push(`<i class="neg">${e.hp} HP</i>`);
      return bits.join(' ');
    };
    return `<section class="card glass"><div class="card-head"><h3>Activity</h3></div>
      <ul class="feed">${f.map((e) => `<li class="f-${e.type}"><span class="grow">${esc(e.text)}</span>${label(e)}<small>${A.ago(e.t)}</small></li>`).join('')}</ul></section>`;
  }

  function mood(info, remaining, sk) {
    const P = A.S.player;
    if (!G.activeHabits().length) return 'Add your first quest to begin the climb.';
    if (!info.total) return 'Nothing scheduled today. Rest up, or add a bonus quest.';
    if (info.done === info.total) return 'Perfect day. Every quest cleared. Go enjoy your coins.';
    if (P.hp <= 25) return `HP is critical at ${P.hp}. One more bad day could end you.`;
    if (!info.done) return `${remaining.length} quest${remaining.length > 1 ? 's' : ''} waiting. ${sk.current ? `Don't let the ${sk.current}-day streak die.` : 'Start a streak today.'}`;
    return `${info.done}/${info.total} done. Keep the momentum going.`;
  }

  A.views.today = {
    title: 'Today',
    render(root) {
      const today = A.today();
      const sched = G.scheduledOn(today);
      const info = G.dayInfo(today);
      const remaining = sched.filter((h) => !G.isDone(h, today));
      const sk = G.streak();
      const ratio = info.total ? info.done / info.total : 0;
      const risk = riskTonight(remaining);
      const sorted = sched.slice().sort((a, b) => {
        const da = G.isDone(a, today);
        const db = G.isDone(b, today);
        if (da !== db) return da ? 1 : -1;
        return (a.reminder || '99:99').localeCompare(b.reminder || '99:99');
      });
      const extra = G.activeHabits().filter((h) => !h.days.includes(A.dow(today)));

      root.innerHTML = `
      <div class="page-head">
        <p class="eyebrow">${A.prettyDate(today)}</p>
        <h1>${A.greeting()}, <em>${esc(A.S.profile.name)}</em></h1>
        <p class="sub">${mood(info, remaining, sk)}</p>
      </div>
      <div class="today-grid">
        <div class="col">
          <section class="card glass hero-card ${info.total && info.done === info.total ? 'perfect' : ''}">
            <div class="ring-big">
              <svg viewBox="0 0 120 120"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:hsl(var(--h) 95% 70%)"/><stop offset="1" style="stop-color:hsl(calc(var(--h) + 60) 95% 62%)"/></linearGradient></defs>
                <circle class="trk" cx="60" cy="60" r="52"/><circle class="val" cx="60" cy="60" r="52" stroke="url(#rg)" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC * (1 - ratio)}"/></svg>
              <div class="ring-text"><b>${info.done}<small>/${info.total}</small></b><span>quests</span></div>
            </div>
            <div class="hero-side">
              <div class="hero-stats">
                <div><b>${sk.current}</b><span>day streak</span></div>
                <div><b>${sk.longest}</b><span>best</span></div>
                <div><b>${Math.round(ratio * 100)}%</b><span>today</span></div>
              </div>
              ${weekStrip()}
              ${risk && remaining.length ? `<div class="risk">${icon('skull', 16)}<span>At risk tonight: <b>−${risk.hp} HP</b> · <b>−${risk.xp} XP</b> if you skip the rest</span></div>` : ''}
            </div>
          </section>

          <div class="section-head"><h2>Today’s quests</h2><button class="btn soft sm" data-act="newQuest">${icon('plus', 16)} New quest</button></div>
          ${
            sorted.length
              ? `<div class="quest-list">${sorted.map(questRow).join('')}</div>`
              : `<div class="card glass empty-state"><div class="big-emoji">🗡️</div><h3>${G.activeHabits().length ? 'No quests scheduled today' : 'Your quest log is empty'}</h3><p class="muted">${G.activeHabits().length ? 'Enjoy the rest day, or add a quest for today.' : 'Create your first quest and start building a streak.'}</p><button class="btn primary" data-act="newQuest">${icon('plus', 16)} Create a quest</button></div>`
          }
          ${extra.length ? `<p class="muted small center">${extra.length} other quest${extra.length > 1 ? 's are' : ' is'} resting today.</p>` : ''}
        </div>
        <aside class="col side">
          ${bossCard()}
          ${chestCard(info)}
          ${consistency(sk)}
          ${upcoming()}
          ${pinned()}
          ${feed()}
        </aside>
      </div>`;
    },
  };

  A.actions.toggle = (el) => G.toggle(el.dataset.id);
  A.actions.inc = (el) => G.inc(el.dataset.id, 1);
  A.actions.dec = (el) => G.inc(el.dataset.id, -1);
  A.actions.openChest = () => {
    const loot = G.openChest();
    if (!loot) return;
    A.fx.celebrate();
    A.ui.enqueue(() =>
      A.ui.modal({
        cls: 'modal-sm levelup',
        html: `<div class="lu-burst"></div><div class="boss-emoji big">🎁</div><p class="eyebrow">Daily chest</p><h2>You found <em>${loot.coins} coins</em></h2>
          ${loot.freeze ? '<p class="freeze-saved">' + icon('snow', 18) + ' Bonus: a Streak Freeze!</p>' : ''}${loot.heal ? '<p class="freeze-saved">' + icon('heart', 18) + ' Bonus: +20 HP!</p>' : ''}
          <button class="btn primary lg" data-close>Nice</button>`,
      })
    );
  };
})();
