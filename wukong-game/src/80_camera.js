// ---------------------------------------------------------------------------
// Third-person camera: orbit, lock-on framing, terrain avoidance, trauma shake
// ---------------------------------------------------------------------------
class GameCamera {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0; this.pitch = 0.18; this.dist = 4.4; this.distT = 4.4;
    this.target = new THREE.Vector3(); this.smoothTarget = new THREE.Vector3();
    this.trauma = 0; this.t = 0;
    this.fovBase = 55; this.fovKick = 0;
    this.cinematic = null;
    this.lookOffset = new THREE.Vector3();
    this._p = new THREE.Vector3(); this._l = new THREE.Vector3();
  }
  snap(player) {
    this.smoothTarget.set(player.pos.x, player.pos.y + 1.45, player.pos.z);
    this.yaw = player.yaw + Math.PI;
    this.update(0.016, player, { lookX: 0, lookY: 0, zoom: 0 });
  }
  shake(a) { this.trauma = Math.min(1, this.trauma + a); }
  update(dt, player, inp) {
    this.t += dt;
    if (this.cinematic) { this.cinematic(dt, this); return; }
    // input
    this.yaw -= inp.lookX; this.pitch = U.clamp(this.pitch + inp.lookY, -0.55, 0.95);
    if (inp.zoom) this.distT = U.clamp(this.distT + inp.zoom * 0.4, 2.6, 7.5);
    const lock = player.lock && player.lock.alive ? player.lock : null;
    // follow target
    this.target.set(player.pos.x, player.pos.y + 1.45, player.pos.z);
    this.smoothTarget.x = U.damp(this.smoothTarget.x, this.target.x, 14, dt);
    this.smoothTarget.z = U.damp(this.smoothTarget.z, this.target.z, 14, dt);
    this.smoothTarget.y = U.damp(this.smoothTarget.y, this.target.y, 8, dt);
    let dist = this.distT;
    let look = this._l.copy(this.smoothTarget);
    if (lock) {
      const dx = lock.pos.x - player.pos.x, dz = lock.pos.z - player.pos.z;
      const want = Math.atan2(-dx, -dz);
      this.yaw = U.dampAngle(this.yaw, want, 6, dt);
      const d = Math.hypot(dx, dz);
      const big = lock.boss ? 1.4 : 1;
      this.pitch = U.damp(this.pitch, U.clamp(0.16 + (lock.height * lock.scaleMul - 1.7) * 0.05 - d * 0.004, 0.05, 0.4), 3, dt);
      dist = this.distT + Math.min(d * 0.12, 2) * big;
      look.lerp(U.tmpV[0].set(lock.pos.x, lock.pos.y + lock.height * lock.scaleMul * 0.55, lock.pos.z), U.clamp(0.3 - d * 0.005, 0.1, 0.3));
    }
    this.dist = U.damp(this.dist, dist, 5, dt);
    // desired camera position
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const off = this._p.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    // slight over-the-shoulder offset
    const right = U.tmpV[1].set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const base = U.tmpV[2].copy(look).addScaledVector(right, 0.35);
    // terrain / wall collision: march along the ray
    let dd = this.dist;
    for (let i = 1; i <= 12; i++) {
      const s = this.dist * i / 12;
      const x = base.x + off.x * s, y = base.y + off.y * s, z = base.z + off.z * s;
      if (y < World.heightAt(x, z) + 0.35 || World.blocked(x, z, 0.15) && y < World.PLATEAU_Y + 8) { dd = Math.max(0.8, s - this.dist / 12); break; }
    }
    this.curDist = U.damp(this.curDist || dd, dd, dd < (this.curDist || dd) ? 20 : 4, dt);
    const pos = U.tmpV[3].copy(base).addScaledVector(off, this.curDist);
    const gh = World.heightAt(pos.x, pos.z) + 0.3;
    if (pos.y < gh) pos.y = gh;
    this.cam.position.copy(pos);
    this.cam.lookAt(base);
    // shake
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const sh = this.trauma * this.trauma;
    if (sh > 0.001) {
      const n = U.noise;
      this.cam.rotation.x += n.noise(this.t * 25, 1) * 0.05 * sh;
      this.cam.rotation.y += n.noise(this.t * 25, 7) * 0.05 * sh;
      this.cam.rotation.z += n.noise(this.t * 25, 13) * 0.06 * sh;
      this.cam.position.y += n.noise(this.t * 30, 21) * 0.12 * sh;
    }
    // fov
    const fovT = this.fovBase + (player.sprinting ? 6 : 0) + (player.state === 'charge' ? -5 : 0) + this.fovKick;
    this.fovKick = U.damp(this.fovKick, 0, 6, dt);
    this.cam.fov = U.damp(this.cam.fov, fovT, 5, dt);
    this.cam.updateProjectionMatrix();
  }
}
