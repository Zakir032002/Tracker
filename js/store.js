/* Ascend — state, persistence, event bus.
   Everything lives in one JSON blob in localStorage, mirrored to a rolling
   daily backup, so closing the tab / shutting down never loses progress. */
(function () {
  'use strict';
  const A = window.A;
  const KEY = 'ascend:v1';
  const BAK = 'ascend:v1:backup';

  /* ---------- tiny event bus ---------- */
  const handlers = {};
  A.bus = {
    on(evt, fn) {
      (handlers[evt] = handlers[evt] || []).push(fn);
      return () => (handlers[evt] = handlers[evt].filter((f) => f !== fn));
    },
    emit(evt, data) {
      (handlers[evt] || []).slice().forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.error('[bus]', evt, e);
        }
      });
    },
  };

  A.defaults = () => ({
    v: 1,
    createdAt: Date.now(),
    onboarded: false,
    profile: { name: 'Hero', avatar: '🦊' },
    player: { xp: 0, coins: 40, hp: 100, maxHp: 100, freezes: 1, boostUntil: 0, deaths: 0, bossesDefeated: 0, totalXpEver: 0, maxLevel: 1 },
    habits: [],
    logs: {}, // logs[date][habitId] = { n, done, xp, c, t }
    days: {}, // closed days: days[date] = { total, done, ratio, status, hp, xp, c }
    daily: {}, // daily[date] = { perfect:{xp,c}|null, chest:0|1|2 }
    lastClosed: null,
    boss: null,
    notes: [],
    alarms: [],
    alarmFired: {},
    achievements: {},
    rewards: [
      { id: 'r1', name: 'Watch an episode', icon: '🍿', cost: 40 },
      { id: 'r2', name: 'Favourite coffee', icon: '☕', cost: 25 },
      { id: 'r3', name: 'Gaming hour', icon: '🎮', cost: 60 },
      { id: 'r4', name: 'Cheat meal', icon: '🍕', cost: 90 },
    ],
    purchases: [],
    focus: { sessions: [], running: null, lastMin: 25 },
    sound: { master: 0.8, mix: {}, binaural: { mode: 'binaural', carrier: 220, beat: 10, vol: 0.5, noise: 0 }, presets: [], autoFocus: true },
    feed: [],
    stats: { done: 0, perfectDays: 0, focusMin: 0, focusSessions: 0, crits: 0, freezesUsed: 0, snoozes: 0 },
    settings: {
      theme: 'dark',
      accent: 265,
      sound: true,
      volume: 0.7,
      notifications: false,
      streakThreshold: 50,
      penalties: true,
      hardcore: false,
      weekStart: 1,
      snoozeMin: 10,
      confetti: true,
      quality: 'high',
      cursor: true,
    },
  });

  function merge(base, saved) {
    // deep-ish merge so new default keys appear after updates
    const out = Array.isArray(base) ? [] : { ...base };
    if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
    for (const k of Object.keys(saved || {})) {
      const b = base[k];
      const s = saved[k];
      out[k] = b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s) ? merge(b, s) : s;
    }
    return out;
  }

  let memoryOnly = false;
  function readRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      memoryOnly = true;
      return null;
    }
  }

  function load() {
    let parsed = null;
    for (const key of [KEY, BAK]) {
      const raw = readRaw(key);
      if (!raw) continue;
      try {
        parsed = JSON.parse(raw);
        if (parsed && parsed.v) break;
      } catch (e) {
        console.warn('[store] corrupt', key, e);
        parsed = null;
      }
    }
    return parsed ? merge(A.defaults(), parsed) : A.defaults();
  }

  A.S = load();
  A.memoryOnly = memoryOnly;

  let lastBackupDay = null;
  function writeNow() {
    if (memoryOnly) return;
    try {
      const json = JSON.stringify(A.S);
      localStorage.setItem(KEY, json);
      const day = A.today();
      if (lastBackupDay !== day) {
        // once per day (and first save of a session) keep a copy of the previous state
        localStorage.setItem(BAK, json);
        lastBackupDay = day;
      }
    } catch (e) {
      console.error('[store] save failed', e);
      A.bus.emit('save-error', e);
    }
  }
  const writeSoon = A.debounce(writeNow, 250);

  /* A.save() = persist + notify listeners (re-render). */
  A.save = (silent) => {
    writeSoon();
    if (!silent) A.bus.emit('change');
  };
  A.flush = writeNow;
  window.addEventListener('pagehide', writeNow);
  window.addEventListener('beforeunload', writeNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') writeNow();
  });

  // Ask the browser to never evict our data.
  A.persistStorage = async () => {
    try {
      if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
    } catch (e) {}
    return false;
  };

  /* ---------- export / import / reset ---------- */
  A.exportJSON = () => {
    const blob = new Blob([JSON.stringify(A.S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ascend-backup-${A.today()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };
  A.importJSON = (text) => {
    const data = JSON.parse(text);
    if (!data || !data.v || !Array.isArray(data.habits)) throw new Error('Not an Ascend backup file');
    A.S = merge(A.defaults(), data);
    writeNow();
  };
  A.resetAll = () => {
    A.S = A.defaults();
    writeNow();
  };
})();
