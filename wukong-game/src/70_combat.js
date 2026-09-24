// ---------------------------------------------------------------------------
// Animation controller, Actor base class, combat resolution, projectiles
// ---------------------------------------------------------------------------
class AnimCtl {
  constructor(rig, spec) {
    this.rig = rig; this.spec = spec;
    const S = Rig.SIZE;
    this.cur = new Float32Array(S); this.from = new Float32Array(S); this.tgt = new Float32Array(S); this.base = new Float32Array(S);
    this.clip = null; this.t = 0; this.blend = 1; this.blendDur = 0.1;
    this.phase = 0; this.f = 0; this.s = 0; this.run = 0; this.speed = 0;
    this.stanceA = null; this.stanceB = null; this.stanceW = 0;   // base pose = blend(stanceA, stanceB, stanceW)
    this.frozen = false; this.speedMul = 1;
    this.breath = Math.random() * 10;
    this.flinch = 0; this.flinchDir = 1;
    this.onEvent = null; this._ev = 0;
  }
  play(clip, blendDur = 0.08) {
    this.from.set(this.cur); this.clip = clip; this.t = 0; this.blend = blendDur > 0 ? 0 : 1; this.blendDur = blendDur; this._ev = 0;
  }
  hold(pose, blendDur = 0.12) { this.play({ dur: 1e9, keys: [[0, pose]], hold: true }, blendDur); }
  stop(blendDur = 0.15) { this.from.set(this.cur); this.clip = null; this.blend = 0; this.blendDur = blendDur; }
  get playing() { return !!this.clip; }
  update(dt) {
    if (this.frozen) { this.rig.apply(this.cur, 0); return; }
    dt *= this.speedMul;
    if (this.clip) {
      const prev = this.t;
      this.t += dt;
      if (this.clip.sfx && this.onEvent) {
        for (const e of this.clip.sfx) if (e[0] > prev && e[0] <= this.t) this.onEvent('sfx', e);
      }
      if (this.t >= this.clip.dur && !this.clip.hold) {
        const c = this.clip; this.stop(0.14);
        if (this.onEvent) this.onEvent('end', c);
      }
    }
    if (this.clip) Rig.sampleClip(this.tgt, this.clip, Math.min(this.t, this.clip.dur));
    else {
      // locomotion
      if (this.stanceB && this.stanceW > 0.001) Rig.blend(this.base, this.stanceA, this.stanceB, this.stanceW); else this.base.set(this.stanceA);
      const cyc = 1.5 + this.run * 0.9;
      this.phase += dt * (this.speed / cyc) * Math.PI * 2 * (this.f < -0.3 ? -1 : 1);
      Anim.locomotion(this.tgt, this.base, this.phase, this.f, this.s, this.run, this.spec);
      // breathing
      this.breath += dt;
      const b = Math.sin(this.breath * 1.8) * (1 - U.clamp(this.speed / 2, 0, 1));
      this.tgt[Rig.JI.chest * 3] += b * 0.025; this.tgt[Rig.JI.neck * 3] -= b * 0.02;
      this.tgt[Rig.JI.armL * 3 + 2] += b * 0.02;
    }
    // hit flinch additive
    if (this.flinch > 0) {
      this.flinch = Math.max(0, this.flinch - dt * 4);
      const f = Math.sin(this.flinch * Math.PI) * 0.35;
      this.tgt[Rig.JI.chest * 3] -= f; this.tgt[Rig.JI.spine * 3] -= f * 0.5; this.tgt[Rig.JI.head * 3] -= f * 0.7;
      this.tgt[Rig.JI.chest * 3 + 1] += f * 0.5 * this.flinchDir;
    }
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / Math.max(this.blendDur, 1e-3));
      Rig.blend(this.cur, this.from, this.tgt, U.easeInOut(this.blend));
    } else this.cur.set(this.tgt);
    this.rig.apply(this.cur, dt);
  }
  moveSpeed() {
    // root motion speed from the current clip's move windows
    const c = this.clip; if (!c || !c.move) return 0;
    for (const m of c.move) if (this.t >= m[0] && this.t <= m[1]) return m[2];
    return 0;
  }
  inWindow(w) { return this.clip && w && this.t >= w[0] && this.t <= w[1]; }
}

class Actor {
  constructor(model, spec, opts = {}) {
    this.model = model; this.rig = model.rig; this.fx = model.fx;
    this.anim = new AnimCtl(model.rig, spec);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0;
    this.radius = opts.radius || 0.45; this.height = opts.height || 1.7;
    this.maxHp = opts.hp || 100; this.hp = this.maxHp;
    this.team = opts.team || 'enemy';
    this.alive = true; this.name = opts.name || '';
    this.hitSet = new Set(); this.hitWindow = -1; this.multiT = 0;
    this.segPrevA = new THREE.Vector3(); this.segPrevB = new THREE.Vector3(); this.segValid = false;
    this.weaponSeg = opts.weaponSeg || null;  // [y0, y1] along weapon axis
    this.weaponR = opts.weaponR || 0.06;
    this.flashT = 0; this.scaleMul = model.rig.root.scale.x;
    this.lastHitTime = -10;
    this.anim.onEvent = (type, e) => this.onAnimEvent(type, e);
  }
  get root() { return this.rig.root; }
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  onAnimEvent(type, e) {
    if (type === 'sfx') Game.audio.play(e[1], { pos: this.pos, pitch: e[2] || 1 });
  }
  syncRoot() { this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw; }
  weaponSegment(a, b) {
    if (!this.rig.weapon || !this.weaponSeg) return false;
    this.rig.weaponPoint(this.weaponSeg[0], a); this.rig.weaponPoint(this.weaponSeg[1], b);
    return true;
  }
  capsule(a, b) {
    const s = this.scaleMul;
    a.set(this.pos.x, this.pos.y + 0.3 * s, this.pos.z);
    b.set(this.pos.x, this.pos.y + (this.height - 0.3) * s, this.pos.z);
  }
  updateFX(dt) {
    this.flashT = Math.max(0, this.flashT - dt);
    this.fx.flash.value = this.flashT > 0 ? Math.min(1, this.flashT / 0.1) * 0.22 : 0;
  }
  faceTowards(p, rate, dt) {
    const target = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    this.yaw = rate ? U.dampAngle(this.yaw, target, rate, dt) : target;
  }
  distTo(o) { return Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z); }
}

