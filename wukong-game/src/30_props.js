// ---------------------------------------------------------------------------
// 30_props.js — procedural architecture & props for 黑风山 / 观音禅院
// All builders return { object, colliders, lights, fires, smoke, interact }
// Units: metres, Y up, origin at ground level of the footprint centre, front = +Z.
// ---------------------------------------------------------------------------
const Props = (() => {
  const uniforms = { time: { value: 0 } };
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const FONT = '"Ma Shan Zheng", "KaiTi", "STKaiti", serif';
  const sl = c => Math.pow(c, 2.2); // sRGB -> linear (approx.)

  // ------------------------------------------------------------------ RNG
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = mulberry32(1);
  const rnd = (a = 0, b = 1) => a + (b - a) * rng();
  const seeded = s => { rng = mulberry32(s >>> 0); };
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ------------------------------------------------ tileable value noise (textures)
  const NZ = (() => {
    const N = 256, T = new Float32Array(N * N), r = mulberry32(90210);
    for (let i = 0; i < N * N; i++) T[i] = r();
    function n2(u, v, pu, pv, o) {
      const x = u * pu, y = v * pv;
      let xi = Math.floor(x), yi = Math.floor(y);
      const fx = x - xi, fy = y - yi;
      xi %= pu; if (xi < 0) xi += pu; yi %= pv; if (yi < 0) yi += pv;
      let xj = xi + 1; if (xj >= pu) xj = 0;
      let yj = yi + 1; if (yj >= pv) yj = 0;
      const ox = (o * 71) & 255, oy = (o * 137) & 255;
      const r0 = ((yi + oy) & 255) * N, r1 = ((yj + oy) & 255) * N;
      const a = T[r0 + ((xi + ox) & 255)], b = T[r0 + ((xj + ox) & 255)];
      const c = T[r1 + ((xi + ox) & 255)], d = T[r1 + ((xj + ox) & 255)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
    function fbm(u, v, pu, pv, oct, o = 0) {
      let s = 0, a = 0.5, t = 0;
      for (let i = 0; i < oct; i++) { s += a * n2(u, v, pu << i, pv << i, o + i * 7); t += a; a *= 0.5; }
      return s / t;
    }
    return { n2, fbm };
  })();

  // ------------------------------------------------------------ textures
  const TEX = {};
  const textJobs = []; // canvases that contain calligraphy; redrawn when the web font arrives
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const ctx2d = c => c.getContext('2d', { willReadFrequently: true });
  function finishTex(c, srgb, repeat = true) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    else t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }
  function heightToNormalCanvas(hgt, w, h, strength) {
    const c = mkCanvas(w, h), ctx = ctx2d(c), img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      const ya = ((y - 1 + h) % h) * w, yb = ((y + 1) % h) * w, yr = y * w;
      for (let x = 0; x < w; x++) {
        const xl = (x - 1 + w) % w, xr = (x + 1) % w;
        const nx = (hgt[yr + xl] - hgt[yr + xr]) * strength;
        const ny = (hgt[yb + x] - hgt[ya + x]) * strength;
        const il = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        const i = (yr + x) * 4;
        d[i] = (nx * il * 0.5 + 0.5) * 255; d[i + 1] = (ny * il * 0.5 + 0.5) * 255; d[i + 2] = (il * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  // Build a texture set from a per-pixel fill function.
  function pixelSet(key, w, h, fill, opts = {}) {
    if (TEX[key]) return TEX[key];
    const n = w * h;
    const col = new Float32Array(n * 3), hgt = new Float32Array(n), rgh = new Float32Array(n).fill(0.8);
    const met = new Float32Array(n), alp = opts.alpha ? new Float32Array(n).fill(1) : null;
    const P = { w, h, col, hgt, rgh, met, alp, set(i, r, g, b) { col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; } };
    fill(P);
    const out = {};
    {
      const c = mkCanvas(w, h), ctx = ctx2d(c), img = ctx.createImageData(w, h), d = img.data;
      for (let i = 0; i < n; i++) {
        d[i * 4] = col[i * 3] * 255; d[i * 4 + 1] = col[i * 3 + 1] * 255; d[i * 4 + 2] = col[i * 3 + 2] * 255;
        d[i * 4 + 3] = alp ? alp[i] * 255 : 255;
      }
      ctx.putImageData(img, 0, 0);
      if (opts.post) opts.post(ctx, w, h);
      out.map = finishTex(c, true, opts.repeat !== false);
      out.canvas = c;
    }
    if (opts.normal) out.normalMap = finishTex(heightToNormalCanvas(hgt, w, h, opts.normal), false, opts.repeat !== false);
    if (opts.roughMap) {
      const c = mkCanvas(w, h), ctx = ctx2d(c), img = ctx.createImageData(w, h), d = img.data;
      for (let i = 0; i < n; i++) { d[i * 4] = 0; d[i * 4 + 1] = rgh[i] * 255; d[i * 4 + 2] = met[i] * 255; d[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0);
      out.roughnessMap = finishTex(c, false, opts.repeat !== false);
    }
    TEX[key] = out;
    return out;
  }

  function texStone() {
    return pixelSet('stone', 512, 512, P => {
      const { w, h } = P;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, i = y * w + x;
        const n1 = NZ.fbm(u, v, 3, 3, 5, 1), n2 = NZ.fbm(u, v, 12, 12, 4, 9), n3 = NZ.fbm(u, v, 2, 2, 3, 20);
        const cr = 1 - Math.abs(NZ.fbm(u, v, 5, 5, 4, 30) * 2 - 1);
        const crack = smooth(0.972, 0.995, cr) * smooth(0.5, 0.68, NZ.fbm(u, v, 2, 2, 3, 33));
        const pit = smooth(0.7, 0.8, NZ.n2(u, v, 96, 96, 44));
        const speck = NZ.n2(u, v, 160, 160, 51);
        let t = 0.8 + (n1 - 0.5) * 0.65 + (n2 - 0.5) * 0.35 + (speck - 0.5) * 0.12;
        t *= 1 - crack * 0.45 - pit * 0.2;
        const warm = (n3 - 0.5) * 0.16;
        P.set(i, 0.52 * t * (1 + warm), 0.505 * t, 0.47 * t * (1 - warm));
        P.hgt[i] = n1 * 0.4 + n2 * 0.4 + speck * 0.1 - crack * 0.7 - pit * 0.25;
      }
    }, { normal: 2.2 });
  }

  // generic block pattern (ashlar / brick / flagstones)
  function blockPattern(key, o) {
    return pixelSet(key, o.size, o.size, P => {
      const S = o.size, r = mulberry32(hashStr(key));
      const rowOf = new Int16Array(S), rows = [];
      let yAcc = 0;
      o.rows.forEach((rh, ri) => {
        const id = new Int16Array(S), dl = new Float32Array(S), dr = new Float32Array(S);
        const lens = []; let tot = 0;
        while (tot < S) {
          let L = Math.round(o.minLen + r() * (o.maxLen - o.minLen));
          if (S - tot - L < o.minLen * 0.6) L = S - tot;
          lens.push(L); tot += L;
        }
        const off = o.stagger ? (ri % 2) * Math.round(o.maxLen / 2) : Math.floor(r() * S);
        let x = off;
        lens.forEach((L, k) => { for (let j = 0; j < L; j++) { const xx = (x + j) % S; id[xx] = k; dl[xx] = j; dr[xx] = L - 1 - j; } x += L; });
        const tones = lens.map(() => [1 + (r() - 0.5) * o.varAmt, (r() - 0.5) * 0.08, r()]);
        rows.push({ y0: yAcc, h: rh, id, dl, dr, tones });
        for (let yy = 0; yy < rh; yy++) rowOf[yAcc + yy] = ri;
        yAcc += rh;
      });
      for (let y = 0; y < S; y++) {
        const R = rows[rowOf[y]], dy0 = y - R.y0, dy1 = R.y0 + R.h - 1 - y;
        for (let x = 0; x < S; x++) {
          const u = x / S, v = y / S, i = y * S + x;
          const chip = NZ.fbm(u, v, 16, 16, 3, 5);
          const d = Math.min(R.dl[x], R.dr[x], dy0, dy1) - chip * o.chip;
          const n1 = NZ.fbm(u, v, 6, 6, 4, 11), n2 = NZ.fbm(u, v, 24, 24, 3, 17);
          const tn = R.tones[R.id[x]];
          if (d < o.joint) {
            const m = o.mortar, t = 0.8 + n2 * 0.35;
            P.set(i, m[0] * t, m[1] * t, m[2] * t);
            P.hgt[i] = 0.05 * n2;
            P.rgh[i] = 0.95;
          } else {
            const e = smooth(o.joint, o.joint + o.bevel, d);
            const c = o.base, t = tn[0] * (0.82 + 0.3 * (n1 - 0.5) + 0.25 * (n2 - 0.5)) * (0.72 + 0.28 * e);
            const hs = tn[1];
            P.set(i, c[0] * t * (1 + hs), c[1] * t, c[2] * t * (1 - hs));
            P.hgt[i] = 0.45 + 0.4 * e + 0.2 * n1 + 0.08 * n2;
            P.rgh[i] = 0.85;
          }
        }
      }
    }, { normal: o.normal || 2.5 });
  }
  const texAshlar = () => blockPattern('ashlar', { size: 512, rows: [128, 128, 128, 128], minLen: 150, maxLen: 300, joint: 2.5, bevel: 7, chip: 5, varAmt: 0.22, base: [0.49, 0.475, 0.44], mortar: [0.36, 0.35, 0.32], normal: 2.5 });
  const texBrick = () => blockPattern('brick', { size: 512, rows: new Array(16).fill(32), minLen: 128, maxLen: 128, stagger: true, joint: 2.2, bevel: 3, chip: 2.5, varAmt: 0.2, base: [0.40, 0.405, 0.40], mortar: [0.56, 0.54, 0.5], normal: 2 });
  const texFlag = () => blockPattern('flag', { size: 512, rows: [96, 128, 112, 88, 88], minLen: 110, maxLen: 230, joint: 2.2, bevel: 5, chip: 4, varAmt: 0.25, base: [0.47, 0.46, 0.43], mortar: [0.2, 0.2, 0.17], normal: 2 });

  function texWood() {
    return pixelSet('wood', 256, 512, P => {
      const { w, h } = P;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, i = y * w + x;
        const warp = NZ.fbm(u, v, 4, 2, 4, 3);
        const g = u * 14 + warp * 2.5 + NZ.fbm(u, v, 16, 1, 3, 5) * 0.5;
        const ring = 0.5 + 0.5 * Math.sin(g * TAU);
        const fine = NZ.fbm(u, v, 64, 4, 3, 8);
        const t = clamp(0.5 + 0.22 * ring + 0.4 * (fine - 0.5) + (NZ.fbm(u, v, 3, 2, 3, 11) - 0.5) * 0.45, 0, 1);
        const crack = smooth(0.74, 0.8, NZ.fbm(u, v, 24, 2, 3, 13)) * smooth(0.55, 0.7, NZ.n2(u, v, 4, 8, 17));
        const k = 1 - crack * 0.6;
        P.set(i, lerp(0.12, 0.31, t) * k, lerp(0.085, 0.225, t) * k, lerp(0.065, 0.16, t) * k);
        P.hgt[i] = ring * 0.25 + fine * 0.5 - crack * 0.8;
      }
    }, { normal: 2.5 });
  }

  function texLacquer() {
    return pixelSet('lacquer', 512, 512, P => {
      const { w, h } = P;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, i = y * w + x;
        const n1 = NZ.fbm(u, v, 3, 3, 5, 1), n2 = NZ.fbm(u, v, 10, 10, 4, 2), streak = NZ.fbm(u, v, 24, 2, 3, 3);
        const peel = NZ.fbm(u, v, 6, 2, 5, 4);
        const crk = 1 - Math.abs(NZ.fbm(u, v, 24, 12, 3, 5) * 2 - 1);
        const fade = smooth(0.35, 0.75, n1) * 0.75;
        let r = lerp(0.47, 0.60, fade), g = lerp(0.14, 0.32, fade), b = lerp(0.10, 0.25, fade);
        let k = (0.86 + 0.3 * (n2 - 0.5)) * (1 - smooth(0.55, 0.8, streak) * 0.35);
        const crackle = smooth(0.95, 0.99, crk) * smooth(0.45, 0.65, NZ.fbm(u, v, 3, 3, 3, 6));
        k *= 1 - crackle * 0.3;
        r *= k; g *= k; b *= k;
        const p1 = smooth(0.67, 0.69, peel), p2 = smooth(0.72, 0.74, peel);
        const pr = 0.42 * (0.85 + 0.3 * n2);
        r = lerp(r, pr, p1); g = lerp(g, pr * 0.93, p1); b = lerp(b, pr * 0.8, p1);
        r = lerp(r, 0.19, p2); g = lerp(g, 0.13, p2); b = lerp(b, 0.09, p2);
        P.set(i, r, g, b);
        P.rgh[i] = lerp(0.5 + 0.15 * n2, 0.88, p1);
        P.hgt[i] = 1 - p1 * 0.35 - p2 * 0.3 - crackle * 0.3 + n2 * 0.12;
      }
    }, { normal: 2, roughMap: true });
  }

  function texPlaster() {
    return pixelSet('plaster', 512, 512, P => {
      const { w, h } = P;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, i = y * w + x;
        const n1 = NZ.fbm(u, v, 3, 3, 4, 21), n2 = NZ.fbm(u, v, 12, 12, 3, 22), st = NZ.fbm(u, v, 12, 2, 3, 23) * 0.7 + n1 * 0.3;
        const fl = NZ.fbm(u, v, 2, 2, 4, 24) * 0.8 + n2 * 0.2;
        const crk = 1 - Math.abs(NZ.fbm(u, v, 6, 6, 3, 25) * 2 - 1);
        const fade = smooth(0.3, 0.8, n1);
        let r = lerp(0.5, 0.6, fade), g = lerp(0.24, 0.35, fade), b = lerp(0.18, 0.27, fade);
        let k = (0.9 + 0.25 * (n2 - 0.5)) * (1 - smooth(0.52, 0.78, st) * 0.18);
        const crack = smooth(0.975, 0.996, crk) * smooth(0.52, 0.7, NZ.fbm(u, v, 3, 3, 2, 27));
        k *= 1 - crack * 0.45;
        r *= k; g *= k; b *= k;
        const f1 = smooth(0.7, 0.72, fl), f0 = smooth(0.66, 0.7, fl) - f1;
        r *= 1 - f0 * 0.18; g *= 1 - f0 * 0.18; b *= 1 - f0 * 0.18;
        const lw = 0.56 * (0.85 + 0.3 * n2);
        r = lerp(r, lw, f1 * 0.85); g = lerp(g, lw * 0.92, f1 * 0.85); b = lerp(b, lw * 0.8, f1 * 0.85);
        P.set(i, r, g, b);
        P.hgt[i] = 0.6 + n2 * 0.25 - f1 * 0.45 - crack * 0.4;
      }
    }, { normal: 1.6 });
  }

  // roof tiles: 4 barrel rows x 8 courses per repeat; canvas top = ridge side
  function texTiles() {
    return pixelSet('tiles', 512, 512, P => {
      const S = 512, RW = 128, CH = 64, BH = 30;
      const r = mulberry32(777), tone = new Float32Array(4 * 8 * 2 * 3);
      for (let i = 0; i < tone.length / 3; i++) {
        const t = 0.88 + r() * 0.24, g = (r() - 0.5) * 0.08, br = r() < 0.1;
        tone[i * 3] = t * (br ? 1.08 : 1 - g); tone[i * 3 + 1] = t * (1 + g); tone[i * 3 + 2] = t * (br ? 0.86 : 1 - g * 0.4);
      }
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S, i = y * S + x;
        const n1 = NZ.fbm(u, v, 8, 8, 4, 3), n2 = NZ.fbm(u, v, 32, 32, 3, 5);
        const dxB = (x % RW) - RW / 2 + 0.5;
        let cr, cg, cb, hg, ro;
        if (Math.abs(dxB) < BH) {
          const q = dxB / BH, pr = Math.sqrt(1 - q * q);
          const yb = (y + 32) % S, cyb = yb % CH, course = Math.floor(yb / CH), row = Math.floor(x / RW);
          const ti = ((row * 8 + course) * 2) * 3;
          const lip = cyb > CH - 6 ? 0.07 : 0;
          hg = 0.5 + 0.5 * pr + lip;
          const sh = (0.72 + 0.28 * pr) * (cyb > CH - 3 ? 0.7 : 1) * (0.88 + 0.24 * n1);
          cr = 0.29 * tone[ti] * sh; cg = 0.345 * tone[ti + 1] * sh; cb = 0.32 * tone[ti + 2] * sh;
          ro = 0.4 + 0.3 * n2;
        } else {
          const px = ((x + RW / 2) % RW) - RW / 2, q = px / (RW / 2 - BH);
          const cy = y % CH, course = Math.floor(y / CH), row = Math.floor(((x + RW / 2) % S) / RW);
          const ti = ((row * 8 + course) * 2 + 1) * 3, t = cy / CH;
          hg = 0.05 + 0.1 * q * q + 0.2 * t - (cy >= CH - 3 ? 0.14 : 0);
          const sh = (0.62 + 0.25 * q * q + 0.16 * t) * (cy >= CH - 3 ? 0.55 : 1) * (1 - (1 - q * q) * 0.25 * n1);
          cr = 0.31 * tone[ti] * sh; cg = 0.335 * tone[ti + 1] * sh; cb = 0.31 * tone[ti + 2] * sh;
          ro = 0.55 + 0.3 * n1;
        }
        const lc = smooth(0.68, 0.74, NZ.fbm(u, v, 32, 32, 3, 9)) * 0.35 * smooth(0.45, 0.6, NZ.fbm(u, v, 4, 4, 2, 10));
        cr = lerp(cr, 0.5, lc); cg = lerp(cg, 0.5, lc); cb = lerp(cb, 0.42, lc);
        P.set(i, cr, cg, cb); P.hgt[i] = hg; P.rgh[i] = lerp(ro, 0.9, lc);
      }
    }, { normal: 4, roughMap: true });
  }

  function texGrime() {
    return pixelSet('grime', 256, 256, P => {
      const { w, h } = P;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, i = y * w + x;
        const n1 = NZ.fbm(u, v, 4, 4, 5, 61), n2 = NZ.fbm(u, v, 24, 24, 3, 62);
        const t = 0.93 - smooth(0.5, 0.85, n1) * 0.3 - (n2 - 0.5) * 0.12 - smooth(0.7, 0.75, NZ.n2(u, v, 64, 64, 63)) * 0.15;
        P.set(i, t, t * 0.98, t * 0.95);
        P.hgt[i] = n2 * 0.5 + n1 * 0.3;
      }
    }, { normal: 1.2 });
  }

  function texBronze() {
    return pixelSet('bronze', 256, 256, P => {
      const { w, h } = P;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, i = y * w + x;
        const n1 = NZ.fbm(u, v, 4, 4, 5, 71), n2 = NZ.fbm(u, v, 16, 16, 3, 72), vg = NZ.fbm(u, v, 3, 3, 5, 73);
        const verd = smooth(0.46, 0.6, vg + (n2 - 0.5) * 0.25);
        const wear = smooth(0.66, 0.82, n2);
        let r = lerp(0.2, 0.4, wear) * (0.75 + 0.5 * n1), g = lerp(0.165, 0.3, wear) * (0.75 + 0.5 * n1), b = lerp(0.1, 0.17, wear) * (0.75 + 0.5 * n1);
        const blk = 1 - smooth(0.55, 0.8, n1) * 0.45;
        r *= blk; g *= blk; b *= blk;
        const vr = 0.27 * (0.8 + 0.4 * n2), vgc = 0.43 * (0.8 + 0.4 * n2), vb = 0.37 * (0.8 + 0.4 * n2);
        P.set(i, lerp(r, vr, verd), lerp(g, vgc, verd), lerp(b, vb, verd));
        P.rgh[i] = lerp(0.48 + 0.2 * n1, 0.88, verd);
        P.met[i] = lerp(0.7, 0.05, verd);
        P.hgt[i] = n1 * 0.5 + verd * 0.3 + n2 * 0.2;
      }
    }, { normal: 1.5, roughMap: true });
  }

  function texIron() {
    return pixelSet('iron', 256, 256, P => {
      const { w, h } = P;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, i = y * w + x;
        const n1 = NZ.fbm(u, v, 4, 4, 5, 81), n2 = NZ.fbm(u, v, 20, 20, 3, 82);
        const rust = smooth(0.5, 0.7, n1 + (n2 - 0.5) * 0.3);
        const t = 0.8 + 0.4 * n2;
        P.set(i, lerp(0.15, 0.3, rust) * t, lerp(0.145, 0.19, rust) * t, lerp(0.14, 0.12, rust) * t);
        P.rgh[i] = lerp(0.62, 0.92, rust); P.met[i] = lerp(0.6, 0.1, rust);
        P.hgt[i] = n2 * 0.6 + rust * 0.4;
      }
    }, { normal: 2.5, roughMap: true });
  }

  function texEmber() {
    return pixelSet('ember', 128, 128, P => {
      const { w, h } = P;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, i = y * w + x;
        const c = 1 - Math.abs(NZ.fbm(u, v, 4, 4, 4, 91) * 2 - 1);
        const t = smooth(0.75, 0.95, c) + smooth(0.6, 0.9, NZ.fbm(u, v, 8, 8, 3, 92)) * 0.35;
        P.set(i, clamp(t, 0, 1), clamp(t * 0.8, 0, 1), clamp(t * 0.6, 0, 1));
      }
    }, {});
  }

  // weathering pass shared by painted canvases (plaques, beams, doors)
  function weatherCanvas(ctx, w, h, amt, seed) {
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h, i = (y * w + x) * 4;
      const n1 = NZ.fbm(u, v, 4, 2, 4, seed), n2 = NZ.fbm(u, v, 32, 16, 2, seed + 3);
      const peel = smooth(0.66, 0.69, NZ.fbm(u, v, 6, 3, 4, seed + 5)) * amt;
      const L = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const desat = 0.3 * amt;
      let r = lerp(d[i], L, desat), g = lerp(d[i + 1], L, desat), b = lerp(d[i + 2], L, desat);
      const k = (1 - (smooth(0.45, 0.8, n1) * 0.35 + (n2 - 0.5) * 0.15) * amt);
      r *= k; g *= k; b *= k;
      r = lerp(r, 55, peel); g = lerp(g, 40, peel); b = lerp(b, 30, peel);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    ctx.putImageData(img, 0, 0);
  }

  // 旋子彩画 (faded) for beams: whole pattern mapped along each beam
  function texBeam() {
    if (TEX.beam) return TEX.beam;
    const W = 512, H = 128, c = mkCanvas(W, H), g = ctx2d(c);
    const BLUE = '#3b5566', GREEN = '#4b6a58', DARK = '#1d2124', WHITE = '#c2beaf', RED = '#7c3a2a', OCHRE = '#a08450';
    g.fillStyle = GREEN; g.fillRect(0, 0, W, H);
    const band = (x, wd, col) => { g.fillStyle = col; g.fillRect(x, 0, wd, H); };
    for (const s of [1, -1]) {
      const X = s > 0 ? 0 : W;
      const bx = (px, wd, col) => band(s > 0 ? X + px : X - px - wd, wd, col);
      bx(0, 10, DARK); bx(10, 18, BLUE); bx(28, 4, WHITE); bx(32, 14, GREEN); bx(46, 4, WHITE); bx(50, 6, DARK);
      // whirl flowers (旋子)
      const cx = s > 0 ? 100 : W - 100;
      g.fillStyle = BLUE; g.fillRect(s > 0 ? 56 : W - 150, 0, 94, H);
      for (const [yy, rr] of [[H / 2, 34], [14, 18], [H - 14, 18]]) {
        g.beginPath(); g.arc(cx, yy, rr, 0, TAU); g.fillStyle = GREEN; g.fill();
        g.lineWidth = 3; g.strokeStyle = WHITE; g.stroke();
        for (let k = 0; k < 8; k++) {
          const a = k * TAU / 8;
          g.beginPath(); g.arc(cx + Math.cos(a) * rr * 0.55, yy + Math.sin(a) * rr * 0.55, rr * 0.34, 0, TAU);
          g.strokeStyle = DARK; g.lineWidth = 2; g.stroke();
        }
        g.beginPath(); g.arc(cx, yy, rr * 0.28, 0, TAU); g.fillStyle = RED; g.fill();
      }
      bx(150, 4, WHITE); bx(154, 8, DARK);
    }
    // 枋心
    g.beginPath(); g.moveTo(170, H / 2); g.lineTo(200, 16); g.lineTo(W - 200, 16); g.lineTo(W - 170, H / 2); g.lineTo(W - 200, H - 16); g.lineTo(200, H - 16); g.closePath();
    g.fillStyle = DARK; g.fill();
    g.save(); g.translate(0, 0); g.scale(1, 1);
    g.beginPath(); g.moveTo(180, H / 2); g.lineTo(206, 22); g.lineTo(W - 206, 22); g.lineTo(W - 180, H / 2); g.lineTo(W - 206, H - 22); g.lineTo(206, H - 22); g.closePath();
    g.fillStyle = BLUE; g.fill(); g.lineWidth = 3; g.strokeStyle = WHITE; g.stroke();
    g.restore();
    // faint cloud / dragon strokes
    g.strokeStyle = OCHRE; g.lineWidth = 3;
    for (let k = 0; k < 7; k++) {
      const x0 = 215 + k * 13;
      g.beginPath(); g.moveTo(x0, 70); g.bezierCurveTo(x0 + 20, 30, x0 + 45, 100, x0 + 70, 55); g.stroke();
    }
    weatherCanvas(g, W, H, 1, 101);
    TEX.beam = { map: finishTex(c, true, false) };
    return TEX.beam;
  }

  // 格扇 lattice door leaf (colour + normal)
  function texDoor() {
    if (TEX.door) return TEX.door;
    const W = 256, H = 512;
    const draw = (g, hmode) => {
      const F = hmode ? '#b0b0b0' : '#74301f', GAP = hmode ? '#202020' : '#8a7a62', PANEL = hmode ? '#808080' : '#662a1c', LAT = hmode ? '#d8d8d8' : '#843a27';
      g.fillStyle = F; g.fillRect(0, 0, W, H);
      g.fillStyle = GAP; g.fillRect(18, 18, W - 36, 262);
      g.save(); g.beginPath(); g.rect(18, 18, W - 36, 262); g.clip();
      if (!hmode) {
        const rr = mulberry32(55);
        for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(20,14,10,0.92)'; g.beginPath(); g.ellipse(18 + rr() * (W - 36), 18 + rr() * 262, 8 + rr() * 26, 8 + rr() * 34, rr() * 3, 0, TAU); g.fill(); }
        for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(60,45,30,${0.2 + rr() * 0.3})`; g.fillRect(18 + rr() * (W - 36), 18 + rr() * 262, 6 + rr() * 30, 20 + rr() * 90); }
      }
      g.strokeStyle = LAT; g.lineWidth = 5;
      for (let k = -30; k < 40; k++) {
        g.beginPath(); g.moveTo(k * 20, 18); g.lineTo(k * 20 + 280, 298); g.stroke();
        g.beginPath(); g.moveTo(k * 20, 18); g.lineTo(k * 20 - 280, 298); g.stroke();
      }
      g.lineWidth = 4;
      for (let k = 0; k < 14; k++) { g.beginPath(); g.moveTo(18, 18 + k * 20); g.lineTo(W - 18, 18 + k * 20); g.stroke(); }
      g.restore();
      g.strokeStyle = F; g.lineWidth = 8; g.strokeRect(22, 22, W - 44, 254);
      const panel = (y, hh) => {
        g.fillStyle = PANEL; g.fillRect(28, y, W - 56, hh);
        g.strokeStyle = hmode ? '#e0e0e0' : '#8a3a28'; g.lineWidth = 3; g.strokeRect(36, y + 8, W - 72, hh - 16);
      };
      panel(300, 44); panel(362, 104);
      g.beginPath(); g.ellipse(W / 2, 414, 58, 32, 0, 0, TAU); g.strokeStyle = hmode ? '#e8e8e8' : '#96452f'; g.lineWidth = 4; g.stroke();
      panel(484, 22);
    };
    const c = mkCanvas(W, H), g = ctx2d(c); draw(g, false); weatherCanvas(g, W, H, 0.9, 131);
    const ch = mkCanvas(W, H), gh = ctx2d(ch); draw(gh, true);
    const id = gh.getImageData(0, 0, W, H).data, hgt = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) hgt[i] = id[i * 4] / 255;
    TEX.door = { map: finishTex(c, true, false), normalMap: finishTex(heightToNormalCanvas(hgt, W, H, 3), false, false) };
    return TEX.door;
  }

  // 山门 plank door with golden studs
  function texGateDoor() {
    if (TEX.gateDoor) return TEX.gateDoor;
    const W = 256, H = 512, c = mkCanvas(W, H), g = ctx2d(c);
    g.fillStyle = '#5c1f16'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#62241a' : '#571d14'; g.fillRect(k * W / 6, 0, 2, H); }
    for (let r = 0; r < 9; r++) for (let q = 0; q < 7; q++) {
      const x = 24 + q * (W - 48) / 6, y = 40 + r * (H - 90) / 8;
      const gr = g.createRadialGradient(x - 3, y - 3, 1, x, y, 9);
      gr.addColorStop(0, '#d9b86a'); gr.addColorStop(0.6, '#8c6a30'); gr.addColorStop(1, '#3a2a14');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill();
    }
    g.fillStyle = '#6b5530'; g.beginPath(); g.arc(W - 30, H * 0.5, 22, 0, TAU); g.fill();
    g.strokeStyle = '#a58a4c'; g.lineWidth = 5; g.beginPath(); g.arc(W - 30, H * 0.5 + 18, 16, 0, TAU); g.stroke();
    weatherCanvas(g, W, H, 1, 141);
    TEX.gateDoor = { map: finishTex(c, true, false) };
    return TEX.gateDoor;
  }

  // font handling: redraw calligraphy once Ma Shan Zheng is available
  let fontHooked = false;
  function hookFont() {
    if (fontHooked || typeof document === 'undefined' || !document.fonts) return;
    fontHooked = true;
    const redraw = () => { for (const j of textJobs) { j.draw(); j.tex.needsUpdate = true; } };
    try {
      document.fonts.load('64px "Ma Shan Zheng"', '观音禅院黑风山').then(fs => { if (fs && fs.length) redraw(); }).catch(() => {});
      document.fonts.ready.then(() => { if (document.fonts.check('64px "Ma Shan Zheng"')) redraw(); }).catch(() => {});
    } catch (e) { /* ignore */ }
  }
  function textTexture(key, W, H, draw) {
    if (TEX[key]) return TEX[key];
    const c = mkCanvas(W, H), g = ctx2d(c);
    const job = { draw: () => { g.clearRect(0, 0, W, H); draw(g, W, H); } };
    job.draw();
    const tex = finishTex(c, true, false);
    job.tex = tex; textJobs.push(job); hookFont();
    TEX[key] = { map: tex };
    return TEX[key];
  }
  function drawChars(g, text, cx, cy, fs, vertical, fill, shadow) {
    g.font = `${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = text.length;
    for (let i = 0; i < n; i++) {
      const x = vertical ? cx : cx + (i - (n - 1) / 2) * fs * 1.08;
      const y = vertical ? cy + (i - (n - 1) / 2) * fs * 1.05 : cy;
      if (shadow) { g.fillStyle = shadow; g.fillText(text[i], x + fs * 0.035, y + fs * 0.04); }
      g.fillStyle = fill; g.fillText(text[i], x, y);
    }
  }
  function texPlaque(text) {
    return textTexture('plaque:' + text, 512, 192, (g, W, H) => {
      g.fillStyle = '#7d6232'; g.fillRect(0, 0, W, H);
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#a88a4c'); gr.addColorStop(0.5, '#6e5428'); gr.addColorStop(1, '#8e7038');
      g.fillStyle = gr; g.fillRect(4, 4, W - 8, H - 8);
      g.strokeStyle = '#3a2a14'; g.lineWidth = 3;
      for (let k = 0; k < 40; k++) { g.beginPath(); g.arc(8 + k * 13, 9, 4, 0, TAU); g.stroke(); g.beginPath(); g.arc(8 + k * 13, H - 9, 4, 0, TAU); g.stroke(); }
      g.fillStyle = '#521c14'; g.fillRect(18, 18, W - 36, H - 36);
      g.fillStyle = '#141b24'; g.fillRect(26, 26, W - 52, H - 52);
      const n = text.length, fs = Math.min((W - 80) / n / 1.08, (H - 60) * 0.86);
      const tg = g.createLinearGradient(0, H / 2 - fs / 2, 0, H / 2 + fs / 2);
      tg.addColorStop(0, '#f6e09a'); tg.addColorStop(0.55, '#d8ae58'); tg.addColorStop(1, '#a07634');
      drawChars(g, text, W / 2, H / 2 + fs * 0.03, fs, false, tg, 'rgba(0,0,0,0.75)');
      weatherCanvas(g, W, H, 0.75, 151);
    });
  }
  function texStoneText(text) {
    return textTexture('stoneText:' + text, 512, 192, (g, W, H) => {
      const s = texStone().canvas;
      g.drawImage(s, 0, 0, 512, 512, 0, 0, W, W);
      g.fillStyle = 'rgba(160,150,130,0.25)'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(30,28,24,0.7)'; g.lineWidth = 6; g.strokeRect(16, 16, W - 32, H - 32);
      g.strokeStyle = 'rgba(220,210,190,0.35)'; g.lineWidth = 2; g.strokeRect(21, 21, W - 42, H - 42);
      const n = text.length, fs = Math.min((W - 90) / n / 1.08, (H - 60) * 0.85);
      drawChars(g, text, W / 2 + 2, H / 2 + 3, fs, false, 'rgba(235,225,200,0.45)', null);
      drawChars(g, text, W / 2, H / 2, fs, false, 'rgba(58,26,18,0.92)', null);
      drawChars(g, text, W / 2 - 1, H / 2 - 1, fs * 0.94, false, 'rgba(120,52,34,0.55)', null);
    });
  }
  // atlas for the earth-god shrine: plaque (top) + couplets (bottom halves)
  function texShrineSign() {
    return textTexture('shrineSign', 512, 512, (g, W, H) => {
      // plaque 0..512 x 0..160
      g.fillStyle = '#2a1a12'; g.fillRect(0, 0, W, 160);
      g.fillStyle = '#4a1c14'; g.fillRect(10, 10, W - 20, 140);
      g.fillStyle = '#16140f'; g.fillRect(22, 22, W - 44, 116);
      drawChars(g, '土地庙', W / 2, 82, 96, false, '#c9a452', 'rgba(0,0,0,0.7)');
      // couplets: two strips 0..256 / 256..512 x 160..512 (red paper)
      const cp = ['土能生万物', '地可发千祥'];
      for (let k = 0; k < 2; k++) {
        const x0 = k * 256;
        g.fillStyle = '#8e2418'; g.fillRect(x0, 160, 256, 352);
        g.fillStyle = 'rgba(0,0,0,0.12)'; for (let s = 0; s < 6; s++) g.fillRect(x0, 160 + s * 60, 256, 2);
        drawChars(g, cp[1 - k], x0 + 128, 336, 62, true, '#15100c', null);
      }
      weatherCanvas(g, W, H, 0.9, 161);
    });
  }
  function texBanner() {
    return textTexture('banner', 128, 512, (g, W, H) => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#b08a44'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#7a2a1c'; g.fillRect(0, 0, W, 26); g.fillRect(0, 26, 7, H); g.fillRect(W - 7, 26, 7, H);
      g.fillStyle = '#5c2016'; g.fillRect(0, 380, W, 10);
      drawChars(g, '南无观世音菩萨', W / 2, 205, 46, true, '#4a1810', null);
      weatherCanvas(g, W, H, 0.85, 171);
      // tattered bottom / tails via alpha
      const img = g.getImageData(0, 0, W, H), d = img.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, u = x / W, v = y / H;
        let a = 1;
        if (y > 392) {
          const tails = Math.abs(((u * 3) % 1) - 0.5) < 0.36; // three tails
          const rag = NZ.fbm(u, 0.3, 16, 1, 3, 177) * 60;
          if (!tails || y > H - 8 - rag) a = 0;
        }
        const hole = NZ.fbm(u, v, 8, 16, 3, 179);
        if (hole > 0.73 && y > 60) a = 0;
        if (x < 1 || x > W - 2) a = 0;
        d[i + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  function texLantern() {
    if (TEX.lantern) return TEX.lantern;
    const W = 128, H = 128, c = mkCanvas(W, H), g = ctx2d(c);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#551008'); gr.addColorStop(0.5, '#ffb070'); gr.addColorStop(1, '#551008');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(40,5,0,0.45)'; for (let k = 0; k < 8; k++) g.fillRect(k * 16, 0, 3, H);
    g.font = `44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(40,6,0,0.75)'; g.fillText('佛', 32, 66); g.fillText('佛', 96, 66);
    TEX.lantern = { map: finishTex(c, true, true) };
    return TEX.lantern;
  }

  // ------------------------------------------------------------ materials
  const WX_DECL = 'varying vec3 vWxPos; varying vec3 vWxNrm; varying vec3 vWxLoc;';
  const WX_FUNCS = `
float wxHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wxNoise(vec3 x) { vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wxHash(i), wxHash(i + vec3(1,0,0)), f.x), mix(wxHash(i + vec3(0,1,0)), wxHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wxHash(i + vec3(0,0,1)), wxHash(i + vec3(1,0,1)), f.x), mix(wxHash(i + vec3(0,1,1)), wxHash(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
  // world/local-height weathering: ground grime + wet darkening, moss on up-facing surfaces, dust on tops
  function weather(m, o) {
    const c = Object.assign({ moss: 0.6, grime: 0.45, grimeH: 1.1, wet: 0.4, dust: 0.08, mossLow: 0.5, mossUp: 0.45 }, o);
    const f = x => Number(x).toFixed(3);
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + WX_DECL)
        .replace('#include <fog_vertex>', `#include <fog_vertex>
  vWxPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWxNrm = normalize(mat3(modelMatrix) * objectNormal);
  vWxLoc = transformed;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + WX_DECL + WX_FUNCS)
        .replace('#include <color_fragment>', `#include <color_fragment>
  float wxN1 = wxNoise(vWxPos * 0.8);
  float wxN2 = wxNoise(vWxPos * 3.1 + 7.1);
  float wxN3 = wxNoise(vWxPos * 11.0 + 3.7);
  float wxG = 1.0 - smoothstep(0.0, ${f(c.grimeH)} * (0.55 + 0.9 * wxN1), vWxLoc.y);
  diffuseColor.rgb *= 1.0 - ${f(c.grime)} * wxG * (0.7 + 0.3 * wxN3);
  float wxUp = clamp(vWxNrm.y, 0.0, 1.0);
  float wxM = smoothstep(${f(c.mossUp)}, ${f(c.mossUp + 0.4)}, wxUp) * smoothstep(0.42, 0.62, wxN1 * 0.65 + wxN2 * 0.35);
  wxM = max(wxM, wxG * smoothstep(0.5, 0.72, wxN2 * 0.6 + wxN3 * 0.4) * ${f(c.mossLow)});
  wxM = clamp(wxM * ${f(c.moss)} * (0.7 + 0.6 * wxN3), 0.0, 1.0);
  vec3 wxMossC = mix(vec3(0.03, 0.045, 0.012), vec3(0.085, 0.10, 0.03), wxN2);
  diffuseColor.rgb = mix(diffuseColor.rgb, wxMossC, wxM);
  diffuseColor.rgb *= 1.0 + ${f(c.dust)} * wxUp * (1.0 - wxM);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.5, wxG * ${f(c.wet)});
  roughnessFactor = mix(roughnessFactor, 1.0, wxM);`);
    };
    m.customProgramCacheKey = () => 'wx:' + JSON.stringify(c);
    return m;
  }
  function flicker(m, amt, speed) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uPropTime = uniforms.time;
      sh.fragmentShader = 'uniform float uPropTime;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float flk = 0.62 + 0.22 * sin(uPropTime * ${speed.toFixed(2)} + vViewPosition.x * 0.7) + 0.16 * sin(uPropTime * ${(speed * 2.73).toFixed(2)} + 1.3 + vViewPosition.y);
  totalEmissiveRadiance *= 1.0 - ${amt.toFixed(2)} + ${amt.toFixed(2)} * flk;`);
    };
    m.customProgramCacheKey = () => 'flk:' + amt + ':' + speed;
    return m;
  }
  // banner sway (vertex shader); shared by colour + depth materials
  const SWAY = `
  vec3 transformed = vec3(position);
  {
    float st = clamp(1.0 - uv.y, 0.0, 1.0);
    float amp = pow(st, 1.4);
    float t = uPropTime;
    float w1 = sin(t * 1.55 + position.y * 0.55) * 0.55 + sin(t * 0.73 + 1.7) * 0.45;
    float w2 = sin(t * 3.4 + position.y * 2.3 + position.x * 4.0) * 0.08;
    transformed.z += amp * (w1 * 0.45 + w2) + st * 0.08;
    transformed.x += amp * sin(t * 1.1 + position.y * 0.4 + 0.6) * 0.18;
  }`;
  function swayMat(m) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uPropTime = uniforms.time;
      sh.vertexShader = 'uniform float uPropTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', SWAY);
    };
    m.customProgramCacheKey = () => 'sway';
    return m;
  }

  const V2 = (x, y) => new THREE.Vector2(x, y);
  let VC = true; // builder meshes carry baked vertex colours (AO / tints); exported materials do not
  function std(p, wx) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: VC }, p));
    if (wx) weather(m, wx);
    return m;
  }
  const MAT_DEFS = {
    stone: () => { const t = texStone(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.93, normalScale: V2(1, 1) }, { moss: 0.8, grime: 0.5 }); },
    ashlar: () => { const t = texAshlar(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.92 }, { moss: 0.7, grime: 0.55, grimeH: 1.3 }); },
    brick: () => { const t = texBrick(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.9 }, { moss: 0.7, grime: 0.5, grimeH: 1.4 }); },
    flag: () => { const t = texFlag(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.9 }, { moss: 0.55, grime: 0.25, grimeH: 0.4, mossUp: 0.8 }); },
    wood: () => { const t = texWood(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.82 }, { moss: 0.25, grime: 0.4 }); },
    lacquer: () => { const t = texLacquer(); return std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1 }, { moss: 0.12, grime: 0.55, grimeH: 1.5, mossLow: 0.35 }); },
    plaster: () => { const t = texPlaster(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.95 }, { moss: 0.35, grime: 0.55, grimeH: 1.6, mossLow: 0.6 }); },
    tile: () => { const t = texTiles(); return std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, normalScale: V2(1.2, 1.2) }, { moss: 0.45, grime: 0.0, dust: 0.05, mossUp: 0.62 }); },
    tileStone: () => { const t = texTiles(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.9, color: new THREE.Color(1.4, 1.2, 1.1) }, { moss: 0.8, grime: 0.3, mossUp: 0.55 }); },
    painted: () => { const t = texGrime(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.85 }, { moss: 0.15, grime: 0.45 }); },
    beam: () => std({ map: texBeam().map, roughness: 0.88 }, { moss: 0.05, grime: 0.3 }),
    door: () => { const t = texDoor(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.75 }, { moss: 0.05, grime: 0.5, grimeH: 1.6 }); },
    gateDoor: () => std({ map: texGateDoor().map, roughness: 0.7, metalness: 0.05 }, { moss: 0.05, grime: 0.5, grimeH: 1.6 }),
    bronze: () => { const t = texBronze(); return std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, metalnessMap: t.roughnessMap, roughness: 1, metalness: 1 }, { moss: 0.1, grime: 0.3, dust: 0.03 }); },
    iron: () => { const t = texIron(); return std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, metalnessMap: t.roughnessMap, roughness: 1, metalness: 1 }, { moss: 0.05, grime: 0.3 }); },
    statue: () => { const t = texStone(); return std({ map: t.map, normalMap: t.normalMap, roughness: 0.95, color: new THREE.Color(0.92, 0.9, 0.86) }, { moss: 1.25, grime: 0.55, grimeH: 1.4, mossUp: 0.3, mossLow: 0.8 }); },
    dark: () => std({ color: new THREE.Color(0.018, 0.016, 0.014), roughness: 0.95 }),
    glow: () => flicker(std({ color: new THREE.Color(0.05, 0.03, 0.01), emissive: new THREE.Color(1.0, 0.42, 0.12), emissiveIntensity: 1.5, roughness: 0.8 }), 0.35, 9.0),
    lantern: () => flicker(std({ color: new THREE.Color(0.3, 0.05, 0.03), emissive: new THREE.Color(1.0, 0.3, 0.12), emissiveIntensity: 2.2, emissiveMap: texLantern().map, roughness: 0.9 }), 0.2, 5.0),
    ember: () => { const t = texEmber(); return flicker(std({ color: new THREE.Color(0.06, 0.045, 0.035), emissive: new THREE.Color(1.0, 0.33, 0.07), emissiveIntensity: 3.0, emissiveMap: t.map, roughness: 0.95 }), 0.45, 4.0); },
    banner: () => {
      const t = texBanner();
      const m = swayMat(std({ map: t.map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 }));
      const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t.map, alphaTest: 0.5, side: THREE.DoubleSide });
      swayMat(dm);
      m.userData.depthMat = dm;
      return m;
    },
    shrineSign: () => std({ map: texShrineSign().map, roughness: 0.85 }, { moss: 0.05, grime: 0.3 }),
  };
  const MATS = {};
  const NOSHADOW = new Set(['glow', 'lantern', 'ember']);
  function MAT(key) {
    if (MATS[key]) return MATS[key];
    let m;
    if (key.startsWith('plaque:')) m = std({ map: texPlaque(key.slice(7)).map, roughness: 0.6, metalness: 0.1 }, { moss: 0.0, grime: 0.2 });
    else if (key.startsWith('stoneText:')) m = std({ map: texStoneText(key.slice(10)).map, roughness: 0.92 }, { moss: 0.5, grime: 0.3, mossUp: 0.7 });
    else m = MAT_DEFS[key]();
    m.name = key;
    MATS[key] = m;
    return m;
  }
  // Public dictionary: same textures / weathering as the builders, but without the vertex-colour
  // requirement so the game can put them on any geometry. Created lazily on first access.
  const materials = {}, EXPORTED = {};
  for (const k of Object.keys(MAT_DEFS)) Object.defineProperty(materials, k, {
    enumerable: true,
    get: () => {
      if (!EXPORTED[k]) { VC = false; try { EXPORTED[k] = MAT_DEFS[k](); EXPORTED[k].name = k; } finally { VC = true; } }
      return EXPORTED[k];
    },
  });

  // UV scale (repeats per metre) per material for projected UVs
  const UVS = { stone: 0.5, ashlar: 0.5, brick: 1, flag: 0.34, wood: 0.8, lacquer: 0.7, plaster: 0.5, painted: 0.6, statue: 0.6, iron: 0.8, bronze: 0.8, dark: 1, tile: 0.6, tileStone: 0.6 };

  // ------------------------------------------------------------ geometry utils
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
  function T(g, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    _m4.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    g.applyMatrix4(_m4);
    return g;
  }
  function prep(g) {
    const n = g.attributes.position.count;
    if (!g.index) {
      const a = new (n > 65535 ? Uint32Array : Uint16Array)(n);
      for (let i = 0; i < n; i++) a[i] = i;
      g.setIndex(new THREE.BufferAttribute(a, 1));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') g.deleteAttribute(k);
    g.clearGroups();
    g.morphAttributes = {};
    return g;
  }
  // multiply vertex colour by function(x,y,z,nx,ny,nz) -> [r,g,b] or scalar
  function shade(g, fn) {
    prep(g);
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const r = fn(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i));
      if (typeof r === 'number') { c.setXYZ(i, c.getX(i) * r, c.getY(i) * r, c.getZ(i) * r); }
      else c.setXYZ(i, c.getX(i) * r[0], c.getY(i) * r[1], c.getZ(i) * r[2]);
    }
    return g;
  }
  const tint = (g, r, gg = r, b = r) => shade(g, () => [r, gg, b]);
  const tintS = (g, r, gg, b) => tint(g, sl(r), sl(gg), sl(b)); // sRGB colour
  const shadeY = (g, y0, y1, lo, hi = 1) => shade(g, (x, y) => lerp(lo, hi, smooth(y0, y1, y)));
  function jitter(g, amt) { const k = 1 + (rnd() - 0.5) * amt, h = (rnd() - 0.5) * amt * 0.3; return tint(g, k * (1 + h), k, k * (1 - h)); }
  // tri-planar style box projection in the geometry's current space
  function uvProj(g, s = 1, ou = 0, ov = 0) {
    prep(g);
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      let u, v;
      if (ay >= ax && ay >= az) { u = p.getX(i); v = -p.getZ(i) * Math.sign(n.getY(i) || 1); }
      else if (ax >= az) { u = -p.getZ(i) * Math.sign(n.getX(i) || 1); v = p.getY(i); }
      else { u = p.getX(i) * Math.sign(n.getZ(i) || 1); v = p.getY(i); }
      uv.setXY(i, u * s + ou, v * s + ov);
    }
    return g;
  }
  function uvMap(g, fn) { prep(g); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const r = fn(uv.getX(i), uv.getY(i)); uv.setXY(i, r[0], r[1]); } return g; }
  const scaleUV = (g, su, sv, ou = 0, ov = 0) => uvMap(g, (u, v) => [u * su + ou, v * sv + ov]);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, seg = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(p => V2(p[0], p[1])), seg);
  // add with projected UVs (material scale) and optional random offset
  function addP(b, key, g, jit = 0.1) { uvProj(g, UVS[key] || 1, rnd(0, 7), rnd(0, 7)); if (jit) jitter(g, jit); return b.add(key, g); }

  // flat-shaded n-gon prism (circumradius r0 bottom / r1 top), UVs in metres
  function prism(n, r0, r1, h, rot = 0, caps = true) {
    const pos = [], uv = [], idx = [];
    const side = 2 * r0 * Math.sin(PI / n);
    for (let i = 0; i < n; i++) {
      const a0 = rot + i * TAU / n, a1 = rot + (i + 1) * TAU / n, b0 = pos.length / 3;
      pos.push(Math.cos(a0) * r0, 0, Math.sin(a0) * r0, Math.cos(a1) * r0, 0, Math.sin(a1) * r0, Math.cos(a1) * r1, h, Math.sin(a1) * r1, Math.cos(a0) * r1, h, Math.sin(a0) * r1);
      const s0 = i * side;
      uv.push(s0, 0, s0 + side, 0, s0 + side, h, s0, h);
      idx.push(b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
    }
    if (caps) {
      for (const top of [0, 1]) {
        const r = top ? r1 : r0, y = top ? h : 0, c = pos.length / 3;
        pos.push(0, y, 0); uv.push(0, 0);
        for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); uv.push(Math.cos(a) * r, Math.sin(a) * r); }
        for (let i = 0; i < n; i++) { const a = c + 1 + i, bq = c + 1 + (i + 1) % n; if (top) idx.push(c, bq, a); else idx.push(c, a, bq); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // subdivided flat-faced n-gon shell (no caps); top height per (face, column) via topFn; inward=true flips
  function prismShell(n, r0, r1, h, rot, cols, topFn, inward = false) {
    const pos = [], uv = [], idx = [], side = 2 * r0 * Math.sin(PI / n), rows = 3;
    for (let i = 0; i < n; i++) {
      const a0 = rot + i * TAU / n, a1 = rot + (i + 1) * TAU / n, base = pos.length / 3;
      for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
        const t = c / cols, top = topFn(i, t), y = top * r / rows, rr = lerp(r0, r1, y / h);
        const x = lerp(Math.cos(a0), Math.cos(a1), t) * rr, z = lerp(Math.sin(a0), Math.sin(a1), t) * rr;
        pos.push(x, y, z); uv.push((i + t) * side, y);
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const a = base + r * (cols + 1) + c, b2 = a + 1, cc = a + cols + 1, d = cc + 1;
        if (inward) idx.push(a, b2, cc, b2, d, cc); else idx.push(a, cc, b2, b2, cc, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // sweep a closed CCW profile [[s,u]...] along a polyline of [x,y,z]
  function sweep(path, prof, o = {}) {
    const n = path.length, m = prof.length, up = o.up || [0, 1, 0], s = o.uvs || 1;
    const P = path.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const U0 = new THREE.Vector3(up[0], up[1], up[2]);
    const fr = [], Ls = [0];
    for (let i = 1; i < n; i++) Ls.push(Ls[i - 1] + P[i].distanceTo(P[i - 1]));
    for (let i = 0; i < n; i++) {
      const Tn = P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize();
      const S = new THREE.Vector3().crossVectors(Tn, U0);
      if (S.lengthSq() < 1e-8) S.set(0, 0, 1);
      S.normalize();
      const U = new THREE.Vector3().crossVectors(S, Tn).normalize();
      fr.push([S, U]);
    }
    const pos = [], uv = [], idx = [];
    let acc = 0;
    for (let e = 0; e < m; e++) {
      const A = prof[e], B = prof[(e + 1) % m], el = Math.hypot(B[0] - A[0], B[1] - A[1]), base = pos.length / 3;
      for (let i = 0; i < n; i++) {
        const [S, U] = fr[i], p = P[i];
        pos.push(p.x + S.x * A[0] + U.x * A[1], p.y + S.y * A[0] + U.y * A[1], p.z + S.z * A[0] + U.z * A[1]);
        pos.push(p.x + S.x * B[0] + U.x * B[1], p.y + S.y * B[0] + U.y * B[1], p.z + S.z * B[0] + U.z * B[1]);
        uv.push(Ls[i] * s, acc * s, Ls[i] * s, (acc + el) * s);
      }
      for (let i = 0; i < n - 1; i++) { const a0 = base + i * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3; idx.push(a0, b0, a1, a1, b0, b1); }
      acc += el;
    }
    if (o.caps !== false) {
      let cx = 0, cy = 0; for (const q of prof) { cx += q[0] / m; cy += q[1] / m; }
      for (const end of [0, 1]) {
        const i = end ? n - 1 : 0, [S, U] = fr[i], p = P[i], base = pos.length / 3;
        pos.push(p.x + S.x * cx + U.x * cy, p.y + S.y * cx + U.y * cy, p.z + S.z * cx + U.z * cy); uv.push(cx * s, cy * s);
        for (const q of prof) { pos.push(p.x + S.x * q[0] + U.x * q[1], p.y + S.y * q[0] + U.y * q[1], p.z + S.z * q[0] + U.z * q[1]); uv.push(q[0] * s, q[1] * s); }
        for (let e = 0; e < m; e++) { const a = base + 1 + e, bq = base + 1 + (e + 1) % m; if (end === 0) idx.push(base, a, bq); else idx.push(base, bq, a); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const rectProf = (s0, s1, u0, u1) => [[s0, u0], [s1, u0], [s1, u1], [s0, u1]];
  const ridgeProf = (w, h, drop = 0.12) => [[-w / 2, -drop], [w / 2, -drop], [w / 2, h * 0.66], [w * 0.3, h], [-w * 0.3, h], [-w / 2, h * 0.66]];

  // extrude a polygon given in the (z,y) plane along +x by `thick` (x from 0..thick)
  function extrudeZY(pts, thick) {
    const sh = new THREE.Shape(pts.map(p => V2(-p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false });
    g.rotateY(PI / 2);
    return g;
  }
  // extrude polygon in the (x,y) plane along z, centred on z=0
  function extrudeXY(pts, thick, bevel = 0) {
    const sh = new THREE.Shape(pts.map(p => V2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -thick / 2);
    return g;
  }
  // deform vertices along normals using 3D simplex noise (erosion)
  let simplex = null;
  function erode(g, amp, freq, seed = 0) {
    if (!simplex) simplex = new SimplexNoise({ random: mulberry32(4242) });
    prep(g);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = simplex.noise3d(x * freq + seed, y * freq, z * freq) * 0.65 + simplex.noise3d(x * freq * 3.1, y * freq * 3.1 + seed, z * freq * 3.1) * 0.35;
      p.setXYZ(i, x + n.getX(i) * k * amp, y + n.getY(i) * k * amp, z + n.getZ(i) * k * amp);
    }
    g.computeVertexNormals();
    return g;
  }

  // irregular faceted rock
  function rock(s, seed) {
    let g = new THREE.IcosahedronGeometry(s, 1);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g); g.computeVertexNormals();
    erode(g, s * 0.35, 1.6 / s, seed);
    g = g.toNonIndexed(); g.computeVertexNormals();
    return g;
  }
  // ------------------------------------------------------------ batching
  class Batch {
    constructor() { this.m = new Map(); }
    add(key, g) { prep(g); let l = this.m.get(key); if (!l) this.m.set(key, (l = [])); l.push(g); return g; }
    build() {
      const grp = new THREE.Group();
      for (const [key, list] of this.m) {
        const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
        if (!geo) { console.warn('Props: merge failed for', key, list.map(g => Object.keys(g.attributes).join('/') + (g.index ? '+i' : '')).filter((v, i, arr) => arr.indexOf(v) === i)); continue; }
        if (list.length > 1) list.forEach(g => g.dispose());
        geo.computeBoundingSphere(); geo.computeBoundingBox();
        const mat = MAT(key), mesh = new THREE.Mesh(geo, mat);
        mesh.name = key;
        mesh.castShadow = !NOSHADOW.has(key); mesh.receiveShadow = true;
        if (mat.userData.depthMat) mesh.customDepthMaterial = mat.userData.depthMat;
        grp.add(mesh);
      }
      return grp;
    }
  }
  const newRes = () => ({ colliders: [], lights: [], fires: [], smoke: [], interact: null });
  const finish = (b, res, name) => { const o = b.build(); o.name = name; return Object.assign({ object: o }, res); };
  const WARM = () => new THREE.Color(1.0, 0.62, 0.32);
  const circleC = (x, z, r) => ({ type: 'circle', x, z, r });
  const boxC = (x, z, hx, hz, rot = 0) => ({ type: 'box', x, z, hx, hz, rot });

  // ------------------------------------------------------------ roof system
  // A roof is a set of planar-parametrised slopes ("faces"). Each face has an eave line
  // (centre c, tangent t, inward normal n, half length `half`). At inward distance d the
  // slope spans |u| <= half - k*d (hip lines) or a clamped gable extent `gext`.
  // Height follows a concave 举折 profile; corners lift (起翘) and flare out (出翘).
  function prof(x) { return x <= 0 ? 0.42 * x : 0.42 * x + 0.58 * Math.pow(x, 2.3); }
  function rectFaces(ax, az) {
    return [
      { cx: 0, cz: az, nx: 0, nz: -1, tx: 1, tz: 0, half: ax, k: 1, dmax: Math.min(ax, az) },
      { cx: ax, cz: 0, nx: -1, nz: 0, tx: 0, tz: -1, half: az, k: 1, dmax: Math.min(ax, az) },
      { cx: 0, cz: -az, nx: 0, nz: 1, tx: -1, tz: 0, half: ax, k: 1, dmax: Math.min(ax, az) },
      { cx: -ax, cz: 0, nx: 1, nz: 0, tx: 0, tz: 1, half: az, k: 1, dmax: Math.min(ax, az) },
    ];
  }
  function polyFaces(N, a, rot = 0) {
    const out = [], k = Math.tan(PI / N);
    for (let i = 0; i < N; i++) {
      const th = rot + i * TAU / N, ox = Math.cos(th), oz = Math.sin(th);
      out.push({ cx: ox * a, cz: oz * a, nx: -ox, nz: -oz, tx: oz, tz: -ox, half: a * k, k, dmax: a });
    }
    return out;
  }
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function makeRoofFns(R) {
    const surf = (f, u, d) => {
      const ext0 = f.half - f.k * d;
      const cR = Math.max(0, ext0 - u), cL = Math.max(0, ext0 + u), dd = Math.max(0, d);
      const eC = Math.max(Math.exp(-cR / R.lam), Math.exp(-cL / R.lam)), eD = Math.exp(-dd / R.lamD);
      const e2 = Math.max(Math.exp(-cR / R.lam2), Math.exp(-cL / R.lam2));
      const lift = R.L * eC * eD + R.L2 * e2 * Math.exp(-dd / R.lamD2);
      let x = f.cx + f.tx * u + f.nx * d, z = f.cz + f.tz * u + f.nz * d;
      if (R.F) {
        const su = u >= 0 ? 1 : -1;
        let bx = f.tx * su * f.k - f.nx, bz = f.tz * su * f.k - f.nz; const bl = Math.hypot(bx, bz) || 1;
        const fl = R.F * eC * eD; x += bx / bl * fl; z += bz / bl * fl;
      }
      return [x, R.y0 + R.H * prof(d / R.D) + lift, z];
    };
    const ext = (f, d) => (f.gext ? Math.max(f.half - f.k * d, f.gext) : Math.max(0, f.half - f.k * d));
    const frame = (f, u, d) => {
      const e = 0.01, P = surf(f, u, d);
      const Tu = norm3(sub3(surf(f, u + e, d), surf(f, u - e, d)));
      const Td = norm3(sub3(surf(f, u, d + e), surf(f, u, d - e)));
      return { P, T: Tu, D: Td, N: norm3(cross3(Tu, Td)) };
    };
    return { surf, ext, frame, R };
  }

  // s in [-1,1] -> [-1,1], denser near the ends
  const endWarp = s => Math.sign(s) * (1 - Math.pow(1 - Math.abs(s), 1.6));
  // hexagonal tile-end disc (瓦当): front cap + rim only, axis +Y
  function discGeo(r, h) {
    const pos = [0, h, 0], idx = [], n = 7;
    for (let i = 0; i < n; i++) { const a = i * TAU / n; pos.push(Math.cos(a) * r, h, Math.sin(a) * r); }
    for (let i = 0; i < n; i++) { const a = i * TAU / n; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
    for (let i = 0; i < n; i++) { const a = 1 + i, bq = 1 + (i + 1) % n, c = 1 + n + i, d = 1 + n + (i + 1) % n; idx.push(0, bq, a, a, bq, d, a, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // rafter: open box (no back / top), axis +Z
  function rafterGeo(w, len) {
    const g = box(w, w, len); prep(g);
    const idx = g.index.array, keep = [];
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z (6 indices per face... 2 tris each)
    for (let f = 0; f < 6; f++) if (f !== 2 && f !== 5) for (let k = 0; k < 6; k++) keep.push(idx[f * 6 + k]);
    g.setIndex(keep);
    return g;
  }
  function roof(b, R0) {
    const R = Object.assign({ L: 0, lam: 1.5, lamD: 1, L2: 0, lam2: 4, lamD2: 2, F: 0, sp: 0.3, th: 0.3, tileKey: 'tile', underKey: 'painted', fasciaKey: 'painted', rafterKey: 'painted',
      rows: true, discs: true, rafters: true, fascia: true, under: true, gridU: 0.6, gridD: 0.55, rowSeg: 0.7, vScale: 1 / 2.4, ridgeInset: 0.12, underTint: null, tileTint: null, rafterSp: 0.38, rafterLen: 0.75 }, R0);
    // default soffit: iron-oxide red boards (望板), fascia darker
    if (!R.underTint && R.underKey === 'painted') R.underTint = [sl(0.4), sl(0.19), sl(0.14)];
    const rf = makeRoofFns(R);
    const { surf, ext, frame } = rf;
    for (const f of R.faces) {
      const nu = Math.max(2, Math.ceil(2 * f.half / R.gridU) + (Math.ceil(2 * f.half / R.gridU) % 2)), nd = Math.max(1, Math.ceil(f.dmax / R.gridD));
      const nRows = Math.max(1, Math.floor((2 * f.half - 0.9 * R.sp) / R.sp) + 1);
      const u0 = -(nRows - 1) / 2 * R.sp;
      // ---- slope surface (top) + soffit (under)
      const cnt = (nu + 1) * (nd + 1);
      const pT = new Float32Array(cnt * 3), nT = new Float32Array(cnt * 3), uvT = new Float32Array(cnt * 2);
      const pU = new Float32Array(cnt * 3), nU = new Float32Array(cnt * 3), uvU = new Float32Array(cnt * 2);
      let vi = 0;
      for (let j = 0; j <= nd; j++) {
        const d = f.dmax * j / nd, e = ext(f, d);
        for (let i = 0; i <= nu; i++, vi++) {
          const u = e * endWarp(2 * i / nu - 1), fr = frame(f, u, d);
          pT.set(fr.P, vi * 3); nT.set(fr.N, vi * 3);
          uvT[vi * 2] = (u - u0) / (4 * R.sp) + 0.125; uvT[vi * 2 + 1] = d * R.vScale;
          pU[vi * 3] = fr.P[0] - fr.N[0] * R.th * 0.2; pU[vi * 3 + 1] = fr.P[1] - R.th; pU[vi * 3 + 2] = fr.P[2] - fr.N[2] * R.th * 0.2;
          nU[vi * 3] = -fr.N[0]; nU[vi * 3 + 1] = -fr.N[1]; nU[vi * 3 + 2] = -fr.N[2];
          uvU[vi * 2] = u * 0.8; uvU[vi * 2 + 1] = d * 0.8;
        }
      }
      const iT = [], iU = [];
      for (let j = 0; j < nd; j++) for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, bb = a + 1, c = a + nu + 1, d2 = c + 1;
        iT.push(a, bb, c, bb, d2, c); iU.push(a, c, bb, bb, c, d2);
      }
      const gT = new THREE.BufferGeometry();
      gT.setAttribute('position', new THREE.BufferAttribute(pT, 3)); gT.setAttribute('normal', new THREE.BufferAttribute(nT, 3)); gT.setAttribute('uv', new THREE.BufferAttribute(uvT, 2)); gT.setIndex(iT);
      if (R.tileTint) tint(gT, ...R.tileTint);
      b.add(R.tileKey, gT);
      if (R.under) {
        const gU = new THREE.BufferGeometry();
        gU.setAttribute('position', new THREE.BufferAttribute(pU, 3)); gU.setAttribute('normal', new THREE.BufferAttribute(nU, 3)); gU.setAttribute('uv', new THREE.BufferAttribute(uvU, 2)); gU.setIndex(iU);
        if (R.underTint) tint(gU, ...R.underTint);
        b.add(R.underKey, gU);
      }
      // ---- barrel tile rows (筒瓦) + eave discs (瓦当)
      if (R.rows) {
        const m = R.sp * 0.45, w = R.sp * 0.23, hh = R.sp * 0.24, d0 = -0.07;
        const pos = [], nor = [], uvs = [], idx = [], discs = [], drips = [];
        for (let k = 0; k < nRows; k++) {
          const u = u0 + k * R.sp, au = Math.abs(u);
          let dEnd;
          if (f.gext && au + m <= f.gext) dEnd = f.dmax - R.ridgeInset;
          else if (f.k > 0) dEnd = Math.min(f.dmax - (f.cutInset || 0.02), (f.half - au - m) / f.k);
          else dEnd = f.dmax - R.ridgeInset;
          if (dEnd - d0 < 0.22) continue;
          const ns = Math.max(1, Math.ceil((dEnd - d0) / R.rowSeg)), base = pos.length / 3, tu = (u - u0) / (4 * R.sp) + 0.125;
          for (let j = 0; j <= ns; j++) {
            const d = d0 + (dEnd - d0) * Math.pow(j / ns, 1.35), fr = frame(f, u, d), P = fr.P, Tt = fr.T, N = fr.N;
            for (let a = 0; a < 3; a++) {
              const sx = [-1, 0, 1][a], sy = [0.05, 1.1, 0.05][a], qx = [-0.8, 0, 0.8][a], qy = [0.6, 1, 0.6][a];
              pos.push(P[0] + Tt[0] * w * sx + N[0] * hh * sy, P[1] + Tt[1] * w * sx + N[1] * hh * sy, P[2] + Tt[2] * w * sx + N[2] * hh * sy);
              nor.push(Tt[0] * qx + N[0] * qy, Tt[1] * qx + N[1] * qy, Tt[2] * qx + N[2] * qy);
              uvs.push(tu + sx * 0.055, d * R.vScale);
            }
            if (j === 0 && R.discs) discs.push({ P, N, D: fr.D });
            if (j === 0 && R.discs && k < nRows - 1) { const fr2 = frame(f, u + R.sp / 2, d0 + 0.02); drips.push({ P: fr2.P, N: fr2.N, D: fr2.D, T: fr2.T }); }
          }
          for (let j = 0; j < ns; j++) for (let a = 0; a < 2; a++) {
            const p0 = base + j * 3 + a, p1 = p0 + 1, p2 = p0 + 3, p3 = p0 + 4;
            idx.push(p0, p1, p2, p1, p3, p2);
          }
        }
        if (pos.length) {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
          if (R.tileTint) tint(g, ...R.tileTint);
          b.add(R.tileKey, g);
        }
        if (discs.length) {
          const proto = discGeo(w * 1.12, 0.05); prep(proto);
          scaleUV(proto, 0.1, 0.1, 0.05, 0.9);
          const parts = [];
          const Y = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
          for (const dc of discs) {
            const g = proto.clone();
            dir.set(-dc.D[0], -dc.D[1], -dc.D[2]).normalize();
            _q.setFromUnitVectors(Y, dir);
            _m4.compose(_v.set(dc.P[0] + dc.N[0] * hh * 0.45, dc.P[1] + dc.N[1] * hh * 0.45, dc.P[2] + dc.N[2] * hh * 0.45), _q, _s.set(1, 1, 1));
            g.applyMatrix4(_m4);
            parts.push(g);
          }
          // drip tiles: small pointed lips hanging from the pan channels
          const dw = R.sp * 0.36, dh = R.sp * 0.36;
          const dp = [], di = [];
          for (const q of drips) {
            const O = norm3([-q.D[0], -q.D[1], -q.D[2]]), base = dp.length / 3;
            const c = [q.P[0] - q.N[0] * 0.02, q.P[1] - q.N[1] * 0.02, q.P[2] - q.N[2] * 0.02];
            const down = [-q.N[0] * dh + O[0] * 0.03, -q.N[1] * dh + O[1] * 0.03, -q.N[2] * dh + O[2] * 0.03];
            dp.push(c[0] - q.T[0] * dw, c[1] - q.T[1] * dw, c[2] - q.T[2] * dw, c[0] + q.T[0] * dw, c[1] + q.T[1] * dw, c[2] + q.T[2] * dw,
              c[0] + q.T[0] * dw * 0.45 + down[0] * 0.7, c[1] + q.T[1] * dw * 0.45 + down[1] * 0.7, c[2] + q.T[2] * dw * 0.45 + down[2] * 0.7,
              c[0] + down[0], c[1] + down[1], c[2] + down[2],
              c[0] - q.T[0] * dw * 0.45 + down[0] * 0.7, c[1] - q.T[1] * dw * 0.45 + down[1] * 0.7, c[2] - q.T[2] * dw * 0.45 + down[2] * 0.7);
            di.push(base, base + 4, base + 1, base + 1, base + 4, base + 2, base + 2, base + 4, base + 3);
            di.push(base, base + 1, base + 4, base + 1, base + 2, base + 4, base + 2, base + 3, base + 4);
          }
          if (dp.length) {
            const gd = new THREE.BufferGeometry(); gd.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); gd.setIndex(di); gd.computeVertexNormals();
            prep(gd); scaleUV(gd, 0, 0, 0.3, 0.9); parts.push(gd);
          }
          const g = mergeGeometries(parts, false); parts.forEach(p => p.dispose());
          tint(g, 0.8, 0.82, 0.8);
          if (R.tileTint) tint(g, ...R.tileTint);
          b.add(R.tileKey, g);
        }
      }
      // ---- fascia board (连檐) along the eave
      if (R.fascia) {
        const e0 = ext(f, 0), n = Math.max(4, Math.ceil(2 * e0 / 0.5)), pts = [];
        for (let i = 0; i <= n; i++) { const u = e0 * endWarp(2 * i / n - 1); pts.push(surf(f, u, 0)); }
        const g = sweep(pts, rectProf(-0.12, 0.0, -R.th - 0.05, -0.015), { uvs: 0.8 });
        if (R.underTint) tint(g, ...R.underTint);
        b.add(R.fasciaKey, g);
      }
      // ---- rafters (椽) under the eave
      if (R.rafters) {
        const e0 = f.half, lim = e0 - 0.55, n = Math.floor(2 * lim / R.rafterSp);
        const proto = rafterGeo(0.1, R.rafterLen);
        shade(proto, (x, y, z, nx, ny, nz) => (Math.abs(nz) > 0.9 ? [sl(0.26), sl(0.38), sl(0.42)] : [sl(0.36), sl(0.19), sl(0.14)]));
        const basis = new THREE.Matrix4();
        for (let i = 0; i <= n; i++) {
          const u = -lim + (2 * lim) * i / Math.max(1, n), d = 0.02 + R.rafterLen / 2;
          const fr = frame(f, u, d), X = new THREE.Vector3(...fr.T), Yv = new THREE.Vector3(...fr.N), Z = new THREE.Vector3().crossVectors(X, Yv).normalize();
          basis.makeBasis(X, Yv, Z);
          basis.setPosition(fr.P[0] - fr.N[0] * (R.th + 0.05), fr.P[1] - fr.N[1] * (R.th + 0.05) - 0.02, fr.P[2] - fr.N[2] * (R.th + 0.05));
          const g = proto.clone(); g.applyMatrix4(basis);
          b.add(R.rafterKey, g);
        }
      }
    }
    return rf;
  }

  // ridges ---------------------------------------------------------
  // seated ridge beast (走兽) silhouette, faces +Z, ~0.26*s tall
  const BEAST = {};
  function beastGeo(s) {
    const key = s.toFixed(3); if (BEAST[key]) return BEAST[key];
    const pr = [[-0.45, 0], [0.4, 0], [0.42, 0.18], [0.3, 0.3], [0.34, 0.62], [0.48, 0.72], [0.46, 0.88], [0.28, 0.98], [0.12, 0.9], [0.08, 0.62], [-0.12, 0.5], [-0.3, 0.52], [-0.45, 0.4]];
    const k = 0.26 * s;
    const g = extrudeXY(pr.map(p => [p[0] * k, p[1] * k]), 0.09 * s, 0.012 * s);
    g.rotateY(-PI / 2); prep(g); uvMap(g, (u, v) => [0.125 + u * 0.1, 0.4 + v * 0.1]);
    BEAST[key] = g; return g;
  }
  function chiwenGeo(hgt, thick) {
    const pts = [[-0.5, 0], [0.4, 0], [0.46, 0.25], [0.44, 0.55], [0.4, 0.85], [0.5, 1.1], [0.62, 1.3], [0.6, 1.44], [0.48, 1.5], [0.36, 1.44], [0.38, 1.34], [0.46, 1.33], [0.4, 1.18], [0.22, 1.1], [0.05, 1.12], [-0.05, 1.22], [-0.12, 1.08], [-0.22, 1.12], [-0.26, 0.98], [-0.3, 0.8], [-0.52, 0.72], [-0.62, 0.62], [-0.52, 0.52], [-0.3, 0.46], [-0.52, 0.3], [-0.58, 0.16]];
    const k = hgt / 1.5;
    const g = extrudeXY(pts.map(p => [p[0] * k, p[1] * k]), thick, thick * 0.12);
    const fin = box(0.07 * k, 0.4 * k, thick * 0.45); T(fin, 0.12 * k, 1.28 * k, 0, 0, 0, 0.35);
    prep(g); prep(fin);
    const out = mergeGeometries([g, fin], false); g.dispose(); fin.dispose();
    // sample a narrow barrel-tile strip so the ornament reads as one glazed casting
    const p = out.attributes.position, uv = out.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.125 + p.getX(i) * 0.02 + p.getZ(i) * 0.03, 0.3 + p.getY(i) * 0.08);
    return out;
  }
  const RIDGE_T = [0.62, 0.66, 0.64];
  // hip ridge from face f, side ±1, from dTop down to the corner with upturned tip
  function hipRidge(b, rf, f, side, dTop, o) {
    const n = Math.max(3, Math.ceil(dTop / 0.35)), pts = [];
    for (let i = 0; i <= n; i++) { const d = dTop * (1 - i / n); pts.push(rf.surf(f, side * Math.max(0, f.half - f.k * d), d)); }
    const tip = (dd, extra) => { const p = rf.surf(f, side * (f.half - f.k * dd), dd); p[1] += extra; return p; };
    const ts = o.tipS ?? 1;
    pts.push(tip(-0.22 * ts, o.curl * 0.4), tip(-0.42 * ts, o.curl * 1.3));
    const g = sweep(pts, ridgeProf(o.w, o.h), { uvs: 0.7 });
    tint(g, ...RIDGE_T);
    b.add(o.key || 'tile', g);
    // small ridge beasts near the lower end
    if (o.beasts) {
      const bg = beastGeo(o.beastS || 1);
      for (let i = 0; i < o.beasts; i++) {
        const d = 0.25 + i * (o.beastGap || 0.32);
        const p = rf.surf(f, side * (f.half - f.k * d), d), q = rf.surf(f, side * (f.half - f.k * (d + 0.1)), d + 0.1);
        const ang = Math.atan2(p[0] - q[0], p[2] - q[2]);
        const g2 = bg.clone(); T(g2, p[0], p[1] + o.h * 0.9, p[2], ang); tint(g2, 0.5, 0.55, 0.5);
        b.add(o.key || 'tile', g2);
      }
    }
  }
  // straight ridge along a polyline (main ridge, 围脊, 博脊)
  function lineRidge(b, pts, w, h, key = 'tile', band = true) {
    const g = sweep(pts, ridgeProf(w, h), { uvs: 0.7 }); tint(g, ...RIDGE_T); b.add(key, g);
    if (band) { const g2 = sweep(pts, rectProf(-w * 0.62, w * 0.62, -0.1, h * 0.22), { uvs: 0.7 }); tint(g2, 0.55, 0.58, 0.56); b.add(key, g2); }
  }
  function finialGeo(s) {
    return lathe([[0, 0], [0.34, 0], [0.36, 0.08], [0.24, 0.18], [0.3, 0.36], [0.26, 0.52], [0.14, 0.62], [0.18, 0.76], [0.08, 0.9], [0.1, 1.0], [0.04, 1.08], [0, 1.12]].map(p => [p[0] * s, p[1] * s]), 12);
  }

  // hip-and-gable (歇山) / hip (庑殿) roof with all ridges
  // ax, az: eave half extents; yCol: soffit height at column line; ov: overhang
  function hallRoof(b, o) {
    const ax = o.ax, az = o.az, D = az, H = o.pitch * az, th = o.th || 0.34;
    const y0 = o.soffit + th - H * prof(o.ov / D);
    const faces = rectFaces(ax, az);
    let gx = null, gext = null, dsk = null;
    if (o.type === 'xieshan') {
      dsk = o.ov + (o.skirtIn ?? 0.9); gx = ax - dsk; gext = gx + (o.og ?? 0.45);
      faces[0].gext = faces[2].gext = gext; faces[0].dmax = faces[2].dmax = az;
      faces[1].dmax = faces[3].dmax = dsk; faces[1].cutInset = faces[3].cutInset = 0.12;
    } else if (o.type === 'skirt') {
      for (const f of faces) { f.dmax = o.cut; f.cutInset = 0.1; }
    }
    const rf = roof(b, Object.assign({ faces, y0, D, H, th }, o.roof));
    const ridgeW = o.ridgeW || 0.34, ridgeH = o.ridgeH || 0.5;
    const hip = { w: ridgeW * 0.8, h: ridgeH * 0.6, curl: o.curl ?? 0.25, tipS: o.tipS ?? 1, beasts: o.beasts ?? 4, beastS: o.beastS ?? 1, beastGap: o.beastGap ?? 0.32, key: o.roof && o.roof.tileKey };
    const key = (o.roof && o.roof.tileKey) || 'tile';
    const yR = y0 + H;
    if (o.type === 'xieshan') {
      const dj = ax - gext; // where hip meets the gable edge
      for (const fi of [0, 2]) for (const side of [-1, 1]) {
        const f = faces[fi];
        hipRidge(b, rf, f, side, dj, hip);
        // 垂脊 along gable edge from ridge down to dj
        const pts = [], n = 8;
        for (let i = 0; i <= n; i++) { const d = lerp(az - 0.02, dj, i / n); pts.push(rf.surf(f, side * (gext - 0.1), d)); }
        const g = sweep(pts, ridgeProf(ridgeW * 0.85, ridgeH * 0.7), { uvs: 0.7 }); tint(g, ...RIDGE_T); b.add(key, g);
        const pb = rf.surf(f, side * (gext - 0.1), dj + 0.25); const bg = beastGeo((o.beastS || 1) * 1.5), g3 = bg.clone();
        T(g3, pb[0], pb[1] + ridgeH * 0.62, pb[2], fi === 0 ? 0 : PI); tint(g3, 0.5, 0.55, 0.5); b.add(key, g3);
      }
      // 山花 gable walls + 博风板 + 博脊
      for (const side of [-1, 1]) {
        const f = faces[0], zE = az - dsk, pts = [];
        const yb = rf.surf(faces[1], 0, dsk)[1] - 0.15;
        const n = 10;
        for (let i = 0; i <= n; i++) { const z = lerp(-zE, zE, i / n); pts.push([z, rf.surf(f, gx, az - Math.abs(z))[1] - th - 0.02]); }
        pts.push([zE, yb], [-zE, yb]);
        const shp = pts.map(p => [p[0], p[1]]);
        const g = extrudeZY(shp, 0.12); T(g, side > 0 ? gx - 0.12 : -gx, 0, 0);
        uvProj(g, 0.7); tint(g, 0.8, 0.72, 0.68); b.add('lacquer', g);
        // bargeboards on both slopes
        for (const fi of [0, 2]) {
          const ff = faces[fi], bp = [];
          for (let i = 0; i <= 10; i++) { const d = lerp(az, dj - 0.05, i / 10); bp.push(rf.surf(ff, (fi === 0 ? side : -side) * gext, d)); }
          const gb = sweep(bp, rectProf(-0.05, 0.05, -0.5, 0.06), { uvs: 0.7 });
          b.add('lacquer', gb);
        }
        // 博脊 along skirt top
        const fs = faces[side > 0 ? 1 : 3], e = rf.ext(fs, dsk - 0.05), bpp = [];
        for (let i = 0; i <= 6; i++) bpp.push(rf.surf(fs, lerp(-e, e, i / 6), dsk - 0.08));
        lineRidge(b, bpp, 0.26, 0.28, key, false);
      }
      // main ridge
      const n = 12, rp = [];
      for (let i = 0; i <= n; i++) { const x = lerp(-gext + 0.05, gext - 0.05, i / n), t = Math.abs(x) / gext; rp.push([x, yR + o.ridgeCurve * Math.pow(t, 4), 0]); }
      lineRidge(b, rp, ridgeW, ridgeH, key);
      if (o.chiwen !== false) {
        const cw = chiwenGeo(ridgeH * 2.6 * (o.chiwenS || 1), ridgeW * 0.9);
        for (const side of [-1, 1]) { const g = cw.clone(); T(g, side * (gext - 0.35), yR + o.ridgeCurve + ridgeH * 0.5, 0, side > 0 ? 0 : PI); tint(g, 0.4, 0.46, 0.42); b.add(key, g); }
      }
      return { rf, y0, H, yR, ridgeTop: yR + ridgeH, gx, gext, dsk, faces };
    }
    if (o.type === 'skirt') {
      for (const f of faces) for (const side of [-1, 1]) if (f === faces[0] || f === faces[2]) hipRidge(b, rf, f, side, o.cut - 0.05, hip);
      for (const f of faces) {
        const e = rf.ext(f, o.cut - 0.05), pts = [];
        for (let i = 0; i <= 8; i++) pts.push(rf.surf(f, lerp(-e - 0.1, e + 0.1, i / 8), o.cut - 0.06));
        lineRidge(b, pts, 0.3, 0.42, key, false);
      }
      return { rf, y0, H, yTop: rf.surf(faces[0], 0, o.cut)[1], faces };
    }
    // hip (庑殿)
    const rx = ax - az;
    for (const fi of [0, 2]) for (const side of [-1, 1]) hipRidge(b, rf, faces[fi], side, az - 0.02, hip);
    if (rx > 0.05) {
      const rp = []; for (let i = 0; i <= 8; i++) { const x = lerp(-rx - 0.1, rx + 0.1, i / 8); rp.push([x, yR + (o.ridgeCurve || 0) * Math.pow(Math.abs(x) / (rx + 0.1), 4), 0]); }
      lineRidge(b, rp, ridgeW, ridgeH, key);
      if (o.chiwen !== false) {
        const cw = chiwenGeo(ridgeH * 2.4 * (o.chiwenS || 1), ridgeW * 0.85);
        for (const side of [-1, 1]) { const g = cw.clone(); T(g, side * (rx - 0.05), yR + (o.ridgeCurve || 0) + ridgeH * 0.5, 0, side > 0 ? 0 : PI); tint(g, 0.4, 0.46, 0.42); b.add(key, g); }
      }
    }
    return { rf, y0, H, yR, ridgeTop: yR + ridgeH, faces };
  }

  // ------------------------------------------------------------ building parts
  const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => lerp(a, b, i / n));
  function column(b, x, z, y0, h, r, key = 'lacquer') {
    const g = cyl(r * 0.9, r, h, 14, true);
    scaleUV(g, 2 * PI * r * UVS.lacquer, h * UVS.lacquer, rnd(0, 5), rnd(0, 5));
    T(g, x, y0 + h / 2, z, rnd(0, TAU));
    shadeY(g, y0, y0 + 1.8, 0.6, 1);
    b.add(key, g);
    const base = lathe([[r * 1.64, 0], [r * 1.64, 0.06], [r * 1.45, 0.16], [r * 1.02, 0.26], [0, 0.26]], 10);
    T(base, x, y0 - 0.03, z); addP(b, 'stone', base, 0.15);
  }
  function beamBox(b, key, x0, z0, x1, z1, y, h, w, ext = 0) {
    const len = Math.hypot(x1 - x0, z1 - z0) + ext * 2, ang = Math.atan2(-(z1 - z0), x1 - x0);
    const g = box(len, h, w); T(g, (x0 + x1) / 2, y, (z0 + z1) / 2, ang);
    return b.add(key, g);
  }
  function perimeterCols(xs, zs) {
    const out = [], cx = xs[xs.length - 1], cz = zs[zs.length - 1];
    for (const x of xs) { out.push([x, cz], [x, -cz]); }
    for (let i = 1; i < zs.length - 1; i++) { out.push([cx, zs[i]], [-cx, zs[i]]); }
    return out;
  }
  // 额枋 + 平板枋 ring around the column grid
  function ringBeams(b, xs, zs, top, bh = 0.45) {
    const cx = xs[xs.length - 1], cz = zs[zs.length - 1];
    for (let i = 0; i < xs.length - 1; i++) for (const z of [cz, -cz]) beamBox(b, 'beam', xs[i], z, xs[i + 1], z, top - bh / 2, bh, 0.3);
    for (let i = 0; i < zs.length - 1; i++) for (const x of [cx, -cx]) beamBox(b, 'beam', x, zs[i], x, zs[i + 1], top - bh / 2, bh, 0.3);
    for (const z of [cz, -cz]) tintS(beamBox(b, 'painted', -cx - 0.3, z, cx + 0.3, z, top + 0.06, 0.12, 0.4), 0.32, 0.4, 0.42);
    for (const x of [cx, -cx]) tintS(beamBox(b, 'painted', x, -cz - 0.3, x, cz + 0.3, top + 0.06, 0.12, 0.4), 0.32, 0.4, 0.42);
  }
  // bracket set (斗拱) local: y=0 at 平板枋 top, +z outward, height ≈ 0.9*s at column line
  const BRK = {};
  function bracketGeo(s) {
    const key = s.toFixed(3); if (BRK[key]) return BRK[key];
    const parts = [];
    const DOU = [sl(0.3), sl(0.43), sl(0.45)], GONG = [sl(0.36), sl(0.46), sl(0.38)], ANG = [sl(0.28), sl(0.37), sl(0.47)];
    const add = (w, h, d, x, y, z, col, rx = 0) => { const g = box(w * s, h * s, d * s); T(g, x * s, y * s, z * s, 0, rx); uvProj(g, 0.8); tint(g, ...col); shadeY(g, 0, 0.9 * s, 0.55, 1); parts.push(g); };
    add(0.26, 0.08, 0.26, 0, 0.04, 0, DOU); add(0.36, 0.12, 0.36, 0, 0.14, 0, DOU);
    add(1.0, 0.15, 0.12, 0, 0.275, 0, GONG); add(0.12, 0.15, 0.8, 0, 0.275, 0.15, GONG);
    add(0.18, 0.08, 0.18, -0.42, 0.39, 0, DOU); add(0.18, 0.08, 0.18, 0.42, 0.39, 0, DOU); add(0.2, 0.08, 0.2, 0, 0.39, 0.48, DOU);
    add(1.4, 0.15, 0.12, 0, 0.505, 0, GONG); add(0.8, 0.12, 0.12, 0, 0.49, 0.48, GONG);
    add(0.12, 0.14, 1.12, 0, 0.58, 0.24, ANG, 0.17);
    const g = mergeGeometries(parts, false); parts.forEach(p => p.dispose());
    BRK[key] = g; return g;
  }
  function bracketRing(b, xs, zs, yB, hb, inter = 1) {
    const s = hb / 0.9, bg = bracketGeo(s), cx = xs[xs.length - 1], cz = zs[zs.length - 1];
    const place = (x, z, ry) => { const g = bg.clone(); T(g, x, yB, z, ry); b.add('painted', g); };
    const run = (arr, fn) => {
      for (let i = 0; i < arr.length; i++) {
        if (i > 0 && i < arr.length - 1) fn(arr[i]);
        if (i < arr.length - 1) for (let k = 1; k <= inter; k++) fn(lerp(arr[i], arr[i + 1], k / (inter + 1)));
      }
    };
    run(xs, x => { place(x, cz, 0); place(x, -cz, PI); });
    run(zs, z => { place(cx, z, PI / 2); place(-cx, z, -PI / 2); });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) place(sx * cx, sz * cz, Math.atan2(sx, sz));
    // continuous members: 正心枋, 挑檐枋, 栱眼壁
    const DK = [sl(0.4), sl(0.17), sl(0.12)], BL = [sl(0.3), sl(0.4), sl(0.44)];
    const side = (x0, z0, x1, z1, ox, oz) => {
      tint(beamBox(b, 'painted', x0, z0, x1, z1, yB + 0.74 * s, 0.32 * s, 0.14 * s, 0.1), ...BL);
      tint(beamBox(b, 'painted', x0 + ox * 0.48 * s, z0 + oz * 0.48 * s, x1 + ox * 0.48 * s, z1 + oz * 0.48 * s, yB + 0.6 * s, 0.1 * s, 0.12 * s, 0.35), ...BL);
      tint(beamBox(b, 'painted', x0 - ox * 0.03, z0 - oz * 0.03, x1 - ox * 0.03, z1 - oz * 0.03, yB + 0.39 * s, 0.4 * s, 0.05, 0), ...DK);
    };
    side(-cx, cz, cx, cz, 0, 1); side(-cx, -cz, cx, -cz, 0, -1); side(cx, -cz, cx, cz, 1, 0); side(-cx, -cz, -cx, cz, -1, 0);
  }
  function wallSeg(b, x0, z0, x1, z1, yb, yt, t, skirt = 0.95) {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0), xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
    const sk = Math.min(skirt, (yt - yb) * 0.4);
    const g1 = box(len, sk, t + 0.08); uvProj(g1, UVS.ashlar, rnd(0, 5), 0); T(g1, xc, yb + sk / 2, zc, ang); jitter(g1, 0.08); b.add('ashlar', g1);
    const g2 = box(len, yt - yb - sk, t); uvProj(g2, UVS.plaster, rnd(0, 5), 0.1); T(g2, xc, yb + sk + (yt - yb - sk) / 2, zc, ang);
    shade(g2, (x, y) => lerp(0.8, 1, smooth(yb + sk, yb + sk + 1.2, y)) * lerp(1, 0.78, smooth(yt - 0.6, yt, y)));
    b.add('plaster', g2);
  }
  // 格扇 door bay between two columns on a facade at z (facing +z)
  function doorBay(b, x0, x1, z, y0, yt, r, kind = 'D', face = 1) {
    const in0 = x0 + r * 0.95, in1 = x1 - r * 0.95, w = in1 - in0, xc = (x0 + x1) / 2;
    const trH = Math.min(0.85, (yt - y0) * 0.16), thr = 0.2;
    const q = (g) => { T(g, 0, 0, 0, face > 0 ? 0 : PI); return g; };
    const place = (g, x, y, zz) => { T(g, x, y, zz); return q(g); };
    const zz = z * face;
    let bottom = y0 + thr;
    const lw = w / 4;
    tintS(b.add('lacquer', uvProj(place(box(w + 0.1, thr, 0.24), xc * face, y0 + thr / 2, zz), 0.7)), 0.8, 0.8, 0.8);
    if (kind === 'W') {
      const sill = 0.95;
      addP(b, 'ashlar', place(box(w + 0.1, sill - thr, 0.36), xc * face, y0 + thr + (sill - thr) / 2, zz), 0.05);
      b.add('lacquer', uvProj(place(box(w + 0.1, 0.12, 0.26), xc * face, y0 + sill + 0.06, zz), 0.7));
      bottom = y0 + sill + 0.12;
    }
    const doorTop = yt - trH - 0.14, lh = doorTop - bottom;
    b.add('lacquer', uvProj(place(box(w + 0.1, 0.14, 0.22), xc * face, doorTop + 0.07, zz), 0.7));
    for (let i = 0; i < 4; i++) {
      const g = box(lw - 0.03, lh, 0.08);
      if (kind === 'W') uvMap(g, (u, v) => [u, 0.4 + v * 0.58]);
      b.add('door', place(g, (in0 + lw * (i + 0.5)) * face, bottom + lh / 2, zz - 0.02));
    }
    const tr = box(w, trH, 0.07); uvMap(tr, (u, v) => [u * 4, 0.62 + v * 0.3]);
    b.add('door', place(tr, xc * face, doorTop + 0.14 + trH / 2, zz - 0.02));
    for (const s of [-1, 1]) b.add('lacquer', uvProj(place(box(0.1, yt - y0, 0.2), (xc + s * (w / 2 + 0.02)) * face, (y0 + yt) / 2, zz), 0.7));
  }
  function hangLantern(b, res, x, yTop, z, s = 1, drop = 0.5) {
    const rope = cyl(0.012, 0.012, drop, 4); T(rope, x, yTop - drop / 2, z); tintS(rope, 0.2, 0.15, 0.1); b.add('painted', rope);
    const yc = yTop - drop - 0.42 * s;
    const body = new THREE.SphereGeometry(0.34 * s, 14, 10); T(body, x, yc, z, 0, 0, 0, 1, 1.25, 1); b.add('lantern', body);
    for (const sy of [1, -1]) { const cap = cyl(0.17 * s, 0.19 * s, 0.1 * s, 10); T(cap, x, yc + sy * 0.4 * s, z); tintS(cap, 0.18, 0.12, 0.08); b.add('painted', cap); }
    const tas = cyl(0.03 * s, 0.05 * s, 0.35 * s, 6); T(tas, x, yc - 0.62 * s, z); tintS(tas, 0.55, 0.12, 0.08); b.add('painted', tas);
    res.lights.push({ pos: new THREE.Vector3(x, yc, z), color: new THREE.Color(1.0, 0.42, 0.22), intensity: 1.6, distance: 7 });
  }
  function plaqueAt(b, text, w, h, x, y, z, tilt = 0.12, ry = 0) {
    const g = box(w, h, 0.12);
    uvMap(g, (u, v) => [u, v]);
    T(g, x, y, z, ry, tilt);
    b.add('plaque:' + text, g);
  }
  // stone steps (flight): first step front edge at zFront, ascending towards -Z
  function flight(b, res, o) {
    const { w, n, rise, run } = o, zf = o.zFront, y0 = o.y0 || 0, yb = o.bottom ?? -0.3;
    for (let i = 0; i < n; i++) {
      const yTop = y0 + (i + 1) * rise, zF = zf - i * run, zB = zf - (i + 1) * run - (i < n - 1 ? 0.02 : 0);
      const g = box(w, yTop - yb, zF - zB); T(g, o.x || 0, (yTop + yb) / 2, (zF + zB) / 2);
      uvProj(g, 0.55, rnd(0, 5), rnd(0, 5)); jitter(g, 0.14);
      shade(g, (x, y, z, nx, ny) => (ny > 0.9 ? 1.06 : 0.92));
      b.add('stone', g);
    }
    const L = n * run, Ht = n * rise, x0 = o.x || 0;
    for (const s of [-1, 1]) {
      if (o.sides === 'wall') {
        const t = o.sideT || 0.36, hr = o.railH || 0.85;
        const g = extrudeZY([[zf + 0.12, yb], [zf + 0.12, y0 + rise + hr], [zf - L, y0 + Ht + hr], [zf - L, yb]], t);
        T(g, x0 + s * (w / 2 + t / 2) - t / 2, 0, 0); uvProj(g, UVS.ashlar, rnd(0, 5), 0); b.add('ashlar', g);
        const cp = sweep([[x0 + s * (w / 2 + t / 2), y0 + rise + hr, zf + 0.12], [x0 + s * (w / 2 + t / 2), y0 + Ht + hr, zf - L]], rectProf(-t / 2 - 0.05, t / 2 + 0.05, 0, 0.12), { uvs: 0.5 });
        jitter(cp, 0.1); b.add('stone', cp);
        for (const [pz, py] of [[zf + 0.02, y0 + rise], [zf - L + 0.1, y0 + Ht]]) {
          const p = box(t + 0.14, hr + 0.55, t + 0.14); T(p, x0 + s * (w / 2 + t / 2), py + (hr + 0.55) / 2 - 0.05, pz); addP(b, 'stone', p, 0.1);
          const c = new THREE.SphereGeometry(0.15, 8, 6); T(c, x0 + s * (w / 2 + t / 2), py + hr + 0.62, pz, 0, 0, 0, 1, 1.3, 1); addP(b, 'stone', c, 0.1);
        }
        res.colliders.push(boxC(x0 + s * (w / 2 + t / 2), zf - L / 2, t / 2 + 0.08, L / 2 + 0.15));
      } else {
        const t = o.sideT || 0.45;
        const g = extrudeZY([[zf + 0.1, yb], [zf + 0.1, y0 + rise * 0.5 + 0.12], [zf - L, y0 + Ht + 0.12], [zf - L, yb]], t);
        T(g, x0 + s * (w / 2 + t / 2) - t / 2, 0, 0); uvProj(g, UVS.stone, rnd(0, 5), 0); jitter(g, 0.1); b.add('stone', g);
      }
    }
  }
  // stone terrace (台基) with cap stones and paving
  function terrace(b, hx, hz, h) {
    const core = box(2 * hx - 0.08, h - 0.2, 2 * hz - 0.08); T(core, 0, (h - 0.2) / 2 + 0.02, 0); uvProj(core, UVS.ashlar, 0.3, 0.1); b.add('ashlar', core);
    const pl = box(2 * hx + 0.14, 0.24, 2 * hz + 0.14); T(pl, 0, 0.06, 0); addP(b, 'stone', pl, 0.05);
    const capW = 0.5, ch = 0.2;
    for (const s of [-1, 1]) {
      let x = -hx;
      while (x < hx - 0.01) { const l = Math.min(hx - x, rnd(1.2, 2.2)); const g = box(l - 0.01, ch, capW); T(g, x + l / 2, h - ch / 2, s * (hz - capW / 2 + 0.04)); addP(b, 'stone', g, 0.16); x += l; }
      let z = -hz + capW;
      while (z < hz - capW - 0.01) { const l = Math.min(hz - capW - z, rnd(1.2, 2.2)); const g = box(capW, ch, l - 0.01); T(g, s * (hx - capW / 2 + 0.04), h - ch / 2, z + l / 2); addP(b, 'stone', g, 0.16); z += l; }
    }
    const top = new THREE.PlaneGeometry(2 * hx - 2 * capW + 0.1, 2 * hz - 2 * capW + 0.1); top.rotateX(-PI / 2); T(top, 0, h - 0.012, 0);
    uvProj(top, UVS.flag, 0.2, 0.4); b.add('flag', top);
  }
  function balustrade(b, pts, h = 1.0, y0 = 0) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, z0] = pts[k], [x1, z1] = pts[k + 1], len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0);
      const n = Math.max(1, Math.round(len / 1.8));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t);
        if (k > 0 && i === 0) continue;
        const p = box(0.2, h, 0.2); T(p, x, y0 + h / 2, z, ang); addP(b, 'stone', p, 0.12);
        const c = lathe([[0.1, 0], [0.12, 0.06], [0.09, 0.14], [0.1, 0.22], [0.05, 0.3], [0, 0.32]], 6); T(c, x, y0 + h, z); addP(b, 'stone', c, 0.1);
        if (i < n) {
          const xm = lerp(x0, x1, (i + 0.5) / n), zm = lerp(z0, z1, (i + 0.5) / n), seg = len / n - 0.2;
          const pan = box(seg, h * 0.55, 0.09); T(pan, xm, y0 + h * 0.3, zm, ang); addP(b, 'stone', pan, 0.12);
          const rail = box(seg, 0.1, 0.12); T(rail, xm, y0 + h * 0.84, zm, ang); addP(b, 'stone', rail, 0.1);
          for (const f of [0.3, 0.7]) { const v = box(0.08, h * 0.26, 0.08); T(v, lerp(x0, x1, (i + f) / n), y0 + h * 0.7, lerp(z0, z1, (i + f) / n), ang); addP(b, 'stone', v, 0.1); }
        }
      }
    }
  }

  // ======================================================================
  // 1. 土地庙 keeper shrine
  // ======================================================================
  function buildKeeperShrine() {
    seeded(hashStr('keeper'));
    const b = new Batch(), res = newRes();
    const pw = 2.6, pd = 2.0, ph = 0.45; // plinth
    const pl = box(pw, ph, pd); T(pl, 0, ph / 2, -0.25); uvProj(pl, UVS.stone, 0.2, 0.3); b.add('stone', pl);
    const pc = box(pw + 0.1, 0.1, pd + 0.1); T(pc, 0, ph - 0.03, -0.25); addP(b, 'stone', pc, 0.1);
    const st = box(1.4, 0.2, 0.45); T(st, 0, 0.1, 0.95); addP(b, 'stone', st, 0.12);
    // body: brick walls, open front niche
    const bw = 1.9, bd = 1.35, bh = 1.38, y0 = ph, zc = -0.35, t = 0.24;
    const back = box(bw, bh, t); T(back, 0, y0 + bh / 2, zc - bd / 2 + t / 2); addP(b, 'brick', back, 0.05);
    for (const s of [-1, 1]) { const sw = box(t, bh, bd); T(sw, s * (bw / 2 - t / 2), y0 + bh / 2, zc); addP(b, 'brick', sw, 0.05); }
    // front pillars + lintel
    for (const s of [-1, 1]) { const p = box(0.26, bh, 0.26); T(p, s * (bw / 2 - 0.13), y0 + bh / 2, zc + bd / 2 - 0.1); addP(b, 'stone', p, 0.1); }
    const li = box(bw + 0.1, 0.24, 0.3); T(li, 0, y0 + bh + 0.12, zc + bd / 2 - 0.1); addP(b, 'stone', li, 0.1);
    const tb = box(bw + 0.14, 0.12, bd + 0.1); T(tb, 0, y0 + bh + 0.3, zc); addP(b, 'stone', tb, 0.05);
    // sign plaque + couplets (atlas)
    const sg = box(0.9, 0.28, 0.05); uvMap(sg, (u, v) => [u, 0.6875 + v * 0.3125]); T(sg, 0, y0 + bh + 0.13, zc + bd / 2 + 0.07); b.add('shrineSign', sg);
    for (const s of [-1, 1]) {
      const cp = box(0.17, 1.02, 0.02); const u0 = s < 0 ? 0 : 0.5;
      uvMap(cp, (u, v) => [u0 + u * 0.5, v * 0.6875]);
      T(cp, s * (bw / 2 - 0.13), y0 + 0.8, zc + bd / 2 + 0.035); b.add('shrineSign', cp);
    }
    // altar + statue of 土地公
    const al = box(1.3, 0.34, 0.6); T(al, 0, y0 + 0.17, zc - 0.2); addP(b, 'stone', al, 0.1);
    const ya = y0 + 0.34, sz = zc - 0.25;
    const P = (g, col) => { tintS(g, ...col); b.add('painted', g); };
    const robe = [0.46, 0.24, 0.18], face = [0.66, 0.52, 0.38], beard = [0.8, 0.79, 0.75], hat = [0.2, 0.17, 0.14], gold = [0.55, 0.45, 0.25];
    P(T(lathe([[0, 0], [0.3, 0], [0.31, 0.12], [0.26, 0.3], [0.22, 0.5], [0.16, 0.6], [0, 0.63]], 14), 0, ya, sz, 0, 0, 0, 1, 1, 0.8), robe);
    P(T(new THREE.CapsuleGeometry(0.1, 0.36, 4, 8), 0, ya + 0.14, sz + 0.14, 0, 0, PI / 2, 1, 1, 1.2), robe);
    P(T(new THREE.SphereGeometry(0.115, 12, 10), 0, ya + 0.74, sz, 0, 0, 0, 1, 1.08, 1), face);
    P(T(new THREE.ConeGeometry(0.085, 0.3, 8), 0, ya + 0.56, sz + 0.07, 0, PI, 0), beard);
    P(T(new THREE.SphereGeometry(0.045, 8, 6), -0.05, ya + 0.695, sz + 0.09, 0, 0, 0.5, 1.4, 0.5, 0.6), beard);
    P(T(new THREE.SphereGeometry(0.045, 8, 6), 0.05, ya + 0.695, sz + 0.09, 0, 0, -0.5, 1.4, 0.5, 0.6), beard);
    P(T(new THREE.SphereGeometry(0.03, 6, 5), -0.045, ya + 0.765, sz + 0.1, 0, 0, 0, 1.2, 0.5, 0.5), [0.12, 0.1, 0.08]);
    P(T(new THREE.SphereGeometry(0.03, 6, 5), 0.045, ya + 0.765, sz + 0.1, 0, 0, 0, 1.2, 0.5, 0.5), [0.12, 0.1, 0.08]);
    P(T(cyl(0.1, 0.12, 0.12, 10), 0, ya + 0.87, sz), hat);
    P(T(box(0.34, 0.03, 0.06), 0, ya + 0.9, sz - 0.03), hat);
    for (const s of [-1, 1]) P(T(new THREE.CapsuleGeometry(0.06, 0.2, 3, 6), s * 0.19, ya + 0.4, sz + 0.08, 0, -0.9, s * 0.35), robe);
    P(T(new THREE.SphereGeometry(0.06, 8, 6), 0.1, ya + 0.3, sz + 0.2), face);
    P(T(cyl(0.018, 0.018, 0.9, 5), 0.24, ya + 0.35, sz + 0.14, 0, 0, -0.08), [0.3, 0.2, 0.12]);
    P(T(new THREE.SphereGeometry(0.04, 6, 5), 0.27, ya + 0.8, sz + 0.14), gold);
    // red offering cloth draped over altar front
    const cl = new THREE.PlaneGeometry(1.05, 0.34, 8, 3);
    { const p = cl.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.015 + (0.17 - p.getY(i)) * 0.05); cl.computeVertexNormals(); }
    T(cl, 0, ya - 0.16, zc + 0.105); P(cl, [0.5, 0.13, 0.09]);
    const cl2 = box(1.1, 0.012, 0.4); T(cl2, 0, ya + 0.006, zc - 0.07); P(cl2, [0.5, 0.13, 0.09]);
    // candles on the altar
    for (const s of [-1, 1]) {
      const cx = s * 0.47, cz = zc - 0.05;
      P(T(cyl(0.05, 0.06, 0.03, 8), cx, ya + 0.02, cz), [0.35, 0.28, 0.16]);
      P(T(cyl(0.028, 0.03, 0.2, 8), cx, ya + 0.13, cz), [0.78, 0.2, 0.12]);
      const fl = new THREE.ConeGeometry(0.018, 0.06, 6); T(fl, cx, ya + 0.27, cz); b.add('glow', fl);
      res.fires.push({ pos: new THREE.Vector3(cx, ya + 0.27, cz), scale: 0.18 });
    }
    // roof (small hip roof)
    const ov = 0.42, ax = bw / 2 + ov, az = bd / 2 + ov;
    hallRoof(b, { type: 'hip', ax, az, pitch: 0.85, ov, soffit: y0 + bh + 0.36, th: 0.16, ridgeW: 0.18, ridgeH: 0.2, curl: 0.06, tipS: 0.3, beasts: 0, ridgeCurve: 0.04, chiwenS: 0.5,
      roof: { L: 0.22, lam: 0.4, lamD: 0.35, L2: 0.05, lam2: 1.2, lamD2: 0.6, F: 0.05, sp: 0.2, gridU: 0.2, gridD: 0.2, rowSeg: 0.4, rafters: false, underKey: 'painted', fasciaKey: 'painted', underTint: [sl(0.3), sl(0.2), sl(0.14)] } });
    // bronze incense pot in front, on a stone block
    const pz = 1.5;
    const blk = box(0.6, 0.55, 0.5); T(blk, 0, 0.275, pz); addP(b, 'stone', blk, 0.1);
    const pot = lathe([[0, 0.02], [0.14, 0.0], [0.24, 0.07], [0.27, 0.17], [0.24, 0.27], [0.25, 0.3], [0.21, 0.3], [0.2, 0.26], [0, 0.24]], 16);
    T(pot, 0, 0.62, pz); b.add('bronze', uvProj(pot, 1));
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + PI / 2; const lg = cyl(0.025, 0.018, 0.1, 6); T(lg, Math.cos(a) * 0.14, 0.6, pz + Math.sin(a) * 0.14); b.add('bronze', uvProj(lg, 1)); }
    for (const s of [-1, 1]) { const ear = new THREE.TorusGeometry(0.05, 0.014, 5, 10); T(ear, s * 0.24, 0.96, pz, PI / 2); b.add('bronze', uvProj(ear, 1)); }
    const ash = cyl(0.2, 0.2, 0.02, 12); T(ash, 0, 0.87, pz); tintS(ash, 0.55, 0.53, 0.5); b.add('painted', ash);
    for (let k = 0; k < 3; k++) {
      const x = (k - 1) * 0.06, lean = (k - 1) * 0.08, len = 0.32;
      const s = cyl(0.006, 0.006, len, 4); T(s, x + Math.sin(lean) * len / 2, 0.88 + len / 2, pz, 0, 0, -lean); tintS(s, 0.5, 0.2, 0.12); b.add('painted', s);
      const tip = new THREE.SphereGeometry(0.009, 5, 4); const tx = x + Math.sin(lean) * len, ty = 0.88 + Math.cos(lean) * len; T(tip, tx, ty, pz); b.add('glow', tip);
      res.fires.push({ pos: new THREE.Vector3(tx, ty, pz), scale: 0.15 });
    }
    res.smoke.push({ pos: new THREE.Vector3(0, 1.25, pz) });
    // two small stone lanterns
    for (const s of [-1, 1]) {
      const x = s * 1.25, z = 1.2;
      const g1 = box(0.3, 0.12, 0.3); T(g1, x, 0.06, z); addP(b, 'stone', g1);
      const g2 = box(0.13, 0.4, 0.13); T(g2, x, 0.32, z); addP(b, 'stone', g2);
      const g3 = box(0.3, 0.07, 0.3); T(g3, x, 0.555, z); addP(b, 'stone', g3);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = box(0.05, 0.2, 0.05); T(p, x + dx * 0.1, 0.69, z + dz * 0.1); addP(b, 'stone', p); }
      const core = box(0.12, 0.14, 0.12); T(core, x, 0.69, z); b.add('glow', core);
      const rf2 = new THREE.ConeGeometry(0.26, 0.16, 4, 1); T(rf2, x, 0.87, z, PI / 4); addP(b, 'stone', rf2);
      const kn = new THREE.SphereGeometry(0.05, 8, 6); T(kn, x, 0.98, z); addP(b, 'stone', kn);
      res.fires.push({ pos: new THREE.Vector3(x, 0.69, z), scale: 0.2 });
      res.colliders.push(circleC(x, z, 0.22));
    }
    res.lights.push({ pos: new THREE.Vector3(0, y0 + 0.9, zc + 0.5), color: WARM(), intensity: 1.6, distance: 6 });
    res.lights.push({ pos: new THREE.Vector3(0, 1.1, pz), color: new THREE.Color(1.0, 0.5, 0.25), intensity: 0.6, distance: 3 });
    res.colliders.push(boxC(0, -0.25, pw / 2 + 0.05, pd / 2 + 0.05), circleC(0, pz, 0.36));
    res.interact = { pos: new THREE.Vector3(0, 0, 2.2) };
    return finish(b, res, 'KeeperShrine');
  }

  // ======================================================================
  // 2. 大殿 main hall (重檐歇山)
  // ======================================================================
  function buildTempleHall({ width = 22, depth = 14, plaque = '观音禅院' } = {}) {
    seeded(hashStr('hall' + width + 'x' + depth));
    const b = new Batch(), res = newRes();
    const hx = width / 2, hz = depth / 2, tH = 1.3;
    terrace(b, hx, hz, tH);
    const stairW = Math.min(6.4, width * 0.3), nSt = 8, rise = tH / nSt, run = 0.34;
    flight(b, res, { w: stairW, n: nSt, rise, run, zFront: hz + nSt * run, sides: 'band', bottom: -0.3 });
    const bi = 0.3, bh = 0.95;
    balustrade(b, [[-stairW / 2 - 0.25, hz - bi], [-hx + bi, hz - bi], [-hx + bi, -hz + bi], [hx - bi, -hz + bi], [hx - bi, hz - bi], [stairW / 2 + 0.25, hz - bi]], bh, tH);
    // lower storey
    const cx = hx - 1.5, cz = hz - 1.5, nbx = width >= 17 ? 5 : 3, nbz = 3, colR = 0.3, colH = 4.4, y0 = tH, top = y0 + colH;
    const xs = lin(-cx, cx, nbx), zs = lin(-cz, cz, nbz);
    for (const [x, z] of perimeterCols(xs, zs)) column(b, x, z, y0, colH, colR);
    ringBeams(b, xs, zs, top, 0.45);
    const yw = top - 0.45;
    for (let i = 0; i < nbx; i++) {
      const kind = (i === 0 || i === nbx - 1) ? 'W' : 'D';
      doorBay(b, xs[i], xs[i + 1], cz, y0, yw, colR, kind, 1);
      wallSeg(b, xs[i] + colR * 0.7, -cz, xs[i + 1] - colR * 0.7, -cz, y0, yw, 0.38);
    }
    for (let i = 0; i < nbz; i++) for (const s of [-1, 1]) wallSeg(b, s * cx, zs[i] + colR * 0.7, s * cx, zs[i + 1] - colR * 0.7, y0, yw, 0.38);
    const hb1 = 0.95, yB1 = top + 0.12;
    bracketRing(b, xs, zs, yB1, hb1, 1);
    // lower skirt eave (下檐)
    const ov1 = 2.4, inset = Math.min(2.3, cz * 0.42), dc = ov1 + inset;
    const lower = hallRoof(b, { type: 'skirt', ax: cx + ov1, az: cz + ov1, pitch: 0.62, ov: ov1, cut: dc, soffit: yB1 + hb1, th: 0.34, curl: 0.3, beasts: 4, beastS: 0.9,
      roof: { L: 1.05, lam: 2.0, lamD: 1.2, L2: 0.22, lam2: 6, lamD2: 3, F: 0.55, sp: 0.36, rowSeg: 0.8, gridU: 0.75, gridD: 0.6 } });
    const yJ = lower.yTop;
    // upper storey
    const ux = cx - inset, uz = cz - inset;
    const uxs = lin(-ux, ux, nbx >= 5 ? 3 : 2), uzs = lin(-uz, uz, 2), uTop = yJ + 1.6, uBase = yJ - 0.8;
    for (const [x, z] of perimeterCols(uxs, uzs)) column(b, x, z, uBase, uTop - uBase, colR * 0.9);
    ringBeams(b, uxs, uzs, uTop, 0.42);
    for (let i = 0; i < uxs.length - 1; i++) for (const s of [-1, 1]) {
      const g = box(uxs[i + 1] - uxs[i] - 0.4, uTop - 0.42 - uBase, 0.2); T(g, (uxs[i] + uxs[i + 1]) / 2, (uTop - 0.42 + uBase) / 2, s * uz); uvProj(g, 0.7, rnd(0, 4)); tint(g, 0.85, 0.8, 0.8); b.add('lacquer', g);
    }
    for (let i = 0; i < uzs.length - 1; i++) for (const s of [-1, 1]) {
      const g = box(0.2, uTop - 0.42 - uBase, uzs[i + 1] - uzs[i] - 0.4); T(g, s * ux, (uTop - 0.42 + uBase) / 2, (uzs[i] + uzs[i + 1]) / 2); uvProj(g, 0.7, rnd(0, 4)); tint(g, 0.85, 0.8, 0.8); b.add('lacquer', g);
    }
    const hb2 = 0.85, yB2 = uTop + 0.12;
    bracketRing(b, uxs, uzs, yB2, hb2, 2);
    const ov2 = 2.2;
    hallRoof(b, { type: 'xieshan', ax: ux + ov2, az: uz + ov2, pitch: 0.64, ov: ov2, soffit: yB2 + hb2, th: 0.36, skirtIn: 1.0, og: 0.5,
      ridgeW: 0.42, ridgeH: 0.78, ridgeCurve: 0.25, chiwenS: 0.85, curl: 0.32, beasts: 5, beastS: 1.0,
      roof: { L: 1.0, lam: 1.9, lamD: 1.1, L2: 0.2, lam2: 5, lamD2: 2.5, F: 0.5, sp: 0.36, rowSeg: 0.85, gridU: 0.75, gridD: 0.6 } });
    plaqueAt(b, plaque, 3.3, 1.24, 0, (yJ + 0.35 + uTop - 0.2) / 2 + 0.1, uz + 0.32, 0.14);
    // lanterns under front eave
    const lx = nbx >= 5 ? xs[Math.floor(nbx / 2) + 1] : (xs[1] - xs[0]) * 0.5;
    for (const s of [-1, 1]) hangLantern(b, res, s * lx, yB1 + 0.1, cz + 0.9, 1.0, 0.6);
    res.colliders.push(boxC(0, 0, hx, hz));
    return finish(b, res, 'TempleHall');
  }

  // ======================================================================
  // 3. side hall (单檐歇山)
  // ======================================================================
  function buildSideHall({ width = 12, depth = 8, plaque = null } = {}) {
    seeded(hashStr('side' + width + 'x' + depth));
    const b = new Batch(), res = newRes();
    const hx = width / 2, hz = depth / 2, tH = 0.6;
    terrace(b, hx, hz, tH);
    const stairW = Math.min(3.6, width * 0.3), nSt = 3;
    flight(b, res, { w: stairW, n: nSt, rise: tH / nSt, run: 0.34, zFront: hz + nSt * 0.34, sides: 'band', bottom: -0.3 });
    const cx = hx - 1.15, cz = hz - 1.15, nbx = width >= 10 ? 3 : 1, nbz = 2, colR = 0.24, colH = 3.6, y0 = tH, top = y0 + colH;
    const xs = lin(-cx, cx, nbx), zs = lin(-cz, cz, nbz);
    for (const [x, z] of perimeterCols(xs, zs)) column(b, x, z, y0, colH, colR);
    ringBeams(b, xs, zs, top, 0.38);
    const yw = top - 0.38;
    for (let i = 0; i < nbx; i++) {
      const kind = (nbx >= 3 && (i === 0 || i === nbx - 1)) ? 'W' : 'D';
      doorBay(b, xs[i], xs[i + 1], cz, y0, yw, colR, kind, 1);
      wallSeg(b, xs[i] + colR * 0.7, -cz, xs[i + 1] - colR * 0.7, -cz, y0, yw, 0.34);
    }
    for (let i = 0; i < nbz; i++) for (const s of [-1, 1]) wallSeg(b, s * cx, zs[i] + colR * 0.7, s * cx, zs[i + 1] - colR * 0.7, y0, yw, 0.34);
    const hb = 0.72, yB = top + 0.12;
    bracketRing(b, xs, zs, yB, hb, 1);
    const ov = 1.8;
    hallRoof(b, { type: 'xieshan', ax: cx + ov, az: cz + ov, pitch: 0.64, ov, soffit: yB + hb, th: 0.3, skirtIn: 0.8, og: 0.4,
      ridgeW: 0.34, ridgeH: 0.62, ridgeCurve: 0.15, curl: 0.25, beasts: 3, beastS: 1,
      roof: { L: 0.78, lam: 1.5, lamD: 0.95, L2: 0.14, lam2: 4, lamD2: 2, F: 0.4, sp: 0.32, rowSeg: 0.75 } });
    if (plaque) plaqueAt(b, plaque, 2.0, 0.76, 0, top + 0.05, cz + 0.28, 0.14);
    hangLantern(b, res, 0, yB, cz + 0.75, 0.8, 0.45);
    res.lights.length = 0;
    res.lights.push({ pos: new THREE.Vector3(0, yB - 0.9, cz + 0.75), color: new THREE.Color(1.0, 0.42, 0.22), intensity: 1.3, distance: 6 });
    res.colliders.push(boxC(0, 0, hx, hz));
    return finish(b, res, 'SideHall');
  }

  // ======================================================================
  // 4. 山门 temple gate
  // ======================================================================
  function buildTempleGate({ width = 16, plaque = '观音禅院' } = {}) {
    seeded(hashStr('gate' + width));
    const b = new Batch(), res = newRes();
    const hw = width / 2, cz = 3.1, baseH = 0.06;
    // low paving
    const pv = box(width + 0.4, baseH, 2 * cz + 1.2); T(pv, 0, baseH / 2 - 0.02, 0); uvProj(pv, UVS.flag, 0.1, 0.2); b.add('flag', pv);
    const colH = 6.2, colR = 0.3, top = baseH + colH;
    const cxO = hw - 0.45, cxI = Math.max(2.5, width * 0.16);
    const xs = [-cxO, -cxI, cxI, cxO], zs = [-cz, cz];
    for (const x of xs) for (const z of zs) column(b, x, z, baseH, colH, colR);
    ringBeams(b, xs, zs, top, 0.45);
    // central wall with three arched doorways
    const wallH = top - 0.45 - baseH, wt = 1.0;
    const cw = 4.0, cs = 2.3, sw = 2.3, ss = 2.0, sx = (cxI + cxO) / 2 + 0.1;
    const doors = [[-sx, sw, ss], [0, cw, cs], [sx, sw, ss]];
    const outline = [[-cxO, 0], [-cxO, wallH], [cxO, wallH], [cxO, 0]];
    for (let k = doors.length - 1; k >= 0; k--) {
      const [dx, dw, spr] = doors[k], r = dw / 2;
      outline.push([dx + r, 0], [dx + r, spr]);
      for (let i = 1; i < 16; i++) { const a = PI * i / 16; outline.push([dx + Math.cos(a) * r, spr + Math.sin(a) * r]); }
      outline.push([dx - r, spr], [dx - r, 0]);
    }
    const wall = extrudeXY(outline, wt); T(wall, 0, baseH, 0); scaleUV(wall, UVS.plaster, UVS.plaster);
    shade(wall, (x, y) => lerp(0.8, 1, smooth(baseH, 1.4, y)) * lerp(1, 0.8, smooth(top - 1.2, top - 0.45, y)));
    b.add('plaster', wall);
    // stone plinth course per wall segment
    const segs = [[-cxO, -sx - sw / 2], [-sx + sw / 2, -cw / 2], [cw / 2, sx - sw / 2], [sx + sw / 2, cxO]];
    for (const [a, c] of segs) { const g = box(c - a, 0.7, wt + 0.1); T(g, (a + c) / 2, baseH + 0.35, 0); addP(b, 'ashlar', g, 0.05); }
    // stone arch frames (券脸) front & back
    for (const [dx, dw, spr] of doors) {
      const r = dw / 2;
      for (const face of [1, -1]) {
        const pts = [];
        const add = (x, y) => pts.push([x, y + baseH, face * wt / 2]);
        const seq = [];
        seq.push([dx + r, 0]); seq.push([dx + r, spr]);
        for (let i = 1; i < 16; i++) { const a = PI * i / 16; seq.push([dx + Math.cos(a) * r, spr + Math.sin(a) * r]); }
        seq.push([dx - r, spr]); seq.push([dx - r, 0]);
        (face > 0 ? seq : seq.reverse()).forEach(p => add(p[0], p[1]));
        const g = sweep(pts, rectProf(0, 0.3, 0, 0.07), { up: [0, 0, face], uvs: 0.5, caps: false });
        jitter(g, 0.1); b.add('stone', g);
      }
    }
    // end walls (closed sides)
    for (const s of [-1, 1]) {
      wallSeg(b, s * cxO, -cz + colR, s * cxO, cz - colR, baseH, top - 0.45, 0.9, 0.8);
    }
    // door leaves, opened inward (towards -Z)
    for (const [dx, dw, spr] of doors) {
      const lw = dw / 2, lh = spr + 0.25;
      for (const s of [-1, 1]) {
        const g = box(lw - 0.02, lh, 0.1); uvMap(g, (u, v) => [s > 0 ? u : 1 - u, v]);
        T(g, -s * lw / 2, lh / 2, -0.05);
        const ang = s > 0 ? -1.72 : 1.72;
        T(g, dx + s * lw, baseH, -wt / 2, ang);
        b.add('gateDoor', g);
        const hx2 = dx + s * lw, dirx = -s * Math.cos(1.72), dirz = -Math.sin(1.72);
        res.colliders.push(boxC(hx2 + dirx * lw / 2, -wt / 2 + dirz * lw / 2, 0.07, lw / 2, Math.atan2(dirx, dirz)));
      }
      const thr = box(dw + 0.1, 0.12, wt + 0.05); T(thr, dx, baseH + 0.02, 0); addP(b, 'stone', thr, 0.1);
    }
    // brackets & roof
    const hb = 0.9, yB = top + 0.12;
    bracketRing(b, xs, zs, yB, hb, 2);
    const ov = 1.9;
    hallRoof(b, { type: 'xieshan', ax: cxO + ov, az: cz + ov, pitch: 0.62, ov, soffit: yB + hb, th: 0.34, skirtIn: 0.9, og: 0.45,
      ridgeW: 0.38, ridgeH: 0.72, ridgeCurve: 0.2, curl: 0.3, beasts: 4, beastS: 1.1,
      roof: { L: 0.95, lam: 1.8, lamD: 1.1, L2: 0.18, lam2: 5, lamD2: 2.5, F: 0.45, sp: 0.34, rowSeg: 0.8 } });
    plaqueAt(b, plaque, 2.7, 1.0, 0, (baseH + cs + cw / 2 + top - 0.45) / 2, wt / 2 + 0.12, 0.1);
    for (const s of [-1, 1]) hangLantern(b, res, s * (cxI - 0.75), yB, cz + 0.5, 0.95, 0.9);
    // colliders: wall segments + end walls + columns (central passage |x| < cw/2 stays free)
    for (const [a, c] of segs) res.colliders.push(boxC((a + c) / 2, 0, (c - a) / 2, wt / 2 + 0.05));
    for (const s of [-1, 1]) res.colliders.push(boxC(s * cxO, 0, 0.5, cz + 0.3));
    for (const x of xs) for (const z of zs) res.colliders.push(circleC(x, z, colR + 0.05));
    return finish(b, res, 'TempleGate');
  }

  // ======================================================================
  // 5. courtyard wall
  // ======================================================================
  function buildWall({ length = 10 } = {}) {
    seeded(hashStr('wall' + length));
    const b = new Batch(), res = newRes(), L = length, t = 0.62;
    const base = box(L, 0.75, t + 0.12); T(base, 0, 0.375, 0); uvProj(base, UVS.ashlar, rnd(0, 3), 0); b.add('ashlar', base);
    const bc = box(L, 0.08, t + 0.16); T(bc, 0, 0.79, 0); uvProj(bc, UVS.stone, rnd(0, 3), 0); b.add('stone', bc);
    const body = box(L, 2.05, t); T(body, 0, 0.83 + 1.025, 0); uvProj(body, UVS.plaster, rnd(0, 3), 0.2);
    shade(body, (x, y) => lerp(0.82, 1, smooth(0.85, 1.8, y)) * lerp(1, 0.72, smooth(2.4, 2.88, y)));
    b.add('plaster', body);
    for (const [y, e] of [[2.92, 0.12], [3.0, 0.24]]) { const g = box(L, 0.08, t + e); T(g, 0, y, 0); uvProj(g, UVS.ashlar, rnd(0, 3), 0); b.add('ashlar', g); }
    const az = (t + 0.24) / 2 + 0.26;
    const faces = [
      { cx: 0, cz: az, nx: 0, nz: -1, tx: 1, tz: 0, half: L / 2, k: 0, dmax: az },
      { cx: 0, cz: -az, nx: 0, nz: 1, tx: -1, tz: 0, half: L / 2, k: 0, dmax: az },
    ];
    roof(b, { faces, y0: 2.98, D: az, H: 0.34, th: 0.1, sp: 0.25, rowSeg: 1.2, gridU: 2, gridD: az, rafters: false, underKey: 'plaster', fasciaKey: 'stone', ridgeInset: 0.08 });
    const rp = [[-L / 2, 3.33, 0], [L / 2, 3.33, 0]];
    lineRidge(b, rp, 0.2, 0.16, 'tile', false);
    // gable end caps so free-standing wall ends read closed
    for (const s of [-1, 1]) {
      const cap = extrudeZY([[-az, 2.86], [az, 2.86], [az, 2.9], [0, 3.36], [-az, 2.9]], 0.05);
      T(cap, s > 0 ? L / 2 - 0.05 : -L / 2, 0, 0); uvProj(cap, UVS.stone); b.add('stone', cap);
    }
    res.colliders.push(boxC(0, 0, L / 2, (t + 0.12) / 2 + 0.05));
    return finish(b, res, 'Wall');
  }

  // ======================================================================
  // 6. pagoda (八角密檐砖塔)
  // ======================================================================
  function buildPagoda({ levels = 7, ruined = false } = {}) {
    seeded(hashStr('pagoda' + levels + ruined));
    const b = new Batch(), res = newRes(), N = 8, rot = PI / 8, cosA = Math.cos(PI / 8);
    // 须弥座 base
    const R0 = 3.7;
    const tiers = [[R0 + 0.15, R0 + 0.15, 0.28, 'stone'], [R0 - 0.05, R0 - 0.2, 0.14, 'stone'], [R0 - 0.35, R0 - 0.35, 0.5, 'ashlar'], [R0 - 0.2, R0 - 0.05, 0.14, 'stone'], [R0 + 0.05, R0 + 0.05, 0.24, 'stone']];
    let y = 0;
    for (const [r0, r1, h, key] of tiers) { const g = prism(N, r0, r1, h, rot); T(g, 0, y, 0); uvProj(g, UVS[key], rnd(0, 4), 0); jitter(g, 0.05); b.add(key, g); y += h; }
    const yBase = y;
    const lvlH = 2.6, kept = ruined ? Math.max(2, Math.ceil(levels * 0.55)) : levels;
    const inner = new THREE.Group();
    const bodyR = i => 3.0 * (1 - 0.052 * i);
    for (let i = 0; i < kept; i++) {
      const yb = yBase + i * lvlH, R = bodyR(i), Rn = bodyR(i + 1), last = i === kept - 1;
      const broken = ruined && last;
      let hb = lvlH - 0.95;
      if (i === 0) hb += 0.4;
      const ybb = i === 0 ? yb - 0.4 : yb;
      // body
      if (broken) {
        const tops = [];
        for (let k = 0; k < N * 4 + 1; k++) tops.push(hb * clamp(0.3 + 0.55 * (0.5 + 0.5 * Math.sin(k * 0.9 + 1.3)) * rnd(0.55, 1.1) + (k % 3 === 0 ? rnd(-0.15, 0.1) : 0), 0.15, 0.98));
        tops[N * 4] = tops[0];
        const topFn = (i, t) => { const q = (i + t) * 4, k = Math.floor(q), f = q - k; return lerp(tops[k], tops[Math.min(N * 4, k + 1)], f); };
        const g = prismShell(N, R, R * 0.985, hb, rot, 4, topFn); T(g, 0, ybb, 0); uvProj(g, UVS.brick, rnd(0, 3), 0); b.add('brick', g);
        const gi = prismShell(N, R - 0.55, R - 0.56, hb, rot, 4, (i, t) => topFn(i, t) - 0.12, true); T(gi, 0, ybb, 0); uvProj(gi, UVS.brick, rnd(0, 3), 0); tint(gi, 0.6); b.add('brick', gi);
        // jagged rubble cap
        for (let k = 0; k < 10; k++) { const a = rnd(0, TAU), rr = rnd(0.3, R * 0.8); const c = rock(rnd(0.2, 0.45), k + 99); T(c, Math.cos(a) * rr, ybb + hb * rnd(0.3, 0.6), Math.sin(a) * rr, rnd(0, 3), rnd(0, 3)); addP(b, 'brick', c, 0.2); }
        const cap = prism(N, R - 0.3, R - 0.3, 0.05, rot); T(cap, 0, ybb + hb * 0.3, 0); uvProj(cap, 1); b.add('dark', cap);
      } else {
        const g = prism(N, R, R * 0.985, hb, rot); T(g, 0, ybb, 0); uvProj(g, UVS.brick, rnd(0, 3), 0);
        shade(g, (x, yy) => lerp(0.78, 1, smooth(ybb, ybb + 0.8, yy)) * lerp(1, 0.8, smooth(ybb + hb - 0.5, ybb + hb, yy)));
        b.add('brick', g);
        // red band (阑额) near the top of the body
        const band = prism(N, R * 0.995 + 0.03, R * 0.99 + 0.03, 0.26, rot); T(band, 0, ybb + hb - 0.38, 0); uvProj(band, UVS.plaster, rnd(0, 3), 0); b.add('plaster', band);
        // corner pilasters
        for (let k = 0; k < N; k++) { const a = rot + k * TAU / N; const p = box(0.16, hb - 0.4, 0.16); T(p, Math.cos(a) * (R - 0.02), ybb + (hb - 0.4) / 2, Math.sin(a) * (R - 0.02), -a); uvProj(p, UVS.brick); b.add('brick', p); }
      }
      // niches on alternating faces
      const ap = R * cosA;
      for (let k = 0; k < N; k++) {
        if (broken) break;
        const phi = k * TAU / N;
        const isDoor = (k + i) % 2 === 0, nw = isDoor ? Math.min(1.0, R * 0.42) : 0.55, nh = isDoor ? Math.min(1.25, hb * 0.62) : 0.6;
        const yb2 = ybb + (isDoor ? 0.18 : hb * 0.35);
        const sh = [];
        for (let s = 0; s <= 8; s++) { const a = PI * s / 8; sh.push(V2(Math.cos(a) * nw / 2, nh - nw / 2 + Math.sin(a) * nw / 2)); }
        sh.push(V2(-nw / 2, 0), V2(nw / 2, 0));
        const g = new THREE.ShapeGeometry(new THREE.Shape(sh), 4);
        const ry = Math.atan2(Math.cos(phi), Math.sin(phi));
        T(g, Math.cos(phi) * (ap + 0.012), yb2, Math.sin(phi) * (ap + 0.012), ry);
        b.add('dark', g);
        if (!isDoor) continue;
        const fr = [];
        fr.push([nw / 2, 0]); for (let s = 0; s <= 8; s++) { const a = PI * s / 8; fr.push([Math.cos(a) * nw / 2, nh - nw / 2 + Math.sin(a) * nw / 2]); } fr.push([-nw / 2, 0]);
        const pts = fr.map(p => { const lx = p[0], ly = p[1]; return [Math.cos(phi) * (ap + 0.01) + Math.cos(ry) * lx, yb2 + ly, Math.sin(phi) * (ap + 0.01) - Math.sin(ry) * lx]; });
        const fg = sweep(pts, rectProf(0, 0.12, 0, 0.06), { up: [Math.cos(phi), 0, Math.sin(phi)], uvs: 1, caps: false });
        b.add('brick', fg);
      }
      if (broken) continue;
      // corbel courses (叠涩)
      let yc = ybb + hb;
      for (let c = 0; c < 3; c++) { const rr = R * 0.985 + 0.1 + c * 0.13; const g = prism(N, rr, rr, 0.1, rot); T(g, 0, yc, 0); uvProj(g, UVS.brick, 0, rnd(0, 3)); tint(g, 0.9); b.add('brick', g); yc += 0.1; }
      // eave roof
      const apE = (R * 0.985 + 0.36) * cosA + 0.6, apN = Rn * cosA;
      const isTop = i === levels - 1;
      const ov = apE - (R * 0.985 + 0.36) * cosA;
      const faces = polyFaces(N, apE, 0);
      const D = apE, H = isTop ? apE * 1.0 : apE * 0.62;
      const soff = yc + 0.02;
      const y0 = soff + 0.2 - H * prof(ov / D);
      const cut = isTop ? apE : apE - apN;
      if (!isTop) for (const f of faces) { f.dmax = cut; f.cutInset = 0.06; }
      const keepFace = ruined && i === kept - 2 ? (() => rnd() > 0.35) : null;
      const fl = keepFace ? faces.filter(keepFace) : faces;
      const rf = roof(b, { faces: fl, y0, D, H, th: 0.2, L: 0.34, lam: 0.55, lamD: 0.45, L2: 0.06, lam2: 1.5, lamD2: 1, F: 0.16, sp: 0.34, gridU: 0.42, gridD: 0.42, rowSeg: 0.8, rafters: false, underKey: 'brick', fasciaKey: 'brick' });
      for (const f of fl) {
        hipRidge(b, rf, f, 1, (isTop ? apE : cut) - 0.05, { w: 0.16, h: 0.16, curl: 0.1, tipS: 0.5, beasts: 0 });
        // wind bell at corner tip
        const tp = rf.surf(f, f.half + 0.25, -0.25);
        const bl = lathe([[0.09, 0], [0.065, 0.1], [0.03, 0.17], [0, 0.18]], 6); T(bl, tp[0], tp[1] - 0.42, tp[2]); b.add('bronze', uvProj(bl, 1));
        const rp = box(0.015, 0.26, 0.015); T(rp, tp[0], tp[1] - 0.14, tp[2]); b.add('bronze', uvProj(rp, 1));
      }
      if (isTop) {
        // 塔刹 finial
        const yA = y0 + H;
        const fb = lathe([[0, 0], [0.62, 0], [0.6, 0.2], [0.45, 0.42], [0.2, 0.55], [0, 0.56]], 12); T(fb, 0, yA - 0.15, 0); b.add('brick', uvProj(fb, 1));
        const pole = cyl(0.06, 0.08, 3.4, 8); T(pole, 0, yA + 1.8, 0); b.add('iron', uvProj(pole, 1));
        for (let k = 0; k < 7; k++) { const rr = 0.36 - k * 0.03; const ring = cyl(rr, rr, 0.08, 12); T(ring, 0, yA + 0.6 + k * 0.28, 0); b.add('iron', uvProj(ring, 1)); }
        const canopy = new THREE.ConeGeometry(0.5, 0.25, 12, 1, true); T(canopy, 0, yA + 2.7, 0); b.add('iron', uvProj(canopy, 1));
        const pearl = new THREE.SphereGeometry(0.2, 12, 10); T(pearl, 0, yA + 3.05, 0); b.add('iron', uvProj(pearl, 1));
        const pearl2 = new THREE.SphereGeometry(0.12, 10, 8); T(pearl2, 0, yA + 3.4, 0); b.add('iron', uvProj(pearl2, 1));
      }
    }
    // rubble at the base (ruined)
    if (ruined) {
      for (let k = 0; k < 46; k++) {
        const a = rnd(0, TAU), rr = rnd(R0 + 0.2, R0 + 3.5), s = rnd(0.15, 0.6) * (1.3 - (rr - R0) / 5);
        const g = rock(s, k); T(g, Math.cos(a) * rr, s * 0.35, Math.sin(a) * rr, rnd(0, 3), rnd(-0.4, 0.4), rnd(-0.4, 0.4), 1, rnd(0.5, 0.9), 1);
        addP(b, rnd() < 0.7 ? 'brick' : 'stone', g, 0.25);
      }
      for (let k = 0; k < 30; k++) {
        const a = rnd(0, TAU), rr = rnd(R0 + 0.3, R0 + 4.5);
        const tg = extrudeXY(Array.from({ length: 7 }, (_, j) => { const q = PI * j / 6; return [Math.cos(q) * 0.13, Math.sin(q) * 0.13]; }).concat(Array.from({ length: 7 }, (_, j) => { const q = PI * (6 - j) / 6; return [Math.cos(q) * 0.1, Math.sin(q) * 0.1]; })), 0.3);
        T(tg, Math.cos(a) * rr, 0.06, Math.sin(a) * rr, rnd(0, TAU), rnd(-0.3, 0.3) + (rnd() < 0.5 ? PI : 0), rnd(-0.3, 0.3));
        uvProj(tg, 0.6); b.add('tile', tg);
      }
      const bigs = 5;
      for (let k = 0; k < bigs; k++) {
        const a = rnd(0, TAU), rr = rnd(R0 + 1.0, R0 + 3.0), s = rnd(0.7, 1.1);
        const g = box(s * 1.4, s * 0.7, s); T(g, Math.cos(a) * rr, s * 0.3, Math.sin(a) * rr, rnd(0, TAU), rnd(-0.2, 0.2), rnd(-0.3, 0.3));
        erode(g, 0.05, 2, k); addP(b, 'brick', g, 0.15);
        res.colliders.push(circleC(Math.cos(a) * rr, Math.sin(a) * rr, s * 0.7));
      }
    }
    const built = b.build();
    let obj = built;
    if (ruined) { inner.add(built); inner.rotation.set(0.018, 0, 0.032); obj = new THREE.Group(); obj.add(inner); }
    obj.name = ruined ? 'PagodaRuined' : 'Pagoda';
    res.colliders.push(circleC(0, 0, R0 + 0.2));
    return Object.assign({ object: obj }, res);
  }

  // ======================================================================
  // 7. 牌坊 stone archway
  // ======================================================================
  function buildPaifang({ width = 12, text = '黑风山' } = {}) {
    seeded(hashStr('paifang' + width));
    const b = new Batch(), res = newRes();
    const hw = width / 2, pw = 0.62, ci = Math.max(2.3 + pw / 2, width * 0.2), co = hw - pw / 2;
    const hIn = 7.0, hOut = 5.6;
    for (const s of [-1, 1]) for (const [x, h] of [[s * ci, hIn], [s * co, hOut]]) {
      const g = box(pw, h, pw); T(g, x, h / 2, 0); addP(b, 'stone', g, 0.08); shadeY(g, 0, 2, 0.75, 1);
      const bs = box(pw + 0.3, 0.35, pw + 0.3); T(bs, x, 0.175, 0); addP(b, 'stone', bs, 0.1);
      // drum stones (抱鼓石)
      for (const sz of [-1, 1]) {
        const blk = box(0.42, 0.95, 0.7); T(blk, x, 0.475, sz * (pw / 2 + 0.35)); addP(b, 'stone', blk, 0.1);
        const dr = cyl(0.5, 0.5, 0.36, 18); T(dr, x, 1.3, sz * (pw / 2 + 0.42), 0, 0, PI / 2); addP(b, 'stone', dr, 0.1);
        const sc = new THREE.SphereGeometry(0.16, 8, 6); T(sc, x, 1.3, sz * (pw / 2 + 0.95), 0, 0, 0, 1, 1, 0.6); addP(b, 'stone', sc, 0.1);
      }
      res.colliders.push(boxC(x, 0, pw / 2 + 0.25, pw / 2 + 0.95));
    }
    // central bay lintels + plaque
    const lw = 0.42;
    const lint = (x0, x1, yc, h, d) => { const g = box(x1 - x0, h, d); T(g, (x0 + x1) / 2, yc, 0); addP(b, 'stone', g, 0.08); };
    lint(-ci - 0.1, ci + 0.1, 5.0, 0.55, lw + 0.05);
    lint(-ci - 0.1, ci + 0.1, 6.55, 0.4, lw);
    const pqW = 2 * ci - pw - 0.5;
    const pq = box(Math.min(3.2, pqW), 1.0, 0.22); T(pq, 0, 5.8, 0); b.add('stoneText:' + text, pq);
    for (const s of [-1, 1]) { const zz = box((pqW - Math.min(3.2, pqW)) / 2, 1.0, 0.18); T(zz, s * (Math.min(3.2, pqW) / 2 + (pqW - Math.min(3.2, pqW)) / 4 + 0.02), 5.8, 0); addP(b, 'stone', zz, 0.1); }
    // side bay lintels
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? ci : -co, x1 = s > 0 ? co : -ci;
      lint(x0 - 0.05, x1 + 0.05, 3.95, 0.45, lw);
      lint(x0 - 0.05, x1 + 0.05, 4.95, 0.35, lw - 0.04);
      const pn = box(x1 - x0 - pw, 0.55, 0.16); T(pn, (x0 + x1) / 2, 4.45, 0); addP(b, 'stone', pn, 0.15);
    }
    // dentil brackets under roofs
    const dentils = (x0, x1, yb, z) => { const n = Math.floor((x1 - x0) / 0.36); for (let i = 0; i <= n; i++) { const g = box(0.16, 0.22, 0.34); T(g, lerp(x0, x1, i / n), yb + 0.11, z); addP(b, 'stone', g, 0.12); } };
    for (const z of [0.14, -0.14]) { dentils(-ci, ci, 6.75, z); dentils(-co, -ci, 5.12, z); dentils(ci, co, 5.12, z); }
    const beamC = box(2 * ci + 0.9, 0.18, 0.8); T(beamC, 0, 7.05, 0); addP(b, 'stone', beamC, 0.08);
    for (const s of [-1, 1]) { const g = box(co - ci + 0.9, 0.16, 0.74); T(g, s * (ci + co) / 2, 5.42, 0); addP(b, 'stone', g, 0.08); }
    // roofs (stone, tiled look)
    const roofOpts = (L) => ({ L, lam: 0.7, lamD: 0.55, L2: 0.08, lam2: 2, lamD2: 1, F: 0.22, sp: 0.24, gridU: 0.3, gridD: 0.3, rowSeg: 0.5, rafters: false, tileKey: 'tileStone', underKey: 'stone', fasciaKey: 'stone' });
    hallRoof(b, { type: 'hip', ax: ci + 0.85, az: 1.25, pitch: 0.95, ov: 0.9, soffit: 7.14, th: 0.2, ridgeW: 0.26, ridgeH: 0.34, ridgeCurve: 0.08, curl: 0.16, beasts: 0, roof: roofOpts(0.45) });
    for (const s of [-1, 1]) {
      const sub = new Batch();
      hallRoof(sub, { type: 'hip', ax: (co - ci) / 2 + 0.75, az: 1.1, pitch: 0.95, ov: 0.8, soffit: 5.5, th: 0.18, ridgeW: 0.22, ridgeH: 0.28, ridgeCurve: 0.05, curl: 0.14, beasts: 0, roof: roofOpts(0.38) });
      for (const [key, list] of sub.m) for (const geo of list) { T(geo, s * (ci + co) / 2 + s * 0.12, 0, 0); b.add(key, geo); }
    }
    return finish(b, res, 'Paifang');
  }

  // ======================================================================
  // 8. 石灯笼 stone lantern
  // ======================================================================
  function buildStoneLantern({ lit = true } = {}) {
    seeded(hashStr('lantern'));
    const b = new Batch(), res = newRes(), N = 6, rot = 0;
    const st = (g, y) => { T(g, 0, y, 0); uvProj(g, UVS.stone, rnd(0, 4), rnd(0, 4)); jitter(g, 0.06); b.add('stone', g); };
    st(prism(N, 0.42, 0.4, 0.14, rot), 0);
    st(prism(N, 0.34, 0.26, 0.12, rot), 0.14);
    st(lathe([[0.26, 0], [0.3, 0.03], [0.22, 0.1], [0.15, 0.13]], 12), 0.26);
    st(prism(N, 0.14, 0.12, 0.45, rot), 0.38);
    st(cyl(0.16, 0.16, 0.05, 12), 0.58);
    st(prism(N, 0.2, 0.36, 0.1, rot), 0.83);
    st(prism(N, 0.36, 0.34, 0.06, rot), 0.93);
    // firebox: 6 posts, 3 openings (front, back-left, back-right) + 3 panels
    const fb0 = 0.99, fbh = 0.38, rr = 0.26;
    for (let k = 0; k < N; k++) {
      const a = rot + k * TAU / N;
      const p = box(0.07, fbh, 0.07); T(p, Math.cos(a) * rr, fb0 + fbh / 2, Math.sin(a) * rr, -a); uvProj(p, 1); b.add('stone', p);
    }
    for (let k = 0; k < N; k++) {
      const phi = rot + (k + 0.5) * TAU / N, open = k % 2 === 0;
      if (open) continue;
      const pw = 2 * rr * Math.sin(PI / N) - 0.03;
      const pn = box(pw, fbh - 0.04, 0.05); T(pn, Math.cos(phi) * rr * Math.cos(PI / N), fb0 + fbh / 2, Math.sin(phi) * rr * Math.cos(PI / N), Math.atan2(Math.cos(phi), Math.sin(phi))); uvProj(pn, 1); b.add('stone', pn);
    }
    const core = prism(N, 0.17, 0.17, fbh - 0.06, rot); T(core, 0, fb0 + 0.03, 0);
    if (lit) b.add('glow', core); else b.add('dark', core);
    // roof (stone hex roof with upturned corners)
    roof(b, { faces: polyFaces(N, 0.46, PI / 6), y0: fb0 + fbh + 0.1, D: 0.46, H: 0.3, th: 0.12, L: 0.1, lam: 0.1, lamD: 0.12, F: 0.05, rows: false, rafters: false, fascia: true, fasciaKey: 'stone', tileKey: 'stone', underKey: 'stone', gridU: 0.08, gridD: 0.06, vScale: 0.5 });
    st(new THREE.SphereGeometry(0.08, 10, 8), fb0 + fbh + 0.4);
    st(cyl(0.05, 0.07, 0.06, 8), fb0 + fbh + 0.32);
    if (lit) {
      res.fires.push({ pos: new THREE.Vector3(0, fb0 + fbh * 0.5, 0), scale: 0.35 });
      res.lights.push({ pos: new THREE.Vector3(0, fb0 + fbh * 0.55, 0), color: WARM(), intensity: 2.2, distance: 8 });
    }
    res.colliders.push(circleC(0, 0, 0.42));
    return finish(b, res, 'StoneLantern');
  }

  // ======================================================================
  // 9. 鼎 incense burner
  // ======================================================================
  function buildIncenseBurner() {
    seeded(hashStr('censer'));
    const b = new Batch(), res = newRes();
    const base = prism(8, 1.0, 0.95, 0.28, PI / 8); uvProj(base, UVS.stone, 0.3, 0.1); jitter(base, 0.05); b.add('stone', base);
    const base2 = prism(8, 0.8, 0.8, 0.1, PI / 8); T(base2, 0, 0.28, 0); uvProj(base2, UVS.stone); b.add('stone', base2);
    const Bz = g => { uvProj(g, UVS.bronze, rnd(0, 3), rnd(0, 3)); b.add('bronze', g); return g; };
    // legs (curved)
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 + PI / 2;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(Math.cos(a) * 0.62, 0.38, Math.sin(a) * 0.62), new THREE.Vector3(Math.cos(a) * 0.72, 0.62, Math.sin(a) * 0.72), new THREE.Vector3(Math.cos(a) * 0.45, 0.92, Math.sin(a) * 0.45));
      Bz(new THREE.TubeGeometry(curve, 8, 0.07, 8, false));
      const foot = new THREE.SphereGeometry(0.11, 10, 8); T(foot, Math.cos(a) * 0.62, 0.42, Math.sin(a) * 0.62, 0, 0, 0, 1, 0.7, 1); Bz(foot);
      const face = new THREE.SphereGeometry(0.11, 8, 6); T(face, Math.cos(a) * 0.69, 0.64, Math.sin(a) * 0.69, 0, 0, 0, 0.7, 1.1, 0.7); Bz(face);
    }
    // belly
    const body = lathe([[0, 0.78], [0.28, 0.8], [0.5, 0.88], [0.62, 1.02], [0.66, 1.18], [0.63, 1.34], [0.6, 1.42], [0.66, 1.46], [0.68, 1.5], [0.6, 1.52], [0.56, 1.48], [0.5, 1.4], [0, 1.38]], 24);
    Bz(body);
    for (const yb of [1.1, 1.3]) { const r = new THREE.TorusGeometry(yb === 1.1 ? 0.66 : 0.64, 0.02, 5, 32); T(r, 0, yb, 0, 0, PI / 2); Bz(r); }
    // ears (立耳)
    for (const s of [-1, 1]) {
      const pts = [[-0.14, 0], [0.14, 0], [0.15, 0.38], [-0.15, 0.38]];
      const sh = new THREE.Shape(pts.map(p => V2(p[0], p[1])));
      const hole = new THREE.Path([V2(-0.08, 0.1), V2(0.08, 0.1), V2(0.08, 0.3), V2(-0.08, 0.3)].reverse());
      sh.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }); g.translate(0, 0, -0.03);
      T(g, s * 0.6, 1.47, 0, PI / 2); Bz(g);
    }
    // relief: taotie masks (simple bosses)
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; const bs = new THREE.SphereGeometry(0.06, 8, 6); T(bs, Math.cos(a) * 0.65, 1.2, Math.sin(a) * 0.65, 0, 0, 0, 1, 1.4, 1); Bz(bs); }
    // ash + incense bundles
    const ash = cyl(0.56, 0.56, 0.03, 20); T(ash, 0, 1.42, 0); tintS(ash, 0.5, 0.48, 0.45); b.add('painted', ash);
    for (let k = 0; k < 14; k++) {
      const a = rnd(0, TAU), r = rnd(0.05, 0.4), len = rnd(0.25, 0.55), lx = rnd(-0.12, 0.12), lz = rnd(-0.12, 0.12);
      const s = cyl(0.009, 0.009, len, 4); T(s, Math.cos(a) * r, 1.43 + len / 2, Math.sin(a) * r, 0, lx, lz); tintS(s, 0.5, 0.22, 0.13); b.add('painted', s);
      if (k % 2 === 0) { const tp = new THREE.SphereGeometry(0.014, 5, 4); T(tp, Math.cos(a) * r - Math.sin(lz) * len, 1.43 + len, Math.sin(a) * r + Math.sin(lx) * len); b.add('glow', tp); }
    }
    res.smoke.push({ pos: new THREE.Vector3(0, 1.95, 0) });
    res.fires.push({ pos: new THREE.Vector3(0, 1.5, 0), scale: 0.3 });
    res.lights.push({ pos: new THREE.Vector3(0, 1.8, 0), color: new THREE.Color(1.0, 0.5, 0.25), intensity: 0.8, distance: 4 });
    res.colliders.push(circleC(0, 0, 0.95));
    return finish(b, res, 'IncenseBurner');
  }

  // ======================================================================
  // 10. brazier
  // ======================================================================
  function buildBrazier() {
    seeded(hashStr('brazier'));
    const b = new Batch(), res = newRes();
    const Fe = g => { uvProj(g, UVS.iron, rnd(0, 3), rnd(0, 3)); b.add('iron', g); return g; };
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3;
      const c = new THREE.CubicBezierCurve3(new THREE.Vector3(Math.cos(a) * 0.5, 0.02, Math.sin(a) * 0.5), new THREE.Vector3(Math.cos(a) * 0.28, 0.25, Math.sin(a) * 0.28), new THREE.Vector3(Math.cos(a) * 0.2, 0.7, Math.sin(a) * 0.2), new THREE.Vector3(Math.cos(a) * 0.3, 0.95, Math.sin(a) * 0.3));
      Fe(new THREE.TubeGeometry(c, 10, 0.03, 6, false));
      const f = new THREE.SphereGeometry(0.05, 8, 6); T(f, Math.cos(a) * 0.5, 0.03, Math.sin(a) * 0.5, 0, 0, 0, 1.2, 0.6, 1.2); Fe(f);
    }
    const ring = new THREE.TorusGeometry(0.24, 0.02, 6, 20); T(ring, 0, 0.5, 0, 0, PI / 2); Fe(ring);
    const bowl = lathe([[0, 0.9], [0.2, 0.9], [0.36, 0.96], [0.46, 1.08], [0.5, 1.18], [0.53, 1.2], [0.5, 1.21], [0.46, 1.15], [0.36, 1.06], [0.2, 1.01], [0, 1.0]], 20);
    Fe(bowl);
    for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4; const h = new THREE.TorusGeometry(0.06, 0.012, 5, 10); T(h, Math.cos(a) * 0.53, 1.13, Math.sin(a) * 0.53, -a + PI / 2); Fe(h); }
    for (let k = 0; k < 16; k++) {
      const a = rnd(0, TAU), r = rnd(0, 0.34), s = rnd(0.06, 0.12);
      const g = new THREE.DodecahedronGeometry(s, 0); T(g, Math.cos(a) * r, 1.04 + (0.34 - r) * 0.15 + s * 0.4, Math.sin(a) * r, rnd(0, 3), rnd(0, 3)); uvProj(g, 2, rnd(0, 1), rnd(0, 1)); b.add('ember', g);
    }
    res.fires.push({ pos: new THREE.Vector3(0, 1.2, 0), scale: 1.0 });
    res.lights.push({ pos: new THREE.Vector3(0, 1.6, 0), color: new THREE.Color(1.0, 0.52, 0.22), intensity: 4, distance: 12 });
    res.colliders.push(circleC(0, 0, 0.5));
    return finish(b, res, 'Brazier');
  }

  // ======================================================================
  // 11. stairs
  // ======================================================================
  function buildStairs({ width = 6, steps = 12, rise = 0.2, run = 0.4 } = {}) {
    seeded(hashStr('stairs' + width + steps));
    const b = new Batch(), res = newRes();
    flight(b, res, { w: width, n: steps, rise, run, zFront: 0, sides: 'wall', bottom: -3, sideT: 0.36, railH: 0.8 });
    return finish(b, res, 'Stairs');
  }

  // ======================================================================
  // 12. weathered seated Buddha
  // ======================================================================
  function buildStatue() {
    seeded(hashStr('statue'));
    const b = new Batch(), res = newRes();
    const S = g => { uvProj(g, UVS.statue, rnd(0, 4), rnd(0, 4)); return g; };
    // pedestal
    const p0 = prism(8, 1.55, 1.5, 0.35, PI / 8); S(p0); b.add('statue', p0);
    const p1 = prism(8, 1.3, 1.35, 0.2, PI / 8); T(p1, 0, 0.35, 0); S(p1); b.add('statue', p1);
    const core = lathe([[0, 0.55], [1.15, 0.55], [1.2, 0.62], [0.95, 0.8], [1.05, 1.0], [1.2, 1.12], [1.22, 1.2], [0, 1.2]], 24); S(core); erode(core, 0.02, 2.5); b.add('statue', core);
    const petal = new THREE.SphereGeometry(1, 10, 8);
    { const p = petal.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - Math.max(0, y) * 0.8) * (1 + Math.min(0, y) * 0.3)); p.setZ(i, p.getZ(i) + (y > 0 ? y * y * 0.3 : 0)); } petal.computeVertexNormals(); }
    for (const [n, r, y, tilt, sy, down] of [[18, 1.14, 0.72, 0.55, 0.22, true], [18, 1.1, 1.0, -0.5, 0.27, false], [18, 0.98, 1.1, -0.25, 0.22, false]]) {
      for (let k = 0; k < n; k++) {
        const a = (k + (down ? 0 : 0.5)) * TAU / n;
        if (rnd() < 0.08) continue; // a few petals broken off
        const g = petal.clone(); T(g, 0, 0, 0, 0, 0, 0, 0.2, sy, 0.07);
        T(g, Math.cos(a) * r, y, Math.sin(a) * r, Math.atan2(Math.cos(a), Math.sin(a)), (down ? PI : 0) + tilt);
        S(g); b.add('statue', g);
      }
    }
    // figure
    const ys = 1.2, fig = [];
    const F = g => { fig.push(g); return g; };
    const limb = (p0, p1, r) => {
      const a = new THREE.Vector3(...p0), c = new THREE.Vector3(...p1);
      const g = new THREE.CapsuleGeometry(r, Math.max(0.01, a.distanceTo(c)), 4, 10);
      _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
      _m4.compose(a.clone().add(c).multiplyScalar(0.5), _q, _s.set(1, 1, 1)); g.applyMatrix4(_m4);
      return F(g);
    };
    // crossed legs / lap
    F(T(new THREE.SphereGeometry(1, 20, 12), 0, ys + 0.22, 0.12, 0, 0, 0, 0.92, 0.27, 0.55));
    for (const s2 of [-1, 1]) F(T(new THREE.SphereGeometry(0.27, 14, 10), s2 * 0.6, ys + 0.22, 0.3, 0, 0, 0, 1.2, 0.72, 1.05));
    for (const s2 of [-1, 1]) F(T(new THREE.SphereGeometry(0.11, 10, 8), s2 * 0.26, ys + 0.42, 0.32, s2 * 0.4, 0, 0, 1.5, 0.5, 0.8));
    // torso
    F(T(lathe([[0, 0], [0.48, 0], [0.46, 0.22], [0.42, 0.42], [0.47, 0.68], [0.53, 0.86], [0.52, 0.96], [0.34, 1.05], [0.16, 1.1], [0, 1.12]], 22), 0, ys + 0.28, -0.06, 0, -0.05, 0, 1, 1, 0.64));
    F(T(cyl(0.12, 0.13, 0.16, 12), 0, ys + 1.44, -0.05));
    // head
    F(T(new THREE.SphereGeometry(0.27, 18, 14), 0, ys + 1.67, -0.03, 0, 0, 0, 0.88, 1.08, 0.94));
    F(T(new THREE.SphereGeometry(0.14, 12, 10), 0, ys + 1.95, -0.05, 0, 0, 0, 1, 0.9, 1));
    for (const s2 of [-1, 1]) limb([s2 * 0.235, ys + 1.74, -0.05], [s2 * 0.25, ys + 1.5, -0.03], 0.045);
    F(T(new THREE.ConeGeometry(0.045, 0.12, 6), 0, ys + 1.64, 0.22, 0, -PI / 2 + 0.35));
    F(T(new THREE.SphereGeometry(0.2, 12, 6, 0, TAU, 0, PI / 2), 0, ys + 1.74, 0.02, 0, 0.25, 0, 1.05, 0.35, 0.9));
    // left arm: resting, hand in the lap (dhyana)
    limb([-0.5, ys + 1.16, -0.06], [-0.62, ys + 0.72, 0.02], 0.125);
    limb([-0.62, ys + 0.72, 0.02], [-0.16, ys + 0.5, 0.36], 0.105);
    F(T(new THREE.SphereGeometry(0.15, 12, 8), -0.04, ys + 0.47, 0.38, 0, 0, 0, 1.35, 0.45, 0.9));
    // right arm: raised (abhaya), forearm broken off
    limb([0.5, ys + 1.16, -0.06], [0.64, ys + 0.74, 0.06], 0.125);
    const stump = new THREE.CylinderGeometry(0.1, 0.105, 0.3, 12, 2, false); prep(stump);
    { const p = stump.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.14) p.setY(i, 0.15 - Math.abs(Math.sin(i * 1.7)) * 0.08); stump.computeVertexNormals(); }
    T(stump, 0.64, ys + 0.86, 0.2, 0, 0.9, 0); F(stump);
    // robe hem edge across the chest (shawl line)
    limb([-0.46, ys + 1.2, 0.08], [0.3, ys + 0.62, 0.3], 0.045);
    for (const g of fig) { S(g); erode(g, 0.018, 3.2, 1); b.add('statue', g); }
    // broken halo (partial ring)
    const halo = new THREE.Shape(), r0 = 0.62, r1 = 0.48, a0 = -0.4, a1 = PI * 1.25;
    halo.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
    for (let i = 1; i <= 24; i++) { const a = lerp(a0, a1, i / 24); halo.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); }
    for (let i = 0; i <= 4; i++) { const t = i / 4, rr = lerp(r0, r1, t) + (i % 2 ? 0.04 : -0.03); halo.lineTo(Math.cos(a1 + (i % 2 ? 0.06 : 0)) * rr, Math.sin(a1 + (i % 2 ? 0.06 : 0)) * rr); }
    for (let i = 24; i >= 0; i--) { const a = lerp(a0, a1, i / 24); halo.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); }
    const hg = new THREE.ExtrudeGeometry(halo, { depth: 0.08, bevelEnabled: false }); T(hg, 0, ys + 1.62, -0.52); S(hg); b.add('statue', hg);
    const hs = cyl(0.05, 0.05, 0.9, 6); T(hs, 0, ys + 1.2, -0.5); S(hs); b.add('statue', hs);
    // fallen fragments on the base
    const hand = new THREE.SphereGeometry(0.13, 8, 6); T(hand, 1.05, 0.62, 0.95, 0.5, 0, 0, 1.2, 0.6, 0.9); S(hand); erode(hand, 0.02, 4); b.add('statue', hand);
    const fr = new THREE.CapsuleGeometry(0.09, 0.25, 3, 8); T(fr, -0.9, 0.62, 1.05, 0.8, 0, PI / 2); S(fr); b.add('statue', fr);
    for (let k = 0; k < 6; k++) { const g = new THREE.DodecahedronGeometry(rnd(0.05, 0.12), 0); T(g, rnd(-1.4, 1.4), 0.03, rnd(1.4, 1.9), rnd(0, 3)); S(g); b.add('statue', g); }
    res.colliders.push(circleC(0, 0, 1.55));
    return finish(b, res, 'Statue');
  }

  // ======================================================================
  // 13. banner pole (幡)
  // ======================================================================
  function buildBannerPole() {
    seeded(hashStr('banner'));
    const b = new Batch(), res = newRes();
    const bs = box(1.0, 0.25, 0.8); T(bs, 0, 0.125, 0); addP(b, 'stone', bs);
    for (const s of [-1, 1]) {
      const g = box(0.22, 1.25, 0.5); T(g, s * 0.2, 0.25 + 0.625, 0); addP(b, 'stone', g);
      const c = extrudeXY([[-0.25, 0], [0.25, 0], [0.25, 0.08], [0, 0.2], [-0.25, 0.08]], 0.22); T(c, s * 0.2, 1.5, 0, PI / 2); addP(b, 'stone', c);
    }
    const pole = cyl(0.075, 0.1, 7.4, 10); scaleUV(pole, 0.5, 5); T(pole, 0, 3.7, 0); b.add('wood', pole);
    for (const y of [1.1, 1.35]) { const pin = cyl(0.03, 0.03, 0.62, 6); T(pin, 0, y, 0, 0, 0, PI / 2); b.add('iron', uvProj(pin, 1)); }
    const arm = cyl(0.035, 0.035, 1.1, 6); T(arm, 0.45, 7.0, 0, 0, 0, PI / 2); b.add('wood', uvProj(arm, 1));
    const brace = cyl(0.025, 0.025, 0.7, 5); T(brace, 0.25, 6.78, 0, 0, 0, -0.95); b.add('wood', uvProj(brace, 1));
    const fin = lathe([[0, 0], [0.09, 0], [0.11, 0.1], [0.06, 0.2], [0.08, 0.3], [0.02, 0.5], [0, 0.55]], 10); T(fin, 0, 7.4, 0); b.add('iron', uvProj(fin, 1));
    const hook = new THREE.TorusGeometry(0.05, 0.01, 4, 8); T(hook, 0.85, 6.96, 0); b.add('iron', uvProj(hook, 1));
    // the banner itself: hangs below the arm end
    const bw = 0.7, bl = 4.6;
    const cloth = new THREE.PlaneGeometry(bw, bl, 4, 30); T(cloth, 0.62, 6.93 - bl / 2, 0); b.add('banner', cloth);
    const batten = cyl(0.02, 0.02, bw + 0.1, 5); T(batten, 0.62, 6.93, 0, 0, 0, PI / 2); b.add('wood', uvProj(batten, 1));
    res.colliders.push(circleC(0, 0, 0.5));
    return finish(b, res, 'BannerPole');
  }

  // ======================================================================
  // 14. ruins debris cluster
  // ======================================================================
  function buildRuins(seed = 1) {
    seeded((seed * 7919 + 17) >>> 0);
    const b = new Batch(), res = newRes();
    // fallen column segments
    const nc = 1 + Math.floor(rnd(0, 2));
    for (let k = 0; k < nc; k++) {
      const len = rnd(2.2, 3.6), r = rnd(0.26, 0.32), yaw = rnd(0, TAU), x = rnd(-2.5, 2.5), z = rnd(-2, 2);
      const g = new THREE.CylinderGeometry(r * 0.94, r, len, 14, 6, false); prep(g);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { if (p.getY(i) > len / 2 - 0.01) p.setY(i, len / 2 - rnd(0, 0.35)); }
      g.computeVertexNormals();
      scaleUV(g, 2 * PI * r * UVS.lacquer, len * UVS.lacquer, rnd(0, 5), rnd(0, 5));
      T(g, x, r * 0.95, z, yaw, 0, PI / 2 + rnd(-0.05, 0.05));
      b.add('lacquer', g);
      res.colliders.push(boxC(x, z, len / 2, r, yaw));
    }
    // standing column stump on its base
    {
      const x = rnd(-3, 3), z = rnd(-3, 3), r = 0.3;
      const base = lathe([[0, 0], [0.5, 0], [0.5, 0.06], [0.45, 0.16], [0.34, 0.24], [0, 0.24]], 12); T(base, x, 0, z); addP(b, 'stone', base);
      const st = new THREE.CylinderGeometry(r * 0.96, r, 1.0, 14, 3, false); prep(st);
      const p = st.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.49) p.setY(i, 0.5 - rnd(0, 0.45));
      st.computeVertexNormals(); scaleUV(st, 1.3, 0.7); T(st, x, 0.74, z); b.add('lacquer', st);
      res.colliders.push(circleC(x, z, 0.5));
    }
    // broken wall chunk with jagged top
    {
      const L = rnd(2.2, 3.4), H = rnd(1.4, 2.2), t = 0.6, yaw = rnd(0, TAU), x = rnd(-3, 3), z = rnd(-3, 3);
      const g = new THREE.BoxGeometry(L, H, t, 26, 6, 1); prep(g);
      const p = g.attributes.position;
      const steps = Array.from({ length: 14 }, (_, i) => (i % 2 ? rnd(0.45, 1) : rnd(0, 0.5)));
      const topAt = px => { const q = (px / L + 0.5) * 6, k = Math.floor(clamp(q, 0, 12)), f = q - k; const a = steps[k], c = steps[Math.min(13, k + 1)]; return lerp(a, c, f * f * (3 - 2 * f)); };
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i), py = p.getY(i);
        const edge = Math.min(1, (L / 2 - Math.abs(px)) / (L * 0.3));
        const cut = H / 2 - (0.12 + 0.8 * topAt(px) * (0.5 + 0.5 * edge) + 0.12 * Math.abs(Math.sin(px * 13.7 + seed * 3.1))) * H * 0.55 - (1 - edge) * H * 0.3;
        if (py > cut) p.setY(i, cut + (py - H / 2) * 0.05);
      }
      g.computeVertexNormals(); uvProj(g, UVS.plaster, rnd(0, 3), 0);
      T(g, x, H / 2, z, yaw, 0, rnd(-0.06, 0.06)); b.add('plaster', g);
      const sk = box(L + 0.05, 0.6, t + 0.08); T(sk, x, 0.3, z, yaw); addP(b, 'stone', sk, 0.05);
      res.colliders.push(boxC(x, z, L / 2, t / 2 + 0.05, yaw));
    }
    // fallen beam
    {
      const len = rnd(2.6, 3.6), yaw = rnd(0, TAU), x = rnd(-2, 2), z = rnd(-2, 2), tilt = rnd(0.08, 0.25);
      const g = box(len, 0.32, 0.28); T(g, x, 0.25 + Math.sin(tilt) * len * 0.3, z, yaw, 0, tilt);
      b.add('beam', g);
      res.colliders.push(boxC(x, z, len / 2, 0.2, yaw));
    }
    // rubble + stones
    for (let k = 0; k < 26; k++) {
      const s = rnd(0.08, 0.45), x = rnd(-4, 4), z = rnd(-4, 4);
      const g = rock(s, k + seed * 31); T(g, x, s * 0.3, z, rnd(0, 3), rnd(-0.3, 0.3), rnd(-0.3, 0.3), 1, rnd(0.5, 0.9), rnd(0.8, 1.2));
      addP(b, 'stone', g, 0.3);
      if (s > 0.38) res.colliders.push(circleC(x, z, s * 0.9));
    }
    // scattered roof tiles (curved shells)
    const shell = extrudeXY(Array.from({ length: 7 }, (_, j) => { const q = PI * j / 6; return [Math.cos(q) * 0.13, Math.sin(q) * 0.13]; }).concat(Array.from({ length: 7 }, (_, j) => { const q = PI * (6 - j) / 6; return [Math.cos(q) * 0.1, Math.sin(q) * 0.1]; })), 0.3);
    prep(shell);
    for (let k = 0; k < 28; k++) {
      const g = shell.clone(); T(g, rnd(-4, 4), 0.05, rnd(-4, 4), rnd(0, TAU), rnd(-0.3, 0.3) + (rnd() < 0.5 ? PI : 0), rnd(-0.25, 0.25));
      uvProj(g, 0.6, rnd(0, 1), rnd(0, 1)); b.add('tile', g);
    }
    return finish(b, res, 'Ruins');
  }

  // ======================================================================
  // 15. bell pavilion (钟亭)
  // ======================================================================
  function buildBellPavilion() {
    seeded(hashStr('bell'));
    const b = new Batch(), res = newRes();
    const hx = 2.7, pH = 0.45;
    terrace(b, hx, hx, pH);
    flight(b, res, { w: 1.8, n: 2, rise: pH / 2, run: 0.32, zFront: hx + 0.64, sides: 'band', bottom: -0.2, sideT: 0.3 });
    const c = 1.95, colR = 0.2, colH = 3.5, y0 = pH, top = y0 + colH;
    const xs = [-c, c], zs = [-c, c];
    for (const x of xs) for (const z of zs) column(b, x, z, y0, colH, colR);
    ringBeams(b, xs, zs, top, 0.34);
    // bell beam & bell
    const bb = box(2 * c + 0.2, 0.3, 0.26); T(bb, 0, top - 0.55, 0); addP(b, 'wood', bb, 0.05);
    const yBell = y0 + 1.15;
    const bell = lathe([[0, 1.46], [0.5, 1.4], [0.5, 1.2], [0.53, 0.6], [0.56, 0.1], [0.58, 0.02], [0.64, 0], [0.66, 0.06], [0.63, 0.12], [0.6, 0.35], [0.59, 0.4], [0.62, 0.43], [0.58, 0.47], [0.55, 0.9], [0.57, 0.93], [0.54, 0.96], [0.52, 1.3], [0.47, 1.48], [0.3, 1.58], [0, 1.62]], 28);
    T(bell, 0, yBell, 0); uvProj(bell, 1); b.add('bronze', bell);
    const loop = new THREE.TorusGeometry(0.16, 0.055, 8, 16); T(loop, 0, yBell + 1.74, 0); uvProj(loop, 2); b.add('bronze', loop);
    const hang = cyl(0.03, 0.03, top - 0.7 - (yBell + 1.8), 6); T(hang, 0, (top - 0.7 + yBell + 1.8) / 2, 0); b.add('iron', uvProj(hang, 1));
    // striker log hung on ropes
    const lx0 = 0.72, lx1 = 2.2, ly = yBell + 0.55;
    const log = cyl(0.12, 0.12, lx1 - lx0, 10); T(log, (lx0 + lx1) / 2, ly, 0, 0, 0, PI / 2); scaleUV(log, 0.8, 1.2); b.add('wood', log);
    for (const x of [lx0 + 0.3, lx1 - 0.3]) { const r = cyl(0.012, 0.012, top - 0.7 - ly, 4); T(r, x, (top - 0.7 + ly) / 2, 0); tintS(r, 0.45, 0.38, 0.25); b.add('painted', r); }
    const hb = 0.6, yB = top + 0.1;
    bracketRing(b, xs, zs, yB, hb, 1);
    // pyramidal roof
    const ov = 1.45, a = c + ov, H = 3.1, soff = yB + hb, th = 0.26;
    const y0r = soff + th - H * prof(ov / a);
    const faces = polyFaces(4, a, 0);
    const rf = roof(b, { faces, y0: y0r, D: a, H, th, L: 0.75, lam: 1.1, lamD: 0.8, L2: 0.12, lam2: 3, lamD2: 1.5, F: 0.35, sp: 0.3, rowSeg: 0.6, gridU: 0.35, gridD: 0.35 });
    for (const f of faces) hipRidge(b, rf, f, 1, a - 0.08, { w: 0.24, h: 0.26, curl: 0.25, beasts: 3, beastS: 0.9 });
    const fin = finialGeo(1.1); T(fin, 0, y0r + H - 0.15, 0); tint(fin, 0.6, 0.66, 0.62); uvProj(fin, 0.6); b.add('tile', fin);
    res.colliders.push(boxC(0, 0, hx, hx));
    return finish(b, res, 'BellPavilion');
  }

  function update(time) { uniforms.time.value = time; }

  return {
    buildKeeperShrine, buildTempleHall, buildSideHall, buildTempleGate, buildWall, buildPagoda, buildPaifang,
    buildStoneLantern, buildIncenseBurner, buildBrazier, buildStairs, buildStatue, buildBannerPole, buildRuins, buildBellPavilion,
    uniforms, update, materials,
  };
})();
