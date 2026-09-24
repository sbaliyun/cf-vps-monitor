// ---------------------------------------------------------------------------
// Player: the Destined One
// ---------------------------------------------------------------------------
class Player extends Actor {
  constructor() {
    const model = Models.buildMonkey();
    super(model, Models.MONKEY, { radius: 0.38, height: 1.62, hp: 500, team: 'player', weaponSeg: [-1.15, 1.15], weaponR: 0.08, name: '天命人' });
    this.anim.stanceA = Anim.M.idle; this.anim.stanceB = Anim.M.carry;
    this.maxStamina = 100; this.stamina = 100; this.maxMana = 100; this.mana = 100;
    this.focus = 0; this.gourd = 5; this.maxGourd = 5; this.will = 0;
    this.cd = { spell1: 0, spell2: 0, spell3: 0 };
    this.cdMax = { spell1: 22, spell2: 40, spell3: 10 };
    this.manaCost = { spell1: 30, spell2: 45, spell3: 20 };
    this.state = 'move';
    this.combo = -1; this.comboTimer = 0;
    this.buffer = null; this.bufferT = 0;
    this.chargeT = 0; this.chargeLoop = null;
    this.iframe = 0; this.dodgeT = 10; this.perfectUsed = false;
    this.rockT = 0;
    this.lock = null;
    this.staminaDelay = 0; this.exhausted = false;
    this.trail = FX.makeTrail([1.0, 0.76, 0.38], 44);
    this.combatT = 99;
    this.actionDir = new THREE.Vector3(0, 0, 1);
    this.wish = new THREE.Vector3();
    this.sprinting = false;
    this.lastPhase = 0;
    this.healPending = 0; this.healT = 0;
    this.pendingSpell = null;
    this.aoeDone = false;
    this.heavyLevel = 0;
    this.gourdHand = null;
    this.gourdHand = model.handGourd; this.hipGourd = model.hipGourd;
    this.hurtT = 0;
    // red sash tails (cloth)
    const hips = this.rig.j.hips;
    this.ribbons = [
      FX.ribbon(hips, new THREE.Vector3(0.07, 0.02, 0.16), { len: 0.5, w: 0.06, side: new THREE.Vector3(1, 0, 0.3) }),
      FX.ribbon(hips, new THREE.Vector3(0.11, 0.02, 0.13), { len: 0.4, w: 0.05, side: new THREE.Vector3(1, 0, 0.5) }),
    ];
    for (const r of this.ribbons) r.colliders = [
      { obj: this.rig.j.thighL, off: new THREE.Vector3(0, -0.15, 0.02), r: 0.12 },
      { obj: this.rig.j.thighR, off: new THREE.Vector3(0, -0.15, 0.02), r: 0.12 },
      { obj: this.rig.j.hips, off: new THREE.Vector3(0, -0.02, 0), r: 0.17 },
    ];
  }

