'use strict';
/* 王者之弈 · 战斗模拟 */
(function (G) {
  const COLS = G.COLS, ROWS = G.ROWS;
  /* ---------- 六边形 ---------- */
  const HX = G.hex = {
    cube(c, r) { const x = c - (r - (r & 1)) / 2; return [x, -x - r, r]; },
    dist(c1, r1, c2, r2) {
      const a = HX.cube(c1, r1), b = HX.cube(c2, r2);
      return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
    },
    nb(c, r) {
      const o = (r & 1) ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]] : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
      const out = [];
      for (const [dc, dr] of o) { const nc = c + dc, nr = r + dr; if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) out.push([nc, nr]); }
      return out;
    },
    pos(c, r) { return { x: c + 0.5 * (r & 1), y: r * 0.866 }; }
  };

  /* ---------- 羁绊计算 ---------- */
  G.calcTraits = function (units, augs) {
    const seen = {}, counts = {};
    for (const u of units) {
      const h = G.HEROES[u.hid]; if (!h || seen[u.hid]) continue;
      seen[u.hid] = 1;
      for (const t of h.traits) counts[t] = (counts[t] || 0) + 1;
    }
    for (const a of (augs || [])) { const ag = G.AUGMENTS.find(x => x.id === a); if (ag && ag.emb && counts[ag.emb]) counts[ag.emb]++; }
    const tiers = {};
    for (const t in counts) { const br = G.TRAITS[t].breaks; let k = 0; while (k < br.length && counts[t] >= br[k]) k++; tiers[t] = k; }
    return { counts, tiers };
  };

  const STAR_M = [1, 1.8, 3.24];
  let UID = 1;

  function Battle(A, Bt, opts) {
    this.opts = opts || {};
    this.t = 0; this.units = []; this.fx = []; this.proj = []; this.texts = []; this.timers = [];
    this.grid = new Array(COLS * ROWS).fill(null);
    this.over = false; this.winner = -1; this.shake = 0; this.events = [];
    this.teams = [A, Bt];
    A.units.forEach(s => this.spawn(s, 0, A.mods || {}));
    Bt.units.forEach(s => this.spawn(s, 1, Bt.mods || {}));
    this.startEffects();
  }
  G.Battle = Battle;
  const BP = Battle.prototype;

  BP.idx = (c, r) => r * COLS + c;
  BP.at = function (c, r) { return this.grid[r * COLS + c]; };

  BP.spawn = function (s, team, mods) {
    const h = G.HEROES[s.hid], m = G.MONSTERS[s.hid];
    const base = h || m;
    const star = s.star || 1, sm = STAR_M[star - 1] * (s.mult || 1);
    const u = {
      id: UID++, hid: s.hid, hero: h, mon: m, team, star, items: (s.items || []).slice(),
      c: s.c, r: s.r, shadow: !!s.shadow,
      maxHp: base.hp * sm, ad: base.ad * sm, as: base.as, range: base.range, armor: base.armor, mr: base.mr,
      manaMax: h ? h.mana : (m.mana || 0), mana: h ? (h.sm || 0) : 0, ap: 100, crit: 0.15, critD: 1.5,
      asBonus: 0, omni: 0, physVamp: 0, spellVamp: 0, dmgAmp: 1, dmgRed: 0,
      atkCd: 0.2 + Math.random() * 0.3, target: null, dead: false, stun: 0, air: 0, castT: 0, pending: null,
      shields: [], buffs: [], dots: [], invuln: 0, untarget: 0, dodgeAtk: 0, ccImmune: 0, slowT: 0, slowAmt: 0, shredT: 0,
      it: {}, atkCount: 0, stacks: 0, shen: 0, shenVal: 0, flags: {}, kills: 0, dealt: 0, taken: 0, healed: 0,
      anim: { atk: 0, flash: 0, cast: 0, face: team === 0 ? 1 : -1, bob: Math.random() * 6 },
      jump: null, moving: null, tie: Math.random() * 0.1, regen: 0, tick1: 0, tick2: 0, tick3: 0,
      powerMul: s.mult || 1, summonMult: s.mult || 1, lift: 0, hop: 0
    };
    if (m && m.boss) { u.boss = m.boss; u.manaMax = m.skill === 'storm' ? 70 : (m.skill === 'overlord' ? 90 : 80); }
    if (h && h.traits.indexOf('assassin') >= 0) { u.crit = 0.25; u.leap = true; }
    // 装备
    for (const id of u.items) {
      const it = G.ITEMS[id]; if (!it) continue;
      u.it[id] = (u.it[id] || 0) + 1;
      const st = it.s || {};
      if (st.hp) u.maxHp += st.hp; if (st.ad) u.ad += st.ad; if (st.as) u.asBonus += st.as; if (st.ap) u.ap += st.ap;
      if (st.armor) u.armor += st.armor; if (st.mr) u.mr += st.mr; if (st.mana) u.mana += st.mana;
      if (st.crit) u.crit += st.crit / 100; if (st.critd) u.critD += st.critd / 100;
    }
    if (u.it.zhuri) u.range += 1;
    if (u.it.qixue) u.physVamp += 0.25;
    if (u.it.shishen) u.spellVamp += 0.25;
    // 羁绊
    const tr = mods.traits || { tiers: {} };
    if (h) {
      for (const t of h.traits) {
        const k = tr.tiers[t] || 0; if (!k) continue;
        const v = G.TRAITS[t].vals[k - 1];
        switch (t) {
          case 'warrior': u.maxHp += v; break;
          case 'mage': u.ap += v; break;
          case 'hunter': u.asBonus += v[0]; u.hunterExec = v[1] / 100; break;
          case 'assassin': u.crit += v[0] / 100; u.critD += v[1] / 100; break;
          case 'changan': u.dmgAmp *= 1 + v / 100; break;
          case 'sanfen': u.omni += v / 100; break;
          case 'jixia': u.jixia = v; break;
          case 'changcheng': u.armor += v; u.mr += v; break;
          case 'chuhan': u.chuhan = v; break;
          case 'shenhua': u.shenVal = v; break;
        }
      }
    }
    // 奇遇
    const augs = mods.augs || [];
    const has = a => augs.indexOf(a) >= 0;
    if (has('power')) { u.ad *= 1.12; u.ap += 12; }
    if (has('kingpower')) { u.ad *= 1.25; u.ap += 25; u.asBonus += 15; }
    if (has('vital')) u.maxHp += 180;
    if (has('haste')) u.asBonus += 15;
    if (has('crit')) u.crit += 0.15;
    if (has('thorns')) { u.armor += 25; u.mr += 25; }
    if (has('mana')) u.mana += 20;
    if (has('regen')) u.regen += 0.015;
    if (has('vamp')) u.omni += 0.15;
    if (has('execute')) u.execute = true;
    if (has('lastStand')) u.dmgAmp *= 1 + Math.floor((100 - (mods.playerHp || 100)) / 10) * 0.03;
    if (mods.buff) { u.maxHp *= mods.buff; u.ad *= mods.buff; }
    u.hp = u.maxHp;
    u.mana = Math.min(u.mana, u.manaMax || 0);
    const p = HX.pos(u.c, u.r); u.x = p.x; u.y = p.y;
    this.units.push(u);
    this.grid[this.idx(u.c, u.r)] = u;
    return u;
  };

  BP.startEffects = function () {
    for (let team = 0; team < 2; team++) {
      const mods = this.teams[team].mods || {};
      const tr = mods.traits || { tiers: {} };
      const allies = this.units.filter(u => u.team === team);
      const sup = tr.tiers.support || 0;
      if (sup) { const v = G.TRAITS.support.vals[sup - 1]; for (const a of allies) { this.shield(a, v[0], 8); a.mana = Math.min(a.manaMax, a.mana + v[1]); } }
      if ((mods.augs || []).indexOf('shieldAll') >= 0) for (const a of allies) this.shield(a, 300, 8);
    }
    for (const u of this.units) {
      if (u.it.monv) this.shield(u, 450 * u.it.monv, 99);
      if (u.it.jinwei) { this.shield(u, 250, 99); for (const a of this.allies(u)) if (a !== u && HX.dist(a.c, a.r, u.c, u.r) <= 1) this.shield(a, 250, 99); }
      if (u.it.jihan) for (const e of this.enemies(u)) if (HX.dist(e.c, e.r, u.c, u.r) <= 2) { e.slowT = 6; e.slowAmt = 0.3; }
    }
  };

  /* ---------- 查询 ---------- */
  BP.enemies = function (u) { return this.units.filter(e => e.team !== u.team && !e.dead); };
  BP.allies = function (u) { return this.units.filter(e => e.team === u.team && !e.dead); };
  BP.valid = function (e) { return e && !e.dead && e.untarget <= 0; };
  BP.d = function (a, b) { return HX.dist(a.c, a.r, b.c, b.r); };
  BP.nearest = function (u) {
    let best = null, bd = 1e9;
    for (const e of this.units) { if (e.team === u.team || !this.valid(e)) continue; const d = this.d(u, e) + e.tie; if (d < bd) { bd = d; best = e; } }
    return best;
  };
  BP.lowest = function (u) {
    let best = null, bv = 1e9;
    for (const e of this.units) { if (e.team === u.team || !this.valid(e)) continue; if (e.hp < bv) { bv = e.hp; best = e; } }
    return best;
  };
  BP.farthest = function (u) {
    let best = null, bd = -1;
    for (const e of this.units) { if (e.team === u.team || !this.valid(e)) continue; const d = this.d(u, e) + e.tie; if (d > bd) { bd = d; best = e; } }
    return best;
  };
  BP.inRadius = function (c, r, rad, team) {
    return this.units.filter(e => !e.dead && (team === undefined || e.team === team) && HX.dist(c, r, e.c, e.r) <= rad);
  };
  BP.densest = function (u, rad) {
    let best = null, bn = -1;
    for (const e of this.enemies(u)) {
      const n = this.inRadius(e.c, e.r, rad, e.team).length;
      if (n > bn) { bn = n; best = e; }
    }
    return best;
  };
  BP.freeNear = function (c, r, exclude) {
    const seen = new Set([c + ',' + r]); let q = [[c, r]];
    while (q.length) {
      const nq = [];
      for (const [qc, qr] of q) {
        for (const [nc, nr] of HX.nb(qc, qr)) {
          const k = nc + ',' + nr; if (seen.has(k)) continue; seen.add(k);
          const o = this.at(nc, nr);
          if (!o || o === exclude) return [nc, nr];
          nq.push([nc, nr]);
        }
      }
      q = nq;
    }
    return null;
  };

  /* ---------- 状态 ---------- */
  BP.text = function (x, y, s, color, size, opt) {
    this.texts.push(Object.assign({ x: x + (Math.random() - 0.5) * 0.3, y, s: String(s), color, size: size || 15, t: 0, dur: 0.9 }, opt || {}));
  };
  BP.addFx = function (type, o) { const f = Object.assign({ type, t: 0, dur: 0.5 }, o); this.fx.push(f); return f; };
  BP.later = function (dt, fn) { this.timers.push({ t: dt, fn }); };
  BP.shield = function (u, amt, dur) { if (u.dead) return; u.shields.push({ a: amt, t: dur }); };
  BP.shieldTotal = u => u.shields.reduce((s, x) => s + x.a, 0);
  BP.heal = function (u, amt) {
    if (u.dead || amt <= 0) return;
    const before = u.hp; u.hp = Math.min(u.maxHp, u.hp + amt);
    const got = u.hp - before; u.healed += got;
    u.healAcc = (u.healAcc || 0) + got;
    if (u.healAcc > 40) { this.text(u.x, u.y - 1.1, '+' + Math.round(u.healAcc), '#6BF08A', 13); u.healAcc = 0; }
  };
  BP.stun = function (u, dur) {
    if (u.dead || u.ccImmune > 0 || u.invuln > 0 && u.boss) return;
    if (u.boss === 2) dur *= 0.5;
    u.stun = Math.max(u.stun, dur);
    if (u.moving) this.finishMove(u);
    u.pending = null; u.castT = 0;
  };
  BP.knock = function (u, dur) { if (u.dead || u.ccImmune > 0) return; this.stun(u, dur); if (!u.boss) u.air = Math.max(u.air, dur); u.airDur = dur; };
  BP.buff = function (u, b, dur) { u.buffs.push(Object.assign({ t: dur }, b)); };
  BP.sumBuff = (u, k) => u.buffs.reduce((s, b) => s + (b[k] || 0), 0);
  BP.AS = function (u) {
    let a = u.as * (1 + (u.asBonus + this.sumBuff(u, 'as')) / 100);
    if (u.slowT > 0) a *= 1 - u.slowAmt;
    return Math.min(a, 4.5);
  };
  BP.AD = function (u) { return u.ad * (1 + (this.sumBuff(u, 'ad') + u.shen * u.shenVal) / 100); };
  BP.AP = function (u) { return u.ap + this.sumBuff(u, 'ap') + u.shen * u.shenVal; };
  BP.sp = function (u, v) { return v * this.AP(u) / 100; };

  /* ---------- 伤害 ---------- */
  BP.damage = function (src, tgt, amt, type, f) {
    f = f || {};
    if (!tgt || tgt.dead) return 0;
    if (tgt.invuln > 0) { if (Math.random() < 0.2) this.text(tgt.x, tgt.y - 1, '无敌', '#FFE27A', 12); return 0; }
    if (f.atk && tgt.dodgeAtk > 0) { if (Math.random() < 0.35) this.text(tgt.x, tgt.y - 1, '闪避', '#CFE3FF', 12); return 0; }
    let a = amt;
    if (src) {
      a *= src.dmgAmp;
      if (src.hunterExec && tgt.hp < tgt.maxHp * 0.5) a *= 1 + src.hunterExec;
      if (src.hid === 'houyi') a *= 1 + src.stacks * 0.03;
      if (f.skill && src.it.tongku && !f.echo && src.tongkuHit && !src.tongkuHit.has(tgt.id)) { src.tongkuHit.add(tgt.id); a += tgt.hp * 0.06; }
    }
    if (this.t > 30) a *= 1 + (this.t - 30) * 0.3;
    if (type === 'phys') { const ar = Math.max(0, tgt.armor * (tgt.shredT > 0 ? 0.7 : 1)); a *= 100 / (100 + ar); }
    else if (type === 'magic') { a *= 100 / (100 + Math.max(0, tgt.mr)); if (tgt.it.pomo) a *= 0.85; }
    a *= 1 - tgt.dmgRed;
    a = Math.max(1, a);
    // 受击回蓝
    if (tgt.manaMax > 0 && tgt.castT <= 0) tgt.mana = Math.min(tgt.manaMax, tgt.mana + Math.min(12, amt * 0.035));
    // 护盾
    let rem = a;
    for (const s of tgt.shields) { if (rem <= 0) break; const k = Math.min(s.a, rem); s.a -= k; rem -= k; }
    tgt.shields = tgt.shields.filter(s => s.a > 0.5);
    tgt.hp -= rem; tgt.taken += a;
    if (src) {
      src.dealt += a;
      if (src.execute && tgt.hp > 0 && tgt.hp < tgt.maxHp * 0.12 && !tgt.boss) { tgt.hp = 0; this.text(tgt.x, tgt.y - 1.3, '斩杀', '#FF5A4A', 18); }
      const v = src.omni + (type === 'phys' ? src.physVamp : 0) + (f.skill ? src.spellVamp : 0) + (f.atk && src.kaiT > 0 ? 0 : 0);
      if (v > 0 && !src.dead) this.heal(src, a * v);
    }
    tgt.anim.flash = 0.09;
    const col = type === 'phys' ? (f.crit ? '#FFB43A' : '#FFFFFF') : type === 'magic' ? '#C58CFF' : '#FFF6D0';
    if (a >= 3) this.text(tgt.x, tgt.y - 0.9, Math.round(a) + (f.crit ? '!' : ''), col, f.crit ? 20 : (a > 300 ? 18 : 14), { crit: f.crit });
    this.events.push({ k: 'hit', type, big: a > 250 });
    // 回响之杖
    if (src && f.skill && src.echoReady && !f.echo) {
      src.echoReady = false;
      this.addFx('ring', { x: tgt.x, y: tgt.y, r: 1.3, color: '#C58CFF', dur: 0.4 });
      for (const e of this.inRadius(tgt.c, tgt.r, 1, tgt.team)) this.damage(src, e, this.sp(src, 150), 'magic', { skill: true, echo: true });
    }
    // 阈值触发
    if (tgt.hp > 0) {
      const ratio = tgt.hp / tgt.maxHp;
      if (tgt.chuhan && !tgt.flags.chuhan && ratio < 0.5) {
        tgt.flags.chuhan = 1; this.shield(tgt, tgt.maxHp * tgt.chuhan / 100, 6); this.buff(tgt, { as: tgt.chuhan }, 5);
        this.text(tgt.x, tgt.y - 1.4, '背水', '#FF7A5A', 15); this.addFx('ring', { x: tgt.x, y: tgt.y, r: 0.9, color: '#FF7A5A', dur: 0.5 });
      }
      if (tgt.it.xuemo && !tgt.flags.xuemo && ratio < 0.4) { tgt.flags.xuemo = 1; this.shield(tgt, tgt.maxHp * 0.4, 5); this.text(tgt.x, tgt.y - 1.4, '血魔', '#FF4A5A', 14); }
      if (tgt.it.huiyue && !tgt.flags.huiyue && ratio < 0.4) { tgt.flags.huiyue = 1; tgt.invuln = 2; this.text(tgt.x, tgt.y - 1.4, '辉月', '#FFE27A', 15); this.addFx('ring', { x: tgt.x, y: tgt.y, r: 0.8, color: '#FFE27A', dur: 2 }); }
      if (tgt.boss === 2 && !tgt.flags.summon && ratio < 0.5) { tgt.flags.summon = 1; this.later(0.1, () => this.summonDragonlings(tgt)); }
    }
    if (tgt.hp <= 0) this.kill(tgt, src);
    return a;
  };

  BP.kill = function (u, src) {
    if (u.dead) return;
    if (u.it.mingdao && !u.flags.mingdao) { u.flags.mingdao = 1; u.hp = 1; u.invuln = 1.5; this.text(u.x, u.y - 1.4, '名刀·司命', '#FFE27A', 16); return; }
    if (u.it.xianzhe && !u.flags.xianzhe) {
      u.flags.xianzhe = 1; u.hp = u.maxHp * 0.4; u.invuln = 0.8; u.stun = 0.8;
      this.text(u.x, u.y - 1.4, '贤者复活', '#9FE3FF', 16); this.addFx('pillar', { x: u.x, y: u.y, color: '#9FE3FF', dur: 0.9 }); return;
    }
    u.dead = true; u.hp = 0; u.deadT = 0;
    if (this.grid[this.idx(u.c, u.r)] === u) this.grid[this.idx(u.c, u.r)] = null;
    if (u.moving && u.moving.to) { const k = this.idx(u.moving.to[0], u.moving.to[1]); if (this.grid[k] === u) this.grid[k] = null; }
    if (src) src.kills++;
    this.addFx('death', { x: u.x, y: u.y, color: u.team === 0 ? '#6FE0C8' : '#FF8A7A', dur: 0.8 });
    this.events.push({ k: 'death', team: u.team });
  };

  /* ---------- 移动 ---------- */
  BP.finishMove = function (u) {
    const m = u.moving; if (!m) return;
    const p = HX.pos(u.c, u.r); u.x = p.x; u.y = p.y; u.moving = null;
  };
  BP.path = function (u, goal) {
    // BFS：从 u 所在格到任意满足 goal 的空格，返回第一步
    const start = [u.c, u.r];
    const prev = new Map(); const sk = u.c + ',' + u.r; prev.set(sk, null);
    let q = [start];
    while (q.length) {
      const nq = [];
      for (const [c, r] of q) {
        for (const [nc, nr] of HX.nb(c, r)) {
          const k = nc + ',' + nr; if (prev.has(k)) continue;
          if (this.at(nc, nr)) { prev.set(k, 'x'); continue; }
          prev.set(k, c + ',' + r);
          if (goal(nc, nr)) {
            // 回溯
            let cur = k, p = prev.get(cur);
            while (p && p !== sk) { cur = p; p = prev.get(cur); }
            return cur.split(',').map(Number);
          }
          nq.push([nc, nr]);
        }
      }
      q = nq;
    }
    return null;
  };
  BP.moveTo = function (u, c, r, dur) {
    this.grid[this.idx(u.c, u.r)] = null;
    const from = HX.pos(u.c, u.r);
    u.c = c; u.r = r; this.grid[this.idx(c, r)] = u;
    const to = HX.pos(c, r);
    u.moving = { fx: from.x, fy: from.y, tx: to.x, ty: to.y, t: 0, dur: dur || 0.42, to: [c, r] };
    if (to.x !== from.x) u.anim.face = to.x > from.x ? 1 : -1;
  };
  BP.leapTo = function (u, c, r, dur, h) {
    if (u.moving) this.finishMove(u);
    this.grid[this.idx(u.c, u.r)] = null;
    const from = { x: u.x, y: u.y };
    u.c = c; u.r = r; this.grid[this.idx(c, r)] = u;
    const to = HX.pos(c, r);
    u.jump = { fx: from.x, fy: from.y, tx: to.x, ty: to.y, t: 0, dur: dur || 0.4, h: h || 1.2 };
    if (to.x !== from.x) u.anim.face = to.x > from.x ? 1 : -1;
  };
  BP.leapNear = function (u, tgt, dur, h) {
    const cell = this.freeNear(tgt.c, tgt.r, u);
    if (cell) this.leapTo(u, cell[0], cell[1], dur, h);
    return !!cell;
  };

  /* ---------- 普攻 ---------- */
  const PROJ = { hunter: 'arrow', mage: 'orb' };
  function projStyle(u) {
    const w = u.hero ? u.hero.look.wp : (u.mon && u.mon.kind === 'cannon' ? 'shell' : 'orb');
    return ({ bow: 'arrow', rifle: 'bullet', gun: 'bullet', handcannon: 'shell', cannon: 'shell', card: 'card', dagger: 'dagger', orb: 'orb', fan: 'fan', featherfan: 'orb', book: 'orb', brush: 'ink', umbrella: 'fan', staff: 'orb', shell: 'shell' })[w] || 'orb';
  }
  BP.attack = function (u, t) {
    u.atkCd = 1 / this.AS(u);
    u.anim.atk = 0.2; u.anim.face = t.x >= u.x ? 1 : -1;
    u.atkCount++;
    if (u.manaMax > 0 && u.castT <= 0) u.mana = Math.min(u.manaMax, u.mana + 10);
    if (u.range <= 1 || (u.mon && u.range <= 2 && u.mon.kind === 'dragon')) {
      this.later(0.1, () => { if (!u.dead) { this.addFx('slash', { x: t.x, y: t.y - 0.3, dir: u.anim.face, color: u.team === 0 ? '#FFFFFF' : '#FFD0C8', dur: 0.22 }); this.onHit(u, t); } });
    } else {
      const col = u.hero ? u.hero.look.wc : '#C07CFF';
      this.proj.push({ x: u.x + u.anim.face * 0.2, y: u.y - 0.45, tgt: t, speed: 11, style: projStyle(u), color: col, onHit: () => this.onHit(u, t) });
    }
  };
  BP.onHit = function (u, t) {
    if (t.dead) return;
    let dmg = this.AD(u), crit = false;
    if (Math.random() < u.crit + (u.hid === 'houyi' ? u.stacks * 0.04 : 0)) { crit = true; dmg *= u.critD; }
    if (u.it.moshi) dmg += t.hp * 0.05;
    if (u.empower) { dmg += this.AD(u) * 2; u.empower = false; this.text(t.x, t.y - 1.3, '宗师', '#FFB43A', 13); }
    const type = u.trueAtkT > 0 ? 'true' : 'phys';
    const dealt = this.damage(u, t, dmg, type, { atk: true, crit });
    if (crit && u.it.yingren) this.buff(u, { as: 25 }, 2);
    if (u.hid === 'houyi' && u.stacks < 10) u.stacks++;
    if (u.it.wushu) u.ap += 4 * u.it.wushu;
    if (u.it.suixing) t.shredT = 4;
    if (u.kaiT > 0) this.heal(u, u.kaiHeal);
    if (u.liEmp > 0) { u.liEmp--; this.damage(u, t, this.sp(u, u.liEmpV), 'magic', { skill: true }); this.addFx('ring', { x: t.x, y: t.y, r: 0.5, color: '#F28FA6', dur: 0.3 }); }
    if (u.it.shandian && u.atkCount % 3 === 0) {
      const es = this.enemies(u).sort((a, b) => this.d(t, a) - this.d(t, b)).slice(0, 3);
      let px = u.x, py = u.y - 0.4;
      for (const e of es) { this.addFx('bolt', { x1: px, y1: py, x2: e.x, y2: e.y - 0.4, color: '#9FE3FF', dur: 0.25 }); this.damage(u, e, 70, 'magic'); px = e.x; py = e.y - 0.4; }
    }
    if (t.it.fanshang && dealt > 0) this.damage(t, u, dealt * 0.25, 'magic');
    if (t.it.buxiang) { u.slowT = 3; u.slowAmt = Math.max(u.slowAmt, 0.25); }
  };

  /* ---------- 施法 ---------- */
  BP.vals = function (u) { return u.hero.skill.v.map(a => a[u.star - 1]); };
  BP.cast = function (u) {
    u.mana = 0;
    const sk = SKILLS[u.hid];
    if (!sk) return;
    u.anim.cast = 0.5;
    const name = u.hero ? u.hero.skill.name : sk.name;
    this.addFx('skillname', { x: u.x, y: u.y - 1.7, s: name, color: u.team === 0 ? '#FFE9A8' : '#FFB8A8', dur: 1.1 });
    this.addFx('castglow', { u, color: u.hero ? G.TRAITS[u.hero.traits[0]].color : '#FFD65A', dur: 0.5 });
    u.echoReady = !!u.it.huixiang;
    u.tongkuHit = u.it.tongku ? new Set() : null;
    u.castT = sk.ct || 0.2;
    u.pending = () => {
      sk.fn(this, u, u.hero ? this.vals(u) : null);
      if (u.jixia) this.later(0.05, () => { u.mana = Math.min(u.manaMax, u.mana + u.jixia); });
      if (u.it.zongshi) u.empower = true;
      if (u.it.jiushu) for (const a of this.allies(u)) if (this.d(a, u) <= 2) this.heal(a, 150);
    };
    this.events.push({ k: 'cast', team: u.team, big: u.hero && u.hero.cost >= 4 });
  };
  BP.skillHit = function (u, t, amt, type) {
    let crit = false;
    if (u.it.anying && Math.random() < u.crit) { crit = true; amt *= u.critD; }
    return this.damage(u, t, amt, type, { skill: true, crit });
  };
  BP.aoe = function (u, c, r, rad, amt, type, each) {
    const hits = this.inRadius(c, r, rad, 1 - u.team);
    for (const e of hits) { this.skillHit(u, e, amt, type); if (each) each(e); }
    return hits.length;
  };
  BP.lineHit = function (u, tx, ty, len, width, onHit, style, color) {
    const dx = tx - u.x, dy = ty - u.y, L = Math.hypot(dx, dy) || 1;
    this.proj.push({ x: u.x, y: u.y - 0.4, dx: dx / L, dy: dy / L, len, width, line: true, hit: new Set(), speed: 13, style, color, onLineHit: onHit, team: u.team, dist: 0 });
  };
  BP.summonDragonlings = function (boss) {
    for (let i = 0; i < 2; i++) {
      const cell = this.freeNear(boss.c, boss.r, null);
      if (!cell) break;
      const d = this.spawn({ hid: 'dragonling', star: 1, c: cell[0], r: cell[1], mult: boss.summonMult || 1 }, boss.team, {});
      this.addFx('pillar', { x: d.x, y: d.y, color: '#9FE3FF', dur: 0.7 });
    }
    this.text(boss.x, boss.y - 2, '召唤风暴幼龙！', '#9FE3FF', 18);
    this.shake = Math.max(this.shake, 0.4);
  };

  const SKILLS = {
    direnjie: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      for (let i = 0; i < 3; i++) b.later(i * 0.12, () => { if (u.dead || t.dead) return; b.proj.push({ x: u.x, y: u.y - 0.5, tgt: t, speed: 12, style: 'card', color: '#E6B94A', onHit: () => b.skillHit(u, t, b.sp(u, v[0]), 'phys') }); });
    } },
    liyuanfang: { fn(b, u, v) {
      const t = b.lowest(u); if (!t) return;
      b.proj.push({ x: u.x, y: u.y - 0.5, tgt: t, speed: 16, style: 'dagger', color: '#CFD8E0', big: 1, onHit: () => { b.skillHit(u, t, b.sp(u, v[0]), 'phys'); if (t.dead) { u.mana = Math.min(u.manaMax, u.mana + 30); b.text(u.x, u.y - 1.3, '+30 法力', '#7FB8FF', 12); } } });
    } },
    laofuzi: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.addFx('glyph', { x: t.x, y: t.y - 0.6, s: '训', color: '#F1E4C0', dur: 0.8 });
      b.skillHit(u, t, b.sp(u, v[0]), 'magic'); b.stun(t, v[1]);
    } },
    mozi: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.shield(u, b.sp(u, v[1]), 4);
      b.proj.push({ x: u.x, y: u.y - 0.6, tgt: t, speed: 9, style: 'shell', color: '#E0A43A', big: 1, onHit: () => {
        b.addFx('boom', { x: t.x, y: t.y, r: 1.3, color: '#FFB43A', dur: 0.5 }); b.shake = Math.max(b.shake, 0.15);
        b.aoe(u, t.c, t.r, 1, b.sp(u, v[0]), 'magic');
      } });
    } },
    liubei: { fn(b, u, v) {
      b.shield(u, b.sp(u, v[0]), 4);
      b.addFx('ring', { x: u.x, y: u.y, r: 1.4, color: '#6BD08A', dur: 0.45 });
      b.aoe(u, u.c, u.r, 1, b.sp(u, v[1]), 'phys');
    } },
    sulie: { ct: 0.35, fn(b, u, v) {
      b.addFx('boom', { x: u.x, y: u.y, r: 1.5, color: '#C9A15A', dur: 0.5 }); b.shake = Math.max(b.shake, 0.25);
      b.aoe(u, u.c, u.r, 1, b.sp(u, v[0]), 'magic', e => b.stun(e, v[1]));
    } },
    xiaoqiao: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      const c = t.c, r = t.r, x = t.x, y = t.y;
      b.addFx('stars', { x, y, color: '#FF9CC2', dur: 0.6 });
      b.later(0.3, () => { if (!u.dead) b.aoe(u, c, r, 1, b.sp(u, v[0]), 'magic'); });
    } },
    yuji: { fn(b, u, v) {
      u.dodgeAtk = v[0]; b.buff(u, { as: v[1] }, 4);
      b.addFx('ring', { x: u.x, y: u.y, r: 0.9, color: '#B89CFF', dur: v[0] });
    } },
    mulan: { fn(b, u, v) {
      b.addFx('spin', { x: u.x, y: u.y, r: 1.3, color: '#FF6A5A', dur: 0.45 });
      b.aoe(u, u.c, u.r, 1, b.sp(u, v[0]), 'phys'); b.heal(u, b.sp(u, v[1]));
    } },
    xuance: { fn(b, u, v) {
      const t = b.lowest(u); if (!t) return;
      b.addFx('beam', { x1: u.x, y1: u.y - 0.4, x2: t.x, y2: t.y - 0.4, color: '#B8C2CC', w: 3, dur: 0.3 });
      b.leapNear(u, t, 0.25, 0.5);
      b.later(0.25, () => { if (u.dead || t.dead) return; b.skillHit(u, t, b.sp(u, v[0]), 'phys'); b.stun(t, 0.75); b.addFx('slash', { x: t.x, y: t.y - 0.3, dir: 1, color: '#FF5A5A', dur: 0.3, big: 1 }); });
      u.castT = 0.3;
    } },
    sunshangxiang: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.proj.push({ x: u.x, y: u.y - 0.5, tgt: t, speed: 10, style: 'shell', color: '#FF8A3A', big: 1, onHit: () => {
        b.addFx('boom', { x: t.x, y: t.y, r: 1.2, color: '#FF8A3A', dur: 0.45 });
        b.skillHit(u, t, b.sp(u, v[0]), 'phys');
        for (const e of b.inRadius(t.c, t.r, 1, t.team)) if (e !== t) b.skillHit(u, e, b.sp(u, v[0]) / 2, 'phys');
      } });
    } },
    zhangliang: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.stun(t, v[1]);
      t.dots.push({ src: u, dps: b.sp(u, v[0]) / v[1], t: v[1], type: 'magic' });
      b.addFx('runes', { u: t, color: '#E8D08A', dur: v[1] });
      b.addFx('beam', { x1: u.x, y1: u.y - 0.5, x2: t.x, y2: t.y - 0.5, color: '#E8D08A', w: 2, dur: v[1], follow: [u, t] });
    } },
    zhuangzhou: { fn(b, u, v) {
      const al = b.allies(u).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp).slice(0, 2);
      for (const a of al) { b.heal(a, b.sp(u, v[0])); a.stun = 0; a.air = 0; a.ccImmune = 2; b.addFx('butterfly', { x: a.x, y: a.y, dur: 1 }); }
    } },
    liubang: { fn(b, u, v) {
      for (const a of b.allies(u)) { b.shield(a, b.sp(u, v[0]), 4); b.addFx('ring', { x: a.x, y: a.y, r: 0.7, color: '#E3BE5C', dur: 0.5 }); }
    } },
    peiqinhu: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.buff(u, { ad: v[1], as: 40 }, 5);
      b.addFx('claw', { x: t.x, y: t.y - 0.4, color: '#FFB43A', dur: 0.35 });
      b.skillHit(u, t, b.sp(u, v[0]), 'phys');
      u.tigerT = 5;
    } },
    yangjian: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.proj.push({ x: u.x, y: u.y - 0.2, tgt: t, speed: 10, style: 'dog', color: '#E8E4DA', big: 1, onHit: () => { b.skillHit(u, t, b.sp(u, v[0]), 'phys'); b.knock(t, 1); } });
    } },
    diaochan: { fn(b, u, v) {
      b.addFx('lotus', { x: u.x, y: u.y, r: 1.4, color: '#FF8CC6', dur: 0.7 });
      const n = b.aoe(u, u.c, u.r, 1, b.sp(u, v[0]), 'magic');
      b.heal(u, n * b.sp(u, v[1]));
    } },
    hanxin: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.addFx('spin', { x: t.x, y: t.y, r: 1.3, color: '#6FA8FF', dur: 0.4 });
      b.aoe(u, t.c, t.r, 1, b.sp(u, v[0]), 'phys', e => b.knock(e, 0.75));
    } },
    shouyue: { ct: 0.4, fn(b, u, v) {
      const t = b.farthest(u); if (!t) return;
      b.addFx('beam', { x1: u.x, y1: u.y - 0.5, x2: t.x, y2: t.y - 0.5, color: '#FFE9A8', w: 5, dur: 0.35 });
      b.skillHit(u, t, b.sp(u, v[0]), 'phys'); b.shake = Math.max(b.shake, 0.12);
    } },
    change: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.addFx('moon', { x: t.x, y: t.y, r: 1.4, color: '#CFE3FF', dur: 0.6 });
      let tot = 0;
      for (const e of b.inRadius(t.c, t.r, 1, t.team)) tot += b.skillHit(u, e, b.sp(u, v[0]), 'magic');
      b.shield(u, tot * 0.5, 5);
    } },
    guiguzi: { ct: 0.3, fn(b, u, v) {
      b.addFx('swirl', { x: u.x, y: u.y, r: 2.3, color: '#7CF0B0', dur: 0.8 });
      b.aoe(u, u.c, u.r, 2, b.sp(u, v[0]), 'magic', e => b.stun(e, v[1]));
    } },
    gongsunli: { fn(b, u, v) {
      u.untarget = 1; u.dodgeAtk = 1; u.liEmp = 3; u.liEmpV = v[0];
      const n = b.nearest(u);
      if (n) {
        let best = null, bd = -1;
        for (const [c, r] of HX.nb(u.c, u.r)) { if (b.at(c, r)) continue; const d = HX.dist(c, r, n.c, n.r); if (d > bd && d <= u.range) { bd = d; best = [c, r]; } }
        if (best) b.leapTo(u, best[0], best[1], 0.25, 0.4);
      }
      b.addFx('petalburst', { x: u.x, y: u.y, color: '#F28FA6', dur: 0.6 });
    } },
    zhaoyun: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.leapNear(u, t, 0.35, 1.4);
      u.castT = 0.4;
      b.later(0.35, () => { if (u.dead) return; b.addFx('boom', { x: u.x, y: u.y, r: 1.4, color: '#6FA8FF', dur: 0.45 }); b.aoe(u, u.c, u.r, 1, b.sp(u, v[0]), 'phys', e => b.knock(e, 1)); b.shake = Math.max(b.shake, 0.2); });
    } },
    houyi: { ct: 0.3, fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      let first = true;
      b.lineHit(u, t.x, t.y, 9, 0.6, e => { b.skillHit(u, e, b.sp(u, v[0]), 'magic'); if (first) { first = false; b.stun(e, v[1]); b.addFx('boom', { x: e.x, y: e.y, r: 1, color: '#FFB43A', dur: 0.4 }); } }, 'sunarrow', '#FFB43A');
      b.shake = Math.max(b.shake, 0.2);
    } },
    zhugeliang: { fn(b, u, v) {
      let n = 0;
      const shoot = () => {
        const t = b.lowest(u); if (!t || u.dead) return;
        b.proj.push({ x: u.x, y: u.y - 0.6, tgt: t, speed: 13, style: 'bigorb', color: '#7FB8FF', big: 1, onHit: () => {
          b.skillHit(u, t, b.sp(u, v[0]), 'magic');
          b.addFx('ring', { x: t.x, y: t.y, r: 0.9, color: '#7FB8FF', dur: 0.35 });
          if (t.dead && ++n < 3) { b.text(u.x, u.y - 1.6, '再次施放', '#9FE3FF', 13); b.later(0.15, shoot); }
        } });
      };
      shoot();
    } },
    xiangyu: { ct: 0.5, fn(b, u, v) {
      b.shield(u, b.sp(u, v[1]), 5);
      b.addFx('boom', { x: u.x, y: u.y, r: 1.6, color: '#FF4A3A', dur: 0.55 }); b.shake = Math.max(b.shake, 0.3);
      b.aoe(u, u.c, u.r, 1, b.sp(u, v[0]), 'phys', e => b.stun(e, 1.5));
    } },
    shangguan: { fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      const c = t.c, r = t.r, x = t.x, y = t.y;
      u.untarget = 1.5; u.castT = 1.5;
      for (let i = 0; i < 4; i++) b.later(0.1 + i * 0.35, () => {
        if (u.dead) return;
        b.addFx('ink', { x, y, r: 1.3, rot: i * 0.8, color: '#2A2230', dur: 0.5 });
        b.aoe(u, c, r, 1, b.sp(u, v[0]), 'magic');
      });
    } },
    kai: { fn(b, u, v) {
      b.buff(u, { ad: 50, as: 30 }, 8); u.kaiT = 8; u.kaiHeal = b.sp(u, v[0]);
      b.addFx('pillar', { x: u.x, y: u.y, color: '#58C7F2', dur: 0.7 });
    } },
    nezha: { fn(b, u, v) {
      const t = b.farthest(u); if (!t) return;
      b.leapNear(u, t, 0.45, 1.8); u.castT = 0.5;
      b.later(0.45, () => { if (u.dead || t.dead) return; b.skillHit(u, t, b.sp(u, v[0]), 'phys'); b.stun(t, v[1]); b.addFx('bind', { u: t, color: '#F4C04A', dur: v[1] }); });
    } },
    lvbu: { ct: 0.2, fn(b, u, v) {
      const t = b.densest(u, 1); if (!t) return;
      b.leapNear(u, t, 0.5, 2.2); u.castT = 0.55;
      b.later(0.5, () => {
        if (u.dead) return;
        b.addFx('boom', { x: u.x, y: u.y, r: 1.8, color: '#FF3A3A', dur: 0.6 }); b.shake = Math.max(b.shake, 0.45);
        b.aoe(u, u.c, u.r, 1, b.sp(u, v[0]), 'phys', e => b.knock(e, 1));
        b.buff(u, {}, 8); u.omni += 0.4; u.trueAtkT = 8; b.later(8, () => { u.omni -= 0.4; });
      });
    } },
    nvwa: { ct: 0.3, fn(b, u, v) {
      const t = b.densest(u, 2); if (!t) return;
      const c = t.c, r = t.r, x = t.x, y = t.y;
      b.addFx('meteor', { x, y, color: '#FFE27A', dur: 0.55 });
      b.later(0.5, () => {
        if (u.dead) return;
        b.addFx('boom', { x, y, r: 2.6, color: '#FFE27A', dur: 0.7 }); b.shake = Math.max(b.shake, 0.5);
        b.aoe(u, c, r, 2, b.sp(u, v[0]), 'magic', e => b.stun(e, 1.5));
      });
    } },
    wuzetian: { ct: 0.4, fn(b, u, v) {
      const es = b.enemies(u); if (!es.length) return;
      b.addFx('hand', { team: u.team, color: '#C07CFF', dur: 1.1 }); b.shake = Math.max(b.shake, 0.5);
      b.later(0.45, () => { if (u.dead) return; for (const e of b.enemies(u)) { b.skillHit(u, e, b.sp(u, v[0]), 'magic'); b.stun(e, v[1]); } });
    } },
    libai: { fn(b, u, v) {
      u.untarget = 1.5; u.castT = 1.5;
      for (let i = 0; i < 4; i++) b.later(0.1 + i * 0.32, () => {
        if (u.dead) return;
        b.addFx('swords', { x: u.x, y: u.y, r: 2.2, rot: i * 0.7, color: '#BFE6FF', dur: 0.35 });
        b.aoe(u, u.c, u.r, 2, b.sp(u, v[0]), 'phys');
      });
    } },
    jiangziya: { ct: 0.6, fn(b, u, v) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.lineHit(u, t.x, t.y, 10, 0.75, e => b.skillHit(u, e, b.sp(u, v[0]), 'magic'), 'beam', '#FFE9A8');
      b.shake = Math.max(b.shake, 0.3);
      for (const a of b.allies(u)) if (a !== u) { a.mana = Math.min(a.manaMax, a.mana + v[1]); }
      b.addFx('pillar', { x: u.x, y: u.y, color: '#FFE9A8', dur: 0.8 });
    } },
    /* 野怪 */
    tyrant: { name: '暴君之怒', ct: 0.35, fn(b, u) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.addFx('boom', { x: t.x, y: t.y, r: 1.5, color: '#E07AF0', dur: 0.5 }); b.shake = Math.max(b.shake, 0.3);
      b.aoe(u, t.c, t.r, 1, 260 * (u.powerMul || 1), 'phys', e => b.knock(e, 0.8));
    } },
    overlord: { name: '主宰吐息', ct: 0.4, fn(b, u) {
      const t = b.valid(u.target) ? u.target : b.nearest(u); if (!t) return;
      b.lineHit(u, t.x, t.y, 6, 0.9, e => b.skillHit(u, e, 330 * (u.powerMul || 1), 'magic'), 'fire', '#FF8A3A');
      b.shake = Math.max(b.shake, 0.3);
    } },
    storm: { name: '风暴审判', ct: 0.4, fn(b, u) {
      const es = b.enemies(u).sort(() => Math.random() - 0.5).slice(0, 5);
      es.forEach((e, i) => b.later(i * 0.12, () => {
        if (e.dead || u.dead) return;
        b.addFx('lightning', { x: e.x, y: e.y, color: '#9FE3FF', dur: 0.4 });
        b.skillHit(u, e, 360 * (u.powerMul || 1), 'magic'); b.stun(e, 0.6);
      }));
      b.shake = Math.max(b.shake, 0.4);
    } }
  };
  G.SKILLS = SKILLS;

  /* ---------- 主循环 ---------- */
  BP.update = function (dt) {
    if (this.over) { this.postT = (this.postT || 0) + dt; this.updateFx(dt); return; }
    this.t += dt;
    // 计时器
    for (let i = 0; i < this.timers.length; i++) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i--, 1); tm.fn(); } }
    for (const u of this.units) if (!u.dead) this.updateUnit(u, dt);
    // 投射物
    for (let i = 0; i < this.proj.length; i++) {
      const p = this.proj[i];
      if (p.line) {
        const step = p.speed * dt; p.x += p.dx * step; p.y += p.dy * step; p.dist += step;
        for (const e of this.units) {
          if (e.dead || e.team === p.team || p.hit.has(e.id)) continue;
          if (Math.hypot(e.x - p.x, e.y - 0.4 - p.y) < p.width + 0.1) { p.hit.add(e.id); p.onLineHit(e); }
        }
        if (p.dist > p.len || p.x < -1 || p.x > COLS + 1 || p.y < -1.5 || p.y > ROWS) this.proj.splice(i--, 1);
        continue;
      }
      if (p.tgt.dead) { this.proj.splice(i--, 1); continue; }
      const tx = p.tgt.x, ty = p.tgt.y - 0.45;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      p.ang = Math.atan2(dy, dx);
      if (d <= step + 0.05) { this.proj.splice(i--, 1); p.onHit(); }
      else { p.x += dx / d * step; p.y += dy / d * step; }
    }
    this.updateFx(dt);
    // 胜负
    const alive = [0, 0];
    for (const u of this.units) if (!u.dead) alive[u.team]++;
    if (!alive[0] || !alive[1]) { this.over = true; this.winner = alive[0] ? 0 : alive[1] ? 1 : -1; this.postT = 0; }
    else if (this.t > 48) { this.over = true; this.winner = -1; this.postT = 0; this.timeout = true; }
  };
  BP.updateFx = function (dt) {
    for (let i = 0; i < this.fx.length; i++) { const f = this.fx[i]; f.t += dt; if (f.t >= f.dur) this.fx.splice(i--, 1); }
    for (let i = 0; i < this.texts.length; i++) { const f = this.texts[i]; f.t += dt; if (f.t >= f.dur) this.texts.splice(i--, 1); }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    for (const u of this.units) if (u.dead) u.deadT += dt;
  };

  BP.updateUnit = function (u, dt) {
    const a = u.anim;
    a.atk = Math.max(0, a.atk - dt); a.flash = Math.max(0, a.flash - dt); a.cast = Math.max(0, a.cast - dt);
    u.atkCd -= dt;
    for (const k of ['invuln', 'untarget', 'dodgeAtk', 'ccImmune', 'slowT', 'shredT', 'kaiT', 'trueAtkT', 'tigerT']) if (u[k] > 0) u[k] -= dt;
    if (u.air > 0) u.air -= dt;
    for (let i = 0; i < u.buffs.length; i++) { u.buffs[i].t -= dt; if (u.buffs[i].t <= 0) u.buffs.splice(i--, 1); }
    for (let i = 0; i < u.shields.length; i++) { u.shields[i].t -= dt; if (u.shields[i].t <= 0) u.shields.splice(i--, 1); }
    for (let i = 0; i < u.dots.length; i++) {
      const d = u.dots[i]; d.t -= dt; d.acc = (d.acc || 0) + dt;
      if (d.acc >= 0.25) { d.acc -= 0.25; this.damage(d.src, u, d.dps * 0.25, d.type, { skill: true }); if (u.dead) return; }
      if (d.t <= 0) u.dots.splice(i--, 1);
    }
    // 每秒效果
    u.tick1 += dt;
    if (u.tick1 >= 1) {
      u.tick1 -= 1;
      if (u.regen) this.heal(u, u.maxHp * u.regen);
      if (u.it.bazhe) this.heal(u, u.maxHp * 0.02 * u.it.bazhe);
    }
    u.tick2 += dt;
    if (u.tick2 >= 2) {
      u.tick2 -= 2;
      if (u.it.honglian) { this.addFx('ring', { x: u.x, y: u.y, r: 1.2, color: '#FF6A3A', dur: 0.4 }); for (const e of this.inRadius(u.c, u.r, 1, 1 - u.team)) this.damage(u, e, u.maxHp * 0.05, 'magic'); }
    }
    u.tick3 += dt;
    if (u.tick3 >= 3) {
      u.tick3 -= 3;
      if (u.it.shengbei && u.manaMax > 0) u.mana = Math.min(u.manaMax, u.mana + 10 * u.it.shengbei);
      if (u.shenVal && u.shen < 8) { u.shen++; this.text(u.x, u.y - 1.5, '神力+' , '#F0C75E', 11); }
    }
    if (u.dead) return;
    // 跳跃
    if (u.jump) {
      const j = u.jump; j.t += dt; const k = Math.min(1, j.t / j.dur);
      u.x = j.fx + (j.tx - j.fx) * k; u.y = j.fy + (j.ty - j.fy) * k; u.lift = Math.sin(k * Math.PI) * j.h;
      if (k >= 1) { u.jump = null; u.lift = 0; }
      return;
    }
    if (u.moving) {
      const m = u.moving; m.t += dt; const k = Math.min(1, m.t / m.dur);
      u.x = m.fx + (m.tx - m.fx) * k; u.y = m.fy + (m.ty - m.fy) * k; u.hop = Math.sin(k * Math.PI) * 0.12;
      if (k >= 1) { u.moving = null; u.hop = 0; }
      return;
    }
    if (u.stun > 0) { u.stun -= dt; return; }
    if (u.castT > 0) { u.castT -= dt; if (u.castT <= 0 && u.pending) { const f = u.pending; u.pending = null; f(); } return; }
    // 刺客开场突袭
    if (u.leap && this.t > 0.35) {
      u.leap = false;
      const t = this.farthest(u);
      if (t && this.d(u, t) > 1 && this.leapNear(u, t, 0.45, 1.6)) {
        this.addFx('shadow', { x: u.x, y: u.y, color: '#7A3FA0', dur: 0.4 });
        u.target = t; return;
      }
    }
    if (u.manaMax > 0 && u.mana >= u.manaMax && SKILLS[u.hid]) { this.cast(u); return; }
    if (!this.valid(u.target) || this.d(u, u.target) > u.range) {
      const n = this.nearest(u);
      if (n) u.target = n;
    }
    const t = u.target;
    if (!this.valid(t)) { u.target = null; return; }
    if (this.d(u, t) <= u.range) {
      if (u.atkCd <= 0) this.attack(u, t);
    } else {
      let step = this.path(u, (c, r) => HX.dist(c, r, t.c, t.r) <= u.range);
      if (!step) {
        // 找任意可达的敌人
        const es = this.enemies(u).filter(e => this.valid(e));
        step = this.path(u, (c, r) => es.some(e => HX.dist(c, r, e.c, e.r) <= u.range));
      }
      if (step) this.moveTo(u, step[0], step[1], 0.42);
    }
  };

  /* ---------- 战力估算（机器人之间对战） ---------- */
  G.teamPower = function (units, augs) {
    const tr = G.calcTraits(units, augs);
    let p = 0;
    for (const u of units) {
      const h = G.HEROES[u.hid]; if (!h) continue;
      let v = (h.cost * 1.25 + 1) * Math.pow(2.6, u.star - 1);
      v *= 1 + 0.18 * (u.items || []).filter(i => !G.ITEMS[i].comp).length + 0.07 * (u.items || []).filter(i => G.ITEMS[i].comp).length;
      let tb = 0; for (const t of h.traits) tb += (tr.tiers[t] || 0);
      v *= 1 + 0.12 * tb;
      p += v;
    }
    return p * (1 + 0.04 * (augs || []).length);
  };
})(window.G);
