// ---------------------------------------------------------------------------
// World: map layout, terrain, sky, lighting, props & vegetation placement,
// collision (analytic walkable region + collider hash grid)
// ---------------------------------------------------------------------------
const World = (() => {
  const W = CONFIG.WORLD_SIZE, HALF = W / 2;
  const RES = 320, CELL = W / RES, NV = RES + 1;
  const heights = new Float32Array(NV * NV);

  // ---- Map layout --------------------------------------------------------
  // main path through the forest (x, z), south -> north
  const PATH = [[4, 176], [1, 156], [-1, 138], [-9, 114], [-7, 90], [2, 68], [8, 50], [6, 30], [1, 12], [-2, -6], [0, -24], [0, -40]];
  const PATH_W = 4.2;
  const CIRCLES = [
    { x: -1, z: 144, r: 13 },   // keeper shrine A
    { x: -6, z: 92, r: 13 },    // wolf camp
    { x: 6, z: 44, r: 11 },     // stone archway
    { x: -3, z: -4, r: 23 },    // ruined pagoda clearing (wight)
    { x: 2, z: -27, r: 9 },     // keeper shrine B
  ];
  const RECTS = [
    { x0: -2.7, x1: 2.7, z0: -59, z1: -39 },      // temple stairs
    { x0: -1.9, x1: 1.9, z0: -67, z1: -57 },      // gate passage
    { x0: -23, x1: 23, z0: -118.5, z1: -65 },     // courtyard
  ];
  const COURTYARD = RECTS[2];
  const STAIRS = { x: 0, z0: -40, z1: -58, y0: 5.8, y1: 13.0 };
  const PLATEAU_Y = 13.0;

  const ZONES = [
    { id: 'start', name: '黑风山 · 前山', sub: '土地庙', test: (x, z) => z > 118, amb: 'forest' },
    { id: 'forest', name: '林间古道', sub: '狼斥候出没', test: (x, z) => z > 62, amb: 'forest' },
    { id: 'arch', name: '古道 · 石牌坊', sub: '', test: (x, z) => z > 22, amb: 'forest' },
    { id: 'pagoda', name: '残塔', sub: '幽魂游荡之地', test: (x, z) => z > -18, amb: 'forest' },
    { id: 'gate', name: '观音禅院 · 山门', sub: '', test: (x, z) => z > -64, amb: 'temple' },
    { id: 'temple', name: '观音禅院', sub: '', test: (x, z) => true, amb: 'temple' },
  ];

  // ---- Signed distance to the walkable region (negative inside) ------------
  function regionSDF(x, z) {
    let d = 1e9;
    for (let i = 0; i < PATH.length - 1; i++) {
      const a = PATH[i], b = PATH[i + 1];
      const r = U.distSeg2(x, z, a[0], a[1], b[0], b[1]);
      const dd = r.d - PATH_W;
      if (dd < d) d = dd;
    }
    for (const c of CIRCLES) {
      const dd = Math.hypot(x - c.x, z - c.z) - c.r;
      if (dd < d) d = dd;
    }
    for (const r of RECTS) {
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      const hx = (r.x1 - r.x0) / 2, hz = (r.z1 - r.z0) / 2;
      const qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz;
      const dd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
      if (dd < d) d = dd;
    }
    return d;
  }
  function pathDist(x, z) {
    let d = 1e9;
    for (let i = 0; i < PATH.length - 1; i++) {
      const a = PATH[i], b = PATH[i + 1];
      const r = U.distSeg2(x, z, a[0], a[1], b[0], b[1]);
      if (r.d < d) d = r.d;
    }
    return d;
  }

  // base height as a function of z (the valley climbs northwards)
  const H0K = [[220, -0.4], [176, 0.0], [150, 0.4], [120, 1.2], [90, 2.1], [60, 3.0], [30, 3.8], [0, 4.5], [-25, 5.3], [-40, 5.8]];
  function H0(z) {
    if (z <= STAIRS.z1) return PLATEAU_Y;
    if (z <= STAIRS.z0) return U.lerp(STAIRS.y0, STAIRS.y1, (STAIRS.z0 - z) / (STAIRS.z0 - STAIRS.z1));
    for (let i = 0; i < H0K.length - 1; i++) {
      const a = H0K[i], b = H0K[i + 1];
      if (z <= a[0] && z >= b[0]) {
        const t = (a[0] - z) / (a[0] - b[0]);
        return U.lerp(a[1], b[1], U.smooth(t) * 0.6 + t * 0.4);
      }
    }
    return H0K[0][1];
  }
  function inRect(x, z, r, m = 0) { return x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m; }
  function flatMask(x, z) {
    // 1 = perfectly flat (paved / architectural), 0 = natural
    let f = 0;
    for (const r of RECTS) {
      if (inRect(x, z, r, 3)) f = 1;
    }
    if (z < -56) f = 1; // plateau
    for (const c of [CIRCLES[0], CIRCLES[4]]) {
      const d = Math.hypot(x - c.x, z - c.z);
      f = Math.max(f, U.smoothstep(c.r * 0.7, c.r * 0.25, d));
    }
    return f;
  }
  function computeHeight(x, z) {
    const base = H0(z);
    const sd = regionSDF(x, z);
    const out = Math.max(sd, 0);
    // valley walls
    let h = base;
    const n1 = U.fbm2(x * 0.012, z * 0.012, 4);
    const n2 = U.ridge2(x * 0.02 + 7, z * 0.02 - 3, 4);
    const wall = 22 * U.smoothstep(0, 55, out) + 0.22 * out + (n1 * 10 + n2 * 14) * U.smoothstep(4, 60, out);
    h += wall;
    // gentle undulation inside / near the walkable region
    const fm = flatMask(x, z);
    const und = (U.fbm2(x * 0.06, z * 0.06, 3) * 0.55 + U.fbm2(x * 0.2, z * 0.2, 2) * 0.12) * (1 - fm);
    h += und;
    // plateau edge: beyond the courtyard the plateau rises into mountain
    // push outer boundary up into mountains
    const edge = Math.max(Math.abs(x), Math.abs(z)) - (HALF - 30);
    if (edge > 0) h += edge * 1.8;
    return h;
  }

  // triangle-exact height lookup matching the terrain mesh triangulation
  function heightAt(x, z) {
    const gx = U.clamp((x + HALF) / CELL, 0, RES - 1e-4), gz = U.clamp((z + HALF) / CELL, 0, RES - 1e-4);
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const ha = heights[iz * NV + ix], hb = heights[(iz + 1) * NV + ix];
    const hd = heights[iz * NV + ix + 1], hc = heights[(iz + 1) * NV + ix + 1];
    if (fx + fz <= 1) return ha + (hd - ha) * fx + (hb - ha) * fz;
    return hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
  }
  function normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.6;
    out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e));
    return out.normalize();
  }

  // ---- Colliders -----------------------------------------------------------
  const colliders = [];
  const GRID = 8, grid = new Map();
  const key = (i, j) => i * 10000 + j;
  function addCollider(c) {
    // c: {type:'circle', x, z, r} or {type:'box', x, z, hx, hz, rot}
    if (c.type === 'box') { c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0); c.br = Math.hypot(c.hx, c.hz); }
    else c.br = c.r;
    colliders.push(c);
    const i0 = Math.floor((c.x - c.br) / GRID), i1 = Math.floor((c.x + c.br) / GRID);
    const j0 = Math.floor((c.z - c.br) / GRID), j1 = Math.floor((c.z + c.br) / GRID);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c);
    }
  }
  // transform local colliders of a prop by placement
  function addLocalColliders(list, px, pz, rot, scale = 1) {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const l of list || []) {
      // rotation about Y: x' = x cos + z sin ; z' = -x sin + z cos
      const x = px + (l.x * c + l.z * s) * scale, z = pz + (-l.x * s + l.z * c) * scale;
      if (l.type === 'circle') addCollider({ type: 'circle', x, z, r: l.r * scale });
      else addCollider({ type: 'box', x, z, hx: l.hx * scale, hz: l.hz * scale, rot: (l.rot || 0) + rot });
    }
  }
  const _seen = new Set();
  // push a circle (pos.x, pos.z, r) out of colliders and keep it inside the walkable region
  function collide(pos, r, keepInside = true) {
    _seen.clear();
    const i0 = Math.floor((pos.x - r - 4) / GRID), i1 = Math.floor((pos.x + r + 4) / GRID);
    const j0 = Math.floor((pos.z - r - 4) / GRID), j1 = Math.floor((pos.z + r + 4) / GRID);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = grid.get(key(i, j)); if (!a) continue;
      for (const c of a) {
        if (_seen.has(c)) continue; _seen.add(c);
        if (c.type === 'circle') {
          const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
          if (d < m && d > 1e-6) { pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; }
        } else {
          // to box local
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
          const qx = U.clamp(lx, -c.hx, c.hx), qz = U.clamp(lz, -c.hz, c.hz);
          let ex = lx - qx, ez = lz - qz; let d = Math.hypot(ex, ez);
          let nlx, nlz;
          if (d < 1e-6) {
            // inside: push along the smallest penetration axis
            const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
            if (px < pz) { nlx = (lx < 0 ? -c.hx - r : c.hx + r); nlz = lz; }
            else { nlx = lx; nlz = (lz < 0 ? -c.hz - r : c.hz + r); }
          } else if (d < r) {
            nlx = qx + ex / d * r; nlz = qz + ez / d * r;
          } else continue;
          // back to world (inverse rotation)
          pos.x = c.x + nlx * c.cos + nlz * c.sin;
          pos.z = c.z - nlx * c.sin + nlz * c.cos;
        }
      }
    }
    if (keepInside) {
      const sd = regionSDF(pos.x, pos.z);
      if (sd > -r) {
        const e = 0.2;
        let gx = regionSDF(pos.x + e, pos.z) - regionSDF(pos.x - e, pos.z);
        let gz = regionSDF(pos.x, pos.z + e) - regionSDF(pos.x, pos.z - e);
        const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl;
        const push = sd + r;
        pos.x -= gx * push; pos.z -= gz * push;
      }
    }
    return pos;
  }
  // segment test used for line of sight / camera
  function blocked(x, z, r = 0.2) {
    const i = Math.floor(x / GRID), j = Math.floor(z / GRID);
    const a = grid.get(key(i, j)); if (!a) return false;
    for (const c of a) {
      if (c.type === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true; }
      else {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r) return true;
      }
    }
    return false;
  }

  // ---- Scene objects -------------------------------------------------------
  let scene, renderer, sun, hemi, sky, skyMat, terrain, quality;
  const pointLights = [];
  const lightSpots = [];   // candidate positions for the pooled point lights
  const fireSpots = [];
  const smokeSpots = [];
  const interactables = [];
  const shrines = [];
  const animated = [];
  const _v = new THREE.Vector3();

  function makeDetailTextures() {
    const S = 512;
    const hcan = document.createElement('canvas'); hcan.width = hcan.height = S;
    const g = hcan.getContext('2d');
    const img = g.createImageData(S, S);
    const nz = new SimplexNoise({ random: U.mulberry32(77) });
    const hv = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // tileable noise via 4D torus mapping
      const a = x / S * Math.PI * 2, b = y / S * Math.PI * 2;
      const f = (k) => nz.noise4d(Math.cos(a) * k, Math.sin(a) * k, Math.cos(b) * k, Math.sin(b) * k);
      let v = f(0.6) * 0.45 + f(1.6) * 0.3 + f(4) * 0.18 + f(9) * 0.07;
      // pebbles
      const p = f(6);
      if (p > 0.55) v += (p - 0.55) * 1.4;
      hv[y * S + x] = v;
    }
    for (let i = 0; i < S * S; i++) {
      const v = hv[i];
      const c = U.clamp(200 + v * 70, 120, 255);
      img.data[i * 4] = c; img.data[i * 4 + 1] = c * 0.97; img.data[i * 4 + 2] = c * 0.92; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const map = new THREE.CanvasTexture(hcan);
    map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
    // normal map
    const ncan = document.createElement('canvas'); ncan.width = ncan.height = S;
    const ng = ncan.getContext('2d'); const nimg = ng.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const l = hv[y * S + ((x - 1 + S) % S)], r = hv[y * S + ((x + 1) % S)];
      const u = hv[((y - 1 + S) % S) * S + x], d = hv[((y + 1) % S) * S + x];
      let nx = (l - r) * 2.2, ny = (u - d) * 2.2, nzv = 1;
      const len = Math.hypot(nx, ny, nzv); nx /= len; ny /= len; nzv /= len;
      const i = (y * S + x) * 4;
      nimg.data[i] = (nx * 0.5 + 0.5) * 255; nimg.data[i + 1] = (ny * 0.5 + 0.5) * 255; nimg.data[i + 2] = (nzv * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
    }
    ng.putImageData(nimg, 0, 0);
    const nmap = new THREE.CanvasTexture(ncan);
    nmap.wrapS = nmap.wrapT = THREE.RepeatWrapping; nmap.anisotropy = 8;
    return { map, nmap };
  }

  function stoneSlabTexture() {
    return U.canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#6d6a63'; g.fillRect(0, 0, w, h);
      const r = U.mulberry32(9);
      const rows = 6;
      for (let row = 0; row < rows; row++) {
        const y0 = row * h / rows; let x = -r() * 60;
        while (x < w) {
          const sw = 60 + r() * 90;
          const l = 88 + r() * 40;
          g.fillStyle = `rgb(${l},${l * 0.97},${l * 0.9})`;
          g.fillRect(x + 2, y0 + 2, sw - 4, h / rows - 4);
          // stains
          for (let k = 0; k < 6; k++) {
            g.fillStyle = `rgba(${40 + r() * 30},${45 + r() * 30},${30},${0.05 + r() * 0.08})`;
            g.beginPath(); g.ellipse(x + r() * sw, y0 + r() * h / rows, 5 + r() * 25, 3 + r() * 12, r() * 3, 0, 7); g.fill();
          }
          // cracks
          if (r() < 0.35) {
            g.strokeStyle = 'rgba(30,28,25,0.5)'; g.lineWidth = 1;
            g.beginPath(); let cx = x + r() * sw, cy = y0 + 4; g.moveTo(cx, cy);
            for (let s = 0; s < 5; s++) { cx += (r() - 0.5) * 20; cy += h / rows / 5; g.lineTo(cx, cy); }
            g.stroke();
          }
          x += sw;
        }
      }
      // grime between slabs: moss green
      g.globalCompositeOperation = 'multiply';
      for (let k = 0; k < 400; k++) {
        g.fillStyle = `rgba(${70 + r() * 40},${80 + r() * 40},${50},0.12)`;
        g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 14, 0, 7); g.fill();
      }
    });
  }

  function buildTerrain() {
    for (let iz = 0; iz < NV; iz++) for (let ix = 0; ix < NV; ix++) {
      heights[iz * NV + ix] = computeHeight(-HALF + ix * CELL, -HALF + iz * CELL);
    }
    const pos = new Float32Array(NV * NV * 3), col = new Float32Array(NV * NV * 3), uv = new Float32Array(NV * NV * 2);
    const c = new THREE.Color();
    const grassC = new THREE.Color().setRGB(0.29, 0.30, 0.17, THREE.SRGBColorSpace);
    const dryC = new THREE.Color().setRGB(0.42, 0.36, 0.22, THREE.SRGBColorSpace);
    const dirtC = new THREE.Color().setRGB(0.36, 0.30, 0.23, THREE.SRGBColorSpace);
    const rockC = new THREE.Color().setRGB(0.36, 0.35, 0.33, THREE.SRGBColorSpace);
    const needleC = new THREE.Color().setRGB(0.25, 0.19, 0.13, THREE.SRGBColorSpace);
    const stoneC = new THREE.Color().setRGB(0.45, 0.43, 0.40, THREE.SRGBColorSpace);
    const n = new THREE.Vector3();
    for (let iz = 0; iz < NV; iz++) for (let ix = 0; ix < NV; ix++) {
      const i = iz * NV + ix, x = -HALF + ix * CELL, z = -HALF + iz * CELL;
      pos[i * 3] = x; pos[i * 3 + 1] = heights[i]; pos[i * 3 + 2] = z;
      uv[i * 2] = x / 3.5; uv[i * 2 + 1] = z / 3.5;
      // slope
      const hl = heights[iz * NV + Math.max(ix - 1, 0)], hr = heights[iz * NV + Math.min(ix + 1, RES)];
      const hd = heights[Math.max(iz - 1, 0) * NV + ix], hu = heights[Math.min(iz + 1, RES) * NV + ix];
      n.set(hl - hr, 2 * CELL, hd - hu).normalize();
      const slope = 1 - n.y;
      const sd = regionSDF(x, z);
      const pd = pathDist(x, z);
      const nn = U.fbm2(x * 0.05, z * 0.05, 3), nn2 = U.fbm2(x * 0.3 + 11, z * 0.3, 2);
      c.copy(grassC).lerp(dryC, U.clamp(0.45 + nn * 0.8, 0, 1));
      // forest floor away from the path
      c.lerp(needleC, U.smoothstep(2, 14, sd) * 0.75);
      // dirt path
      const pathT = U.smoothstep(PATH_W * 0.85, PATH_W * 0.25, pd + nn2 * 0.9);
      c.lerp(dirtC, pathT * 0.9);
      // clearings trodden
      for (const cc of CIRCLES) {
        const d = Math.hypot(x - cc.x, z - cc.z);
        c.lerp(dirtC, U.smoothstep(cc.r * 0.6, cc.r * 0.1, d + nn2 * 3) * 0.6);
      }
      // rock on steep slopes
      c.lerp(rockC, U.smoothstep(0.18, 0.45, slope + nn * 0.1));
      // paved plateau / stairs region
      if (z < -56 || inRect(x, z, RECTS[0], 1.5)) c.lerp(stoneC, 0.7);
      // slight darkening variation
      const dv = 0.85 + nn2 * 0.15;
      col[i * 3] = c.r * dv; col[i * 3 + 1] = c.g * dv; col[i * 3 + 2] = c.b * dv;
    }
    const idx = new Uint32Array(RES * RES * 6); let k = 0;
    for (let iz = 0; iz < RES; iz++) for (let ix = 0; ix < RES; ix++) {
      const a = iz * NV + ix, b = (iz + 1) * NV + ix, d = iz * NV + ix + 1, cc = (iz + 1) * NV + ix + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = d;
      idx[k++] = b; idx[k++] = cc; idx[k++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const { map, nmap } = makeDetailTextures();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, map, normalMap: nmap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.95, metalness: 0,
    });
    mat.onBeforeCompile = (sh) => {
      // macro variation: sample detail map at a second, larger scale to break tiling
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 texelColor = texture2D( map, vMapUv );
          vec4 texelColor2 = texture2D( map, vMapUv * 0.173 + 0.31 );
          diffuseColor *= mix(texelColor, texelColor2, 0.45) * 1.12;
        #endif`);
    };
    terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    scene.add(terrain);

    // paved courtyard floor + gate plaza + path slabs near shrines
    const slab = stoneSlabTexture();
    const floorMat = new THREE.MeshStandardMaterial({ map: slab, roughness: 0.85, color: 0xb8b4aa });
    const cw = COURTYARD.x1 - COURTYARD.x0 + 6, cd = COURTYARD.z1 - COURTYARD.z0 + 6;
    const fgeo = new THREE.PlaneGeometry(cw, cd, 1, 1); fgeo.rotateX(-Math.PI / 2);
    const uvs = fgeo.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * cw / 6, uvs.getY(i) * cd / 6);
    const floor = new THREE.Mesh(fgeo, floorMat);
    floor.position.set(0, PLATEAU_Y + 0.03, (COURTYARD.z0 + COURTYARD.z1) / 2);
    floor.receiveShadow = true; scene.add(floor);
    // retaining wall along the plateau edge (visible from the stairs)
    buildRetainingWall();
  }

  function buildRetainingWall() {
    const tex = U.canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#56524b'; g.fillRect(0, 0, w, h);
      const r = U.mulberry32(3);
      for (let y = 0; y < h; y += 32) {
        let x = (y / 32) % 2 ? -30 : 0;
        while (x < w) {
          const bw = 50 + r() * 50, l = 70 + r() * 40;
          g.fillStyle = `rgb(${l},${l * 0.97},${l * 0.9})`;
          g.fillRect(x + 2, y + 2, bw - 3, 29);
          x += bw;
        }
      }
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,40,20,0.55)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    tex.repeat.set(6, 3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
    // two wall segments flanking the stairs: from x=3.2 to 40 and -40 to -3.2
    for (const s of [-1, 1]) {
      const len = 40, x = s * (3.4 + len / 2);
      const hTop = PLATEAU_Y + 0.6;
      const geo = new THREE.BoxGeometry(len, 14, 1.6);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, hTop - 7, -58.8);
      m.castShadow = m.receiveShadow = true; scene.add(m);
    }
  }

  // ---- Sky -------------------------------------------------------------------
  function buildSky() {
    const v3 = v => `vec3(${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)})`;
    const c3 = c => `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`;
    skyMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: /* glsl */`
        uniform float time; varying vec3 vDir;
        const vec3 SUN = ${v3(CONFIG.SUN_DIR)};
        const vec3 FOGC = ${c3(CONFIG.FOG_COLOR)};
        const vec3 FOGS = ${c3(CONFIG.FOG_SUN_COLOR)};
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<6;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5;} return s; }
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          float sd = max(dot(d, SUN), 0.0);
          // horizon colour identical to the fog so terrain dissolves into the sky
          vec3 horizon = mix(FOGC, FOGS, pow(sd, 6.0) * 0.85);
          vec3 zenith = vec3(0.105, 0.135, 0.19);
          vec3 mid = vec3(0.33, 0.35, 0.39);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
          col = mix(col, zenith, smoothstep(0.18, 0.9, h));
          col += vec3(1.0, 0.52, 0.22) * pow(sd, 5.0) * 0.45 * (1.0 - smoothstep(0.0, 0.6, h));
          col += vec3(1.0, 0.72, 0.42) * pow(sd, 48.0) * 1.1;
          col += vec3(1.0, 0.86, 0.62) * smoothstep(0.9990, 0.99955, sd) * 30.0;
          // clouds
          if (h > -0.02) {
            vec2 uv = d.xz / (h + 0.18) * 1.1 + vec2(time * 0.006, time * 0.002);
            float c = fbm(uv * 1.3);
            float c2 = fbm(uv * 3.1 + 5.0);
            float cov = smoothstep(0.48, 0.78, c * 0.75 + c2 * 0.35);
            float dens = cov * smoothstep(-0.02, 0.2, h);
            // lit edges toward the sun, darker bellies
            vec3 cloudDark = vec3(0.16, 0.16, 0.19);
            vec3 cloudLit = mix(vec3(0.55, 0.5, 0.48), vec3(1.25, 0.75, 0.42), pow(sd, 3.0));
            float light = clamp(0.35 + (c2 - 0.45) * 1.6, 0.0, 1.0);
            vec3 cc = mix(cloudDark, cloudLit, light * (0.35 + 0.65 * pow(sd, 2.0)));
            col = mix(col, cc, dens * 0.85);
            // silver lining around the sun
            col += vec3(1.0, 0.7, 0.4) * dens * pow(sd, 24.0) * 1.2;
          }
          col = mix(col, horizon, smoothstep(0.03, -0.08, h));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat);
    sky.renderOrder = -10; sky.frustumCulled = false;
    scene.add(sky);
  }

  function buildMountains() {
    // layered distant ridges (ink-painting silhouettes dissolving in the fog)
    const layers = [
      { r: 260, h: 75, col: 0x39403f, seed: 1, rough: 0.9 },
      { r: 360, h: 120, col: 0x3a4146, seed: 2, rough: 0.7 },
      { r: 520, h: 170, col: 0x3c4450, seed: 3, rough: 0.6 },
    ];
    for (const L of layers) {
      const seg = 360;
      const pos = [];
      const idx = [];
      const nz = new SimplexNoise({ random: U.mulberry32(L.seed * 99) });
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        let hN = 0, amp = 1, f = 1.2;
        for (let o = 0; o < 5; o++) { hN += (1 - Math.abs(nz.noise(ca * f + L.seed, sa * f))) * amp; amp *= 0.5; f *= 2.1; }
        hN = Math.pow(hN / 1.9, 1.6);
        const r = L.r + nz.noise(ca * 3, sa * 3) * 30;
        const top = hN * L.h + 10;
        // four rows: base, mid, near-top, top for soft slopes
        const rows = [[-30, r + 60], [top * 0.55, r + 25], [top * 0.9, r + 6], [top, r]];
        for (const [y, rr] of rows) pos.push(ca * rr, y, sa * rr);
      }
      for (let i = 0; i < seg; i++) for (let k = 0; k < 3; k++) {
        const a = i * 4 + k, b = a + 1, c = a + 4, d = a + 5;
        idx.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color: L.col, roughness: 1, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(0, -2, 0);
      scene.add(m);
    }
  }

  function buildLights() {
    hemi = new THREE.HemisphereLight(0xa4b2c8, 0x4a3f30, 0.9);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, 3.4);
    sun.castShadow = quality.shadows > 0;
    const ms = quality.shadows > 1 ? 4096 : 2048;
    sun.shadow.mapSize.set(ms, ms);
    const S = quality.shadows > 1 ? 55 : 45;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 260 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
    scene.add(sun); scene.add(sun.target);
    // pooled point lights (constant count to avoid shader recompiles)
    for (let i = 0; i < 4; i++) {
      const L = new THREE.PointLight(0xff9a4a, 0, 14, 1.6);
      L.userData.base = 0; scene.add(L); pointLights.push(L);
    }
  }

  // env map for reflections: render the sky once into a PMREM
  function buildEnvironment() {
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat.clone());
    s2.material.uniforms = { time: { value: 3 } };
    envScene.add(s2);
    // dark ground hemisphere so reflections are not sky-bright from below
    const g = new THREE.Mesh(new THREE.CircleGeometry(49, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a2620 }));
    g.position.y = -2; envScene.add(g);
    const rt = pm.fromScene(envScene, 0.02, 0.1, 100);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.55;
    pm.dispose();
  }

  // ---- Props -----------------------------------------------------------------
  function place(builderResult, x, z, rot = 0, opts = {}) {
    if (!builderResult) return null;
    const { object, colliders: cols = [], lights = [], fires = [], smoke = [], interact = null } = builderResult;
    if (!object) return null;
    const y = opts.y !== undefined ? opts.y : heightAt(x, z) + (opts.dy || 0);
    object.position.set(x, y, z); object.rotation.y = rot;
    if (opts.scale) object.scale.setScalar(opts.scale);
    object.updateMatrixWorld(true);
    scene.add(object);
    if (!opts.noCollide) addLocalColliders(cols, x, z, rot, opts.scale || 1);
    for (const l of lights) { const p = l.pos.clone().applyMatrix4(object.matrixWorld); lightSpots.push({ pos: p, color: l.color || new THREE.Color(0xff9a4a), intensity: l.intensity || 4, distance: l.distance || 12 }); }
    for (const f of fires) { const p = f.pos.clone().applyMatrix4(object.matrixWorld); fireSpots.push({ pos: p, scale: (f.scale || 1) * (opts.scale || 1) }); }
    for (const s of smoke) { const p = s.pos.clone().applyMatrix4(object.matrixWorld); smokeSpots.push({ pos: p }); }
    let ip = null;
    if (interact && interact.pos) { ip = interact.pos.clone().applyMatrix4(object.matrixWorld); }
    return { object, interactPos: ip };
  }
  const safe = (fn, ...a) => { try { return fn ? fn(...a) : null; } catch (e) { console.warn('prop build failed', e); return null; } };

  function placeProps() {
    const P = typeof Props !== 'undefined' ? Props : {};
    // Keeper shrines (checkpoints)
    const sA = place(safe(P.buildKeeperShrine), -9.5, 146, Math.PI / 2);
    shrines.push({ id: 'A', name: '前山土地庙', pos: sA && sA.interactPos ? sA.interactPos : new THREE.Vector3(-7.8, 0, 146), spawn: new THREE.Vector3(-5.5, 0, 146), yaw: Math.PI });
    const sB = place(safe(P.buildKeeperShrine), 9.5, -27, -Math.PI / 2);
    shrines.push({ id: 'B', name: '禅院山门土地庙', pos: sB && sB.interactPos ? sB.interactPos : new THREE.Vector3(7.8, 0, -27), spawn: new THREE.Vector3(5, 0, -27), yaw: Math.PI });
    for (const s of shrines) s.pos.y = heightAt(s.pos.x, s.pos.z);

    // lanterns along the start
    for (const [x, z] of [[-6, 140], [-6, 152], [5, 132], [9, -21], [9, -33]]) place(safe(P.buildStoneLantern, { lit: true }), x, z, 0);
    // stone archway on the forest path
    place(safe(P.buildPaifang, { width: 12 }), 6.5, 40, Math.atan2(8 - 6, 50 - 30) * 0.5);
    // ruins & ruined pagoda in the clearing
    place(safe(P.buildPagoda, { levels: 7, ruined: true }), -21, -14, 0.4);
    place(safe(P.buildStatue), 18, -6, -Math.PI / 2 - 0.3);
    place(safe(P.buildRuins, 1), -14, 10, 0.6);
    place(safe(P.buildRuins, 2), 14, 12, 2.1);
    place(safe(P.buildRuins, 3), -9, -24, 1.2);
    place(safe(P.buildRuins, 4), -12, 64, 0.3);
    place(safe(P.buildBannerPole), -4, 24, 0);
    place(safe(P.buildBannerPole), 8, 22, 0);
    // stairs to the temple
    place(safe(P.buildStairs, { width: 5.4, steps: 36, rise: 0.2, run: 0.5 }), 0, STAIRS.z0, 0, { y: STAIRS.y0 });
    for (let i = 0; i < 4; i++) {
      const z = -42 - i * 5.2;
      for (const s of [-1, 1]) place(safe(P.buildStoneLantern, { lit: i % 2 === 0 }), s * 4.6, z, 0);
    }
    // temple gate + walls
    place(safe(P.buildTempleGate, { width: 16 }), 0, -62.5, 0, { y: PLATEAU_Y });
    const WALLY = PLATEAU_Y;
    // front wall pieces (from gate edge x=8 to 25)
    for (const s of [-1, 1]) {
      place(safe(P.buildWall, { length: 17.5 }), s * 16.75, -62.5, 0, { y: WALLY });
      place(safe(P.buildWall, { length: 60 }), s * 25.5, -92.5, Math.PI / 2, { y: WALLY });
      place(safe(P.buildWall, { length: 14 }), s * 18.5, -122.5, 0, { y: WALLY });
    }
    // main hall + side halls
    place(safe(P.buildTempleHall, { width: 22, depth: 14 }), 0, -131, 0, { y: PLATEAU_Y });
    place(safe(P.buildSideHall, { width: 14, depth: 8 }), -20.5, -100, Math.PI / 2, { y: PLATEAU_Y });
    place(safe(P.buildSideHall, { width: 14, depth: 8 }), 20.5, -100, -Math.PI / 2, { y: PLATEAU_Y });
    place(safe(P.buildBellPavilion), -17, -72, Math.PI / 4, { y: PLATEAU_Y });
    place(safe(P.buildIncenseBurner), 0, -76, 0, { y: PLATEAU_Y });
    for (const [x, z] of [[-10, -84], [10, -84], [-10, -112], [10, -112]]) place(safe(P.buildBrazier), x, z, 0, { y: PLATEAU_Y });
    for (const [x, z] of [[-6, -118], [6, -118]]) place(safe(P.buildStoneLantern, { lit: true }), x, z, 0, { y: PLATEAU_Y });
    place(safe(P.buildBannerPole), -5, -66.5, 0, { y: PLATEAU_Y });
    place(safe(P.buildBannerPole), 5, -66.5, 0, { y: PLATEAU_Y });
    // a second, intact pagoda behind the temple on the ridge (skyline landmark)
    place(safe(P.buildPagoda, { levels: 9, ruined: false }), 34, -150, 0.2, { noCollide: true });
  }

  // ---- Vegetation ------------------------------------------------------------
  const vegChunks = [];
  function placeVegetation() {
    if (typeof Veg === 'undefined') return;
    let kit;
    try { kit = Veg.createKit(); } catch (e) { console.warn('veg kit failed', e); return; }
    const A = kit.archetypes || {};
    const r = U.mulberry32(4242);
    const inst = []; // {arch, vi, x, z, rot, s}
    const add = (arch, x, z, s, collide) => {
      const list = A[arch]; if (!list || !list.length) return;
      const vi = Math.floor(r() * list.length);
      const rot = r() * Math.PI * 2;
      inst.push({ arch, vi, x, z, rot, s });
      if (collide) {
        const tr = (list[vi].trunkRadius || 0) * s;
        if (tr > 0) addCollider({ type: 'circle', x, z, r: Math.max(tr, 0.25) });
      }
    };
    const dens = quality.veg;
    // jittered grid scatter
    const step = 5.2 / Math.sqrt(dens);
    for (let gz = -HALF + 6; gz < HALF - 6; gz += step) for (let gx = -HALF + 6; gx < HALF - 6; gx += step) {
      const x = gx + (r() - 0.5) * step * 0.9, z = gz + (r() - 0.5) * step * 0.9;
      const sd = regionSDF(x, z);
      if (sd < 1.5) continue;
      const nForest = U.fbm2(x * 0.018 + 3, z * 0.018, 3);
      const near = sd < 30;
      let p = near ? 0.75 : 0.35;
      p *= U.clamp(0.65 + nForest * 0.9, 0.1, 1);
      if (r() > p) continue;
      // biome selection
      const bambooZone = U.smoothstep(0.15, 0.35, U.fbm2(x * 0.01 - 20, z * 0.01 + 5, 2)) * (z > -20 && z < 120 ? 1 : 0);
      const mapleZone = U.smoothstep(-0.1, 0.35, U.fbm2(x * 0.015 + 40, z * 0.015, 2)) + (z < -40 ? 0.3 : 0);
      const u = r();
      if (bambooZone > 0.5 && u < 0.7) add('bamboo', x, z, 0.8 + r() * 0.4, near);
      else if (u < 0.12) add('deadTree', x, z, 0.8 + r() * 0.5, near);
      else if (u < 0.12 + 0.4 * U.clamp(mapleZone, 0, 1)) add('maple', x, z, 0.8 + r() * 0.5, near);
      else add('pine', x, z, 0.75 + r() * 0.6, near);
    }
    // undergrowth near the walkable edges
    const ustep = 2.2 / Math.sqrt(dens);
    for (let gz = -HALF + 6; gz < HALF - 6; gz += ustep) for (let gx = -HALF + 6; gx < HALF - 6; gx += ustep) {
      const x = gx + (r() - 0.5) * ustep, z = gz + (r() - 0.5) * ustep;
      const sd = regionSDF(x, z);
      if (sd < -0.5 || sd > 22) continue;
      if (flatMask(x, z) > 0.5) continue;
      const u = r();
      if (u < 0.1) add('bush', x, z, 0.7 + r() * 0.6, false);
      else if (u < 0.2) add('fern', x, z, 0.8 + r() * 0.6, false);
      else if (u < 0.235 && sd > 0.5) add('rock', x, z, 0.5 + r() * 0.9, sd < 3);
    }
    // accent trees inside clearings (with colliders)
    const accents = [
      ['pine', -14, 150, 1.2], ['maple', 8, 150, 1.0], ['maple', -16, 98, 1.1], ['pine', 4, 100, 1.0],
      ['deadTree', -18, 2, 1.3], ['maple', 16, -18, 1.0], ['pine', 12, 18, 1.1],
      ['maple', -21, -70, 1.1], ['maple', 21, -70, 1.0], ['pine', -21, -116, 1.3], ['pine', 21, -116, 1.2],
      ['maple', -8, -30, 1.0], ['rock', 14, 90, 1.4], ['rock', -12, 36, 1.6], ['rock', 18, -2, 1.8], ['rock', -20, 6, 1.5],
    ];
    for (const [a, x, z, s] of accents) add(a, x, z, s, true);

    // group into chunks for frustum culling
    const CH = 70;
    const buckets = new Map();
    for (const it of inst) {
      const ck = Math.floor((it.x + HALF) / CH) * 100 + Math.floor((it.z + HALF) / CH);
      const bk = ck + ':' + it.arch + ':' + it.vi;
      let b = buckets.get(bk); if (!b) buckets.set(bk, b = []); b.push(it);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const [bk, list] of buckets) {
      const [, arch, vi] = bk.split(':');
      const variant = A[arch][+vi];
      for (const part of variant.parts) {
        const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach((it, i) => {
          const y = heightAt(it.x, it.z);
          q.setFromAxisAngle(up, it.rot);
          sc.setScalar(it.s);
          p.set(it.x, y, it.z);
          m.compose(p, q, sc);
          im.setMatrixAt(i, m);
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        const big = arch === 'pine' || arch === 'maple' || arch === 'deadTree' || arch === 'bamboo' || arch === 'rock';
        im.castShadow = big && quality.shadows > 0;
        im.receiveShadow = true;
        scene.add(im);
        vegChunks.push(im);
      }
    }
    // grass
    try {
      const N = NV;
      const h16 = new Uint16Array(N * N), dens8 = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) h16[i] = THREE.DataUtils.toHalfFloat(heights[i]);
      for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
        const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
        const pd = pathDist(x, z), sd = regionSDF(x, z);
        let d = 1;
        d *= U.smoothstep(PATH_W * 0.35, PATH_W * 1.0, pd + U.fbm2(x * 0.3, z * 0.3, 2) * 1.2);
        if (z < -56 || inRect(x, z, RECTS[0], 2)) d = 0;
        d *= 1 - U.smoothstep(6, 25, sd) * 0.75;
        for (const cc of CIRCLES) d *= U.smoothstep(cc.r * 0.25, cc.r * 0.7, Math.hypot(x - cc.x, z - cc.z) + U.fbm2(x * 0.2, z * 0.2, 2) * 3);
        d *= U.clamp(0.7 + U.fbm2(x * 0.07, z * 0.07, 2) * 0.8, 0, 1);
        dens8[iz * N + ix] = Math.round(U.clamp(d, 0, 1) * 255);
      }
      const ht = new THREE.DataTexture(h16, N, N, THREE.RedFormat, THREE.HalfFloatType);
      ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
      const dt = new THREE.DataTexture(dens8, N, N, THREE.RedFormat, THREE.UnsignedByteType);
      dt.magFilter = dt.minFilter = THREE.LinearFilter; dt.needsUpdate = true;
      const grass = Veg.createGrass({ heightTexture: ht, densityTexture: dt, worldSize: W, count: quality.grass, radius: quality.grassRadius });
      if (grass && grass.mesh) scene.add(grass.mesh);
      const leaves = Veg.createFallingLeaves({ count: quality.leaves, radius: 30 });
      if (leaves && leaves.mesh) scene.add(leaves.mesh);
    } catch (e) { console.warn('grass failed', e); }
  }

  // ---- Build / update ----------------------------------------------------------
  function build(ctx) {
    scene = ctx.scene; renderer = ctx.renderer; quality = ctx.quality;
    scene.fog = new THREE.FogExp2(CONFIG.FOG_COLOR, CONFIG.FOG_DENSITY);
    scene.background = CONFIG.FOG_COLOR.clone();
    buildTerrain();
    buildSky();
    buildMountains();
    buildLights();
    buildEnvironment();
    placeProps();
    placeVegetation();
  }

  let lightTimer = 0;
  function update(dt, time, camera, focus) {
    if (sky) { sky.position.copy(camera.position); skyMat.uniforms.time.value = time; }
    // sun shadow follows the focus point, snapped to shadow texels
    if (sun) {
      const S = sun.shadow.camera.right;
      const texel = (S * 2) / sun.shadow.mapSize.x;
      _v.copy(focus);
      // snap in light space (approximate: snap in world xz)
      _v.x = Math.round(_v.x / texel) * texel; _v.z = Math.round(_v.z / texel) * texel;
      sun.target.position.copy(_v);
      sun.position.copy(_v).addScaledVector(CONFIG.SUN_DIR, 120);
      sun.target.updateMatrixWorld();
    }
    if (typeof Props !== 'undefined' && Props.update) Props.update(time);
    if (typeof Veg !== 'undefined' && Veg.update) Veg.update(time, camera.position, focus);
    // assign pooled point lights to the nearest light spots
    lightTimer -= dt;
    if (lightTimer <= 0) {
      lightTimer = 0.5;
      const sorted = lightSpots.map(s => ({ s, d: s.pos.distanceToSquared(focus) })).sort((a, b) => a.d - b.d);
      const reserved = pointLights.filter(l => l.userData.reserved).length;
      let k = 0;
      for (const L of pointLights) {
        if (L.userData.reserved) continue;
        const e = sorted[k++];
        if (e && e.d < 50 * 50) {
          L.position.copy(e.s.pos); L.color.copy(e.s.color); L.distance = e.s.distance; L.userData.base = e.s.intensity;
        } else L.userData.base = 0;
      }
    }
    for (const L of pointLights) {
      if (L.userData.reserved) continue;
      const f = 0.85 + 0.15 * Math.sin(time * 13 + L.id) * Math.sin(time * 7.3 + L.id * 2);
      L.intensity = U.damp(L.intensity, L.userData.base * f, 6, dt);
    }
  }
  function reserveLight() {
    const L = pointLights.find(l => !l.userData.reserved);
    if (L) { L.userData.reserved = true; L.intensity = 0; }
    return L;
  }
  function zoneAt(x, z) {
    if (inRect(x, z, COURTYARD, 0)) return ZONES[5];
    for (const zz of ZONES) if (zz.test(x, z)) return zz;
    return ZONES[0];
  }

  return {
    build, update, heightAt, normalAt, regionSDF, collide, blocked, addCollider, reserveLight, zoneAt,
    get sun() { return sun; }, get hemi() { return hemi; }, get terrain() { return terrain; },
    fireSpots, smokeSpots, shrines, lightSpots, pointLights, COURTYARD, PLATEAU_Y, CIRCLES, PATH, inRect,
  };
})();
