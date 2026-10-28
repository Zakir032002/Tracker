/* Ascend — alarm engine.
   Rings alarms + quest reminders with sound, a full-screen takeover, escalating
   snooze cost, and damage if you ignore a quest alarm. Runs while the app is open. */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon, G } = { esc: A.esc, icon: A.icon, G: A.G };

  let current = null; // active ring context
  const waiting = [];
  let titleTimer = null;
  let escTimer = null;
  let giveUpTimer = null;
  const baseTitle = () => document.title.replace(/^⏰ .* · /, '');

  const TAUNTS = [
    'Your future self is watching.',
    'The weekly boss grows stronger while you wait.',
    'Comfort is the enemy of progress.',
    'Do it now. Thank yourself tonight.',
    'Two minutes of effort beats two hours of guilt.',
    'Your streak is counting on you.',
  ];

  const snoozes = () => (A.S.snoozes = A.S.snoozes || []);

  function resolve(ref) {
    const alarm = ref.alarmId ? A.S.alarms.find((a) => a.id === ref.alarmId) : null;
    const habit = ref.habitId ? A.S.habits.find((h) => h.id === ref.habitId) : null;
    return { kind: ref.kind, alarm, habit, key: ref.key, snoozeCount: ref.snoozeCount || 0 };
  }

  function check() {
    if (!A.S.onboarded) return;
    const now = new Date();
    const date = A.today();
    const nowM = A.nowMin();
    const dow = now.getDay();
    const fired = A.S.alarmFired;
    let dirty = false;

    A.S.alarms.forEach((a) => {
      if (!a.enabled || !a.days.includes(dow)) return;
      const m = A.hmToMin(a.time);
      if (nowM < m || nowM - m > 90) return;
      const key = `a:${a.id}:${date}`;
      if (fired[key]) return;
      fired[key] = 1;
      dirty = true;
      if (a.once) a.enabled = false;
      const habit = a.habitId ? A.S.habits.find((h) => h.id === a.habitId) : null;
      if (habit && G.isDone(habit, date)) return; // already handled, stay quiet
      trigger({ kind: habit ? 'habit' : 'alarm', alarmId: a.id, habitId: habit ? habit.id : '', key });
    });

    G.scheduledOn(date).forEach((h) => {
      if (!h.reminder || G.isDone(h, date)) return;
      const m = A.hmToMin(h.reminder);
      if (nowM < m || nowM - m > 90) return;
      const key = `h:${h.id}:${date}`;
      if (fired[key]) return;
      fired[key] = 1;
      dirty = true;
      trigger({ kind: 'habit', habitId: h.id, key });
    });

    const sn = snoozes();
    const due = sn.filter((s) => s.at <= Date.now());
    if (due.length) {
      A.S.snoozes = sn.filter((s) => s.at > Date.now());
      dirty = true;
      due.forEach((s) => {
        const c = resolve(s.ref);
        if (c.habit && G.isDone(c.habit, date)) return;
        trigger(s.ref);
      });
    }

    // forget old dedupe keys
    if (now.getSeconds() === 0) {
      Object.keys(fired).forEach((k) => {
        if (!k.endsWith(date)) {
          delete fired[k];
          dirty = true;
        }
      });
    }
    if (dirty) A.save(true);
  }

  function trigger(ref) {
    if (current) {
      if (!waiting.some((w) => w.key === ref.key) && current.key !== ref.key) waiting.push(ref);
      return;
    }
    ring(resolve(ref));
  }

  function notify(c) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (!document.hidden) return;
      const title = c.habit ? `${c.habit.icon} ${c.habit.name}` : c.alarm ? c.alarm.label || 'Alarm' : 'Alarm';
      const opts = { body: c.habit ? 'Quest reminder. Do it now or take the damage.' : 'Time’s up!', tag: 'ascend-ring', requireInteraction: true, icon: 'assets/icon.svg' };
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(() => new Notification(title, opts));
      else new Notification(title, opts);
    } catch (e) {}
  }

  function ring(c) {
    current = c;
    const toneKey = (c.alarm && c.alarm.tone) || (c.habit ? 'beacon' : 'sunrise');
    const label = c.habit ? c.habit.name : c.alarm ? c.alarm.label || 'Alarm' : 'Test alarm';
    const em = c.habit ? c.habit.icon : '⏰';
    const strict = !!c.habit && A.S.settings.penalties;
    const ignoreLoss = A.S.settings.hardcore ? 6 : 3;
    const maxSnooze = 3;
    const cost = c.snoozeCount + 1;
    const el = document.createElement('div');
    el.id = 'ring';
    el.className = `ring-screen ${c.habit ? 'strict' : ''}`;
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-label', 'Alarm');
    const now = new Date();
    el.innerHTML = `<div class="rs-pulses"><i></i><i></i><i></i></div>
      <div class="rs-card glass">
        <p class="eyebrow ${c.habit ? 'danger' : ''}">${c.habit ? 'Quest reminder' : c.kind === 'test' ? 'Test' : 'Alarm'}</p>
        <div class="rs-clock">${A.time12(`${A.p2(now.getHours())}:${A.p2(now.getMinutes())}`)}</div>
        <div class="rs-icon">${esc(em)}</div>
        <h2>${esc(label)}</h2>
        <p class="muted rs-taunt">${c.habit ? A.pick(TAUNTS) : 'Rise and shine.'}</p>
        <p class="rs-mute" hidden>🔇 Sound is blocked by the browser. Tap anywhere to enable it.</p>
        <div class="rs-actions">
          ${c.habit ? `<button class="btn primary lg block" data-act="ringDone" data-quiet>${icon('check', 18)} I did it</button>` : `<button class="btn primary lg block" data-act="ringDismiss" data-quiet>Dismiss</button>`}
          ${c.kind !== 'test' && c.snoozeCount < maxSnooze ? `<button class="btn soft block" data-act="ringSnooze" data-quiet>Snooze ${A.S.settings.snoozeMin} min · −${cost} 🪙</button>` : ''}
          ${strict ? `<button class="btn ghost danger-t block" data-act="ringIgnore" data-quiet>I’m skipping it · −${ignoreLoss} HP</button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    A.alarmStart(toneKey);
    A.fx.vibrate([300, 150, 300, 150, 300]);
    notify(c);

    if (!A.audioReady()) {
      el.querySelector('.rs-mute').hidden = false;
      const off = A.bus.on('audio-ready', () => {
        off();
        const m = el.querySelector('.rs-mute');
        if (m) m.hidden = true;
      });
    }

    let on = false;
    clearInterval(titleTimer);
    titleTimer = setInterval(() => {
      on = !on;
      document.title = on ? `⏰ ${label} · ${baseTitle()}` : baseTitle();
    }, 900);

    clearTimeout(escTimer);
    escTimer = setTimeout(() => {
      if (!current) return;
      A.alarmStart('klaxon');
      const t = el.querySelector('.rs-taunt');
      if (t) t.textContent = 'Still ignoring me? Ignored quests cost you.';
      el.classList.add('angry');
    }, 90 * 1000);

    clearTimeout(giveUpTimer);
    giveUpTimer = setTimeout(() => {
      if (!current) return;
      if (c.habit) {
        G.ignoreAlarm(c.habit);
        A.ui.toast(`<b>You ignored the alarm</b><small>${esc(c.habit.name)} · −${ignoreLoss} HP</small>`, { icon: '💢', kind: 'warn' });
      }
      stop();
    }, 10 * 60 * 1000);
  }

  function stop() {
    A.alarmStop();
    clearInterval(titleTimer);
    clearTimeout(escTimer);
    clearTimeout(giveUpTimer);
    document.title = baseTitle();
    const el = document.getElementById('ring');
    if (el) {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 300);
    }
    current = null;
    if (waiting.length) setTimeout(() => !current && trigger(waiting.shift()), 600);
  }

  A.actions.ringDismiss = () => stop();
  A.actions.ringDone = () => {
    const c = current;
    stop();
    if (c && c.habit && !G.isDone(c.habit, A.today())) G.toggle(c.habit.id);
  };
  A.actions.ringSnooze = () => {
    const c = current;
    if (!c) return;
    const cost = c.snoozeCount + 1;
    const P = A.S.player;
    P.coins = Math.max(0, P.coins - cost);
    A.S.stats.snoozes = (A.S.stats.snoozes || 0) + 1;
    snoozes().push({
      at: Date.now() + A.S.settings.snoozeMin * 60000,
      ref: { kind: c.kind, alarmId: c.alarm ? c.alarm.id : '', habitId: c.habit ? c.habit.id : '', key: c.key + ':s' + (c.snoozeCount + 1), snoozeCount: c.snoozeCount + 1 },
    });
    A.sfx('error');
    A.ui.toast(`Snoozed ${A.S.settings.snoozeMin} min <small>−${cost} coin${cost > 1 ? 's' : ''}</small>`, { icon: '😴' });
    stop();
    A.save();
  };
  A.actions.ringIgnore = () => {
    const c = current;
    stop();
    if (c && c.habit) G.ignoreAlarm(c.habit);
  };

  A.alarmEngine = {
    start() {
      setInterval(check, 1000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      check();
    },
    test() {
      if (current) return;
      ring({ kind: 'test', alarm: { tone: 'sunrise', label: 'Test alarm' }, habit: null, key: 'test', snoozeCount: 0 });
    },
  };

  /* A gentle prompt so sound is armed before a real alarm needs it */
  A.armPrompt = () => {
    const needs = A.S.alarms.some((a) => a.enabled) || A.S.habits.some((h) => !h.archived && h.reminder);
    if (!needs || A.audioReady()) return;
    const pill = document.createElement('button');
    pill.className = 'arm-pill glass';
    pill.innerHTML = `${icon('bell', 16)} Tap anywhere to arm alarm sound`;
    document.body.appendChild(pill);
    const off = A.bus.on('audio-ready', () => {
      pill.remove();
      off();
    });
  };
})();