// ---------------------------------------------------------------------------
const Combat = (() => {
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c0 = new THREE.Vector3(), _c1 = new THREE.Vector3();
  const _ia = new THREE.Vector3(), _ib = new THREE.Vector3(), _hp = new THREE.Vector3(), _dir = new THREE.Vector3();
  const projectiles = [];
  const hazards = [];

  // Sweep the attacker's weapon (prev -> current frame) against the targets.
  // Returns array of {target, point}
  function sweepWeapon(att, targets, extraR = 0) {
    const out = [];
    if (!att.weaponSegment(_a, _b)) return out;
    if (!att.segValid) { att.segPrevA.copy(_a); att.segPrevB.copy(_b); att.segValid = true; }
    for (const t of targets) {
      if (!t.alive || att.hitSet.has(t)) continue;
      if (t.distTo(att) > 6 * att.scaleMul) continue;
      t.capsule(_c0, _c1);
      const rr = t.radius * t.scaleMul + att.weaponR + extraR;
      for (let k = 0; k <= 3; k++) {
        const f = k / 3;
        _ia.lerpVectors(att.segPrevA, _a, f); _ib.lerpVectors(att.segPrevB, _b, f);
        const d2 = U.segSegDist2(_ia, _ib, _c0, _c1, _hp);
        if (d2 < rr * rr) { out.push({ target: t, point: _hp.clone() }); break; }
      }
    }
    att.segPrevA.copy(_a); att.segPrevB.copy(_b);
    return out;
  }
  function sphereHit(center, r, targets) {
    const out = [];
    for (const t of targets) {
      if (!t.alive) continue;
      t.capsule(_c0, _c1);
      const d2 = U.segSegDist2(center, center, _c0, _c1, _hp);
      const rr = r + t.radius * t.scaleMul;
      if (d2 < rr * rr) out.push({ target: t, point: _hp.clone() });
    }
    return out;
  }
  function aoe(center, r, targets, hMax = 2.5) {
    const out = [];
    for (const t of targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.pos.x - center.x, t.pos.z - center.z);
      if (d < r + t.radius * t.scaleMul && Math.abs(t.pos.y - center.y) < hMax) out.push({ target: t, point: t.pos.clone().setY(t.pos.y + 1) });
    }
    return out;
  }

  // ---- Projectiles & hazards -------------------------------------------------------
  // projectile: {pos, vel, r, dmg, life, homing, target, kind, onHit}
  function spawnProjectile(p) { p.age = 0; projectiles.push(p); return p; }
  function spawnHazard(h) { h.age = 0; hazards.push(h); return h; }
  function updateProjectiles(dt, player) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.age += dt;
      if (p.homing && player.alive) {
        _dir.set(player.pos.x - p.pos.x, player.pos.y + 1.1 - p.pos.y, player.pos.z - p.pos.z).normalize();
        const sp = p.vel.length();
        p.vel.lerp(_dir.multiplyScalar(sp), U.dampK(p.homing, dt)).setLength(sp);
      }
      p.pos.addScaledVector(p.vel, dt);
      if (p.update) p.update(p, dt);
      const gy = World.heightAt(p.pos.x, p.pos.z);
      let dead = p.age > p.life || p.pos.y < gy + 0.1;
      if (!dead && player.alive) {
        const hits = sphereHit(p.pos, p.r, [player]);
        if (hits.length) {
          Game.damagePlayer({ amount: p.dmg, from: p.owner, point: hits[0].point, dir: p.vel.clone().normalize(), kind: p.kind, knock: p.knock, projectile: true });
          dead = true;
        }
      }
      if (dead) { if (p.onEnd) p.onEnd(p); projectiles.splice(i, 1); }
    }
    for (let i = hazards.length - 1; i >= 0; i--) {
      const h = hazards[i];
      h.age += dt;
      if (h.update) h.update(h, dt);
      if (player.alive && h.tick !== undefined) {
        h.tickT = (h.tickT || 0) - dt;
        if (h.tickT <= 0 && Math.hypot(player.pos.x - h.pos.x, player.pos.z - h.pos.z) < h.r) {
          h.tickT = h.tick;
          Game.damagePlayer({ amount: h.dmg, from: h.owner, point: player.pos.clone().setY(player.pos.y + 0.5), dir: null, kind: 'fire', knock: false, dot: true });
        }
      }
      if (h.age > h.life) { if (h.onEnd) h.onEnd(h); hazards.splice(i, 1); }
    }
  }
  function clearProjectiles() {
    for (const p of projectiles) if (p.onEnd) p.onEnd(p);
    for (const h of hazards) if (h.onEnd) h.onEnd(h);
    projectiles.length = 0; hazards.length = 0;
  }

  return { sweepWeapon, sphereHit, aoe, spawnProjectile, spawnHazard, updateProjectiles, clearProjectiles, projectiles, hazards };
})();
