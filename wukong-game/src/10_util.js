// ---------------------------------------------------------------------------
// Math / misc utilities
// ---------------------------------------------------------------------------
const U = (() => {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
  const smooth = t => t * t * (3 - 2 * t);
  const smoothstep = (a, b, v) => smooth(invLerp(a, b, v));
  // frame-rate independent exponential smoothing factor
  const dampK = (k, dt) => 1 - Math.exp(-k * dt);
  const damp = (a, b, k, dt) => lerp(a, b, dampK(k, dt));
  const wrapAngle = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  const angleDiff = (a, b) => wrapAngle(b - a);
  const dampAngle = (a, b, k, dt) => a + angleDiff(a, b) * dampK(k, dt);
  const easeOut = t => 1 - (1 - t) * (1 - t);
  const easeIn = t => t * t;
  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInCubic = t => t * t * t;
  const EASE = { l: t => t, i: easeIn, o: easeOut, io: easeInOut, o3: easeOutCubic, i3: easeInCubic };

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(1337);
  const rand = (a = 0, b = 1) => a + (b - a) * Math.random();
  const srand = (r, a = 0, b = 1) => a + (b - a) * r();
  const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length) % arr.length];

  const noise = new SimplexNoise({ random: mulberry32(20240820) });
  const fbm2 = (x, y, oct = 4, lac = 2, gain = 0.5) => {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise.noise(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  };
  const ridge2 = (x, y, oct = 4) => {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(noise.noise(x * f, y * f))); n += a; a *= 0.5; f *= 2; }
    return s / n;
  };

  function canvasTex(w, h, draw, { srgb = true, repeat = true, aniso = 8, mip = true } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso; t.generateMipmaps = mip;
    return t;
  }

  // Distance from point to segment in xz
  function distSeg2(px, pz, ax, az, bx, bz) {
    const abx = bx - ax, abz = bz - az;
    const t = clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz + 1e-9), 0, 1);
    const dx = px - (ax + abx * t), dz = pz - (az + abz * t);
    return { d: Math.sqrt(dx * dx + dz * dz), t };
  }

  // Closest points between segments p1-q1 and p2-q2 (3D). Returns squared distance and params.
  const _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _r = new THREE.Vector3();
  function segSegDist2(p1, q1, p2, q2, out) {
    _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
    const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r);
    let s, t;
    if (a <= 1e-9 && e <= 1e-9) { s = t = 0; }
    else if (a <= 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
    else {
      const c = _d1.dot(_r);
      if (e <= 1e-9) { t = 0; s = clamp(-c / a, 0, 1); }
      else {
        const b = _d1.dot(_d2), denom = a * e - b * b;
        s = denom !== 0 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
        else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
      }
    }
    const c1x = p1.x + _d1.x * s, c1y = p1.y + _d1.y * s, c1z = p1.z + _d1.z * s;
    const c2x = p2.x + _d2.x * t, c2y = p2.y + _d2.y * t, c2z = p2.z + _d2.z * t;
    if (out) { out.set((c1x + c2x) / 2, (c1y + c2y) / 2, (c1z + c2z) / 2); }
    const dx = c1x - c2x, dy = c1y - c2y, dz = c1z - c2z;
    return dx * dx + dy * dy + dz * dz;
  }

  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const tmpV = [...Array(16)].map(() => new THREE.Vector3());
  const tmpQ = [...Array(8)].map(() => new THREE.Quaternion());
  const tmpM = [...Array(4)].map(() => new THREE.Matrix4());

  return {
    clamp, lerp, invLerp, smooth, smoothstep, dampK, damp, wrapAngle, angleDiff, dampAngle,
    easeOut, easeIn, easeInOut, easeOutCubic, easeInCubic, EASE,
    mulberry32, rng, rand, srand, pick, noise, fbm2, ridge2, canvasTex, distSeg2, segSegDist2,
    V, tmpV, tmpQ, tmpM,
  };
})();
