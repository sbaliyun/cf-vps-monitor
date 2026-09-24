'use strict';
/* 王者之弈 · 程序化美术：Q版英雄、野怪、图标 */
(function (G) {
  const A = G.art = {};
  const OL = '#241A2C';
  const K = 1.6; // 精灵渲染倍率
  A.K = K;
  A.FONT_BRUSH = '"Ma Shan Zheng", "STKaiti", "KaiTi", serif';
  A.FONT_UI = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  A.FONT_NUM = '"Barlow Condensed", "PingFang SC", "Microsoft YaHei", sans-serif';

  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(h, a) {
    const [r, g, b] = hex2rgb(h);
    const t = a < 0 ? 0 : 255, p = Math.abs(a);
    const f = v => Math.round(v + (t - v) * p);
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function rgba(h, al) { const [r, g, b] = hex2rgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + al + ')'; }
  A.shade = shade; A.rgba = rgba;

  function P(ctx, fill, fn, lw) {
    ctx.beginPath(); fn();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw !== 0) { ctx.lineWidth = lw || 2.4; ctx.strokeStyle = OL; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function ell(ctx, x, y, rx, ry, rot) { ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }
  function capsule(ctx, x1, y1, x2, y2, w, fill) {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = OL; ctx.lineWidth = w + 4; ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
  }
  function pole(ctx, x1, y1, x2, y2, w, fill) { capsule(ctx, x1, y1, x2, y2, w, fill); }
  function star5(ctx, x, y, r1, r2) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r2 : r1;
      i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  A.star5 = star5;

  /* ---------------- 武器 ---------------- */
  const FRONT_WEAPONS = { fan: 1, featherfan: 1, card: 1, orb: 1, book: 1, gun: 1, handcannon: 1, claw: 1, ribbon: 1, shield: 1 };
  function drawWeapon(ctx, L) {
    const c = L.wc || '#CCD3DA', w = L.wp;
    switch (w) {
      case 'sword':
        P(ctx, c, () => { ctx.moveTo(93, 108); ctx.lineTo(112, 56); ctx.lineTo(116, 60); ctx.lineTo(99, 110); ctx.closePath(); });
        P(ctx, '#E6B94A', () => { ctx.moveTo(88, 106); ctx.lineTo(104, 112); ctx.lineTo(102, 116); ctx.lineTo(86, 110); ctx.closePath(); });
        capsule(ctx, 94, 113, 90, 124, 4, '#5A3A2A');
        break;
      case 'greatsword':
        P(ctx, c, () => { ctx.moveTo(92, 108); ctx.lineTo(114, 44); ctx.lineTo(124, 40); ctx.lineTo(122, 52); ctx.lineTo(102, 114); ctx.closePath(); });
        P(ctx, shade(c, 0.5), () => { ctx.moveTo(98, 104); ctx.lineTo(116, 52); ctx.lineTo(119, 50); ctx.lineTo(101, 106); ctx.closePath(); }, 0);
        P(ctx, '#3A3A48', () => { ctx.moveTo(84, 106); ctx.lineTo(108, 116); ctx.lineTo(106, 121); ctx.lineTo(82, 111); ctx.closePath(); });
        capsule(ctx, 94, 116, 90, 128, 5, '#4A3226');
        break;
      case 'dagger':
        P(ctx, c, () => { ctx.moveTo(92, 110); ctx.lineTo(106, 90); ctx.lineTo(108, 94); ctx.lineTo(96, 114); ctx.closePath(); });
        P(ctx, '#C9A24A', () => { ell(ctx, 94, 113, 5, 2.5, -0.9); });
        break;
      case 'spear':
        pole(ctx, 101, 150, 101, 38, 4, '#8A5A3A');
        P(ctx, c, () => { ctx.moveTo(101, 14); ctx.lineTo(107, 38); ctx.lineTo(101, 44); ctx.lineTo(95, 38); ctx.closePath(); });
        P(ctx, '#E0463A', () => { ctx.moveTo(96, 44); ctx.lineTo(106, 44); ctx.lineTo(108, 58); ctx.lineTo(101, 54); ctx.lineTo(94, 58); ctx.closePath(); });
        break;
      case 'halberd':
        pole(ctx, 102, 152, 102, 30, 4.5, '#3A2A2A');
        P(ctx, c, () => { ctx.moveTo(102, 6); ctx.lineTo(108, 30); ctx.lineTo(96, 30); ctx.closePath(); });
        P(ctx, c, () => { ctx.moveTo(104, 34); ctx.quadraticCurveTo(126, 30, 122, 52); ctx.quadraticCurveTo(114, 42, 104, 46); ctx.closePath(); });
        P(ctx, c, () => { ctx.moveTo(100, 34); ctx.quadraticCurveTo(78, 30, 82, 52); ctx.quadraticCurveTo(90, 42, 100, 46); ctx.closePath(); });
        P(ctx, '#D8403A', () => { ctx.moveTo(98, 48); ctx.lineTo(106, 48); ctx.lineTo(104, 62); ctx.lineTo(100, 62); ctx.closePath(); });
        break;
      case 'trident':
        pole(ctx, 101, 150, 101, 36, 4, '#6A7482');
        P(ctx, c, () => {
          ctx.moveTo(88, 20); ctx.lineTo(91, 36); ctx.lineTo(111, 36); ctx.lineTo(114, 20); ctx.lineTo(108, 30);
          ctx.lineTo(104, 30); ctx.lineTo(101, 10); ctx.lineTo(98, 30); ctx.lineTo(94, 30); ctx.closePath();
        });
        break;
      case 'staff':
        pole(ctx, 100, 150, 100, 36, 4.5, c);
        P(ctx, '#E8D07A', () => { ell(ctx, 100, 30, 9, 9); });
        P(ctx, '#7FE0C0', () => { ell(ctx, 100, 30, 4, 4); }, 0);
        capsule(ctx, 100, 40, 108, 52, 3, '#C84A3A');
        break;
      case 'bow':
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(82, 102, 40, -1.05, 1.05);
        ctx.strokeStyle = OL; ctx.lineWidth = 8; ctx.stroke();
        ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(82 + Math.cos(-1.05) * 40, 102 + Math.sin(-1.05) * 40);
        ctx.lineTo(82 + Math.cos(1.05) * 40, 102 + Math.sin(1.05) * 40);
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.4; ctx.stroke();
        break;
      case 'rifle':
        capsule(ctx, 64, 124, 124, 98, 5, '#3A3440');
        P(ctx, c, () => { ctx.moveTo(62, 118); ctx.lineTo(84, 110); ctx.lineTo(88, 124); ctx.lineTo(66, 132); ctx.closePath(); });
        P(ctx, '#6A6A7A', () => { ctx.rect(96, 104, 14, 5); });
        break;
      case 'gun':
        P(ctx, '#3A3440', () => { ctx.moveTo(88, 106); ctx.lineTo(112, 100); ctx.lineTo(113, 106); ctx.lineTo(92, 112); ctx.closePath(); });
        P(ctx, c, () => { ctx.moveTo(88, 108); ctx.lineTo(95, 108); ctx.lineTo(96, 122); ctx.lineTo(89, 122); ctx.closePath(); });
        break;
      case 'handcannon':
        P(ctx, c, () => { ctx.moveTo(80, 104); ctx.lineTo(116, 96); ctx.lineTo(119, 114); ctx.lineTo(83, 120); ctx.closePath(); });
        P(ctx, '#E6B94A', () => { ell(ctx, 117, 105, 5, 10, 0.2); });
        P(ctx, '#2A2230', () => { ell(ctx, 118, 105, 2.5, 6, 0.2); }, 0);
        break;
      case 'cannon':
        P(ctx, c, () => { ctx.moveTo(74, 80); ctx.lineTo(112, 62); ctx.lineTo(120, 78); ctx.lineTo(82, 96); ctx.closePath(); });
        P(ctx, '#E0A43A', () => { ell(ctx, 116, 70, 5, 9, -0.45); });
        P(ctx, '#2A2230', () => { ell(ctx, 117, 70, 2.5, 5, -0.45); }, 0);
        break;
      case 'hammer':
        capsule(ctx, 94, 124, 108, 70, 5, '#6A4A32');
        P(ctx, c, () => { ctx.moveTo(94, 52); ctx.lineTo(124, 60); ctx.lineTo(119, 80); ctx.lineTo(89, 72); ctx.closePath(); });
        P(ctx, shade(c, -0.3), () => { ctx.rect(104, 60, 6, 16); }, 0);
        break;
      case 'fan': {
        ctx.save(); ctx.translate(96, 110);
        P(ctx, c, () => { ctx.moveTo(0, 0); ctx.arc(0, 0, 24, -2.5, -0.55); ctx.closePath(); });
        ctx.strokeStyle = shade(c, -0.35); ctx.lineWidth = 1;
        for (let i = 0; i <= 6; i++) { const a = -2.5 + i * (1.95 / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 23, Math.sin(a) * 23); ctx.stroke(); }
        P(ctx, '#FFF4D8', () => { ctx.arc(0, 0, 24, -2.5, -0.55); ctx.arc(0, 0, 17, -0.55, -2.5, true); ctx.closePath(); }, 0);
        ctx.restore();
        break;
      }
      case 'featherfan':
        capsule(ctx, 92, 116, 98, 102, 3, '#8A6A4A');
        P(ctx, c, () => { ctx.moveTo(98, 102); ctx.bezierCurveTo(80, 90, 90, 62, 104, 62); ctx.bezierCurveTo(118, 62, 122, 90, 98, 102); });
        ctx.strokeStyle = '#C8D0DA'; ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(98, 100); ctx.lineTo(90 + i * 6, 68); ctx.stroke(); }
        break;
      case 'card':
        for (let i = 0; i < 3; i++) {
          ctx.save(); ctx.translate(96, 110); ctx.rotate(-0.5 + i * 0.35);
          P(ctx, i === 1 ? '#C8342E' : c, () => { ctx.rect(-5, -20, 11, 16); });
          ctx.fillStyle = '#FFF'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'center'; ctx.fillText('令', 0.5, -9);
          ctx.restore();
        }
        break;
      case 'book':
        P(ctx, c, () => { ctx.rect(84, 102, 22, 18); });
        P(ctx, '#F4ECD8', () => { ctx.rect(86, 104, 18, 3); }, 0);
        P(ctx, '#E6B94A', () => { ell(ctx, 95, 112, 3, 3); }, 0);
        break;
      case 'ruler':
        P(ctx, c, () => { ctx.moveTo(92, 120); ctx.lineTo(112, 66); ctx.lineTo(119, 69); ctx.lineTo(99, 123); ctx.closePath(); });
        ctx.strokeStyle = OL; ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) { const y = 74 + i * 8, x = 112 - i * 2.9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + 1); ctx.stroke(); }
        break;
      case 'claw':
        for (const [hx, hy, d] of [[92, 116, 1], [36, 118, -1]]) {
          for (let i = 0; i < 3; i++) P(ctx, c, () => { ctx.moveTo(hx, hy - 3 + i * 3); ctx.lineTo(hx + d * 18, hy - 12 + i * 5); ctx.lineTo(hx + d * 3, hy + i * 3); ctx.closePath(); }, 1.5);
        }
        break;
      case 'orb': {
        const g = ctx.createRadialGradient(100, 96, 1, 100, 96, 16);
        g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.35, c); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(100, 96, 16, 0, 7); ctx.fill();
        P(ctx, c, () => { ctx.arc(100, 96, 7.5, 0, 7); }, 1.6);
        P(ctx, 'rgba(255,255,255,.9)', () => { ctx.arc(97.5, 93.5, 2.4, 0, 7); }, 0);
        break;
      }
      case 'umbrella':
        capsule(ctx, 92, 116, 100, 64, 2.5, '#8A5A4A');
        P(ctx, c, () => { ctx.moveTo(72, 70); ctx.quadraticCurveTo(96, 28, 128, 60); ctx.quadraticCurveTo(118, 58, 112, 66); ctx.quadraticCurveTo(104, 60, 98, 68); ctx.quadraticCurveTo(90, 62, 84, 70); ctx.quadraticCurveTo(78, 66, 72, 70); ctx.closePath(); });
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(100, 40); ctx.lineTo(98, 66); ctx.moveTo(100, 40); ctx.lineTo(84, 68); ctx.moveTo(100, 40); ctx.lineTo(112, 64); ctx.stroke();
        break;
      case 'ribbon':
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(92, 116); ctx.bezierCurveTo(124, 100, 110, 70, 122, 50);
        ctx.moveTo(38, 118); ctx.bezierCurveTo(8, 108, 18, 76, 6, 60);
        ctx.strokeStyle = OL; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 3.5; ctx.stroke();
        break;
      case 'brush':
        capsule(ctx, 90, 124, 112, 62, 4, '#7A5230');
        P(ctx, c, () => { ctx.moveTo(108, 60); ctx.quadraticCurveTo(114, 44, 120, 38); ctx.quadraticCurveTo(122, 52, 116, 64); ctx.closePath(); });
        break;
      case 'shield':
        P(ctx, c, () => { ctx.arc(34, 112, 17, 0, 7); });
        P(ctx, shade(c, -0.3), () => { ctx.arc(34, 112, 11, 0, 7); }, 1.4);
        ctx.fillStyle = '#FFF4C8'; ctx.font = 'bold 12px serif'; ctx.textAlign = 'center'; ctx.fillText('汉', 34, 116.5);
        break;
      case 'sickle':
        capsule(ctx, 92, 118, 104, 82, 3.5, '#4A3A3A');
        P(ctx, c, () => { ctx.moveTo(104, 82); ctx.quadraticCurveTo(126, 70, 122, 98); ctx.quadraticCurveTo(118, 82, 106, 88); ctx.closePath(); });
        ctx.strokeStyle = '#9AA3AE'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(92, 118); ctx.quadraticCurveTo(70, 140, 40, 126); ctx.stroke(); ctx.setLineDash([]);
        break;
    }
  }

  /* ---------------- Q版英雄 ---------------- */
  function drawChibi(ctx, L) {
    const hair = L.hair || '#2A2230', out = L.out || '#8A6A4A', out2 = L.out2 || '#E6B94A', skin = L.skin || '#FBE0CC';
    const ext = L.ext || [], has = e => ext.indexOf(e) >= 0;
    const bulk = L.bulk || 1;
    const covered = L.hat === 'hood' || L.hat === 'tiger';

    // 光环
    if (has('halo')) {
      ctx.save(); ctx.shadowColor = '#FFE27A'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(64, 58, 46, 0, 7); ctx.strokeStyle = '#FFE27A'; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(64, 58, 52, 0, 7); ctx.strokeStyle = 'rgba(255,226,122,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // 披风
    if (has('cape')) {
      P(ctx, L.capec || '#8C1D1D', () => {
        ctx.moveTo(42, 92); ctx.lineTo(86, 92); ctx.quadraticCurveTo(104, 120, 104, 148);
        ctx.quadraticCurveTo(94, 142, 86, 150); ctx.quadraticCurveTo(64, 142, 42, 150);
        ctx.quadraticCurveTo(34, 142, 24, 148); ctx.quadraticCurveTo(24, 120, 42, 92); ctx.closePath();
      });
    }
    // 狐尾
    if (has('tail')) {
      P(ctx, '#FFF4F0', () => { ctx.moveTo(78, 128); ctx.bezierCurveTo(118, 132, 126, 96, 110, 78); ctx.bezierCurveTo(112, 100, 100, 116, 76, 116); ctx.closePath(); });
      P(ctx, '#F28FA6', () => { ctx.moveTo(110, 78); ctx.bezierCurveTo(118, 88, 118, 96, 116, 100); ctx.bezierCurveTo(112, 92, 110, 86, 104, 84); ctx.closePath(); }, 0);
    }
    // 后发
    if (!covered) {
      if (L.hs === 'long') P(ctx, hair, () => { ctx.moveTo(30, 56); ctx.bezierCurveTo(18, 92, 20, 122, 30, 138); ctx.quadraticCurveTo(64, 146, 98, 138); ctx.bezierCurveTo(108, 122, 110, 92, 98, 56); ctx.closePath(); });
      if (L.hs === 'ponytail') P(ctx, hair, () => { ctx.moveTo(86, 30); ctx.bezierCurveTo(126, 40, 124, 100, 104, 128); ctx.bezierCurveTo(108, 96, 104, 64, 80, 44); ctx.closePath(); });
      if (L.hs === 'twin') {
        P(ctx, hair, () => { ctx.moveTo(34, 44); ctx.bezierCurveTo(8, 60, 6, 100, 18, 122); ctx.bezierCurveTo(22, 96, 28, 70, 42, 56); ctx.closePath(); });
        P(ctx, hair, () => { ctx.moveTo(94, 44); ctx.bezierCurveTo(120, 60, 122, 100, 110, 122); ctx.bezierCurveTo(106, 96, 100, 70, 86, 56); ctx.closePath(); });
      }
      if (L.hs === 'bun') { P(ctx, hair, () => { ell(ctx, 64, 22, 15, 12); }); P(ctx, out2, () => { ctx.rect(48, 26, 32, 4); }, 1.2); }
      if (L.hs === 'twinbun') { P(ctx, hair, () => { ell(ctx, 38, 28, 12, 11); }); P(ctx, hair, () => { ell(ctx, 90, 28, 12, 11); }); }
      if (L.hs === 'topknot') { P(ctx, hair, () => { ell(ctx, 64, 22, 9, 8); }); capsule(ctx, 50, 22, 78, 20, 2, out2); }
      P(ctx, hair, () => { ell(ctx, 64, 58, 37, 35); });
    } else {
      P(ctx, L.hatc || out, () => { ell(ctx, 64, 60, 41, 39); });
      if (L.hat === 'tiger') { P(ctx, L.hatc || '#E8912E', () => { ell(ctx, 34, 26, 10, 10); }); P(ctx, L.hatc || '#E8912E', () => { ell(ctx, 94, 26, 10, 10); }); }
    }
    if (has('beastEars')) {
      P(ctx, hair, () => { ctx.moveTo(34, 40); ctx.quadraticCurveTo(22, 14, 42, 22); ctx.closePath(); });
      P(ctx, hair, () => { ctx.moveTo(94, 40); ctx.quadraticCurveTo(106, 14, 86, 22); ctx.closePath(); });
    }
    // 腿 / 蛇尾
    const pants = shade(out, -0.4);
    if (has('snakeTail')) {
      P(ctx, '#4FA88A', () => { ctx.moveTo(44, 124); ctx.bezierCurveTo(20, 150, 70, 160, 108, 150); ctx.bezierCurveTo(118, 146, 116, 136, 104, 138); ctx.bezierCurveTo(80, 144, 56, 142, 84, 124); ctx.closePath(); });
      ctx.strokeStyle = '#F4D06A'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(52 + i * 10, 146 - Math.sin(i) * 2, 3, 0, Math.PI); ctx.stroke(); }
    } else {
      P(ctx, pants, () => { ctx.roundRect ? ctx.roundRect(50, 124, 12, 26, 4) : ctx.rect(50, 124, 12, 26); });
      P(ctx, pants, () => { ctx.roundRect ? ctx.roundRect(66, 124, 12, 26, 4) : ctx.rect(66, 124, 12, 26); });
      P(ctx, '#2E2530', () => { ell(ctx, 55, 150, 8, 4); });
      P(ctx, '#2E2530', () => { ell(ctx, 73, 150, 8, 4); });
    }
    // 躯干
    ctx.save(); ctx.translate(64, 0); ctx.scale(bulk, 1); ctx.translate(-64, 0);
    const st = L.style || 'robe';
    if (st === 'robe') {
      P(ctx, out, () => { ctx.moveTo(46, 88); ctx.lineTo(82, 88); ctx.quadraticCurveTo(92, 118, 96, 146); ctx.quadraticCurveTo(64, 154, 32, 146); ctx.quadraticCurveTo(36, 118, 46, 88); ctx.closePath(); });
      P(ctx, out2, () => { ctx.moveTo(60, 90); ctx.lineTo(68, 90); ctx.lineTo(70, 150); ctx.lineTo(58, 150); ctx.closePath(); }, 1.4);
      P(ctx, out2, () => { ctx.moveTo(33, 142); ctx.quadraticCurveTo(64, 150, 95, 142); ctx.lineTo(96, 147); ctx.quadraticCurveTo(64, 155, 32, 147); ctx.closePath(); }, 1.4);
      P(ctx, shade(out2, -0.2), () => { ctx.rect(46, 110, 36, 6); }, 1.4);
    } else if (st === 'dress') {
      P(ctx, out, () => {
        ctx.moveTo(48, 88); ctx.lineTo(80, 88); ctx.lineTo(78, 112); ctx.quadraticCurveTo(96, 130, 100, 146);
        for (let i = 0; i < 6; i++) ctx.quadraticCurveTo(95 - i * 11.3, 154, 89.4 - i * 11.3, 146);
        ctx.quadraticCurveTo(32, 130, 50, 112); ctx.closePath();
      });
      P(ctx, out2, () => { ctx.rect(49, 108, 30, 7); }, 1.4);
      P(ctx, out2, () => { ctx.moveTo(56, 88); ctx.lineTo(64, 100); ctx.lineTo(72, 88); ctx.closePath(); }, 1.2);
    } else if (st === 'armor') {
      P(ctx, out, () => { ctx.roundRect ? ctx.roundRect(43, 88, 42, 44, 8) : ctx.rect(43, 88, 42, 44); });
      P(ctx, out2, () => { ctx.moveTo(52, 92); ctx.lineTo(76, 92); ctx.lineTo(72, 110); ctx.lineTo(64, 114); ctx.lineTo(56, 110); ctx.closePath(); }, 1.4);
      P(ctx, '#2E2530', () => { ctx.rect(43, 118, 42, 7); }, 1.4);
      P(ctx, out2, () => { ell(ctx, 64, 121.5, 5, 4.5); }, 1.2);
      P(ctx, shade(out, -0.15), () => { ctx.moveTo(44, 124); ctx.lineTo(84, 124); ctx.lineTo(88, 138); ctx.lineTo(40, 138); ctx.closePath(); });
      P(ctx, out2, () => { ell(ctx, 42, 94, 12, 9, -0.3); });
      P(ctx, out2, () => { ell(ctx, 86, 94, 12, 9, 0.3); });
    } else {
      P(ctx, out, () => { ctx.moveTo(45, 88); ctx.lineTo(83, 88); ctx.lineTo(88, 138); ctx.lineTo(40, 138); ctx.closePath(); });
      P(ctx, out2, () => { ctx.moveTo(58, 88); ctx.lineTo(70, 88); ctx.lineTo(72, 138); ctx.lineTo(56, 138); ctx.closePath(); }, 1.4);
      P(ctx, shade(out, -0.3), () => { ctx.rect(44, 114, 40, 6); }, 1.4);
      P(ctx, shade(out, 0.2), () => { ctx.moveTo(48, 86); ctx.lineTo(58, 100); ctx.lineTo(56, 88); ctx.closePath(); ctx.moveTo(80, 86); ctx.lineTo(70, 100); ctx.lineTo(72, 88); ctx.closePath(); }, 1.2);
    }
    ctx.restore();
    // 围巾
    if (has('scarf')) {
      const sc = L.scarfc || '#C83A3A';
      P(ctx, sc, () => { ctx.moveTo(78, 90); ctx.bezierCurveTo(96, 96, 104, 112, 116, 110); ctx.bezierCurveTo(110, 118, 96, 116, 80, 100); ctx.closePath(); });
      P(ctx, sc, () => { ctx.roundRect ? ctx.roundRect(44, 84, 40, 10, 5) : ctx.rect(44, 84, 40, 10); });
    }
    if (has('gourd')) {
      P(ctx, '#D9A441', () => { ell(ctx, 40, 132, 7, 8); ell(ctx, 40, 121, 5, 5); });
      P(ctx, '#C8423A', () => { ctx.rect(37, 114, 6, 3); }, 0);
    }
    if (has('ring')) {
      ctx.save(); ctx.shadowColor = '#FFD65A'; ctx.shadowBlur = 8;
      ctx.beginPath(); ell(ctx, 64, 104, 36, 9); ctx.strokeStyle = OL; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = '#F4C04A'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    }
    // 武器（身后层）
    if (L.wp && !FRONT_WEAPONS[L.wp]) drawWeapon(ctx, L);
    // 手臂
    const sleeve = st === 'armor' ? shade(out, -0.1) : out;
    capsule(ctx, 46, 94, 38, 115, 10, sleeve);
    capsule(ctx, 82, 94, 91, 113, 10, sleeve);
    P(ctx, skin, () => { ctx.arc(37, 117, 5.5, 0, 7); }, 2);
    P(ctx, skin, () => { ctx.arc(92, 115, 5.5, 0, 7); }, 2);
    if (L.wp && FRONT_WEAPONS[L.wp]) drawWeapon(ctx, L);

    // 头
    P(ctx, skin, () => { ell(ctx, 33, 68, 5, 7); });
    P(ctx, skin, () => { ell(ctx, 95, 68, 5, 7); });
    P(ctx, skin, () => { ell(ctx, 64, 64, 32, 29); });
    // 眼睛
    const iris = L.eye || '#3A2A4A';
    for (const ex of [51, 77]) {
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ell(ctx, ex, 69, 6.4, 8); ctx.fill();
      ctx.fillStyle = iris; ctx.beginPath(); ell(ctx, ex, 70, 5.4, 7); ctx.fill();
      const g = ctx.createLinearGradient(0, 63, 0, 77);
      g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(255,255,255,.18)');
      ctx.fillStyle = g; ctx.beginPath(); ell(ctx, ex, 70, 5.4, 7); ctx.fill();
      ctx.fillStyle = '#16101C'; ctx.beginPath(); ell(ctx, ex, 70.5, 2.7, 3.8); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ex - 2, 66.8, 2.2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 2.2, 73, 1.1, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex, 69, 7.2, 8.8, 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
    }
    // 腮红与嘴
    ctx.fillStyle = 'rgba(255,120,140,.28)';
    ctx.beginPath(); ell(ctx, 43, 79, 5.5, 3); ctx.fill(); ctx.beginPath(); ell(ctx, 85, 79, 5.5, 3); ctx.fill();
    if (!has('mask')) {
      ctx.beginPath(); ctx.arc(64, 79, 3.6, 0.2, Math.PI - 0.2); ctx.strokeStyle = OL; ctx.lineWidth = 1.8; ctx.stroke();
    }
    // 胡须
    const bc = L.beard || hair;
    if (has('beard')) P(ctx, bc, () => { ctx.moveTo(42, 76); ctx.quadraticCurveTo(44, 100, 64, 104); ctx.quadraticCurveTo(84, 100, 86, 76); ctx.quadraticCurveTo(76, 90, 64, 86); ctx.quadraticCurveTo(52, 90, 42, 76); ctx.closePath(); });
    if (has('beardLong')) {
      P(ctx, bc, () => { ctx.moveTo(46, 80); ctx.quadraticCurveTo(48, 110, 64, 126); ctx.quadraticCurveTo(80, 110, 82, 80); ctx.quadraticCurveTo(74, 88, 64, 86); ctx.quadraticCurveTo(54, 88, 46, 80); ctx.closePath(); });
      P(ctx, bc, () => { ctx.moveTo(64, 82); ctx.quadraticCurveTo(52, 80, 44, 88); ctx.quadraticCurveTo(54, 84, 64, 86); ctx.quadraticCurveTo(74, 84, 84, 88); ctx.quadraticCurveTo(76, 80, 64, 82); ctx.closePath(); }, 1.2);
    }
    if (has('beardSmall')) {
      P(ctx, bc, () => { ctx.moveTo(58, 86); ctx.lineTo(70, 86); ctx.lineTo(64, 96); ctx.closePath(); }, 1.2);
      P(ctx, bc, () => { ctx.moveTo(64, 82); ctx.quadraticCurveTo(54, 80, 50, 86); ctx.quadraticCurveTo(56, 83, 64, 84); ctx.quadraticCurveTo(72, 83, 78, 86); ctx.quadraticCurveTo(74, 80, 64, 82); ctx.closePath(); }, 1);
    }
    if (has('mask')) P(ctx, shade(L.hatc || out, -0.2), () => { ctx.moveTo(38, 74); ctx.quadraticCurveTo(64, 70, 90, 74); ctx.quadraticCurveTo(88, 92, 64, 94); ctx.quadraticCurveTo(40, 92, 38, 74); ctx.closePath(); });

    // 刘海
    if (!covered) {
      if (L.hs === 'spiky') {
        P(ctx, hair, () => {
          ctx.moveTo(28, 72); ctx.lineTo(24, 46); ctx.lineTo(18, 38); ctx.lineTo(32, 34); ctx.lineTo(30, 18); ctx.lineTo(46, 24); ctx.lineTo(52, 8);
          ctx.lineTo(62, 22); ctx.lineTo(76, 6); ctx.lineTo(80, 22); ctx.lineTo(98, 14); ctx.lineTo(96, 32); ctx.lineTo(110, 36); ctx.lineTo(102, 48); ctx.lineTo(100, 72);
          ctx.lineTo(94, 58); ctx.lineTo(88, 50); ctx.lineTo(82, 58); ctx.lineTo(74, 44); ctx.lineTo(66, 56); ctx.lineTo(58, 44); ctx.lineTo(50, 58); ctx.lineTo(42, 48); ctx.lineTo(36, 58); ctx.closePath();
        });
      } else {
        P(ctx, hair, () => {
          ctx.moveTo(29, 74); ctx.bezierCurveTo(24, 36, 44, 24, 64, 24); ctx.bezierCurveTo(84, 24, 104, 36, 99, 74);
          ctx.quadraticCurveTo(96, 60, 90, 52); ctx.quadraticCurveTo(88, 58, 82, 60); ctx.quadraticCurveTo(80, 50, 74, 46);
          ctx.quadraticCurveTo(70, 56, 62, 58); ctx.quadraticCurveTo(60, 50, 56, 46); ctx.quadraticCurveTo(50, 56, 44, 58);
          ctx.quadraticCurveTo(42, 52, 40, 50); ctx.quadraticCurveTo(34, 60, 29, 74); ctx.closePath();
        });
        ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(64, 60, 30, Math.PI * 1.2, Math.PI * 1.45); ctx.stroke();
      }
    }
    // 第三只眼
    if (has('thirdEye')) { P(ctx, '#E8403A', () => { ctx.moveTo(64, 38); ctx.quadraticCurveTo(69, 45, 64, 52); ctx.quadraticCurveTo(59, 45, 64, 38); ctx.closePath(); }, 1.4); P(ctx, '#FFD65A', () => { ell(ctx, 64, 45, 1.6, 3); }, 0); }
    if (has('goggles')) {
      P(ctx, '#5A4A3A', () => { ctx.rect(30, 38, 68, 6); }, 1.4);
      P(ctx, '#9FE3FF', () => { ctx.arc(52, 40, 7, 0, 7); }, 2); P(ctx, '#9FE3FF', () => { ctx.arc(76, 40, 7, 0, 7); }, 2);
    }
    if (has('headband') || has('sunband')) {
      const bcol = has('sunband') ? '#E8403A' : (L.bandc || '#E84A4A');
      P(ctx, bcol, () => { ctx.moveTo(30, 48); ctx.quadraticCurveTo(64, 34, 98, 48); ctx.lineTo(98, 54); ctx.quadraticCurveTo(64, 40, 30, 54); ctx.closePath(); }, 1.6);
      P(ctx, bcol, () => { ctx.moveTo(98, 50); ctx.quadraticCurveTo(114, 56, 120, 74); ctx.quadraticCurveTo(110, 66, 100, 58); ctx.closePath(); }, 1.4);
      if (has('sunband')) {
        ctx.save(); ctx.shadowColor = '#FFD65A'; ctx.shadowBlur = 10;
        P(ctx, '#FFD65A', () => { star5(ctx, 64, 42, 9, 4.5); }, 1.4); ctx.restore();
      }
    }
    // 帽子/头盔
    const hc = L.hatc || '#6E7B8A';
    switch (L.hat) {
      case 'guan':
        P(ctx, '#1E1A22', () => { ctx.moveTo(6, 30); ctx.lineTo(122, 30); ctx.lineTo(122, 36); ctx.lineTo(6, 36); ctx.closePath(); });
        P(ctx, '#1E1A22', () => { ctx.moveTo(38, 44); ctx.lineTo(40, 22); ctx.quadraticCurveTo(64, 6, 88, 22); ctx.lineTo(90, 44); ctx.quadraticCurveTo(64, 38, 38, 44); ctx.closePath(); });
        P(ctx, '#E6B94A', () => { ctx.moveTo(38, 44); ctx.quadraticCurveTo(64, 38, 90, 44); ctx.lineTo(90, 40); ctx.quadraticCurveTo(64, 34, 38, 40); ctx.closePath(); }, 0);
        break;
      case 'scholar':
        P(ctx, hc, () => { ctx.moveTo(90, 38); ctx.quadraticCurveTo(104, 56, 100, 84); ctx.lineTo(94, 82); ctx.quadraticCurveTo(96, 60, 86, 44); ctx.closePath(); });
        P(ctx, hc, () => { ctx.moveTo(32, 48); ctx.quadraticCurveTo(28, 18, 64, 14); ctx.quadraticCurveTo(100, 18, 96, 48); ctx.quadraticCurveTo(64, 38, 32, 48); ctx.closePath(); });
        P(ctx, shade(hc, -0.25), () => { ctx.moveTo(34, 46); ctx.quadraticCurveTo(64, 36, 94, 46); ctx.lineTo(94, 42); ctx.quadraticCurveTo(64, 32, 34, 42); ctx.closePath(); }, 0);
        break;
      case 'helmet': case 'helmetHorn': case 'featherHelm': {
        const col = L.hat === 'featherHelm' ? '#D9A841' : hc;
        if (L.hat === 'featherHelm') {
          for (const d of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(64 + d * 8, 22); ctx.bezierCurveTo(64 + d * 26, -8, 64 + d * 60, -4, 64 + d * 62, 44);
            ctx.lineCap = 'round'; ctx.strokeStyle = OL; ctx.lineWidth = 7; ctx.stroke();
            ctx.strokeStyle = '#C8553A'; ctx.lineWidth = 4.5; ctx.stroke();
            ctx.setLineDash([3, 4]); ctx.strokeStyle = '#F2D38A'; ctx.lineWidth = 4.5; ctx.stroke(); ctx.setLineDash([]);
          }
        }
        if (L.hat === 'helmetHorn') {
          P(ctx, '#E8E4DA', () => { ctx.moveTo(38, 34); ctx.quadraticCurveTo(14, 26, 12, 4); ctx.quadraticCurveTo(26, 18, 44, 26); ctx.closePath(); });
          P(ctx, '#E8E4DA', () => { ctx.moveTo(90, 34); ctx.quadraticCurveTo(114, 26, 116, 4); ctx.quadraticCurveTo(102, 18, 84, 26); ctx.closePath(); });
        }
        P(ctx, col, () => { ctx.moveTo(27, 60); ctx.bezierCurveTo(24, 14, 104, 14, 101, 60); ctx.lineTo(95, 58); ctx.bezierCurveTo(92, 44, 36, 44, 33, 58); ctx.closePath(); });
        P(ctx, col, () => { ctx.roundRect ? ctx.roundRect(24, 54, 10, 26, 4) : ctx.rect(24, 54, 10, 26); });
        P(ctx, col, () => { ctx.roundRect ? ctx.roundRect(94, 54, 10, 26, 4) : ctx.rect(94, 54, 10, 26); });
        P(ctx, L.hat === 'featherHelm' ? '#8B1E1E' : shade(col, -0.25), () => { ctx.moveTo(30, 52); ctx.quadraticCurveTo(64, 38, 98, 52); ctx.lineTo(98, 58); ctx.quadraticCurveTo(64, 44, 30, 58); ctx.closePath(); }, 1.4);
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ell(ctx, 50, 30, 10, 5, -0.4); ctx.fill();
        if (L.plume) P(ctx, L.plume, () => { ctx.moveTo(60, 20); ctx.quadraticCurveTo(64, -2, 84, 2); ctx.quadraticCurveTo(74, 10, 68, 22); ctx.closePath(); });
        if (L.hat === 'featherHelm') P(ctx, '#F2D38A', () => { star5(ctx, 64, 30, 7, 3.5); }, 1.2);
        break;
      }
      case 'crown':
        P(ctx, '#F0C75E', () => {
          ctx.moveTo(38, 40); ctx.lineTo(36, 18); ctx.lineTo(46, 28); ctx.lineTo(52, 10); ctx.lineTo(58, 26); ctx.lineTo(64, 4);
          ctx.lineTo(70, 26); ctx.lineTo(76, 10); ctx.lineTo(82, 28); ctx.lineTo(92, 18); ctx.lineTo(90, 40); ctx.quadraticCurveTo(64, 32, 38, 40); ctx.closePath();
        });
        P(ctx, '#C8342E', () => { ell(ctx, 64, 30, 4, 4); }, 1.2);
        P(ctx, '#6B2F8F', () => { ell(ctx, 50, 33, 2.6, 2.6); ell(ctx, 78, 33, 2.6, 2.6); }, 1);
        P(ctx, '#F0C75E', () => { ctx.moveTo(30, 44); ctx.quadraticCurveTo(10, 40, 8, 56); ctx.quadraticCurveTo(18, 48, 32, 50); ctx.closePath(); });
        P(ctx, '#F0C75E', () => { ctx.moveTo(98, 44); ctx.quadraticCurveTo(118, 40, 120, 56); ctx.quadraticCurveTo(110, 48, 96, 50); ctx.closePath(); });
        break;
      case 'crownSmall':
        P(ctx, '#E3BE5C', () => { ctx.moveTo(50, 30); ctx.lineTo(50, 16); ctx.lineTo(57, 23); ctx.lineTo(64, 12); ctx.lineTo(71, 23); ctx.lineTo(78, 16); ctx.lineTo(78, 30); ctx.closePath(); });
        break;
      case 'hood': case 'tiger':
        P(ctx, hc, () => { ctx.moveTo(24, 80); ctx.bezierCurveTo(18, 12, 110, 12, 104, 80); ctx.lineTo(96, 76); ctx.bezierCurveTo(98, 34, 30, 34, 32, 76); ctx.closePath(); });
        if (L.hat === 'tiger') {
          ctx.strokeStyle = '#2A1E18'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          for (const [x1, y1, x2, y2] of [[44, 24, 50, 36], [64, 18, 64, 30], [84, 24, 78, 36], [28, 50, 36, 52], [100, 50, 92, 52]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
          P(ctx, '#FFF4E0', () => { ell(ctx, 34, 26, 5, 5); }, 0); P(ctx, '#FFF4E0', () => { ell(ctx, 94, 26, 5, 5); }, 0);
        }
        break;
    }
    // 头饰
    if (has('foxEars')) {
      P(ctx, hair, () => { ctx.moveTo(34, 38); ctx.lineTo(28, 6); ctx.lineTo(52, 28); ctx.closePath(); });
      P(ctx, hair, () => { ctx.moveTo(94, 38); ctx.lineTo(100, 6); ctx.lineTo(76, 28); ctx.closePath(); });
      P(ctx, '#F7A8BA', () => { ctx.moveTo(35, 32); ctx.lineTo(31, 13); ctx.lineTo(46, 27); ctx.closePath(); }, 0);
      P(ctx, '#F7A8BA', () => { ctx.moveTo(93, 32); ctx.lineTo(97, 13); ctx.lineTo(82, 27); ctx.closePath(); }, 0);
    }
    if (has('flower')) {
      ctx.save(); ctx.translate(94, 36);
      for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); P(ctx, '#FF9CC2', () => { ell(ctx, 0, -5.5, 3.6, 5.5); }, 1.2); }
      P(ctx, '#FFE27A', () => { ctx.arc(0, 0, 2.8, 0, 7); }, 1); ctx.restore();
    }
    if (has('moon')) {
      ctx.save(); ctx.shadowColor = '#CFE3FF'; ctx.shadowBlur = 10;
      P(ctx, '#F4F8FF', () => { ctx.arc(38, 30, 10, 0.6, Math.PI * 2 - 0.6); ctx.arc(44, 28, 8, Math.PI * 2 - 0.9, 0.9, true); ctx.closePath(); }, 1.4);
      ctx.restore();
    }
    if (has('butterfly')) {
      for (const [bx, by, s] of [[108, 36, 1], [16, 96, 0.8]]) {
        ctx.save(); ctx.translate(bx, by); ctx.scale(s, s);
        P(ctx, '#9EDFF2', () => { ell(ctx, -5, -3, 6, 4.5, -0.5); ell(ctx, 5, -3, 6, 4.5, 0.5); }, 1.2);
        P(ctx, '#6FB8E8', () => { ell(ctx, -4, 4, 4, 3, 0.4); ell(ctx, 4, 4, 4, 3, -0.4); }, 1.2);
        ctx.restore();
      }
    }
    if (has('petals')) {
      ctx.fillStyle = '#FF9CC2';
      for (const [px, py, r] of [[18, 40, 0.4], [112, 80, 1.1], [14, 120, 2], [116, 130, 0.8]]) { ctx.beginPath(); ell(ctx, px, py, 4, 2.2, r); ctx.fill(); }
    }
    if (has('dog')) {
      ctx.save(); ctx.translate(18, 132);
      P(ctx, '#E8E4DA', () => { ell(ctx, 8, 8, 13, 9); });
      P(ctx, '#E8E4DA', () => { ell(ctx, 4, -4, 9, 8); });
      P(ctx, '#2A2230', () => { ctx.moveTo(-3, -10); ctx.lineTo(-6, -18); ctx.lineTo(1, -12); ctx.closePath(); ctx.moveTo(8, -10); ctx.lineTo(12, -18); ctx.lineTo(6, -12); ctx.closePath(); }, 1);
      ctx.fillStyle = '#2A2230'; ctx.beginPath(); ctx.arc(1, -5, 1.4, 0, 7); ctx.arc(7, -5, 1.4, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
  A.drawChibi = drawChibi;

  /* ---------------- 野怪 ---------------- */
  function drawDragon(ctx, d) {
    const c = d.color, c2 = d.color2, W = 200;
    const belly = shade(c, 0.45);
    // 翅膀
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(100, 70); ctx.scale(s, 1);
      P(ctx, shade(c, -0.25), () => {
        ctx.moveTo(10, 10); ctx.quadraticCurveTo(50, -50, 96, -40); ctx.quadraticCurveTo(84, -18, 92, 6);
        ctx.quadraticCurveTo(76, -2, 70, 18); ctx.quadraticCurveTo(58, 6, 48, 28); ctx.quadraticCurveTo(34, 18, 20, 36); ctx.closePath();
      });
      ctx.strokeStyle = shade(c, 0.2); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(12, 12); ctx.lineTo(92, -36); ctx.moveTo(14, 16); ctx.lineTo(88, 4); ctx.moveTo(14, 20); ctx.lineTo(66, 16); ctx.stroke();
      ctx.restore();
    }
    // 尾巴
    P(ctx, c, () => { ctx.moveTo(128, 150); ctx.quadraticCurveTo(186, 160, 190, 120); ctx.quadraticCurveTo(194, 104, 180, 100); ctx.quadraticCurveTo(184, 130, 132, 134); ctx.closePath(); });
    P(ctx, c2, () => { ctx.moveTo(180, 100); ctx.lineTo(196, 88); ctx.lineTo(190, 108); ctx.closePath(); });
    // 身体
    P(ctx, c, () => { ell(ctx, 100, 124, 50, 44); });
    P(ctx, belly, () => { ell(ctx, 100, 132, 30, 32); });
    ctx.strokeStyle = shade(c, 0.1); ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(76, 110 + i * 11); ctx.quadraticCurveTo(100, 116 + i * 11, 124, 110 + i * 11); ctx.stroke(); }
    // 腿爪
    for (const x of [66, 134]) {
      P(ctx, c, () => { ell(ctx, x, 158, 17, 12); });
      ctx.fillStyle = '#F4EFE4';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8 - 3, 166); ctx.lineTo(x + i * 8, 174); ctx.lineTo(x + i * 8 + 3, 166); ctx.fill(); }
    }
    // 脊刺
    for (let i = 0; i < 4; i++) P(ctx, c2, () => { const x = 70 + i * 20; ctx.moveTo(x - 7, 86); ctx.lineTo(x, 72 - (i % 2) * 6); ctx.lineTo(x + 7, 86); ctx.closePath(); }, 1.6);
    // 头
    P(ctx, c, () => { ell(ctx, 100, 62, 38, 32); });
    P(ctx, belly, () => { ell(ctx, 100, 80, 24, 14); });
    // 角
    for (const s of [-1, 1]) P(ctx, c2, () => { ctx.moveTo(100 + s * 20, 38); ctx.quadraticCurveTo(100 + s * 46, 20, 100 + s * 52, -4); ctx.quadraticCurveTo(100 + s * 36, 16, 100 + s * 12, 34); ctx.closePath(); });
    // 须
    ctx.strokeStyle = c2; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(100 + s * 18, 84); ctx.bezierCurveTo(100 + s * 40, 90, 100 + s * 50, 70, 100 + s * 62, 84); ctx.stroke(); }
    // 眼
    for (const s of [-1, 1]) {
      ctx.save(); ctx.shadowColor = c2; ctx.shadowBlur = 12;
      P(ctx, c2, () => { ctx.moveTo(100 + s * 8, 58); ctx.quadraticCurveTo(100 + s * 20, 46, 100 + s * 30, 56); ctx.quadraticCurveTo(100 + s * 20, 64, 100 + s * 8, 58); ctx.closePath(); }, 1.6);
      ctx.restore();
      ctx.fillStyle = '#16101C'; ctx.beginPath(); ell(ctx, 100 + s * 19, 56, 2, 4.5); ctx.fill();
    }
    // 鼻孔 & 牙
    ctx.fillStyle = shade(c, -0.5); ctx.beginPath(); ell(ctx, 92, 78, 2.5, 1.8); ell(ctx, 108, 78, 2.5, 1.8); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    for (const x of [86, 114]) { ctx.beginPath(); ctx.moveTo(x - 3, 86); ctx.lineTo(x, 95); ctx.lineTo(x + 3, 86); ctx.fill(); }
    if (d.skill === 'storm') {
      ctx.save(); ctx.shadowColor = '#9FE3FF'; ctx.shadowBlur = 10; ctx.strokeStyle = '#E8F8FF'; ctx.lineWidth = 2;
      for (const [x, y] of [[40, 40], [160, 36], [30, 120], [172, 150]]) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y + 10); ctx.lineTo(x - 2, y + 14); ctx.lineTo(x + 6, y + 26); ctx.stroke();
      }
      ctx.restore();
      P(ctx, '#FFD65A', () => { ctx.moveTo(84, 36); ctx.lineTo(90, 22); ctx.lineTo(96, 32); ctx.lineTo(100, 18); ctx.lineTo(104, 32); ctx.lineTo(110, 22); ctx.lineTo(116, 36); ctx.closePath(); }, 1.6);
    }
    return W;
  }
  function drawGolem(ctx, d) {
    const c = d.color;
    P(ctx, shade(c, -0.35), () => { ell(ctx, 42, 130, 16, 14); ell(ctx, 98, 130, 16, 14); });
    P(ctx, '#7E8794', () => { ctx.moveTo(30, 70); ctx.quadraticCurveTo(70, 20, 110, 70); ctx.lineTo(118, 118); ctx.quadraticCurveTo(70, 140, 22, 118); ctx.closePath(); });
    P(ctx, '#6A7380', () => { ell(ctx, 18, 96, 14, 22, 0.3); });
    P(ctx, '#6A7380', () => { ell(ctx, 122, 96, 14, 22, -0.3); });
    ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.strokeStyle = shade(c, 0.3); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(52, 86); ctx.lineTo(60, 100); ctx.lineTo(52, 112); ctx.moveTo(88, 86); ctx.lineTo(80, 100); ctx.lineTo(88, 112); ctx.stroke();
    P(ctx, shade(c, 0.4), () => { ell(ctx, 58, 64, 6, 4); ell(ctx, 82, 64, 6, 4); }, 0);
    ctx.restore();
    P(ctx, '#8E97A4', () => { ctx.moveTo(40, 50); ctx.lineTo(48, 30); ctx.lineTo(58, 44); ctx.closePath(); ctx.moveTo(100, 50); ctx.lineTo(92, 30); ctx.lineTo(82, 44); ctx.closePath(); }, 2);
  }
  function drawCannon(ctx) {
    P(ctx, '#5A3E6E', () => { ctx.roundRect ? ctx.roundRect(20, 70, 100, 40, 8) : ctx.rect(20, 70, 100, 40); });
    P(ctx, '#3A2856', () => { ctx.moveTo(60, 74); ctx.lineTo(126, 44); ctx.lineTo(132, 60); ctx.lineTo(70, 92); ctx.closePath(); });
    P(ctx, '#C07CFF', () => { ell(ctx, 129, 52, 5, 9, -0.45); });
    for (const x of [40, 100]) {
      P(ctx, '#2A1E3A', () => { ctx.arc(x, 110, 16, 0, 7); });
      P(ctx, '#8A6AB0', () => { ctx.arc(x, 110, 6, 0, 7); }, 1.5);
    }
    ctx.save(); ctx.shadowColor = '#FF4D5D'; ctx.shadowBlur = 8; ctx.fillStyle = '#FF4D5D';
    ctx.beginPath(); ctx.arc(46, 86, 3, 0, 7); ctx.arc(60, 86, 3, 0, 7); ctx.fill(); ctx.restore();
  }

  /* ---------------- 精灵缓存 ---------------- */
  const cache = {};
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function spriteDef(key) {
    const h = G.HEROES[key];
    if (h) return { w: 128, h: 160, ax: 64, ay: 152, draw: ctx => drawChibi(ctx, h.look), scale: 1 };
    const m = G.MONSTERS[key];
    if (!m) return null;
    if (m.kind === 'chibi') return { w: 128, h: 160, ax: 64, ay: 152, draw: ctx => drawChibi(ctx, m.look), scale: 0.9 };
    if (m.kind === 'dragon') return { w: 200, h: 180, ax: 100, ay: 172, draw: ctx => drawDragon(ctx, m), scale: 1.07 * (m.size || 1) };
    if (m.kind === 'golem') return { w: 140, h: 150, ax: 70, ay: 142, draw: ctx => drawGolem(ctx, m), scale: 1.0 };
    if (m.kind === 'cannon') return { w: 140, h: 130, ax: 70, ay: 126, draw: ctx => drawCannon(ctx), scale: 0.8 };
  }
  // variant: 0 正常 1 暗影 2 受击闪白
  A.sprite = function (key, variant) {
    variant = variant || 0;
    const ck = key + '|' + variant;
    if (cache[ck]) return cache[ck];
    const d = spriteDef(key);
    const pad = 8;
    const c = makeCanvas((d.w + pad * 2) * K, (d.h + pad * 2) * K);
    const ctx = c.getContext('2d');
    ctx.scale(K, K); ctx.translate(pad, pad);
    d.draw(ctx);
    if (variant === 1) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(58,18,92,.55)'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-over';
    } else if (variant === 2) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    const s = { c, w: c.width / K, h: c.height / K, ax: d.ax + pad, ay: d.ay + pad, scale: d.scale };
    cache[ck] = s;
    return s;
  };

  /* 头像：返回 dataURL */
  const urlCache = {};
  A.portrait = function (key, w, h, opts) {
    opts = opts || {};
    const ck = 'p|' + key + '|' + w + '|' + h + '|' + (opts.bg || '') + '|' + (opts.round ? 1 : 0);
    if (urlCache[ck]) return urlCache[ck];
    const c = makeCanvas(w * 2, h * 2), ctx = c.getContext('2d');
    ctx.scale(2, 2);
    const hero = G.HEROES[key];
    const bg = opts.bg || (hero ? G.TRAITS[hero.traits[hero.traits.length - 1]].color : '#5A4A7A');
    if (opts.round) { ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, 7); ctx.clip(); }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(bg, 0.25)); g.addColorStop(1, shade(bg, -0.55));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 光芒
    ctx.save(); ctx.globalAlpha = 0.18; ctx.translate(w / 2, h * 0.42);
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w * 0.08, -w); ctx.lineTo(w * 0.08, -w); ctx.fill(); }
    ctx.restore();
    const sp = A.sprite(key, opts.shadow ? 1 : 0);
    const d = spriteDef(key);
    const isChibi = d.w === 128;
    // 头部区域 y 4..108 for chibi
    const srcY0 = isChibi ? 2 : 0, srcY1 = isChibi ? (opts.full ? 168 : 112) : d.h + 16;
    const sc = h / (srcY1 - srcY0) * (opts.full ? 1 : 1.02);
    const cx = w / 2 - (sp.ax) * sc;
    ctx.drawImage(sp.c, cx, -srcY0 * sc + (isChibi ? h * 0.04 : 0), sp.w * sc, sp.h * sc);
    urlCache[ck] = c.toDataURL();
    return urlCache[ck];
  };

  function hexPath(ctx, cx, cy, r) {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      i ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  A.hexPath = hexPath;
  const TIER_FILL = [['#3A3F4E', '#2A2E3A'], ['#C98A56', '#7A4A2A'], ['#D8E0EA', '#8A96A6'], ['#FFE08A', '#C8902E'], ['#FFD6FF', '#7AB8FF']];
  A.traitIcon = function (tid, tier) {
    const ck = 't|' + tid + '|' + tier;
    if (urlCache[ck]) return urlCache[ck];
    const S = 64, c = makeCanvas(S, S), ctx = c.getContext('2d');
    const t = G.TRAITS[tid];
    const [f1, f2] = TIER_FILL[tier];
    const g = ctx.createLinearGradient(0, 0, S, S);
    if (tier === 4) { g.addColorStop(0, '#FFB8F0'); g.addColorStop(0.5, '#B8F0FF'); g.addColorStop(1, '#FFE8A8'); }
    else { g.addColorStop(0, f1); g.addColorStop(1, f2); }
    ctx.beginPath(); hexPath(ctx, S / 2, S / 2, S / 2 - 2); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = tier ? 'rgba(20,14,28,.8)' : '#555C6C'; ctx.stroke();
    ctx.beginPath(); hexPath(ctx, S / 2, S / 2, S / 2 - 8);
    ctx.fillStyle = tier ? rgba(t.color, 0.9) : '#232733'; ctx.fill();
    ctx.fillStyle = tier ? '#FFFFFF' : '#7C8496';
    ctx.font = '34px ' + A.FONT_BRUSH; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.glyph, S / 2, S / 2 + 2);
    urlCache[ck] = c.toDataURL();
    return urlCache[ck];
  };

  function drawCompGlyph(ctx, id, S) {
    const m = S / 2;
    ctx.save(); ctx.translate(m, m); ctx.scale(S / 64, S / 64);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const it = G.ITEMS[id];
    switch (id) {
      case 'sword':
        P(ctx, '#E8EEF4', () => { ctx.moveTo(-16, 16); ctx.lineTo(14, -16); ctx.lineTo(18, -18); ctx.lineTo(16, -14); ctx.lineTo(-14, 18); ctx.closePath(); }, 2);
        P(ctx, '#E6B94A', () => { ctx.moveTo(-18, 8); ctx.lineTo(-8, 18); ctx.lineTo(-10, 20); ctx.lineTo(-20, 10); ctx.closePath(); }, 2);
        break;
      case 'dagger':
        P(ctx, '#BFF0C8', () => { ctx.moveTo(-10, 12); ctx.lineTo(12, -14); ctx.lineTo(14, -10); ctx.lineTo(-6, 14); ctx.closePath(); }, 2);
        P(ctx, '#5A3A2A', () => { ctx.rect(-18, 12, 10, 6); }, 2);
        break;
      case 'tome':
        P(ctx, '#8A6CF0', () => { ctx.rect(-16, -18, 30, 36); }, 2);
        P(ctx, '#F4ECD8', () => { ctx.rect(12, -16, 5, 32); }, 1.5);
        P(ctx, '#FFE27A', () => { star5(ctx, -2, 0, 9, 4); }, 1.5);
        break;
      case 'armor':
        P(ctx, '#C9A06A', () => { ctx.moveTo(-18, -14); ctx.lineTo(-6, -18); ctx.lineTo(0, -12); ctx.lineTo(6, -18); ctx.lineTo(18, -14); ctx.lineTo(14, 18); ctx.lineTo(-14, 18); ctx.closePath(); }, 2);
        ctx.strokeStyle = '#7A5A3A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 16); ctx.stroke();
        break;
      case 'cloak':
        P(ctx, '#5A8FD6', () => { ctx.moveTo(-8, -18); ctx.lineTo(8, -18); ctx.quadraticCurveTo(22, 4, 18, 18); ctx.lineTo(-18, 18); ctx.quadraticCurveTo(-22, 4, -8, -18); ctx.closePath(); }, 2);
        P(ctx, '#E6B94A', () => { ctx.arc(0, -14, 4, 0, 7); }, 1.5);
        break;
      case 'ruby':
        P(ctx, '#F05A5A', () => { ctx.moveTo(0, -18); ctx.lineTo(16, -4); ctx.lineTo(0, 18); ctx.lineTo(-16, -4); ctx.closePath(); }, 2);
        P(ctx, 'rgba(255,255,255,.55)', () => { ctx.moveTo(0, -14); ctx.lineTo(8, -4); ctx.lineTo(0, -2); ctx.closePath(); }, 0);
        break;
      case 'sapphire':
        P(ctx, '#4A8CF0', () => { ctx.moveTo(-14, -8); ctx.lineTo(-6, -16); ctx.lineTo(6, -16); ctx.lineTo(14, -8); ctx.lineTo(0, 18); ctx.closePath(); }, 2);
        P(ctx, 'rgba(255,255,255,.55)', () => { ctx.moveTo(-6, -12); ctx.lineTo(4, -12); ctx.lineTo(0, -4); ctx.closePath(); }, 0);
        break;
    }
    ctx.restore();
    return it;
  }
  A.itemIcon = function (id) {
    const ck = 'i|' + id;
    if (urlCache[ck]) return urlCache[ck];
    const S = 64, c = makeCanvas(S, S), ctx = c.getContext('2d');
    const it = G.ITEMS[id];
    ctx.save();
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(2, 2, S - 4, S - 4, 12); else ctx.rect(2, 2, S - 4, S - 4);
    const g = ctx.createLinearGradient(0, 0, S, S);
    if (it.comp) { g.addColorStop(0, '#39425A'); g.addColorStop(1, '#1C2233'); }
    else { g.addColorStop(0, shade(it.c, -0.1)); g.addColorStop(1, shade(it.c2, -0.55)); }
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = it.comp ? '#6A7488' : '#E9C46A'; ctx.stroke();
    ctx.restore();
    if (it.comp) drawCompGlyph(ctx, id, S);
    else {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(S / 2, S / 2, 20, 0, 7); ctx.fill();
      ctx.fillStyle = '#FFF8E6'; ctx.font = '34px ' + A.FONT_BRUSH; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
      ctx.fillText(it.name[0], S / 2, S / 2 + 2);
      ctx.shadowBlur = 0;
      // 合成来源小点
      it.from.forEach((f, i) => { ctx.fillStyle = G.ITEMS[f].c; ctx.beginPath(); ctx.arc(12 + i * 10, S - 12, 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#1C2233'; ctx.lineWidth = 1.5; ctx.stroke(); });
    }
    urlCache[ck] = c.toDataURL();
    return urlCache[ck];
  };
  A.itemCanvas = {};
  A.itemImg = function (id) {
    if (A.itemCanvas[id]) return A.itemCanvas[id];
    const img = new Image(); img.src = A.itemIcon(id); A.itemCanvas[id] = img; return img;
  };
  A.augIcon = function (aug) {
    const ck = 'a|' + aug.id;
    if (urlCache[ck]) return urlCache[ck];
    const S = 96, c = makeCanvas(S, S), ctx = c.getContext('2d');
    const col = G.AUG_TIER_COLORS[aug.tier];
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(Math.PI / 4);
    const g = ctx.createLinearGradient(-30, -30, 30, 30);
    if (aug.tier === 3) { g.addColorStop(0, '#FFB8F0'); g.addColorStop(0.5, '#9FE3FF'); g.addColorStop(1, '#FFE8A8'); }
    else { g.addColorStop(0, shade(col, 0.3)); g.addColorStop(1, shade(col, -0.45)); }
    ctx.fillStyle = g; ctx.fillRect(-30, -30, 60, 60);
    ctx.lineWidth = 3; ctx.strokeStyle = '#1C1626'; ctx.strokeRect(-30, -30, 60, 60);
    ctx.fillStyle = 'rgba(20,16,30,.55)'; ctx.fillRect(-22, -22, 44, 44);
    ctx.restore();
    ctx.fillStyle = '#FFFFFF'; ctx.font = '40px ' + A.FONT_BRUSH; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fillText(aug.glyph, S / 2, S / 2 + 3);
    urlCache[ck] = c.toDataURL();
    return urlCache[ck];
  };
  A.eventIcon = function (ev) { return A.augIcon({ id: 'ev_' + ev.id, tier: 2, glyph: ev.glyph }); };

  A.preload = function () {
    for (const h of G.HERO_LIST) { A.sprite(h.id, 0); A.sprite(h.id, 2); }
    for (const k in G.MONSTERS) { A.sprite(k, 0); A.sprite(k, 2); }
  };
})(window.G);
