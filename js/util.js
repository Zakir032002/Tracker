/* Ascend — utilities: DOM, dates, icons */
(function () {
  'use strict';
  const A = (window.A = window.A || {});

  A.$ = (s, r = document) => r.querySelector(s);
  A.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  A.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  A.clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  A.rand = (a, b) => a + Math.random() * (b - a);
  A.randInt = (a, b) => Math.floor(A.rand(a, b + 1));
  A.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  A.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  /* ---------- dates (all local-time 'YYYY-MM-DD' strings) ---------- */
  const p2 = (n) => String(n).padStart(2, '0');
  A.p2 = p2;
  A.fmt = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  A.parse = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  A.today = () => A.fmt(new Date());
  A.addDays = (s, n) => {
    const d = A.parse(s);
    d.setDate(d.getDate() + n);
    return A.fmt(d);
  };
  A.diffDays = (a, b) => Math.round((A.parse(b) - A.parse(a)) / 864e5);
  A.dow = (s) => A.parse(s).getDay();
  A.nowHM = () => {
    const d = new Date();
    return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };
  A.hmToMin = (hm) => {
    const [h, m] = hm.split(':').map(Number);
    return h * 60 + m;
  };
  A.nowMin = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  A.time12 = (hm) => {
    if (!hm) return '';
    const [h, m] = hm.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${p2(m)} ${h < 12 ? 'AM' : 'PM'}`;
  };
  A.DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  A.DAYS1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  A.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  A.prettyDate = (s, opts = { weekday: 'long', month: 'long', day: 'numeric' }) =>
    A.parse(s).toLocaleDateString(undefined, opts);
  A.greeting = () => {
    const h = new Date().getHours();
    return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Late night';
  };
  A.weekStart = (s, startDow) => {
    const d = A.parse(s);
    const diff = (d.getDay() - startDow + 7) % 7;
    d.setDate(d.getDate() - diff);
    return A.fmt(d);
  };
  A.fmtNum = (n) => Math.round(n).toLocaleString();
  A.fmtDur = (sec) => `${p2(Math.floor(sec / 60))}:${p2(Math.floor(sec % 60))}`;
  A.ago = (ts) => {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  /* ---------- icons (24px stroke set) ---------- */
  const P = {
    today: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16.2 9"/>',
    quests: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.2L17 12H5"/>',
    insights: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3.2 3L19 7"/>',
    notes: '<path d="M15.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>',
    alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M4.5 3.5 2 6M19.5 3.5 22 6"/>',
    focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4M9.5 2h5"/>',
    vault: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5a1.5 1.5 0 0 0 0 3H7M17 6h2.5a1.5 1.5 0 0 1 0 3H17M12 14v4M8 21h8M10 18h4"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    flame:
      '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.8 9.4c-.4-.9-1.4-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2 0 1.3 1.2 1.7 2.8 2s2.8.7 2.8 2c0 1.2-1.2 2-2.8 2-1.4 0-2.4-.5-2.8-1.4"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7Z"/>',
    sound: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.8 5.2a10 10 0 0 1 0 13.6"/>',
    mute: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    play: '<path d="M7 4.5v15l12-7.5Z"/>',
    pause: '<path d="M8 4.5v15M16 4.5v15"/>',
    pin: '<path d="M12 17v5M8.5 3h7l-1 6.5L18 13H6l3.5-3.5Z"/>',
    snow: '<path d="M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    upload: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z"/>',
    gift: '<path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6Z"/>',
    skull: '<path d="M12 3a8 8 0 0 0-8 8c0 2.4 1 4.2 3 5.4V20h10v-3.6c2-1.2 3-3 3-5.4a8 8 0 0 0-8-8Z"/><circle cx="9" cy="11.5" r="1.4"/><circle cx="15" cy="11.5" r="1.4"/><path d="M10 20v-2M14 20v-2"/>',
    sword: '<path d="m14.5 17.5 5 4M3 3l9 9 4-1 5-5 0-3-3 0-5 5M9.5 14.5 6 18l-2-2 3.5-3.5"/>',
    repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5a1.5 1.5 0 0 0 0 3H7M17 6h2.5a1.5 1.5 0 0 1 0 3H17M12 14v4M8 21h8M10 18h4"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    zap: '<path d="m13 2-9 12h7l-1 8 9-12h-7Z"/>',
    waves: '<path d="M2 7c2.2-2.4 4.3-2.4 6.5 0s4.3 2.4 6.5 0 4.3-2.4 7 0M2 13c2.2-2.4 4.3-2.4 6.5 0s4.3 2.4 6.5 0 4.3-2.4 7 0M2 19c2.2-2.4 4.3-2.4 6.5 0s4.3 2.4 6.5 0 4.3-2.4 7 0"/>',
    menu: '<path d="M4 8h16M4 16h16"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><path d="M4 15h3v5H5.5A1.5 1.5 0 0 1 4 18.5ZM20 15h-3v5h1.5a1.5 1.5 0 0 0 1.5-1.5Z"/>',
    rain: '<path d="M7 15a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 17 6.5 4.5 4.5 0 0 1 17.5 15M9 18v3M13 18v3M17 18v3"/>',
    bolt2: '<path d="m13 3-7 10h5l-1 8 7-10h-5Z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  };
  A.icon = (name, size = 20, extra = '') =>
    `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
})();