  // ---- helpers ----------------------------------------------------------------------
  hasStamina(n) { return this.stamina > Math.min(n, 1) && !this.exhausted; }
  useStamina(n) { this.stamina = Math.max(0, this.stamina - n); this.staminaDelay = 0.7; if (this.stamina <= 0) this.exhausted = true; }
  addFocus(v) {
    const before = Math.floor(this.focus);
    this.focus = Math.min(4, this.focus + v);
    const after = Math.floor(this.focus);
    if (after > before) { Game.audio.play(after === 4 ? 'focus_full' : 'focus_gain'); UI.focusPulse(after); }
  }
  softTarget(range = 5.5, cone = 1.2) {
    if (this.lock && this.lock.alive) return this.lock;
    let best = null, bd = 1e9;
    const f = this.forward(U.tmpV[0]);
    for (const e of Game.enemies) {
      if (!e.alive || !e.active) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > range) continue;
      let ang = Math.acos(U.clamp((dx * f.x + dz * f.z) / (d || 1), -1, 1));
      // prefer the direction the player is pushing
      if (this.wish.lengthSq() > 0.01) ang = Math.min(ang, Math.acos(U.clamp((dx * this.wish.x + dz * this.wish.z) / (d || 1), -1, 1)));
      if (ang > cone) continue;
      const score = d + ang * 2;
      if (score < bd) { bd = score; best = e; }
    }
    return best;
  }
  faceAttack() {
    const t = this.softTarget();
    if (t) this.faceTowards(t.pos, 0, 0);
    else if (this.wish.lengthSq() > 0.01) this.yaw = Math.atan2(this.wish.x, this.wish.z);
    this.forward(this.actionDir);
  }
  toggleLock() {
    if (this.lock) { this.lock = null; return; }
    this.lock = Game.pickLockTarget();
  }
  play(clip, state = 'action', blend = 0.06) {
    this.anim.play(clip, blend); this.state = state;
    this.hitSet.clear(); this.segValid = false; this.hitWindow = -1; this.multiT = 0; this.aoeDone = false;
    this.trail.clear();
  }

  // ---- actions ----------------------------------------------------------------------
  tryAction(a) {
    const inAction = this.state === 'action';
    const clip = this.anim.clip;
    const t = this.anim.t;
    // cancel rules
    if (inAction && clip) {
      if (clip === Anim.M.knockdown && t < clip.cancel) return false;
      if (a === 'dodge') { if (clip.iframes && clip === Anim.M.dodge ? t < 0.22 : t < (clip.cancel || clip.dur) * 0.65) return false; }
      else if (t < (clip.cancel || clip.dur)) return false;
    }
    if (this.state === 'charge' && a === 'dodge') {
      if (this.chargeLoop) { this.chargeLoop.stop(0.1); this.chargeLoop = null; }
      this.state = 'move';
      return this.startDodge();
    }
    if (this.state === 'charge' || this.state === 'dead' || this.state === 'rest') return false;
    switch (a) {
      case 'light': return this.startLight();
      case 'heavy': return this.startCharge();
      case 'dodge': return this.startDodge();
      case 'gourd': return this.startGourd();
      case 'spell1': return this.castImmobilize();
      case 'spell2': return this.castClones();
      case 'spell3': return this.castRockSolid();
      case 'interact': return this.tryInteract();
    }
    return false;
  }
  startLight() {
    if (!this.hasStamina(1)) { UI.flashBar('stamina'); return true; }
    const chain = [Anim.M.l1, Anim.M.l2, Anim.M.l3, Anim.M.l4, Anim.M.l5];
    this.combo = this.comboTimer > 0 ? (this.combo + 1) % 5 : 0;
    const clip = chain[this.combo];
    this.useStamina(this.combo === 4 ? 16 : 9);
    this.faceAttack();
    this.play(clip);
    this.curDmg = clip.dmg; this.curPoise = clip.poise; this.curKind = this.combo === 4 ? 'heavy' : 'light';
    this.combatT = 0;
    return true;
  }
  startCharge() {
    if (!this.hasStamina(1)) { UI.flashBar('stamina'); return true; }
    this.state = 'charge'; this.chargeT = 0;
    this.faceAttack();
    this.anim.hold(Anim.M.charge, 0.16);
    this.chargeLoop = Game.audio.loop('charge', { volume: 0.5 });
    this.combatT = 0;
    return true;
  }
  releaseHeavy() {
    if (this.chargeLoop) { this.chargeLoop.stop(0.2); this.chargeLoop = null; }
    const lvl = Math.floor(this.focus);
    this.heavyLevel = lvl;
    this.focus -= lvl;
    this.useStamina(18);
    this.faceAttack();
    const clip = Anim.M.heavy;
    this.play(clip, 'action', 0.04);
    const dmgTable = [48, 120, 195, 290, 420];
    this.curDmg = dmgTable[lvl]; this.curPoise = 30 + lvl * 25; this.curKind = 'heavy';
    if (lvl >= 3) Game.slowmo(0.4, 0.25);
    UI.focusUse(lvl);
  }
  startDodge() {
    if (!this.hasStamina(1)) { UI.flashBar('stamina'); return true; }
    this.useStamina(20);
    if (this.wish.lengthSq() > 0.01) this.actionDir.copy(this.wish).normalize();
    else this.forward(this.actionDir).negate();
    if (!this.lock) this.yaw = Math.atan2(this.actionDir.x, this.actionDir.z) + (this.wish.lengthSq() > 0.01 ? 0 : Math.PI);
    this.play(Anim.M.dodge, 'action', 0.04);
    this.dodgeT = 0; this.perfectUsed = false;
    Game.audio.play('dodge', { pos: this.pos });
    FX.afterimage(this.model.meshes, 0x6f8fcf, 0.3, 0.3);
    FX.dust(this.pos, 5, 0.6);
    return true;
  }
  startGourd() {
    if (this.gourd <= 0) { UI.toast('葫芦已空', 1.2); return true; }
    this.gourd--;
    this.play(Anim.M.drink, 'action', 0.12);
    this.healT = 0.55; this.healPending = this.maxHp * 0.45;
    if (this.gourdHand) this.gourdHand.visible = true;
    return true;
  }
  spellReady(k) {
    if (this.cd[k] > 0) { UI.toast('法术尚在冷却', 1); return false; }
    if (this.mana < this.manaCost[k]) { UI.flashBar('mana'); UI.toast('法力不足', 1); return false; }
    return true;
  }
  castImmobilize() {
    if (!this.spellReady('spell1')) return true;
    const target = (this.lock && this.lock.alive) ? this.lock : Game.pickLockTarget(14);
    if (!target) { UI.toast('附近没有可定身的目标', 1.2); return true; }
    this.mana -= this.manaCost.spell1; this.cd.spell1 = this.cdMax.spell1;
    this.faceTowards(target.pos, 0, 0);
    this.play(Anim.M.castPoint, 'action', 0.06);
    this.pendingSpell = { t: 0.14, fn: () => target.immobilize(target.boss ? 3.5 : 6) };
    Game.audio.play('spell_immobilize');
    return true;
  }
  castClones() {
    if (!this.spellReady('spell2')) return true;
    this.mana -= this.manaCost.spell2; this.cd.spell2 = this.cdMax.spell2;
    this.play(Anim.M.castBlow, 'action', 0.08);
    this.pendingSpell = { t: 0.36, fn: () => Game.spawnClones(this) };
    return true;
  }
  castRockSolid() {
    if (!this.spellReady('spell3')) return true;
    this.mana -= this.manaCost.spell3; this.cd.spell3 = this.cdMax.spell3;
    this.play(Anim.M.rockSolid, 'action', 0.04);
    this.rockT = 0.62;
    Game.audio.play('spell_rocksolid', { pos: this.pos });
    return true;
  }
  tryInteract() {
    const s = Game.nearShrine();
    if (!s) return false;
    this.play(Anim.M.rest, 'rest', 0.2);
    this.lock = null;
    this.pendingSpell = { t: 0.8, fn: () => Game.restAtShrine(s) };
    return true;
  }
  counter(attacker) {
    this.faceTowards(attacker.pos, 0, 0); this.forward(this.actionDir);
    this.play(Anim.M.counter, 'action', 0.03);
    this.curDmg = 90; this.curPoise = 80; this.curKind = 'heavy';
    this.rockT = 0;
  }

  // ---- damage ------------------------------------------------------------------------
  takeHit(info) {
    this.hp = Math.max(0, this.hp - info.amount);
    this.flashT = 0.12; this.fx.flashColor.value.setRGB(1, 0.3, 0.2);
    this.combatT = 0; this.hurtT = 0.6;
    if (this.chargeLoop) { this.chargeLoop.stop(0.1); this.chargeLoop = null; }
    if (this.gourdHand) this.gourdHand.visible = false;
    this.healPending = 0; this.pendingSpell = null; this.rockT = 0;
    if (this.hp <= 0) { this.die(); return; }
    if (info.dot) return;
    if (info.dir) { this.yaw = Math.atan2(-info.dir.x, -info.dir.z); }
    this.forward(this.actionDir);
    if (info.knock || info.amount >= 85) this.play(Anim.M.knockdown, 'action', 0.05);
    else this.play(Anim.M.hit, 'action', 0.04);
  }
  die() {
    this.alive = false; this.state = 'dead';
    this.anim.play(Anim.M.death, 0.1);
    this.lock = null;
    Game.onPlayerDeath();
  }
  respawn(pos, yaw) {
    this.pos.copy(pos); this.pos.y = World.heightAt(pos.x, pos.z); this.yaw = yaw;
    this.hp = this.maxHp; this.stamina = this.maxStamina; this.mana = this.maxMana; this.gourd = this.maxGourd;
    this.alive = true; this.state = 'move'; this.focus = 0; this.combo = -1;
    this.cd.spell1 = this.cd.spell2 = this.cd.spell3 = 0;
    this.anim.stop(0.01); this.anim.cur.set(Anim.M.idle); this.vel.set(0, 0, 0);
    if (this.ribbons) this.ribbons.forEach(r => r.reset());
    this.fx.dissolve.value = 0; this.rockT = 0; this.iframe = 0;
    this.syncRoot();
  }

  // ---- per frame ---------------------------------------------------------------------------
  update(dt, inp, cam) {
    const M = Anim.M;
    // timers
    this.comboTimer -= dt; this.bufferT -= dt; this.dodgeT += dt; this.combatT += dt; this.hurtT -= dt;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.mana = Math.min(this.maxMana, this.mana + dt * 1.1);
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0 && !this.sprinting && this.state !== 'charge') this.stamina = Math.min(this.maxStamina, this.stamina + dt * (this.state === 'move' ? 42 : 20));
    if (this.exhausted && this.stamina > 30) this.exhausted = false;
    if (this.combatT > 12) this.focus = Math.max(0, this.focus - dt * 0.03);
    if (this.lock && (!this.lock.alive || !this.lock.active || this.lock.distTo(this) > 32)) this.lock = Game.pickLockTarget(15, this.lock);

    if (!this.alive) { this.anim.update(dt); this.syncRoot(); for (const r of this.ribbons) r.update(dt); return; }

    // wish direction (camera relative)
    const cy = cam.yaw;
    const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    this.wish.set(fx * -inp.moveY + rx * inp.moveX, 0, fz * -inp.moveY + rz * inp.moveX);

    // input buffer
    for (const a of ['light', 'heavy', 'dodge', 'spell1', 'spell2', 'spell3', 'gourd', 'interact']) if (inp.pressed(a)) { this.buffer = a; this.bufferT = 0.4; }
    if (inp.pressed('lock')) this.toggleLock();
    if (this.buffer && this.bufferT > 0) {
      if (this.tryAction(this.buffer)) this.buffer = null;
    }
    if (this.bufferT <= 0) this.buffer = null;

    // pending timed events (spells, heal)
    if (this.pendingSpell && this.anim.clip) {
      if (this.anim.t >= this.pendingSpell.t) { const f = this.pendingSpell.fn; this.pendingSpell = null; f(); }
    }
    if (this.healPending > 0 && this.anim.clip === M.drink) {
      if (this.anim.t >= this.healT) {
        this.hp = Math.min(this.maxHp, this.hp + this.healPending); this.healPending = 0;
        Game.audio.play('heal'); FX.puff(this.pos, [0.8, 1.6, 0.8], 14, 0.6);
        this.fx.rim.value = 1; this.fx.rimColor.value.setRGB(0.6, 1.4, 0.6);
      }
    }
    if (this.gourdHand) {
      const drinking = this.anim.clip === M.drink && this.anim.t > 0.12 && this.anim.t < 1.1;
      this.gourdHand.visible = drinking; this.hipGourd.visible = !drinking;
    }
    this.fx.rim.value = Math.max(0, this.fx.rim.value - dt * 1.5);
    this.rockT = Math.max(0, this.rockT - dt);
    this.fx.freeze.value = U.damp(this.fx.freeze.value, this.rockT > 0 ? 0.9 : 0, 20, dt);

    this.iframe = 0;
    let moveSpeed = 0;
    const clip = this.anim.clip;
    if (this.state === 'charge') {
      if (!inp.down('heavy')) { this.releaseHeavy(); }
      else {
        this.chargeT += dt;
        if (this.stamina > 0) { this.stamina = Math.max(0, this.stamina - dt * 10); this.staminaDelay = 0.5; }
        const before = Math.floor(this.focus);
        this.focus = Math.min(4, this.focus + dt * 0.9);
        if (Math.floor(this.focus) > before) { Game.audio.play(Math.floor(this.focus) === 4 ? 'focus_full' : 'focus_gain'); UI.focusPulse(Math.floor(this.focus)); FX.puff(this.pos, [1.6, 1.1, 0.4], 8, 0.5); }
        if (this.chargeLoop) this.chargeLoop.setPitch(1 + this.focus * 0.25);
        // slow turning while charging
        const t = this.lock && this.lock.alive ? this.lock : null;
        if (t) this.faceTowards(t.pos, 6, dt);
        else if (this.wish.lengthSq() > 0.01) this.yaw = U.dampAngle(this.yaw, Math.atan2(this.wish.x, this.wish.z), 4, dt);
        this.forward(this.actionDir);
        // creep forward slightly
        if (this.wish.lengthSq() > 0.01) moveSpeed = 0.8;
        if (Math.random() < dt * 18) FX.spiritMote(U.tmpV[1].set(this.pos.x + FX.R(-0.5, 0.5), this.pos.y + FX.R(0.2, 1.8), this.pos.z + FX.R(-0.5, 0.5)), [1.8, 1.2, 0.4]);
      }
      this.pos.addScaledVector(this.actionDir, moveSpeed * dt);
    } else if (this.state === 'action' || this.state === 'rest') {
      if (clip) {
        // steer early in attacks toward the lock target
        if (clip.hit && this.anim.t < 0.1 && this.lock && this.lock.alive) { this.faceTowards(this.lock.pos, 14, dt); this.forward(this.actionDir); }
        if (clip.iframes && this.anim.inWindow(clip.iframes)) this.iframe = 1;
        moveSpeed = this.anim.moveSpeed();
        // stop root motion when pressed against an enemy
        if (moveSpeed > 0 && clip.hit) {
          for (const e of Game.enemies) if (e.alive && e.active && e.distTo(this) < (this.radius + e.radius * e.scaleMul + 0.5)) {
            const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
            if (dx * this.actionDir.x + dz * this.actionDir.z > 0) moveSpeed *= 0.1;
          }
        }
        this.processAttack(dt);
      }
      if (clip !== M.dodge && clip && clip.hit) this.pos.addScaledVector(this.actionDir, moveSpeed * dt);
      else if (clip === M.dodge) this.pos.addScaledVector(this.actionDir, moveSpeed * dt);
      else if (clip) this.pos.addScaledVector(this.actionDir, moveSpeed * dt); // hit reactions: negative speed => pushed back
      if (!this.anim.clip) { this.state = 'move'; if (clip && clip.hit) this.comboTimer = 0.45; }
      this.vel.set(0, 0, 0);
    }
    if (this.state === 'move') {
      const wl = Math.min(1, this.wish.length());
      this.sprinting = inp.down('sprint') && wl > 0.2 && this.stamina > 0 && !this.exhausted;
      const locked = this.lock && this.lock.alive;
      let target = wl * (locked ? (this.sprinting ? 6.2 : 3.8) : (this.sprinting ? 7.4 : 5.0));
      if (this.hurtT > 0) target *= 0.9;
      if (this.sprinting) { this.stamina = Math.max(0, this.stamina - dt * 12); this.staminaDelay = 0.4; if (this.stamina <= 0) this.exhausted = true; }
      const dir = wl > 0.01 ? U.tmpV[2].copy(this.wish).normalize() : U.tmpV[2].set(0, 0, 0);
      this.vel.x = U.damp(this.vel.x, dir.x * target, 12, dt);
      this.vel.z = U.damp(this.vel.z, dir.z * target, 12, dt);
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (locked && !this.sprinting) this.faceTowards(this.lock.pos, 12, dt);
      else if (sp > 0.3) this.yaw = U.dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 11, dt);
      // anim params
      const cyw = Math.cos(this.yaw), syw = Math.sin(this.yaw);
      const lf = (this.vel.x * syw + this.vel.z * cyw), ls = (this.vel.x * cyw - this.vel.z * syw);
      const ref = Math.max(sp, 0.001);
      this.anim.f = sp > 0.05 ? lf / ref * Math.min(1, sp / 2.2) : 0;
      this.anim.s = sp > 0.05 ? -ls / ref * Math.min(1, sp / 2.2) : 0;
      this.anim.speed = sp; this.anim.run = U.damp(this.anim.run, this.sprinting ? 1.5 : sp > 3 ? 1 : sp / 3, 8, dt);
      this.anim.stanceA = this.combatT < 5 || locked ? M.guard : M.idle;
      this.anim.stanceB = this.sprinting ? M.sprintCarry : M.carry;
      this.anim.stanceW = U.damp(this.anim.stanceW, U.clamp((sp - 0.5) / 2.5, 0, 1), 10, dt);
      // footsteps
      if (sp > 0.8) {
        const ph = Math.floor(this.anim.phase / Math.PI);
        if (ph !== this.lastPhase) { this.lastPhase = ph; Game.audio.play('footstep', { pos: this.pos, volume: this.sprinting ? 0.7 : 0.45, pitch: 0.9 + Math.random() * 0.2 }); if (this.sprinting && Math.random() < 0.5) FX.dust(this.pos, 2, 0.4); }
      }
    }
    // collisions & ground
    World.collide(this.pos, this.radius, true);
    Game.separate(this);
    this.pos.y = World.heightAt(this.pos.x, this.pos.z);
    this.syncRoot();
    this.anim.update(dt);
    for (const r of this.ribbons) r.update(dt);
    this.updateStaffGlow(dt);
    this.updateFX(dt);
  }

  processAttack(dt) {
    const clip = this.anim.clip, t = this.anim.t;
    // trail
    if (clip.trail && t >= clip.trail[0] && t <= clip.trail[1]) {
      this.rig.weaponPoint(0.35, U.tmpV[3]); this.rig.weaponPoint(1.18, U.tmpV[4]);
      this.trail.push(U.tmpV[3], U.tmpV[4]);
      if (clip.hit && this.combo === 3) { this.rig.weaponPoint(-0.1, U.tmpV[3]); this.rig.weaponPoint(-1.2, U.tmpV[4]); }
    }
    const inHit = clip.hit && t >= clip.hit[0] && t <= clip.hit[1];
    if (inHit) {
      if (clip.multi) { this.multiT -= dt; if (this.multiT <= 0) { this.multiT = clip.multi; this.hitSet.clear(); } }
      const hits = Combat.sweepWeapon(this, Game.enemies.filter(e => e.active));
      for (const h of hits) {
        this.hitSet.add(h.target);
        const dir = U.tmpV[5].subVectors(h.target.pos, this.pos).setY(0).normalize();
        Game.damageEnemy(h.target, { amount: this.curDmg * (0.9 + Math.random() * 0.2), poise: this.curPoise, point: h.point, dir: dir.clone(), kind: this.curKind, from: this, level: this.heavyLevel });
        if (clip !== Anim.M.heavy) this.addFocus(clip === Anim.M.l5 ? 0.45 : 0.22);
      }
    } else this.segValid = false;
    if (clip.aoe && !this.aoeDone && t >= clip.aoe.t) {
      this.aoeDone = true;
      const p = this.rig.weaponPoint(1.0, U.tmpV[6]).clone(); p.y = World.heightAt(p.x, p.z);
      const lvl = clip === Anim.M.heavy ? this.heavyLevel : 1;
      const r = clip === Anim.M.heavy ? 1.8 + lvl * 0.8 : clip.aoe.r;
      FX.slamFX(p, r, lvl >= 3 ? [1.2, 0.85, 0.35] : [1, 0.75, 0.45]);
      Game.audio.play(lvl >= 2 || clip === Anim.M.l5 ? 'hit_heavy' : 'slam', { pos: p });
      Game.shake(clip.shake || 0.4 + lvl * 0.12);
      const dmg = clip === Anim.M.heavy ? (lvl >= 2 ? this.curDmg * 0.45 : 0) : clip.aoe.dmg;
      if (dmg > 0) for (const h of Combat.aoe(p, r, Game.enemies.filter(e => e.active))) {
        if (this.hitSet.has(h.target)) continue;
        Game.damageEnemy(h.target, { amount: dmg, poise: 25, point: h.point, dir: U.tmpV[5].subVectors(h.target.pos, p).setY(0).normalize().clone(), kind: 'heavy', from: this });
      }
      if (lvl >= 4) FX.fireBurst(p, 26, 1.2);
    }
  }

  updateStaffGlow(dt) {
    const st = this.model.staff;
    const lvl = this.state === 'charge' ? this.focus : Math.floor(this.focus);
    const target = this.state === 'charge' ? 0.18 + (this.focus % 1) * 0.1 + Math.floor(this.focus) * 0.12 : Math.min(lvl, 4) * 0.035;
    st.glowMat.opacity = U.damp(st.glowMat.opacity, target + (this.state === 'charge' ? Math.sin(performance.now() * 0.03) * 0.04 : 0), 10, dt);
    st.coreMat.opacity = U.damp(st.coreMat.opacity, this.state === 'charge' ? 0.4 + Math.floor(this.focus) * 0.15 : 0, 10, dt);
    const c = Math.floor(lvl) >= 3 ? 0xffb040 : 0xffd080;
    st.glowMat.color.setHex(c);
  }
}

