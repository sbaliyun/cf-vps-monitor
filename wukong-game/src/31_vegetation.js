// ---------------------------------------------------------------------------
// Procedural vegetation for 黑风山: Chinese pines, maples, dead trees, bamboo,
// bushes, ferns, mossy rocks, a GPU grass field that follows the camera and
// drifting autumn leaves. Everything is generated at runtime (canvas textures,
// procedural geometry). Materials sway in the wind with per-instance phase and
// work with THREE.InstancedMesh (Y rotation + uniform scale per instance).
// ---------------------------------------------------------------------------
const Veg = (() => {
  const TAU = Math.PI * 2;
  const V3 = THREE.Vector3;
  const uniforms = { time: { value: 0 }, windStrength: { value: 1 } };
  const camU = { value: new THREE.Vector3() };
  const playerU = { value: new THREE.Vector3(1e6, -1e6, 1e6) };
  const WIND = new THREE.Vector2(0.8, 0.6).normalize();       // world xz direction the wind blows to
  const f5 = x => Number(x).toFixed(5);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ------------------------------------------------------------------ random / noise
  function RNG(seed) {
    let s = (seed * 2654435761) >>> 0;
    const r = () => {
      s = (s + 0x6D2B79F5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = arr => arr[Math.floor(r() * arr.length) % arr.length];
    r.sign = () => (r() < 0.5 ? -1 : 1);
    r.random = r;           // SimplexNoise-compatible
    return r;
  }
  function hashI(x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const wrapI = (i, p) => ((i % p) + p) % p;
  // tileable value noise, period px/py in lattice units
  function vnoise(x, y, px, py, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const x0 = wrapI(xi, px), x1 = wrapI(xi + 1, px), y0 = wrapI(yi, py), y1 = wrapI(yi + 1, py);
    const a = hashI(x0, y0, s), b = hashI(x1, y0, s), c = hashI(x0, y1, s), d = hashI(x1, y1, s);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(x, y, px, py, oct, s) {
    let sum = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += amp * vnoise(x, y, px, py, s + o * 17); norm += amp;
      x *= 2; y *= 2; px *= 2; py *= 2; amp *= 0.5;
    }
    return sum / norm;
  }
  // tileable worley: returns F2 - F1 (0 on cell borders)
  function worleyEdge(x, y, px, py, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let f1 = 9, f2 = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy, hx = wrapI(cx, px), hy = wrapI(cy, py);
      const fx = cx + hashI(hx, hy, s), fy = cy + hashI(hx, hy, s + 1);
      const d = Math.hypot(x - fx, y - fy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return f2 - f1;
  }
  const hexRGB = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const linCol = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };   // sRGB hex -> linear

  // ------------------------------------------------------------------ texture helpers
  function dataTex(data, w, h, srgb = true) {
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }
  function normalFromHeight(hf, w, h, k) {
    const out = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const l = hf[j * w + wrapI(i - 1, w)], r = hf[j * w + wrapI(i + 1, w)];
      const d = hf[wrapI(j - 1, h) * w + i], u = hf[wrapI(j + 1, h) * w + i];
      let nx = (l - r) * k, ny = (d - u) * k, nz = 1;
      const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
      const o = (j * w + i) * 4;
      out[o] = (nx * 0.5 + 0.5) * 255; out[o + 1] = (ny * 0.5 + 0.5) * 255; out[o + 2] = (nz * 0.5 + 0.5) * 255; out[o + 3] = 255;
    }
    return out;
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const ctx2d = cv => cv.getContext('2d', { willReadFrequently: true });   // CPU-backed: fast getImageData
  // canvas (with alpha) -> DataTexture, flipped so canvas-top = v 1, colours bled into transparent texels
  function alphaTexFromCanvas(cv) {
    const w = cv.width, h = cv.height;
    const src = ctx2d(cv).getImageData(0, 0, w, h).data;
    const out = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) out.set(src.subarray((h - 1 - j) * w * 4, (h - j) * w * 4), j * w * 4);
    // colour bleed via premultiplied mip pyramid
    const levels = [];
    let lw = w, lh = h, cur = new Float32Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const a = out[i * 4 + 3] / 255;
      cur[i * 4] = out[i * 4] * a; cur[i * 4 + 1] = out[i * 4 + 1] * a; cur[i * 4 + 2] = out[i * 4 + 2] * a; cur[i * 4 + 3] = a;
    }
    levels.push({ d: cur, w: lw, h: lh });
    while (lw > 1 || lh > 1) {
      const nw = Math.max(1, lw >> 1), nh = Math.max(1, lh >> 1), nd = new Float32Array(nw * nh * 4);
      for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) for (let c = 0; c < 4; c++) {
        let s = 0;
        for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
          const x = Math.min(lw - 1, i * 2 + di), y = Math.min(lh - 1, j * 2 + dj);
          s += cur[(y * lw + x) * 4 + c];
        }
        nd[(j * nw + i) * 4 + c] = s * 0.25;
      }
      levels.push({ d: nd, w: nw, h: nh }); cur = nd; lw = nw; lh = nh;
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4;
      if (out[o + 3] > 8) continue;
      for (let L = 1; L < levels.length; L++) {
        const lv = levels[L], x = Math.min(lv.w - 1, i >> L), y = Math.min(lv.h - 1, j >> L), q = (y * lv.w + x) * 4;
        if (lv.d[q + 3] > 0.002) {
          out[o] = lv.d[q] / lv.d[q + 3]; out[o + 1] = lv.d[q + 1] / lv.d[q + 3]; out[o + 2] = lv.d[q + 2] / lv.d[q + 3];
          break;
        }
      }
    }
    const t = dataTex(out, w, h, true);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  // ------------------------------------------------------------------ procedural textures
  function makeBark(o) {
    const W = 256, H = 512, hf = new Float32Array(W * H), col = new Uint8Array(W * H * 4);
    const cA = hexRGB(o.plate), cB = hexRGB(o.plate2), cC = hexRGB(o.crev), cD = hexRGB(o.accent);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = j / H;
      const wx = (fbm(u * 4, v * 4, 4, 4, 3, o.seed) - 0.5) * o.warp;
      const wy = (fbm(u * 4 + 5.2, v * 4 + 1.3, 4, 4, 3, o.seed + 9) - 0.5) * o.warp;
      const edge = worleyEdge(u * o.cx + wx, v * o.cy + wy, o.cx, o.cy, o.seed);
      const plate = smooth(0, o.edge, edge);
      const grain = fbm(u * o.gx, v * o.gy, o.gx, o.gy, 3, o.seed + 3);
      const det = fbm(u * 32, v * 64, 32, 64, 2, o.seed + 7);
      const patch = fbm(u * 3, v * 3, 3, 3, 3, o.seed + 11);
      const hgt = plate * o.plateAmt + grain * o.grainAmt + det * 0.15;
      hf[j * W + i] = hgt;
      const lit = clamp(plate * 0.8 + (grain - 0.5) * o.grainAmt * 1.6 + 0.15, 0, 1);
      const acc = smooth(0.5, 0.75, patch) * plate * o.accentAmt;
      const br = 0.82 + 0.36 * det;
      const q = (j * W + i) * 4;
      for (let c = 0; c < 3; c++) {
        let x = lerp(cA[c], cB[c], smooth(0.3, 0.7, patch));
        x = lerp(cC[c], x, lit);
        x = lerp(x, cD[c], acc);
        col[q + c] = clamp(x * br, 0, 255);
      }
      col[q + 3] = 255;
    }
    return { map: dataTex(col, W, H, true), normalMap: dataTex(normalFromHeight(hf, W, H, o.nk), W, H, false) };
  }

  function makeBambooTex() {
    const W = 128, H = 256, hf = new Float32Array(W * H), col = new Uint8Array(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = j / H;
      const dn = Math.min(v, 1 - v);                        // distance to node ring (v = 0 / 1)
      const ring = Math.exp(-Math.pow(dn / 0.018, 2));
      const groove = Math.exp(-Math.pow((v - 0.03) / 0.006, 2));
      const streak = fbm(u * 16, v * 2, 16, 2, 3, 51);
      const spot = smooth(0.62, 0.75, fbm(u * 8, v * 4, 8, 4, 3, 77));
      const bloom = smooth(0.78, 0.95, v) * (1 - smooth(0.97, 1.0, v));      // waxy band below node
      hf[j * W + i] = ring * 0.8 - groove * 0.5 + streak * 0.15;
      const q = (j * W + i) * 4;
      const base = [lerp(84, 104, streak), lerp(100, 116, streak), lerp(50, 58, streak)];
      for (let c = 0; c < 3; c++) {
        let x = base[c];
        x = lerp(x, [150, 152, 128][c], bloom * 0.3);
        x = lerp(x, [92, 86, 60][c], spot * 0.55);
        x = lerp(x, [168, 160, 110][c], ring * 0.5);
        x *= 1 - groove * 0.45;
        col[q + c] = clamp(x, 0, 255);
      }
      col[q + 3] = 255;
    }
    return { map: dataTex(col, W, H, true), normalMap: dataTex(normalFromHeight(hf, W, H, 3.0), W, H, false) };
  }

  function makeRockTex() {
    const W = 512, H = 512, col = new Uint8Array(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = j / H;
      const n = fbm(u * 5, v * 5, 5, 5, 5, 101);
      const wx = (fbm(u * 3, v * 3, 3, 3, 3, 111) - 0.5) * 0.8;
      const edge = worleyEdge(u * 5 + wx, v * 5 - wx, 5, 5, 121);
      const mask = smooth(0.5, 0.7, fbm(u * 2, v * 2, 2, 2, 3, 131));
      const crack = (1 - smooth(0.0, 0.035, edge)) * mask;
      const fine = fbm(u * 48, v * 48, 48, 48, 2, 151);
      const grain = fbm(u * 96, v * 96, 96, 96, 1, 161);
      const lich = smooth(0.68, 0.74, fbm(u * 14, v * 14, 14, 14, 3, 171));
      const dark = smooth(0.45, 0.8, fbm(u * 3, v * 3, 3, 3, 3, 191));
      const hgt = clamp(n * 0.7 + fine * 0.2 + grain * 0.1 - crack * 0.35 + lich * 0.06, 0, 1);
      const q = (j * W + i) * 4;
      const g = lerp(70, 122, n) * (0.86 + 0.18 * fine + 0.1 * grain);
      const base = [g * 1.03, g * 1.0, g * 0.93];
      for (let c = 0; c < 3; c++) {
        let x = base[c];
        x = lerp(x, x * 0.6 * [1.0, 1.02, 1.0][c], dark * 0.55);
        x = lerp(x, [168, 166, 140][c], lich * 0.55);
        x *= 1 - crack * 0.4;
        col[q + c] = clamp(x, 0, 255);
      }
      col[q + 3] = hgt * 255;
    }
    return dataTex(col, W, H, true);
  }

  // ---- foliage canvases ---------------------------------------------------
  const rgbStr = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  function drawPineTile(ctx, ox, oy, S, rng) {
    ctx.save(); ctx.translate(ox, oy); ctx.lineCap = 'round';
    const dark = [28, 44, 34], mid = [50, 70, 48], lite = [82, 102, 68], blue = [44, 66, 62];
    // needles are batched into a few colour/width buckets (one stroke call each)
    const NB = 6, buckets = [];
    const flush = () => {
      for (let i = 0; i < buckets.length; i++) {
        const bk = buckets[i]; if (!bk || !bk.length) continue;
        const f = (i % NB) / (NB - 1);
        ctx.strokeStyle = rgbStr(mixC(mixC(dark, blue, (i * 0.37) % 0.6), mixC(mid, lite, f), 0.25 + 0.65 * f));
        ctx.lineWidth = i < NB ? 1.15 : 1.75;
        ctx.beginPath();
        for (let k = 0; k < bk.length; k += 6) { ctx.moveTo(bk[k], bk[k + 1]); ctx.quadraticCurveTo(bk[k + 2], bk[k + 3], bk[k + 4], bk[k + 5]); }
        ctx.stroke();
        bk.length = 0;
      }
    };
    const burst = (x, y, dir, spread, n, len, back) => {
      for (let k = 0; k < n; k++) {
        const a = dir + (rng() * 2 - 1) * spread + (back && rng() < 0.3 ? Math.PI : 0);
        const L = len * rng.range(0.6, 1.1);
        const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
        const bend = rng.range(-0.18, 0.18) * L;
        const bi = Math.floor(rng() * NB) + (rng() < 0.5 ? NB : 0);
        (buckets[bi] ??= []).push(x, y, (x + ex) / 2 - Math.sin(a) * bend, (y + ey) / 2 + Math.cos(a) * bend, ex, ey);
      }
    };
    const cx = S * 0.5, cy = S * 0.55;
    const nt = rng.int(4, 6);
    const twigs = [];
    ctx.strokeStyle = 'rgb(62,46,34)'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let t = 0; t < nt; t++) {
      const a = -Math.PI / 2 + (t / nt) * TAU + rng.range(-0.3, 0.3);
      const L = S * rng.range(0.24, 0.36);
      twigs.push({ a, L });
      ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
    }
    ctx.stroke();
    // back layer: darker, front layer: brighter
    for (const pass of [0, 1]) {
      for (const tw of twigs) {
        const steps = 5;
        for (let s = 1; s <= steps; s++) {
          const f = s / steps, x = cx + Math.cos(tw.a) * tw.L * f, y = cy + Math.sin(tw.a) * tw.L * f;
          burst(x, y, tw.a, s === steps ? 1.6 : 1.0, pass === 0 ? 9 : 7, S * (s === steps ? 0.13 : 0.1), true);
        }
      }
      burst(cx, cy, 0, Math.PI, pass === 0 ? 18 : 10, S * 0.12, false);
      flush();
    }
    ctx.restore();
  }

  function mapleLeafPath(ctx, nl, deep, rng) {
    const c = { x: 0, y: -0.34 };
    const A = nl === 5 ? 2.2 : 2.55, half = A / (nl - 1);
    const tips = [];
    for (let i = 0; i < nl; i++) {
      const a = -Math.PI / 2 - A + (2 * A * i) / (nl - 1);
      const k = Math.abs(i - (nl - 1) / 2) / ((nl - 1) / 2);
      tips.push({ a, L: (1 - 0.5 * k * k) * 0.66 * rng.range(0.92, 1.06) });
    }
    const pt = (a, r) => [c.x + Math.cos(a) * r, c.y + Math.sin(a) * r];
    ctx.beginPath(); ctx.moveTo(0, -0.08);
    for (let i = 0; i < nl; i++) {
      const t = tips[i];
      const [tx, ty] = pt(t.a, t.L);
      const [c1x, c1y] = pt(t.a - half * 0.5, t.L * 0.7);
      ctx.quadraticCurveTo(c1x, c1y, tx, ty);
      const [c2x, c2y] = pt(t.a + half * 0.5, t.L * 0.7);
      if (i < nl - 1) { const [sx, sy] = pt(t.a + half, deep * Math.min(t.L, tips[i + 1].L)); ctx.quadraticCurveTo(c2x, c2y, sx, sy); }
      else ctx.quadraticCurveTo(c2x, c2y, 0, -0.08);
    }
    ctx.closePath();
    return tips.map(t => pt(t.a, t.L * 0.9));
  }

  function drawMapleTile(ctx, ox, oy, S, rng) {
    ctx.save(); ctx.translate(ox, oy); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const twigs = [];
    const P = (x, y) => ({ x: x * S, y: y * S });
    const main = [P(0.5, 0.86), P(0.5 + rng.range(-0.06, 0.06), 0.58), P(0.5 + rng.range(-0.1, 0.1), 0.26)];
    twigs.push(main);
    for (let k = 0; k < 3; k++) {
      const from = k === 0 ? main[1] : main[1 + (k % 2)];
      const sgn = k % 2 ? 1 : -1;
      twigs.push([from, P(0.5 + sgn * rng.range(0.13, 0.2), rng.range(0.38, 0.6)), P(0.5 + sgn * rng.range(0.24, 0.32), rng.range(0.26, 0.45))]);
    }
    ctx.strokeStyle = 'rgb(96,52,40)';
    for (const tw of twigs) {
      ctx.lineWidth = tw === main ? 2.2 : 1.5;
      ctx.beginPath(); ctx.moveTo(tw[0].x, tw[0].y); ctx.quadraticCurveTo(tw[1].x, tw[1].y, tw[2].x, tw[2].y); ctx.stroke();
    }
    const n = rng.int(15, 20);
    for (let k = 0; k < n; k++) {
      const tw = twigs[k % twigs.length], t = rng.range(0.35, 1.0);
      const x = (1 - t) * (1 - t) * tw[0].x + 2 * (1 - t) * t * tw[1].x + t * t * tw[2].x;
      const y = (1 - t) * (1 - t) * tw[0].y + 2 * (1 - t) * t * tw[1].y + t * t * tw[2].y;
      const dirTw = Math.atan2(tw[2].y - tw[0].y, tw[2].x - tw[0].x);
      const a = dirTw + rng.sign() * rng.range(0.3, 1.3);
      const pet = S * rng.range(0.03, 0.06), sz = S * rng.range(0.1, 0.15);
      const lx = x + Math.cos(a) * pet, ly = y + Math.sin(a) * pet;
      ctx.strokeStyle = 'rgb(120,60,44)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.stroke();
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(a + Math.PI / 2); ctx.scale(sz, sz);
      const tone = rng();
      const base = tone < 0.33 ? [250, 214, 196] : tone < 0.66 ? [246, 228, 200] : [244, 236, 192];
      const br = rng.range(0.84, 1.0);
      const col = base.map(x => x * br);
      const veinTips = mapleLeafPath(ctx, rng() < 0.7 ? 5 : 7, rng.range(0.3, 0.45), rng);
      ctx.fillStyle = rgbStr(col); ctx.fill();
      ctx.lineWidth = 0.035; ctx.strokeStyle = rgbStr(col.map(x => x * 0.8)); ctx.stroke();
      ctx.strokeStyle = rgbStr(col.map(x => x * 0.78), 0.8); ctx.lineWidth = 0.028;
      for (const [vx, vy] of veinTips) { ctx.beginPath(); ctx.moveTo(0, -0.08); ctx.lineTo(vx, vy); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBambooTile(ctx, ox, oy, S, rng) {
    ctx.save(); ctx.translate(ox, oy); ctx.lineCap = 'round';
    const x0 = S * 0.5, y0 = S * 0.99, x2 = S * (0.5 + rng.range(-0.12, 0.12)), y2 = S * 0.12;
    const x1 = S * (0.5 + rng.range(-0.1, 0.1)), y1 = S * 0.55;
    ctx.strokeStyle = 'rgb(110,104,60)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x1, y1, x2, y2); ctx.stroke();
    const n = rng.int(6, 9);
    for (let k = 0; k < n; k++) {
      const t = 0.25 + 0.75 * (k + rng() * 0.6) / n;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y2;
      const side = k % 2 ? 1 : -1;
      const a = -Math.PI / 2 + side * rng.range(0.25, 0.85);
      const L = S * rng.range(0.26, 0.4), w = L * rng.range(0.11, 0.15);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-w * 0.9, -L * 0.12, -w * 0.6, -L * 0.6, 0, -L);
      ctx.bezierCurveTo(w * 0.6, -L * 0.6, w * 0.9, -L * 0.12, 0, 0);
      const base = mixC([64, 88, 40], [108, 118, 56], rng());
      const g = ctx.createLinearGradient(0, 0, 0, -L);
      g.addColorStop(0, rgbStr(base.map(x => x * 0.8)));
      g.addColorStop(0.5, rgbStr(base));
      g.addColorStop(1, rgbStr(rng() < 0.3 ? [128, 108, 62] : base.map(x => x * 1.05)));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = rgbStr(base.map(x => x * 1.3), 0.7); ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(0, -L * 0.05); ctx.lineTo(0, -L * 0.92); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBushTile(ctx, ox, oy, S, rng) {
    ctx.save(); ctx.translate(ox, oy); ctx.lineCap = 'round';
    const cx = S * 0.5, cy = S * 0.95;
    const twigs = [];
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.38 + rng.range(-0.15, 0.15), L = S * rng.range(0.55, 0.8);
      twigs.push({ a, L });
      ctx.strokeStyle = 'rgb(88,72,58)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); ctx.stroke();
    }
    const n = 58;
    for (let k = 0; k < n; k++) {
      const tw = twigs[k % twigs.length], t = rng.range(0.25, 1.05);
      const x = cx + Math.cos(tw.a) * tw.L * t, y = cy + Math.sin(tw.a) * tw.L * t;
      const a = tw.a + rng.sign() * rng.range(0.3, 1.2);
      const L = S * rng.range(0.07, 0.11), w = L * rng.range(0.45, 0.6);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-w, -L * 0.2, -w * 0.7, -L * 0.8, 0, -L);
      ctx.bezierCurveTo(w * 0.7, -L * 0.8, w, -L * 0.2, 0, 0);
      const br = rng.range(0.72, 1.0), tone = rng();
      const base = (tone < 0.5 ? [232, 236, 212] : tone < 0.8 ? [238, 228, 200] : [236, 214, 196]).map(x => x * br);
      ctx.fillStyle = rgbStr(base); ctx.fill();
      ctx.strokeStyle = rgbStr(base.map(x => x * 0.82), 0.8); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -L * 0.05); ctx.lineTo(0, -L * 0.85); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFern(ctx, W, H, rng) {
    ctx.lineCap = 'round';
    const rx = t => W * 0.5 + Math.sin(t * 2.2) * W * 0.03, ry = t => H * (0.99 - 0.97 * t);
    ctx.strokeStyle = 'rgb(86,92,48)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(rx(0), ry(0));
    for (let i = 1; i <= 20; i++) ctx.lineTo(rx(i / 20), ry(i / 20));
    ctx.stroke();
    const np = 26;
    for (let i = 0; i < np; i++) {
      const s = 0.12 + 0.86 * i / np;
      const env = s < 0.36 ? 0.6 + 0.4 * (s - 0.12) / 0.24 : Math.pow(Math.max(0, 1 - (s - 0.36) / 0.64), 0.85);
      const len = W * 0.47 * env + 3;
      for (const side of [-1, 1]) {
        const x = rx(s), y = ry(s + side * 0.006);
        const a = -Math.PI / 2 + side * rng.range(0.95, 1.15);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
        const w = Math.max(2.5, len * 0.2), nl = Math.max(3, Math.round(len / 7));
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let k = 0; k <= nl; k++) { const f = k / nl, ww = w * Math.pow(1 - f, 0.6) * (k % 2 ? 1 : 0.72); ctx.lineTo(-ww, -len * f); }
        for (let k = nl; k >= 0; k--) { const f = k / nl, ww = w * Math.pow(1 - f, 0.6) * (k % 2 ? 1 : 0.72); ctx.lineTo(ww, -len * f); }
        ctx.closePath();
        const base = mixC([70, 92, 44], [104, 118, 58], rng());
        const g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, rgbStr(base.map(x => x * 0.72))); g.addColorStop(1, rgbStr(s > 0.8 && rng() < 0.5 ? [132, 112, 62] : base));
        ctx.fillStyle = g; ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawFallingLeaf(ctx, ox, oy, S, kind, rng) {
    ctx.save(); ctx.translate(ox + S / 2, oy + S * 0.78); ctx.lineCap = 'round';
    const col = [238, 232, 222];
    if (kind < 2) {
      ctx.save(); ctx.scale(S * 0.62, S * 0.62);
      const veins = mapleLeafPath(ctx, kind === 0 ? 5 : 7, kind === 0 ? 0.42 : 0.3, rng);
      ctx.fillStyle = rgbStr(col); ctx.fill();
      ctx.strokeStyle = rgbStr(col.map(x => x * 0.7)); ctx.lineWidth = 0.025;
      for (const [vx, vy] of veins) { ctx.beginPath(); ctx.moveTo(0, -0.08); ctx.lineTo(vx, vy); ctx.stroke(); }
      ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0, -0.08); ctx.lineTo(0, 0.18); ctx.stroke();
      ctx.restore();
    } else if (kind === 2) {
      const L = S * 0.66, w = L * 0.36;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-w, -L * 0.2, -w * 0.8, -L * 0.75, 0, -L);
      ctx.bezierCurveTo(w * 0.8, -L * 0.75, w, -L * 0.2, 0, 0);
      ctx.fillStyle = rgbStr(col); ctx.fill();
      ctx.strokeStyle = rgbStr(col.map(x => x * 0.7)); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, S * 0.12); ctx.lineTo(0, -L * 0.95); ctx.stroke();
      ctx.lineWidth = 1;
      for (let k = 1; k < 6; k++) {
        const y = -L * k / 6.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-w * 0.7, y - L * 0.1); ctx.moveTo(0, y); ctx.lineTo(w * 0.7, y - L * 0.1); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = rgbStr([200, 176, 140]); ctx.lineWidth = 3;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * S * 0.12, -S * 0.35, s * S * 0.2, -S * 0.7); ctx.stroke(); }
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgb(150,120,90)'; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -4); ctx.stroke();
    }
    ctx.restore();
  }

  function atlasTexture(drawTile, seed, size = 512) {
    const cv = canvas(size, size), ctx = ctx2d(cv), rng = RNG(seed), S = size / 2;
    for (let t = 0; t < 4; t++) drawTile(ctx, (t & 1) * S, (t >> 1) * S, S, rng, t);
    return alphaTexFromCanvas(cv);
  }

  // ------------------------------------------------------------------ geometry buffers
  class GeoBuf {
    constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.wind = []; this.idx = []; }
    get count() { return this.pos.length / 3; }
    get tris() { return this.idx.length / 3; }
    vert(p, n, u, v, c, w) {
      this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.uv.push(u, v);
      this.col.push(c[0], c[1], c[2]); this.wind.push(w[0], w[1], w[2], w[3]);
      return this.count - 1;
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      g.setAttribute('wind', new THREE.Float32BufferAttribute(this.wind, 4));
      g.setIndex(this.idx);
      g.computeBoundingBox(); g.computeBoundingSphere();
      g.boundingSphere.radius += 0.5;          // wind sway margin
      return g;
    }
  }

  // Tapered tube along a Catmull-Rom curve.
  // o: r0, r1, taper(pow), radial, segs, flare, irregular, uRep, texH (m per v), twist,
  //    bob:[w0,w1], phase, colorFn(p,n,t)->[r,g,b], seed
  function addTube(buf, pts, o) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const segs = o.segs, radial = o.radial;
    const fr = curve.computeFrenetFrames(segs, false);
    const L = curve.getLength();
    const base = buf.count;
    const irr = o.irregular || 0, sd = o.seed || 0;
    const rAt = t => {
      let r = lerp(o.r0, o.r1, Math.pow(t, o.taper || 1));
      if (o.flare) r *= 1 + o.flare * Math.exp(-t * L / 0.7);
      return r;
    };
    const p = new V3(), n = new V3(), dir = new V3(), tan = new V3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, P = curve.getPointAt(t);
      const T = fr.tangents[i], N = fr.normals[i], B = fr.binormals[i];
      const r = rAt(t), dr = (rAt(Math.min(1, t + 0.01)) - rAt(Math.max(0, t - 0.01))) / (0.02 * L);
      const rootK = o.flare ? 1 + 2.2 * Math.exp(-t * L / 0.9) : 1;
      for (let j = 0; j <= radial; j++) {
        const th = (j / radial) * TAU;
        const ct = Math.cos(th), st = Math.sin(th);
        // irregular cross-section (gnarl + root buttresses)
        const e = irr * rootK * (0.55 * Math.sin(3 * th + t * 7 + sd) + 0.3 * Math.sin(5 * th - t * 11 + sd * 2) + (o.flare ? 0.35 * rootK * Math.cos(5 * th + sd) * 0.5 : 0));
        const de = irr * rootK * (1.65 * Math.cos(3 * th + t * 7 + sd) + 1.5 * Math.cos(5 * th - t * 11 + sd * 2));
        const rr = r * (1 + e);
        dir.set(0, 0, 0).addScaledVector(N, ct).addScaledVector(B, st);
        tan.set(0, 0, 0).addScaledVector(N, -st).addScaledVector(B, ct);
        p.copy(P).addScaledVector(dir, rr);
        n.copy(dir).addScaledVector(tan, -de / (1 + e) * 0.5).addScaledVector(T, -dr).normalize();
        const u = (j / radial) * (o.uRep || 1) + (o.twist || 0) * t;
        const v = (t * L) / (o.texH || 1);
        const c = o.colorFn ? o.colorFn(p, n, t) : [1, 1, 1];
        const bw = o.bob ? lerp(o.bob[0], o.bob[1], Math.pow(t, 1.5)) : 0;
        buf.vert(p, n, u, v, c, [0, 0, bw, o.phase || 0]);
      }
    }
    const row = radial + 1;
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
      const a = base + i * row + j, b = a + 1, c = a + row, d = c + 1;
      buf.idx.push(a, b, c, b, d, c);
    }
    return { curve, L, rAt };
  }

  const INS = 3 / 512;
  const _r = new V3(), _u = new V3(), _q = new V3(), _nn = new V3(), _rad = new V3();
  // Alpha-tested leaf card. o: c, n, up, w, h, tile(-1 = full texture), col, centre, bend,
  // fw:[4 flutter weights], fph, bob, bph, anchor('center'|'bottom')
  function addCard(buf, o) {
    _r.crossVectors(o.up, o.n).normalize();
    _u.crossVectors(o.n, _r).normalize();
    const hw = o.w / 2;
    let u0 = 0, u1 = 1, v0 = 0, v1 = 1;
    if (o.tile >= 0) {
      const cx = o.tile & 1, cy = o.tile >> 1;
      u0 = cx * 0.5 + INS; u1 = cx * 0.5 + 0.5 - INS;
      v0 = (cy === 0 ? 0.5 : 0) + INS; v1 = v0 + 0.5 - 2 * INS;
    }
    const y0 = o.anchor === 'bottom' ? 0 : -o.h / 2, y1 = y0 + o.h;
    const cs = [[-hw, y0, u0, v0], [hw, y0, u1, v0], [hw, y1, u1, v1], [-hw, y1, u0, v1]];
    const fw = o.fw || [0.3, 0.6, 1, 0.8];
    const base = buf.count;
    for (let k = 0; k < 4; k++) {
      const [x, y, u, v] = cs[k];
      _q.copy(o.c).addScaledVector(_r, x).addScaledVector(_u, y);
      _rad.copy(_q).sub(o.centre);
      if (_rad.lengthSq() < 1e-6) _rad.set(0, 1, 0);
      _rad.normalize();
      _nn.copy(o.n);
      if (_nn.dot(_rad) < 0) _nn.negate();
      _nn.multiplyScalar(1 - o.bend).addScaledVector(_rad, o.bend).normalize();
      buf.vert(_q, _nn, u, v, o.col, [fw[k], o.fph, o.bob || 0, o.bph || 0]);
    }
    buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function randUnit(rng, out = new V3()) {
    const z = rng() * 2 - 1, a = rng() * TAU, s = Math.sqrt(1 - z * z);
    return out.set(s * Math.cos(a), z, s * Math.sin(a));
  }
  function randPerp(n, rng) {
    const t = Math.abs(n.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0);
    const a = new V3().crossVectors(n, t).normalize(), b = new V3().crossVectors(n, a);
    const th = rng() * TAU;
    return a.multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th));
  }
  function barkColor(mossAmt, seed) {
    return (p, n, t) => {
      const ao = 0.55 + 0.45 * smooth(-0.4, 0.6, p.y);
      const m = mossAmt * smooth(0.1, 0.7, n.y + 0.25 * Math.sin(p.x * 3.1 + p.z * 2.3 + seed)) * (0.6 + 0.4 * smooth(2.5, 0, p.y));
      return [lerp(1, 0.62, m) * ao, lerp(1, 0.78, m) * ao, lerp(1, 0.42, m) * ao];
    };
  }
  function tint(rng, base, vari) {
    const v = rng.range(1 - vari, 1 + vari * 0.6);
    return [base[0] * v, base[1] * v, base[2] * v];
  }

  // ------------------------------------------------------------------ archetype builders
  function finish(parts, extra) {
    let tris = 0, maxY = 0, maxR = 0;
    for (const p of parts) {
      tris += p.geometry.index.count / 3;
      const bb = p.geometry.boundingBox;
      maxY = Math.max(maxY, bb.max.y);
      maxR = Math.max(maxR, -bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
    }
    return Object.assign({ parts, height: +maxY.toFixed(2), canopyRadius: +maxR.toFixed(2), tris }, extra);
  }
  const mkPart = (geometry, material) => ({
    geometry, material,
    customDepthMaterial: material.userData.depthMat, customDistanceMaterial: material.userData.distMat,
  });

  // Chinese pine: leaning, twisting trunk + near-horizontal limbs, each ending in a flat,
  // irregular cloud of needle pads (ink-painting style tiers) and an umbrella-like apex.
  function buildPine(seed, H, st, M) {
    const rng = RNG(seed), bark = new GeoBuf(), leaf = new GeoBuf();
    const nS = 7, seg = (H + 0.6) / nS, leanAz = rng() * TAU;
    let az = leanAz, p = new V3(0, -0.6, 0);
    const pts = [p.clone()];
    for (let i = 1; i <= nS; i++) {
      const f = i / nS;
      const tl = st.lean * (1 - st.sbend * f * 1.7) + rng.range(-0.07, 0.07);
      az += rng.range(-0.3, 0.3);
      p = p.clone().add(new V3(Math.sin(tl) * Math.cos(az), Math.cos(tl), Math.sin(tl) * Math.sin(az)).multiplyScalar(seg));
      pts.push(p);
    }
    const ys = (H + 0.6) / (p.y + 0.6);
    for (const q of pts) q.y = -0.6 + (q.y + 0.6) * ys;
    const r0 = 0.021 * H + 0.06;
    const trunk = addTube(bark, pts, { r0, r1: 0.08, taper: 0.75, radial: 9, segs: 16, flare: 0.35, irregular: 0.06, uRep: 2, texH: r0 * TAU, twist: 0.3, seed: seed % 7, colorFn: barkColor(0.35, seed) });
    const tc = trunk.curve;
    const pads = [];
    const top = pts[pts.length - 1];
    const leanDir = new V3(top.x, 0, top.z);
    if (leanDir.lengthSq() < 1e-4) leanDir.set(1, 0, 0);
    leanDir.normalize();
    const leanA = Math.atan2(leanDir.z, leanDir.x);
    const up = new V3(0, 1, 0);
    // branches grow in whorls: 2-3 limbs at nearly the same height -> wide cloud layers
    const blist = [];
    for (let w = 0; w < st.whorls; w++) {
      const tw = st.t0 + (0.88 - st.t0) * (w + rng.range(0.15, 0.85)) / st.whorls;
      const nw = rng() < 0.35 ? 3 : 2, a0 = rng() * TAU;
      for (let k = 0; k < nw; k++) blist.push({ tt: clamp(tw + rng.range(-0.025, 0.025), 0.2, 0.92), az: a0 + (k / nw) * TAU + rng.range(-0.5, 0.5), lf: k === 0 ? 1 : rng.range(0.6, 0.95) });
    }
    for (let b = 0; b < blist.length; b++) {
      const tt = blist[b].tt;
      const P = tc.getPointAt(tt), rT = trunk.rAt(tt);
      let baz = blist[b].az;
      if (st.oneSide) { const d = Math.atan2(Math.sin(leanA - baz), Math.cos(leanA - baz)); baz += d * st.oneSide; }
      const L = H * (0.42 - 0.22 * (tt - st.t0) / (0.9 - st.t0)) * blist[b].lf * rng.range(0.9, 1.1);
      const pitch = rng.range(-0.1, 0.2) - 0.15 * (1 - tt);
      const dir = new V3(Math.cos(baz) * Math.cos(pitch), Math.sin(pitch), Math.sin(baz) * Math.cos(pitch));
      const side = new V3(-Math.sin(baz), 0, Math.cos(baz));
      const k1 = P.clone().addScaledVector(dir, L * 0.33).addScaledVector(side, rng.range(-0.1, 0.1) * L); k1.y -= L * 0.08 * rng.range(0.4, 1.4);
      const k2 = P.clone().addScaledVector(dir, L * 0.68).addScaledVector(side, rng.range(-0.12, 0.12) * L); k2.y -= L * 0.07 * rng.range(0, 1.4);
      const tip = P.clone().addScaledVector(dir, L); tip.y += L * rng.range(0.03, 0.12);
      const rb = Math.min(rT * 0.62, 0.05 + 0.022 * L), phase = rng(), bobEnd = 0.03 + 0.018 * L;
      const br = addTube(bark, [P.clone().addScaledVector(dir, -rT * 0.4), k1, k2, tip], { r0: rb, r1: 0.03, radial: 6, segs: 6, uRep: 1, texH: 1.2, bob: [0, bobEnd], phase, seed: b, colorFn: barkColor(0.5, seed + b) });
      const dirH = new V3(dir.x, 0, dir.z).normalize();
      const ps = (0.95 + 0.2 * L) * st.pad;
      const lvl = tip.y + 0.25;
      pads.push({ c: tip.clone().setY(lvl).addScaledVector(dirH, 0.3), f: dirH, rx: ps * 1.2, rz: ps, ry: 0.42 + 0.05 * L, bob: bobEnd, phase });
      // side sub-branches feeding satellite pads that merge with the tip pad into one cloud layer
      const nsub = L > 3 ? 2 : 1;
      for (let s = 0; s < nsub; s++) {
        const ts = rng.range(0.5, 0.75), Q = br.curve.getPointAt(ts);
        const sa = baz + (s === 0 ? 1 : -1) * rng.range(0.7, 1.25);
        const sd = new V3(Math.cos(sa), rng.range(0.0, 0.2), Math.sin(sa)).normalize();
        const Ls = L * rng.range(0.3, 0.42);
        const m1 = Q.clone().addScaledVector(sd, Ls * 0.5); m1.y -= Ls * 0.05;
        const e1 = Q.clone().addScaledVector(sd, Ls); e1.y += Ls * 0.12;
        const bobQ = lerp(0, bobEnd, Math.pow(ts, 1.5)), bobS = bobQ + 0.03 * Ls;
        addTube(bark, [Q, m1, e1], { r0: rb * 0.5, r1: 0.02, radial: 4, segs: 3, texH: 1.2, bob: [bobQ, bobS], phase, colorFn: barkColor(0.5, seed + b + s) });
        const sH = new V3(sd.x, 0, sd.z).normalize(), pss = ps * rng.range(0.62, 0.8);
        pads.push({ c: e1.clone().setY(lerp(e1.y + 0.15, lvl, 0.5)), f: sH, rx: pss * 1.15, rz: pss * 0.9, ry: 0.36 + 0.04 * Ls, bob: bobS, phase });
      }
    }
    // umbrella apex: a few broad, flat pads around the top
    const nApex = 3;
    for (let a = 0; a < nApex; a++) {
      const aa = leanA + (a / nApex) * TAU + rng.range(-0.4, 0.4);
      const off = new V3(Math.cos(aa), 0, Math.sin(aa));
      pads.push({ c: top.clone().addScaledVector(off, H * 0.06 * st.pad).add(new V3(0, rng.range(-0.5, 0.1), 0)), f: off, rx: H * 0.1 * st.pad, rz: H * 0.085 * st.pad, ry: 0.5, bob: 0.03, phase: rng() });
    }
    pads.push({ c: top.clone().add(new V3(0, 0.15, 0)), f: leanDir, rx: H * 0.075 * st.pad, rz: H * 0.07 * st.pad, ry: 0.45, bob: 0.02, phase: rng() });

    const budget = Math.floor((st.budget - bark.tris) / 2);
    const area = pads.map(pd => pd.rx * pd.rz);
    const atot = area.reduce((a, b) => a + b, 0);
    const sideV = new V3(), pos = new V3(), nrm = new V3(), tiltD = new V3(), cen = new V3();
    let made = 0;
    pads.forEach((pd, pi) => {
      const n = pi === pads.length - 1 ? budget - made : Math.round(budget * area[pi] / atot);
      sideV.crossVectors(up, pd.f).normalize();
      cen.copy(pd.c).y -= pd.ry * 2.2;
      // lumpy outline: angular radius modulation
      const lo = [rng() * TAU, rng() * TAU, rng.range(0.1, 0.25)];
      for (let k = 0; k < n; k++) {
        let x, y, z;
        do { x = rng() * 2 - 1; y = rng() * 2 - 1; z = rng() * 2 - 1; } while (x * x + y * y + z * z > 1);
        const ang = Math.atan2(z, x), lump = 1 + lo[2] * Math.sin(3 * ang + lo[0]) + 0.1 * Math.sin(5 * ang + lo[1]);
        y = y * 0.75 + 0.12;
        pos.copy(pd.c).addScaledVector(pd.f, x * pd.rx * lump).addScaledVector(up, y * pd.ry).addScaledVector(sideV, z * pd.rz * lump);
        const rim = Math.sqrt(x * x + z * z);
        const ta = rng.range(0.05, 0.6) + rim * rim * 0.7;
        if (rim > 0.4 && rng() < 0.8) tiltD.copy(pd.f).multiplyScalar(x).addScaledVector(sideV, z).normalize();
        else { const a = rng() * TAU; tiltD.set(Math.cos(a), 0, Math.sin(a)); }
        nrm.copy(up).multiplyScalar(Math.cos(ta)).addScaledVector(tiltD, Math.sin(ta)).normalize();
        const sz = rng.range(0.95, 1.4) * st.card;
        const ao = (0.6 + 0.4 * smooth(-0.9, 0.8, y)) * (0.82 + 0.18 * rim);
        const hue = rng();
        const col = tint(rng, [ao * lerp(0.9, 1.04, hue), ao, ao * lerp(1.06, 0.88, hue)], 0.12);
        addCard(leaf, { c: pos, n: nrm, up: randPerp(nrm, rng), w: sz, h: sz, tile: rng.int(0, 3), col, centre: cen, bend: 0.62, fph: rng(), bob: pd.bob, bph: pd.phase, anchor: 'center', fw: [0.4, 1, 0.6, 1] });
        made++;
      }
    });
    return finish([mkPart(bark.geometry(), M.pineBark), mkPart(leaf.geometry(), M.pineLeaf)], { trunkRadius: +(r0 * 0.9).toFixed(2) });
  }

  // Maple: short trunk forking into limbs, branches aimed at points on a rounded crown shell
  function buildMaple(seed, H, palette, M) {
    const rng = RNG(seed), bark = new GeoBuf(), leaf = new GeoBuf();
    const sH = H / 8;
    const C = new V3(rng.range(-0.3, 0.3), H * 0.6, rng.range(-0.3, 0.3));
    const Rx = H * 0.48 * rng.range(0.88, 1.0), Ry = H * 0.37, Rz = Rx * rng.range(0.85, 1.05);
    const forkH = H * rng.range(0.25, 0.32);
    const fork = new V3(C.x * 0.4, forkH, C.z * 0.4);
    const r0 = 0.24 * sH;
    const tcol = barkColor(0.35, seed);
    addTube(bark, [new V3(0, -0.5, 0), new V3(rng.range(-0.1, 0.1), forkH * 0.35, rng.range(-0.1, 0.1)), new V3(fork.x * 0.6, forkH * 0.72, fork.z * 0.6), fork],
      { r0, r1: r0 * 0.72, radial: 8, segs: 6, flare: 0.45, irregular: 0.07, uRep: 2, texH: r0 * TAU, seed: seed % 5, colorFn: tcol });
    // terminal points on the crown shell (fibonacci)
    const term = [], nT = 26, ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; term.length < nT && i < 200; i++) {
      const y = 1 - (i + 0.5) / 60 * 2, rr = Math.sqrt(1 - y * y), th = i * ga + seed;
      if (y < -0.4) break;
      const s = rng.range(0.72, 0.92);
      term.push(new V3(C.x + Math.cos(th) * rr * Rx * s, C.y + y * Ry * s, C.z + Math.sin(th) * rr * Rz * s));
    }
    const nL = rng.int(3, 4), lA0 = rng() * TAU;
    const groups = Array.from({ length: nL }, () => []);
    for (const T of term) {
      const a = Math.atan2(T.z - fork.z, T.x - fork.x);
      let best = 0, bd = 9;
      for (let l = 0; l < nL; l++) { const la = lA0 + l * TAU / nL; const d = Math.abs(Math.atan2(Math.sin(a - la), Math.cos(a - la))); if (d < bd) { bd = d; best = l; } }
      groups[best].push(T);
    }
    const clusters = [];
    for (let l = 0; l < nL; l++) {
      const G = groups[l]; if (!G.length) continue;
      const Mc = G.reduce((a, b) => a.add(b), new V3()).multiplyScalar(1 / G.length);
      const le = fork.clone().lerp(Mc, 0.45); le.y += 0.3 * sH;
      const mid = fork.clone().lerp(le, 0.5).add(new V3(rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)).multiplyScalar(sH));
      const phase = rng();
      addTube(bark, [fork.clone().add(new V3(0, -0.25 * sH, 0)), mid, le], { r0: r0 * 0.62, r1: r0 * 0.34, radial: 6, segs: 5, uRep: 1, texH: 1.4, bob: [0, 0.02], phase, colorFn: tcol });
      G.sort((a, b) => Math.atan2(a.z - C.z, a.x - C.x) - Math.atan2(b.z - C.z, b.x - C.x) + (a.y - b.y) * 0.1);
      for (let i = 0; i < G.length; i += 2) {
        const pair = G.slice(i, i + 2);
        const avg = pair.reduce((a, b) => a.add(b), new V3()).multiplyScalar(1 / pair.length);
        const P = le.clone().lerp(avg, 0.55).add(new V3(rng.range(-0.25, 0.25), rng.range(-0.1, 0.3), rng.range(-0.25, 0.25)).multiplyScalar(sH));
        const m = le.clone().lerp(P, 0.5); m.y += rng.range(-0.15, 0.2) * sH;
        addTube(bark, [le, m, P], { r0: r0 * 0.3, r1: r0 * 0.17, radial: 5, segs: 4, texH: 1.4, bob: [0.02, 0.06], phase, colorFn: tcol });
        for (const T of pair) {
          const m2 = P.clone().lerp(T, 0.5); m2.y += rng.range(-0.1, 0.2) * sH;
          addTube(bark, [P, m2, T], { r0: r0 * 0.15, r1: 0.012, radial: 3, segs: 3, texH: 1.4, bob: [0.06, 0.12], phase, colorFn: tcol });
          clusters.push({ c: T, bob: 0.12, phase, col: rng.pick(palette) });
          if (rng() < 0.5) clusters.push({ c: P.clone().lerp(T, 0.45), bob: 0.08, phase, col: rng.pick(palette), small: true });
        }
      }
    }
    const budget = Math.floor((3500 - bark.tris) / 2);
    const per = budget / clusters.reduce((a, c) => a + (c.small ? 0.5 : 1), 0);
    let made = 0;
    const pos = new V3(), nrm = new V3(), en = new V3(), rel = new V3();
    clusters.forEach((cl, ci) => {
      const n = ci === clusters.length - 1 ? budget - made : Math.round(per * (cl.small ? 0.5 : 1));
      const rc = (cl.small ? 0.8 : 1.15) * sH * rng.range(0.9, 1.1);
      const base = linCol(cl.col);
      for (let k = 0; k < n; k++) {
        randUnit(rng, rel).multiplyScalar(rc * Math.cbrt(rng.range(0.1, 1)));
        pos.copy(cl.c).add(rel);
        // keep inside a slightly inflated crown ellipsoid
        en.set((pos.x - C.x) / Rx, (pos.y - C.y) / Ry, (pos.z - C.z) / Rz);
        const el = en.length();
        if (el > 1.08) { en.multiplyScalar(1.08 / el); pos.set(C.x + en.x * Rx, C.y + en.y * Ry, C.z + en.z * Rz); }
        const out = new V3((pos.x - C.x) / (Rx * Rx), (pos.y - C.y) / (Ry * Ry), (pos.z - C.z) / (Rz * Rz)).normalize();
        randUnit(rng, nrm).lerp(out, 0.35).normalize();
        const sz = rng.range(1.0, 1.35) * Math.sqrt(sH);
        const rn = Math.min(el, 1.1);
        const ao = (0.55 + 0.45 * smooth(0.3, 1.0, rn)) * (0.78 + 0.22 * smooth(-1, 0.6, (pos.y - C.y) / Ry));
        const hueJ = rng.range(-0.1, 0.1);
        const col = tint(rng, [base[0] * ao, base[1] * ao * (1 + hueJ * 2), base[2] * ao], 0.14);
        addCard(leaf, { c: pos, n: nrm, up: randPerp(nrm, rng), w: sz, h: sz, tile: rng.int(0, 3), col, centre: C, bend: 0.7, fph: rng(), bob: cl.bob, bph: cl.phase, anchor: 'center' });
        made++;
      }
    });
    return finish([mkPart(bark.geometry(), M.mapleBark), mkPart(leaf.geometry(), M.mapleLeaf)], { trunkRadius: +(r0 * 0.9).toFixed(2) });
  }

  // Dead tree: twisted trunk, recursive gnarled limbs, broken stubs
  function buildDead(seed, H, M) {
    const rng = RNG(seed), bark = new GeoBuf();
    const sH = H / 7, r0 = 0.2 * sH;
    const radial = [8, 6, 5, 4, 3], segsA = [8, 5, 4, 3, 2];
    const tcol = barkColor(0.25, seed);
    const up = new V3(0, 1, 0);
    function grow(p0, dir, len, r, depth, phase, bob0) {
      const nSeg = depth === 0 ? 5 : 3;
      const pts = [p0.clone().addScaledVector(dir, depth === 0 ? 0 : -r * 0.6)];
      let cur = p0.clone(); const d = dir.clone();
      for (let s = 1; s <= nSeg; s++) {
        d.add(randUnit(rng).multiplyScalar(depth === 0 ? 0.18 : 0.42)).addScaledVector(up, depth === 0 ? 0.12 : 0.06).normalize();
        cur = cur.clone().addScaledVector(d, len / nSeg); pts.push(cur);
      }
      const broken = depth >= 1 && depth < 3 && rng() < 0.22;
      const last = depth >= 3 || broken;
      const r1 = broken ? r * 0.55 : depth >= 3 ? 0.012 : r * 0.55;
      const bob1 = bob0 + (depth === 0 ? 0 : 0.012 * len);
      const tube = addTube(bark, pts, { r0: r, r1, radial: radial[depth], segs: segsA[depth], flare: depth === 0 ? 0.5 : 0, irregular: depth < 2 ? 0.09 : 0.04, uRep: depth === 0 ? 2 : 1, texH: depth === 0 ? r * TAU : 1.0, twist: depth === 0 ? 0.6 : 0.2, seed: depth + seed % 5, bob: [bob0, bob1], phase, colorFn: tcol });
      if (last) return;
      const nc = depth === 0 ? 3 : rng.int(2, 3);
      for (let c = 0; c < nc; c++) {
        const atEnd = c < 2;
        const t = atEnd ? 1 : rng.range(0.45, 0.8);
        const P = tube.curve.getPointAt(t), T = tube.curve.getTangentAt(t);
        const ax = randPerp(T, rng);
        const ang = atEnd ? rng.range(0.35, 0.8) : rng.range(0.7, 1.2);
        const cd = T.clone().applyAxisAngle(ax, ang).addScaledVector(up, 0.15).normalize();
        grow(P, cd, len * rng.range(0.55, 0.72), tube.rAt(t) * (atEnd ? 0.85 : 0.65), depth + 1, depth === 0 ? rng() : phase, lerp(bob0, bob1, t));
      }
    }
    const lean = rng.range(0.08, 0.25), la = rng() * TAU;
    grow(new V3(0, -0.5, 0), new V3(Math.sin(lean) * Math.cos(la), Math.cos(lean), Math.sin(lean) * Math.sin(la)), H * 0.5, r0, 0, rng(), 0);
    return finish([mkPart(bark.geometry(), M.deadBark)], { trunkRadius: +(r0 * 0.9).toFixed(2) });
  }

  // Bamboo clump: slender culms arching outward, leaf sprays on the upper half
  function buildBamboo(seed, nC, hMin, hMax, M) {
    const rng = RNG(seed), culm = new GeoBuf(), leaf = new GeoBuf();
    const culms = [];
    const culmTints = [[1, 1, 1], [1.08, 1.05, 0.82], [0.92, 0.98, 0.92], [1.02, 0.95, 0.8]];
    for (let c = 0; c < nC; c++) {
      const a = rng() * TAU, rr = Math.sqrt(rng()) * 0.6;
      const b = new V3(Math.cos(a) * rr, -0.4, Math.sin(a) * rr);
      const out = rr > 0.1 ? new V3(b.x, 0, b.z).normalize() : new V3(Math.cos(a), 0, Math.sin(a));
      const h = rng.range(hMin, hMax), lean = rng.range(0.04, 0.14) + rr * 0.15, arch = rng.range(0.1, 0.22);
      const pts = [];
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        pts.push(b.clone().addScaledVector(out, h * (lean * f + arch * Math.pow(f, 2.5))).add(new V3(0, h * f * (1 - 0.04 * f), 0)));
      }
      const r = rng.range(0.03, 0.048), phase = rng();
      const ct = rng.pick(culmTints);
      const tube = addTube(culm, pts, { r0: r, r1: r * 0.5, radial: 5, segs: 7, uRep: 1, texH: 0.38, phase, colorFn: (p) => { const ao = 0.6 + 0.4 * smooth(-0.4, 1.0, p.y); return [ct[0] * ao, ct[1] * ao, ct[2] * ao]; } });
      culms.push({ tube, h, out, phase });
    }
    const budget = Math.floor((3000 - culm.tris) / 2);
    const hs = culms.reduce((a, c) => a + c.h, 0);
    let made = 0;
    const nrm = new V3(), upv = new V3(), pos = new V3(), cen = new V3();
    culms.forEach((cm, ci) => {
      const n = ci === culms.length - 1 ? budget - made : Math.round(budget * cm.h / hs);
      for (let k = 0; k < n; k++) {
        const tip = k < n * 0.2;
        const t = tip ? rng.range(0.88, 1.0) : 0.4 + 0.52 * Math.pow(rng(), 0.6);
        const P = cm.tube.curve.getPointAt(t);
        const a = rng() * TAU;
        const od = new V3(Math.cos(a), 0, Math.sin(a)).lerp(cm.out, 0.45).normalize();
        // sprays point outward and droop; near the tip they fan upward then arch over
        const droop = tip ? rng.range(-0.4, 0.8) : rng.range(-0.9, 0.15);
        upv.copy(od).add(new V3(0, droop, 0)).normalize();
        nrm.copy(randPerp(upv, rng)).lerp(new V3(0, 1, 0), 0.3).normalize();
        nrm.addScaledVector(upv, -nrm.dot(upv)).normalize();
        pos.copy(P).addScaledVector(od, 0.02);
        cen.copy(P); cen.y -= 0.8;
        const sz = rng.range(0.8, 1.15);
        const ao = 0.55 + 0.45 * smooth(0.35, 1.0, t);
        const col = tint(rng, [ao * rng.range(0.95, 1.1), ao, ao * rng.range(0.85, 1.0)], 0.12);
        addCard(leaf, { c: pos, n: nrm, up: upv, w: sz * 0.9, h: sz, tile: rng.int(0, 3), col, centre: cen, bend: 0.5, fph: rng(), bob: 0, bph: cm.phase, anchor: 'bottom', fw: [0.05, 0.05, 1, 1] });
        made++;
      }
    });
    return finish([mkPart(culm.geometry(), M.bambooCulm), mkPart(leaf.geometry(), M.bambooLeaf)], { trunkRadius: 0.45 });
  }

  function buildBush(seed, H, cols, M) {
    const rng = RNG(seed), leaf = new GeoBuf();
    const R = H * 0.62, C = new V3(0, H * 0.42, 0), cen = new V3(0, H * 0.05, 0);
    const pos = new V3(), nrm = new V3(), rel = new V3();
    const lc = cols.map(linCol);
    for (let k = 0; k < 290; k++) {
      randUnit(rng, rel);
      if (rel.y < -0.3) rel.y = -rel.y * 0.5;
      rel.multiplyScalar(Math.cbrt(rng.range(0.15, 1)));
      pos.set(C.x + rel.x * R, C.y + rel.y * H * 0.55, C.z + rel.z * R);
      const out = pos.clone().sub(cen).normalize();
      randUnit(rng, nrm).lerp(out, 0.4).normalize();
      const sz = rng.range(0.45, 0.65) * H / 1.2;
      const ao = 0.45 + 0.55 * smooth(0.0, H * 0.9, pos.y) * (0.7 + 0.3 * rel.length());
      const b = rng.pick(lc);
      const col = tint(rng, [b[0] * ao, b[1] * ao, b[2] * ao], 0.15);
      addCard(leaf, { c: pos, n: nrm, up: randPerp(nrm, rng), w: sz, h: sz, tile: rng.int(0, 3), col, centre: cen, bend: 0.7, fph: rng(), bob: 0, bph: rng(), anchor: 'center' });
    }
    return finish([mkPart(leaf.geometry(), M.bush)], { trunkRadius: 0 });
  }

  function buildFern(seed, M) {
    const rng = RNG(seed), g = new GeoBuf();
    const nF = 12, segs = 6;
    const p = new V3(), n = new V3(), T = new V3(), Wd = new V3(), up = new V3(0, 1, 0);
    const tints = [[1, 1, 1], [1.05, 1.0, 0.85], [1.25, 0.95, 0.6]];
    for (let f = 0; f < nF; f++) {
      const a = (f / nF) * TAU + rng.range(-0.25, 0.25);
      const out = new V3(Math.cos(a), 0, Math.sin(a));
      const side = new V3(-out.z, 0, out.x);
      const Lf = rng.range(0.7, 1.05), hk = rng.range(1.5, 1.8), dk = rng.range(1.15, 1.45);
      const w = 0.3 * Lf, roll = rng.range(-0.35, 0.35);
      const tc = tints[rng() < 0.7 ? 0 : rng() < 0.6 ? 1 : 2];
      const base = g.count;
      const ph = rng();
      for (let i = 0; i <= segs; i++) {
        const s = i / segs;
        const pos = (ss) => new V3(0, 0, 0).addScaledVector(out, Lf * 0.8 * ss).addScaledVector(up, Lf * (hk * ss - dk * ss * ss) * 0.9);
        const P = pos(s); T.copy(pos(Math.min(1, s + 0.02))).sub(pos(Math.max(0, s - 0.02))).normalize();
        Wd.copy(side).applyAxisAngle(T, roll);
        n.crossVectors(Wd, T).normalize(); if (n.y < 0) n.negate();
        const fold = 0.22 * w * (1 - s * 0.5);
        const ao = 0.55 + 0.45 * smooth(0, 0.5, s);
        const col = [tc[0] * ao, tc[1] * ao, tc[2] * ao];
        for (let k = 0; k < 3; k++) {
          const x = (k - 1) * 0.5 * w;
          p.copy(P).addScaledVector(Wd, x).addScaledVector(n, k === 1 ? fold : 0);
          const nn = n.clone().addScaledVector(Wd, (k - 1) * 0.5).addScaledVector(out, 0.3).normalize();
          g.vert(p, nn, k * 0.5, s, col, [s * s, ph, 0, 0]);
        }
      }
      for (let i = 0; i < segs; i++) for (let k = 0; k < 2; k++) {
        const a0 = base + i * 3 + k, b0 = a0 + 1, c0 = a0 + 3, d0 = c0 + 1;
        g.idx.push(a0, b0, d0, a0, d0, c0);
      }
    }
    return finish([mkPart(g.geometry(), M.fern)], { trunkRadius: 0 });
  }

  function buildRock(seed, sx, sy, sz, M) {
    const rng = RNG(seed);
    let g = new THREE.IcosahedronGeometry(1, 5);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const simplex = new SimplexNoise(rng);
    const planes = [];
    for (let i = 0; i < 9; i++) planes.push({ n: randUnit(rng), d: rng.range(0.55, 0.85) });
    const pa = g.attributes.position, v = new V3();
    let minY = 1e9;
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).normalize();
      const r = 1 + simplex.noise3d(v.x * 1.2, v.y * 1.2, v.z * 1.2) * 0.22 + simplex.noise3d(v.x * 3, v.y * 3, v.z * 3) * 0.1 + Math.abs(simplex.noise3d(v.x * 6, v.y * 6, v.z * 6)) * 0.06 + simplex.noise3d(v.x * 12, v.y * 12, v.z * 12) * 0.015;
      v.multiplyScalar(r);
      for (const pl of planes) { const d = v.dot(pl.n) - pl.d; if (d > 0) v.addScaledVector(pl.n, -d * 0.92); }
      v.x *= sx; v.y *= sy; v.z *= sz;
      const cut = -sy * 0.35;
      if (v.y < cut) v.y = cut + (v.y - cut) * 0.25;
      pa.setXYZ(i, v.x, v.y, v.z);
      minY = Math.min(minY, v.y);
    }
    g.translate(0, -minY - 0.3, 0);
    g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    const bb = g.boundingBox;
    const hr = (bb.max.x - bb.min.x + bb.max.z - bb.min.z) / 4;
    return finish([{ geometry: g, material: M.rock }], { trunkRadius: +(hr * 0.8).toFixed(2) });
  }

  // ------------------------------------------------------------------ materials
  const WIND_GLSL = /* glsl */`
uniform float vegTime;
uniform float vegWind;
attribute vec4 wind;   // x flutter weight, y flutter phase, z branch bob weight (m), w branch/culm phase
vec3 vegDisplace(vec3 p, vec3 n) {
#ifdef USE_INSTANCING
  mat3 vgM = mat3(instanceMatrix);
  vec2 vgP = instanceMatrix[3].xz + modelMatrix[3].xz;
#else
  mat3 vgM = mat3(1.0);
  vec2 vgP = modelMatrix[3].xz;
#endif
  float t = vegTime, s = vegWind;
  vec2 wd = vec2(VEG_WDX, VEG_WDZ);
  float ph = dot(vgP, vec2(0.371, 0.613));
  float gx = dot(vgP, wd) * 0.05 - t * 0.6;
  float gust = clamp(0.5 + 0.32 * sin(gx) + 0.18 * sin(gx * 2.7 + 1.3), 0.0, 1.0);
  float h = max(p.y, 0.0) / VEG_HREF;
#ifdef VEG_CULM_PHASE
  float cp = wind.w * 6.2832;
#else
  float cp = 0.0;
#endif
  float bend = VEG_SWAY * s * h * h;
  float osc = sin(t * VEG_FREQ + ph + cp) + 0.35 * sin(t * VEG_FREQ * 2.31 + ph * 1.7 + cp * 1.3);
  vec3 wo = vec3(wd.x, 0.0, wd.y) * bend * (0.6 * gust + osc * (0.25 + 0.35 * gust));
  wo += vec3(-wd.y, 0.0, wd.x) * bend * 0.25 * sin(t * VEG_FREQ * 0.73 + ph * 2.3 + cp);
  vec3 lo = (transpose(vgM) * wo) / max(dot(vgM[0], vgM[0]), 1e-6);
  lo.y += wind.z * s * (0.4 + 0.8 * gust) * sin(t * 1.9 + ph * 1.3 + wind.w * 6.2832);
  lo += n * (wind.x * VEG_FLUTTER * s * (0.35 + gust) * sin(t * 6.3 + wind.y * 6.2832 + ph * 2.0));
  return lo;
}
`;
  // keep coverage of alpha-tested cards in distant mips
  const ALPHA_BOOST = /* glsl */`
#ifdef USE_MAP
  {
    vec2 vgT = vMapUv * VEG_TEX;
    vec2 vgDx = dFdx(vgT), vgDy = dFdy(vgT);
    float vgLod = 0.5 * log2(max(max(dot(vgDx, vgDx), dot(vgDy, vgDy)), 1e-8));
    diffuseColor.a *= 1.0 + max(vgLod, 0.0) * 0.3;
  }
#endif
`;
  // translucency + wrap lighting for foliage, using the (shadowed) last directional light
  const FOLIAGE_LIGHT = /* glsl */`
#if NUM_DIR_LIGHTS > 0
  {
    float vgNL = dot(geometryNormal, directLight.direction);
    float vgWrap = saturate((vgNL + 0.6) / 1.6) - saturate(vgNL);
    float vgBack = pow(saturate(dot(-geometryViewDir, directLight.direction)), 4.0);
    float vgThin = 0.35 + 0.65 * saturate(-vgNL * 0.5 + 0.5);
    reflectedLight.directDiffuse += directLight.color * BRDF_Lambert(material.diffuseColor) * (vgWrap * VEG_WRAP + vgBack * vgThin * VEG_TRANS);
  }
#endif
#if NUM_HEMI_LIGHTS > 0
  // skylight transmitted through thin leaves lifts the underside of the canopy
  reflectedLight.indirectDiffuse += hemisphereLights[0].skyColor * BRDF_Lambert(material.diffuseColor) * saturate(-dot(geometryNormal, hemisphereLights[0].direction)) * VEG_SKYT;
#endif
`;
  const NORMAL_BEGIN_NOFLIP = THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '');

  function windDefines(w) {
    return `#define VEG_WDX ${f5(WIND.x)}\n#define VEG_WDZ ${f5(WIND.y)}\n#define VEG_HREF ${f5(w.href)}\n#define VEG_SWAY ${f5(w.sway)}\n` +
      `#define VEG_FREQ ${f5(w.freq)}\n#define VEG_FLUTTER ${f5(w.flutter || 0)}\n` + (w.culm ? '#define VEG_CULM_PHASE\n' : '');
  }
  function injectWind(sh, defs) {
    sh.uniforms.vegTime = uniforms.time;
    sh.uniforms.vegWind = uniforms.windStrength;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + defs + WIND_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += vegDisplace(position, normal);');
  }
  function injectAlpha(sh, defs) {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + defs)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + ALPHA_BOOST);
  }
  function vegMaterial(key, o) {
    const foliage = !!o.foliage;
    const m = new THREE.MeshStandardMaterial({
      map: o.map, normalMap: o.normalMap || null, roughness: o.roughness ?? 0.9, metalness: 0,
      vertexColors: true, side: foliage ? THREE.DoubleSide : THREE.FrontSide, alphaTest: foliage ? 0.4 : 0,
      color: o.color ?? 0xffffff,
    });
    if (o.normalMap) m.normalScale.set(o.normalScale ?? 1, o.normalScale ?? 1);
    const defs = windDefines(o.wind) + (foliage ? `#define VEG_TEX ${f5(o.texSize || 512)}\n#define VEG_TRANS ${f5(o.trans ?? 1.5)}\n#define VEG_WRAP ${f5(o.wrap ?? 0.6)}\n#define VEG_SKYT ${f5(o.skyT ?? 0.45)}\n` : '');
    m.onBeforeCompile = sh => {
      injectWind(sh, defs);
      if (foliage) {
        injectAlpha(sh, defs);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <normal_fragment_begin>', NORMAL_BEGIN_NOFLIP)
          .replace('#include <lights_fragment_begin>', '#include <lights_fragment_begin>\n' + FOLIAGE_LIGHT);
      }
    };
    m.customProgramCacheKey = () => 'veg-' + key;
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    dm.onBeforeCompile = sh => {
      injectWind(sh, defs);
      if (foliage) {
        injectAlpha(sh, defs);
        // push leaf casters 0.25 m away from the light: kills self-shadow acne on cards
        sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  mvPosition.z -= 0.25;\n  gl_Position = projectionMatrix * mvPosition;');
      }
    };
    dm.customProgramCacheKey = () => 'veg-d-' + key;
    const xm = new THREE.MeshDistanceMaterial();
    xm.onBeforeCompile = sh => { injectWind(sh, defs); if (foliage) injectAlpha(sh, defs); };
    xm.customProgramCacheKey = () => 'veg-x-' + key;
    m.userData.depthMat = dm; m.userData.distMat = xm;
    // auto-attach to meshes drawn with this material (callers may also assign part.customDepthMaterial)
    m.onBeforeRender = (renderer, scene, camera, geometry, object) => {
      if (object.customDepthMaterial === undefined) object.customDepthMaterial = dm;
      if (object.customDistanceMaterial === undefined) object.customDistanceMaterial = xm;
    };
    m.name = 'veg-' + key;
    return m;
  }

  function rockMaterial(tex) {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, color: 0xffffff });
    m.onBeforeCompile = sh => {
      sh.uniforms.rockMap = { value: tex };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRkP;\nvarying vec3 vRkN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRkP = position; vRkN = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D rockMap;
varying vec3 vRkP;
varying vec3 vRkN;
vec4 rkTri(vec3 p, vec3 w, float sc) {
  return texture2D(rockMap, p.zy * sc) * w.x + texture2D(rockMap, p.xz * sc) * w.y + texture2D(rockMap, p.xy * sc) * w.z;
}`)
        .replace('#include <map_fragment>', `
  vec3 rkN = normalize(vRkN);
  vec3 rkW = pow(abs(rkN), vec3(4.0)); rkW /= dot(rkW, vec3(1.0));
  vec4 rkS = rkTri(vRkP, rkW, 0.55);
  vec4 rkL = rkTri(vRkP + 13.7, rkW, 0.13);
  float rkMoss = smoothstep(0.12, 0.5, rkN.y + (rkL.a - 0.5) * 1.1 + (rkS.a - 0.5) * 0.35);
  vec3 rkMossCol = mix(vec3(0.045, 0.06, 0.016), vec3(0.12, 0.13, 0.04), rkS.a) * mix(0.8, 1.2, rkL.a);
  vec3 rkStone = rkS.rgb * mix(0.8, 1.1, rkL.a);
  diffuseColor.rgb *= mix(rkStone, rkMossCol, rkMoss);
  float rkH = rkS.a * (1.0 - rkMoss * 0.6);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 1.0, rkMoss);')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 rkSX = dFdx(-vViewPosition), rkSY = dFdy(-vViewPosition);
    vec3 rkR1 = cross(rkSY, normal), rkR2 = cross(normal, rkSX);
    float rkDet = dot(rkSX, rkR1);
    vec2 rkDH = vec2(dFdx(rkH), dFdy(rkH)) * 0.07;
    vec3 rkG = sign(rkDet) * (rkDH.x * rkR1 + rkDH.y * rkR2);
    normal = normalize(abs(rkDet) * normal - rkG);
  }`);
    };
    m.customProgramCacheKey = () => 'veg-rock';
    m.name = 'veg-rock';
    return m;
  }

  // ------------------------------------------------------------------ kit
  let kitCache = null;
  function createKit() {
    if (kitCache) return kitCache;
    const tex = {};
    tex.pineBark = makeBark({ seed: 11, plate: 0x584538, plate2: 0x64402f, crev: 0x16100d, accent: 0x7a4c34, cx: 5, cy: 5, warp: 0.9, edge: 0.22, gx: 24, gy: 3, plateAmt: 0.75, grainAmt: 0.2, accentAmt: 0.5, nk: 5 });
    tex.mapleBark = makeBark({ seed: 23, plate: 0x6a655c, plate2: 0x5a544a, crev: 0x2a2520, accent: 0x7a766a, cx: 6, cy: 2, warp: 0.6, edge: 0.12, gx: 20, gy: 2, plateAmt: 0.4, grainAmt: 0.45, accentAmt: 0.4, nk: 3 });
    tex.deadBark = makeBark({ seed: 37, plate: 0x7e7973, plate2: 0x6a655f, crev: 0x2e2a26, accent: 0x9e9a92, cx: 7, cy: 1, warp: 0.5, edge: 0.08, gx: 28, gy: 2, plateAmt: 0.35, grainAmt: 0.6, accentAmt: 0.5, nk: 4 });
    tex.bamboo = makeBambooTex();
    tex.rock = makeRockTex();
    tex.pineLeaf = atlasTexture(drawPineTile, 5);
    tex.mapleLeaf = atlasTexture(drawMapleTile, 7);
    tex.bambooLeaf = atlasTexture(drawBambooTile, 9);
    tex.bushLeaf = atlasTexture(drawBushTile, 13);
   
    { const cv = canvas(256, 512); drawFern(ctx2d(cv), 256, 512, RNG(17)); tex.fern = alphaTexFromCanvas(cv); }
    const M = {
      pineBark: vegMaterial('pineBark', { map: tex.pineBark.map, normalMap: tex.pineBark.normalMap, normalScale: 1.2, roughness: 0.95, wind: { href: 15, sway: 0.22, freq: 0.9 } }),
      pineLeaf: vegMaterial('pineLeaf', { foliage: true, map: tex.pineLeaf, roughness: 0.85, trans: 0.7, wrap: 0.5, wind: { href: 15, sway: 0.22, freq: 0.9, flutter: 0.03 } }),
      mapleBark: vegMaterial('mapleBark', { map: tex.mapleBark.map, normalMap: tex.mapleBark.normalMap, roughness: 0.9, wind: { href: 8, sway: 0.14, freq: 1.2 } }),
      mapleLeaf: vegMaterial('mapleLeaf', { foliage: true, map: tex.mapleLeaf, roughness: 0.75, trans: 2.2, wrap: 0.6, wind: { href: 8, sway: 0.14, freq: 1.2, flutter: 0.06 } }),
      deadBark: vegMaterial('deadBark', { map: tex.deadBark.map, normalMap: tex.deadBark.normalMap, roughness: 0.9, wind: { href: 7, sway: 0.06, freq: 1.3 } }),
      bambooCulm: vegMaterial('bambooCulm', { map: tex.bamboo.map, normalMap: tex.bamboo.normalMap, roughness: 0.72, wind: { href: 10, sway: 0.55, freq: 0.8, culm: true } }),
      bambooLeaf: vegMaterial('bambooLeaf', { foliage: true, map: tex.bambooLeaf, roughness: 0.75, trans: 0.75, wrap: 0.6, wind: { href: 10, sway: 0.55, freq: 0.8, culm: true, flutter: 0.09 } }),
      bush: vegMaterial('bush', { foliage: true, map: tex.bushLeaf, roughness: 0.8, trans: 1.4, wrap: 0.6, wind: { href: 1.2, sway: 0.05, freq: 1.8, flutter: 0.04 } }),
      fern: vegMaterial('fern', { foliage: true, map: tex.fern, texSize: 512, roughness: 0.8, trans: 1.4, wrap: 0.6, wind: { href: 0.6, sway: 0.05, freq: 1.6, flutter: 0.05 } }),
      rock: rockMaterial(tex.rock),
    };
   
    const mapleA = ['#a8281a', '#96201a', '#b83a1e', '#c24a22', '#8a1c16'];
    const mapleB = ['#c8601e', '#d27a24', '#b84a1c', '#d69a30', '#c2862a'];
    const mapleC = ['#a82a1c', '#c8581e', '#d49030', '#b83a1c', '#9a8a30', '#c46a24'];
    const archetypes = {
      pine: [
        buildPine(101, 16, { lean: 0.4, sbend: 0.75, whorls: 4, t0: 0.42, pad: 1.0, card: 1.0, oneSide: 0.3, budget: 4000 }, M),
        buildPine(202, 19, { lean: 0.22, sbend: 0.6, whorls: 4, t0: 0.5, pad: 0.95, card: 1.05, oneSide: 0.1, budget: 4000 }, M),
        buildPine(303, 13, { lean: 0.62, sbend: 0.9, whorls: 3, t0: 0.38, pad: 1.1, card: 1.0, oneSide: 0.6, budget: 4000 }, M),
      ],
      maple: [buildMaple(11, 8.5, mapleA, M), buildMaple(22, 7, mapleB, M), buildMaple(33, 9.0, mapleC, M)],
      deadTree: [buildDead(7, 8, M), buildDead(8, 6, M)],
      bamboo: [buildBamboo(41, 11, 7, 9.5, M), buildBamboo(42, 13, 8.5, 11, M)],
      bush: [buildBush(51, 1.05, ['#56603a', '#4a5634', '#6a6a3c', '#7a6a38'], M), buildBush(52, 1.2, ['#8a3a22', '#9a5a2a', '#6a4a2a', '#a07030'], M)],
      fern: [buildFern(61, M)],
      rock: [buildRock(71, 1.25, 0.95, 1.05, M), buildRock(72, 1.7, 0.72, 1.25, M), buildRock(73, 0.95, 1.55, 0.9, M)],
    };
   
    kitCache = { archetypes, materials: M, textures: tex };
    return kitCache;
  }

  // ------------------------------------------------------------------ shared lighting for shader materials
  const LIGHT_GLSL = /* glsl */`
