/* Ascend — game engine.
   XP / levels / HP / coins, streaks, day rollover with penalties,
   weekly boss, achievements, shop. UI listens on A.bus. */
(function () {
  'use strict';
  const A = window.A;
  const S = () => A.S; // always read the live object (import/reset replaces it)

  const DIFF = {
    easy: { label: 'Easy', xp: 10, coins: 2, hp: 5, xpLoss: 6, coinLoss: 1, w: 1 },
    medium: { label: 'Medium', xp: 20, coins: 4, hp: 8, xpLoss: 12, coinLoss: 2, w: 2 },
    hard: { label: 'Hard', xp: 35, coins: 7, hp: 12, xpLoss: 22, coinLoss: 4, w: 3 },
    epic: { label: 'Epic', xp: 60, coins: 12, hp: 20, xpLoss: 40, coinLoss: 7, w: 5 },
  };

  const RANKS = [
    { min: 1, name: 'Seedling', hue: 140 },
    { min: 3, name: 'Apprentice', hue: 190 },
    { min: 6, name: 'Adept', hue: 220 },
    { min: 10, name: 'Knight', hue: 265 },
    { min: 15, name: 'Champion', hue: 300 },
    { min: 20, name: 'Master', hue: 330 },
    { min: 30, name: 'Grandmaster', hue: 20 },
    { min: 40, name: 'Legend', hue: 42 },
    { min: 50, name: 'Mythic', hue: 50 },
  ];

  const xpForLevel = (L) => 50 * L * (L - 1);
  const levelOf = (xp) => Math.floor(0.5 + Math.sqrt(0.25 + xp / 50));
  const rankOf = (lvl) => RANKS.slice().reverse().find((r) => lvl >= r.min) || RANKS[0];

  const G = (A.G = { DIFF, RANKS, xpForLevel, levelOf, rankOf });

  G.levelInfo = () => {
    const xp = S().player.xp;
    const level = levelOf(xp);
    const floor = xpForLevel(level);
    const next = xpForLevel(level + 1);
    return { level, xp, floor, next, into: xp - floor, need: next - floor, pct: (xp - floor) / (next - floor), rank: rankOf(level) };
  };

  /* ---------- feed ---------- */
  G.log = (type, text, extra = {}) => {
    const f = S().feed;
    f.unshift({ t: Date.now(), type, text, ...extra });
    if (f.length > 80) f.length = 80;
  };

  /* ---------- schedule & day info ---------- */
  const activeOn = (h, date) => h.createdAt <= date && (!h.archived || (h.archivedAt && h.archivedAt > date));
  G.scheduledOn = (date) => S().habits.filter((h) => activeOn(h, date) && h.days.includes(A.dow(date)));
  G.entry = (date, id) => (S().logs[date] || {})[id];
  G.isDone = (h, date) => !!(G.entry(date, h.id) || {}).done;
  const threshold = () => S().settings.streakThreshold;

  G.dayInfo = (date) => {
    const c = S().days[date];
    if (c) return { ...c, closed: true };
    const today = A.today();
    if (date > today) return null;
    if (date < A.fmt(new Date(S().createdAt))) return null;
    const sched = G.scheduledOn(date);
    const total = sched.length;
    const done = sched.filter((h) => G.isDone(h, date)).length;
    const ratio = total ? done / total : 0;
    const status = !total ? 'rest' : ratio * 100 >= threshold() ? 'kept' : 'open';
    return { total, done, ratio, status, closed: false };
  };

  /* ---------- streaks ---------- */
  const counts = (st) => st === 'kept' || st === 'frozen';
  G.streakThrough = (date) => {
    let n = 0;
    let d = date;
    for (let i = 0; i < 4000; i++) {
      const r = S().days[d];
      if (!r) break;
      if (counts(r.status)) n++;
      else if (r.status !== 'rest') break;
      d = A.addDays(d, -1);
    }
    return n;
  };
  G.streak = () => {
    const today = A.today();
    const t = G.dayInfo(today);
    const prev = G.streakThrough(A.addDays(today, -1));
    const current = prev + (t && t.status === 'kept' ? 1 : 0);
    let longest = 0;
    let run = 0;
    Object.keys(S().days)
      .sort()
      .forEach((d) => {
        const st = S().days[d].status;
        if (counts(st)) longest = Math.max(longest, ++run);
        else if (st !== 'rest') run = 0;
      });
    if (t && t.status === 'kept') longest = Math.max(longest, run + 1);
    return { current, prev, longest: Math.max(longest, current) };
  };

  G.habitStreak = (h) => {
    const today = A.today();
    let n = 0;
    let d = today;
    for (let i = 0; i < 1500 && d >= h.createdAt; i++) {
      if (h.days.includes(A.dow(d))) {
        if (G.isDone(h, d)) n++;
        else if (d !== today) break;
      }
      d = A.addDays(d, -1);
    }
    return n;
  };
  G.habitBest = (h) => {
    let best = 0;
    let run = 0;
    const today = A.today();
    for (let d = h.createdAt, i = 0; d <= today && i < 1500; d = A.addDays(d, 1), i++) {
      if (!h.days.includes(A.dow(d))) continue;
      if (G.isDone(h, d)) best = Math.max(best, ++run);
      else if (d !== today) run = 0;
    }
    return best;
  };
  G.habitRate = (h, days = 30) => {
    const today = A.today();
    let sched = 0;
    let done = 0;
    for (let i = 0; i < days; i++) {
      const d = A.addDays(today, -i);
      if (d < h.createdAt) break;
      if (!h.days.includes(A.dow(d))) continue;
      if (i === 0 && !G.isDone(h, d)) continue; // today is still in play
      sched++;
      if (G.isDone(h, d)) done++;
    }
    return sched ? done / sched : null;
  };

  /* ---------- XP / coins / HP primitives ---------- */
  G.boostActive = () => S().player.boostUntil > Date.now();
  function addXp(n) {
    const P = S().player;
    P.xp = Math.max(0, P.xp + n);
    if (n > 0) P.totalXpEver += n;
    const lvl = levelOf(P.xp);
    if (lvl > (P.maxLevel || 1)) {
      P.maxLevel = lvl;
      const bonus = lvl * 10;
      P.coins += bonus;
      G.log('level', `Reached level ${lvl}`, { coins: bonus });
      A.bus.emit('levelup', { level: lvl, bonus, rank: rankOf(lvl) });
    }
  }
  const addCoins = (n) => (S().player.coins = Math.max(0, S().player.coins + n));
  G.addXp = addXp;
  G.addCoins = addCoins;

  G.heal = (n) => {
    const P = S().player;
    const before = P.hp;
    P.hp = Math.min(P.maxHp, P.hp + n);
    return P.hp - before;
  };

  /* Damage. Returns true if it killed the player. */
  function hurt(n, reason) {
    const P = S().player;
    P.hp = Math.max(0, P.hp - n);
    A.bus.emit('damage', { amount: n, reason });
    if (P.hp <= 0) {
      die();
      return true;
    }
    return false;
  }
  G.hurt = hurt;

  function die() {
    const P = S().player;
    const lvl = levelOf(P.xp);
    const lostCoins = Math.floor(P.coins / 2);
    const hard = S().settings.hardcore;
    const newFloor = xpForLevel(hard ? Math.max(1, lvl - 1) : lvl);
    const lostXp = P.xp - newFloor;
    P.coins -= lostCoins;
    P.xp = newFloor;
    P.hp = Math.floor(P.maxHp / 2);
    const lostFreezes = P.freezes;
    P.freezes = 0;
    P.deaths++;
    G.log('death', `You were defeated. Lost ${lostCoins} coins and ${lostXp} XP.`);
    A.bus.emit('death', { lostCoins, lostXp, lostFreezes, levelDrop: hard && lvl > 1 });
  }

  /* ---------- habit completion ---------- */
  G.setCount = (id, n) => {
    const h = S().habits.find((x) => x.id === id);
    if (!h) return;
    const date = A.today();
    const L = (S().logs[date] = S().logs[date] || {});
    const e = L[id] || (L[id] = { n: 0, done: false });
    const target = h.target || 1;
    n = A.clamp(n, 0, target);
    const was = e.done;
    e.n = n;
    const now = n >= target;
    if (now && !was) complete(h, e);
    else if (!now && was) undo(h, e);
    else A.sfx(n > (e.prevN || 0) ? 'pop' : 'click');
    e.prevN = n;
    if (e.n === 0 && !e.done) delete L[id];
    afterChange();
  };
  G.toggle = (id) => {
    const h = S().habits.find((x) => x.id === id);
    if (!h) return;
    const e = G.entry(A.today(), id);
    const done = !!(e && e.done);
    G.setCount(id, done ? 0 : h.target || 1);
  };
  G.inc = (id, delta) => {
    const e = G.entry(A.today(), id);
    G.setCount(id, ((e && e.n) || 0) + delta);
  };

  function complete(h, e) {
    const D = DIFF[h.diff] || DIFF.medium;
    const prevStreak = G.streakThrough(A.addDays(A.today(), -1));
    const mult = 1 + Math.min(prevStreak, 50) * 0.01;
    const boost = G.boostActive() ? 2 : 1;
    const crit = Math.random() < 0.12;
    const xp = Math.round(D.xp * mult * boost * (crit ? 2 : 1));
    const coins = D.coins * (crit ? 2 : 1);
    e.done = true;
    e.xp = xp;
    e.c = coins;
    e.t = Date.now();
    addXp(xp);
    addCoins(coins);
    const st = S().stats;
    st.done++;
    if (crit) st.crits++;
    const hr = new Date().getHours();
    if (hr >= 4 && hr < 7) st.early = 1;
    if (hr >= 23 || hr < 4) st.night = 1;
    G.log('done', `${h.icon} ${h.name}`, { xp, coins, crit });
    damageBoss(D.w);
    A.sfx(crit ? 'crit' : 'check');
    setTimeout(() => A.sfx('coin'), 160);
    A.bus.emit('complete', { habit: h, xp, coins, crit, mult, boost });
  }
  function undo(h, e) {
    const D = DIFF[h.diff] || DIFF.medium;
    addXp(-(e.xp || 0));
    addCoins(-(e.c || 0));
    S().stats.done = Math.max(0, S().stats.done - 1);
    e.done = false;
    e.xp = 0;
    e.c = 0;
    damageBoss(-D.w);
    A.sfx('uncheck');
  }

  function afterChange() {
    const date = A.today();
    const info = G.dayInfo(date);
    const dd = (S().daily[date] = S().daily[date] || { perfect: null, chest: 0 });
    // perfect day bonus
    if (info.total > 0 && info.done === info.total && !dd.perfect) {
      const xp = 25 + info.total * 5;
      const c = 5 + info.total;
      dd.perfect = { xp, c };
      addXp(xp);
      addCoins(c);
      S().stats.perfectDays++;
      G.log('perfect', 'Perfect day!', { xp, coins: c });
      A.bus.emit('perfect', { xp, coins: c });
    } else if (dd.perfect && info.done < info.total) {
      addXp(-dd.perfect.xp);
      addCoins(-dd.perfect.c);
      S().stats.perfectDays = Math.max(0, S().stats.perfectDays - 1);
      dd.perfect = null;
    }
    // daily chest unlocks when the streak threshold is reached
    if (dd.chest === 0 && info.status === 'kept') {
      dd.chest = 1;
      A.bus.emit('chest-ready');
    }
    G.checkAch();
    A.save();
  }

  G.openChest = () => {
    const dd = S().daily[A.today()];
    if (!dd || dd.chest !== 1) return null;
    dd.chest = 2;
    const coins = A.randInt(8, 30);
    const loot = { coins };
    const r = Math.random();
    if (r < 0.07 && S().player.freezes < 5) {
      S().player.freezes++;
      loot.freeze = true;
    } else if (r < 0.14) {
      G.heal(20);
      loot.heal = 20;
    }
    addCoins(coins);
    G.log('chest', 'Opened the daily chest', { coins });
    A.sfx('chest');
    G.checkAch();
    A.save();
    return loot;
  };

  /* ---------- weekly boss ---------- */
  const BOSSES = [
    { name: 'Slime of Procrastination', emoji: '🫠' },
    { name: 'The Couch Dragon', emoji: '🐉' },
    { name: 'Doomscroll Hydra', emoji: '📱' },
    { name: 'Lord Snooze', emoji: '😴' },
    { name: 'Sloth Golem', emoji: '🦥' },
    { name: 'Excuse Phantom', emoji: '👻' },
    { name: 'The Last-Minute Lich', emoji: '💀' },
    { name: 'Entropy Kraken', emoji: '🦑' },
    { name: 'Fatigue Titan', emoji: '🗿' },
    { name: 'Chaos Imp', emoji: '👹' },
  ];
  G.ensureBoss = () => {
    const today = A.today();
    const wk = A.weekStart(today, S().settings.weekStart);
    const b = S().boss;
    if (b && b.week === wk) return b;
    if (b && !b.defeated) {
      G.log('boss', `${b.name} escaped…`);
      A.bus.emit('boss-escaped', b);
    }
    const from = today > wk ? today : wk;
    if (!S().habits.some((h) => !h.archived)) {
      S().boss = null;
      return null;
    }
    const idx = Math.abs([...wk].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % BOSSES.length;
    S().boss = { week: wk, from, ...BOSSES[idx], maxHp: bossHp(wk, from), dmg: 0, defeated: false };
    return S().boss;
  };
  /* Boss HP = 80% of the weighted quest completions still available this week. */
  function bossHp(wk, from) {
    let pts = 0;
    const weekEnd = A.addDays(wk, 6);
    for (let d = from; d <= weekEnd; d = A.addDays(d, 1)) {
      S().habits.forEach((h) => {
        if (!h.archived && h.days.includes(A.dow(d))) pts += (DIFF[h.diff] || DIFF.medium).w;
      });
    }
    return Math.max(4, Math.round(pts * 0.8));
  }
  /* quests changed mid-week: rescale the boss (unless it is already dead) */
  G.refreshBoss = () => {
    const b = S().boss;
    if (b && !b.defeated && b.week === A.weekStart(A.today(), S().settings.weekStart)) b.maxHp = bossHp(b.week, b.from || b.week);
    else G.ensureBoss();
  };
  function damageBoss(w) {
    const b = G.ensureBoss();
    if (!b) return;
    if (b.defeated) return;
    b.dmg = Math.max(0, b.dmg + w);
    if (w > 0) A.bus.emit('boss-hit', { boss: b, w });
    if (b.dmg >= b.maxHp) {
      b.defeated = true;
      S().player.bossesDefeated++;
      addXp(100);
      addCoins(40);
      G.log('boss', `Defeated ${b.name}`, { xp: 100, coins: 40 });
      A.bus.emit('boss-defeated', b);
    }
  }

  /* ---------- day rollover: this is where slacking costs you ---------- */
  function closeDay(d, rep, penalize) {
    // grace: a quest created after 8 PM isn't part of (or penalised for) that same night
    const late = (h) => h.createdAt === d && h.createdTs && new Date(h.createdTs).getHours() >= 20;
    const sched = G.scheduledOn(d).filter((h) => G.isDone(h, d) || !late(h));
    const total = sched.length;
    const missed = sched.filter((h) => !G.isDone(h, d));
    const done = total - missed.length;
    const ratio = total ? done / total : 0;
    const P = S().player;
    let status;
    if (!total) status = 'rest';
    else if (ratio * 100 >= threshold()) status = 'kept';
    else if (P.freezes > 0) {
      P.freezes--;
      S().stats.freezesUsed++;
      status = 'frozen';
      rep.frozen++;
      G.log('freeze', `A Streak Freeze saved ${A.prettyDate(d, { month: 'short', day: 'numeric' })}`);
    } else status = 'broken';

    let hp = 0;
    let xp = 0;
    let c = 0;
    let healed = 0;
    if (status === 'kept') healed = G.heal(ratio === 1 ? 10 : 5);
    if (penalize && S().settings.penalties && total) {
      const mul = S().settings.hardcore ? 2 : 1;
      missed.forEach((h) => {
        const D = DIFF[h.diff] || DIFF.medium;
        hp += D.hp * mul;
        xp += D.xpLoss * mul;
        c += D.coinLoss * mul;
      });
      if (hp) {
        const floor = xpForLevel(levelOf(P.xp));
        const realXp = Math.min(xp, Math.max(0, P.xp - floor));
        const realC = Math.min(c, P.coins);
        P.xp -= realXp;
        P.coins -= realC;
        xp = realXp;
        c = realC;
        rep.hp += hp;
        rep.xp += xp;
        rep.coins += c;
        const died = hurt(hp, 'missed');
        if (died) rep.died = true;
      }
    }
    S().days[d] = { total, done, ratio, status, hpLost: hp, xpLost: xp, cLost: c, healed, missed: missed.map((h) => h.id) };
    rep.days++;
    if (status === 'broken') rep.broken++;
    if (total) rep.missed.push(...missed.map((h) => ({ date: d, icon: h.icon, name: h.name })));
    if (hp || status === 'broken')
      G.log('penalty', `${A.prettyDate(d, { month: 'short', day: 'numeric' })}: missed ${missed.length}`, { hp: -hp, xp: -xp, coins: -c });
  }

  G.rollover = () => {
    const today = A.today();
    if (!S().lastClosed) S().lastClosed = A.addDays(today, -1);
    if (S().lastClosed >= A.addDays(today, -1)) {
      G.ensureBoss();
      return null;
    }
    const rep = { days: 0, hp: 0, xp: 0, coins: 0, broken: 0, frozen: 0, died: false, missed: [], prevStreak: G.streakThrough(S().lastClosed), from: null, to: null };
    let d = A.addDays(S().lastClosed, 1);
    rep.from = d;
    const yest = A.addDays(today, -1);
    const penaltyFrom = A.addDays(today, -30);
    while (d <= yest) {
      closeDay(d, rep, d >= penaltyFrom);
      d = A.addDays(d, 1);
    }
    rep.to = yest;
    S().lastClosed = yest;
    G.ensureBoss();
    G.checkAch();
    A.save();
    A.bus.emit('report', rep);
    return rep;
  };

  /* ---------- quests CRUD ---------- */
  G.addHabit = (data) => {
    const h = {
      id: A.uid(),
      name: data.name.trim(),
      icon: data.icon || '✨',
      hue: data.hue ?? 265,
      diff: data.diff || 'medium',
      days: data.days && data.days.length ? data.days : [0, 1, 2, 3, 4, 5, 6],
      target: Math.max(1, data.target || 1),
      unit: data.unit || '',
      reminder: data.reminder || '',
      createdAt: A.today(),
      createdTs: Date.now(),
      archived: false,
    };
    S().habits.push(h);
    G.refreshBoss();
    G.checkAch();
    A.save();
    return h;
  };
  G.updateHabit = (id, data) => {
    const h = S().habits.find((x) => x.id === id);
    if (!h) return;
    Object.assign(h, data);
    h.target = Math.max(1, h.target || 1);
    G.refreshBoss();
    A.save();
  };
  G.archiveHabit = (id, on = true) => {
    const h = S().habits.find((x) => x.id === id);
    if (!h) return;
    h.archived = on;
    h.archivedAt = on ? A.addDays(A.today(), 1) : null;
    G.refreshBoss();
    A.save();
  };
  G.removeHabit = (id) => {
    const s = S();
    s.habits = s.habits.filter((h) => h.id !== id);
    s.alarms.forEach((a) => a.habitId === id && (a.habitId = ''));
    G.refreshBoss();
    A.save();
  };

  /* ---------- shop ---------- */
  G.SHOP = [
    { id: 'freeze', name: 'Streak Freeze', icon: '🧊', cost: 40, desc: 'Automatically saves your streak the next time you miss a day. Holds up to 5.' },
    { id: 'potion', name: 'Health Potion', icon: '🧪', cost: 25, desc: 'Restore 30 HP instantly.' },
    { id: 'boost', name: 'XP Elixir', icon: '⚡', cost: 60, desc: 'Double XP on every quest for 24 hours.' },
  ];
  G.buy = (id) => {
    const item = G.SHOP.find((i) => i.id === id);
    const P = S().player;
    if (!item) return { ok: false };
    if (P.coins < item.cost) return { ok: false, msg: 'Not enough coins' };
    if (id === 'freeze' && P.freezes >= 5) return { ok: false, msg: 'You already hold 5 freezes' };
    if (id === 'potion' && P.hp >= P.maxHp) return { ok: false, msg: 'HP is already full' };
    P.coins -= item.cost;
    if (id === 'freeze') P.freezes++;
    if (id === 'potion') G.heal(30);
    if (id === 'boost') P.boostUntil = Math.max(Date.now(), P.boostUntil) + 24 * 3600 * 1000;
    S().purchases.unshift({ t: Date.now(), name: item.name, icon: item.icon, cost: item.cost, kind: 'item' });
    G.log('buy', `Bought ${item.name}`, { coins: -item.cost });
    A.sfx('buy');
    G.checkAch();
    A.save();
    return { ok: true };
  };
  G.redeem = (id) => {
    const r = S().rewards.find((x) => x.id === id);
    const P = S().player;
    if (!r) return { ok: false };
    if (P.coins < r.cost) return { ok: false, msg: 'Not enough coins' };
    P.coins -= r.cost;
    S().purchases.unshift({ t: Date.now(), name: r.name, icon: r.icon, cost: r.cost, kind: 'reward' });
    G.log('buy', `Redeemed ${r.name}`, { coins: -r.cost });
    A.sfx('buy');
    G.checkAch();
    A.save();
    return { ok: true };
  };

  /* ---------- alarms / focus hooks ---------- */
  G.ignoreAlarm = (habit) => {
    if (!S().settings.penalties) return 0;
    const loss = S().settings.hardcore ? 6 : 3;
    G.log('penalty', `Ignored the call: ${habit.icon} ${habit.name}`, { hp: -loss });
    hurt(loss, 'ignored');
    A.save();
    return loss;
  };
  G.snoozeCost = () => (S().player.coins > 0 ? 1 : 0);
  G.finishFocus = (minutes) => {
    const xp = Math.round(minutes);
    const coins = Math.floor(minutes / 5);
    const f = S().focus;
    f.sessions.unshift({ t: Date.now(), date: A.today(), min: minutes });
    if (f.sessions.length > 400) f.sessions.length = 400;
    S().stats.focusMin += minutes;
    S().stats.focusSessions++;
    addXp(xp);
    addCoins(coins);
    G.log('focus', `Focused for ${minutes} min`, { xp, coins });
    G.checkAch();
    A.save();
    return { xp, coins };
  };

  /* ---------- achievements ---------- */
  const R = { common: { xp: 15, label: 'Common' }, rare: { xp: 40, label: 'Rare' }, epic: { xp: 100, label: 'Epic' }, legendary: { xp: 250, label: 'Legendary' } };
  G.RARITY = R;
  const ach = (id, icon, name, desc, rarity, test, prog) => ({ id, icon, name, desc, rarity, test, prog });
  const ctx = () => {
    const st = S().stats;
    const sk = G.streak();
    return {
      done: st.done,
      streak: sk.longest,
      perfect: st.perfectDays,
      level: levelOf(S().player.xp),
      coins: S().player.coins,
      bosses: S().player.bossesDefeated,
      notes: S().notes.length,
      alarms: S().alarms.length,
      focusSessions: st.focusSessions,
      focusMin: st.focusMin,
      deaths: S().player.deaths,
      habits: S().habits.filter((h) => !h.archived).length,
      epic: S().habits.some((h) => h.diff === 'epic'),
      freezesUsed: st.freezesUsed,
      crits: st.crits,
      purchases: S().purchases.length,
      early: st.early || 0,
      night: st.night || 0,
      lowHp: S().player.hp > 0 && S().player.hp <= 10,
    };
  };
  const cnt = (id, icon, name, desc, rarity, key, n) => ach(id, icon, name, desc, rarity, (c) => c[key] >= n, (c) => [Math.min(c[key], n), n]);
  G.ACH = [
    cnt('done1', '🎯', 'First Step', 'Complete your first quest', 'common', 'done', 1),
    cnt('done10', '⚔️', 'Warming Up', 'Complete 10 quests', 'common', 'done', 10),
    cnt('done50', '🛡️', 'Grinder', 'Complete 50 quests', 'common', 'done', 50),
    cnt('done100', '🏹', 'Centurion', 'Complete 100 quests', 'rare', 'done', 100),
    cnt('done500', '🗡️', 'Relentless', 'Complete 500 quests', 'epic', 'done', 500),
    cnt('done1000', '👑', 'Unstoppable', 'Complete 1,000 quests', 'legendary', 'done', 1000),
    cnt('streak3', '🔥', 'On Fire', 'Reach a 3-day streak', 'common', 'streak', 3),
    cnt('streak7', '📅', 'Week Warrior', 'Reach a 7-day streak', 'common', 'streak', 7),
    cnt('streak14', '⚡', 'Fortnight Force', 'Reach a 14-day streak', 'rare', 'streak', 14),
    cnt('streak30', '🌙', 'Month Master', 'Reach a 30-day streak', 'epic', 'streak', 30),
    cnt('streak60', '🪨', 'Iron Will', 'Reach a 60-day streak', 'epic', 'streak', 60),
    cnt('streak100', '☄️', 'Triple Digits', 'Reach a 100-day streak', 'legendary', 'streak', 100),
    cnt('streak365', '🌞', 'Year of Fire', 'Reach a 365-day streak', 'legendary', 'streak', 365),
    cnt('perfect1', '💎', 'Flawless', 'Finish a perfect day', 'common', 'perfect', 1),
    cnt('perfect7', '✨', 'Immaculate', 'Finish 7 perfect days', 'rare', 'perfect', 7),
    cnt('perfect30', '🏆', 'Perfectionist', 'Finish 30 perfect days', 'epic', 'perfect', 30),
    cnt('lvl5', '⭐', 'Rising Star', 'Reach level 5', 'common', 'level', 5),
    cnt('lvl10', '🌟', 'Veteran', 'Reach level 10', 'rare', 'level', 10),
    cnt('lvl20', '💫', 'Elite', 'Reach level 20', 'epic', 'level', 20),
    cnt('lvl30', '🌌', 'Living Legend', 'Reach level 30', 'legendary', 'level', 30),
    cnt('crit5', '💥', 'Critical Mind', 'Land 5 critical completions', 'rare', 'crits', 5),
    cnt('boss1', '🐲', 'Boss Slayer', 'Defeat a weekly boss', 'rare', 'bosses', 1),
    cnt('boss5', '🗻', 'Dragonbane', 'Defeat 5 weekly bosses', 'epic', 'bosses', 5),
    cnt('rich', '💰', 'Dragon Hoard', 'Hold 500 coins at once', 'rare', 'coins', 500),
    cnt('shop1', '🛍️', 'Treat Yourself', 'Buy something in the Vault', 'common', 'purchases', 1),
    cnt('scribe', '📝', 'Scribe', 'Keep 5 sticky notes', 'common', 'notes', 5),
    cnt('alarm1', '⏰', 'Early Warning', 'Set an alarm', 'common', 'alarms', 1),
    cnt('focus1', '🧘', 'In the Zone', 'Finish a focus session', 'common', 'focusSessions', 1),
    cnt('focus600', '🧠', 'Deep Work', 'Focus for 10 hours total', 'epic', 'focusMin', 600),
    cnt('collector', '🗂️', 'Collector', 'Track 5 quests at once', 'common', 'habits', 5),
    cnt('ice', '❄️', 'Frozen in Time', 'Have a Streak Freeze save your streak', 'rare', 'freezesUsed', 1),
    ach('early', '🌅', 'Early Bird', 'Complete a quest between 4 and 7 AM', 'rare', (c) => c.early > 0),
    ach('night', '🦉', 'Night Owl', 'Complete a quest after 11 PM', 'rare', (c) => c.night > 0),
    ach('epicq', '🔱', 'Go Big', 'Create an Epic-difficulty quest', 'common', (c) => c.epic),
    ach('dead', '💀', 'Humbled', 'Get defeated once. It happens.', 'common', (c) => c.deaths >= 1),
    ach('close', '🩹', 'Living Dangerously', 'Survive with 10 HP or less', 'rare', (c) => c.lowHp),
  ];

  G.achCtx = ctx;
  G.checkAch = () => {
    let again = true;
    let guard = 0;
    while (again && guard++ < 6) {
      again = false;
      const c = ctx();
      G.ACH.forEach((a) => {
        if (S().achievements[a.id] || !a.test(c)) return;
        S().achievements[a.id] = Date.now();
        const r = R[a.rarity];
        addXp(r.xp);
        addCoins(Math.round(r.xp / 5));
        G.log('ach', `Unlocked ${a.name}`, { xp: r.xp });
        A.bus.emit('achievement', a);
        again = true;
      });
    }
  };

  /* ---------- helpers for views ---------- */
  G.activeHabits = () => S().habits.filter((h) => !h.archived);
  G.hpClass = () => {
    const p = S().player.hp / S().player.maxHp;
    return p > 0.6 ? 'ok' : p > 0.3 ? 'warn' : 'crit';
  };
})();