// ---------------------------------------------------------------------------
// 身外身法: golden clones that fight on their own for a while
// ---------------------------------------------------------------------------
class Clone extends Actor {
  constructor() {
    const model = Models.buildMonkey({ clone: true });
    super(model, Models.MONKEY, { radius: 0.35, height: 1.6, hp: 1, team: 'player', weaponSeg: [-1.15, 1.15], weaponR: 0.08 });
    this.anim.stanceA = Anim.M.guard; this.anim.stanceB = Anim.M.carry;
    this.life = 0; this.combo = 0; this.target = null; this.active = false;
    this.rig.root.visible = false;
    this.model.meshes.forEach(m => m.castShadow = false);
  }
  spawn(pos, yaw) {
    this.pos.copy(pos); this.yaw = yaw; this.life = 12; this.active = true; this.alive = true;
    this.rig.root.visible = true; this.anim.stop(0.01); this.anim.cur.set(Anim.M.guard);
    this.fx.dissolve.value = 0;
    FX.puff(this.pos, [1.8, 1.3, 0.5], 18, 0.7);
  }
  vanish() {
    this.active = false; this.alive = false;
    FX.puff(this.pos, [1.8, 1.3, 0.5], 16, 0.7);
    this.rig.root.visible = false;
  }
  update(dt) {
    if (!this.active) return;
    this.life -= dt;
    if (this.life <= 0) { this.vanish(); return; }
    if (this.life < 0.6) this.fx.dissolve.value = 1 - this.life / 0.6;
    if (!this.target || !this.target.alive || !this.target.active) {
      let bd = 22; this.target = null;
      for (const e of Game.enemies) if (e.alive && e.active) { const d = e.distTo(this); if (d < bd) { bd = d; this.target = e; } }
    }
    const clip = this.anim.clip;
    if (clip) {
      const ms = this.anim.moveSpeed();
      this.pos.addScaledVector(this.forward(U.tmpV[7]), ms * dt * 0.6);
      if (clip.hit && this.anim.t >= clip.hit[0] && this.anim.t <= clip.hit[1]) {
        const hits = Combat.sweepWeapon(this, Game.enemies.filter(e => e.active));
        for (const h of hits) {
          this.hitSet.add(h.target);
          Game.damageEnemy(h.target, { amount: 9, poise: 3, point: h.point, dir: U.tmpV[5].subVectors(h.target.pos, this.pos).setY(0).normalize().clone(), kind: 'clone', from: this });
        }
      } else this.segValid = false;
    } else if (this.target) {
      const d = this.distTo(this.target);
      this.faceTowards(this.target.pos, 10, dt);
      if (d > 1.9 + this.target.radius * this.target.scaleMul) {
        const f = this.forward(U.tmpV[7]);
        this.pos.addScaledVector(f, 5.5 * dt);
        this.anim.f = 1; this.anim.s = 0; this.anim.speed = 5.5; this.anim.run = 1; this.anim.stanceW = 1;
      } else {
        const chain = [Anim.M.l1, Anim.M.l2, Anim.M.l3, Anim.M.l4];
        this.anim.play(chain[this.combo++ % 4], 0.06);
        this.hitSet.clear(); this.segValid = false;
      }
    } else { this.anim.speed = 0; this.anim.f = 0; this.anim.stanceW = 0; }
    World.collide(this.pos, this.radius, true);
    this.pos.y = World.heightAt(this.pos.x, this.pos.z);
    this.syncRoot();
    this.anim.update(dt);
  }
}