void vegSun(vec3 wp, out vec3 L, out vec3 Lc, out float sh) {
  L = vec3(${f5(CONFIG.SUN_DIR.x)}, ${f5(CONFIG.SUN_DIR.y)}, ${f5(CONFIG.SUN_DIR.z)});
  Lc = vec3(${f5(CONFIG.SUN_COLOR.r * 3)}, ${f5(CONFIG.SUN_COLOR.g * 3)}, ${f5(CONFIG.SUN_COLOR.b * 3)});
  sh = 1.0;
#if NUM_DIR_LIGHTS > 0
  L = normalize((vec4(directionalLights[0].direction, 0.0) * viewMatrix).xyz);
  Lc = directionalLights[0].color;
  #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    DirectionalLightShadow vgS = directionalLightShadows[0];
    sh = receiveShadow ? getShadow(directionalShadowMap[0], vgS.shadowMapSize, vgS.shadowIntensity, vgS.shadowBias, vgS.shadowRadius, vDirectionalShadowCoord[0]) : 1.0;
  #endif
#endif
}
vec3 vegAmbient(vec3 N) {
  vec3 a = ambientLightColor;
#if NUM_HEMI_LIGHTS > 0
  vec3 hd = normalize((vec4(hemisphereLights[0].direction, 0.0) * viewMatrix).xyz);
  a += mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, 0.5 * dot(N, hd) + 0.5);
