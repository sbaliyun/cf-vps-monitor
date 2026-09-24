'use strict';
/* 王者之弈 · 界面 */
(function (G) {
  const U = G.ui = {};
  const S = G.S, A = G.art, T = G.TRAITS;
  const $ = id => document.getElementById(id);
  let el = {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* ---------- 布局 ---------- */
  U.layout = function () {
    const app = el.app, vw = app.clientWidth, vh = app.clientHeight;
    const port = vw / vh < 0.9;
    // 舞台按屏幕比例伸展：横屏加宽、竖屏加高，避免黑边
    const W = port ? 720 : Math.round(Math.max(1280, Math.min(1640, 720 * vw / vh)));
    const H = port ? Math.round(Math.max(1280, Math.min(1600, 720 * vh / vw))) : 720;
    const s = Math.min(vw / W, vh / H);
    el.stage.className = (port ? 'P' : 'L') + (el.menu && !el.menu.hidden ? ' menu-on' : '');
    el.stage.style.width = W + 'px'; el.stage.style.height = H + 'px';
    el.stage.style.transform = 'translate(' + ((vw - W * s) / 2) + 'px,' + ((vh - H * s) / 2) + 'px) scale(' + s + ')';
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    G.view = { scale: s, dpr };
    el.cv.width = Math.round(W * s * dpr); el.cv.height = Math.round(H * s * dpr);
    const ex = port ? H - 1280 : 0;
    // 竖屏更高时：棋盘透视略放平以利用高度，剩余空间一部分下移棋盘
    const sq = port ? Math.min(0.86, 0.7 + ex / 1000) : 0.7;
    const rowsH = 7 * 0.866 * 90 * sq, shift = port ? (ex - (rowsH - 382)) * 0.4 : 0;
    const oy = 338 + shift;
    const L = port
      ? { W, H, mode: 'port', board: { hw: 90, sq, ox: 360 - 3.25 * 90, oy }, bench: { x: 18, y: oy + rowsH + 114, w: 76 } }
      : { W, H, mode: 'land', board: { hw: 74, sq: 0.7, ox: W / 2 - 3.25 * 74, oy: 150 }, bench: { x: W / 2 - 279, y: 556, w: 62 } };
    el.itemTray.style.top = port ? (L.bench.y + 40) + 'px' : '';
    el.augBar.style.top = port ? (L.bench.y + 43) + 'px' : '';
    G.render.layout(L);
    U.scale = s;
  };
  function toStage(cx, cy) { const r = el.stage.getBoundingClientRect(); return { x: (cx - r.left) / U.scale, y: (cy - r.top) / U.scale }; }

  /* ---------- 初始化 ---------- */
  U.init = function () {
    for (const id of ['app', 'stage', 'cv', 'roundLabel', 'phaseLabel', 'track', 'timerNum', 'timerBar', 'btnReady', 'btnSpeed', 'btnMusic', 'btnSfx', 'btnMenu', 'traits', 'players', 'items', 'augBar', 'lvl', 'pop', 'xpBar', 'btnXP', 'btnRoll', 'rollCost', 'shop', 'goldNum', 'streak', 'btnLock', 'odds', 'sellZone', 'sellVal', 'unitPanel', 'tooltip', 'toast', 'banner', 'tip', 'tipText', 'tipOk', 'modal', 'menu', 'parade', 'record', 'itemGhost', 'shopbar', 'itemTray']) el[id] = $(id);
    const a = () => G.audio.init();
    el.btnXP.onclick = () => { a(); if (S.me) G.act.buyXP(S.me); };
    el.btnRoll.onclick = () => { a(); if (S.me) G.act.reroll(S.me); };
    el.btnLock.onclick = () => { if (S.me) G.act.toggleLock(S.me); };
    el.btnReady.onclick = () => { a(); if (S.phase === 'planning' && !modalOpen()) G.startCombat(); };
    el.btnSpeed.onclick = () => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; el.btnSpeed.textContent = S.speed + '×'; G.audio.play('click'); };
    el.btnMusic.onclick = () => { a(); G.audio.setMusic(!G.audio.musicOn); syncAudioBtns(); };
    el.btnSfx.onclick = () => { a(); G.audio.setSfx(!G.audio.sfxOn); syncAudioBtns(); };
    el.btnMenu.onclick = () => { a(); openPause(); };
    el.tipOk.onclick = () => { el.tip.hidden = true; };
    syncAudioBtns();
    el.shop.addEventListener('click', e => { const c = e.target.closest('.card[data-i]'); if (c) { a(); G.act.buy(S.me, +c.dataset.i); } });
    el.shop.addEventListener('contextmenu', e => { const c = e.target.closest('.card[data-i]'); if (c) { e.preventDefault(); const hid = S.me.shop[+c.dataset.i]; if (hid) U.showUnit({ hid, star: 1, items: [] }, false, true); } });
    el.items.addEventListener('pointerdown', e => {
      const img = e.target.closest('img[data-i]'); if (!img) return;
      e.preventDefault(); a();
      G.render.startItemDrag(+img.dataset.i, e);
      U.dragItemGhost(e.clientX, e.clientY, +img.dataset.i);
      hideTip();
    });
    // 悬浮提示
    el.stage.addEventListener('pointerover', onOver);
    el.stage.addEventListener('pointerout', e => { if (e.target.closest('[data-tt]')) hideTip(); });
    el.stage.addEventListener('click', e => { const t = e.target.closest('[data-tt]'); if (t && e.pointerType !== 'mouse') onOver(e); });
    el.menu.addEventListener('click', e => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      a(); G.audio.play('open');
      const go = b.dataset.go;
      if (go === 'pvp' || go === 'pve') startGame(go);
      else if (go === 'gallery') openGallery();
      else if (go === 'help') openHelp();
    });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', () => U.layout());
    U.layout();
    el.stage.classList.add('menu-on');
    buildMenu();
  };
  function syncAudioBtns() { el.btnMusic.classList.toggle('off', !G.audio.musicOn); el.btnSfx.classList.toggle('off', !G.audio.sfxOn); }
  function modalOpen() { return !el.modal.hidden; }

  function startGame(mode) {
    el.menu.hidden = true;
    el.stage.classList.remove('menu-on');
    closeModal();
    el.unitPanel.hidden = true;
    G.newGame(mode);
    U.refresh();
  }
  U.showMenu = function () {
    S.phase = 'menu';
    closeModal(); el.unitPanel.hidden = true; el.tip.hidden = true;
    buildMenu();
    el.menu.hidden = false;
    el.stage.classList.add('menu-on');
  };
  function fullSprite(hid, h) {
    const sp = A.sprite(hid, 0);
    const c = document.createElement('canvas');
    const sc = h / (sp.h - 14);
    c.width = Math.ceil(sp.w * sc * 2); c.height = Math.ceil(h * 2);
    const g = c.getContext('2d'); g.scale(2, 2);
    g.drawImage(sp.c, 0, -6 * sc, sp.w * sc, sp.h * sc);
    return c.toDataURL();
  }
  const fullCache = {};
  U.fullSprite = (hid, h) => fullCache[hid + h] || (fullCache[hid + h] = fullSprite(hid, h));
  function buildDiff() {
    const cur = G.difficulty().id;
    const seg = $('diffSeg');
    seg.innerHTML = G.DIFFS.map(d => '<button role="radio" aria-checked="' + (d.id === cur) + '" data-d="' + d.id + '">' + d.name + '</button>').join('');
    seg.querySelectorAll('button').forEach(b => b.onclick = () => { G.setDifficulty(b.dataset.d); G.audio.play('click'); buildDiff(); });
  }
  function buildMenu() {
    buildDiff();
    el.parade.innerHTML = ['houyi', 'diaochan', 'hanxin'].map(h => '<img alt="' + G.HEROES[h].name + '" src="' + U.fullSprite(h, 250) + '">').join('');
    const r = G.record.load();
    el.record.innerHTML = r.games
      ? '对局 <b>' + r.games + '</b> · 吃鸡 <b>' + r.wins + '</b> · 前四 <b>' + r.top4 + '</b>' + (r.best ? ' · 最佳 第<b>' + r.best + '</b>名' : '') + ' · 龙王通关 <b>' + r.pveClear + '</b>'
      : '拖动英雄上阵 · 三个相同英雄自动升星 · 凑齐羁绊获得强力加成';
  }

  /* ---------- 键盘 ---------- */
  function onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (!el.unitPanel.hidden) { U.hideUnit(); return; }
      if (modalOpen() && el.modal.dataset.kind !== 'aug' && el.modal.dataset.kind !== 'ev' && el.modal.dataset.kind !== 'over') { closeModal(); return; }
      if (S.phase !== 'menu' && S.phase !== 'over' && !modalOpen()) openPause();
      return;
    }
    if (S.phase === 'menu' || S.phase === 'over' || modalOpen()) return;
    const me = S.me; if (!me) return;
    G.audio.init();
    if (k === 'd') G.act.reroll(me);
    else if (k === 'f') G.act.buyXP(me);
    else if (k === ' ') { e.preventDefault(); if (S.phase === 'planning') G.startCombat(); }
    else if (k === 'e' || k === 'w') {
      const h = G.render.hoverUnit; if (!h || h.where === 'battle') return;
      if (k === 'e') { G.act.sell(me, h.u); G.render.hoverUnit = null; U.hideUnit(); }
      else if (h.where === 'bench') {
        if (S.phase === 'combat') return;
        for (const r of [4, 5, 6, 7]) for (const c of [3, 2, 4, 1, 5, 0, 6]) if (!me.board.some(x => x.c === c && x.r === r)) { G.act.move(me, h.u, { type: 'board', c, r }); G.render.hoverUnit = null; return; }
      } else {
        const i = me.bench.indexOf(null); if (i >= 0) { G.act.move(me, h.u, { type: 'bench', i }); G.render.hoverUnit = null; }
      }
    }
  }

  /* ---------- 刷新 ---------- */
  U.refresh = function () {
    if (!S.me || S.phase === 'menu') return;
    renderTop(); renderShopBar(); renderShop(); renderTraits(); renderPlayers(); renderItems(); renderAugs();
  };
  function renderTop() {
    const R = S.round; if (!R) return;
    el.roundLabel.textContent = S.mode === 'pve' ? R.label.replace(/\s/g, '') : R.label;
    el.phaseLabel.textContent = { planning: '准备阶段', combat: R.pve ? '野怪回合' : '对战中', result: '回合结算', over: '对局结束' }[S.phase] || '';
    el.btnReady.disabled = S.phase !== 'planning';
    if (S.mode === 'pve') { el.track.innerHTML = ''; el.track.style.display = 'none'; return; }
    el.track.style.display = '';
    const st = R.stage;
    const rounds = S.schedule.map((r, i) => ({ r, i })).filter(x => x.r.stage === st);
    el.track.innerHTML = '<span style="font-size:12px;color:#98A2B8;margin-right:2px">第' + '一二三四五六七八九'[st - 1] + '阶段</span>' + rounds.map(({ r, i }) => {
      const g = r.pve ? (r.pve === 'tyrant' || r.pve === 'overlord' || r.pve === 'storm' ? '龙' : '怪') : r.aug ? '奇' : r.ev ? '遇' : '战';
      const cls = [i === S.ri ? 'cur' : '', r.res || (i < S.ri ? 'done' : ''), r.pve ? 'pve' : ''].join(' ');
      return '<i class="' + cls + '">' + g + '</i>';
    }).join('');
  }
  function renderShopBar() {
    const me = S.me;
    el.goldNum.textContent = me.gold;
    el.lvl.textContent = 'Lv.' + me.level;
    const need = G.XP_NEED[me.level];
    el.xpBar.firstElementChild.style.width = (me.level >= G.MAX_LEVEL ? 100 : me.xp / need * 100) + '%';
    el.xpBar.lastElementChild.textContent = me.level >= G.MAX_LEVEL ? '满级' : me.xp + ' / ' + need;
    el.pop.textContent = '人口 ' + me.board.length + '/' + me.level;
    el.pop.classList.toggle('warn', me.board.length < me.level && me.bench.some(Boolean));
    el.btnXP.classList.toggle('poor', me.gold < 4 || me.level >= G.MAX_LEVEL);
    el.rollCost.textContent = me.freeRolls > 0 ? '免费' : '2';
    el.btnRoll.classList.toggle('poor', me.gold < 2 && !me.freeRolls);
    el.btnLock.classList.toggle('on', me.locked);
    el.btnLock.textContent = me.locked ? '锁' : '开';
    el.btnLock.title = me.locked ? '商店已锁定（下回合保留）' : '锁定商店';
    const s = me.streak;
    el.streak.className = s >= 2 ? 'w' : s <= -2 ? 'l' : '';
    el.streak.textContent = s >= 2 ? s + ' 连胜' : s <= -2 ? (-s) + ' 连败' : '';
    const odds = G.SHOP_ODDS[me.level];
    el.odds.innerHTML = odds.map((o, i) => o ? '<span style="color:' + G.COST_COLORS[i + 1] + '">' + o + '%</span>' : '').join('');
  }
  function ownedCount(hid) { let n1 = 0, n = 0; for (const u of G.allUnits(S.me)) if (u.hid === hid) { n++; if (u.star === 1) n1++; } return { n, n1 }; }
  function renderShop(flip) {
    const me = S.me, L = G.render.L;
    const pw = L.mode === 'port' ? 132 : 172, ph = L.mode === 'port' ? 150 : 88;
    el.shop.innerHTML = me.shop.map((hid, i) => {
      if (!hid) return '<div class="card sold"></div>';
      const h = G.HEROES[hid], o = ownedCount(hid);
      const cls = ['card', 'c' + h.cost, o.n ? 'own' : '', o.n1 >= 2 ? 'up' : '', me.gold < h.cost ? 'poor' : '', flip ? 'flip' : ''].join(' ');
      const tr = h.traits.map(t => '<span><i style="color:' + T[t].color + '">' + T[t].glyph + '</i>' + T[t].name + '</span>').join('');
      return '<button class="' + cls + '" data-i="' + i + '" data-own="' + (o.n ? '已有 ' + o.n : '') + '" style="animation-delay:' + (i * 0.04) + 's" aria-label="购买' + h.name + '，' + h.cost + '金币">'
        + '<div class="art" style="background-image:url(' + A.portrait(hid, pw, ph) + ')"><div class="tr">' + tr + '</div></div>'
        + '<div class="foot"><span>' + h.name + '</span><b><i class="coin"></i>' + h.cost + '</b></div></button>';
    }).join('');
  }
  U.shopAnim = function () { renderShop(true); };
  function tierIcon(t, tier) { const n = T[t].breaks.length; if (!tier) return 0; return n === 2 ? [1, 3][tier - 1] : [1, 2, 4][tier - 1]; }
  function renderTraits() {
    if (S.phase === 'combat' || (S.phase === 'result' && S.battle)) { renderDmg(); return; }
    const { counts, tiers } = G.calcTraits(S.me.board, S.me.augs);
    const list = Object.keys(counts).sort((a, b) => (tiers[b] - tiers[a]) || (counts[b] - counts[a]) || G.TRAIT_ORDER.indexOf(a) - G.TRAIT_ORDER.indexOf(b));
    if (!list.length) { el.traits.innerHTML = '<div class="traits-empty">棋盘上的英雄会在这里显示羁绊。凑齐 2 个同职业或同阵营的英雄即可激活。</div>'; return; }
    el.traits.innerHTML = list.map(t => {
      const tr = T[t], k = tiers[t];
      const br = tr.breaks.map(b => counts[t] >= b ? '<em>' + b + '</em>' : b).join(' › ');
      return '<div class="trait ' + (k ? '' : 'off') + '" data-tt="trait:' + t + '"><img alt="" src="' + A.traitIcon(t, tierIcon(t, k)) + '"><div><div class="tn">' + tr.name + '</div><div class="tb">' + br + '</div></div><div class="cnt">' + counts[t] + '</div></div>';
    }).join('');
  }
  let dmgT = 0;
  function renderDmg() {
    const b = S.battle; if (!b) return;
    const us = b.units.filter(u => u.team === 0 && u.hero).sort((x, y) => y.dealt - x.dealt);
    const max = Math.max(1, ...us.map(u => u.dealt));
    el.traits.innerHTML = '<div class="ph">伤害统计</div>' + us.map(u => '<div class="dmg-row"><img alt="" src="' + A.portrait(u.hid, 30, 30) + '"><div><div class="dn"><span>' + u.hero.name + '</span><b>' + Math.round(u.dealt) + '</b></div><div class="db"><i style="width:' + (u.dealt / max * 100) + '%"></i></div></div></div>').join('');
  }
  function renderPlayers() {
    if (S.mode === 'pve') {
      el.players.innerHTML = '<div class="ph">风暴龙王 · 关卡</div>' + S.schedule.map((r, i) => {
        const boss = r.pve === 'tyrant' || r.pve === 'overlord' || r.pve === 'storm';
        const nm = { w1: '暗影小兵', w2: '暗影小兵', golems: '魔像', shadow: '暗影军团', tyrant: '暴君', overlord: '主宰', storm: '风暴龙王' }[r.pve];
        const cls = ['wave', i < S.ri ? 'done' : '', i === S.ri ? 'cur' : '', boss ? 'boss' : ''].join(' ');
        return '<div class="' + cls + '"><i>' + (i + 1) + '</i><span>' + nm + (r.res === 'lose' ? ' ✕' : '') + '</span></div>';
      }).join('') + '<div class="wave cur" style="margin-top:6px"><i style="background:#1F5A4E;color:#BFF5E6">血</i><span>生命 ' + S.me.hp + '</span></div>';
      return;
    }
    const ps = S.players.slice().sort((a, b) => (b.alive - a.alive) || (b.hp - a.hp) || (a.place - b.place));
    el.players.innerHTML = (G.render.L.mode === 'land' ? '<div class="ph">召唤师</div>' : '') + ps.map(p => {
      const cls = ['pl', p.human ? 'me' : '', p === S.opp && (S.phase === 'planning' || S.phase === 'combat') && !S.round.pve ? 'opp' : '', p.alive ? '' : 'dead', p.hp <= 30 ? 'low' : ''].join(' ');
      return '<div class="' + cls + '" data-tt="player:' + p.id + '"><img alt="" src="' + A.portrait(p.avatar, 40, 40, { round: 1 }) + '"><span class="pl-lv">' + p.level + '</span><div><div class="pn"><span>' + esc(p.name) + '</span><b>' + (p.alive ? p.hp : p.place) + '</b></div><div class="phb"><i style="width:' + Math.max(0, p.hp) + '%"></i></div></div></div>';
    }).join('');
  }
  function renderItems() {
    const me = S.me;
    el.items.innerHTML = me.items.length ? me.items.map((id, i) => '<img alt="' + G.ITEMS[id].name + '" src="' + A.itemIcon(id) + '" data-i="' + i + '" data-tt="item:' + id + '" draggable="false">').join('')
      : '<div class="empty">击败野怪获得装备，拖到英雄身上即可装备</div>';
  }
  function renderAugs() {
    el.augBar.innerHTML = S.me.augs.map(id => { const a = G.AUGMENTS.find(x => x.id === id); return '<img alt="' + a.name + '" src="' + A.augIcon(a) + '" data-tt="aug:' + id + '">'; }).join('');
  }

  /* ---------- 帧 ---------- */
  let liveT = 0;
  U.frame = function (dt) {
    if (!S.me || S.phase === 'menu') return;
    if (S.phase === 'planning') {
      el.timerNum.textContent = Math.ceil(S.timer);
      el.timerBar.style.width = (S.timer / S.timerMax * 100) + '%';
      el.timerBar.style.background = S.timer < 6 ? 'linear-gradient(90deg,#E0523F,#F4B63C)' : '';
    } else if (S.phase === 'combat' && S.battle) {
      const t = S.battle.t;
      el.timerNum.textContent = Math.floor(t);
      el.timerBar.style.width = Math.min(100, t / 30 * 100) + '%';
      el.timerBar.style.background = t > 30 ? 'linear-gradient(90deg,#E0523F,#FF8A3A)' : 'linear-gradient(90deg,#5AA8FF,#9FE3FF)';
    }
    dmgT += dt; liveT += dt;
    if ((S.phase === 'combat') && dmgT > 0.35) { dmgT = 0; renderDmg(); }
    if (liveT > 0.25 && !el.unitPanel.hidden && U.panelUnit && U.panelUnit.maxHp) { liveT = 0; U.showUnit(U.panelUnit, true); }
  };

  /* ---------- 提示 ---------- */
  U.toast = function (msg) {
    const d = document.createElement('div'); d.textContent = msg;
    el.toast.appendChild(d);
    while (el.toast.children.length > 3) el.toast.firstChild.remove();
    setTimeout(() => d.remove(), 2200);
  };
  let bannerTimer = null;
  U.banner = function (title, sub, cls) {
    el.banner.innerHTML = '<div class="bn"><h2 class="' + (cls || '') + '">' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
    el.banner.hidden = false;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { el.banner.hidden = true; }, 2200);
  };
  U.tip = function (key, text) {
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem('wzzy_tips') || '{}'); } catch (e) { /* ignore */ }
    if (seen[key]) return;
    seen[key] = 1;
    try { localStorage.setItem('wzzy_tips', JSON.stringify(seen)); } catch (e) { /* ignore */ }
    el.tipText.textContent = text; el.tip.hidden = false;
    clearTimeout(U.tipTimer); U.tipTimer = setTimeout(() => { el.tip.hidden = true; }, 9000);
  };

  /* ---------- 悬浮说明 ---------- */
  function onOver(e) {
    const t = e.target.closest('[data-tt]'); if (!t) return;
    if (G.render.drag) return;
    const [kind, id] = t.dataset.tt.split(':');
    let html = '';
    if (kind === 'trait') html = traitHtml(id);
    else if (kind === 'item') html = itemHtml(id);
    else if (kind === 'aug') { const a = G.AUGMENTS.find(x => x.id === id); html = '<h4>' + a.name + ' <small style="color:' + G.AUG_TIER_COLORS[a.tier] + '">' + G.AUG_TIER_NAMES[a.tier] + '</small></h4>' + a.desc; }
    else if (kind === 'player') html = playerHtml(+id);
    if (!html) return;
    el.tooltip.innerHTML = html; el.tooltip.hidden = false;
    const r = t.getBoundingClientRect(), p = toStage(r.right, r.top);
    const L = G.render.L;
    let x = p.x + 8, y = p.y;
    el.tooltip.style.left = '0px'; el.tooltip.style.top = '0px';
    const tw = el.tooltip.offsetWidth, th = el.tooltip.offsetHeight;
    if (x + tw > L.W - 8) x = toStage(r.left, 0).x - tw - 8;
    if (x < 8) x = 8;
    if (y + th > L.H - 8) y = L.H - th - 8;
    el.tooltip.style.left = x + 'px'; el.tooltip.style.top = y + 'px';
  }
  function hideTip() { el.tooltip.hidden = true; }
  function traitHtml(t) {
    const tr = T[t];
    const { counts } = G.calcTraits(S.me ? S.me.board : [], S.me ? S.me.augs : []);
    const n = counts[t] || 0;
    const mem = G.HERO_LIST.filter(h => h.traits.indexOf(t) >= 0);
    const onBoard = new Set((S.me ? S.me.board : []).map(u => u.hid));
    return '<h4>' + tr.name + ' <small style="color:#98A2B8">' + (tr.type === 'class' ? '职业' : '阵营') + '</small></h4><div style="margin-bottom:4px">' + tr.desc + '</div>'
      + tr.breaks.map((b, i) => '<div class="tt-t ' + (n >= b ? 'on' : '') + '"><b>(' + b + ')</b> ' + tr.tiers[i] + '</div>').join('')
      + '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:6px">' + mem.map(h => '<img alt="' + h.name + '" title="' + h.name + '" src="' + A.portrait(h.id, 26, 26) + '" style="width:26px;height:26px;border-radius:5px;border:2px solid ' + G.COST_COLORS[h.cost] + ';' + (onBoard.has(h.id) ? '' : 'opacity:.45') + '">').join('') + '</div>';
  }
  function itemHtml(id) {
    const it = G.ITEMS[id];
    let h = '<h4>' + it.name + '</h4>';
    const st = it.s || {};
    h += '<div>' + Object.keys(st).map(k => G.STAT_NAMES[k] + ' +' + st[k]).join('，') + '</div>';
    if (!it.comp) h += '<div style="margin-top:4px;color:#FFE9A8">' + it.desc + '</div><div class="rec">合成：<img alt="" src="' + A.itemIcon(it.from[0]) + '">+<img alt="" src="' + A.itemIcon(it.from[1]) + '"></div>';
    else h += '<div style="margin-top:4px;color:#98A2B8">两件基础装备放在同一名英雄身上会自动合成。</div>';
    return h;
  }
  function playerHtml(id) {
    const p = S.players.find(x => x.id === id); if (!p) return '';
    const s = p.streak;
    let h = '<h4>' + esc(p.name) + '</h4><div>等级 ' + p.level + ' · 生命 ' + Math.max(0, p.hp) + (s >= 2 ? ' · ' + s + ' 连胜' : s <= -2 ? ' · ' + (-s) + ' 连败' : '') + (p.style ? ' · ' + p.style.name : '') + '</div>';
    if (p.board.length) h += '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:6px">' + p.board.map(u => '<div style="position:relative"><img alt="" src="' + A.portrait(u.hid, 30, 30) + '" style="width:30px;height:30px;border-radius:5px;border:2px solid ' + G.COST_COLORS[G.HEROES[u.hid].cost] + '"><span style="position:absolute;left:0;right:0;bottom:-3px;text-align:center;font-size:9px;color:#FFD65A">' + '★'.repeat(u.star) + '</span></div>').join('') + '</div>';
    return h;
  }

  /* ---------- 单位面板 ---------- */
  function skillText(h, star) {
    return h.skill.desc.replace(/\{(\d)\}/g, (m, i) => h.skill.v[+i].map((x, k) => k === star - 1 ? '<em>' + x + '</em>' : x).join('/'));
  }
  U.showUnit = function (u, battle, fromShop) {
    const h = G.HEROES[u.hid], m = G.MONSTERS[u.hid];
    U.panelUnit = battle ? u : null;
    let html = '<button class="up-close" aria-label="关闭">×</button>';
    if (h) {
      const sm = [1, 1.8, 3.24][u.star - 1];
      let st;
      if (battle) {
        const b = S.battle;
        st = { hp: Math.round(u.hp) + '/' + Math.round(u.maxHp), ad: Math.round(b.AD(u)), as: b.AS(u).toFixed(2), range: u.range, armor: Math.round(u.armor), mr: Math.round(u.mr), ap: Math.round(b.AP(u)), crit: Math.round(u.crit * 100) + '%', mana: Math.round(u.mana) + '/' + u.manaMax };
      } else {
        let hp = h.hp * sm, ad = h.ad * sm, as = h.as, armor = h.armor, mr = h.mr, ap = 100, crit = h.traits.indexOf('assassin') >= 0 ? 25 : 15, mana = h.sm || 0, range = h.range;
        for (const id of u.items) { const s = G.ITEMS[id].s || {}; hp += s.hp || 0; ad += s.ad || 0; as *= 1 + (s.as || 0) / 100; armor += s.armor || 0; mr += s.mr || 0; ap += s.ap || 0; crit += s.crit || 0; mana += s.mana || 0; if (id === 'zhuri') range++; }
        st = { hp: Math.round(hp), ad: Math.round(ad), as: as.toFixed(2), range, armor, mr, ap, crit: crit + '%', mana: Math.min(mana, h.mana) + '/' + h.mana };
      }
      html += '<div class="up-head"><img alt="" src="' + A.portrait(u.hid, 64, 64) + '" style="border-color:' + G.COST_COLORS[h.cost] + '"><div><div class="up-stars">' + '★'.repeat(u.star) + '<span style="color:#5A6480">' + '★'.repeat(3 - u.star) + '</span></div><h3>' + h.name + '</h3><div class="sub">' + h.title + ' · ' + h.cost + ' 费' + (u.shadow ? ' · 暗影' : '') + '</div></div></div>';
      html += '<div class="up-traits">' + h.traits.map(t => '<span style="color:' + T[t].color + '">' + T[t].name + '</span>').join('') + '</div>';
      html += '<div class="up-stats"><span>生命<b>' + st.hp + '</b></span><span>攻击<b>' + st.ad + '</b></span><span>攻速<b>' + st.as + '</b></span><span>射程<b>' + st.range + '</b></span><span>护甲<b>' + st.armor + '</b></span><span>魔抗<b>' + st.mr + '</b></span><span>法强<b>' + st.ap + '</b></span><span>暴击<b>' + st.crit + '</b></span><span>法力<b>' + st.mana + '</b></span></div>';
      html += '<div class="up-skill"><h4>' + h.skill.name + '<small>' + h.mana + ' 法力</small></h4>' + skillText(h, u.star) + '</div>';
      if (u.items && u.items.length) html += '<div class="up-items">' + u.items.map(id => '<div><img alt="" src="' + A.itemIcon(id) + '">' + G.ITEMS[id].name + '</div>').join('') + '</div>';
      const me = S.me;
      const mine = !battle && !fromShop && me && G.allUnits(me).indexOf(u) >= 0;
      if (mine) {
        const onBoard = me.board.indexOf(u) >= 0;
        html += '<div class="up-foot"><span style="font-size:12px;color:#98A2B8">' + (onBoard ? '棋盘' : '备战席') + '</span><div style="display:flex;gap:6px">'
          + (S.phase !== 'combat' || !onBoard ? '<button class="alt" data-a="swap">' + (onBoard ? '下阵' : '上阵') + ' (W)</button>' : '')
          + (S.phase !== 'combat' || !onBoard ? '<button data-a="sell">出售 +' + G.act.sellValue(u) + ' (E)</button>' : '') + '</div></div>';
      }
    } else if (m) {
      html += '<div class="up-head"><img alt="" src="' + A.portrait(u.hid, 64, 64, { bg: '#5A3A6A' }) + '"><div><h3>' + m.name + '</h3><div class="sub">' + (m.boss ? '首领' : '野怪') + '</div></div></div>';
      html += '<div class="up-stats" style="margin-top:8px"><span>生命<b>' + Math.round(u.hp || m.hp) + '</b></span><span>攻击<b>' + Math.round(u.ad || m.ad) + '</b></span><span>射程<b>' + m.range + '</b></span></div>';
      if (m.skill) html += '<div class="up-skill"><h4>' + G.SKILLS[m.skill].name + '</h4>' + ({ tyrant: '猛击目标区域，造成物理伤害并击飞。', overlord: '喷吐烈焰，对直线上的敌人造成魔法伤害。', storm: '召唤雷暴劈向 5 名敌人并眩晕；生命低于一半时召唤两条风暴幼龙。' })[m.skill] + '</div>';
    }
    el.unitPanel.innerHTML = html;
    el.unitPanel.hidden = false;
    el.unitPanel.querySelector('.up-close').onclick = () => U.hideUnit();
    el.unitPanel.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const me = S.me;
      if (b.dataset.a === 'sell') { G.act.sell(me, u); U.hideUnit(); }
      else {
        if (me.board.indexOf(u) >= 0) { const i = me.bench.indexOf(null); if (i >= 0) G.act.move(me, u, { type: 'bench', i }); else U.toast('备战席已满'); }
        else { let done = false; for (const r of [4, 5, 6, 7]) { for (const c of [3, 2, 4, 1, 5, 0, 6]) if (!me.board.some(x => x.c === c && x.r === r)) { G.act.move(me, u, { type: 'board', c, r }); done = true; break; } if (done) break; } }
        U.showUnit(u, false);
      }
    });
  };
  U.hideUnit = function () { el.unitPanel.hidden = true; U.panelUnit = null; G.render.selected = null; };

  /* ---------- 出售区 / 拖拽装备 ---------- */
  U.showSell = function (u) { if (S.phase === 'combat' && S.me.board.indexOf(u) >= 0) return; el.sellVal.textContent = '+' + G.act.sellValue(u); el.sellZone.hidden = false; };
  U.hideSell = function () { el.sellZone.hidden = true; el.sellZone.classList.remove('hot'); };
  U.overSell = function (cx, cy) { if (el.sellZone.hidden) return false; const r = el.shopbar.getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; };
  U.sellHover = function (on) { el.sellZone.classList.toggle('hot', !!on); };
  U.dragItemGhost = function (cx, cy, idx) {
    if (cx == null) { el.itemGhost.hidden = true; return; }
    if (el.itemGhost.hidden && idx != null) el.itemGhost.src = A.itemIcon(S.me.items[idx]);
    el.itemGhost.hidden = false; el.itemGhost.style.left = cx + 'px'; el.itemGhost.style.top = cy + 'px';
  };

  /* ---------- 弹窗 ---------- */
  function openModal(html, kind) {
    el.modal.innerHTML = html; el.modal.hidden = false; el.modal.dataset.kind = kind || '';
    hideTip();
    const x = el.modal.querySelector('.close-x'); if (x) x.onclick = closeModal;
  }
  function closeModal() { el.modal.hidden = true; el.modal.innerHTML = ''; el.modal.dataset.kind = ''; S.paused = false; }
  U.closeModals = function () { if (el.modal.dataset.kind === 'aug' || el.modal.dataset.kind === 'ev') closeModal(); };

  let augState = null;
  U.openAugments = function (list, tier) {
    augState = { list, tier, rerolled: false };
    renderAugModal();
    G.audio.play('augment');
  };
  function renderAugModal() {
    const { list } = augState;
    openModal('<div class="mbox"><h2>峡谷奇遇</h2><div class="msub">选择一项强化，本局永久生效</div><div class="augs">' + list.map(a =>
      '<button class="aug t' + a.tier + '" data-id="' + a.id + '"><img alt="" src="' + A.augIcon(a) + '"><div><span class="tier" style="color:' + G.AUG_TIER_COLORS[a.tier] + '">' + G.AUG_TIER_NAMES[a.tier] + '</span><h3>' + a.name + '</h3><p>' + a.desc + '</p></div></button>').join('')
      + '</div><div class="mrow"><button class="mbtn2" id="augRe" ' + (augState.rerolled ? 'disabled' : '') + '>刷新奇遇（1 次）</button></div></div>', 'aug');
    el.modal.querySelectorAll('.aug').forEach(b => b.onclick = () => { G.chooseAug(b.dataset.id); closeModal(); U.toast('获得奇遇：' + G.AUGMENTS.find(x => x.id === b.dataset.id).name); });
    const re = $('augRe'); if (re) re.onclick = () => { if (augState.rerolled) return; augState.rerolled = true; augState.list = G.rerollAugs(augState.tier); G.audio.play('refresh'); renderAugModal(); };
  }
  U.openEvent = function (ev) {
    openModal('<div class="mbox ev"><h2>' + ev.name + '</h2><img alt="" src="' + A.eventIcon(ev) + '"><p>' + ev.text + '</p><div class="opts">' + ev.opts.map((o, i) => '<button data-i="' + i + '">' + o.t + '</button>').join('') + '</div></div>', 'ev');
    el.modal.querySelectorAll('.opts button').forEach(b => b.onclick = () => { if (G.resolveEvent(ev, ev.opts[+b.dataset.i])) closeModal(); });
    G.audio.play('open');
  };
  U.autoChoose = function () {
    const k = el.modal.dataset.kind;
    if (k === 'aug') { const b = el.modal.querySelector('.aug'); if (b) b.click(); }
    else if (k === 'ev') { const bs = el.modal.querySelectorAll('.opts button'); const last = bs[bs.length - 1]; if (last) { const ev = null; last.click(); if (!el.modal.hidden) closeModal(); } }
  };
  function openPause() {
    if (S.phase === 'menu') return;
    openModal('<div class="mbox pause"><h2>暂停</h2><button id="pResume">继续对局</button><button id="pHelp">玩法说明</button><button id="pGal">英雄图鉴</button>' + (S.phase !== 'over' ? '<button id="pQuit" class="danger">投降并结束对局</button>' : '') + '<button id="pHome">返回主页</button></div>', 'pause');
    S.paused = true;
    $('pResume').onclick = () => { closeModal(); S.paused = false; };
    $('pHelp').onclick = () => openHelp(true);
    $('pGal').onclick = () => openGallery(true);
    const q = $('pQuit'); if (q) q.onclick = () => { closeModal(); S.paused = false; G.surrender(); };
    $('pHome').onclick = () => { S.paused = false; U.showMenu(); };
  }
  U.isPaused = () => S.paused && modalOpen();

  /* ---------- 图鉴 ---------- */
  function openGallery(fromPause) {
    let tab = 'hero', sel = 'houyi';
    const render = () => {
      let body = '';
      if (tab === 'hero') {
        const list = G.HERO_LIST.slice().sort((a, b) => a.cost - b.cost);
        const h = G.HEROES[sel];
        body = '<div class="gal-body"><div class="gal-grid">' + list.map(x => '<button class="gh ' + (x.id === sel ? 'on' : '') + '" data-h="' + x.id + '" style="border-color:' + G.COST_COLORS[x.cost] + '"><img alt="" src="' + A.portrait(x.id, 92, 92) + '"><span>' + x.name + '</span></button>').join('') + '</div>'
          + '<div class="gal-detail"><img class="big" alt="" src="' + A.portrait(h.id, 272, 200, { full: true }) + '"><h3>' + h.name + '</h3><div style="color:#98A2B8">' + h.title + ' · <span style="color:' + G.COST_COLORS[h.cost] + '">' + h.cost + ' 费</span> · ' + h.traits.map(t => '<span style="color:' + T[t].color + '">' + T[t].name + '</span>').join(' ') + '</div>'
          + '<div class="up-stats" style="margin:8px 0"><span>生命<b>' + h.hp + '</b></span><span>攻击<b>' + h.ad + '</b></span><span>攻速<b>' + h.as + '</b></span><span>射程<b>' + h.range + '</b></span><span>护甲<b>' + h.armor + '</b></span><span>魔抗<b>' + h.mr + '</b></span></div>'
          + '<div class="up-skill"><h4>' + h.skill.name + '<small>' + (h.sm || 0) + '/' + h.mana + ' 法力</small></h4>' + skillText(h, 1).replace(/<em>|<\/em>/g, '') + '</div></div></div>';
      } else if (tab === 'trait') {
        body = '<div class="tl">' + G.TRAIT_ORDER.map(t => { const tr = T[t]; return '<div class="tl-card"><img alt="" src="' + A.traitIcon(t, 3) + '"><div><h4>' + tr.name + ' <small style="color:#98A2B8;font-size:12px">' + (tr.type === 'class' ? '职业' : '阵营') + '</small></h4><div>' + tr.desc + '</div>' + tr.breaks.map((b, i) => '<div><b style="color:#E9C46A">(' + b + ')</b> ' + tr.tiers[i] + '</div>').join('') + '<div class="mem">' + G.HERO_LIST.filter(h => h.traits.indexOf(t) >= 0).map(h => '<img alt="' + h.name + '" title="' + h.name + '" src="' + A.portrait(h.id, 26, 26) + '" style="border:2px solid ' + G.COST_COLORS[h.cost] + '">').join('') + '</div></div></div>'; }).join('') + '</div>';
      } else {
        const C = G.COMPONENTS;
        body = '<div class="rec-grid"><table><tr><th></th>' + C.map(c => '<th><img alt="" src="' + A.itemIcon(c) + '" data-tt="item:' + c + '">' + G.ITEMS[c].name + '</th>').join('') + '</tr>'
          + C.map(a => '<tr><th><img alt="" src="' + A.itemIcon(a) + '" data-tt="item:' + a + '">' + G.ITEMS[a].name + '</th>' + C.map(b => { const id = G.COMBO[a + '+' + b]; return '<td data-tt="item:' + id + '"><img alt="" src="' + A.itemIcon(id) + '">' + G.ITEMS[id].name + '</td>'; }).join('') + '</tr>').join('') + '</table></div>';
      }
      openModal('<div class="mbox gal"><button class="close-x" aria-label="关闭">×</button><h2>英雄图鉴</h2><div class="gal-tabs"><button data-tab="hero" class="' + (tab === 'hero' ? 'on' : '') + '">英雄</button><button data-tab="trait" class="' + (tab === 'trait' ? 'on' : '') + '">羁绊</button><button data-tab="item" class="' + (tab === 'item' ? 'on' : '') + '">装备合成</button></div>' + body + '</div>', 'gallery');
      el.modal.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; G.audio.play('click'); render(); });
      el.modal.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { sel = b.dataset.h; G.audio.play('click'); render(); });
      if (fromPause) el.modal.querySelector('.close-x').onclick = () => { closeModal(); openPause(); };
    };
    render();
  }
  function openHelp(fromPause) {
    openModal('<div class="mbox help"><button class="close-x" aria-label="关闭">×</button><h2>玩法说明</h2>'
      + '<h3>目标</h3><p>与 7 位召唤师同场竞技。每回合与一名对手自动对战，失败会损失生命，生命归零即被淘汰。坚持到最后即可登顶。</p>'
      + '<h3>回合流程</h3><ul><li><b>准备阶段</b>：在商店购买英雄，把他们从备战席拖到己方棋盘（下方四排）。</li><li><b>战斗阶段</b>：英雄自动寻敌、普攻回蓝，法力满后释放技能。</li><li>1-1 到 1-4 以及每阶段第 6 回合是<b>野怪回合</b>，击败暴君、主宰、风暴龙王可获得装备。</li><li>2-1、3-2、4-2 触发<b>峡谷奇遇</b>，三选一获得强化；每阶段第 4 回合会遇到随机事件。</li></ul>'
      + '<h3>经济</h3><ul><li>每回合基础 5 金币；每持有 10 金币额外获得 1 利息（最多 5）。</li><li>连胜或连败 2/4/5 场以上额外获得 1/2/3 金币；赢得对战再 +1。</li><li>刷新商店 2 金币，购买 4 点经验 4 金币。等级越高，人口越多，高费英雄出现概率越高。</li></ul>'
      + '<h3>升星与羁绊</h3><ul><li>三个相同的 1 星英雄自动合成 2 星，三个 2 星合成 3 星，属性大幅提升。</li><li>棋盘上不同英雄的职业（战士、法师、猎人、刺客、辅助）与阵营（长安、三分、稷下、长城、楚汉、神话）达到人数即可激活羁绊。</li></ul>'
      + '<h3>装备</h3><p>把装备从左侧装备栏拖到英雄身上。两件基础装备会合成一件成品装备，每名英雄最多 3 件。出售英雄时装备会退回。</p>'
      + '<h3>风暴龙王</h3><p>十二关 PVE 挑战：依次击败暗影军团、暴君与主宰，最终挑战风暴龙王。龙王生命低于一半时会召唤风暴幼龙。</p>'
      + '<h3>快捷键</h3><p><kbd>D</kbd> 刷新 · <kbd>F</kbd> 购买经验 · <kbd>E</kbd> 出售鼠标下的英雄 · <kbd>W</kbd> 上阵/下阵 · <kbd>空格</kbd> 立即开战 · 右键商店卡牌查看技能</p></div>', 'help');
    if (fromPause) el.modal.querySelector('.close-x').onclick = () => { closeModal(); openPause(); };
  }

  /* ---------- 游戏事件 ---------- */
  U.roundStart = function (R) {
    hideTip();
    if (S.mode === 'pve') {
      const boss = { tyrant: '暴君', overlord: '主宰', storm: '风暴龙王' }[R.pve];
      U.banner(R.label, boss ? '首领来袭 · ' + boss : R.pve === 'shadow' ? '暗影军团来袭' : '暗影小兵', boss ? 'blue' : '');
      return;
    }
    if (R.round === 1) U.banner('第' + '一二三四五六七八九'[R.stage - 1] + '阶段', R.label + (R.pve ? ' · 野怪回合' : ''), '');
    else if (R.pve && R.stage > 1) U.banner({ tyrant: '暴君', overlord: '主宰', storm: '风暴龙王' }[R.pve], '首领回合 · 击败它获取稀有装备', 'blue');
    if (S.lastIncome && S.ri > 0) { const i = S.lastIncome; U.toast('收入 +' + (i.base + i.interest + i.streak + i.sal) + '（基础 ' + i.base + ' · 利息 ' + i.interest + (i.streak ? ' · 连胜/败 ' + i.streak : '') + (i.sal ? ' · 俸禄 ' + i.sal : '') + '）'); }
  };
  U.combatStart = function () { U.hideUnit(); renderTraits(); };
  U.combatEnd = function (res) {
    const R = S.round;
    let sub = '';
    if (res.loot && (res.loot.gold || res.loot.comps || res.loot.full || res.loot.hero)) {
      const L = res.loot, parts = [];
      if (L.gold) parts.push(L.gold + ' 金币'); if (L.comps) parts.push(L.comps + ' 件基础装备'); if (L.full) parts.push(L.full + ' 件成品装备'); if (L.hero) parts.push('1 位四费英雄');
      sub = '战利品：' + parts.join('、');
    }
    if (res.won) U.banner(R.pve ? '击破' : '胜利', sub || (res.oppDmg ? '对手损失 ' + res.oppDmg + ' 生命' : ''), '');
    else U.banner(res.draw ? '平局' : '失败', '-' + res.dmg + ' 生命' + (sub ? ' · ' + sub : ''), 'lose');
    R.res = res.won ? 'win' : 'lose';
    U.refresh();
  };
  U.starUp = function (u) {
    const h = G.HEROES[u.hid];
    U.toast('★'.repeat(u.star) + ' ' + h.name + ' 升至 ' + u.star + ' 星');
    const me = S.me;
    let p = null;
    if (me.board.indexOf(u) >= 0) p = G.render.cellXY(u.c, u.r); else { const i = me.bench.indexOf(u); if (i >= 0) p = G.render.benchXY(i); }
    if (p && G.render.burst) G.render.burst(p.x, p.y - 30, u.star === 3 ? '#FFD65A' : '#DDE6F0', u.star === 3 ? 60 : 30);
  };
  U.levelUp = function (lv) { U.toast('升到 ' + lv + ' 级！可上阵 ' + lv + ' 名英雄'); };
  U.gameOver = function (o) {
    const me = S.me;
    const place = o.place;
    const pve = o.mode === 'pve';
    const title = pve ? (o.pveClear ? '挑战成功' : '挑战失败') : '第' + '一二三四五六七八'[place - 1] + '名';
    const sub = pve ? (o.pveClear ? '风暴龙王已被击败，峡谷重归宁静' : '倒在了第 ' + S.round.wave + ' 关') : place === 1 ? '登顶王者！峡谷荣光由你守护' : place <= 4 ? '稳进前四，表现出色' : '胜败乃兵家常事，再来一局';
    const pts = pve ? (o.pveClear ? '获得 龙鳞 ×12、风暴精华 ×3' : '获得 龙鳞 ×' + Math.max(1, S.round.wave - 1)) : '王者积分 ' + ([0, 40, 30, 20, 10, -5, -10, -15, -20][place] >= 0 ? '+' : '') + [0, 40, 30, 20, 10, -5, -10, -15, -20][place];
    const lineup = me.board.concat(me.bench.filter(Boolean)).slice(0, 12);
    openModal('<div class="mbox over"><div class="place ' + ((pve ? !o.pveClear : place > 4) ? 'low' : '') + '">' + title + '</div><div class="msub" style="margin-top:8px">' + sub + '</div>'
      + '<div class="stats"><div><b>' + S.stats.rounds + '</b>存活回合</div><div><b>' + Math.round(S.stats.dmgDealt / 1000) + 'k</b>造成伤害</div><div><b>' + me.level + '</b>最终等级</div><div><b>' + '★'.repeat(S.stats.maxStar) + '</b>最高星级</div></div>'
      + '<div class="lineup">' + lineup.map(u => '<div><img alt="" src="' + A.portrait(u.hid, 52, 52) + '" style="border-color:' + G.COST_COLORS[G.HEROES[u.hid].cost] + '"><span>' + '★'.repeat(u.star) + '</span></div>').join('') + '</div>'
      + '<div class="reward">' + pts + '</div><div class="mrow"><button class="mbtn2 gold" id="oAgain">再来一局</button><button class="mbtn2" id="oHome">返回主页</button></div></div>', 'over');
    $('oAgain').onclick = () => startGame(o.mode);
    $('oHome').onclick = () => U.showMenu();
  };
})(window.G);
