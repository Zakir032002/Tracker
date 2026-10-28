/* Ascend: boot */
(function () {
  'use strict';
  const A = window.A;
  const M = A.motion;

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
    A.navigate(true);
  }

  async function boot() {
    A.initChrome();
    M.initScroll();
    M.initCursor();
    M.initInteractions();
    if (A.S.onboarded) {
      A.G.rollover();
      A.G.checkAch();
      A.save(true);
    }
    A.sync3D();

    const seen = sessionStorage.getItem('ascend:seen');
    sessionStorage.setItem('ascend:seen', '1');
    if (window.A3D && window.A3D.ready) setTimeout(() => window.A3D.intro(), seen ? 200 : 900);
    await M.intro(!!seen);

    A.navigate(true);
    if (!A.S.onboarded) A.ui.onboarding();
    else A.armPrompt();
    A.alarmEngine.start();

    setInterval(dayWatch, 15000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && dayWatch());
    setInterval(A.focusTick, 500);

    // keyboard: 1-8 jump between screens (when not typing)
    const order = ['today', 'quests', 'insights', 'notes', 'alarms', 'focus', 'sanctuary', 'vault'];
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t.matches && t.matches('input, textarea, select, [contenteditable]')) return;
      if (document.querySelector('.modal-wrap, #ring')) return;
      const i = '12345678'.indexOf(e.key);
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
