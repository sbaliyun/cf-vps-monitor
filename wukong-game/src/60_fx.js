// ---------------------------------------------------------------------------
// FX: particles (additive + alpha), weapon trails, shockwaves, afterimages,
// ambient emitters (fire, incense smoke, spirit motes), seal glyphs
// ---------------------------------------------------------------------------
const FX = (() => {
  let scene, camera;
  const PMAX = 5000;

  function softTex() {
    return U.canvasTex(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, { srgb: false, repeat: false });
  }
  function smokeTex() {
    return U.canvasTex(128, 128, (g, w, h) => {
      const r = U.mulberry32(8);
      for (let i = 0; i < 40; i++) {
        const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, rad = 14 + r() * 30;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    }, { srgb: false, repeat: false });
  }

  // ---- Particle system ----------------------------------------------------------
  class Particles {
    constructor(max, blending, tex, stretch) {
      this.max = max; this.n = 0;
      this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
      this.life = new Float32Array(max); this.age = new Float32Array(max);
      this.size0 = new Float32Array(max); this.size1 = new Float32Array(max);
      this.c0 = new Float32Array(max * 4); this.c1 = new Float32Array(max * 4);
      this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.rot = new Float32Array(max); this.spin = new Float32Array(max);
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
      this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
      this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
      this.aSR = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('iPos', this.aPos); g.setAttribute('iVel', this.aVel); g.setAttribute('iCol', this.aCol); g.setAttribute('iSR', this.aSR);
      g.instanceCount = 0;
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, stretch: { value: stretch ? 1 : 0 }, ...THREE.UniformsLib.fog },
        vertexShader: /* glsl */`
          attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iCol; attribute vec2 iSR;
          uniform float stretch;
          varying vec2 vUv; varying vec4 vCol;
          #include <fog_pars_vertex>
          void main(){
            vUv = uv; vCol = iCol;
            vec4 mvPosition = modelViewMatrix * vec4(iPos, 1.0);
            vec2 q = position.xy * iSR.x;
            if (stretch > 0.5) {
              vec3 vv = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
              float sp = length(vv.xy);
              vec2 dir = sp > 1e-4 ? vv.xy / sp : vec2(0.0, 1.0);
              vec2 nrm = vec2(-dir.y, dir.x);
              float len = 1.0 + sp * 0.06 / max(iSR.x, 0.01);
              q = dir * position.y * iSR.x * len + nrm * position.x * iSR.x;
            } else {
              float c = cos(iSR.y), s = sin(iSR.y);
              q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
            }
            mvPosition.xy += q;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: /* glsl */`
          uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
          #include <fog_pars_fragment>
          void main(){
            vec4 t = texture2D(map, vUv);
            gl_FragColor = vec4(vCol.rgb, vCol.a * t.a * t.r);
            if (gl_FragColor.a < 0.003) discard;
            #include <fog_fragment>
          }`,
        transparent: true, depthWrite: false, blending, fog: true,
      });
      this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = blending === THREE.AdditiveBlending ? 20 : 19;
      this.geo = g;
    }
    emit(o) {
      if (this.n >= this.max) return;
      const i = this.n++;
      this.p[i * 3] = o.x; this.p[i * 3 + 1] = o.y; this.p[i * 3 + 2] = o.z;
      this.v[i * 3] = o.vx || 0; this.v[i * 3 + 1] = o.vy || 0; this.v[i * 3 + 2] = o.vz || 0;
      this.life[i] = o.life || 1; this.age[i] = 0;
      this.size0[i] = o.s0 ?? 0.2; this.size1[i] = o.s1 ?? this.size0[i];
      const c0 = o.c0 || [1, 1, 1, 1], c1 = o.c1 || [c0[0], c0[1], c0[2], 0];
      for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = c0[k]; this.c1[i * 4 + k] = c1[k]; }
      this.grav[i] = o.g || 0; this.drag[i] = o.drag || 0; this.rot[i] = o.rot ?? Math.random() * 6.28; this.spin[i] = o.spin || 0;
    }
    update(dt) {
      let n = this.n;
      for (let i = 0; i < n; i++) {
        this.age[i] += dt;
        if (this.age[i] >= this.life[i]) {
          // swap-remove
          n--;
          if (i !== n) this.copy(n, i);
          i--; continue;
        }
        const dr = Math.max(0, 1 - this.drag[i] * dt);
        this.v[i * 3] *= dr; this.v[i * 3 + 1] = this.v[i * 3 + 1] * dr - this.grav[i] * dt; this.v[i * 3 + 2] *= dr;
        this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        this.rot[i] += this.spin[i] * dt;
      }
      this.n = n;
      const P = this.aPos.array, Vv = this.aVel.array, C = this.aCol.array, S = this.aSR.array;
      for (let i = 0; i < n; i++) {
        const t = this.age[i] / this.life[i];
        P[i * 3] = this.p[i * 3]; P[i * 3 + 1] = this.p[i * 3 + 1]; P[i * 3 + 2] = this.p[i * 3 + 2];
        Vv[i * 3] = this.v[i * 3]; Vv[i * 3 + 1] = this.v[i * 3 + 1]; Vv[i * 3 + 2] = this.v[i * 3 + 2];
        for (let k = 0; k < 4; k++) C[i * 4 + k] = this.c0[i * 4 + k] + (this.c1[i * 4 + k] - this.c0[i * 4 + k]) * t;
        // fade-in for the first 10%
        if (t < 0.1) C[i * 4 + 3] *= t / 0.1;
        S[i * 2] = this.size0[i] + (this.size1[i] - this.size0[i]) * t; S[i * 2 + 1] = this.rot[i];
      }
      this.geo.instanceCount = n;
      this.aPos.needsUpdate = this.aVel.needsUpdate = this.aCol.needsUpdate = this.aSR.needsUpdate = true;
      this.aPos.addUpdateRange(0, n * 3); this.aVel.addUpdateRange(0, n * 3); this.aCol.addUpdateRange(0, n * 4); this.aSR.addUpdateRange(0, n * 2);
    }
    copy(from, to) {
      for (let k = 0; k < 3; k++) { this.p[to * 3 + k] = this.p[from * 3 + k]; this.v[to * 3 + k] = this.v[from * 3 + k]; }
      for (let k = 0; k < 4; k++) { this.c0[to * 4 + k] = this.c0[from * 4 + k]; this.c1[to * 4 + k] = this.c1[from * 4 + k]; }
      this.life[to] = this.life[from]; this.age[to] = this.age[from]; this.size0[to] = this.size0[from]; this.size1[to] = this.size1[from];
      this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.rot[to] = this.rot[from]; this.spin[to] = this.spin[from];
    }
  }

  let add, alpha, sparks;
  const R = (a, b) => a + Math.random() * (b - a);

  // ---- Weapon trails ----------------------------------------------------------------
  class Trail {
    constructor(color = [1, 0.85, 0.5], max = 36, width = 1) {
      this.max = max; this.pts = []; this.color = color; this.active = false;
      const g = new THREE.BufferGeometry();
      this.pos = new Float32Array(max * 2 * 3); this.al = new Float32Array(max * 2); this.uvx = new Float32Array(max * 2 * 2);
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('alpha', new THREE.BufferAttribute(this.al, 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('uv', new THREE.BufferAttribute(this.uvx, 2).setUsage(THREE.DynamicDrawUsage));
      const idx = [];
      for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(idx);
      this.geo = g;
      this.mat = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(...color) }, intensity: { value: 1 } },
        vertexShader: `attribute float alpha; varying float vA; varying vec2 vUv; void main(){ vA = alpha; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 color; uniform float intensity; varying float vA; varying vec2 vUv;
          void main(){ float edge = smoothstep(0.0, 0.6, vUv.y); float core = pow(vUv.y, 4.0);
            vec3 c = mix(color, vec3(1.0, 0.95, 0.85), core * 0.5) * intensity * (0.5 + core * 1.6);
            gl_FragColor = vec4(c, vA * edge * (0.08 + core * 0.55)); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 21;
    }
    push(a, b) {
      // a = inner point, b = outer (tip); subdivide from the previous sample for smooth arcs
      const last = this.pts[this.pts.length - 1];
      if (last) {
        const d = last.b.distanceTo(b);
        const steps = Math.min(4, Math.floor(d / 0.25));
        for (let s = 1; s <= steps; s++) {
          const t = s / (steps + 1);
          // arc interpolation around the inner point (keeps the swing curved)
          const ia = last.a.clone().lerp(a, t);
          const la = last.b.clone().sub(last.a), lb = b.clone().sub(a);
          const len = U.lerp(la.length(), lb.length(), t);
          const dir = la.normalize().lerp(lb.normalize(), t).normalize();
          this.pts.push({ a: ia, b: ia.clone().addScaledVector(dir, len), age: U.lerp(last.age, 0, t) });
        }
      }
      this.pts.push({ a: a.clone(), b: b.clone(), age: 0 });
      while (this.pts.length > this.max) this.pts.shift();
    }
    update(dt, life = 0.12) {
      for (const p of this.pts) p.age += dt;
      while (this.pts.length && this.pts[0].age > life) this.pts.shift();
      const n = this.pts.length;
      for (let i = 0; i < this.max; i++) {
        const p = this.pts[Math.min(i, n - 1)];
        if (!p) { this.al[i * 2] = this.al[i * 2 + 1] = 0; continue; }
        const j = i * 6;
        this.pos[j] = p.a.x; this.pos[j + 1] = p.a.y; this.pos[j + 2] = p.a.z;
        this.pos[j + 3] = p.b.x; this.pos[j + 4] = p.b.y; this.pos[j + 5] = p.b.z;
        const f = i < n ? Math.pow(1 - p.age / life, 1.5) * (i / Math.max(n - 1, 1)) : 0;
        this.al[i * 2] = f; this.al[i * 2 + 1] = f;
        this.uvx[i * 4] = i / this.max; this.uvx[i * 4 + 1] = 0; this.uvx[i * 4 + 2] = i / this.max; this.uvx[i * 4 + 3] = 1;
      }
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true; this.geo.attributes.uv.needsUpdate = true;
      this.mesh.visible = n > 1;
    }
    clear() { this.pts.length = 0; }
  }
  const trails = [];
  function makeTrail(color, max) { const t = new Trail(color, max); scene.add(t.mesh); trails.push(t); return t; }

  // ---- Ground shockwaves -------------------------------------------------------------
  const rings = [];
  let ringGeo, ringMatProto;
  function shockwave(pos, radius = 3, color = [1, 0.8, 0.45], life = 0.5, thick = 0.25) {
    const m = ringMatProto.clone();
    m.uniforms = { color: { value: new THREE.Color(...color) }, t: { value: 0 }, thick: { value: thick } };
    const mesh = new THREE.Mesh(ringGeo, m);
    mesh.position.copy(pos); mesh.position.y += 0.08; mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 22; scene.add(mesh);
    rings.push({ mesh, age: 0, life, radius });
  }

  // ---- Afterimages -------------------------------------------------------------------
  const ghosts = [];
  function afterimage(meshes, color = 0x7fb0ff, life = 0.35, opacity = 0.45) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const group = [];
    for (const m of meshes) {
      if (!m.visible || !m.geometry) continue;
      m.updateWorldMatrix(true, false);
      const g = new THREE.Mesh(m.geometry, mat);
      g.matrixAutoUpdate = false; g.matrix.copy(m.matrixWorld); g.frustumCulled = false;
      scene.add(g); group.push(g);
    }
    ghosts.push({ group, mat, age: 0, life, o: opacity });
  }

  // ---- Seal glyph sprite (定) ----------------------------------------------------------
  function glyphTexture(ch, color = '#ffd27a') {
    return U.canvasTex(256, 256, (g, w, h) => {
      g.strokeStyle = color; g.lineWidth = 6; g.globalAlpha = 0.9;
      g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.arc(128, 128, 96, 0, Math.PI * 2); g.stroke();
      g.font = 'bold 150px "Ma Shan Zheng", "KaiTi", "STKaiti", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ff9a20'; g.shadowBlur = 24; g.fillStyle = color; g.fillText(ch, 128, 136);
    }, { repeat: false });
  }
  const sealTexCache = {};
  function sealSprite(ch) {
    if (!sealTexCache[ch]) sealTexCache[ch] = glyphTexture(ch);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sealTexCache[ch], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.renderOrder = 30; s.scale.setScalar(1.1);
    scene.add(s);
    return s;
  }

  // ---- Ambient emitters -----------------------------------------------------------------
  let fireAcc = 0, smokeAcc = 0, moteAcc = 0;
  const _v = new THREE.Vector3();

  // ---- Presets ----------------------------------------------------------------------------
  function hitSparks(p, dir, n = 16, color = [1, 0.8, 0.4], speed = 7) {
    for (let i = 0; i < n; i++) {
      const vx = (dir ? dir.x * speed * 0.6 : 0) + R(-1, 1) * speed * 0.6, vy = R(0.2, 1.3) * speed * 0.5, vz = (dir ? dir.z * speed * 0.6 : 0) + R(-1, 1) * speed * 0.6;
      sparks.emit({ x: p.x, y: p.y, z: p.z, vx, vy, vz, life: R(0.15, 0.45), s0: R(0.02, 0.05), s1: 0.005, c0: [color[0] * 3, color[1] * 3, color[2] * 3, 1], c1: [color[0], color[1] * 0.5, color[2] * 0.2, 0], g: 9, drag: 2 });
    }
    add.emit({ x: p.x, y: p.y, z: p.z, life: 0.12, s0: 0.5, s1: 1.4, c0: [2.2, 1.7, 1.1, 0.9], c1: [1, 0.6, 0.3, 0] });
  }
  function inkSplash(p, dir, n = 10) {
    // dark demon "blood" (ink) droplets
    for (let i = 0; i < n; i++) {
      alpha.emit({ x: p.x, y: p.y, z: p.z, vx: dir.x * R(1, 4) + R(-1.5, 1.5), vy: R(0.5, 3), vz: dir.z * R(1, 4) + R(-1.5, 1.5), life: R(0.3, 0.6), s0: R(0.05, 0.1), s1: R(0.02, 0.05), c0: [0.12, 0.03, 0.03, 0.9], c1: [0.05, 0.01, 0.01, 0], g: 9, drag: 1 });
    }
  }
  function dust(p, n = 12, r = 1, color = [0.45, 0.4, 0.34]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = R(1, 3) * r;
      alpha.emit({ x: p.x + Math.cos(a) * 0.3 * r, y: p.y + 0.1, z: p.z + Math.sin(a) * 0.3 * r, vx: Math.cos(a) * sp, vy: R(0.3, 1.2), vz: Math.sin(a) * sp, life: R(0.6, 1.2), s0: R(0.3, 0.6) * r, s1: R(1.2, 2.2) * r, c0: [...color, 0.45], c1: [...color, 0], drag: 3, spin: R(-1, 1) });
    }
  }
  function slamFX(p, r = 3, color = [1, 0.8, 0.45]) {
    shockwave(p, r, color, 0.55, 0.28);
    dust(p, 22, r * 0.5);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = R(3, 8);
      sparks.emit({ x: p.x, y: p.y + 0.1, z: p.z, vx: Math.cos(a) * sp, vy: R(2, 6), vz: Math.sin(a) * sp, life: R(0.3, 0.7), s0: 0.05, s1: 0.01, c0: [color[0] * 3, color[1] * 3, color[2] * 3, 1], c1: [1, 0.3, 0.1, 0], g: 12, drag: 1 });
    }
    // rocks
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, sp = R(2, 5);
      alpha.emit({ x: p.x, y: p.y + 0.1, z: p.z, vx: Math.cos(a) * sp, vy: R(3, 6), vz: Math.sin(a) * sp, life: R(0.5, 0.9), s0: R(0.06, 0.14), s1: 0.05, c0: [0.2, 0.18, 0.15, 1], c1: [0.2, 0.18, 0.15, 0.6], g: 14, spin: R(-8, 8) });
    }
  }
  function fireBurst(p, n = 30, r = 1, big = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = R(0.5, 3) * r;
      add.emit({ x: p.x + R(-0.3, 0.3) * r, y: p.y + R(0, 0.4), z: p.z + R(-0.3, 0.3) * r, vx: Math.cos(a) * sp, vy: R(1.5, 4) * (big ? 1.4 : 1), vz: Math.sin(a) * sp, life: R(0.4, 0.9), s0: R(0.4, 0.8) * r, s1: R(0.1, 0.3), c0: [3.2, 1.4, 0.4, 0.9], c1: [1.2, 0.2, 0.05, 0], drag: 1.5, spin: R(-2, 2) });
    }
    for (let i = 0; i < n / 3; i++) alpha.emit({ x: p.x, y: p.y + 0.8, z: p.z, vx: R(-0.5, 0.5), vy: R(1, 2), vz: R(-0.5, 0.5), life: R(1, 1.8), s0: 0.6 * r, s1: 2 * r, c0: [0.12, 0.1, 0.09, 0.35], c1: [0.2, 0.18, 0.16, 0], drag: 0.8 });
  }
  function flame(p, s = 1, vy = 1.4) {
    add.emit({ x: p.x + R(-0.06, 0.06) * s, y: p.y, z: p.z + R(-0.06, 0.06) * s, vx: R(-0.15, 0.15), vy: R(0.6, 1) * vy * s, vz: R(-0.15, 0.15), life: R(0.35, 0.7), s0: R(0.25, 0.4) * s, s1: 0.05 * s, c0: [3.0, 1.35, 0.35, 0.85], c1: [1.4, 0.25, 0.05, 0], spin: R(-1, 1) });
  }
  function ember(p, s = 1) {
    sparks.emit({ x: p.x + R(-0.2, 0.2) * s, y: p.y + R(0, 0.3), z: p.z + R(-0.2, 0.2) * s, vx: R(-0.4, 0.4), vy: R(0.8, 2.2), vz: R(-0.4, 0.4), life: R(0.8, 1.8), s0: 0.025, s1: 0.01, c0: [3, 1.4, 0.4, 1], c1: [1.5, 0.4, 0.1, 0], drag: 0.6 });
  }
  function spiritMote(p, color = [1.4, 1.05, 0.5]) {
    add.emit({ x: p.x, y: p.y, z: p.z, vx: R(-0.2, 0.2), vy: R(0.2, 0.6), vz: R(-0.2, 0.2), life: R(1.5, 3), s0: R(0.05, 0.1), s1: 0.02, c0: [...color, 0.9], c1: [color[0], color[1], color[2], 0], drag: 0.3 });
  }
  function puff(p, color = [1.6, 1.2, 0.6], n = 20, r = 0.8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = R(-0.3, 1);
      add.emit({ x: p.x, y: p.y + R(0, 1.4), z: p.z, vx: Math.cos(a) * R(0.5, 2) * r, vy: e * 1.5, vz: Math.sin(a) * R(0.5, 2) * r, life: R(0.4, 0.8), s0: R(0.2, 0.4) * r, s1: R(0.5, 1) * r, c0: [...color, 0.5], c1: [color[0], color[1], color[2], 0], drag: 3 });
    }
  }

  // ---- Cloth ribbons (verlet) ---------------------------------------------------------------
  const ribbons = [];
  class Ribbon {
    constructor(anchor, local, { n = 9, len = 0.5, w = 0.07, color = 0x7a1a12, side = new THREE.Vector3(1, 0, 0) } = {}) {
      this.anchor = anchor; this.local = local.clone(); this.n = n; this.seg = len / (n - 1); this.w = w; this.side = side.clone();
      this.p = [...Array(n)].map(() => new THREE.Vector3()); this.o = [...Array(n)].map(() => new THREE.Vector3());
      this.init = false;
      const g = new THREE.BufferGeometry();
      this.pos = new Float32Array(n * 2 * 3);
      const uv = [], idx = [];
      for (let i = 0; i < n; i++) { uv.push(0, 1 - i / (n - 1), 1, 1 - i / (n - 1)); if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      this.geo = g;
      const tex = U.canvasTex(32, 128, (c, W, H) => {
        c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
        c.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);
        c.clearRect(0, H - 10, W, 10); c.beginPath(); c.moveTo(0, H - 10); for (let x = 0; x <= W; x += 4) c.lineTo(x, H - 10 + (x % 8 ? 8 : 2)); c.lineTo(W, H - 10); c.fillStyle = '#fff'; c.fill();
      }, { repeat: false });
      this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, map: tex, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide }));
      this.mesh.frustumCulled = false; this.mesh.castShadow = true;
      scene.add(this.mesh); ribbons.push(this);
      this.colliders = [];
      this.t = Math.random() * 10;
    }
    update(dt) {
      if (dt <= 0) return;
      dt = Math.min(dt, 1 / 30);
      this.t += dt;
      const root = this.anchor.localToWorld(U.tmpV[6].copy(this.local));
      if (this.init && this.p[0].distanceToSquared(root) > 1.0) this.init = false;
      if (!this.init) { for (let i = 0; i < this.n; i++) { this.p[i].copy(root).y -= i * this.seg; this.o[i].copy(this.p[i]); } this.init = true; }
      const wind = U.tmpV[7].set(Math.sin(this.t * 1.3) * 0.6 + 0.4, 0, Math.cos(this.t * 0.9) * 0.4);
      for (let i = 1; i < this.n; i++) {
        const p = this.p[i], o = this.o[i];
        const vx = (p.x - o.x) * 0.96, vy = (p.y - o.y) * 0.96, vz = (p.z - o.z) * 0.96;
        o.copy(p);
        p.x += vx + wind.x * dt * dt * 3; p.y += vy - 9.8 * dt * dt; p.z += vz + wind.z * dt * dt * 3;
      }
      this.p[0].copy(root);
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < this.n; i++) {
          const a = this.p[i - 1], b = this.p[i];
          const d = U.tmpV[8].subVectors(b, a); const l = d.length() || 1e-6;
          const diff = (l - this.seg) / l;
          if (i === 1) b.addScaledVector(d, -diff); else { a.addScaledVector(d, diff * 0.5); b.addScaledVector(d, -diff * 0.5); }
        }
        for (const c of this.colliders) {
          const cp = c.obj.localToWorld(U.tmpV[9].copy(c.off));
          for (let i = 1; i < this.n; i++) {
            const d = U.tmpV[10].subVectors(this.p[i], cp); const l = d.length();
            if (l < c.r) this.p[i].copy(cp).addScaledVector(d.normalize(), c.r);
          }
        }
      }
      const side = U.tmpV[11].copy(this.side).applyQuaternion(this.anchor.getWorldQuaternion(U.tmpQ[0])).multiplyScalar(this.w / 2);
      for (let i = 0; i < this.n; i++) {
        const p = this.p[i], k = i * 6, w = 1 - i / this.n * 0.3;
        this.pos[k] = p.x - side.x * w; this.pos[k + 1] = p.y - side.y * w; this.pos[k + 2] = p.z - side.z * w;
        this.pos[k + 3] = p.x + side.x * w; this.pos[k + 4] = p.y + side.y * w; this.pos[k + 5] = p.z + side.z * w;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.computeVertexNormals();
    }
    reset() { this.init = false; }
    set visible(v) { this.mesh.visible = v; }
  }
  function ribbon(anchor, local, opts) { return new Ribbon(anchor, local, opts); }

  // ---- Init / update ----------------------------------------------------------------------
  function init(sc, cam) {
    scene = sc; camera = cam;
    const soft = softTex();
    add = new Particles(PMAX, THREE.AdditiveBlending, soft, false);
    sparks = new Particles(2000, THREE.AdditiveBlending, soft, true);
    alpha = new Particles(2500, THREE.NormalBlending, smokeTex(), false);
    scene.add(add.mesh); scene.add(sparks.mesh); scene.add(alpha.mesh);
    ringGeo = new THREE.PlaneGeometry(2, 2);
    ringMatProto = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color() }, t: { value: 0 }, thick: { value: 0.25 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float t, thick; varying vec2 vUv;
        void main(){ float r = length(vUv); float rr = t; float w = thick * (1.0 - t * 0.6);
          float a = smoothstep(rr - w, rr, r) * (1.0 - smoothstep(rr, rr + 0.03, r));
          a *= (1.0 - t) * (1.0 - t);
          gl_FragColor = vec4(color * 2.5 * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  }
  function update(dt, time) {
    add.update(dt); sparks.update(dt); alpha.update(dt);
    for (const t of trails) t.update(dt);
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) { scene.remove(r.mesh); r.mesh.material.dispose(); rings.splice(i, 1); continue; }
      r.mesh.material.uniforms.t.value = U.easeOutCubic(t);
      r.mesh.scale.setScalar(r.radius);
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i]; g.age += dt;
      const t = g.age / g.life;
      if (t >= 1) { g.group.forEach(m => scene.remove(m)); g.mat.dispose(); ghosts.splice(i, 1); continue; }
      g.mat.opacity = g.o * (1 - t) * (1 - t);
    }
    // ambient emitters near the camera
    const cp = camera.position;
    fireAcc += dt; smokeAcc += dt; moteAcc += dt;
    if (fireAcc > 0.03) {
      fireAcc = 0;
      for (const f of World.fireSpots) {
        if (f.pos.distanceToSquared(cp) > 55 * 55) continue;
        flame(f.pos, f.scale, 1.2);
        if (Math.random() < 0.15 * f.scale) ember(f.pos, f.scale);
      }
    }
    if (smokeAcc > 0.12) {
      smokeAcc = 0;
      for (const s of World.smokeSpots) {
        if (s.pos.distanceToSquared(cp) > 50 * 50) continue;
        alpha.emit({ x: s.pos.x + R(-0.05, 0.05), y: s.pos.y, z: s.pos.z + R(-0.05, 0.05), vx: R(-0.05, 0.05) + 0.1, vy: R(0.3, 0.5), vz: R(-0.05, 0.05), life: R(3, 5), s0: 0.1, s1: 1.2, c0: [0.75, 0.73, 0.7, 0.3], c1: [0.8, 0.78, 0.75, 0], spin: R(-0.3, 0.3) });
      }
    }
    if (moteAcc > 0.25) {
      moteAcc = 0;
      for (const s of World.shrines) {
        if (s.pos.distanceToSquared(cp) > 40 * 40) continue;
        spiritMote(_v.set(s.pos.x + R(-1.5, 1.5), s.pos.y + R(0.2, 1.8), s.pos.z + R(-1.5, 1.5)));
      }
    }
  }

  return {
    init, update, makeTrail, ribbon, shockwave, afterimage, sealSprite, hitSparks, inkSplash, dust, slamFX, fireBurst, flame, ember, spiritMote, puff,
    get add() { return add; }, get alpha() { return alpha; }, get sparks() { return sparks; }, R,
  };
})();
