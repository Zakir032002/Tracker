/* Ascend — Diary: a private journal with a mood per day, plans for any date, and "on this day" memories */
(function () {
  'use strict';
  const A = window.A;
  const D = A.diary;
  const { esc, icon } = { esc: A.esc, icon: A.icon };

  let shuffle = 0;
  let query = '';
  let saveT = 0;

  const sel = () => D.sel || (D.sel = A.today());
  const month = () => D.month || (D.month = sel().slice(0, 7) + '-01');
  const longDate = (d) => A.prettyDate(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const snippet = (e, n = 90) => {
    const t = (e.title && e.title.trim()) || e.text.trim().replace(/\s+/g, ' ');
    return t.length > n ? t.slice(0, n).trimEnd() + '…' : t || 'Untitled';
  };

  /* ---------- paper ---------- */
  function paper() {
    const d = sel();
    const today = A.today();
    const e = D.entry(d) || { title: '', text: '', mood: 0, words: 0 };
    const future = d > today;
    const rel = d === today ? 'Today' : d === A.addDays(today, -1) ? 'Yesterday' : d === A.addDays(today, 1) ? 'Tomorrow' : '';
    return `<section class="card glass paper" id="dy-paper">
      <div class="dy-nav">
        <button class="icon-btn" data-act="diaryShift" data-n="-1" data-quiet aria-label="Previous day">${icon('left', 18)}</button>
        <div class="dy-date"><small>${rel || A.prettyDate(d, { weekday: 'long' })}</small><b>${A.prettyDate(d, { month: 'long', day: 'numeric', year: 'numeric' })}</b></div>
        <button class="icon-btn" data-act="diaryShift" data-n="1" data-quiet aria-label="Next day">${icon('right', 18)}</button>
        ${d !== today ? `<button class="btn soft sm" data-act="diaryToday" data-quiet>Today</button>` : ''}
      </div>
      ${
        future
          ? `<div class="dy-future"><div class="big-emoji">🗓️</div><h3>This page opens on the day</h3><p class="muted">You can't write the diary ahead of time, but you can leave plans and reminders for ${esc(longDate(d))}.</p></div>`
          : `<div class="dy-mood" role="radiogroup" aria-label="How was the day?">
          ${D.MOODS.map((m) => `<button class="mood ${e.mood === m.v ? 'on' : ''}" data-act="diaryMood" data-v="${m.v}" data-quiet role="radio" aria-checked="${e.mood === m.v}" title="${m.name}"><span>${m.e}</span><small>${m.name}</small></button>`).join('')}
        </div>
        <input class="dy-title" id="dy-title" maxlength="90" placeholder="Give the day a title…" value="${esc(e.title)}" aria-label="Title" autocomplete="off">
        <div class="dy-sheet"><textarea class="dy-text" id="dy-text" placeholder="What happened today? How did it feel?" aria-label="Diary entry" spellcheck="true">${esc(e.text)}</textarea></div>
        <div class="dy-foot">
          <button class="dy-prompt" data-act="diaryPrompt" data-quiet title="Tap to start with this prompt. Shift-tap for another."><i>${icon('spark', 14)}</i><span id="dy-prompt-t">${esc(D.prompt(d, shuffle))}</span></button>
          <span class="dy-meta"><span id="dy-words">${e.words || 0} words</span><span id="dy-saved" class="dy-saved">${D.entry(d) ? 'Saved' : ''}</span></span>
        </div>`
      }
      <div class="dy-plans" id="dy-plans">${plansBlock()}</div>
      <div id="dy-mem">${memories()}</div>
    </section>`;
  }

  function plansBlock() {
    const d = sel();
    const list = D.plansOn(d);
    return `<div class="dy-h"><h4>Plans for this day</h4><small class="muted">${list.length ? `${list.filter((p) => p.done).length}/${list.length} done` : 'Things you must not forget'}</small></div>
      ${D.planRows(list, { empty: d >= A.today() ? 'Nothing planned yet.' : 'No plans were set for this day.' })}
      ${D.planForm(d)}`;
  }

  function memories() {
    const m = D.memories(sel());
    if (!m.length) return '';
    return `<div class="dy-h"><h4>On this day</h4></div><div class="dy-mems">${m
      .map((x) => `<button class="mem" data-act="diaryOpen" data-d="${x.date}" data-quiet><small>${x.label} · ${A.prettyDate(x.date, { month: 'short', day: 'numeric', year: 'numeric' })}</small><span>${esc(snippet(x.entry, 110))}</span></button>`)
      .join('')}</div>`;
  }

  /* ---------- side: stats, calendar, entries ---------- */
  function side() {
    const st = D.stats();
    const first = A.parse(month());
    const ws = A.S.settings.weekStart;
    const lead = (first.getDay() - ws + 7) % 7;
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const today = A.today();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<i class="dc blank"></i>';
    for (let n = 1; n <= dim; n++) {
      const d = A.fmt(new Date(first.getFullYear(), first.getMonth(), n));
      const e = D.entry(d);
      cells += `<button class="dc ${D.hasEntry(d) ? 'has' : ''} ${D.hasPlan(d) ? 'plan' : ''} ${d === today ? 'today' : ''} ${d === sel() ? 'sel' : ''}" data-act="diaryDay" data-d="${d}" data-quiet aria-label="${esc(longDate(d))}"><b>${n}</b>${e && e.mood ? `<em>${D.mood(e.mood).e}</em>` : ''}</button>`;
    }
    const head = [0, 1, 2, 3, 4, 5, 6].map((i) => `<span>${A.DAYS[(ws + i) % 7].slice(0, 1)}</span>`).join('');
    return `<div class="dy-stats">
        <div><b>${st.entries}</b><small>entries</small></div><div><b>${A.fmtNum(st.words)}</b><small>words</small></div><div><b>${st.streak}</b><small>day streak</small></div>
      </div>
      <section class="card glass dy-cal">
        <div class="card-head"><h3>${A.MONTHS[first.getMonth()]} ${first.getFullYear()}</h3>
          <div class="row gap"><button class="icon-btn" data-act="diaryMonth" data-n="-1" data-quiet aria-label="Previous month">${icon('left', 16)}</button><button class="icon-btn" data-act="diaryMonth" data-n="1" data-quiet aria-label="Next month">${icon('right', 16)}</button></div></div>
        <div class="dcal"><div class="dcal-head">${head}</div><div class="dcal-grid">${cells}</div></div>
        <p class="dcal-key muted small"><i class="k-has"></i> written <i class="k-plan"></i> has plans</p>
      </section>
      <section class="card glass dy-list">
        <div class="card-head"><h3>Entries</h3></div>
        <label class="dy-search">${icon('search', 15)}<input id="dy-q" type="search" placeholder="Search your diary…" value="${esc(query)}" aria-label="Search entries" autocomplete="off"></label>
        <div id="dy-entries">${entryList()}</div>
      </section>`;
  }

  function entryList() {
    const q = query.trim().toLowerCase();
    const keys = Object.keys(A.S.diary || {})
      .filter(D.hasEntry)
      .filter((k) => {
        if (!q) return true;
        const e = A.S.diary[k];
        return (e.title + ' ' + e.text).toLowerCase().includes(q);
      })
      .sort()
      .reverse()
      .slice(0, 40);
    if (!keys.length) return `<p class="muted small">${q ? 'Nothing matches that.' : 'Your entries will appear here.'}</p>`;
    return `<ul class="dy-entries">${keys
      .map((k) => {
        const e = A.S.diary[k];
        return `<li><button class="${k === sel() ? 'on' : ''}" data-act="diaryDay" data-d="${k}" data-quiet><span class="de-date">${A.prettyDate(k, { month: 'short', day: 'numeric' })}<small>${A.prettyDate(k, { weekday: 'short' })}</small></span><span class="de-body">${esc(snippet(e))}</span><span class="de-mood">${e.mood ? D.mood(e.mood).e : ''}</span></button></li>`;
      })
      .join('')}</ul>`;
  }

  /* ---------- wiring ---------- */
  function autosize(t) {
    t.style.height = 'auto';
    t.style.height = Math.max(300, t.scrollHeight + 4) + 'px';
  }
  function flashSaved() {
    const s = document.getElementById('dy-saved');
    if (s) {
      s.textContent = 'Saved';
      s.classList.add('on');
      clearTimeout(flashSaved.t);
      flashSaved.t = setTimeout(() => s.classList.remove('on'), 1400);
    }
  }
  function wire(root) {
    const title = root.querySelector('#dy-title');
    const text = root.querySelector('#dy-text');
    const q = root.querySelector('#dy-q');
    if (text) {
      autosize(text);
      const commit = () => {
        const d = sel();
        D.save(d, { title: title.value, text: text.value }, true);
        const w = document.getElementById('dy-words');
        if (w) w.textContent = `${D.entry(d) ? D.entry(d).words : 0} words`;
        flashSaved();
        const list = document.getElementById('dy-entries');
        if (list) list.innerHTML = entryList();
      };
      const later = () => {
        const s = document.getElementById('dy-saved');
        if (s) s.textContent = 'Writing…';
        clearTimeout(saveT);
        saveT = setTimeout(commit, 450);
      };
      text.addEventListener('input', () => (autosize(text), later()));
      title.addEventListener('input', later);
      [text, title].forEach((el) => el.addEventListener('blur', () => (clearTimeout(saveT), commit())));
    }
    if (q) q.addEventListener('input', () => ((query = q.value), (document.getElementById('dy-entries').innerHTML = entryList())));
  }

  const setDay = (d) => {
    D.sel = d;
    D.month = d.slice(0, 7) + '-01';
    shuffle = 0;
    paint();
  };
  function paint() {
    const root = document.getElementById('view');
    if (!root || A.view !== 'diary') return;
    const p = root.querySelector('#dy-paper');
    const s = root.querySelector('#dy-side');
    if (p) {
      const tmp = document.createElement('div');
      tmp.innerHTML = paper();
      p.replaceWith(tmp.firstElementChild);
    }
    if (s) s.innerHTML = side();
    wire(root);
  }

  A.views.diary = {
    title: 'Diary',
    mode: 'core',
    render(root) {
      D.sel = D.sel || A.today();
      root.innerHTML = `
      <div class="page-head"><p class="eyebrow">Your private journal</p><h1>Dear <em>diary</em>.</h1></div>
      <div class="diary-grid"><div id="dy-main">${paper()}</div><aside class="dy-side" id="dy-side">${side()}</aside></div>`;
      // keep the paper node id stable for paint(): #dy-main wraps it
      wire(root);
    },
    /* partial refresh: never touch the text being typed */
    update(root) {
      const side$ = root.querySelector('#dy-side');
      if (!side$) return this.render(root);
      const pl = root.querySelector('#dy-plans');
      if (pl) pl.innerHTML = plansBlock();
      const focused = document.activeElement && document.activeElement.id === 'dy-q';
      if (!focused) {
        side$.innerHTML = side();
        wire(root);
      }
    },
    unmount() {
      clearTimeout(saveT);
    },
  };

  A.actions.diaryDay = (el) => {
    A.sfx('click');
    setDay(el.dataset.d);
  };
  A.actions.diaryShift = (el) => {
    A.sfx('click');
    setDay(A.addDays(sel(), +el.dataset.n));
  };
  A.actions.diaryToday = () => setDay(A.today());
  A.actions.diaryMonth = (el) => {
    const d = A.parse(month());
    D.month = A.fmt(new Date(d.getFullYear(), d.getMonth() + +el.dataset.n, 1));
    const s = document.getElementById('dy-side');
    if (s) {
      s.innerHTML = side();
      wire(document.getElementById('view'));
    }
  };
  A.actions.diaryMood = (el) => {
    const d = sel();
    const e = D.entry(d);
    const v = +el.dataset.v;
    D.save(d, { mood: e && e.mood === v ? 0 : v, title: (document.getElementById('dy-title') || {}).value ?? (e ? e.title : ''), text: (document.getElementById('dy-text') || {}).value ?? (e ? e.text : '') }, true);
    document.querySelectorAll('.dy-mood .mood').forEach((b) => {
      const on = +b.dataset.v === (D.entry(d) || {}).mood;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
    });
    A.sfx('pop');
    const s = document.getElementById('dy-side');
    if (s) {
      s.innerHTML = side();
      wire(document.getElementById('view'));
    }
  };
  A.actions.diaryPrompt = (el, ev) => {
    const text = document.getElementById('dy-text');
    const label = document.getElementById('dy-prompt-t');
    if (!text) return;
    if (ev && ev.shiftKey) {
      shuffle++;
      label.textContent = D.prompt(sel(), shuffle);
      return;
    }
    const p = label.textContent;
    text.value = (text.value.trim() ? text.value.replace(/\s+$/, '') + '\n\n' : '') + p + '\n';
    text.focus();
    text.dispatchEvent(new Event('input'));
    shuffle++;
    label.textContent = D.prompt(sel(), shuffle);
  };
})();
