/* Ascend: Today. Sticky hero column (the 3D core lives in its slot) + quest stream. */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon, G } = { esc: A.esc, icon: A.icon, G: A.G };

  const weekNo = (s) => {
    const d = A.parse(s);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 864e5 + 1) / 7);
  };

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
      const cls = info ? info.status : 'future';
      let inner = '';
      if (info) {
        if (info.status === 'kept') inner = icon('check', 13);
        else if (info.status === 'frozen') inner = icon('snow', 12);
        else if (info.status === 'broken') inner = icon('x', 12);
        else if (info.status === 'open' && info.total) inner = `<small>${info.done}/${info.total}</small>`;
      }
      html += `<div class="wd ${cls} ${d === today ? 'is-today' : ''}"><span>${A.DAYS[A.dow(d)].slice(0, 3)}</span><i>${inner}</i></div>`;
    }
    return `<div class="week-strip">${html}</div>`;
  }

  function questRow(h, idx) {
    const today = A.today();
    const e = G.entry(today, h.id) || { n: 0, done: false };
    const D = G.DIFF[h.diff] || G.DIFF.medium;
    const target = h.target || 1;
    const done = !!e.done;
    const st = G.habitStreak(h);
    const late = !done && h.reminder && A.nowMin() > A.hmToMin(h.reminder);
    const fresh = done && e.t && Date.now() - e.t < 1500;
    const multi = target > 1;
    const pct = Math.round((e.n / target) * 100);
    return `<article class="quest ${done ? 'done' : ''} ${late ? 'late' : ''} ${fresh ? 'fresh' : ''}" data-habit="${h.id}" style="--c:${h.hue}">
      <span class="q-idx">${A.p2(idx + 1)}</span>
      <div class="q-main">
        <div class="q-title"><span class="q-icon">${esc(h.icon)}</span><h3><span class="q-name">${esc(h.name)}</span></h3></div>
        <div class="q-meta">
          <span class="chip d-${h.diff}">${D.label}</span>
          <span class="chip xp">+${D.xp} XP</span>
          ${st ? `<span class="chip fire">${icon('flame', 11)} ${st}</span>` : ''}
          ${h.reminder ? `<span class="chip ${late ? 'late' : 'time'}">${icon('clock', 11)} ${A.time12(h.reminder)}${late ? ' · overdue' : ''}</span>` : ''}
        </div>
        ${multi ? `<div class="q-prog"><i style="width:${pct}%"></i></div>` : ''}
      </div>
      ${multi ? `<div class="stepper" role="group" aria-label="Progress"><button class="icon-btn sm" data-act="dec" data-id="${h.id}" data-quiet aria-label="Less">${icon('minus', 15)}</button>
        <span class="count"><b>${e.n}</b>/${target}${h.unit ? `<small>${esc(h.unit)}</small>` : ''}</span>
        <button class="icon-btn sm" data-act="inc" data-id="${h.id}" data-quiet aria-label="More">${icon('plus', 15)}</button></div>` : ''}
      <button class="check" data-act="toggle" data-id="${h.id}" data-quiet aria-pressed="${done}" aria-label="${done ? 'Undo' : 'Complete'} ${esc(h.name)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
      </button>
    </article>`;
  }

  function bossCard() {
    const b = A.S.boss;
    if (!b) return `<section class="card glass boss-card empty"><p class="eyebrow">Weekly boss</p><p class="muted">Add a few quests and a boss will appear to hunt this week.</p></section>`;
    const left = Math.max(0, b.maxHp - b.dmg);
    const pct = Math.max(0, Math.min(100, (left / b.maxHp) * 100));
    const days = Math.max(0, A.diffDays(A.today(), A.addDays(b.week, 7)));
    return `<section class="card glass boss-card ${b.defeated ? 'dead' : ''}" data-tilt>
      <div class="boss-top"><p class="eyebrow">Weekly boss</p><span class="chip ${b.defeated ? 'xp' : ''}">${b.defeated ? 'Defeated' : days + (days === 1 ? ' day left' : ' days left')}</span></div>
      <div class="boss-body"><div class="boss-emoji">${b.emoji}</div>
        <div><h3>${esc(b.name)}</h3><p class="muted small">Every quest you complete lands a hit.</p></div></div>
      <div class="boss-hp"><i style="width:${pct}%"></i></div>
      <div class="boss-foot"><span>${b.defeated ? 'Slain' : `${left} / ${b.maxHp} HP`}</span><span>${Math.round(100 - pct)}% damage</span></div>
    </section>`;
  }

  function chestCard(info) {
    const dd = A.S.daily[A.today()] || { chest: 0 };
    const thr = A.S.settings.streakThreshold;
    if (dd.chest === 1)
      return `<section class="card glass chest-card ready"><button class="chest" data-act="openChest" data-quiet aria-label="Open daily chest"><span>🎁</span></button>
        <div><h3>Daily chest ready</h3><p class="muted small">Tap to open it.</p></div></section>`;
    if (dd.chest === 2) return `<section class="card glass chest-card opened"><div class="chest"><span>📭</span></div><div><h3>Chest opened</h3><p class="muted small">Another one tomorrow.</p></div></section>`;
    const need = Math.max(0, Math.ceil((info.total * thr) / 100) - info.done);
    return `<section class="card glass chest-card locked"><div class="chest"><span>${icon('lock', 22)}</span></div>
      <div><h3>Daily chest</h3><p class="muted small">${info.total ? `${need} more quest${need === 1 ? '' : 's'} to unlock.` : 'Add quests to earn it.'}</p></div></section>`;
  }

  function consistency(sk) {
    return `<section class="card glass consistency"><div class="card-head"><div><h3>Consistency</h3><p class="muted small">${sk.current ? `${sk.current}-day streak` : 'Start a streak today'} · best ${sk.longest}</p></div><button class="link" data-act="go" data-to="insights">Insights</button></div>
      <div class="heat-scroll tight">${A.miniHeat(15, 13)}</div></section>`;
  }

  function upcoming() {
    const nowM = A.nowMin();
    const items = [];
    A.S.alarms.filter((a) => a.enabled && (!a.days.length || a.days.includes(new Date().getDay()))).forEach((a) => items.push({ t: a.time, label: a.label || 'Alarm', icon: '⏰' }));
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
    return `<section class="card glass"><div class="card-head"><h3>Pinned notes</h3><button class="link" data-act="go" data-to="notes">Board</button></div>
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

  const QUOTES = [
    ['We are what we repeatedly do. Excellence, then, is not an act but a habit.', 'Will Durant'],
    ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
    ['The secret of getting ahead is getting started.', 'Mark Twain'],
    ['Small disciplines repeated with consistency every day lead to great achievements.', 'John C. Maxwell'],
    ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
    ['Motivation gets you going. Habit keeps you growing.', 'Jim Ryun'],
    ['First forget inspiration. Habit is more dependable.', 'Octavia Butler'],
    ['The chains of habit are too light to be felt until they are too heavy to be broken.', 'Warren Buffett'],
    ['Quality is not an act, it is a habit.', 'Aristotle'],
    ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt'],
    ['Well begun is half done.', 'Aristotle'],
    ['The best time to plant a tree was twenty years ago. The second best time is now.', 'Proverb'],
    ['What you do every day matters more than what you do once in a while.', 'Gretchen Rubin'],
    ['A year from now you may wish you had started today.', 'Karen Lamb'],
    ['Discipline is choosing between what you want now and what you want most.', 'Abraham Lincoln'],
    ['Action is the foundational key to all success.', 'Pablo Picasso'],
    ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
    ['Begin anywhere.', 'John Cage'],
    ['Energy and persistence conquer all things.', 'Benjamin Franklin'],
    ['The way to get started is to quit talking and begin doing.', 'Walt Disney'],
  ];
  function intention() {
    const d = A.today();
    const mine = A.S.intent && A.S.intent.date === d ? A.S.intent.text : '';
    const q = QUOTES[Math.abs([...d].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % QUOTES.length];
    return `<section class="card glass intention"><p class="eyebrow">${mine ? 'Your intention for today' : 'Thought for today'}</p>
      <blockquote>${mine ? esc(mine) : '“' + esc(q[0]) + '”'}</blockquote>
      ${mine ? '' : `<cite>${esc(q[1])}</cite>`}
      <div class="row gap"><button class="link" data-act="setIntent" data-quiet>${mine ? 'Change it' : 'Write my own intention'}</button>${mine ? '<button class="link" data-act="clearIntent" data-quiet>Back to the quote</button>' : ''}</div></section>`;
  }

  function mood(info, remaining, sk) {
    const P = A.S.player;
    if (!G.activeHabits().length) return 'Add your first quest to begin the climb.';
    if (!info.total) return 'Nothing scheduled today. Rest, or add a bonus quest.';
    if (info.done === info.total) return 'Every quest cleared. Go enjoy your coins.';
    if (P.hp <= 25) return `HP is critical at ${P.hp}. One more bad day could end you.`;
    if (!info.done) return `${remaining.length} quest${remaining.length > 1 ? 's' : ''} waiting. ${sk.current ? `Don't let the ${sk.current}-day streak die.` : 'Start a streak today.'}`;
    return `${info.done} of ${info.total} done. Keep the momentum.`;
  }

  A.views.today = {
    title: 'Today',
    mode: 'core',
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
      const d = A.parse(today);

      root.innerHTML = `
      <div class="today">
        <section class="hero ${info.total && info.done === info.total ? 'perfect' : ''}">
          <div class="hero-top">
            <p class="eyebrow">${A.DAYS[d.getDay()]} · ${d.getDate()} ${A.MONTHS[d.getMonth()]} · Week ${weekNo(today)}</p>
            <h1>${A.greeting()},<br><em>${esc(A.S.profile.name)}.</em></h1>
            <p class="lede">${mood(info, remaining, sk)}</p>
          </div>
          <div class="core-slot" data-core-slot aria-hidden="true"></div>
          <div class="hero-foot">
            <div class="big-stat"><b>${info.done}<small>/${info.total}</small></b><span>quests</span></div>
            <div class="big-stat"><b>${sk.current}</b><span>day streak</span></div>
            <div class="big-stat"><b>${Math.round(ratio * 100)}<small>%</small></b><span>today</span></div>
          </div>
          ${weekStrip()}
          ${risk && remaining.length ? `<p class="risk">${icon('skull', 14)} At risk tonight: <b>−${risk.hp} HP</b> · <b>−${risk.xp} XP</b> if you skip the rest</p>` : ''}
        </section>

        <section class="stream">
          <div class="section-head first"><h2>Today’s <em>quests</em></h2><div class="row gap"><button class="btn ghost sm" data-act="pinOpen" title="Open a small always-on-top window with today's quests"><span>📌 Pin to screen</span></button><button class="btn soft sm" data-act="newQuest"><span>${icon('plus', 15)} New quest</span></button></div></div>
          ${
            sorted.length
              ? `<div class="quest-list">${sorted.map(questRow).join('')}</div>`
              : `<div class="card glass empty-state"><div class="big-emoji">🗡️</div><h3>${G.activeHabits().length ? 'No quests scheduled today' : 'Your quest log is empty'}</h3><p class="muted">${G.activeHabits().length ? 'Enjoy the rest day, or add a quest for today.' : 'Create your first quest and start building a streak.'}</p><button class="btn primary" data-act="newQuest"><span>${icon('plus', 15)} Create a quest</span></button></div>`
          }
          ${extra.length ? `<p class="muted small rest-note">${extra.length} other quest${extra.length > 1 ? 's are' : ' is'} resting today.</p>` : ''}
          <div class="panels">
            ${intention()}
            ${bossCard()}
            ${chestCard(info)}
            ${consistency(sk)}
            ${upcoming()}
            ${pinned()}
            ${feed()}
          </div>
        </section>
      </div>`;
    },
  };

  A.actions.setIntent = () => {
    const m = A.ui.modal({
      cls: 'modal-sm',
      html: `<p class="eyebrow">Today's intention</p><h3>What matters most today?</h3>
        <label class="field"><textarea id="int-text" class="input" style="height:110px;padding:14px;resize:none" maxlength="140" placeholder="Today I will…"></textarea></label>
        <div class="row end gap"><button class="btn ghost" data-close><span>Cancel</span></button><button class="btn primary" id="int-save"><span>Set intention</span></button></div>`,
    });
    const ta = m.el.querySelector('#int-text');
    ta.value = A.S.intent && A.S.intent.date === A.today() ? A.S.intent.text : '';
    setTimeout(() => ta.focus(), 500);
    m.el.querySelector('#int-save').addEventListener('click', () => {
      const t = ta.value.trim();
      A.S.intent = t ? { date: A.today(), text: t } : null;
      A.save();
      m.close();
    });
  };
  A.actions.clearIntent = () => {
    A.S.intent = null;
    A.save();
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
          ${loot.freeze ? '<p class="freeze-saved">' + icon('snow', 18) + ' Bonus: a Streak Freeze</p>' : ''}${loot.heal ? '<p class="freeze-saved">' + icon('heart', 18) + ' Bonus: +20 HP</p>' : ''}
          <button class="btn primary lg" data-close><span>Nice</span></button>`,
      })
    );
  };
})();
