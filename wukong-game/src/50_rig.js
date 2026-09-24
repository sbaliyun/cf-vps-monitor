// ---------------------------------------------------------------------------
// Rig: humanoid skeleton, flat pose arrays, blending, weapon-driven two-bone IK
// ---------------------------------------------------------------------------
const Rig = (() => {
  const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
  const JI = {}; JOINTS.forEach((n, i) => JI[n] = i);
  const NJ = JOINTS.length;
  const O_HP = NJ * 3;            // hips position offset (3)
  const O_W = O_HP + 3;           // weapon: p(3) d(3) roll g g2 w2
  const O_JAW = O_W + 10;         // jaw open
  const O_TAILY = O_JAW + 1;      // tail lift
  const SIZE = O_TAILY + 1;

  const ZERO = new Float32Array(SIZE);

  // Build a pose array from a sparse description, on top of an optional base pose.
  // desc: { hips:[x,y,z], ... , hp:[x,y,z], w:{p,d,roll,g,g2,w2}, jaw, tail }
  function pose(desc = {}, base = null) {
    const a = base ? Float32Array.from(base) : new Float32Array(SIZE);
    if (!base) { a[O_W + 3] = 0; a[O_W + 4] = 1; a[O_W + 5] = 0; }
    for (const k in desc) {
      const v = desc[k];
      if (k in JI) { const o = JI[k] * 3; a[o] = v[0] || 0; a[o + 1] = v[1] || 0; a[o + 2] = v[2] || 0; }
      else if (k === 'hp') { a[O_HP] = v[0] || 0; a[O_HP + 1] = v[1] || 0; a[O_HP + 2] = v[2] || 0; }
      else if (k === 'w') {
        if (v.p) { a[O_W] = v.p[0]; a[O_W + 1] = v.p[1]; a[O_W + 2] = v.p[2]; }
        if (v.d) { const l = Math.hypot(v.d[0], v.d[1], v.d[2]) || 1; a[O_W + 3] = v.d[0] / l; a[O_W + 4] = v.d[1] / l; a[O_W + 5] = v.d[2] / l; }
        if (v.roll !== undefined) a[O_W + 6] = v.roll;
        if (v.g !== undefined) a[O_W + 7] = v.g;
        if (v.g2 !== undefined) a[O_W + 8] = v.g2;
        if (v.w2 !== undefined) a[O_W + 9] = v.w2;
      }
      else if (k === 'jaw') a[O_JAW] = v;
      else if (k === 'tail') a[O_TAILY] = v;
    }
    return a;
  }

  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _va = new THREE.Vector3(), _vb = new THREE.Vector3();
  const _Y = new THREE.Vector3(0, 1, 0);
  // out = lerp(a, b, t) with spherical interpolation for the weapon direction
  function blend(out, a, b, t) {
    if (t <= 0) { if (out !== a) out.set(a); return out; }
    if (t >= 1) { if (out !== b) out.set(b); return out; }
    const dA = [a[O_W + 3], a[O_W + 4], a[O_W + 5]], dB = [b[O_W + 3], b[O_W + 4], b[O_W + 5]];
    for (let i = 0; i < SIZE; i++) out[i] = a[i] + (b[i] - a[i]) * t;
    _va.set(dA[0], dA[1], dA[2]); _vb.set(dB[0], dB[1], dB[2]);
    const dot = _va.dot(_vb);
    if (dot > -0.97) {
      _qa.setFromUnitVectors(_va, _vb); _qb.identity().slerp(_qa, t);
      _va.applyQuaternion(_qb);
    } else { _va.lerp(_vb, t).normalize(); if (_va.lengthSq() < 1e-6) _va.set(0, 1, 0); }
    out[O_W + 3] = _va.x; out[O_W + 4] = _va.y; out[O_W + 5] = _va.z;
    return out;
  }
  // additive: out = base + (add - ref) * w for joint angles only
  function addLayer(out, add, w) {
    for (let i = 0; i < O_HP + 3; i++) out[i] += add[i] * w;
    return out;
  }

  // ---- Clips -------------------------------------------------------------------
  // keys: [[t, pose, ease?], ...]
  function sampleClip(out, clip, t) {
    const k = clip.keys;
    if (t <= k[0][0]) { out.set(k[0][1]); return out; }
    for (let i = 0; i < k.length - 1; i++) {
      if (t <= k[i + 1][0]) {
        const t0 = k[i][0], t1 = k[i + 1][0];
        const e = U.EASE[k[i + 1][2] || 'io'] || U.EASE.io;
        return blend(out, k[i][1], k[i + 1][1], e((t - t0) / Math.max(t1 - t0, 1e-5)));
      }
    }
    out.set(k[k.length - 1][1]);
    return out;
  }

  // ---- Humanoid ---------------------------------------------------------------
  class Humanoid {
    constructor(spec) {
      this.spec = spec;
      this.root = new THREE.Group();
      this.j = {};
      const J = (name, parent, pos, order = 'XYZ') => {
        const o = new THREE.Group(); o.name = name; o.rotation.order = order;
        o.position.set(pos[0], pos[1], pos[2]);
        (parent ? this.j[parent] : this.root).add(o);
        this.j[name] = o; return o;
      };
      const s = spec;
      J('hips', null, [0, s.hipH, 0], 'YXZ');
      J('spine', 'hips', [0, s.spine, 0], 'YXZ');
      J('chest', 'spine', [0, s.chest, 0], 'YXZ');
      J('neck', 'chest', [0, s.neck[1], s.neck[2]], 'YXZ');
      J('head', 'neck', [0, s.head[1], s.head[2]], 'YXZ');
      J('armL', 'chest', [s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      J('foreL', 'armL', [0, -s.upper, 0]);
      J('handL', 'foreL', [0, -s.fore, 0]);
      J('armR', 'chest', [-s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      J('foreR', 'armR', [0, -s.upper, 0]);
      J('handR', 'foreR', [0, -s.fore, 0]);
      J('thighL', 'hips', [s.hipW, -0.03, 0]);
      J('shinL', 'thighL', [0, -s.thigh, 0]);
      J('footL', 'shinL', [0, -s.shin, 0]);
      J('thighR', 'hips', [-s.hipW, -0.03, 0]);
      J('shinR', 'thighR', [0, -s.thigh, 0]);
      J('footR', 'shinR', [0, -s.shin, 0]);
      if (s.jaw) J('jaw', 'head', s.jaw);
      // tail chain
      this.tail = [];
      if (s.tail) {
        let parent = 'hips';
        for (let i = 0; i < s.tail.n; i++) {
          const nm = 'tail' + i;
          J(nm, parent, i === 0 ? s.tail.root : [0, 0, -s.tail.seg]);
          this.tail.push(this.j[nm]); parent = nm;
        }
      }
      this.weapon = null;       // Object3D child of chest; staff axis = local +Y
      this.weaponLen = 0;
      this.pose = pose();
      this.tailPhase = Math.random() * 10;
      this.fkL = [new THREE.Quaternion(), new THREE.Quaternion()];
      this.poleR = new THREE.Vector3(-0.45, -0.55, -0.7).normalize();
      this.poleL = new THREE.Vector3(0.45, -0.55, -0.7).normalize();
      this.post = null; // (rig, pose, dt) hook for secondary motion
      this.handGripR = new THREE.Vector3();
    }
    attachWeapon(obj, len) {
      this.weapon = obj; this.weaponLen = len;
      this.j.chest.add(obj);
    }
    // world-space point on the weapon at local axis coordinate y
    weaponPoint(y, out) {
      out.set(0, y, 0);
      return this.weapon.localToWorld(out);
    }
    apply(p, dt = 0.016) {
      const j = this.j;
      for (let i = 0; i < NJ; i++) {
        const o = j[JOINTS[i]];
        o.rotation.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      }
      j.hips.position.set(p[O_HP], this.spec.hipH + p[O_HP + 1], p[O_HP + 2]);
      if (j.jaw) j.jaw.rotation.x = p[O_JAW];
      // tail: gentle sway, lifts with p.tail
      if (this.tail.length) {
        this.tailPhase += dt * 2.2;
        const lift = p[O_TAILY];
        const base = this.spec.tail.base ?? -0.9, curl = this.spec.tail.curl ?? -0.12;
        for (let i = 0; i < this.tail.length; i++) {
          const t = this.tail[i];
          t.rotation.x = (i === 0 ? base + lift * 0.6 : curl + lift * 0.1) + Math.sin(this.tailPhase * 0.7 + i * 0.6) * 0.05;
          t.rotation.y = Math.sin(this.tailPhase + i * 0.9) * (0.12 + i * 0.03);
        }
      }
      this.root.updateMatrixWorld(true);
      if (this.weapon) this.solveWeapon(p);
      if (this.post) this.post(this, p, dt);
    }
    solveWeapon(p) {
      const w = this.weapon;
      const d = _va.set(p[O_W + 3], p[O_W + 4], p[O_W + 5]).normalize();
      w.quaternion.setFromUnitVectors(_Y, d);
      if (p[O_W + 6]) { _qa.setFromAxisAngle(d, p[O_W + 6]); w.quaternion.premultiply(_qa); }
      const g = p[O_W + 7];
      // weapon position so that local (0,g,0) sits at the hand target p
      _vb.set(0, g, 0).applyQuaternion(w.quaternion);
      w.position.set(p[O_W] - _vb.x, p[O_W + 1] - _vb.y, p[O_W + 2] - _vb.z);
      w.updateMatrixWorld(true);
      // right arm IK to the grip
      const tgt = this.weaponPoint(g, _T1);
      const chestQ = this.j.chest.getWorldQuaternion(_qCW);
      _pole.copy(this.poleR).applyQuaternion(chestQ);
      solveTwoBone(this.j.armR, this.j.foreR, this.j.handR, tgt, _pole, this.spec.upper, this.spec.fore);
      // snap weapon to the actual hand if out of reach
      const hand = this.j.handR.getWorldPosition(_T2);
      this.handGripR.copy(hand);
      if (hand.distanceToSquared(tgt) > 1e-6) {
        _T3.subVectors(hand, tgt);
        // convert delta to chest space
        _qInv.copy(chestQ).invert();
        _T3.applyQuaternion(_qInv).divide(this.j.chest.getWorldScale(_T4));
        w.position.add(_T3); w.updateMatrixWorld(true);
      }
      // left hand
      const w2 = p[O_W + 9];
      if (w2 > 0.001) {
        const armL = this.j.armL, foreL = this.j.foreL;
        this.fkL[0].copy(armL.quaternion); this.fkL[1].copy(foreL.quaternion);
        const t2 = this.weaponPoint(p[O_W + 8], _T1);
        _pole.copy(this.poleL).applyQuaternion(chestQ);
        solveTwoBone(armL, foreL, this.j.handL, t2, _pole, this.spec.upper, this.spec.fore);
        if (w2 < 0.999) {
          _qa.copy(armL.quaternion); _qb.copy(foreL.quaternion);
          armL.quaternion.copy(this.fkL[0]).slerp(_qa, w2);
          foreL.quaternion.copy(this.fkL[1]).slerp(_qb, w2);
          armL.updateMatrixWorld(true);
        }
      }
    }
  }
  const _T1 = new THREE.Vector3(), _T2 = new THREE.Vector3(), _T3 = new THREE.Vector3(), _T4 = new THREE.Vector3();
  const _pole = new THREE.Vector3(), _qCW = new THREE.Quaternion(), _qInv = new THREE.Quaternion();
  const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _D = new THREE.Vector3(), _P = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
  const DOWN = new THREE.Vector3(0, -1, 0), _DIR = new THREE.Vector3();
  function aimBone(bone, worldDir) {
    bone.parent.getWorldQuaternion(_pq);
    _pq.invert();
    _D.copy(worldDir).applyQuaternion(_pq).normalize();
    bone.quaternion.setFromUnitVectors(DOWN, _D);
    bone.updateMatrixWorld(true);
  }
  function solveTwoBone(upper, fore, hand, target, pole, a, b) {
    upper.getWorldPosition(_S);
    const sc = upper.parent.getWorldScale(_T4).x;
    a *= sc; b *= sc;
    _D.subVectors(target, _S);
    let dist = _D.length();
    const maxR = (a + b) * 0.999, minR = Math.abs(a - b) + 0.01;
    dist = U.clamp(dist, minR, maxR);
    const dir = _DIR.copy(_D).normalize();
    _P.copy(pole).addScaledVector(dir, -pole.dot(dir));
    if (_P.lengthSq() < 1e-6) _P.set(0, -1, 0).addScaledVector(dir, dir.y);
    _P.normalize();
    const cosA = U.clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    _E.copy(_S).addScaledVector(dir, a * cosA).addScaledVector(_P, a * sinA);
    aimBone(upper, _T3.subVectors(_E, _S));
    const tc = _T2.copy(_S).addScaledVector(dir, dist);
    fore.getWorldPosition(_E);
    aimBone(fore, _T3.subVectors(tc, _E));
    // hand keeps straight wrist
    hand.quaternion.identity(); hand.updateMatrixWorld(true);
  }

  // ---- Geometry helpers ---------------------------------------------------------
  // tapered limb along -Y from 0 to -len with rounded ends
  function limb(len, r0, r1, seg = 14, capSeg = 5) {
    const pts = [];
    for (let i = 0; i <= capSeg; i++) { const a = Math.PI / 2 * (i / capSeg); pts.push(new THREE.Vector2(Math.sin(a) * r0 + 1e-4, Math.cos(a) * r0)); }
    const mid = 4;
    for (let i = 1; i < mid; i++) { const t = i / mid; pts.push(new THREE.Vector2(U.lerp(r0, r1, t) * (1 + Math.sin(t * Math.PI) * 0.06), -len * t)); }
    for (let i = 0; i <= capSeg; i++) { const a = Math.PI / 2 * (i / capSeg); pts.push(new THREE.Vector2(Math.cos(a) * r1 + 1e-4, -len - Math.sin(a) * r1)); }
    return new THREE.LatheGeometry(pts, seg);
  }
  // smooth torso segment: profile [[y, r], ...] bottom->top, closed ends, depth scale on z
  function torso(profile, depth = 0.8, seg = 20) {
    const pts = [new THREE.Vector2(1e-3, profile[0][0] - profile[0][1] * 0.35)];
    for (const [y, r] of profile) pts.push(new THREE.Vector2(r, y));
    const l = profile[profile.length - 1];
    pts.push(new THREE.Vector2(1e-3, l[0] + l[1] * 0.35));
    const g = new THREE.LatheGeometry(pts, seg); g.scale(1, 1, depth); return g;
  }
  // sphere sculpted with gaussian bumps: feats [{d:[x,y,z], a:amp, sx, sy}] (directions in local space)
  function sculpt(r, feats, ws = 48, hs = 32, noiseAmp = 0) {
    const g = new THREE.SphereGeometry(r, ws, hs);
    const p = g.attributes.position, n = new THREE.Vector3(), t = new THREE.Vector3();
    const F = feats.map(f => { const d = new THREE.Vector3(...f.d).normalize();
      const up = Math.abs(d.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const ex = new THREE.Vector3().crossVectors(up, d).normalize(), ey = new THREE.Vector3().crossVectors(d, ex);
      return { d, ex, ey, a: f.a, sx: f.sx || 0.2, sy: f.sy || f.sx || 0.2 }; });
    for (let i = 0; i < p.count; i++) {
      n.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      let disp = 0;
      for (const f of F) {
        const c = n.dot(f.d); if (c < 0) continue;
        const u = n.dot(f.ex), v = n.dot(f.ey);
        disp += f.a * Math.exp(-(u * u) / (f.sx * f.sx) - (v * v) / (f.sy * f.sy));
      }
      if (noiseAmp) disp += U.noise.noise3d(n.x * 6, n.y * 6, n.z * 6) * noiseAmp;
      t.copy(n).multiplyScalar(r * (1 + disp));
      p.setXYZ(i, t.x, t.y, t.z);
    }
    g.computeVertexNormals();
    return g;
  }
  function ell(rx, ry, rz, ws = 20, hs = 14) {
    const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); return g;
  }
  function cone(r, h, seg = 7) { const g = new THREE.ConeGeometry(r, h, seg, 1); return g; }
  function cyl(r0, r1, h, seg = 14, open = false) { return new THREE.CylinderGeometry(r0, r1, h, seg, 1, open); }
  function tubeAlong(points, r, seg = 24, rs = 8) {
    const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(c, seg, r, rs, false);
  }
  // cloth panel: a slice of a cone (hanging skirt piece). theta centred at `mid` (0 = +Z front)
  function skirtPanel(rTop, rBot, h, mid, span, seg = 8, jag = 0) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 3, true, mid - span / 2 + Math.PI / 2 * 0, span);
    g.translate(0, -h / 2, 0);
    if (jag) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < -h + 1e-3) p.setY(i, p.getY(i) + (Math.random() - 0.5) * jag);
    }
    return g;
  }

  // ---- Model builder: merges parts per (joint, material) -------------------------
  class ModelBuilder {
    constructor(rig) { this.rig = rig; this.groups = new Map(); this.extra = []; }
    add(joint, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scl = null) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), scl ? new THREE.Vector3(...scl) : new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      const key = joint + '|' + mat.uuid;
      let e = this.groups.get(key); if (!e) this.groups.set(key, e = { joint, mat, geos: [] });
      e.geos.push(g);
      return this;
    }
    // separate object (not merged), e.g. panels driven by secondary motion
    addObject(joint, obj) { this.rig.j[joint].add(obj); this.extra.push(obj); return obj; }
    build(shadow = true) {
      const meshes = [];
      for (const e of this.groups.values()) {
        const geo = mergeGeometries(e.geos, false);
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, e.mat);
        mesh.castShadow = shadow; mesh.receiveShadow = true;
        this.rig.j[e.joint].add(mesh);
        meshes.push(mesh);
      }
      this.extra.forEach(o => o.traverse(c => { if (c.isMesh) { c.castShadow = shadow; c.receiveShadow = true; meshes.push(c); } }));
      return meshes;
    }
  }

  return { JOINTS, JI, SIZE, O_HP, O_W, O_JAW, O_TAILY, pose, blend, addLayer, sampleClip, Humanoid, ModelBuilder, limb, ell, torso, sculpt, cone, cyl, tubeAlong, skirtPanel, solveTwoBone, aimBone };
})();
