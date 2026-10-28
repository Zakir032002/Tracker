/* Ascend side panel: content script. Runs on the Ascend page, copies its snapshot into
   chrome.storage.local for the side panel, and hands queued commands from the panel to the page. */
(function () {
  'use strict';
  if (!document.documentElement.hasAttribute('data-ascend-app') && !document.querySelector('meta[name="ascend-app"]')) {
    // the app sets this attribute a moment after load; wait for it, give up after ~10s
    let tries = 0;
    const t = setInterval(() => {
      if (document.documentElement.hasAttribute('data-ascend-app')) {
        clearInterval(t);
        start();
      } else if (++tries > 40) clearInterval(t);
    }, 250);
    return;
  }
  start();

  function start() {
    // content scripts live in an isolated world, so the attribute check above works across worlds (DOM is shared)
    const uid = Math.random().toString(36).slice(2);
    const alive = () => chrome.runtime && chrome.runtime.id;
    let busy = false;

    const claim = () => {
      if (!alive()) return;
      chrome.storage.local.set({ owner: { uid, ts: Date.now() } });
    };
    claim();
    window.addEventListener('focus', claim);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && claim());
    setInterval(claim, 10000);

    const toPage = (cmd) => window.postMessage({ src: 'ascend-ext', type: 'cmd', cmd }, location.origin);

    async function flush() {
      if (!alive() || busy) return;
      busy = true;
      try {
        const { owner, cmds } = await chrome.storage.local.get(['owner', 'cmds']);
        if (!cmds || !cmds.length) return;
        // only the most recently active Ascend tab applies queued commands
        if (owner && owner.uid !== uid && Date.now() - owner.ts < 25000) return;
        await chrome.storage.local.set({ cmds: [] });
        cmds.forEach((c) => toPage(c.cmd || c));
      } finally {
        busy = false;
      }
    }

    window.addEventListener('message', (e) => {
      if (e.source !== window || !e.data || e.data.src !== 'ascend-app' || e.data.type !== 'snapshot' || !alive()) return;
      chrome.storage.local.get('owner').then(({ owner }) => {
        if (owner && owner.uid !== uid && Date.now() - owner.ts < 25000 && document.visibilityState !== 'visible') return;
        chrome.storage.local.set({ snap: e.data.data, snapAt: Date.now() });
      });
    });

    chrome.storage.onChanged.addListener((c, area) => {
      if (area === 'local' && c.cmds && c.cmds.newValue && c.cmds.newValue.length) flush();
    });

    window.postMessage({ src: 'ascend-ext', type: 'hello' }, location.origin);
    flush();
  }
})();
