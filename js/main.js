/* Ascend — boot */
(function () {
  'use strict';
  const A = window.A;

  A.applyTheme();
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => A.S.settings.theme === 'auto' && (A.applyTheme(), A.rerender()));

  if (!location.hash) history.replaceState(null, '', '#today');

  let lastDay = A.today();
  function dayWatch() {
    const now = A.today();
    if (now === lastDay) return;
    lastDay = now;
    A.G.rollover(); // new day: settle yesterday, apply penalties
    A.G.checkAch();
    A.save();
    A.navigate();
  }

  function boot() {
    if (A.S.onboarded) {
      A.G.rollover();
      A.G.checkAch();
      A.save(true);
    }
    A.navigate();
    A.alarmEngine.start();
    if (!A.S.onboarded) A.ui.onboarding();
    else A.armPrompt();

    setInterval(dayWatch, 15000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && dayWatch());
    setInterval(A.focusTick, 500);

    // keyboard: 1-7 jump between screens (when not typing)
    const order = ['today', 'quests', 'insights', 'notes', 'alarms', 'focus', 'vault'];
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t.matches && t.matches('input, textarea, select, [contenteditable]')) return;
      if (document.querySelector('.modal-wrap, #ring')) return;
      const i = '1234567'.indexOf(e.key);
      if (i >= 0) A.go(order[i]);
      if (e.key === 'n' && A.view !== 'notes') A.openQuestEditor();
    });
  }

  A.bus.on('save-error', () => A.ui.toast('Could not save. Storage may be full: export a backup in Settings.', { icon: '⚠️', kind: 'warn', ms: 8000 }));

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    A.installPrompt = e;
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  boot();
})();
