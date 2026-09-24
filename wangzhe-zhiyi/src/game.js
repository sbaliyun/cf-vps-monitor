'use strict';
/* 王者之弈 · 对局逻辑：商店、经济、升星、装备、回合、机器人 */
(function (G) {
  const S = G.S = { phase: 'menu' };
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  G.util = { rnd, pick, shuffle };
  let UID = 1;
  const ui = (fn, ...a) => G.ui && G.ui[fn] && G.ui[fn](...a);
  const sfx = n => G.audio && G.audio.play(n);
  const FRONT_COLS = [3, 2, 4, 1, 5, 0, 6];

  /* ---------- 玩家 ---------- */
  function newPlayer(name, human, avatar, style) {
    return {
      id: UID++, name, human, avatar, style, hp: 100, gold: 0, level: 1, xp: 0,
      board: [], bench: new Array(G.BENCH).fill(null), items: [], limbo: [],
      streak: 0, alive: true, place: 0, augs: [], shop: [], locked: false, freeRolls: 0,
      lastOpp: null, recent: [], wins: 0, losses: 0
    };
  }
  G.newUnit = (hid, star) => ({ uid: UID++, hid, star: star || 1, items: [] });
  function allUnits(p) { return p.board.concat(p.bench.filter(Boolean), p.limbo); }
  G.allUnits = allUnits;

  /* ---------- 卡池与商店 ---------- */
  function initPool() {
    S.pool = {};
    for (const h of G.HERO_LIST) S.pool[h.id] = G.POOL_SIZE[h.cost];
  }
  function drawHero(level) {
    const odds = G.SHOP_ODDS[Math.min(level, 10)];
    let r = Math.random() * 100, cost = 1;
    for (let i = 0; i < 5; i++) { if (r < odds[i]) { cost = i + 1; break; } r -= odds[i]; }
    for (let c = cost; c >= 1; c--) {
      const cands = G.HERO_LIST.filter(h => h.cost === c && S.pool[h.id] > 0);
      let tot = 0; for (const h of cands) tot += S.pool[h.id];
      if (!tot) continue;
      let x = Math.random() * tot;
      for (const h of cands) { x -= S.pool[h.id]; if (x < 0) { S.pool[h.id]--; return h.id; } }
    }
    return null;
  }
  function returnShop(p) { for (const h of p.shop) if (h) S.pool[h]++; p.shop = []; }
  function rollShop(p) { returnShop(p); for (let i = 0; i < 5; i++) p.shop.push(drawHero(p.level)); }
  function takeFromPool(hid, n) { const k = Math.min(n, S.pool[hid]); S.pool[hid] -= k; return k; }
  function returnUnitToPool(u) { S.pool[u.hid] = (S.pool[u.hid] || 0) + Math.pow(3, u.star - 1); }

  /* ---------- 升星合成 ---------- */
  function merge(p) {
    const ups = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (let star = 1; star <= 2; star++) {
        const groups = {};
        for (const u of p.board) if (u.star === star) (groups[u.hid] = groups[u.hid] || []).push(u);
        for (const u of p.bench) if (u && u.star === star) (groups[u.hid] = groups[u.hid] || []).push(u);
        for (const u of p.limbo) if (u.star === star) (groups[u.hid] = groups[u.hid] || []).push(u);
        for (const hid in groups) {
          const g = groups[hid];
          if (g.length < 3) continue;
          const [keep, a, b] = g;
          const extra = a.items.concat(b.items);
          removeUnit(p, a); removeUnit(p, b);
          keep.star++;
          for (const it of extra) { if (keep.items.length < 3) keep.items.push(it); else p.items.push(it); }
          ups.push(keep);
          changed = true;
          break;
        }
        if (changed) break;
      }
    }
    // limbo 中的单位放回备战席
    for (const u of p.limbo.slice()) {
      const i = p.bench.indexOf(null);
      if (i >= 0) { p.bench[i] = u; p.limbo.splice(p.limbo.indexOf(u), 1); }
    }
    if (p.human && ups.length) {
      for (const u of ups) { sfx(u.star === 3 ? 'star3' : 'star2'); ui('starUp', u); }
    }
    return ups;
  }
  function removeUnit(p, u) {
    let i = p.board.indexOf(u); if (i >= 0) { p.board.splice(i, 1); return; }
    i = p.bench.indexOf(u); if (i >= 0) { p.bench[i] = null; return; }
    i = p.limbo.indexOf(u); if (i >= 0) p.limbo.splice(i, 1);
  }
  G.removeUnit = removeUnit;

  function countCopies(p, hid, star) { return allUnits(p).filter(u => u.hid === hid && u.star === star).length; }

  /* ---------- 玩家操作 ---------- */
  const A = G.act = {};
  A.buy = function (p, i) {
    const hid = p.shop[i]; if (!hid) return false;
    const cost = G.HEROES[hid].cost;
    if (p.gold < cost) { if (p.human) { ui('toast', '金币不足'); sfx('error'); } return false; }
    const free = p.bench.indexOf(null);
    if (free < 0 && countCopies(p, hid, 1) < 2) { if (p.human) { ui('toast', '备战席已满'); sfx('error'); } return false; }
    p.gold -= cost; p.shop[i] = null;
    const u = G.newUnit(hid, 1);
    if (free >= 0) p.bench[free] = u; else p.limbo.push(u);
    merge(p);
    if (p.human) { sfx('buy'); ui('refresh'); ui('tip', 'drag', '把英雄从备战席拖到棋盘上，他们才会出战。'); }
    return true;
  };
  A.sellValue = u => { const c = G.HEROES[u.hid].cost; return c * Math.pow(3, u.star - 1) - (u.star > 1 && c > 1 ? 1 : 0); };
  A.sell = function (p, u) {
    if (S.phase === 'combat' && p.board.indexOf(u) >= 0) return false;
    removeUnit(p, u);
    p.gold += A.sellValue(u);
    returnUnitToPool(u);
    for (const it of u.items) p.items.push(it);
    if (p.human) { sfx('sell'); ui('refresh'); }
    return true;
  };
  A.reroll = function (p) {
    if (p.freeRolls > 0) p.freeRolls--;
    else { if (p.gold < 2) { if (p.human) { ui('toast', '金币不足'); sfx('error'); } return false; } p.gold -= 2; }
    rollShop(p);
    if (p.human) { sfx('refresh'); ui('refresh'); ui('shopAnim'); }
    return true;
  };
  A.addXP = function (p, n) {
    if (p.level >= G.MAX_LEVEL) return;
    p.xp += n;
    let up = false;
    while (p.level < G.MAX_LEVEL && p.xp >= G.XP_NEED[p.level]) { p.xp -= G.XP_NEED[p.level]; p.level++; up = true; }
    if (p.level >= G.MAX_LEVEL) p.xp = 0;
    if (up && p.human) { sfx('levelup'); ui('levelUp', p.level); }
  };
  A.buyXP = function (p) {
    if (p.level >= G.MAX_LEVEL) return false;
    if (p.gold < 4) { if (p.human) { ui('toast', '金币不足'); sfx('error'); } return false; }
    p.gold -= 4; A.addXP(p, 4);
    if (p.human) { sfx('xp'); ui('refresh'); }
    return true;
  };
  A.toggleLock = function (p) { p.locked = !p.locked; sfx('click'); ui('refresh'); };

  // 移动：dest = {type:'board',c,r} | {type:'bench',i}
  A.move = function (p, u, dest) {
    const onBoard = p.board.indexOf(u) >= 0;
    if (S.phase === 'combat' && (onBoard || dest.type === 'board')) { if (p.human) ui('toast', '战斗中无法调整棋盘'); return false; }
    if (dest.type === 'board') {
      if (dest.r < 4 || dest.r > 7) return false;
      const other = p.board.find(x => x.c === dest.c && x.r === dest.r);
      if (other === u) return false;
      if (onBoard) {
        if (other) { other.c = u.c; other.r = u.r; }
        u.c = dest.c; u.r = dest.r;
      } else {
        const bi = p.bench.indexOf(u);
        if (other) {
          p.board.splice(p.board.indexOf(other), 1);
          delete other.c; delete other.r;
          p.bench[bi] = other;
        } else {
          if (p.board.length >= p.level) { if (p.human) { ui('toast', '人口已满，升级可以上阵更多英雄'); sfx('error'); } return false; }
          p.bench[bi] = null;
        }
        u.c = dest.c; u.r = dest.r; p.board.push(u);
      }
    } else {
      const other = p.bench[dest.i];
      if (other === u) return false;
      if (onBoard) {
        p.board.splice(p.board.indexOf(u), 1);
        if (other) { other.c = u.c; other.r = u.r; p.board.push(other); }
        delete u.c; delete u.r;
        p.bench[dest.i] = u;
      } else {
        const bi = p.bench.indexOf(u);
        p.bench[bi] = other; p.bench[dest.i] = u;
      }
    }
    if (p.human) { sfx('place'); ui('refresh'); }
    return true;
  };
  // 装备：返回 true 成功
  A.equip = function (p, itemIdx, u) {
    const id = p.items[itemIdx]; if (!id || !u) return false;
    const it = G.ITEMS[id];
    if (it.comp) {
      const ci = u.items.findIndex(x => G.ITEMS[x].comp);
      if (ci >= 0) {
        const full = G.COMBO[u.items[ci] + '+' + id];
        u.items[ci] = full; p.items.splice(itemIdx, 1);
        if (p.human) { sfx('combine'); ui('toast', '合成 ' + G.ITEMS[full].name); ui('refresh'); }
        return true;
      }
    }
    if (u.items.length >= 3) { if (p.human) { ui('toast', '每名英雄最多携带 3 件装备'); sfx('error'); } return false; }
    u.items.push(id); p.items.splice(itemIdx, 1);
    if (p.human) { sfx('equip'); ui('refresh'); }
    return true;
  };

  /* ---------- 自动布阵 ---------- */
  function isRanged(hid) { const h = G.HEROES[hid] || G.MONSTERS[hid]; return h.range >= 2; }
  function isAssassin(hid) { const h = G.HEROES[hid]; return h && h.traits.indexOf('assassin') >= 0; }
  function freeCellFor(board, hid) {
    const taken = (c, r) => board.some(x => x.c === c && x.r === r);
    const rows = isAssassin(hid) ? [7, 6, 5, 4] : isRanged(hid) ? [7, 6, 5, 4] : [4, 5, 6, 7];
    const cols = isAssassin(hid) ? [0, 6, 1, 5, 2, 4, 3] : FRONT_COLS;
    for (const r of rows) for (const c of cols) if (!taken(c, r)) return [c, r];
    return null;
  }
  function autoPosition(units) {
    const b = [];
    const order = units.slice().sort((x, y) => (isRanged(x.hid) ? 1 : 0) - (isRanged(y.hid) ? 1 : 0));
    for (const u of order) { const cell = freeCellFor(b, u.hid); u.c = cell[0]; u.r = cell[1]; b.push(u); }
    return b;
  }
  G.autoPosition = autoPosition;
  function unitValue(u, p) {
    const h = G.HEROES[u.hid];
    let v = h.cost * Math.pow(3, u.star - 1) + u.items.length * 2;
    if (p && p.style) for (const t of h.traits) if (p.style.traits.indexOf(t) >= 0) v *= 1.35;
    return v;
  }
  function autoFill(p) {
    let moved = false;
    while (p.board.length < p.level) {
      const cands = p.bench.filter(Boolean).sort((a, b) => unitValue(b, p) - unitValue(a, p));
      if (!cands.length) break;
      const u = cands[0];
      const cell = freeCellFor(p.board, u.hid); if (!cell) break;
      p.bench[p.bench.indexOf(u)] = null; u.c = cell[0]; u.r = cell[1]; p.board.push(u);
      moved = true;
    }
    return moved;
  }

  /* ---------- 回合表 ---------- */
  function buildSchedule(mode) {
    const s = [];
    if (mode === 'pve') {
      const W = [
        { pve: 'w1' }, { pve: 'w2', aug: 1 }, { pve: 'golems' }, { pve: 'shadow', n: 4, star: 1, ev: 1 }, { pve: 'shadow', n: 5, star: 1.4 },
        { pve: 'tyrant', aug: 2 }, { pve: 'shadow', n: 6, star: 1.7 }, { pve: 'shadow', n: 6, star: 2, items: 1, ev: 1 },
        { pve: 'overlord', aug: 3 }, { pve: 'shadow', n: 7, star: 1.9, items: 1 }, { pve: 'shadow', n: 8, star: 2.1, items: 2, ev: 1 },
        { pve: 'storm', mult: 1.2, final: 1 }
      ];
      W.forEach((w, i) => s.push(Object.assign({ stage: Math.floor(i / 4) + 1, round: i % 4 + 1, label: '第 ' + (i + 1) + ' 关', wave: i + 1 }, w)));
      return s;
    }
    const st1 = [{ pve: 'w1' }, { pve: 'w2' }, { pve: 'w3' }, { pve: 'golems' }];
    st1.forEach((w, i) => s.push(Object.assign({ stage: 1, round: i + 1 }, w)));
    for (let st = 2; st <= 9; st++) {
      for (let r = 1; r <= 6; r++) {
        const e = { stage: st, round: r };
        if (r === 6) {
          e.pve = st === 2 ? 'tyrant' : st === 3 ? 'overlord' : 'storm';
          if (st > 4) e.mult = 1 + (st - 4) * 0.55;
        }
        if ((st === 2 && r === 1) || (st === 3 && r === 2) || (st === 4 && r === 2)) e.aug = st - 1;
        if (r === 4) e.ev = 1;
        s.push(e);
      }
    }
    s.forEach(e => { if (!e.label) e.label = e.stage + '-' + e.round; });
    return s;
  }

  /* ---------- 野怪阵容 ---------- */
  function monsterTeam(r) {
    const M = (hid, c, rr, extra) => Object.assign({ hid, star: 1, c, r: rr, items: [] }, extra || {});
    const mult = r.mult || 1;
    switch (r.pve) {
      case 'w1': return [M('minion', 2, 3), M('minion', 4, 3)];
      case 'w2': return [M('minion', 2, 3), M('minion', 4, 3), M('caster', 3, 1)];
      case 'w3': return [M('minion', 1, 3), M('minion', 3, 3), M('minion', 5, 3), M('caster', 2, 1), M('caster', 4, 1)];
      case 'golems': return [M('golem', 2, 3, { mult: 0.75 }), M('golemR', 4, 3, { mult: 0.75 }), M('caster', 3, 1)];
      case 'tyrant': return [M('tyrant', 3, 2, { mult }), M('minion', 1, 3), M('minion', 5, 3)];
      case 'overlord': return [M('overlord', 3, 2, { mult }), M('cannon', 1, 1), M('cannon', 5, 1), M('caster', 2, 1), M('caster', 4, 1)];
      case 'storm': return [M('storm', 3, 2, { mult }), M('dragonling', 1, 3, { mult }), M('dragonling', 5, 3, { mult })];
      case 'shadow': return shadowTeam(r);
    }
    return [];
  }
  function shadowTeam(r) {
    const style = pick(G.BOT_STYLES);
    const maxCost = Math.min(5, 1 + Math.floor(r.wave / 2.4));
    const pool = G.HERO_LIST.filter(h => h.cost <= maxCost);
    const pref = shuffle(pool.filter(h => h.traits.some(t => style.traits.indexOf(t) >= 0)));
    const rest = shuffle(pool.filter(h => pref.indexOf(h) < 0));
    const chosen = pref.concat(rest).slice(0, r.n);
    const units = chosen.map(h => {
      let star = Math.floor(r.star); if (Math.random() < r.star - star) star++;
      star = Math.max(1, Math.min(3, star));
      const items = [];
      for (let i = 0; i < (r.items || 0); i++) if (Math.random() < 0.6) items.push(pick(G.FULL_ITEMS));
      return { hid: h.id, star, items, shadow: true };
    });
    autoPosition(units);
    return units.map(u => Object.assign(u, { c: 6 - u.c, r: 7 - u.r }));
  }
  function lootFor(r, won) {
    const L = { gold: 0, comps: 0, full: 0, hero: 0 };
    switch (r.pve) {
      case 'w1': L.comps = 1; L.gold = 1; break;
      case 'w2': L.comps = 1; L.gold = 2; break;
      case 'w3': L.comps = 1; L.gold = 3; break;
      case 'golems': L.comps = 2; break;
      case 'tyrant': L.full = 1; L.gold = 3; break;
      case 'overlord': L.full = 1; L.hero = 4; break;
      case 'storm': L.full = 2; L.gold = 5; break;
      case 'shadow': L.comps = 1; L.gold = 2; break;
    }
    if (!won) { if (r.stage === 1) { L.gold = 1; } else { L.gold = 2; L.comps = 0; } L.full = 0; L.hero = 0; }
    return L;
  }
  function giveLoot(p, L, mul) {
    mul = mul || 1;
    p.gold += L.gold * mul;
    for (let i = 0; i < L.comps * mul; i++) p.items.push(pick(G.COMPONENTS));
    for (let i = 0; i < L.full * mul; i++) p.items.push(pick(G.FULL_ITEMS));
    if (L.hero) {
      const cands = G.HERO_LIST.filter(h => h.cost === L.hero && S.pool[h.id] > 0);
      if (cands.length) { const h = pick(cands); takeFromPool(h.id, 1); giveUnit(p, h.id, 1); }
    }
  }
  function giveUnit(p, hid, star) {
    const u = G.newUnit(hid, star);
    const i = p.bench.indexOf(null);
    if (i >= 0) p.bench[i] = u; else p.limbo.push(u);
    merge(p);
    // 若仍无处安放，按价出售
    for (const x of p.limbo.slice()) { removeUnit(p, x); p.gold += A.sellValue(x); returnUnitToPool(x); }
    return u;
  }

  /* ---------- 新对局 ---------- */
  G.newGame = function (mode) {
    initPool();
    UID = 1;
    S.mode = mode;
    S.schedule = buildSchedule(mode);
    S.ri = -1;
    S.speed = S.speed || 1;
    S.log = [];
    S.stats = { rounds: 0, dmgDealt: 0, maxStar: 1 };
    const me = newPlayer('你', true, pick(['houyi', 'diaochan', 'hanxin', 'libai', 'change', 'zhaoyun']), null);
    S.me = me;
    S.players = [me];
    if (mode === 'pvp') {
      const names = shuffle(G.BOT_NAMES.slice());
      const styles = shuffle(G.BOT_STYLES.slice());
      for (let i = 0; i < 7; i++) {
        const st = styles[i % styles.length];
        const av = pick(G.HERO_LIST.filter(h => st.traits.some(t => h.traits.indexOf(t) >= 0))).id;
        const b = newPlayer(names[i], false, av, st);
        b.skill = 0.75 + Math.random() * 0.5;
        S.players.push(b);
      }
    }
    for (const p of S.players) {
      p.gold = mode === 'pve' ? 4 : 2;
      const h1 = drawStarter();
      giveUnit(p, h1, 1);
      if (p.human) { const u = p.bench[0]; p.bench[0] = null; u.c = 3; u.r = 4; p.board.push(u); }
    }
    S.phase = 'planning';
    nextRound();
  };
  function drawStarter() {
    const cands = G.HERO_LIST.filter(h => h.cost === 1 && S.pool[h.id] > 0);
    const h = pick(cands); S.pool[h.id]--; return h.id;
  }

  /* ---------- 回合推进 ---------- */
  function nextRound() {
    S.ri++;
    if (S.ri >= S.schedule.length) {
      const last = S.schedule[S.schedule.length - 1];
      if (S.mode === 'pve') S.schedule.push(Object.assign({}, last, { label: '龙王再战', mult: (last.mult || 1) * 1.05, res: null }));
      else S.schedule.push(Object.assign({}, S.schedule[S.schedule.length - 6], { label: '加时', res: null }));
    }
    const R = S.round = S.schedule[S.ri];
    S.stats.rounds++;
    const first = S.ri === 0;
    for (const p of S.players) {
      if (!p.alive) continue;
      if (!first) {
        income(p);
        A.addXP(p, 2 + (p.augs.indexOf('xp') >= 0 ? 1 : 0));
      }
      if (!p.locked || !p.shop.length) rollShop(p);
      p.freeRolls = p.augs.indexOf('freeroll') >= 0 ? 1 : 0;
    }
    // 机器人回合
    for (const p of S.players) if (!p.human && p.alive) botTurn(p);
    // 匹配
    S.opp = null;
    if (!R.pve) matchmake();
    S.timer = S.timerMax = first ? 25 : R.pve ? 22 : 30;
    S.phase = 'planning';
    S.battle = null;
    S.pendingChoice = null;
    if (R.aug) {
      S.pendingChoice = 'aug';
      for (const p of S.players) if (!p.human && p.alive) applyAug(p, pick(augChoices(R.aug)).id);
      S.timer += 20; S.timerMax = S.timer;
      ui('openAugments', augChoices(R.aug), R.aug);
    } else if (R.ev) {
      S.pendingChoice = 'ev';
      ui('openEvent', pick(G.EVENTS));
    }
    sfx('gong');
    ui('roundStart', R);
    ui('refresh');
    if (first) ui('tip', 'start', '欢迎来到王者之弈！购买英雄、拖上棋盘，凑齐同职业或同阵营触发羁绊。');
    if (R.pve && R.stage === 2) ui('tip', 'boss', '野怪回合：击败暴君、主宰和风暴龙王可获得稀有装备。');
  }
  function income(p) {
    const R = S.round;
    let g = R.stage === 1 && S.mode === 'pvp' ? [2, 2, 3, 4][R.round - 1] || 4 : 5;
    if (S.mode === 'pve' && R.wave <= 2) g = 3;
    const cap = p.augs.indexOf('interest') >= 0 ? 8 : 5;
    const interest = Math.min(cap, Math.floor(p.gold / 10));
    const s = Math.abs(p.streak);
    const streakG = R.stage >= 2 || S.mode === 'pve' ? (s >= 5 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0) : 0;
    const sal = p.augs.indexOf('salary') >= 0 ? 2 : 0;
    p.gold += g + interest + streakG + sal;
    if (p.human) S.lastIncome = { base: g, interest, streak: streakG, sal };
  }
  function matchmake() {
    const alive = S.players.filter(p => p.alive);
    const me = S.me;
    const others = alive.filter(p => p !== me);
    shuffle(others);
    others.sort((a, b) => (me.recent.indexOf(a.id) >= 0 ? 1 : 0) - (me.recent.indexOf(b.id) >= 0 ? 1 : 0));
    S.opp = others[0] || null;
    if (S.opp) { me.recent.push(S.opp.id); if (me.recent.length > Math.min(3, others.length - 1)) me.recent.shift(); }
  }

  /* ---------- 奇遇 ---------- */
  function augChoices(tierHint) {
    const tier = tierHint === 1 ? (Math.random() < 0.7 ? 1 : 2) : tierHint === 2 ? (Math.random() < 0.75 ? 2 : Math.random() < 0.5 ? 1 : 3) : (Math.random() < 0.55 ? 2 : 3);
    const me = S.me;
    const pool = G.AUGMENTS.filter(a => a.tier === tier && me.augs.indexOf(a.id) < 0);
    return shuffle(pool.slice()).slice(0, 3);
  }
  G.augChoices = augChoices;
  function applyAug(p, id) {
    p.augs.push(id);
    const comp = () => pick(G.COMPONENTS), full = () => pick(G.FULL_ITEMS);
    switch (id) {
      case 'rich': p.gold += 10; break;
      case 'bigrich': p.gold += 22; break;
      case 'xp': A.addXP(p, 6); break;
      case 'items2': p.items.push(comp(), comp()); break;
      case 'itemFull': p.items.push(full()); break;
      case 'itemBox': p.items.push(full(), full()); break;
      case 'freeroll': p.freeRolls = Math.max(p.freeRolls, 1); break;
      case 'recruit3': for (let i = 0; i < 2; i++) { const c = G.HERO_LIST.filter(h => h.cost === 3 && S.pool[h.id] > 0); if (c.length) { const h = pick(c); takeFromPool(h.id, 1); giveUnit(p, h.id, 1); } } break;
      case 'recruit4': { const c = G.HERO_LIST.filter(h => h.cost === 4 && S.pool[h.id] >= 3); if (c.length) { const h = pick(c); takeFromPool(h.id, 3); giveUnit(p, h.id, 2); } break; }
      case 'starup': {
        const c = p.board.filter(u => u.star === 1);
        if (c.length) { const u = pick(c); takeFromPool(u.hid, 2); u.star = 2; if (p.human) ui('starUp', u); merge(p); }
        break;
      }
    }
  }
  G.chooseAug = function (id) {
    applyAug(S.me, id);
    S.pendingChoice = null;
    sfx('augment');
    ui('refresh');
  };
  G.rerollAugs = function (tier) { return augChoices(tier); };

  /* ---------- 奇遇事件 ---------- */
  G.resolveEvent = function (ev, opt) {
    const p = S.me; let msg = '';
    if (opt.cost && p.gold < opt.cost) { ui('toast', '金币不足'); sfx('error'); return false; }
    if (opt.cost) p.gold -= opt.cost;
    switch (opt.fx) {
      case 'comp': { const it = pick(G.COMPONENTS); p.items.push(it); msg = '获得 ' + G.ITEMS[it].name; break; }
      case 'full': { const it = pick(G.FULL_ITEMS); p.items.push(it); msg = '获得 ' + G.ITEMS[it].name; break; }
      case 'bet1': if (Math.random() < 0.5) { p.gold += 12; msg = '赢了！获得 12 金币'; sfx('gold'); } else msg = '输了，5 金币打了水漂'; break;
      case 'bet2': if (Math.random() < 0.4) { p.gold += 28; msg = '大胜！获得 28 金币'; sfx('gold'); } else msg = '输了，10 金币打了水漂'; break;
      case 'hero': {
        const cost = Math.min(5, Math.max(1, Math.round(p.level / 2)));
        const c = G.HERO_LIST.filter(h => h.cost === cost && S.pool[h.id] > 0);
        if (c.length) { const h = pick(c); takeFromPool(h.id, 1); giveUnit(p, h.id, 1); msg = h.name + ' 加入了你的队伍'; }
        break;
      }
      case 'gold3': p.gold += 3; msg = '获得 3 金币'; break;
      case 'gold4': p.gold += 4; msg = '获得 4 金币'; break;
      case 'gold5': p.gold += 5; msg = '获得 5 金币'; break;
      case 'heal10': p.hp = Math.min(100, p.hp + 10); msg = '回复 10 生命'; break;
      case 'relic': { p.hp -= 8; const it = pick(G.FULL_ITEMS); p.items.push(it); msg = '失去 8 生命，获得 ' + G.ITEMS[it].name; if (p.hp <= 0) p.hp = 1; break; }
      case 'xp8': A.addXP(p, 8); msg = '获得 8 经验'; break;
      case 'pact': p.hp -= 10; p.gold += 15; if (p.hp <= 0) p.hp = 1; msg = '失去 10 生命，获得 15 金币'; break;
      case 'chest': {
        const r = Math.random();
        if (r < 0.35) { p.gold += 8; msg = '宝箱里有 8 金币'; }
        else if (r < 0.7) { const it = pick(G.COMPONENTS), it2 = pick(G.COMPONENTS); p.items.push(it, it2); msg = '获得 ' + G.ITEMS[it].name + '、' + G.ITEMS[it2].name; }
        else { const it = pick(G.FULL_ITEMS); p.items.push(it); msg = '获得 ' + G.ITEMS[it].name; }
        break;
      }
      default: msg = '';
    }
    S.pendingChoice = null;
    if (msg) ui('toast', msg);
    ui('refresh');
    return true;
  };

  /* ---------- 机器人 ---------- */
  function botTargetLevel(p) {
    const R = S.round, st = R.stage, r = R.round;
    const t = st * 10 + r;
    let lv = t >= 56 ? 9 : t >= 46 ? 8 : t >= 42 ? 7 : t >= 33 ? 6 : t >= 25 ? 5 : t >= 21 ? 4 : t >= 13 ? 3 : 2;
    if (p.hp < 35 && lv < 8) lv++;
    return lv;
  }
  function botWants(p, hid) {
    const h = G.HEROES[hid];
    if (countCopies(p, hid, 1) + countCopies(p, hid, 2) > 0) return 3;
    if (h.traits.some(t => p.style.traits.indexOf(t) >= 0)) return 2;
    if (h.cost >= 4 && p.level >= 7) return 2;
    if (allUnits(p).length < p.level + 1) return 1;
    return 0;
  }
  function botBuyFromShop(p, reserve) {
    for (let i = 0; i < 5; i++) {
      const hid = p.shop[i]; if (!hid) continue;
      const w = botWants(p, hid);
      if (w <= 0) continue;
      const cost = G.HEROES[hid].cost;
      if (p.gold - cost < (w >= 3 ? Math.min(reserve, 10) : reserve)) continue;
      if (p.bench.indexOf(null) < 0 && countCopies(p, hid, 1) < 2) botSellWorst(p);
      A.buy(p, i);
    }
  }
  function botSellWorst(p) {
    const b = p.bench.filter(Boolean);
    if (!b.length) return;
    b.sort((x, y) => unitValue(x, p) - unitValue(y, p));
    A.sell(p, b[0]);
  }
  function botTurn(p) {
    const target = botTargetLevel(p);
    const econ = p.hp > 50 ? 30 : p.hp > 30 ? 10 : 0;
    while (p.level < target && p.gold >= 4 + Math.min(econ, 10) * 0.5) A.buyXP(p);
    botBuyFromShop(p, econ);
    let rolls = 0;
    while (rolls < 10 && (p.gold > econ + 30 || (p.hp < 35 && p.gold >= 6) || (S.round.stage >= 5 && p.gold >= 20))) {
      A.reroll(p); rolls++;
      botBuyFromShop(p, Math.min(econ, p.hp < 40 ? 0 : econ));
    }
    // 布阵：选价值最高的 level 个
    const all = allUnits(p).filter(u => p.limbo.indexOf(u) < 0);
    all.sort((a, b) => unitValue(b, p) - unitValue(a, p));
    const onBoard = all.slice(0, p.level);
    const rest = all.slice(p.level);
    p.board = autoPosition(onBoard);
    p.bench = new Array(G.BENCH).fill(null);
    rest.slice(0, G.BENCH).forEach((u, i) => { delete u.c; delete u.r; p.bench[i] = u; });
    for (const u of rest.slice(G.BENCH)) { p.gold += A.sellValue(u); returnUnitToPool(u); }
    // 装备
    const carries = p.board.slice().sort((a, b) => unitValue(b, p) - unitValue(a, p));
    let guard = 0;
    while (p.items.length && carries.length && guard++ < 20) {
      const u = carries.find(x => x.items.length < 3 || (x.items.some(i => G.ITEMS[i].comp) && G.ITEMS[p.items[0]].comp));
      if (!u) break;
      if (!A.equip(p, 0, u)) break;
    }
  }

  G._botTurn = botTurn;
  /* ---------- 开战 ---------- */
  function teamOf(p, mirror) {
    return {
      units: p.board.map(u => ({ hid: u.hid, star: u.star, items: u.items, c: mirror ? 6 - u.c : u.c, r: mirror ? 7 - u.r : u.r })),
      mods: { traits: G.calcTraits(p.board, p.augs), augs: p.augs, playerHp: p.hp }
    };
  }
  G.startCombat = function () {
    if (S.phase !== 'planning') return;
    const me = S.me;
    if (autoFill(me)) ui('toast', '已自动补齐棋盘英雄');
    S.pendingChoice = null;
    ui('closeModals');
    const R = S.round;
    let enemy;
    if (R.pve) enemy = { units: monsterTeam(R), mods: {} };
    else if (S.opp) enemy = teamOf(S.opp, true);
    else enemy = { units: [], mods: {} };
    enemy.mods.buff = G.difficulty().mul;
    S.battle = new G.Battle(teamOf(me, false), enemy);
    S.phase = 'combat';
    sfx('battle');
    ui('combatStart');
    ui('refresh');
  };

  function survivorsDamage(battle, team) {
    let d = 0;
    for (const u of battle.units) if (!u.dead && u.team === team) d += u.hero ? u.star : (u.mon && u.mon.boss ? 3 : 1);
    return d;
  }
  function stageDmg() { return S.mode === 'pve' ? 4 + Math.ceil(S.round.wave * 0.6) : G.STAGE_DMG[Math.min(S.round.stage, 9)]; }
  function applyStreak(p, won) { if (won) { p.streak = p.streak > 0 ? p.streak + 1 : 1; p.wins++; } else { p.streak = p.streak < 0 ? p.streak - 1 : -1; p.losses++; } }

  function resolveCombat() {
    const b = S.battle, R = S.round, me = S.me;
    const won = b.winner === 0;
    const res = { won, dmg: 0, loot: null, draw: b.winner === -1 };
    // 统计
    for (const u of b.units) if (u.team === 0) S.stats.dmgDealt += u.dealt;
    for (const u of me.board) S.stats.maxStar = Math.max(S.stats.maxStar, u.star);
    if (R.pve) {
      if (!won) { res.dmg = Math.max(2, S.mode === 'pve' ? Math.ceil((stageDmg() + survivorsDamage(b, 1)) * 0.7) : stageDmg() + survivorsDamage(b, 1)); me.hp -= res.dmg; }
      const L = lootFor(R, won);
      giveLoot(me, L, me.augs.indexOf('dragoneye') >= 0 ? 2 : 1);
      res.loot = L;
      // 机器人野怪回合
      for (const p of S.players) if (!p.human && p.alive) {
        const pw = G.teamPower(p.board, p.augs) * (p.skill || 1);
        const need = { w1: 2, w2: 3, w3: 5, golems: 6, tyrant: 14, overlord: 24, storm: 34 * (R.mult || 1) }[R.pve] || 5;
        const bw = pw > need * (0.7 + Math.random() * 0.6);
        if (!bw && R.stage > 1) p.hp -= stageDmg() + 2;
        giveLoot(p, lootFor(R, bw), 1);
      }
    } else {
      const opp = S.opp;
      if (won) {
        me.gold += 1;
        if (opp) { const d = stageDmg() + survivorsDamage(b, 0); opp.hp -= d; applyStreak(opp, false); res.oppDmg = d; }
      } else {
        res.dmg = stageDmg() + (b.winner === -1 ? 1 : survivorsDamage(b, 1));
        me.hp -= res.dmg;
        if (opp) { applyStreak(opp, b.winner === 1); if (b.winner === 1) opp.gold += 1; }
      }
      applyStreak(me, won);
      // 其余机器人对战
      const rest = shuffle(S.players.filter(p => p.alive && p !== me && p !== opp));
      while (rest.length >= 2) botFight(rest.pop(), rest.pop());
      if (rest.length === 1) {
        const ghost = pick(S.players.filter(p => p.alive && p !== rest[0]));
        botFight(rest[0], ghost, true);
      }
    }
    if (me.hp < 0) me.hp = 0;
    // 淘汰
    const dying = S.players.filter(p => p.alive && p.hp <= 0).sort((a, c) => a.hp - c.hp);
    let aliveN = S.players.filter(p => p.alive).length;
    for (const p of dying) {
      p.alive = false; p.place = aliveN--;
      for (const u of allUnits(p)) returnUnitToPool(u);
      returnShop(p);
      if (!p.human) ui('toast', p.name + ' 被淘汰，第 ' + p.place + ' 名');
    }
    S.lastResult = res;
    S.log.push({ label: R.label, won, dmg: res.dmg, pve: !!R.pve, opp: S.opp ? S.opp.name : null });
    if (won) sfx('win'); else sfx('lose');
    ui('combatEnd', res);
    const alive = S.players.filter(p => p.alive);
    if (!me.alive) return endGame(me.place);
    if (S.mode === 'pvp' && alive.length === 1) { me.place = 1; return endGame(1); }
    if (S.mode === 'pve' && R.final && won) return endGame(1, true);
    S.phase = 'result'; S.resultT = 2.4;
    ui('refresh');
  }
  function botFight(a, c, ghost) {
    const pa = G.teamPower(a.board, a.augs) * (a.skill || 1) * (0.75 + Math.random() * 0.5);
    const pc = G.teamPower(c.board, c.augs) * (c.skill || 1) * (0.75 + Math.random() * 0.5);
    const [w, l, pw, pl] = pa >= pc ? [a, c, pa, pc] : [c, a, pc, pa];
    const margin = Math.max(0, (pw - pl) / Math.max(1, pw));
    const surv = Math.max(1, Math.round(w.board.length * (0.38 + margin * 0.8)));
    const avgStar = w.board.length ? w.board.reduce((s, u) => s + u.star, 0) / w.board.length : 1;
    if (!(ghost && l === c)) { l.hp -= stageDmg() + Math.round(surv * avgStar); applyStreak(l, false); }
    if (!(ghost && w === c)) { applyStreak(w, true); w.gold += 1; }
  }
  function endGame(place, pveClear) {
    S.phase = 'over';
    S.me.place = place;
    const rec = G.record.load();
    rec.games++;
    if (S.mode === 'pvp') {
      if (place === 1) rec.wins++;
      if (place <= 4) rec.top4++;
      rec.best = rec.best ? Math.min(rec.best, place) : place;
    } else if (pveClear) rec.pveClear++;
    G.record.save(rec);
    sfx(place <= 4 || pveClear ? 'victory' : 'defeat');
    ui('gameOver', { place, pveClear, mode: S.mode });
  }
  G.surrender = function () { if (S.phase === 'menu' || S.phase === 'over') return; const alive = S.players.filter(p => p.alive).length; S.me.alive = false; S.me.hp = 0; S.me.place = alive; endGame(alive); };

  /* ---------- 难度 ---------- */
  G.DIFFS = [{ id: 'easy', name: '休闲', mul: 0.85 }, { id: 'normal', name: '普通', mul: 1 }, { id: 'hard', name: '王者', mul: 1.12 }];
  G.difficulty = function () {
    let id = G._diff || 'normal';
    try { id = localStorage.getItem('wzzy_diff') || id; } catch (e) { /* ignore */ }
    return G.DIFFS.find(d => d.id === id) || G.DIFFS[1];
  };
  G.setDifficulty = function (id) { try { localStorage.setItem('wzzy_diff', id); } catch (e) { /* ignore */ } G._diff = id; };

  /* ---------- 记录 ---------- */
  G.record = {
    load() { try { return Object.assign({ games: 0, wins: 0, top4: 0, best: 0, pveClear: 0 }, JSON.parse(localStorage.getItem('wzzy_record') || '{}')); } catch (e) { return { games: 0, wins: 0, top4: 0, best: 0, pveClear: 0 }; } },
    save(r) { try { localStorage.setItem('wzzy_record', JSON.stringify(r)); } catch (e) { /* ignore */ } }
  };

  /* ---------- 帧更新 ---------- */
  G.tick = function (dt) {
    if (S.phase === 'planning') {
      S.timer -= dt;
      if (S.timer <= 0) { S.timer = 0; if (S.pendingChoice) ui('autoChoose'); G.startCombat(); }
    } else if (S.phase === 'combat') {
      const b = S.battle;
      const step = 1 / 60;
      b.acc = (b.acc || 0) + dt * S.speed;
      let n = 0;
      while (b.acc >= step && n++ < 8) { b.update(step); b.acc -= step; }
      if (b.over && b.postT > 1.3) resolveCombat();
    } else if (S.phase === 'result') {
      S.resultT -= dt;
      if (S.resultT <= 0) nextRound();
    }
  };
})(window.G);
