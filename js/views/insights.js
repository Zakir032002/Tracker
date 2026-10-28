/* Ascend — Insights: yearly contribution grid, month-wise grids, charts */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon, G } = { esc: A.esc, icon: A.icon, G: A.G };

  let yearSel = 'rolling';
  let monthSel = null; // 'YYYY-MM-01'
  let selDate = null;

  const ymFirst = (d) => d.slice(0, 7) + '-01';
  const shiftMonth = (first, n) => {
    const d = A.parse(first);
    d.setMonth(d.getMonth() + n, 1);
    return A.fmt(d);
  };

  function lvl(info) {
    if (!info) return 'none';
    if (info.status === 'frozen') return 'ice';
    if (!info.total) return 'rest';
    if (!info.done) return info.closed ? 'miss' : 'l0';
    const r = info.ratio;
    return r >= 1 ? 'l4' : r >= 0.67 ? 'l3' : r >= 0.34 ? 'l2' : 'l1';
  }
  const tipText = (d, info) => {
    const when = A.prettyDate(d, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    if (!info) return when;
    if (info.status === 'frozen') return `${when} · saved by a Streak Freeze`;
    if (!info.total) return `${when} · rest day`;
    return `${when} · ${info.done}/${info.total} quests (${Math.round(info.ratio * 100)}%)`;
  };

  /* compact GitHub-style grid reused on Today and the profile (Vault) */
  A.miniHeat = (weeks = 16, cell = 12) => {
    const today = A.today();
    const gridStart = A.addDays(A.weekStart(today, A.S.settings.weekStart), -(weeks - 1) * 7);
    const created = A.fmt(new Date(A.S.createdAt));
    let cells = '';
    for (let c = 0; c < weeks; c++) {
      for (let r = 0; r < 7; r++) {
        const d = A.addDays(gridStart, c * 7 + r);
        if (d > today) {
          cells += '<i class="cell void"></i>';
          continue;
        }
        const info = d < created && !A.S.days[d] ? null : G.dayInfo(d);
        cells += `<i class="cell ${lvl(info)} ${d === today ? 'today' : ''}" data-tip="${esc(tipText(d, info))}"></i>`;
      }
    }
    return `<div class="heat mini" style="--cell:${cell}px;--gap:3px"><div class="heat-grid" style="--cols:${weeks}">${cells}</div></div>`;
  };

  /* ---------- summary tiles ---------- */
  function tiles() {
    const sk = G.streak();
    const days = Object.keys(A.S.days);
    let active = 0;
    let rSum = 0;
    let rN = 0;
    const today = A.today();
    days.forEach((d) => {
      const i = A.S.days[d];
      if (i.done > 0) active++;
      if (i.total && A.diffDays(d, today) <= 30) {
        rSum += i.ratio;
        rN++;
      }
    });
    const t = G.dayInfo(today);
    if (t && t.done > 0) active++;
    const rate = rN ? Math.round((rSum / rN) * 100) : 0;
    const T = [
      ['flame', sk.current, 'Current streak', 'days', 'fire'],
      ['trophy', sk.longest, 'Longest streak', 'days', 'gold'],
      ['calendar', active, 'Active days', 'total', ''],
      ['check', A.S.stats.done, 'Quests completed', 'all time', ''],
      ['spark', A.S.stats.perfectDays, 'Perfect days', 'all time', 'gold'],
      ['target', rate + '%', '30-day average', 'completion', ''],
    ];
    return `<div class="tiles">${T.map(([ic, v, l, s, c]) => `<div class="tile glass ${c}">${icon(ic, 18)}<b>${v}</b><span>${l}</span><small>${s}</small></div>`).join('')}</div>`;
  }

  /* ---------- GitHub-style year grid ---------- */
  function yearGrid() {
    const today = A.today();
    const created = A.fmt(new Date(A.S.createdAt));
    let start;
    let end;
    if (yearSel === 'rolling') {
      end = today;
      start = A.addDays(end, -364);
    } else {
      start = `${yearSel}-01-01`;
      end = `${yearSel}-12-31`;
    }
    const gridStart = A.weekStart(start, A.S.settings.weekStart);
    const cols = Math.ceil((A.diffDays(gridStart, end) + 1) / 7);
    let cells = '';
    let labels = '';
    let lastLabel = -9;
    let activeCount = 0;
    for (let c = 0; c < cols; c++) {
      let label = null;
      for (let r = 0; r < 7; r++) {
        const d = A.addDays(gridStart, c * 7 + r);
        const inRange = d >= start && d <= end;
        if (inRange && A.parse(d).getDate() === 1) label = A.MONTHS[A.parse(d).getMonth()].slice(0, 3);
        if (!inRange) {
          cells += '<i class="cell void"></i>';
          continue;
        }
        const info = d > today ? null : d < created && !A.S.days[d] ? null : G.dayInfo(d);
        const l = lvl(info);
        if (info && info.done) activeCount++;
        cells += `<i class="cell ${l} ${d === today ? 'today' : ''} ${d === selDate ? 'sel' : ''}" data-act="selectDay" data-d="${d}" data-tip="${esc(tipText(d, info))}" data-quiet></i>`;
      }
      if (c === 0 && !label) label = A.MONTHS[A.parse(start).getMonth()].slice(0, 3);
      if (label && c - lastLabel >= 3) {
        labels += `<span style="grid-column:${c + 1}">${label}</span>`;
        lastLabel = c;
      }
    }
    const ws = A.S.settings.weekStart;
    const dl = [0, 1, 2, 3, 4, 5, 6].map((r) => ((ws + r) % 7 === 1 || (ws + r) % 7 === 3 || (ws + r) % 7 === 5 ? A.DAYS[(ws + r) % 7].slice(0, 3) : '')).map((t) => `<span>${t}</span>`).join('');
    const firstYear = new Date(A.S.createdAt).getFullYear();
    const thisYear = new Date().getFullYear();
    const years = [];
    for (let y = thisYear; y >= firstYear; y--) years.push(y);
    return `<section class="card glass year-card">
      <div class="card-head wrap"><div><h3>${activeCount} active day${activeCount === 1 ? '' : 's'} ${yearSel === 'rolling' ? 'in the past year' : 'in ' + yearSel}</h3><p class="muted small">Brighter squares mean more quests done that day.</p></div>
        <div class="seg compact" role="tablist"><button class="seg-btn ${yearSel === 'rolling' ? 'on' : ''}" data-act="insYear" data-y="rolling" data-quiet>Past year</button>
        ${years.map((y) => `<button class="seg-btn ${yearSel === y ? 'on' : ''}" data-act="insYear" data-y="${y}" data-quiet>${y}</button>`).join('')}</div></div>
      <div class="heat-scroll" id="heat-scroll"><div class="heat">
        <div class="heat-days">${dl}</div>
        <div class="heat-main"><div class="heat-months" style="--cols:${cols}">${labels}</div>
        <div class="heat-grid" style="--cols:${cols}">${cells}</div></div>
      </div></div>
      <div class="legend"><span>Less</span><i class="cell l0"></i><i class="cell l1"></i><i class="cell l2"></i><i class="cell l3"></i><i class="cell l4"></i><span>More</span>
        <i class="cell ice"></i><span>Freeze</span><i class="cell miss"></i><span>Missed</span></div>
    </section>`;
  }

  /* ---------- month calendar ---------- */
  function monthCal() {
    const today = A.today();
    if (!monthSel) monthSel = ymFirst(today);
    const first = A.parse(monthSel);
    const ws = A.S.settings.weekStart;
    const lead = (first.getDay() - ws + 7) % 7;
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<i class="mcell blank"></i>';
    let kept = 0;
    let tracked = 0;
    for (let n = 1; n <= dim; n++) {
      const d = A.fmt(new Date(first.getFullYear(), first.getMonth(), n));
      const info = G.dayInfo(d);
      const l = lvl(info);
      if (info && info.total && d <= today) {
        tracked++;
        if (info.status === 'kept' || info.status === 'frozen') kept++;
      }
      let mark = '';
      if (info) {
        if (info.status === 'frozen') mark = icon('snow', 12);
        else if (info.total && info.ratio === 1) mark = icon('check', 12);
        else if (info.status === 'broken') mark = icon('x', 12);
      }
      const dd = A.diary.hasEntry(d);
      const pp = A.diary.hasPlan(d);
      cells += `<button class="mcell ${l} ${d === today ? 'today' : ''} ${d === selDate ? 'sel' : ''} ${dd ? 'has-diary' : ''} ${pp ? 'has-plan' : ''}" data-act="selectDay" data-d="${d}" data-quiet data-tip="${esc(tipText(d, info) + (dd ? ' · diary entry' : '') + (pp ? ' · ' + A.diary.plansOn(d).length + ' plan(s)' : ''))}"><b>${n}</b>${mark}${dd || pp ? `<u>${dd ? '<i class="mk-d"></i>' : ''}${pp ? '<i class="mk-p"></i>' : ''}</u>` : ''}</button>`;
    }
    const head = [0, 1, 2, 3, 4, 5, 6].map((i) => `<span>${A.DAYS[(ws + i) % 7].slice(0, 2)}</span>`).join('');
    const atCurrent = monthSel === ymFirst(today);
    const atMax = monthSel >= ymFirst(A.addDays(today, 366));
    return `<section class="card glass month-card">
      <div class="card-head"><div><h3>${A.MONTHS[first.getMonth()]} ${first.getFullYear()}</h3><p class="muted small">${tracked ? `${kept} of ${tracked} days kept` : 'No tracked days yet'}</p></div>
        <div class="row gap"><button class="icon-btn" data-act="monthShift" data-n="-1" data-quiet aria-label="Previous month">${icon('left', 18)}</button>
        <button class="btn soft sm" data-act="monthShift" data-n="0" data-quiet ${atCurrent ? 'disabled' : ''}>Today</button>
        <button class="icon-btn" data-act="monthShift" data-n="1" data-quiet aria-label="Next month" ${atMax ? 'disabled' : ''}>${icon('right', 18)}</button></div></div>
      <div class="mcal"><div class="mcal-head">${head}</div><div class="mcal-grid">${cells}</div></div>
      <p class="dcal-key muted small"><i class="k-has"></i> diary entry <i class="k-plan"></i> plans &amp; reminders</p>
      ${dayDetail()}
    </section>`;
  }

  function dayDetail() {
    if (!selDate) return `<p class="muted small center sm-top">Tap any day to see what happened, read your diary, or leave a plan.</p>`;
    const info = G.dayInfo(selDate);
    const today = A.today();
    let rows = '';
    let pen = '';
    if (info) {
      let ids;
      if (info.closed) {
        ids = new Set(Object.entries(A.S.logs[selDate] || {}).filter(([, e]) => e.done).map(([id]) => id));
        (info.missed || []).forEach((id) => ids.add(id));
      } else ids = new Set(G.scheduledOn(selDate).map((h) => h.id));
      rows = [...ids]
        .map((id) => {
          const h = A.S.habits.find((x) => x.id === id);
          if (!h) return '';
          const done = G.isDone(h, selDate);
          return `<li class="${done ? 'ok' : selDate === today ? 'pend' : 'bad'}"><span class="mi">${esc(h.icon)}</span><span class="grow">${esc(h.name)}</span><i>${done ? icon('check', 14) : selDate === today ? 'pending' : icon('x', 14)}</i></li>`;
        })
        .join('');
      pen = info.hpLost ? `<span class="chip late">−${info.hpLost} HP · −${info.xpLost} XP</span>` : '';
    }
    const e = A.diary.entry(selDate);
    const mood = e && e.mood ? A.diary.mood(e.mood) : null;
    const diary = A.diary.hasEntry(selDate)
      ? `<button class="dd-diary" data-act="diaryOpen" data-d="${selDate}" data-quiet><span class="dd-dh"><b>${icon('diary', 14)} Diary</b>${mood ? `<em>${mood.e} ${mood.name}</em>` : ''}</span>${e.title ? `<strong>${esc(e.title)}</strong>` : ''}<span class="dd-dt">${esc(e.text.trim().slice(0, 220))}${e.text.length > 220 ? '…' : ''}</span><small>${e.words} words · open entry</small></button>`
      : selDate <= today
      ? `<button class="dd-diary empty" data-act="diaryOpen" data-d="${selDate}" data-quiet><span class="dd-dh"><b>${icon('diary', 14)} Diary</b></span><span class="dd-dt">No entry for this day. ${selDate === today ? 'Write about today' : 'Add one'}.</span></button>`
      : '';
    return `<div class="day-detail"><div class="dd-head"><h4>${A.prettyDate(selDate, { weekday: 'long', month: 'long', day: 'numeric' })}</h4>${pen}</div>
      ${info ? (rows ? `<ul class="mini-list">${rows}</ul>` : '<p class="muted small">Nothing was scheduled.</p>') : ''}
      ${diary}
      <div class="dd-plans"><h5>Plans &amp; reminders</h5>${A.diary.planRows(A.diary.plansOn(selDate))}${A.diary.planForm(selDate, selDate < today ? 'Add a note for this day…' : 'I should do…')}</div></div>`;
  }

  /* ---------- month-by-month overview ---------- */
  function monthsOverview() {
    const today = A.today();
    const cur = ymFirst(today);
    const ws = A.S.settings.weekStart;
    let out = '';
    for (let i = 11; i >= 0; i--) {
      const first = shiftMonth(cur, -i);
      const fd = A.parse(first);
      const lead = (fd.getDay() - ws + 7) % 7;
      const dim = new Date(fd.getFullYear(), fd.getMonth() + 1, 0).getDate();
      let cells = '';
      let kept = 0;
      for (let k = 0; k < lead; k++) cells += '<i class="cell void"></i>';
      for (let n = 1; n <= dim; n++) {
        const d = A.fmt(new Date(fd.getFullYear(), fd.getMonth(), n));
        const info = d > today ? null : G.dayInfo(d);
        if (info && (info.status === 'kept' || info.status === 'frozen')) kept++;
        cells += `<i class="cell ${lvl(info)}" data-tip="${esc(tipText(d, info))}"></i>`;
      }
      out += `<button class="mini-month ${first === monthSel ? 'sel' : ''}" data-act="pickMonth" data-m="${first}" data-quiet>
        <div class="mm-head"><b>${A.MONTHS[fd.getMonth()].slice(0, 3)}</b><small>${fd.getFullYear() !== new Date().getFullYear() ? fd.getFullYear() + ' · ' : ''}${kept}d</small></div><div class="mm-grid">${cells}</div></button>`;
    }
    return `<section class="card glass"><div class="card-head"><div><h3>Month by month</h3><p class="muted small">Your last 12 months at a glance. Tap one to open it.</p></div></div><div class="mm-wrap">${out}</div></section>`;
  }

  /* ---------- charts ---------- */
  function bars(vals, labels, { max = 1, h = 150, fmt = (v) => Math.round(v * 100) + '%' } = {}) {
    const W = 560;
    const n = vals.length;
    const bw = W / n;
    const pad = 22;
    const ch = h - pad - 6;
    const rects = vals
      .map((v, i) => {
        const bh = Math.max(3, (v / max) * ch);
        const x = i * bw + bw * 0.18;
        const w = bw * 0.64;
        return `<rect class="bar" x="${x.toFixed(1)}" y="${(h - pad - bh).toFixed(1)}" width="${w.toFixed(1)}" height="${bh.toFixed(1)}" rx="6" data-tip="${esc(labels[i])} · ${fmt(v)}"/>
          <text x="${(x + w / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(labels[i].slice(0, 6))}</text>`;
      })
      .join('');
    return `<svg viewBox="0 0 ${W} ${h}" class="chart" role="img" preserveAspectRatio="none"><defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:hsl(calc(var(--h) + 30) 95% 68%)"/><stop offset="1" style="stop-color:hsl(var(--h) 85% 55%)"/></linearGradient></defs>
      <line x1="0" x2="${W}" y1="${h - pad - ch}" y2="${h - pad - ch}" class="grid"/><line x1="0" x2="${W}" y1="${h - pad - ch / 2}" y2="${h - pad - ch / 2}" class="grid"/><line x1="0" x2="${W}" y1="${h - pad}" y2="${h - pad}" class="grid"/>${rects}</svg>`;
  }
  function weeklyChart() {
    const today = A.today();
    const ws = A.weekStart(today, A.S.settings.weekStart);
    const vals = [];
    const labels = [];
    for (let w = 11; w >= 0; w--) {
      const s = A.addDays(ws, -7 * w);
      let t = 0;
      let d = 0;
      for (let i = 0; i < 7; i++) {
        const info = G.dayInfo(A.addDays(s, i));
        if (info && info.total) {
          t += info.total;
          d += info.done;
        }
      }
      vals.push(t ? d / t : 0);
      labels.push(A.prettyDate(s, { month: 'short', day: 'numeric' }));
    }
    return `<section class="card glass"><div class="card-head"><div><h3>Weekly completion</h3><p class="muted small">Last 12 weeks</p></div></div>${bars(vals, labels)}</section>`;
  }
  function weekdayChart() {
    const today = A.today();
    const t = Array(7).fill(0);
    const d = Array(7).fill(0);
    for (let i = 0; i < 120; i++) {
      const date = A.addDays(today, -i);
      const info = G.dayInfo(date);
      if (!info || !info.total) continue;
      if (i === 0 && info.status === 'open') continue;
      t[A.dow(date)] += info.total;
      d[A.dow(date)] += info.done;
    }
    const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (A.S.settings.weekStart + i) % 7);
    const vals = order.map((k) => (t[k] ? d[k] / t[k] : 0));
    const best = order[vals.indexOf(Math.max(...vals))];
    return `<section class="card glass"><div class="card-head"><div><h3>Best weekdays</h3><p class="muted small">${Math.max(...vals) > 0 ? `You shine on <b>${A.DAYS[best]}</b>s.` : 'Complete some quests to see your pattern.'}</p></div></div>${bars(vals, order.map((k) => A.DAYS[k]))}</section>`;
  }
  function questBoard() {
    const list = G.activeHabits();
    if (!list.length) return '';
    const rows = list
      .map((h) => ({ h, r: G.habitRate(h, 30), s: G.habitStreak(h) }))
      .sort((a, b) => (b.r ?? -1) - (a.r ?? -1))
      .map(
        ({ h, r, s }) => `<li style="--c:${h.hue}"><span class="mi">${esc(h.icon)}</span><div class="grow"><div class="lb-top"><b>${esc(h.name)}</b><small>${s ? icon('flame', 12) + ' ' + s : ''}</small></div>
        <div class="lb-bar"><i style="width:${Math.round((r || 0) * 100)}%"></i></div></div><em>${r === null ? '–' : Math.round(r * 100) + '%'}</em></li>`
      )
      .join('');
    return `<section class="card glass"><div class="card-head"><div><h3>Quest leaderboard</h3><p class="muted small">30-day completion rate</p></div></div><ul class="lb">${rows}</ul></section>`;
  }

  /* ---------- 3D skyline data (same range as the flat grid) ---------- */
  let skyDates = [];
  let skyKey = '';
  function pushSkyline(force) {
    if (!window.A3D || !window.A3D.ready) return;
    const key = `${yearSel}|${innerWidth < 700}|${A.today()}|${A.S.settings.accent}|${A.resolvedTheme()}|${A.S.stats.done}`;
    if (!force && key === skyKey) return;
    skyKey = key;
    const today = A.today();
    const created = A.fmt(new Date(A.S.createdAt));
    let start;
    let end;
    if (yearSel === 'rolling') {
      end = today;
      start = A.addDays(end, innerWidth < 700 ? -181 : -364);
    } else {
      start = `${yearSel}-01-01`;
      end = `${yearSel}-12-31`;
    }
    const gridStart = A.weekStart(start, A.S.settings.weekStart);
    const cols = Math.min(53, Math.ceil((A.diffDays(gridStart, end) + 1) / 7));
    const days = [];
    skyDates = [];
    for (let i = 0; i < cols * 7; i++) {
      const d = A.addDays(gridStart, i);
      const ok = d >= start && d <= end && d <= today;
      const info = ok && !(d < created && !A.S.days[d]) ? G.dayInfo(d) : null;
      days.push(info);
      skyDates.push(ok ? d : null);
    }
    window.A3D.skyline(days, cols, A.S.settings.accent, A.resolvedTheme() === 'light');
  }

  let lastPtr = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => (lastPtr = { x: e.clientX, y: e.clientY }), { passive: true });
  function onSkyHover(h) {
    const tip = document.getElementById('sky-tip');
    if (!tip) return;
    const slot = document.querySelector('[data-skyline-slot]');
    const r = slot && slot.getBoundingClientRect();
    if (!h || !skyDates[h.index] || !r || lastPtr.y < r.top || lastPtr.y > r.bottom) {
      tip.classList.remove('on');
      return;
    }
    const d = skyDates[h.index];
    tip.textContent = tipText(d, G.dayInfo(d));
    tip.style.left = h.x + 'px';
    tip.style.top = h.y + 'px';
    tip.classList.add('on');
  }

  A.views.insights = {
    title: 'Insights',
    mode: 'skyline',
    render(root) {
      root.innerHTML = `
      <div class="sky-hero" data-skyline-slot>
        <div class="page-head"><p class="eyebrow">Your consistency</p><h1 data-split>Streaks &amp;<br><em>skyline.</em></h1></div>
        <p class="sky-hint">Every tower is a day · taller means more quests done</p>
      </div>
      <div class="sky-tip" id="sky-tip"></div>
      ${tiles()}
      ${yearGrid()}
      <div class="two-col">${monthCal()}${monthsOverview()}</div>
      <div class="two-col">${weeklyChart()}${weekdayChart()}</div>
      ${questBoard()}`;
      const sc = root.querySelector('#heat-scroll');
      if (sc) sc.scrollLeft = sc.scrollWidth;
      pushSkyline();
    },
    mount() {
      if (window.A3D) window.A3D.onHover(onSkyHover);
      pushSkyline(true);
    },
    unmount() {
      if (window.A3D && window.A3D.ready) {
        window.A3D.onHover(null);
        window.A3D.interactive(false);
      }
    },
  };

  A.actions.insYear = (el) => {
    yearSel = el.dataset.y === 'rolling' ? 'rolling' : +el.dataset.y;
    A.rerender();
  };
  A.actions.selectDay = (el) => {
    selDate = el.dataset.d;
    monthSel = ymFirst(selDate);
    A.sfx('click');
    A.rerender();
  };
  A.actions.monthShift = (el) => {
    const n = +el.dataset.n;
    monthSel = n === 0 ? ymFirst(A.today()) : shiftMonth(monthSel || ymFirst(A.today()), n);
    A.rerender();
  };
  A.actions.pickMonth = (el) => {
    monthSel = el.dataset.m;
    A.rerender();
  };

  /* shared glass tooltip for [data-tip] */
  let tip = null;
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t || e.pointerType === 'touch') return;
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tip glass';
      document.body.appendChild(tip);
    }
    tip.textContent = t.dataset.tip;
    const r = t.getBoundingClientRect();
    tip.style.display = 'block';
    const w = tip.offsetWidth;
    tip.style.left = A.clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px';
    tip.style.top = r.top - tip.offsetHeight - 10 + 'px';
  });
  document.addEventListener('pointerout', (e) => {
    if (tip && e.target.closest && e.target.closest('[data-tip]')) tip.style.display = 'none';
  });
})();