#endif
  return a;
}
`;
  const FRAG_PARS = '#include <common>\n#include <packing>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <shadowmap_pars_fragment>\n#include <fog_pars_fragment>\n';
  const NOISE_GLSL = /* glsl */`
float vgHash(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vgHash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vgNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vgHash2(i), vgHash2(i + vec2(1.0, 0.0)), f.x), mix(vgHash2(i + vec2(0.0, 1.0)), vgHash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
  function shaderUniforms(extra) {
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog]);
    return Object.assign(u, { vegTime: uniforms.time, vegWind: uniforms.windStrength, vegCam: camU, vegPlayer: playerU }, extra);
  }

  // ------------------------------------------------------------------ grass
  function createGrass({ heightTexture, densityTexture, worldSize = CONFIG.WORLD_SIZE, count = 70000, radius = 42 } = {}) {
    if (!heightTexture) { heightTexture = new THREE.DataTexture(new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType); heightTexture.needsUpdate = true; }
    if (!densityTexture) { densityTexture = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType); densityTexture.needsUpdate = true; }
    const levels = [0, 0.3, 0.56, 0.8];
    const pos = [], idx = [];
    for (const t of levels) pos.push(-1, t, 0, 1, t, 0);
    pos.push(0, 1, 0);
    for (let l = 0; l < levels.length - 1; l++) { const a = l * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    const L2 = (levels.length - 1) * 2; idx.push(L2, L2 + 1, L2 + 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    // three nested tiles: dense near the camera, sparse & wider blades far away
    const tk = clamp(Math.sqrt(count / 70000), 0.65, 1.15);
    const tiles = [{ R: Math.min(9 * tk, radius), f: 0.38 }, { R: Math.min(20 * tk, radius), f: 0.3 }, { R: radius, f: 0.32 }];
    const inst = new Float32Array(count * 4), tileA = new Float32Array(count);
    const rng = RNG(977);
    let k = 0;
    tiles.forEach((tl, ti) => {
      const n = ti === tiles.length - 1 ? count - k : Math.round(count * tl.f);
      const cr = 0.16 / (2 * tl.R);
      for (let i = 0; i < n;) {
        const cx = rng(), cz = rng(), m = rng.int(2, 7), cr2 = rng();
        for (let b = 0; b < m && i < n; b++, i++, k++) {
          const a = rng() * TAU, r = Math.sqrt(rng()) * cr * (0.5 + m * 0.15);
          inst[k * 4] = (cx + Math.cos(a) * r + 1) % 1; inst[k * 4 + 1] = (cz + Math.sin(a) * r + 1) % 1;
          inst[k * 4 + 2] = rng(); inst[k * 4 + 3] = cr2;
          tileA[k] = tl.R;
        }
      }
    });
    geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
    geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tileA, 1));
    geo.instanceCount = count;

    const mat = new THREE.ShaderMaterial({
      lights: true, fog: true, side: THREE.DoubleSide,
      uniforms: shaderUniforms({ gHeight: { value: heightTexture }, gDensity: { value: densityTexture }, gWorld: { value: worldSize }, gRadius: { value: radius } }),
      vertexShader: /* glsl */`
#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
uniform float vegTime;
uniform float vegWind;
uniform vec3 vegCam;
uniform vec3 vegPlayer;
uniform sampler2D gHeight;
uniform sampler2D gDensity;
uniform float gWorld;
uniform float gRadius;
attribute vec4 aInst;
attribute float aTile;
varying vec3 vGCol;
varying vec3 vGN;
varying vec3 vGTN;
varying vec3 vGWP;
varying float vGT;
${NOISE_GLSL}
// texel (i, j) holds the height at x = -W/2 + i * W / (N - 1)  (row 0 = z = -W/2, vertex-grid convention)
float gHeightAt(vec2 wp, out vec2 grad) {
  ivec2 sz = textureSize(gHeight, 0);
  vec2 tc = clamp((wp + 0.5 * gWorld) / gWorld, 0.0, 1.0) * vec2(sz - 1);
  vec2 fr = fract(tc);
  ivec2 i0 = ivec2(floor(tc));
  ivec2 mx = sz - 1;
  ivec2 a = clamp(i0, ivec2(0), mx), b = clamp(i0 + 1, ivec2(0), mx);
  float h00 = texelFetch(gHeight, ivec2(a.x, a.y), 0).r;
  float h10 = texelFetch(gHeight, ivec2(b.x, a.y), 0).r;
  float h01 = texelFetch(gHeight, ivec2(a.x, b.y), 0).r;
  float h11 = texelFetch(gHeight, ivec2(b.x, b.y), 0).r;
  float texel = gWorld / float(max(sz.x - 1, 1));
  grad = vec2(mix(h10 - h00, h11 - h01, fr.y), mix(h01 - h00, h11 - h10, fr.x)) / texel;
  return mix(mix(h00, h10, fr.x), mix(h01, h11, fr.x), fr.y);
}
void main() {
  float R = aTile;
  vec2 p = (aInst.xy * 2.0 - 1.0) * R;
  vec2 base = p + 2.0 * R * floor((vegCam.xz - p) / (2.0 * R) + 0.5);
  float d = length(base - vegCam.xz);
  float fade = R >= gRadius - 0.01 ? 1.0 - smoothstep(R * 0.7, R * 0.98, d) : 1.0 - smoothstep(R * 0.55, R * 0.95, d);
  vec2 duv = (base + 0.5 * gWorld) / gWorld;
  vec2 dsz = vec2(textureSize(gDensity, 0));
  float dens = texture(gDensity, (duv * (dsz - 1.0) + 0.5) / dsz).r;
  if (duv.x < 0.0 || duv.y < 0.0 || duv.x > 1.0 || duv.y > 1.0) dens = 0.0;
  vec2 grad;
  float hgt = gHeightAt(base, grad);
  dens *= 1.0 - smoothstep(0.9, 1.4, length(grad));
  float r1 = aInst.z, r2 = aInst.w;
  float presence = dens - r1 * 0.85 - 0.06;
  float patchN = vgNoise(base * 0.09 + 3.7);
  float H = mix(0.25, 0.8, pow(vgHash(r1 * 91.7 + r2 * 13.1), 1.3));
  bool seedHead = vgHash(r1 * 57.31 + 0.3) < 0.07;
  H *= mix(0.55, 1.15, patchN) * mix(0.6, 1.0, smoothstep(0.15, 0.7, dens)) * smoothstep(0.0, 0.04, presence) * fade;
  if (seedHead) H *= 1.35;
  if (presence <= 0.0 || H < 0.03) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float t = position.y, side = position.x;
  float w = mix(0.03, 0.055, vgHash(r1 * 23.9)) * (1.0 + d * 0.065) * (seedHead ? 0.55 : 1.0);
  float ang = vgHash(r1 * 17.3 + 0.5) * 6.2832;
  vec2 wdir = vec2(cos(ang), sin(ang));
  vec2 perp = vec2(-wdir.y, wdir.x);
  // natural curl + clump splay
  vec2 bend = perp * (vgHash(r1 * 5.1) - 0.5) * 0.55 + vec2(cos(r2 * 40.0), sin(r2 * 40.0)) * 0.12;
  // wind: scrolling gust field + per-blade flutter
  vec2 WD = vec2(${f5(WIND.x)}, ${f5(WIND.y)});
  float gust = vgNoise(base * 0.07 - WD * vegTime * 0.9);
  float gust2 = vgNoise(base * 0.23 - WD * vegTime * 2.1 + 7.0);
  float wAmt = vegWind * (0.12 + 0.95 * gust * gust + 0.25 * gust2);
  bend += WD * wAmt * 0.6;
  bend += perp * sin(vegTime * (3.5 + 2.5 * r2) + r1 * 40.0 + base.x * 0.7) * 0.1 * vegWind * (0.4 + gust);
  // player interaction
  vec2 pd = base - vegPlayer.xz;
  float pl = length(pd);
  float push = (1.0 - smoothstep(0.2, 1.2, pl)) * (1.0 - smoothstep(1.0, 2.5, abs(vegPlayer.y - hgt)));
  bend += (pd / max(pl, 1e-3)) * push * 1.4;
  float bl = min(length(bend), 1.4);
  bend *= bl / max(length(bend), 1e-4);
  float yk = 1.0 - 0.38 * bl * bl * t;
  float wt = seedHead ? (t < 0.5 ? 0.35 : (t < 0.7 ? 0.5 : 1.3)) : (1.0 - pow(t, 1.5) * 0.85);
  vec3 W3 = vec3(wdir.x, 0.0, wdir.y);
  vec3 wp = vec3(base.x, hgt - 0.04, base.y);
  wp += vec3(bend.x * H * t * t, H * t * yk, bend.y * H * t * t);
  wp += W3 * side * w * 0.5 * wt;
  vec3 T = normalize(vec3(2.0 * bend.x * t, yk, 2.0 * bend.y * t));
  vec3 N = normalize(cross(W3, T) + W3 * side * 0.45);
  vec3 TN = normalize(vec3(-grad.x, 1.0, -grad.y));
  // colour: muted green -> dry straw / ochre, patchy
  float dry = clamp(smoothstep(0.35, 0.85, vgNoise(base * 0.045 + 11.0)) * 0.9 + (vgHash(r2 * 7.7) - 0.5) * 0.6 - 0.08, 0.0, 1.0);
  vec3 green = mix(vec3(0.052, 0.085, 0.03), vec3(0.108, 0.145, 0.052), vgHash(r1 * 3.3));
  vec3 straw = mix(vec3(0.3, 0.25, 0.13), vec3(0.24, 0.16, 0.065), vgNoise(base * 0.21 + 2.0));
  vec3 col = mix(green, straw, dry) * mix(0.75, 1.15, vgHash(r1 * 1.37));
  col = mix(col, vec3(0.15, 0.1, 0.055), step(0.9, vgHash(r1 * 9.1)) * 0.7);
  if (seedHead && t > 0.45) col = mix(vec3(0.3, 0.22, 0.1), vec3(0.42, 0.33, 0.17), r2);
  col *= mix(0.45, 1.0, smoothstep(0.0, 0.45, t)) * (1.0 + 0.15 * t);
  vGCol = col; vGN = N; vGTN = TN; vGWP = wp; vGT = t;
  vec4 worldPosition = vec4(wp, 1.0);
  vec3 transformedNormal = normalize(mat3(viewMatrix) * TN);
  #include <shadowmap_vertex>
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: FRAG_PARS + /* glsl */`
varying vec3 vGCol;
varying vec3 vGN;
varying vec3 vGTN;
varying vec3 vGWP;
varying float vGT;
${LIGHT_GLSL}
void main() {
  vec3 bn = normalize(vGN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 N = normalize(mix(bn, normalize(vGTN), 0.5));
  vec3 V = normalize(cameraPosition - vGWP);
  vec3 L, Lc; float sh;
  vegSun(vGWP, L, Lc, sh);
  float ndl = dot(N, L);
  float diff = max((ndl + 0.4) / 1.4, 0.0);
  float trans = pow(max(dot(-V, L), 0.0), 3.0) * (0.25 + 0.75 * vGT);
  vec3 col = vGCol * RECIPROCAL_PI * (Lc * sh * (diff + trans * 1.6) + vegAmbient(N));
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 12.0) * 0.05 * vGT;
  col += Lc * sh * spec;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.raycast = () => {};
    mesh.name = 'veg-grass';
    return { mesh };
  }

  // ------------------------------------------------------------------ falling leaves
  let leafTex = null;
  function createFallingLeaves({ count = 400, radius = 30 } = {}) {
    if (!leafTex) {
      const cv = canvas(256, 256), ctx = ctx2d(cv), rng = RNG(3);
      for (let t = 0; t < 4; t++) drawFallingLeaf(ctx, (t & 1) * 128, (t >> 1) * 128, 128, t, rng);
      leafTex = alphaTexFromCanvas(cv);
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    const rng = RNG(55);
    const s1 = new Float32Array(count * 4), s2 = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) { s1[i] = rng(); s2[i] = rng(); }
    geo.setAttribute('aS1', new THREE.InstancedBufferAttribute(s1, 4));
    geo.setAttribute('aS2', new THREE.InstancedBufferAttribute(s2, 4));
    geo.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      lights: true, fog: true, side: THREE.DoubleSide,
      uniforms: shaderUniforms({ lMap: { value: leafTex }, lRadius: { value: radius } }),
      vertexShader: /* glsl */`
#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
uniform float vegTime;
uniform float vegWind;
uniform vec3 vegCam;
uniform float lRadius;
attribute vec4 aS1;
attribute vec4 aS2;
varying vec2 vLUv;
varying vec3 vLN;
varying vec3 vLCol;
varying vec3 vLWP;
mat3 rotAxis(vec3 a, float g) {
  float s = sin(g), c = cos(g), oc = 1.0 - c;
  return mat3(oc * a.x * a.x + c, oc * a.x * a.y + a.z * s, oc * a.z * a.x - a.y * s,
              oc * a.x * a.y - a.z * s, oc * a.y * a.y + c, oc * a.y * a.z + a.x * s,
              oc * a.z * a.x + a.y * s, oc * a.y * a.z - a.x * s, oc * a.z * a.z + c);
}
void main() {
  float t = vegTime;
  float R = lRadius, Hs = 16.0;
  vec2 WD = vec2(${f5(WIND.x)}, ${f5(WIND.y)});
  vec3 p = vec3(aS1.x * 2.0 * R - R, aS1.y * Hs, aS1.z * 2.0 * R - R);
  p.y -= t * mix(0.5, 1.1, aS1.w);
  p.xz += WD * t * (0.4 + 0.9 * aS2.y) * vegWind;
  p.x += sin(t * 0.9 + aS2.z * 6.28) * 0.8;
  p.z += cos(t * 0.7 + aS2.w * 6.28) * 0.8;
  vec3 C = vegCam + vec3(0.0, 4.0, 0.0);
  vec3 span = vec3(2.0 * R, Hs, 2.0 * R);
  vec3 wp = p + span * floor((C - p) / span + 0.5);
  vec3 rel = abs(wp - C) / (span * 0.5);
  float fade = 1.0 - smoothstep(0.8, 1.0, max(max(rel.x, rel.y), rel.z));
  float size = mix(0.07, 0.12, aS2.x) * fade;
  vec3 axis = normalize(vec3(aS2.y - 0.5, aS2.z - 0.2, aS2.w - 0.5) + vec3(0.001));
  mat3 rot = rotAxis(axis, t * mix(1.5, 4.5, aS2.x) + aS1.x * 20.0);
  vec3 local = rot * (position * size);
  vLN = rot * vec3(0.0, 1.0, 0.0);
  wp += local;
  float tile = floor(aS1.w * 3.999);
  if (aS2.x > 0.85) tile = 3.0;
  vLUv = uv * 0.5 + vec2(mod(tile, 2.0) * 0.5, tile < 1.5 ? 0.5 : 0.0);
  float c = aS2.z;
  vLCol = c < 0.35 ? vec3(0.42, 0.04, 0.02) : c < 0.6 ? vec3(0.58, 0.16, 0.03) : c < 0.8 ? vec3(0.55, 0.32, 0.06) : vec3(0.2, 0.1, 0.04);
  if (tile > 2.5) vLCol = vec3(0.3, 0.18, 0.08);
  vLCol *= mix(0.75, 1.1, aS1.z);
  vLWP = wp;
  vec4 worldPosition = vec4(wp, 1.0);
  vec3 transformedNormal = normalize(mat3(viewMatrix) * vLN);
  #include <shadowmap_vertex>
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: FRAG_PARS + /* glsl */`
uniform sampler2D lMap;
varying vec2 vLUv;
varying vec3 vLN;
varying vec3 vLCol;
varying vec3 vLWP;
${LIGHT_GLSL}
void main() {
  vec4 tx = texture2D(lMap, vLUv);
  if (tx.a < 0.5) discard;
  vec3 N = normalize(vLN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vLWP);
  vec3 L, Lc; float sh;
  vegSun(vLWP, L, Lc, sh);
  float ndl = abs(dot(N, L));
  float trans = pow(max(dot(-V, L), 0.0), 4.0) * 1.5;
  vec3 alb = vLCol * tx.rgb;
  vec3 col = alb * RECIPROCAL_PI * (Lc * sh * (ndl * 0.8 + 0.2 + trans) + vegAmbient(N));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.raycast = () => {};
    mesh.name = 'veg-leaves';
    return { mesh };
  }

  function update(time, cameraPos, playerPos) {
    uniforms.time.value = time;
    if (cameraPos) camU.value.copy(cameraPos);
    if (playerPos) playerU.value.copy(playerPos);
  }

  return { uniforms, update, createKit, createGrass, createFallingLeaves, WIND_DIR: WIND };
})();
