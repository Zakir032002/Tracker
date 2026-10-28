/* Ascend — Vault: shop, custom rewards, trophies, hero sheet */
(function () {
  'use strict';
  const A = window.A;
  const { esc, icon, G } = { esc: A.esc, icon: A.icon, G: A.G };
  let tab = 'shop';

  function hero() {
    const li = G.levelInfo();
    const P = A.S.player;
    const sk = G.streak();
    return `<section class="card glass hero-sheet" style="--rank:${li.rank.hue}">
      <div class="hs-avatar"><span>${esc(A.S.profile.avatar)}</span><em>${li.level}</em></div>
      <div class="grow"><p class="eyebrow">${esc(li.rank.name)}</p><h2>${esc(A.S.profile.name)}</h2>
        <div class="xp-bar"><i style="width:${Math.round(li.pct * 100)}%"></i></div>
        <p class="muted small">${A.fmtNum(li.into)} / ${A.fmtNum(li.need)} XP to level ${li.level + 1}</p></div>
      <div class="hs-stats">
        <div><b>${A.fmtNum(P.totalXpEver)}</b><span>XP earned</span></div>
        <div><b>${P.bossesDefeated}</b><span>bosses slain</span></div>
        <div><b>${P.deaths}</b><span>defeats</span></div>
        <div><b>${Object.keys(A.S.achievements).length}/${G.ACH.length}</b><span>trophies</span></div>
      </div>
      <div class="hs-heat"><div class="hs-heat-head"><span>${icon('flame', 14)} <b>${sk.current}</b> day streak</span><span class="muted">longest ${sk.longest} · past year</span></div>
        <div class="heat-scroll tight">${A.miniHeat(52, 14)}</div></div></section>`;
  }

  function shop() {
    const P = A.S.player;
    const boostLeft = G.boostActive() ? Math.ceil((P.boostUntil - Date.now()) / 3600000) : 0;
    const items = G.SHOP.map((it) => {
      const own = it.id === 'freeze' ? `Owned: ${P.freezes}/5` : it.id === 'boost' && boostLeft ? `Active · ${boostLeft}h left` : '';
      return `<article class="card glass shop-item"><div class="si-ic">${it.icon}</div><div class="grow"><h3>${it.name}</h3><p class="muted small">${it.desc}</p>${own ? `<span class="chip fire">${own}</span>` : ''}</div>
        <button class="btn ${P.coins >= it.cost ? 'primary' : 'soft'}" data-act="buyItem" data-id="${it.id}" data-quiet>${icon('coin', 15)} ${it.cost}</button></article>`;
    }).join('');
    const rewards = A.S.rewards
      .map(
        (r) => `<article class="card glass shop-item reward"><div class="si-ic">${esc(r.icon)}</div><div class="grow"><h3>${esc(r.name)}</h3></div>
        <div class="row gap"><button class="icon-btn sm" data-act="rewardEdit" data-id="${r.id}" aria-label="Edit">${icon('edit', 15)}</button>
        <button class="btn ${P.coins >= r.cost ? 'primary' : 'soft'}" data-act="redeem" data-id="${r.id}" data-quiet>${icon('coin', 15)} ${r.cost}</button></div></article>`
      )
      .join('');
    const hist = A.S.purchases.slice(0, 8);
    return `
      <div class="section-head"><h2>Power-ups</h2><span class="chip gold">${icon('coin', 13)} ${A.fmtNum(P.coins)} coins</span></div>
      <div class="shop-grid">${items}</div>
      <div class="section-head"><h2>Real-life rewards</h2><button class="btn soft sm" data-act="rewardNew">${icon('plus', 16)} Add reward</button></div>
      <p class="muted small sm-bottom">Define treats you genuinely want, then pay for them with coins you earned. Guilt-free.</p>
      <div class="shop-grid">${rewards || '<p class="muted">No rewards yet. Add something you’d love.</p>'}</div>
      ${hist.length ? `<div class="section-head"><h2>History</h2></div><div class="card glass"><ul class="mini-list">${hist.map((p) => `<li><span class="mi">${esc(p.icon)}</span><span class="grow">${esc(p.name)}</span><small>${A.ago(p.t)}</small><b class="neg">−${p.cost}</b></li>`).join('')}</ul></div>` : ''}`;
  }

  function trophies() {
    const have = A.S.achievements;
    const c = G.achCtx();
    const total = G.ACH.length;
    const n = Object.keys(have).length;
    const cards = G.ACH.slice()
      .sort((a, b) => (have[b.id] ? 1 : 0) - (have[a.id] ? 1 : 0))
      .map((a) => {
        const got = have[a.id];
        const p = a.prog ? a.prog(c) : null;
        return `<article class="trophy ${a.rarity} ${got ? 'got' : 'locked'}">
          <div class="tr-ic">${got ? a.icon : icon('lock', 22)}</div>
          <div class="grow"><h4>${esc(a.name)}</h4><p class="muted small">${esc(a.desc)}</p>
          ${p && !got ? `<div class="tr-bar"><i style="width:${Math.round((p[0] / p[1]) * 100)}%"></i></div><small class="muted">${A.fmtNum(p[0])} / ${A.fmtNum(p[1])}</small>` : ''}
          <span class="rar">${G.RARITY[a.rarity].label}${got ? ' · ' + new Date(got).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ` · +${G.RARITY[a.rarity].xp} XP`}</span></div></article>`;
      })
      .join('');
    return `<div class="section-head"><h2>Trophy room</h2><span class="chip xp">${n} / ${total} unlocked</span></div>
      <div class="xp-bar wide"><i style="width:${Math.round((n / total) * 100)}%"></i></div>
      <div class="trophy-grid">${cards}</div>`;
  }

  A.views.vault = {
    title: 'Vault',
    render(root) {
      root.innerHTML = `
      <div class="page-head"><p class="eyebrow">Spend &amp; show off</p><h1>The <em>vault</em></h1></div>
      ${hero()}
      <div class="seg tabs"><button class="seg-btn ${tab === 'shop' ? 'on' : ''}" data-act="vaultTab" data-t="shop" data-quiet>${icon('gift', 16)} Shop</button>
        <button class="seg-btn ${tab === 'trophies' ? 'on' : ''}" data-act="vaultTab" data-t="trophies" data-quiet>${icon('trophy', 16)} Trophies</button></div>
      ${tab === 'shop' ? shop() : trophies()}`;
    },
  };

  A.actions.vaultTab = (el) => {
    tab = el.dataset.t;
    A.sfx('click');
    A.rerender();
  };
  A.actions.buyItem = (el) => {
    const r = G.buy(el.dataset.id);
    if (!r.ok) {
      A.sfx('error');
      return A.ui.toast(r.msg || 'Cannot buy that', { icon: '🚫', kind: 'warn' });
    }
    const it = G.SHOP.find((i) => i.id === el.dataset.id);
    A.fx.confetti({ x: el.getBoundingClientRect().left, y: el.getBoundingClientRect().top, count: 30, power: 8, spread: 3 });
    A.ui.toast(`Bought <b>${it.name}</b>`, { icon: it.icon });
  };
  A.actions.redeem = async (el) => {
    const r = A.S.rewards.find((x) => x.id === el.dataset.id);
    if (!r) return;
    if (A.S.player.coins < r.cost) {
      A.sfx('error');
      return A.ui.toast(`You need ${r.cost - A.S.player.coins} more coins`, { icon: '🚫', kind: 'warn' });
    }
    if (!(await A.ui.confirm({ title: `Redeem “${r.name}”?`, text: `Spend ${r.cost} coins. Enjoy it, you earned it.`, ok: 'Redeem' }))) return;
    if (G.redeem(r.id).ok) {
      A.fx.celebrate();
      A.ui.toast(`Enjoy: <b>${esc(r.name)}</b>`, { icon: r.icon, ms: 5000 });
    }
  };
  A.actions.rewardNew = () => rewardEditor();
  A.actions.rewardEdit = (el) => rewardEditor(A.S.rewards.find((r) => r.id === el.dataset.id));

  function rewardEditor(rw) {
    const edit = !!rw;
    const f = edit ? { ...rw } : { name: '', icon: '🎁', cost: 50 };
    const emojis = ['🎁', '🍿', '☕', '🎮', '🍕', '🍰', '🎧', '📺', '🛍️', '🎬', '🍔', '🧋', '🏖️', '💆', '📚', '🎟️'];
    const m = A.ui.modal({
      cls: 'editor modal-sm',
      html: `<div class="modal-head"><h2>${edit ? 'Edit reward' : 'New reward'}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
        <label class="field"><span>Reward</span><input id="rw-name" class="input" maxlength="40" placeholder="e.g. Order sushi" value="${esc(f.name)}"></label>
        <div class="field"><span>Icon</span><div class="emoji-grid" id="rw-emo">${emojis.map((e) => `<button type="button" class="emo ${e === f.icon ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
        <div class="field"><span>Cost (coins)</span><div class="num-step"><button type="button" class="icon-btn sm" data-n="-10">${icon('minus', 16)}</button><b id="rw-cost">${f.cost}</b><button type="button" class="icon-btn sm" data-n="10">${icon('plus', 16)}</button></div></div>
        <div class="row between gap sticky-actions">${edit ? `<button class="btn ghost danger-t" id="rw-del">${icon('trash', 16)} Delete</button>` : '<span></span>'}<div class="row gap"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="rw-save">Save</button></div></div>`,
    });
    m.el.addEventListener('click', (e) => {
      const emo = e.target.closest('.emo');
      if (emo) {
        f.icon = emo.dataset.e;
        m.el.querySelectorAll('.emo').forEach((x) => x.classList.toggle('on', x === emo));
        return A.sfx('pop');
      }
      const n = e.target.closest('[data-n]');
      if (n) {
        f.cost = A.clamp(f.cost + +n.dataset.n, 5, 5000);
        m.el.querySelector('#rw-cost').textContent = f.cost;
        return A.sfx('click');
      }
      if (e.target.closest('#rw-del')) {
        A.S.rewards = A.S.rewards.filter((r) => r.id !== rw.id);
        A.save();
        return m.close();
      }
      if (e.target.closest('#rw-save')) {
        const name = m.el.querySelector('#rw-name').value.trim();
        if (!name) return A.sfx('error');
        if (edit) Object.assign(rw, { name, icon: f.icon, cost: f.cost });
        else A.S.rewards.push({ id: A.uid(), name, icon: f.icon, cost: f.cost });
        A.save();
        m.close();
      }
    });
  }
})();
