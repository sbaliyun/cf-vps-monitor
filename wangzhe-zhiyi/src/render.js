'use strict';
/* 王者之弈 · 画面渲染与棋盘交互 */
(function (G) {
  const R = G.render = {};
  const A = G.art, S = G.S, HX = G.hex;
  const TAU = Math.PI * 2;
  let cv, ctx, bg = null, bgKey = '';
  const parts = [];
  const ambient = [];
  let time = 0;
  R.drag = null; R.hover = null; R.selected = null;

  R.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    for (let i = 0; i < 38; i++) ambient.push(newAmbient(true));
  };

  /* ---------- 布局 ---------- */
  R.layout = function (L) {
    R.L = L;
    const b = L.board;
    b.R = b.hw / Math.sqrt(3);
    b.rs = b.hw * 0.866 * b.sq; // 行距
    bgKey = '';
  };
  function cellXY(c, r) { const b = R.L.board; return { x: b.ox + b.hw * (c + 0.5 * (r & 1)), y: b.oy + r * b.rs }; }
  function posXY(x, y) { const b = R.L.board; return { x: b.ox + b.hw * x, y: b.oy + y * b.hw * b.sq }; }
  function benchXY(i) { const bn = R.L.bench; return { x: bn.x + (i + 0.5) * bn.w, y: bn.y }; }
  R.cellXY = cellXY; R.benchXY = benchXY;
  function hexPath(cx, cy, rad, sq) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * sq; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
  }

  /* ---------- 背景 ---------- */
  function buildBg(W, H, scale) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * scale); c.height = Math.ceil(H * scale);
    const g = c.getContext('2d'); g.scale(scale, scale);
    const L = R.L, b = L.board;
    // 天空
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0A0F22'); sky.addColorStop(0.45, '#17274A'); sky.addColorStop(1, '#1D3C4C');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // 星点
    for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.5 + 0.1) + ')'; g.fillRect(Math.random() * W, Math.random() * H * 0.5, 1.2, 1.2); }
    // 月亮
    const mx = W * (L.mode === 'land' ? 0.84 : 0.8), my = H * (L.mode === 'land' ? 0.16 : 0.09);
    const mg = g.createRadialGradient(mx, my, 10, mx, my, 160);
    mg.addColorStop(0, 'rgba(255,236,190,.45)'); mg.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = mg; g.fillRect(mx - 160, my - 160, 320, 320);
    g.fillStyle = '#FFF1CF'; g.beginPath(); g.arc(mx, my, 34, 0, TAU); g.fill();
    g.fillStyle = 'rgba(220,200,160,.35)'; g.beginPath(); g.arc(mx - 10, my - 6, 7, 0, TAU); g.arc(mx + 12, my + 8, 5, 0, TAU); g.fill();
    // 远山（水墨）
    const layers = [['rgba(60,90,130,.55)', 0.52, 70], ['rgba(40,66,100,.7)', 0.6, 55], ['rgba(24,44,70,.85)', 0.7, 40]];
    for (const [col, yy, amp] of layers) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      let x = 0; const base = H * yy;
      g.lineTo(0, base);
      while (x <= W) { const nx = x + 60 + Math.random() * 80; const peak = base - amp * (0.4 + Math.random()); g.quadraticCurveTo(x + (nx - x) / 2, peak, nx, base - Math.random() * 20); x = nx; }
      g.lineTo(W, H); g.closePath(); g.fill();
    }
    // 云带
    g.fillStyle = 'rgba(200,220,255,.07)';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(Math.random() * W, H * (0.3 + Math.random() * 0.4), 120 + Math.random() * 160, 16 + Math.random() * 14, 0, 0, TAU); g.fill(); }
    // 浮空擂台
    const top = cellXY(0, 0), bot = cellXY(6, 7);
    const cx = (b.ox + b.ox + b.hw * 6.5) / 2, cy = (top.y + bot.y) / 2;
    const rx = b.hw * 4.6, ry = (bot.y - top.y) / 2 + b.R * 1.9;
    // 侧面厚度
    const side = g.createLinearGradient(0, cy, 0, cy + ry + 60);
    side.addColorStop(0, '#3A3246'); side.addColorStop(1, '#16121E');
    g.fillStyle = side; g.beginPath(); g.ellipse(cx, cy + 34, rx, ry, 0, 0, TAU); g.fill();
    // 岩石底部锥
    g.fillStyle = '#1C1826'; g.beginPath(); g.moveTo(cx - rx * 0.7, cy + ry * 0.6); g.quadraticCurveTo(cx, cy + ry + 140, cx + rx * 0.7, cy + ry * 0.6); g.fill();
    // 顶面草地
    const grass = g.createRadialGradient(cx, cy, 20, cx, cy, rx);
    grass.addColorStop(0, '#3F7A5A'); grass.addColorStop(0.75, '#2C5C48'); grass.addColorStop(1, '#1E4236');
    g.fillStyle = grass; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(233,196,106,.55)'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(233,196,106,.2)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, rx - 10, ry - 8, 0, 0, TAU); g.stroke();
    // 草纹
    g.strokeStyle = 'rgba(120,200,140,.18)'; g.lineWidth = 1.2;
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * TAU, rr = Math.sqrt(Math.random());
      const x = cx + Math.cos(a) * rx * rr * 0.97, y = cy + Math.sin(a) * ry * rr * 0.97;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - 5); g.stroke();
    }
    // 河道
    const ry0 = (cellXY(0, 3).y + cellXY(0, 4).y) / 2;
    const river = g.createLinearGradient(0, ry0 - 26, 0, ry0 + 26);
    river.addColorStop(0, 'rgba(60,150,200,0)'); river.addColorStop(0.5, 'rgba(90,190,230,.55)'); river.addColorStop(1, 'rgba(60,150,200,0)');
    g.save(); g.beginPath(); g.ellipse(cx, cy, rx - 4, ry - 4, 0, 0, TAU); g.clip();
    g.fillStyle = river; g.fillRect(cx - rx, ry0 - 26, rx * 2, 52);
    g.restore();
    // 格子
    for (let r = 0; r < G.ROWS; r++) for (let c = 0; c < G.COLS; c++) {
      const p = cellXY(c, r);
      const mine = r >= 4;
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const x = p.x + Math.cos(a) * b.R * 0.93, y = p.y + Math.sin(a) * b.R * 0.93 * b.sq; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath();
      const hg = g.createLinearGradient(0, p.y - b.R, 0, p.y + b.R);
      if (mine) { hg.addColorStop(0, 'rgba(120,230,205,.26)'); hg.addColorStop(1, 'rgba(40,120,110,.3)'); }
      else { hg.addColorStop(0, 'rgba(240,150,120,.2)'); hg.addColorStop(1, 'rgba(130,50,50,.28)'); }
      g.fillStyle = hg; g.fill();
      g.strokeStyle = mine ? 'rgba(180,255,235,.38)' : 'rgba(255,190,170,.3)'; g.lineWidth = 1.3; g.stroke();
    }
    // 防御塔
    drawTower(g, b.ox - b.hw * 0.9, cellXY(0, 7).y + 6, '#4FA8E8', b.hw);
    drawTower(g, b.ox + b.hw * 7.4, cellXY(6, 0).y + 6, '#E8604F', b.hw);
    // 灯笼
    for (const [x, y] of [[b.ox - b.hw * 0.6, cellXY(0, 2).y], [b.ox + b.hw * 7.1, cellXY(6, 5).y]]) drawLantern(g, x, y, b.hw);
    // 备战席
    const bn = L.bench;
    const bx0 = bn.x - 12, bx1 = bn.x + bn.w * G.BENCH + 12;
    const wood = g.createLinearGradient(0, bn.y - 20, 0, bn.y + 30);
    wood.addColorStop(0, '#5A3E2C'); wood.addColorStop(1, '#2E1E16');
    g.fillStyle = wood; roundRect(g, bx0, bn.y - 14, bx1 - bx0, 36, 12); g.fill();
    g.strokeStyle = 'rgba(233,196,106,.5)'; g.lineWidth = 2; g.stroke();
    for (let i = 0; i < G.BENCH; i++) {
      const p = benchXY(i);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(p.x, p.y + 4, bn.w * 0.36, 10, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(233,196,106,.35)'; g.lineWidth = 1.2; g.stroke();
    }
    return c;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function drawTower(g, x, y, col, hw) {
    const s = hw / 78;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, 0, 26, 9, 0, 0, TAU); g.fill();
    g.fillStyle = '#6A6478'; g.beginPath(); g.moveTo(-20, 0); g.lineTo(-13, -70); g.lineTo(13, -70); g.lineTo(20, 0); g.closePath(); g.fill();
    g.fillStyle = '#4A4458'; g.fillRect(-20, -8, 40, 8);
    g.fillStyle = '#8A849A'; g.fillRect(-18, -78, 36, 10);
    const gl = g.createRadialGradient(0, -96, 2, 0, -96, 30);
    gl.addColorStop(0, '#FFFFFF'); gl.addColorStop(0.3, col); gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, -96, 30, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(0, -112); g.lineTo(9, -96); g.lineTo(0, -80); g.lineTo(-9, -96); g.closePath(); g.fill();
    g.restore();
  }
  function drawLantern(g, x, y, hw) {
    const s = hw / 78;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = '#3A2A20'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -50); g.lineTo(12, -50); g.stroke();
    const gl = g.createRadialGradient(12, -38, 2, 12, -38, 34);
    gl.addColorStop(0, 'rgba(255,160,80,.6)'); gl.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(12, -38, 34, 0, TAU); g.fill();
    g.fillStyle = '#D8402E'; g.beginPath(); g.ellipse(12, -38, 9, 11, 0, 0, TAU); g.fill();
    g.fillStyle = '#F2C04E'; g.fillRect(8, -50, 8, 3); g.fillRect(8, -28, 8, 3);
    g.restore();
  }

  /* ---------- 氛围粒子 ---------- */
  function newAmbient(init) {
    const L = R.L || { W: 1280, H: 720 };
    const petal = Math.random() < 0.55;
    return { x: Math.random() * L.W, y: init ? Math.random() * L.H : -10, vx: 8 + Math.random() * 16, vy: petal ? 14 + Math.random() * 18 : -4 - Math.random() * 6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 2, petal, s: 2 + Math.random() * 3, ph: Math.random() * TAU };
  }
  function drawAmbient(dt) {
    const L = R.L;
    for (let i = 0; i < ambient.length; i++) {
      const p = ambient[i];
      p.x += (p.vx + Math.sin(time + p.ph) * 8) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > L.H + 10 || p.x > L.W + 10 || p.y < -20) { ambient[i] = newAmbient(false); if (!ambient[i].petal) ambient[i].y = L.H * (0.3 + Math.random() * 0.6); continue; }
      if (p.petal) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = 'rgba(255,170,200,.55)';
        ctx.beginPath(); ctx.ellipse(0, 0, p.s * 1.4, p.s * 0.8, 0, 0, TAU); ctx.fill(); ctx.restore();
      } else {
        const a = 0.35 + 0.35 * Math.sin(time * 3 + p.ph);
        ctx.fillStyle = 'rgba(255,230,140,' + a + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.6, 0, TAU); ctx.fill();
      }
    }
  }

  /* ---------- 单位绘制 ---------- */
  const STAR_COL = ['#C98A56', '#DDE6F0', '#FFD65A'];
  function drawUnit(u, x, y, o) {
    const b = R.L.board;
    const sp = A.sprite(u.hid, o.shadow ? 1 : 0);
    const scale = b.hw / 78 * 0.62 * sp.scale * (1 + (u.star - 1) * 0.07);
    const w = sp.w * scale, h = sp.h * scale;
    const lift = (o.lift || 0) * b.hw * 0.45;
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    const big = Math.max(1, sp.scale * 0.8);
    ctx.beginPath(); ctx.ellipse(x, y + 2, b.R * 0.62 * big * (1 - Math.min(0.5, lift / 120)), b.R * 0.62 * b.sq * 0.55 * big, 0, 0, TAU); ctx.fill();
    // 星级底环
    if (u.star >= 2 && !o.noRing) {
      ctx.save(); ctx.strokeStyle = STAR_COL[u.star - 1]; ctx.lineWidth = u.star === 3 ? 3 : 2;
      ctx.shadowColor = STAR_COL[u.star - 1]; ctx.shadowBlur = u.star === 3 ? 12 : 6;
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 3);
      ctx.beginPath(); ctx.ellipse(x, y + 2, b.R * 0.7, b.R * 0.7 * b.sq * 0.62, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (o.teamRing) {
      ctx.strokeStyle = o.teamRing; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.ellipse(x, y + 2, b.R * 0.56, b.R * 0.56 * b.sq * 0.6, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    const bob = o.still ? 0 : Math.sin(time * 3.2 + (u.uid || u.id || 0)) * 1.4;
    const lunge = o.lunge || 0;
    const face = o.face || 1;
    const dx = x + lunge * face * 7, dy = y - lift + bob * 0.5 - (o.hop || 0) * 30;
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(dx, dy);
    const sx = 1 + Math.sin(time * 3.2 + (u.uid || u.id || 0)) * 0.015, sy = 2 - sx;
    ctx.scale(face * sx, sy);
    ctx.drawImage(sp.c, -sp.ax * scale, -sp.ay * scale, w, h);
    if (o.flash > 0) { ctx.globalAlpha = Math.min(1, o.flash * 8) * 0.8; const fl = A.sprite(u.hid, 2); ctx.drawImage(fl.c, -fl.ax * scale, -fl.ay * scale, w, h); }
    ctx.restore();
    return { top: dy - (sp.ay - 12) * scale, scale };
  }
  function drawBars(x, top, u, o) {
    const b = R.L.board;
    const bw = Math.max(44, b.hw * 0.62), bh = 6;
    const bx = x - bw / 2, by = top - 12;
    const hpR = o.hpR == null ? 1 : o.hpR, shR = o.shR || 0;
    ctx.fillStyle = 'rgba(10,8,16,.85)'; ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, bh + (o.mana != null ? 6 : 3));
    ctx.fillStyle = o.hpCol; ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, hpR)), bh);
    if (shR > 0) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(bx + bw * Math.min(1, hpR), by, bw * Math.min(shR, 1 - Math.min(1, hpR)) || 0, bh); if (hpR + shR > 1) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(bx, by, bw * Math.min(1, shR), 2); } }
    if (o.maxHp) {
      ctx.fillStyle = 'rgba(10,8,16,.55)';
      const step = 300 / o.maxHp * bw;
      if (step > 3) for (let t = step; t < bw - 1; t += step) ctx.fillRect(bx + t, by, 1, bh);
    }
    if (o.mana != null) { ctx.fillStyle = '#2C3A66'; ctx.fillRect(bx, by + bh + 1, bw, 3); ctx.fillStyle = '#5AA8FF'; ctx.fillRect(bx, by + bh + 1, bw * Math.min(1, o.mana), 3); }
    // 星级
    if (u.star) {
      ctx.fillStyle = STAR_COL[u.star - 1]; ctx.strokeStyle = '#1A1422'; ctx.lineWidth = 1.2;
      for (let i = 0; i < u.star; i++) { ctx.beginPath(); A.star5(ctx, x - (u.star - 1) * 5.5 + i * 11, by - 7, 5.2, 2.4); ctx.fill(); ctx.stroke(); }
    }
    // 装备
    if (u.items && u.items.length) {
      const s = 13;
      u.items.forEach((id, i) => { const img = A.itemImg(id); if (img.complete) ctx.drawImage(img, x - u.items.length * s / 2 + i * s, by + (o.mana != null ? 11 : 8), s - 1, s - 1); });
    }
  }

  /* ---------- 特效 ---------- */
  function spawnParts(x, y, n, col, spd, life, size, g) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = spd * (0.3 + Math.random() * 0.7); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - spd * 0.2, life: life * (0.6 + Math.random() * 0.4), max: life, col, s: size * (0.6 + Math.random() * 0.6), g: g == null ? 120 : g }); }
  }
  function drawParts(dt) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts.splice(i--, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function brushText(s, x, y, size, col, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.font = size + 'px ' + A.FONT_BRUSH; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,12,24,.85)'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.restore();
  }
  function drawFx(f, bt) {
    const b = R.L.board, k = f.t / f.dur, hw = b.hw;
    const P = f.x != null ? posXY(f.x, f.y) : null;
    ctx.save();
    switch (f.type) {
      case 'ring': {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 3 * (1 - k) + 1;
        const rr = f.r * hw * (0.3 + 0.7 * Math.min(1, k * 2));
        ctx.beginPath(); ctx.ellipse(P.x, P.y, rr, rr * b.sq, 0, 0, TAU); ctx.stroke(); break;
      }
      case 'boom': {
        if (!f.sp) { f.sp = 1; spawnParts(P.x, P.y - 10, 18, f.color, 220, 0.6, 3); }
        const rr = f.r * hw * (0.4 + 0.6 * k);
        const g = ctx.createRadialGradient(P.x, P.y, 2, P.x, P.y, rr);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.9 * (1 - k)) + ')'); g.addColorStop(0.4, A.rgba(f.color, 0.6 * (1 - k))); g.addColorStop(1, A.rgba(f.color, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(P.x, P.y, rr, rr * b.sq, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(P.x, P.y, rr * 1.05, rr * b.sq * 1.05, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'slash': {
        ctx.globalAlpha = 1 - k; ctx.translate(P.x, P.y); ctx.scale(f.dir || 1, 1);
        ctx.strokeStyle = f.color; ctx.lineWidth = (f.big ? 6 : 3.5) * (1 - k * 0.5); ctx.lineCap = 'round';
        ctx.shadowColor = f.color; ctx.shadowBlur = 8;
        const rr = hw * (f.big ? 0.5 : 0.32);
        ctx.beginPath(); ctx.arc(0, 0, rr, -2.2 + k * 1.2, -0.4 + k * 1.2); ctx.stroke(); break;
      }
      case 'beam': {
        let x1 = f.x1, y1 = f.y1, x2 = f.x2, y2 = f.y2;
        if (f.follow) { const [a, c] = f.follow; if (a.dead || c.dead) break; x1 = a.x; y1 = a.y - 0.5; x2 = c.x; y2 = c.y - 0.5; }
        const p1 = posXY(x1, y1), p2 = posXY(x2, y2);
        ctx.globalAlpha = f.follow ? 0.7 : 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = f.w * 2; ctx.lineCap = 'round';
        ctx.shadowColor = f.color; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = f.w * 0.7; ctx.stroke(); break;
      }
      case 'bolt': case 'lightning': {
        let p1, p2;
        if (f.type === 'bolt') { p1 = posXY(f.x1, f.y1); p2 = posXY(f.x2, f.y2); }
        else { p2 = P; p1 = { x: P.x + 20, y: P.y - 300 }; if (!f.sp) { f.sp = 1; spawnParts(P.x, P.y, 10, '#CFF4FF', 160, 0.4, 2.5); } }
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = f.type === 'lightning' ? 4 : 2.5; ctx.shadowColor = f.color; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
        const n = 8;
        for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * 18, p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * 10); }
        ctx.lineTo(p2.x, p2.y); ctx.stroke();
        if (f.type === 'lightning') { ctx.fillStyle = A.rgba('#CFF4FF', 0.5 * (1 - k)); ctx.beginPath(); ctx.ellipse(P.x, P.y, hw * 0.6, hw * 0.6 * b.sq, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'skillname': brushText(f.s, P.x, P.y - k * 18, 24 + (k < 0.15 ? (0.15 - k) * 60 : 0), f.color, k > 0.7 ? (1 - k) / 0.3 : 1); break;
      case 'castglow': {
        const u = f.u; if (u.dead) break; const q = posXY(u.x, u.y);
        const g = ctx.createRadialGradient(q.x, q.y - 20, 4, q.x, q.y - 20, hw * 0.7);
        g.addColorStop(0, A.rgba(f.color, 0.55 * (1 - k))); g.addColorStop(1, A.rgba(f.color, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y - 20, hw * 0.7, 0, TAU); ctx.fill(); break;
      }
      case 'glyph': brushText(f.s, P.x, P.y - 10, 44 + k * 20, f.color, 1 - k); break;
      case 'stars': {
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + f.t * 2, d = hw * 0.8 * (1 - k);
          ctx.fillStyle = f.color; ctx.globalAlpha = 1 - k * 0.5;
          ctx.beginPath(); A.star5(ctx, P.x + Math.cos(a) * d, P.y - 60 * (1 - k) + Math.sin(a) * d * 0.4, 7, 3); ctx.fill();
        }
        if (k > 0.5 && !f.sp) { f.sp = 1; spawnParts(P.x, P.y, 14, f.color, 180, 0.5, 2.5); }
        break;
      }
      case 'spin': case 'swords': {
        ctx.translate(P.x, P.y); ctx.scale(1, b.sq); ctx.rotate(f.t * 14 + (f.rot || 0));
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineCap = 'round'; ctx.shadowColor = f.color; ctx.shadowBlur = 10;
        const rr = f.r * hw * 0.8;
        if (f.type === 'spin') { ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 1.3); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, rr * 0.75, 0.5, Math.PI * 1.6); ctx.stroke(); }
        else { ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.beginPath(); ctx.moveTo(rr * 0.2, 0); ctx.lineTo(rr, 0); ctx.stroke(); } }
        break;
      }
      case 'runes': {
        const u = f.u; if (u.dead) break; const q = posXY(u.x, u.y);
        ctx.translate(q.x, q.y - 16); ctx.globalAlpha = 0.8;
        ctx.font = '14px ' + A.FONT_BRUSH; ctx.fillStyle = f.color; ctx.textAlign = 'center';
        const chars = '言灵操纵';
        for (let i = 0; i < 4; i++) { const a = f.t * 3 + i * TAU / 4; ctx.fillText(chars[i], Math.cos(a) * hw * 0.42, Math.sin(a) * hw * 0.2); }
        break;
      }
      case 'butterfly': {
        for (let i = 0; i < 3; i++) {
          const bx = P.x + Math.sin(f.t * 4 + i * 2) * 14 + (i - 1) * 12, by = P.y - 20 - k * 60 - i * 8;
          ctx.globalAlpha = 1 - k; ctx.fillStyle = '#9EDFF2';
          const wg = Math.abs(Math.sin(f.t * 18 + i));
          ctx.beginPath(); ctx.ellipse(bx - 4 * wg, by, 5 * wg + 1, 4, -0.5, 0, TAU); ctx.ellipse(bx + 4 * wg, by, 5 * wg + 1, 4, 0.5, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'claw': {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowColor = f.color; ctx.shadowBlur = 8;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(P.x - 18 + i * 8, P.y - 22); ctx.lineTo(P.x - 18 + i * 8 + 36 * Math.min(1, k * 3), P.y - 22 + 36 * Math.min(1, k * 3)); ctx.stroke(); }
        break;
      }
      case 'lotus': case 'moon': case 'petalburst': {
        if (!f.sp) { f.sp = 1; spawnParts(P.x, P.y - 10, f.type === 'petalburst' ? 12 : 20, f.color, 160, 0.7, 3, 20); }
        ctx.globalAlpha = 1 - k; ctx.fillStyle = A.rgba(f.color, 0.35);
        const rr = (f.r || 0.8) * hw * (0.5 + 0.5 * k);
        ctx.beginPath(); ctx.ellipse(P.x, P.y, rr, rr * b.sq, 0, 0, TAU); ctx.fill();
        if (f.type === 'moon') { ctx.shadowColor = '#CFE3FF'; ctx.shadowBlur = 16; ctx.fillStyle = '#F4F8FF'; ctx.beginPath(); ctx.arc(P.x, P.y - 70 + k * 30, 18, 0.6, TAU - 0.6); ctx.arc(P.x + 8, P.y - 74 + k * 30, 15, TAU - 0.9, 0.9, true); ctx.fill(); }
        break;
      }
      case 'swirl': {
        ctx.translate(P.x, P.y); ctx.scale(1, b.sq); ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.shadowColor = f.color; ctx.shadowBlur = 12;
        for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let i = 0; i < 40; i++) { const a = i / 40 * TAU * 1.5 + f.t * 6 + j * TAU / 3, rr = (i / 40) * f.r * hw * (1 - k * 0.5); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.stroke(); }
        break;
      }
      case 'ink': {
        ctx.translate(P.x, P.y); ctx.rotate(f.rot); ctx.globalAlpha = 0.85 * (1 - k);
        ctx.fillStyle = '#1A1420'; ctx.beginPath();
        const L = f.r * hw * Math.min(1, k * 3);
        ctx.moveTo(-L, -3); ctx.quadraticCurveTo(0, -14, L, -2); ctx.quadraticCurveTo(0, 8, -L, 3); ctx.fill();
        ctx.fillStyle = 'rgba(240,120,170,.6)'; ctx.fillRect(-L * 0.6, -1, L * 1.2, 2);
        break;
      }
      case 'pillar': {
        ctx.globalAlpha = 1 - k; const g = ctx.createLinearGradient(0, P.y - 260, 0, P.y);
        g.addColorStop(0, A.rgba(f.color, 0)); g.addColorStop(1, A.rgba(f.color, 0.8));
        ctx.fillStyle = g; const w = hw * 0.5 * (1 - k * 0.6);
        ctx.fillRect(P.x - w / 2, P.y - 260, w, 260);
        ctx.fillStyle = A.rgba(f.color, 0.6); ctx.beginPath(); ctx.ellipse(P.x, P.y, w, w * b.sq * 0.5, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'bind': {
        const u = f.u; if (u.dead) break; const q = posXY(u.x, u.y);
        ctx.strokeStyle = f.color; ctx.lineWidth = 4; ctx.shadowColor = f.color; ctx.shadowBlur = 10; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.ellipse(q.x, q.y - 26, hw * 0.34, hw * 0.1, Math.sin(f.t * 4) * 0.2, 0, TAU); ctx.stroke(); break;
      }
      case 'meteor': {
        const sx = P.x - 200, sy = P.y - 420;
        const mx = sx + (P.x - sx) * k, my = sy + (P.y - sy) * k;
        const g = ctx.createRadialGradient(mx, my, 2, mx, my, 40);
        g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.4, f.color); g.addColorStop(1, A.rgba(f.color, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 40, 0, TAU); ctx.fill();
        ctx.strokeStyle = A.rgba(f.color, 0.5); ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx - 60, my - 120); ctx.lineTo(mx, my); ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(P.x, P.y, hw * 2 * k, hw * 2 * k * b.sq, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'hand': {
        const top = cellXY(3, f.team === 0 ? 1 : 6);
        const k2 = Math.min(1, k * 2.2), y = top.y - 260 + k2 * 230;
        ctx.globalAlpha = k < 0.8 ? 0.9 : (1 - k) / 0.2 * 0.9;
        ctx.fillStyle = A.rgba(f.color, 0.25); ctx.fillRect(R.L.board.ox - hw * 0.6, f.team === 0 ? cellXY(0, 0).y - 40 : cellXY(0, 4).y - 40, hw * 8, hw * 2.8);
        ctx.translate(top.x, y); ctx.shadowColor = f.color; ctx.shadowBlur = 30;
        const g = ctx.createLinearGradient(0, -120, 0, 40); g.addColorStop(0, A.rgba(f.color, 0.2)); g.addColorStop(1, A.rgba('#F0D0FF', 0.9));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, 0, 70, 50, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-48 + i * 32, 52, 13, 38, (i - 1.5) * 0.12, 0, TAU); ctx.fill(); }
        ctx.beginPath(); ctx.ellipse(-78, 6, 12, 32, -0.9, 0, TAU); ctx.fill();
        if (k2 >= 1 && !f.sp) { f.sp = 1; spawnParts(top.x, top.y, 30, '#E8C0FF', 300, 0.8, 3.5); }
        break;
      }
      case 'shadow': case 'death': {
        if (!f.sp) { f.sp = 1; spawnParts(P.x, P.y - 20, f.type === 'death' ? 16 : 10, f.color, 120, 0.8, 3, -30); }
        if (f.type === 'death') { ctx.globalAlpha = 1 - k; brushText('✦', P.x, P.y - 40 - k * 40, 18, f.color, 1 - k); }
        break;
      }
    }
    ctx.restore();
  }
  function drawProj(p) {
    const q = posXY(p.x, p.y), hw = R.L.board.hw;
    ctx.save(); ctx.translate(q.x, q.y);
    const ang = p.line ? Math.atan2(p.dy * R.L.board.sq, p.dx) : Math.atan2(Math.sin(p.ang || 0) * R.L.board.sq, Math.cos(p.ang || 0));
    ctx.rotate(ang);
    ctx.shadowColor = p.color; ctx.shadowBlur = 10;
    switch (p.style) {
      case 'arrow': ctx.strokeStyle = '#F4E8C8'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(3, -4); ctx.lineTo(3, 4); ctx.fill(); break;
      case 'bullet': ctx.fillStyle = '#FFF4C8'; ctx.fillRect(-10, -1.5, 14, 3); break;
      case 'shell': ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, p.big ? 8 : 5, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-2, -2, 2, 0, TAU); ctx.fill(); break;
      case 'card': ctx.rotate(time * 20); ctx.fillStyle = '#C8342E'; ctx.fillRect(-5, -7, 10, 14); ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.strokeRect(-5, -7, 10, 14); break;
      case 'dagger': ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -3); ctx.lineTo(-6, 3); ctx.fill(); ctx.fillStyle = '#6A4A32'; ctx.fillRect(-12, -2, 6, 4); break;
      case 'orb': case 'bigorb': { const r = p.style === 'bigorb' ? 11 : 6; const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.8); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.4, p.color); g.addColorStop(1, A.rgba(p.color, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, TAU); ctx.fill(); break; }
      case 'fan': ctx.rotate(time * 18); ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 9, -2.4, -0.6); ctx.fill(); break;
      case 'ink': ctx.fillStyle = '#1A1420'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, TAU); ctx.fill(); break;
      case 'sunarrow': case 'fire': case 'beam': {
        const big = p.style === 'sunarrow' ? 1 : p.style === 'fire' ? 1.2 : 0.9;
        const g = ctx.createLinearGradient(-90 * big, 0, 20, 0);
        g.addColorStop(0, A.rgba(p.color, 0)); g.addColorStop(0.7, A.rgba(p.color, 0.8)); g.addColorStop(1, '#FFFFFF');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(24 * big, 0); ctx.lineTo(-90 * big, -14 * big); ctx.lineTo(-90 * big, 14 * big); ctx.closePath(); ctx.fill();
        if (Math.random() < 0.6) spawnParts(q.x, q.y, 1, p.color, 40, 0.4, 3, 0);
        break;
      }
      case 'dog': ctx.rotate(-ang); ctx.scale(Math.cos(ang) < 0 ? -1 : 1, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(10, -6, 6, 5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#2A2230'; ctx.beginPath(); ctx.arc(12, -7, 1.3, 0, TAU); ctx.fill(); break;
      default: ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawTexts(bt) {
    for (const t of bt.texts) {
      const q = posXY(t.x, t.y), k = t.t / t.dur;
      const pop = k < 0.12 ? 1 + (0.12 - k) * 5 : 1;
      ctx.save();
      ctx.globalAlpha = k > 0.65 ? (1 - k) / 0.35 : 1;
      ctx.font = '700 ' + Math.round(t.size * pop) + 'px ' + A.FONT_NUM;
      ctx.textAlign = 'center'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(15,10,20,.9)';
      const y = q.y - k * 34;
      ctx.strokeText(t.s, q.x, y); ctx.fillStyle = t.color; ctx.fillText(t.s, q.x, y);
      ctx.restore();
    }
  }

  /* ---------- 帧 ---------- */
  R.frame = function (dt, view) {
    time += dt;
    const L = R.L; if (!L) return;
    const pxScale = view.scale * view.dpr;
    const key = L.W + 'x' + L.H + '@' + pxScale.toFixed(3);
    if (key !== bgKey) { bg = buildBg(L.W, L.H, pxScale); bgKey = key; }
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);
    ctx.drawImage(bg, 0, 0, L.W, L.H);
    if (S.phase === 'menu') { drawAmbient(dt); return; }
    const bt = S.battle;
    // 震屏
    if (bt && bt.shake > 0) ctx.translate((Math.random() - 0.5) * bt.shake * 18, (Math.random() - 0.5) * bt.shake * 12);
    drawRiverShimmer();
    drawHighlights();
    const showBattle = bt && (S.phase === 'combat' || S.phase === 'result' || S.phase === 'over');
    const list = [];
    if (showBattle) {
      for (const u of bt.units) {
        if (u.dead && u.deadT > 0.6) continue;
        const q = posXY(u.x, u.y);
        list.push({ y: q.y, fn: () => drawBattleUnit(u, q) });
      }
    } else if (S.me) {
      for (const u of S.me.board) {
        if (R.drag && R.drag.unit === u) continue;
        const q = cellXY(u.c, u.r);
        list.push({ y: q.y, fn: () => { const d = drawUnit(u, q.x, q.y, { teamRing: '#6FE0C8' }); drawBars(q.x, d.top, u, { hpCol: '#58D68D', mana: startMana(u) }); } });
      }
      drawEnemyHint();
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.fn();
    // 备战席
    if (S.me) {
      S.me.bench.forEach((u, i) => {
        if (!u || (R.drag && R.drag.unit === u)) return;
        const p = benchXY(i);
        const d = drawUnit(u, p.x, p.y + 6, { still: false, noRing: false });
        drawBars(p.x, d.top, u, { hpCol: '#58D68D' });
      });
    }
    if (showBattle) {
      for (const p of bt.proj) drawProj(p);
      for (const f of bt.fx) drawFx(f, bt);
      drawTexts(bt);
      // 声音事件
      for (const e of bt.events) {
        if (e.k === 'hit') G.audio.play(e.type === 'phys' ? 'hit' : 'hitm');
        else if (e.k === 'cast') G.audio.play(e.big ? 'bigcast' : 'cast');
        else if (e.k === 'death') G.audio.play('death');
      }
      bt.events.length = 0;
    }
    drawParts(dt);
    drawAmbient(dt);
    // 拖拽
    if (R.drag && R.drag.moved) {
      const d = R.drag;
      if (d.kind === 'unit') {
        const r = drawUnit(d.unit, d.x, d.y + 20, { still: true, alpha: 0.92 });
        drawBars(d.x, r.top, d.unit, { hpCol: '#58D68D' });
      }
    }
  };
  function startMana(u) { const h = G.HEROES[u.hid]; if (!h || !h.mana) return null; let m = h.sm || 0; for (const i of u.items) m += (G.ITEMS[i].s || {}).mana || 0; return Math.min(1, m / h.mana); }
  function drawBattleUnit(u, q) {
    const a = u.anim;
    const deadA = u.dead ? Math.max(0, 1 - u.deadT / 0.6) : 1;
    const lift = u.lift || (u.air > 0 ? Math.sin(Math.min(1, 1 - u.air / (u.airDur || 1)) * Math.PI) * 1.2 : 0);
    const d = drawUnit(u, q.x, q.y, {
      shadow: u.shadow, face: a.face, lunge: a.atk > 0 ? Math.sin((0.2 - a.atk) / 0.2 * Math.PI) : 0, flash: a.flash,
      lift, hop: u.hop, alpha: deadA * (u.untarget > 0 ? 0.55 : 1), teamRing: u.team === 0 ? '#6FE0C8' : '#FF8A7A'
    });
    if (u.dead) return;
    const sh = u.shields.reduce((s, x) => s + x.a, 0);
    drawBars(q.x, d.top - (lift * R.L.board.hw * 0.45), u, { hpCol: u.team === 0 ? '#58D68D' : '#EF5350', hpR: u.hp / u.maxHp, shR: sh / u.maxHp, mana: u.manaMax > 0 ? u.mana / u.manaMax : null, maxHp: u.maxHp });
    if (u.stun > 0 && !u.air) {
      ctx.fillStyle = '#FFE27A';
      for (let i = 0; i < 3; i++) { const an = time * 5 + i * TAU / 3; ctx.beginPath(); A.star5(ctx, q.x + Math.cos(an) * 14, d.top - 22 + Math.sin(an) * 4, 4, 1.8); ctx.fill(); }
    }
    if (u.shen > 0) { ctx.fillStyle = '#F0C75E'; ctx.font = '700 11px ' + A.FONT_NUM; ctx.textAlign = 'left'; ctx.fillText('神' + u.shen, q.x + 28, d.top - 8); }
    if (u.hid === 'houyi' && u.stacks) { ctx.fillStyle = '#FFB43A'; ctx.font = '700 11px ' + A.FONT_NUM; ctx.textAlign = 'left'; ctx.fillText('焰' + u.stacks, q.x + 28, d.top + 4); }
  }
  function drawRiverShimmer() {
    const y = (cellXY(0, 3).y + cellXY(0, 4).y) / 2, b = R.L.board;
    ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#BFF0FF'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const x0 = b.ox - b.hw * 0.3 + ((time * 40 + i * 140) % (b.hw * 7.6));
      ctx.beginPath(); ctx.moveTo(x0, y + (i - 2) * 6); ctx.quadraticCurveTo(x0 + 14, y + (i - 2) * 6 - 3, x0 + 28, y + (i - 2) * 6); ctx.stroke();
    }
    ctx.restore();
  }
  function drawHighlights() {
    const b = R.L.board;
    const d = R.drag;
    if (d && d.moved && d.kind === 'unit' && S.phase !== 'combat') {
      for (let r = 4; r < 8; r++) for (let c = 0; c < 7; c++) {
        const p = cellXY(c, r); hexPath(p.x, p.y, b.R * 0.9, b.sq);
        ctx.fillStyle = 'rgba(111,224,200,.12)'; ctx.fill();
      }
      if (d.cell) { const p = cellXY(d.cell[0], d.cell[1]); hexPath(p.x, p.y, b.R * 0.92, b.sq); ctx.fillStyle = 'rgba(233,196,106,.35)'; ctx.fill(); ctx.strokeStyle = '#E9C46A'; ctx.lineWidth = 2.5; ctx.stroke(); }
    }
    if (d && d.moved && d.benchI != null) { const p = benchXY(d.benchI); ctx.strokeStyle = '#E9C46A'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, R.L.bench.w * 0.4, 12, 0, 0, TAU); ctx.stroke(); }
    if (d && d.moved && d.kind === 'item' && d.target) {
      const q = d.targetPos; ctx.strokeStyle = '#E9C46A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(q.x, q.y + 2, b.R * 0.75, b.R * 0.75 * b.sq * 0.6, 0, 0, TAU); ctx.stroke();
    }
    if (R.selected && S.phase !== 'combat') {
      const u = R.selected; const q = u.c != null && S.me.board.indexOf(u) >= 0 ? cellXY(u.c, u.r) : null;
      if (q) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; hexPath(q.x, q.y, b.R * 0.92, b.sq); ctx.stroke(); }
    }
  }
  function drawEnemyHint() {
    const R0 = S.round; if (!R0) return;
    const p = cellXY(3, 1);
    let s;
    if (R0.pve) s = { w1: '野怪回合 · 暗影小兵', w2: '野怪回合 · 暗影小兵', w3: '野怪回合 · 暗影小兵', golems: '野怪回合 · 魔像', tyrant: '首领 · 暴君', overlord: '首领 · 主宰', storm: '首领 · 风暴龙王', shadow: '暗影军团来袭' }[R0.pve];
    else s = S.opp ? '下一回合对手 · ' + S.opp.name : '';
    if (!s) return;
    ctx.save(); ctx.globalAlpha = 0.55 + 0.15 * Math.sin(time * 2);
    ctx.font = '26px ' + A.FONT_BRUSH; ctx.textAlign = 'center'; ctx.fillStyle = R0.pve && R0.pve !== 'shadow' && R0.pve.length > 3 ? '#FFC9A8' : '#F4EAD5';
    ctx.fillText(s, p.x, p.y + 10);
    ctx.restore();
  }

  /* ---------- 交互 ---------- */
  function toLocal(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * R.L.W, y: (e.clientY - r.top) / r.height * R.L.H };
  }
  function cellAt(x, y) {
    const b = R.L.board; let best = null, bd = 1e9;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) { const p = cellXY(c, r); const d = Math.hypot(p.x - x, (p.y - y) / b.sq); if (d < bd) { bd = d; best = [c, r]; } }
    return bd < b.R * 1.05 ? best : null;
  }
  function benchAt(x, y) {
    const bn = R.L.bench;
    if (Math.abs(y - (bn.y - 18)) > 42) return null;
    const i = Math.floor((x - bn.x) / bn.w);
    return i >= 0 && i < G.BENCH ? i : null;
  }
  function unitAt(x, y) {
    const me = S.me; if (!me) return null;
    const b = R.L.board;
    const hitR = b.hw * 0.42;
    // 备战席
    for (let i = 0; i < G.BENCH; i++) { const u = me.bench[i]; if (!u) continue; const p = benchXY(i); if (Math.abs(x - p.x) < hitR && y < p.y + 14 && y > p.y - b.hw * 1.05) return { u, where: 'bench', i }; }
    if (S.phase === 'combat' || S.phase === 'result') {
      const bt = S.battle; if (!bt) return null;
      let best = null, bd = 1e9;
      for (const u of bt.units) { if (u.dead) continue; const q = posXY(u.x, u.y); if (Math.abs(x - q.x) < hitR && y < q.y + 12 && y > q.y - b.hw * 1.05) { const d = Math.abs(q.y - 30 - y); if (d < bd) { bd = d; best = u; } } }
      return best ? { u: best, where: 'battle' } : null;
    }
    let best = null, bd = 1e9;
    for (const u of me.board) { const q = cellXY(u.c, u.r); if (Math.abs(x - q.x) < hitR && y < q.y + 12 && y > q.y - b.hw * 1.05) { const d = Math.abs(q.y - 30 - y); if (d < bd) { bd = d; best = u; } } }
    return best ? { u: best, where: 'board' } : null;
  }
  R.unitAt = unitAt;
  function onDown(e) {
    if (!R.L || S.phase === 'menu' || S.phase === 'over') return;
    G.audio.init();
    const p = toLocal(e);
    const hit = unitAt(p.x, p.y);
    if (!hit) { R.selected = null; G.ui.hideUnit(); return; }
    if (hit.where === 'battle') { G.ui.showUnit(hit.u, true); return; }
    R.drag = { kind: 'unit', unit: hit.u, from: hit.where, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, pid: e.pointerId };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  }
  R.startItemDrag = function (idx, e) {
    const p = toLocal(e);
    R.drag = { kind: 'item', idx, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: true, pid: e.pointerId };
  };
  function onMove(e) {
    if (!R.L) return;
    const p = toLocal(e);
    R.mouse = p;
    const d = R.drag;
    if (!d) { R.hoverUnit = S.phase === 'planning' || S.phase === 'combat' ? unitAt(p.x, p.y) : null; return; }
    d.x = p.x; d.y = p.y;
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 8) { d.moved = true; if (d.kind === 'unit') { G.ui.hideUnit(); G.ui.showSell(d.unit); } }
    if (!d.moved) return;
    if (d.kind === 'unit') {
      d.cell = S.phase === 'combat' ? null : cellAt(p.x, p.y + 10);
      if (d.cell && d.cell[1] < 4) d.cell = null;
      d.benchI = d.cell ? null : benchAt(p.x, p.y);
      G.ui.sellHover(G.ui.overSell(e.clientX, e.clientY));
    } else {
      const hit = unitAt(p.x, p.y);
      d.target = hit && hit.where !== 'battle' ? hit.u : null;
      if (d.target) d.targetPos = hit.where === 'bench' ? benchXY(hit.i) : cellXY(hit.u.c, hit.u.r);
      G.ui.dragItemGhost(e.clientX, e.clientY, d.idx);
    }
  }
  function onUp(e) {
    const d = R.drag; if (!d) return;
    R.drag = null;
    const me = S.me;
    if (d.kind === 'item') {
      G.ui.dragItemGhost(null);
      if (d.target) G.act.equip(me, d.idx, d.target);
      return;
    }
    const overSell = d.moved && G.ui.overSell(e.clientX, e.clientY);
    G.ui.hideSell();
    if (!d.moved) { R.selected = d.unit; G.ui.showUnit(d.unit, false); G.audio.play('click'); return; }
    if (overSell) { G.act.sell(me, d.unit); R.selected = null; return; }
    if (d.cell) G.act.move(me, d.unit, { type: 'board', c: d.cell[0], r: d.cell[1] });
    else if (d.benchI != null) G.act.move(me, d.unit, { type: 'bench', i: d.benchI });
  }
  R.burst = function (x, y, col, n) { spawnParts(x, y, n || 30, col, 240, 0.9, 3.5, 60); };
  R.hoverSellKey = function () { const h = R.hoverUnit; if (h && h.where !== 'battle') return h.u; return null; };
})(window.G);
