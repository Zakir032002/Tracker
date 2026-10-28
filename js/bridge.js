/* Ascend: bridge.
   Publishes a small snapshot of your day (quests, pinned notes, vitals) and accepts a few safe
   commands. Two things use it:
     - the Chrome side-panel extension (via window.postMessage to its content script)
     - the floating "Pin to screen" window
   Commands are a fixed whitelist; nothing here can run arbitrary code. */
(function () {
  'use strict';
  const A = window.A;
  const G = A.G;

  document.documentElement.setAttribute('data-ascend-app', '1');

  function snapshot() {
    const today = A.today();
    const li = G.levelInfo();
    const sk = G.streak();
    const sched = G.scheduledOn(today);
    const done = sched.filter((h) => G.isDone(h, today)).length;
    const quests = sched
      .filter((h) => h.sticky !== false)
      .map((h) => {
        const e = G.entry(today, h.id) || { n: 0, done: false };
        const D = G.DIFF[h.diff] || G.DIFF.medium;
        return {
          id: h.id, name: h.name, icon: h.icon, hue: h.hue, diff: h.diff, xp: D.xp,
          target: h.target || 1, n: e.n || 0, done: !!e.done, unit: h.unit || '', reminder: h.reminder || '',
          late: !e.done && !!h.reminder && A.nowMin() > A.hmToMin(h.reminder),
        };
      })
      .sort((a, b) => (a.done === b.done ? (a.reminder || '99').localeCompare(b.reminder || '99') : a.done ? 1 : -1));
    const notes = A.S.notes
      .slice()
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 40)
      .map((n) => ({ id: n.id, text: n.text, hue: n.hue, pinned: !!n.pinned }));
    return {
      v: 1,
      ts: Date.now(),
      date: today,
      theme: A.resolvedTheme(),
      hue: A.accentHue(),
      profile: { name: A.S.profile.name, avatar: A.S.profile.avatar },
      level: { n: li.level, rank: li.rank.name, pct: li.pct },
      hp: A.S.player.hp,
      maxHp: A.S.player.maxHp,
      coins: A.S.player.coins,
      streak: sk.current,
      progress: { done, total: sched.length },
      quests,
      notes,
    };
  }

  const NOTE_HUES = [48, 340, 160, 200, 270, 25];
  function addNote(text, hue) {
    const ys = A.S.notes.map((n) => (n.y || 0) + (n.h || 200));
    A.S.notes.push({
      id: A.uid(), text: String(text || '').slice(0, 2000), hue: hue ?? NOTE_HUES[A.S.notes.length % NOTE_HUES.length],
      x: 0, y: ys.length ? Math.max(...ys) + 24 : 0, w: 224, h: 210, z: 10 + A.S.notes.length, rot: +A.rand(-1.5, 1.5).toFixed(1),
      pinned: true, createdAt: Date.now(), updatedAt: Date.now(),
    });
    G.checkAch();
  }

  /* whitelisted commands */
  function exec(c) {
    if (!c || typeof c !== 'object') return;
    switch (c.t) {
      case 'toggle':
        if (A.S.habits.some((h) => h.id === c.id)) G.toggle(c.id);
        break;
      case 'inc':
        if (A.S.habits.some((h) => h.id === c.id)) G.inc(c.id, c.d > 0 ? 1 : -1);
        break;
      case 'noteAdd':
        if (typeof c.text === 'string' && c.text.trim()) addNote(c.text.trim(), c.hue);
        break;
      case 'noteEdit': {
        const n = A.S.notes.find((x) => x.id === c.id);
        if (n && typeof c.text === 'string') {
          n.text = c.text.slice(0, 2000);
          n.updatedAt = Date.now();
        }
        break;
      }
      case 'noteDel':
        A.S.notes = A.S.notes.filter((x) => x.id !== c.id);
        break;
      case 'notePin': {
        const n = A.S.notes.find((x) => x.id === c.id);
        if (n) n.pinned = !n.pinned;
        break;
      }
      case 'questAdd':
        if (typeof c.name === 'string' && c.name.trim()) G.addHabit({ name: c.name.trim().slice(0, 48), icon: c.icon || '✨', hue: A.ui.HUES[A.S.habits.length % A.ui.HUES.length], diff: 'medium' });
        break;
      default:
    }
    A.save();
  }

  /* ---- window.postMessage transport (extension content script) ---- */
  const post = () => window.postMessage({ src: 'ascend-app', type: 'snapshot', data: snapshot() }, location.origin);
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.src !== 'ascend-ext') return;
    if (e.data.type === 'cmd') exec(e.data.cmd);
    if (e.data.type === 'hello' || e.data.type === 'cmd') post();
  });
  A.bus.on('change', A.debounce(post, 200));
  setInterval(post, 30000); // keeps "late" flags and the heartbeat fresh
  setTimeout(post, 1500);

  A.bridge = { snapshot, exec, post };
})();
