// ---------------------------------------------------------------------------
// GameAudio — 100 % procedural Web Audio: SFX, generative Chinese-pentatonic
// music (guzheng / xiao / suona / taiko) and ambience beds. No files.
//
//   const audio = new GameAudio();
//   audio.init();                                   // from a user gesture
//   audio.setVolumes({ master, music, sfx, ambience });
//   audio.setMusic('title'|'explore'|'boss'|'victory'|'death'|null);
//   audio.setMusicIntensity(0..1);
//   audio.setListener({x,y,z}, yaw);
//   audio.play(name, { pos, volume, pitch });
//   const h = audio.loop('charge'|'fire'|'wind', { pos, volume, pitch });
//   audio.setAmbience('forest'|'temple'|null);
//   audio.update(dt);
//
// Every method is a silent no-op when Web Audio is unavailable.
// ---------------------------------------------------------------------------
class GameAudio {
  // name: [gain, max simultaneous voices, reverb send]
  static META = {
    swing_light: [1.4, 3, 0.05], swing_heavy: [0.85, 2, 0.08], swing_blade: [1.6, 3, 0.06],
    hit_staff: [1.25, 4, 0.08], hit_heavy: [1.1, 3, 0.16], hit_metal: [1.5, 3, 0.2], hit_player: [1.15, 2, 0.08],
    footstep: [1.5, 3, 0.02], dodge: [1.3, 2, 0.06], perfect_dodge: [0.65, 1, 0.4],
    focus_gain: [2.0, 2, 0.2], focus_full: [0.9, 1, 0.3],
    spell_immobilize: [1.3, 1, 0.4], spell_clone: [1.8, 1, 0.3], spell_rocksolid: [1.3, 1, 0.3],
    rocksolid_deflect: [1.25, 2, 0.3], gourd: [0.85, 1, 0.12], heal: [1.1, 1, 0.35],
    wolf_growl: [0.5, 3, 0.12], wolf_hurt: [1.0, 3, 0.12], wolf_death: [0.7, 3, 0.16], boss_roar: [0.8, 1, 0.25],
    wight_moan: [0.5, 2, 0.45], wisp: [0.9, 3, 0.25], fire_burst: [0.8, 3, 0.16], slam: [0.9, 2, 0.2],
    shockwave: [0.8, 2, 0.2], enemy_death: [1.2, 3, 0.4], will_pickup: [1.2, 3, 0.25],
    shrine_rest: [0.75, 1, 0.4], bell: [0.8, 2, 0.45], gong: [1.0, 2, 0.4],
    ui_hover: [2.0, 2, 0], ui_click: [2.0, 2, 0.02], ui_open: [0.8, 2, 0.2],
    boss_intro: [0.9, 1, 0.3], victory: [0.85, 1, 0.3], death: [0.75, 1, 0.3],
    charge: [0.2, 0, 0.08], fire: [0.4, 0, 0.08], wind: [1.1, 0, 0.1],
  };
  static MAXV = 40;
  static LOOK = 0.45;
  static SCALE = [0, 3, 5, 7, 10]; // D 羽: D F G A C
  static PROG_CALM = [[0, 0, 3, 0], [0, 10, 0, 7], [0, 8, 10, 0], [0, 5, 3, 0], [0, 3, 10, 0], [0, 0, 5, 7]];
  static PROG_BOSS = [[0, 0, 10, 10], [0, 8, 10, 0], [0, 0, 3, 10], [0, 10, 8, 7], [0, 3, 8, 10]];
  static CHORD_DEG = { 0: [0, 3], 3: [1, 4], 5: [2, 0], 7: [3, 4], 8: [0, 1], 10: [4, 2] };
  static ARP_PC = { 0: [0, 3, 7], 3: [3, 7, 10], 5: [5, 10, 0], 7: [7, 10, 0], 8: [0, 3, 7], 10: [10, 0, 5] };
  static RH_CALM = [[2, 1, 1], [1.5, 0.5, 2], [1, 1, 2], [3, 1], [4], [2, 2], [1, 0.5, 0.5, 2], [0.5, 0.5, 1, 2], [2, 1.5, 0.5]];
  static RH_END = [[4], [3, 1], [2, 2], [1, 3]];
  static RH_XIAO = [[4], [3, 1], [2, 2], [2, 1, 1], [1, 3], [1.5, 0.5, 2]];
  static RH_BOSS = [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 2], [2, 1, 1], [1, 0.5, 0.5, 2], [0.5, 0.5, 0.5, 0.5, 2], [3, 1]];
  static PATS = ['B..b..M.B...M.m.', 'B..B..M.B.b.M.m.', 'B.....M.B..bM..m', 'B..b.bM.B..bM.M.'];
  static FILLS = ['B..B..M.MmMmSsSS', 'B.M.M.MmSsSsSSSS', 'B..BM.M.MMMmBBBB'];
  static HIPATS = ['s.s.S.s.s.s.S.s.', 'SsssSsssSsssSsss', 's.S.s.S.sSs.S.sS', 'S.sSs.sSS.sSs.SS'];
  static ARP8 = [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 4, -1, 3, -1, 1, -1];
  static ARP16 = [
    [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 4, 3, 2, 1, 2],
    [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5],
    [0, 3, 1, 3, 0, 3, 1, 3, 2, 5, 3, 5, 2, 5, 3, 5],
    [6, 4, 5, 3, 4, 2, 3, 1, 2, 0, 1, 2, 3, 4, 5, 6],
  ];

  constructor() {
    this.ctx = null;
    this.ok = false;
    this._vol = { master: 0.9, music: 0.7, sfx: 0.9, ambience: 0.7 };
    this._lis = { x: 0, y: 0, z: 0, yaw: 0 };
    this._voices = []; this._dying = []; this._loops = []; this._sessions = []; this._beds = [];
    this._mode = null; this._zone = null; this._intensity = 0;
    this._pendMusic = undefined; this._pendAmb = undefined;
    this._warned = new Set(); this._last = Object.create(null);
    this._pk = new Map(); this._collect = null; this._timer = 0; this._lastTick = 0; this._ticking = false; this._resumeAt = 0;
  }

  // ======================================================================= API
  init() {
    try {
      if (this.ctx) { this._resume(); return; }
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) { this._warn('Web Audio unavailable - audio disabled'); return; }
      let ctx;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      this._setup(ctx);
      this._resume();
      this._timer = setInterval(() => this._tick(), 50);
      const un = () => this._resume();
      for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, un, { passive: true });
      if (this._pendMusic !== undefined) { const m = this._pendMusic; this._pendMusic = undefined; this.setMusic(m); }
      if (this._pendAmb !== undefined) { const z = this._pendAmb; this._pendAmb = undefined; this.setAmbience(z); }
    } catch (e) {
      console.warn('[GameAudio] disabled:', e);
      this.ok = false;
    }
  }

  setVolumes(v) {
    if (!v || typeof v !== 'object') return;
    for (const k of ['master', 'music', 'sfx', 'ambience']) {
      const x = +v[k];
      if (v[k] !== undefined && isFinite(x)) this._vol[k] = Math.max(0, Math.min(1, x));
    }
    if (this.ok) { try { this._applyVol(false); } catch (e) { this._warn('volume', e); } }
  }

  setMusic(mode) {
    if (mode === undefined) mode = null;
    if (mode !== null && !['title', 'explore', 'boss', 'victory', 'death'].includes(mode)) { this._warn('unknown music mode ' + mode); return; }
    if (!this.ok) { this._pendMusic = mode; return; }
    if (mode === this._mode) return;
    try {
      this._mode = mode;
      const now = this.ctx.currentTime;
      const out = mode === 'victory' || mode === 'death' ? 1.3 : 2.0;
      for (const S of this._sessions) if (!S.dead) this._endSession(S, now, out);
      if (mode) {
        const S = this._newSession(mode);
        const fin = { title: 1.2, explore: 2.5, boss: 0.5, victory: 0.05, death: 0.3 }[mode];
        for (const g of [S.out, S.wet, S.ech]) { g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(S.lvl, now + fin); }
        S.until = now + ({ boss: 0.6, death: 0.3 }[mode] || 0.06);
        this._sessions.push(S);
        this._musicTick(now, now + GameAudio.LOOK);
      }
    } catch (e) { this._warn('setMusic', e); }
  }

  setMusicIntensity(x) {
    const v = Math.max(0, Math.min(1, +x || 0));
    if (v >= 0.5 && this._intensity < 0.5) for (const S of this._sessions) if (!S.dead && S.mode === 'boss') S.st.accent = true;
    this._intensity = v;
  }

  setListener(pos, yaw) {
    if (pos) {
      if (isFinite(pos.x)) this._lis.x = +pos.x;
      if (isFinite(pos.y)) this._lis.y = +pos.y;
      if (isFinite(pos.z)) this._lis.z = +pos.z;
    }
    if (isFinite(yaw)) this._lis.yaw = +yaw;
  }

  play(name, opts) {
    if (!this.ok) return;
    try {
      const fn = this['_sfx_' + name];
      if (typeof fn !== 'function') { this._warn('unknown sfx "' + name + '"'); return; }
      opts = opts || {};
      const ctx = this.ctx, now = ctx.currentTime, M = GameAudio.META[name] || [1, 4, 0.1];
      if (ctx.state !== 'running' && !this._offline && this._wall() - this._resumeAt > 1500) return; // suspended: don't pile up a burst
      const o = { pitch: +opts.pitch > 0 ? Math.max(0.25, Math.min(4, +opts.pitch)) : 1, pos: opts.pos || null };
      const vol = Math.max(0, Math.min(4, opts.volume === undefined ? 1 : +opts.volume || 0)) * M[0];
      if (vol < 1e-4) return;
      const lt = this._last[name];
      if (!o.pos && lt !== undefined && now - lt < 0.025) return; // same-frame duplicates
      this._last[name] = now;
      let sp = null;
      if (o.pos) { sp = this._spatial(o.pos); if (sp.g < 0.003) return; }
      this._reap(now);
      if (name === 'heal') for (const v of this._voices) if (v.healG) { this._hold(v.healG.gain, now); v.healG.gain.linearRampToValueAtTime(0, now + 0.05); }
      let same = 0, oldest = null;
      for (const v of this._voices) if (v.name === name) { same++; if (!oldest) oldest = v; }
      if (oldest && same >= M[1]) this._kill(oldest, now);
      while (this._voices.length >= GameAudio.MAXV) this._kill(this._voices[0], now);

      const V = { name, srcs: [], in: this._g(1), wet: this._g(1), disc: [] };
      const dry = this._g(vol * (sp ? sp.g : 1));
      V.in.connect(dry);
      let node = dry;
      V.disc.push(V.in, V.wet, dry);
      if (sp && sp.lp < 16000) { const lp = this._f('lowpass', sp.lp, 0.7); node.connect(lp); node = lp; V.disc.push(lp); }
      if (sp) { const pn = this._pan(sp.pan); node.connect(pn); node = pn; V.disc.push(pn); }
      node.connect(this._bus.sfx.in);
      const snd = this._g(vol * (sp ? sp.r : 1));
      V.wet.connect(snd); snd.connect(this._bus.sfx.rev); V.disc.push(snd);
      if (M[2] > 0) { const a = this._g(M[2]); V.in.connect(a); a.connect(snd); V.disc.push(a); }
      V.dry = dry; V.snd = snd;
      V.sat = () => {
        if (!V._sat) { V._sat = this._shaper('sat'); V._sat.connect(V.in); V.disc.push(V._sat); }
        return V._sat;
      };
      const t = now + 0.005;
      let dur = 1;
      this._collect = V.srcs;
      try { dur = fn.call(this, t, V, o) || 1; } finally { this._collect = null; }
      V.end = t + dur + 0.2;
      this._voices.push(V);
    } catch (e) { this._collect = null; this._warn('play ' + name, e); }
  }

  loop(name, opts) {
    const dummy = { setVolume() {}, setPos() {}, setPitch() {}, stop() {} };
    if (!this.ok) return dummy;
    const b = this['_loop_' + name];
    if (typeof b !== 'function') { this._warn('unknown loop "' + name + '"'); return dummy; }
    try {
      opts = opts || {};
      const now = this.ctx.currentTime, M = GameAudio.META[name] || [1, 0, 0.1];
      const L = {
        name, M, srcs: [], alive: true, tick: null, setP: null, nx: 0, end: Infinity,
        vol: opts.volume === undefined ? 1 : Math.max(0, +opts.volume || 0),
        pos: opts.pos || null, pitch: +opts.pitch > 0 ? +opts.pitch : 1,
        in: this._g(1), fade: this._g(0), out: this._g(0), pan: this._pan(0), snd: this._g(0),
      };
      L.in.connect(L.fade); L.fade.connect(L.out); L.out.connect(L.pan); L.pan.connect(this._bus.sfx.in);
      L.fade.connect(L.snd); L.snd.connect(this._bus.sfx.rev);
      L.disc = [L.in, L.fade, L.out, L.pan, L.snd];
      L.fade.gain.setValueAtTime(0, now); L.fade.gain.linearRampToValueAtTime(1, now + 0.25);
      this._collect = L.srcs;
      try { b.call(this, L, now); } finally { this._collect = null; }
      this._loopGain(L, true);
      if (L.setP) L.setP(L.pitch, now);
      this._loops.push(L);
      const self = this;
      return {
        setVolume(v) { if (isFinite(v)) L.vol = Math.max(0, +v); },
        setPos(p) { L.pos = p || null; },
        setPitch(p) { try { if (L.alive && L.setP && +p > 0) { L.pitch = +p; L.setP(L.pitch, self.ctx.currentTime); } } catch (e) {} },
        stop(f) { self._stopLoop(L, f === undefined ? 0.3 : +f || 0); },
      };
    } catch (e) { this._collect = null; this._warn('loop ' + name, e); return dummy; }
  }

  setAmbience(zone) {
    if (zone === undefined) zone = null;
    if (zone !== null && zone !== 'forest' && zone !== 'temple') { this._warn('unknown ambience ' + zone); return; }
    if (!this.ok) { this._pendAmb = zone; return; }
    if (zone === this._zone) return;
    try {
      this._zone = zone;
      const now = this.ctx.currentTime;
      for (const B of this._beds) if (!B.dead) {
        B.dead = true; B.kill = now + 3.3;
        for (const g of [B.out, B.wet]) { this._hold(g.gain, now); g.gain.linearRampToValueAtTime(0, now + 3); }
        for (const s of B.srcs) { try { s.stop(now + 3.2); } catch (e) {} }
      }
      if (zone) {
        const B = this._newBed(zone);
        for (const g of [B.out, B.wet]) { g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 3); }
        this._beds.push(B);
        this._bedTick(B, now, now + GameAudio.LOOK);
      }
    } catch (e) { this._warn('setAmbience', e); }
  }

  update(dt) {
    if (!this.ok) return;
    if (this._wall() - this._lastTick > 40) this._tick();
  }

  // ================================================================ internals
  _warn(msg, err) {
    if (this._warned.has(msg)) return;
    this._warned.add(msg);
    console.warn('[GameAudio] ' + msg, err || '');
  }
  _resume() {
    try {
      const c = this.ctx;
      if (c && c.state !== 'running' && c.state !== 'closed' && c.resume) { this._resumeAt = this._wall(); c.resume().catch(() => {}); }
    } catch (e) {}
  }
  _wall() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  _rnd(a, b) { return a + Math.random() * (b - a); }
  _pick(a) { return a[(Math.random() * a.length) | 0]; }
  _wpick(w) { let s = 0; for (const x of w) s += x[1]; let r = Math.random() * s; for (const x of w) { r -= x[1]; if (r <= 0) return x[0]; } return w[w.length - 1][0]; }
  _sm(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  _hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  _recent(name, win = 1.2) { const l = this._last[name]; return l !== undefined && this.ctx.currentTime - l < win; }
  _dm(d) { const o = Math.floor(d / 5); return 50 + 12 * o + GameAudio.SCALE[d - o * 5]; } // degree 0 = D3
  _bass(pc) { return pc <= 7 ? 38 + pc : 26 + pc; }

  _setup(ctx) {
    this.ctx = ctx;
    this._offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    this._buf = {
      white: this._mkNoise('white', 2.5), pink: this._mkNoise('pink', 3), brown: this._mkNoise('brown', 3),
      grit: this._mkGrains(2.5), crackle: this._mkCrackle(6),
    };
    this._curves = {
      sat: this._mkCurve(x => Math.tanh(1.5 * x) / Math.tanh(1.5)),
      drv: this._mkCurve(x => Math.tanh(3 * x) / Math.tanh(3)),
      clip: this._mkCurve(x => { const u = 2 * x, a = Math.abs(u); return a < 0.8 ? u : Math.sign(u) * (0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18)); }),
    };
    // master: buses -> master gain -> compressor -> make-down -> soft clipper -> out
    this._master = this._g(1);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
    const post = this._g(0.5 * 0.5); // clip curve expects input pre-scaled by 0.5
    const clip = ctx.createWaveShaper(); clip.curve = this._curves.clip;
    this._master.connect(comp); comp.connect(post); post.connect(clip); clip.connect(ctx.destination);
    this._comp = comp;
    // shared reverb (generated impulse response)
    this._rvIn = this._f('highpass', 150, 0.7);
    const conv = ctx.createConvolver(); conv.buffer = this._mkIR(3.2);
    const ret = this._g(0.6);
    this._rvIn.connect(conv); conv.connect(ret); ret.connect(this._master);
    // buses (in = dry volume, rev = reverb-send volume)
    const bus = trim => { const b = { trim, in: this._g(0), rev: this._g(0) }; b.in.connect(this._master); b.rev.connect(this._rvIn); return b; };
    this._bus = { music: bus(0.75), sfx: bus(1), amb: bus(1) };
    // music echo (feedback delay, darkened)
    this._echoIn = this._g(1);
    const ehp = this._f('highpass', 300, 0.7), dl = ctx.createDelay(2), fb = this._g(0.33), elp = this._f('lowpass', 2600, 0.6), eo = this._g(0.5), er = this._g(0.6);
    dl.delayTime.value = 0.47;
    this._echoIn.connect(ehp); ehp.connect(dl); dl.connect(elp); elp.connect(fb); fb.connect(dl);
    elp.connect(eo); eo.connect(this._bus.music.in); eo.connect(er); er.connect(this._bus.music.rev);
    this.ok = true;
    this._applyVol(true);
  }

  _applyVol(instant) {
    const v = this._vol, now = this.ctx.currentTime, c = x => Math.pow(Math.max(0, Math.min(1, x)), 1.5);
    const set = (p, x) => { if (instant) p.setValueAtTime(x, now); else p.setTargetAtTime(x, now, 0.05); };
    set(this._master.gain, c(v.master));
    for (const [k, b] of [['music', this._bus.music], ['sfx', this._bus.sfx], ['ambience', this._bus.amb]]) {
      const x = c(v[k]) * b.trim; set(b.in.gain, x); set(b.rev.gain, x);
    }
  }

  // ------------------------------------------------------------- buffers
  _mkNoise(kind, sec) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * sec), X = Math.floor(sr * 0.05), raw = new Float32Array(len + X);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') raw[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      } else { br = (br + 0.02 * w) / 1.02; raw[i] = br; }
    }
    const buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = raw[i];
    for (let i = 0; i < X; i++) { const w = i / X; d[i] = raw[i] * Math.sqrt(w) + raw[len + i] * Math.sqrt(1 - w); } // seamless loop
    let s = 0; for (let i = 0; i < len; i++) s += d[i] * d[i];
    const k = 0.35 / Math.sqrt(s / len); for (let i = 0; i < len; i++) d[i] *= k;
    return buf;
  }
  _normPeak(d, p) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= p / m; }
  _mkGrains(sec) { // dense crunchy grains (gravel / debris / sparks)
    const sr = this.ctx.sampleRate, len = Math.floor(sr * sec), buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    let t = 0;
    for (;;) {
      t += Math.max(1, Math.floor(-Math.log(1 - Math.random()) * sr / 170));
      if (t >= len) break;
      const L = Math.floor(sr * this._rnd(0.002, 0.012)), A = 0.15 + 0.85 * Math.pow(Math.random(), 2), c = this._rnd(0.1, 0.8);
      let lp = 0;
      for (let k = 0; k < L && t + k < len; k++) { lp += (1 - c) * ((Math.random() * 2 - 1) - lp); d[t + k] += A * lp * Math.exp(-4 * k / L); }
    }
    this._normPeak(d, 0.95);
    return buf;
  }
  _mkCrackle(sec) { // sparse fire pops
    const sr = this.ctx.sampleRate, len = Math.floor(sr * sec), buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const add = (rate, lmin, lmax, amin, amax, pw) => {
      let t = 0;
      for (;;) {
        t += Math.max(1, Math.floor(-Math.log(1 - Math.random()) * sr / rate));
        if (t >= len) break;
        const L = Math.max(4, Math.floor(sr * this._rnd(lmin, lmax))), A = amin + (amax - amin) * Math.pow(Math.random(), pw), c = this._rnd(0.0, 0.5);
        let lp = 0;
        for (let k = 0; k < L && t + k < len; k++) { lp += (1 - c) * ((Math.random() * 2 - 1) - lp); d[t + k] += A * lp * Math.exp(-5 * k / L); }
      }
    };
    add(9, 0.0005, 0.003, 0.1, 1, 3);
    add(45, 0.0002, 0.0006, 0.02, 0.12, 1);
    add(1.2, 0.004, 0.009, 0.5, 1, 1);
    this._normPeak(d, 0.95);
    return buf;
  }
  _mkIR(sec) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * sec), buf = this.ctx.createBuffer(2, len, sr);
    const pre = Math.floor(sr * 0.018), T60 = sec * 0.8;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / sr, fc = 900 + 8000 * Math.exp(-t * 2.4), a = Math.exp(-2 * Math.PI * fc / sr);
        lp = (1 - a) * (Math.random() * 2 - 1) + a * lp;
        d[i] = lp * Math.sqrt((1 + a) / (1 - a)) * Math.exp(-6.9 * t / T60) * Math.min(1, t / 0.01);
      }
      for (let k = 0; k < 7; k++) {
        const idx = pre + Math.floor(sr * this._rnd(0.004, 0.07));
        if (idx < len) d[idx] += (Math.random() < 0.5 ? -1 : 1) * this._rnd(0.3, 0.7) * (1 - k / 8);
      }
    }
    return buf;
  }
  _mkCurve(fn, n = 2048) { const c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1); return c; }

  // Karplus-Strong guzheng string. The buffer sample-rate is chosen so the loop
  // length is exact (no fractional delay needed) -> perfectly in tune.
  _pluck(midi) {
    let b = this._pk.get(midi);
    if (b) return b;
    const f0 = this._hz(midi);
    const s = Math.min(0.5, Math.max(0.2, 0.5 - (midi - 45) * 0.0085)); // loop filter (lower = brighter)
    const N = Math.max(12, Math.round(32000 / f0 - s));
    const sr = Math.min(96000, Math.max(8000, f0 * (N + s)));
    const t60 = Math.min(7, Math.max(1.3, 7 - (midi - 38) * 0.12));
    const dur = Math.min(4.2, t60 * 0.75), len = Math.ceil(dur * sr);
    const g = Math.pow(10, -3 / (t60 * f0));
    const y = new Float32Array(len);
    const pk = Math.max(1, Math.round(N * 0.14));
    let lp = 0, mean = 0;
    for (let i = 0; i < N; i++) {
      const tri = i < pk ? i / pk : (N - i) / (N - pk);
      lp += 0.55 * ((Math.random() * 2 - 1) - lp);
      y[i] = 0.75 * tri + 0.45 * lp; mean += y[i];
    }
    mean /= N;
    for (let i = 0; i < N; i++) y[i] -= mean;
    const s1 = 1 - s;
    y[N] = g * s1 * y[0];
    for (let i = N + 1; i < len; i++) y[i] = g * (s1 * y[i - N] + s * y[i - N - 1]);
    const cl = Math.floor(sr * 0.0015); // fingernail / plectrum click
    for (let i = 0; i < cl; i++) y[i] += 0.22 * (Math.random() * 2 - 1) * (1 - i / cl);
    let x1 = 0, o1 = 0; // DC blocker
    for (let i = 0; i < len; i++) { const x = y[i]; o1 = x - x1 + 0.995 * o1; x1 = x; y[i] = o1; }
    this._normPeak(y, 0.85);
    const fl = Math.floor(sr * 0.06);
    for (let i = 0; i < fl; i++) y[len - 1 - i] *= i / fl;
    b = this.ctx.createBuffer(1, len, sr);
    b.getChannelData(0).set(y);
    this._pk.set(midi, b);
    return b;
  }

  // ------------------------------------------------------------- node helpers
  _track(n) { if (this._collect) this._collect.push(n); return n; }
  _g(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  _f(type, freq, Q = 0.7071, gain = 0) {
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q; if (gain) f.gain.value = gain; return f;
  }
  _o(type, freq, t, t1) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.start(Math.max(0, t)); if (t1 != null) o.stop(t1); return this._track(o);
  }
  _n(kind, t, t1, rate = 1) {
    const s = this.ctx.createBufferSource(); s.buffer = this._buf[kind]; s.loop = true; s.playbackRate.value = rate;
    s.start(Math.max(0, t), Math.random() * (s.buffer.duration - 0.2)); if (t1 != null) s.stop(t1); return this._track(s);
  }
  _pan(v) {
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, v || 0)); return p; }
    const g = this._g(1); const nop = () => {};
    g.pan = { value: 0, setValueAtTime: nop, setTargetAtTime: nop, linearRampToValueAtTime: nop };
    return g;
  }
  _shaper(kind, os) { const w = this.ctx.createWaveShaper(); w.curve = this._curves[kind]; if (os) w.oversample = os; return w; }
  _hold(p, now) {
    if (p.cancelAndHoldAtTime) { try { p.cancelAndHoldAtTime(now); return; } catch (e) {} }
    const v = p.value; p.cancelScheduledValues(now); p.setValueAtTime(v, now);
  }
  // envelope points [[dt, value, 0=set|1=linear|2=exponential], ...]
  _pts(p, t, pts) {
    for (const [dt, v, m] of pts) {
      const tt = t + dt;
      if (m === 2) p.exponentialRampToValueAtTime(Math.max(v, 1e-4), tt);
      else if (m === 1) p.linearRampToValueAtTime(v, tt);
      else p.setValueAtTime(v, tt);
    }
  }
  _ad(a, pk, d) { return [[0, 0, 0], [a, pk, 1], [a + d, 1e-4, 2]]; }
  _sweep(p, t, pts) {
    p.setValueAtTime(pts[0][1], t + pts[0][0]);
    for (let i = 1; i < pts.length; i++) p.exponentialRampToValueAtTime(Math.max(1, pts[i][1]), t + pts[i][0]);
  }
  _tone(t, dst, type, f, env, det) {
    const dur = env[env.length - 1][0];
    const o = this._o(type, Array.isArray(f) ? f[0][1] : f, t, t + dur + 0.02);
    if (Array.isArray(f)) this._sweep(o.frequency, t, f);
    if (det) o.detune.value = det;
    const g = this._g(0); this._pts(g.gain, t, env);
    o.connect(g); g.connect(dst);
    return g;
  }
  // filtered noise; f = Hz or [[dt, Hz], ...]; x.am = [rate, depth]; x.fm = [rate, Hz]; x.rate = playbackRate
  _noise(t, dst, kind, ft, f, q, env, x) {
    const dur = env[env.length - 1][0], end = t + dur + 0.02;
    const s = this._n(kind, t, end, (x && x.rate) || 1);
    const flt = this._f(ft, Array.isArray(f) ? f[0][1] : f, q);
    if (Array.isArray(f)) this._sweep(flt.frequency, t, f);
    const g = this._g(0); this._pts(g.gain, t, env);
    s.connect(flt); flt.connect(g);
    let out = g;
    if (x && x.am) {
      const vca = this._g(1 - x.am[1] / 2), l = this._o('sine', x.am[0], t, end), lg = this._g(x.am[1] / 2);
      l.connect(lg); lg.connect(vca.gain); g.connect(vca); out = vca;
    }
    if (x && x.fm) { const l = this._o('sine', x.fm[0], t, end), lg = this._g(x.fm[1]); l.connect(lg); lg.connect(flt.frequency); }
    out.connect(dst);
    return out;
  }
  // bell-ish sine partials with individual decays; optional beating pairs / pitch bend / staggered attacks
  _partials(t, dst, f, R, A, D, lvl, x = {}) {
    const att = x.att ?? 0.002, beat = x.beat || [], bend = x.bend;
    for (let i = 0; i < R.length; i++) {
      const fr = f * R[i];
      if (fr > 15000 || fr < 20) continue;
      const a = att * (x.stag ? 1 + i * x.stag : 1), e = t + a + D[i] + 0.05;
      const g = this._g(0); this._pts(g.gain, t, this._ad(a, lvl * A[i], D[i])); g.connect(dst);
      const mk = (ff, amp) => {
        const o = this._o('sine', ff, t, e);
        if (bend) { o.frequency.setValueAtTime(ff, t); o.frequency.exponentialRampToValueAtTime(ff * bend[0], t + bend[1]); }
        if (amp === 1) o.connect(g); else { const og = this._g(amp); o.connect(og); og.connect(g); }
      };
      mk(fr, 1);
      if (beat[i]) mk(fr + beat[i], 0.5);
    }
  }
  _ping(t, dst, f, lvl, dec, pan, parts, att = 0.002) {
    const p = this._pan(pan || 0); p.connect(dst);
    for (const [r, a] of (parts || [[1, 1]])) {
      if (f * r > 15000) continue;
      const d = dec / Math.sqrt(r), o = this._o('sine', f * r, t, t + att + d + 0.05), g = this._g(0);
      this._pts(g.gain, t, this._ad(att, lvl * a, d)); o.connect(g); g.connect(p);
    }
  }
  _bell(t, dst, f, dur, lvl) {
    const R = [0.5, 1, 1.19, 1.5, 2, 2.52, 2.98, 4.05, 5.24, 6.5, 8.1, 10.4, 12.9, 15.7, 19.1];
    const A = [0.6, 0.85, 0.5, 0.3, 0.55, 0.28, 0.22, 0.14, 0.1, 0.07, 0.05, 0.06, 0.045, 0.035, 0.025];
    const D = [1, 0.75, 0.5, 0.42, 0.34, 0.25, 0.19, 0.13, 0.09, 0.065, 0.05, 0.035, 0.028, 0.022, 0.018].map(k => k * dur);
    this._partials(t, dst, f, R, A, D, lvl * 0.2, { att: 0.003, beat: [0.55, 1.05, 0.8, 0, 1.4] });
    this._noise(t, dst, 'brown', 'lowpass', 300, 0.7, this._ad(0.002, 0.45 * lvl, 0.15));
    this._noise(t, dst, 'pink', 'bandpass', Math.min(f * 3.3, 3000), 1.4, this._ad(0.001, 0.2 * lvl, 0.05));
  }
  _gong(t, dst, f, dur, lvl) {
    const R = [1, 1.49, 1.98, 2.44, 2.97, 3.51, 4.08, 4.84, 5.62, 6.7, 8.1];
    const A = [1, 0.75, 0.6, 0.5, 0.42, 0.35, 0.3, 0.22, 0.17, 0.12, 0.08];
    const D = [1, 0.8, 0.62, 0.55, 0.45, 0.38, 0.32, 0.26, 0.2, 0.16, 0.12].map(k => k * dur);
    this._partials(t, dst, f, R, A, D, lvl * 0.16, { att: 0.006, stag: 3, bend: [0.972, 1.6], beat: [0, 0.8, 0, 1.3] });
    this._noise(t, dst, 'pink', 'bandpass', [[0, 900], [0.5, 1600], [dur, 700]], 0.9, [[0, 0, 0], [0.4, 0.22 * lvl, 1], [dur * 0.85, 1e-4, 2]]);
    this._noise(t, dst, 'brown', 'lowpass', 220, 0.7, this._ad(0.002, 0.55 * lvl, 0.18));
  }
  _cymbal(t, dst, vel = 1, dur = 1.8) {
    this._noise(t, dst, 'white', 'highpass', 5200, 0.7, this._ad(0.002, 0.28 * vel, dur));
    this._noise(t, dst, 'pink', 'bandpass', 3200, 0.8, this._ad(0.002, 0.3 * vel, dur * 0.6));
    this._noise(t, dst, 'pink', 'bandpass', 650, 1.4, this._ad(0.002, 0.22 * vel, dur * 0.35));
    const bp = this._f('bandpass', 6500, 0.6), g = this._g(0);
    this._pts(g.gain, t, this._ad(0.001, 0.06 * vel, dur * 0.5));
    for (const fr of [263, 400, 421, 474, 587, 845]) this._o('square', fr * 1.7, t, t + dur * 0.5 + 0.05).connect(bp);
    bp.connect(g); g.connect(dst);
  }
  // drums: B big taiko, M 堂鼓, S small/板鼓, K clapper, W 木鱼 (lower-case = soft)
  _drum(t, dst, c, vel = 1, wf) {
    const k = c.toUpperCase();
    if (c !== k) vel *= 0.55;
    if (k === 'B') {
      const f = this._rnd(88, 98);
      this._tone(t, dst, 'sine', [[0, f * 1.35], [0.02, f], [0.28, f * 0.52]], this._ad(0.002, 0.95 * vel, 1.05));
      this._tone(t, dst, 'sine', [[0, f * 1.62], [0.2, f * 1.1]], this._ad(0.002, 0.28 * vel, 0.22));
      this._noise(t, dst, 'pink', 'lowpass', 1300, 0.7, this._ad(0.001, 0.55 * vel, 0.07));
      this._noise(t, dst, 'brown', 'lowpass', 220, 0.7, this._ad(0.003, 0.4 * vel, 0.35));
    } else if (k === 'M') {
      const f = this._rnd(150, 165);
      this._tone(t, dst, 'sine', [[0, f * 1.3], [0.015, f], [0.18, f * 0.62]], this._ad(0.002, 0.75 * vel, 0.5));
      this._noise(t, dst, 'pink', 'bandpass', 900, 0.9, this._ad(0.001, 0.5 * vel, 0.05));
    } else if (k === 'S') {
      const f = this._rnd(330, 360);
      this._tone(t, dst, 'triangle', [[0, f * 1.2], [0.01, f], [0.1, f * 0.8]], this._ad(0.001, 0.4 * vel, 0.1));
      this._noise(t, dst, 'white', 'bandpass', 2600, 1.2, this._ad(0.001, 0.4 * vel, 0.04));
    } else if (k === 'K') {
      this._noise(t, dst, 'white', 'bandpass', 2100, 5, this._ad(0.0005, 1.1 * vel, 0.03));
      this._tone(t, dst, 'sine', 1650, this._ad(0.0005, 0.25 * vel, 0.03));
    } else if (k === 'W') {
      const f = wf || 620;
      this._tone(t, dst, 'sine', [[0, f * 1.04], [0.05, f]], this._ad(0.001, 0.55 * vel, 0.12));
      this._tone(t, dst, 'sine', f * 2.6, this._ad(0.001, 0.12 * vel, 0.03));
      this._noise(t, dst, 'white', 'bandpass', 1800, 2, this._ad(0.0005, 0.3 * vel, 0.012));
    }
  }

  // guzheng note. o: {vel, dur (damp after), orn: 'vib'|'up'|'bend'|'fall', iv (cents), fs (fall start), pan, tw}
  _zheng(t, dst, midi, o = {}) {
    const base = Math.round(midi), buf = this._pluck(base);
    const vel = Math.max(0.05, Math.min(1, o.vel ?? 0.7));
    const src = this.ctx.createBufferSource(); src.buffer = buf; this._track(src);
    const rate0 = Math.pow(2, (midi - base) / 12), orn = o.orn, iv = o.iv || 200;
    if (orn || o.tw !== 0) {
      const cd = orn ? Math.min(buf.duration, o.ornT || 2.2) : 0.12;
      const n = Math.max(4, Math.ceil(cd * 90)), c = new Float32Array(n);
      const vd = o.vd || this._rnd(22, 40), vr = o.vr || this._rnd(5, 6.5), vdl = o.vdl ?? this._rnd(0.12, 0.3), fs = o.fs ?? 0.55;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * cd;
        let cents = 9 * vel * Math.exp(-x / 0.03); // string-tension twang
        if (orn === 'vib') cents += this._sm(vdl, vdl + 0.35, x) * vd * (0.15 + 0.5 * Math.sin(2 * Math.PI * vr * (x - vdl)));
        else if (orn === 'up') cents += -iv * (1 - this._sm(0.05, 0.05 + (o.gt || 0.16), x)) + this._sm(0.5, 0.8, x) * 12 * Math.sin(2 * Math.PI * 5.5 * x);
        else if (orn === 'bend') cents += iv * (this._sm(0.18, 0.36, x) - this._sm(0.55, 0.78, x));
        else if (orn === 'fall') cents += -iv * this._sm(fs, fs + 0.28, x);
        c[i] = rate0 * Math.pow(2, cents / 1200);
      }
      src.playbackRate.setValueCurveAtTime(c, t, cd);
    } else src.playbackRate.value = rate0;
    const amp = 0.22 + 0.78 * vel * vel;
    const g = this._g(amp);
    let end = t + (buf.duration / rate0) * (orn === 'up' || orn === 'fall' ? 1.15 : 1.02);
    if (o.dur) { const e = t + o.dur; g.gain.setValueAtTime(amp, e); g.gain.setTargetAtTime(0, e, 0.035); end = Math.min(end, e + 0.25); }
    src.start(t); src.stop(end);
    let node = src;
    if (vel < 0.6) { const lp = this._f('lowpass', 1800 + 10000 * vel, 0.5); node.connect(lp); node = lp; }
    node.connect(g);
    const p = this._pan(o.pan ?? Math.max(-0.5, Math.min(0.5, (midi - 62) / 40)));
    g.connect(p); p.connect(dst);
    return end - t;
  }
  _glissNotes(d0, d1, span) {
    const n = Math.abs(d1 - d0) + 1, s = Math.sign(d1 - d0) || 1, out = [];
    for (let i = 0; i < n; i++) { const k = i / Math.max(1, n - 1); out.push({ dt: span * Math.pow(k, 0.9), m: this._dm(d0 + i * s), k }); }
    return out;
  }
  // xiao / dizi: one continuous legato voice per phrase. notes: [{t, d, m, gr}] (seconds, relative)
  _flute(t, dst, notes, o = {}) {
    if (!notes.length) return;
    const lastN = notes[notes.length - 1], T = t + lastN.t + lastN.d, rel = o.rel ?? 0.5, end = T + rel * 1.5 + 0.1;
    const lvl = o.lvl ?? 0.1, f0 = this._hz(notes[0].m);
    const o1 = this._o('sine', f0, t, end), o2 = this._o('triangle', f0, t, end);
    const g2 = this._g(o.bright ?? 0.14); o2.connect(g2);
    const amp = this._g(0); o1.connect(amp); g2.connect(amp);
    const nz = this._n('pink', t, end), bp = this._f('bandpass', f0 * 2, 3), ng = this._g(o.breath ?? 1.1);
    nz.connect(bp); bp.connect(ng); ng.connect(amp);
    const ch = this._n('white', t, end), chp = this._f('bandpass', 2600, 0.8), cg = this._g(0);
    ch.connect(chp); chp.connect(cg); cg.connect(dst);
    const lfo = this._o('sine', o.vr || this._rnd(4.8, 5.6), t, end), lg = this._g(0);
    lfo.connect(lg); lg.connect(o1.detune); lg.connect(o2.detune);
    amp.connect(dst);
    amp.gain.setValueAtTime(0, t);
    const vd = o.vd ?? 14;
    notes.forEach((n, i) => {
      const ts = t + n.t, f = this._hz(n.m);
      if (i === 0) {
        amp.gain.setTargetAtTime(lvl, ts, o.att ?? 0.08);
        cg.gain.setTargetAtTime(lvl * 0.5, ts, 0.01); cg.gain.setTargetAtTime(0, ts + 0.05, 0.05);
      } else {
        if (n.gr) {
          const fg = this._hz(n.m + n.gr);
          for (const os of [o1, o2]) os.frequency.setTargetAtTime(fg, ts - 0.08, 0.01);
        }
        for (const os of [o1, o2]) os.frequency.setTargetAtTime(f, ts, 0.022);
        bp.frequency.setTargetAtTime(f * 2, ts, 0.03);
        amp.gain.setTargetAtTime(lvl * 0.6, ts - 0.05, 0.02);
        amp.gain.setTargetAtTime(lvl, ts + 0.02, 0.05);
        if (!n.gr && Math.random() < 0.5) { cg.gain.setTargetAtTime(lvl * 0.25, ts, 0.01); cg.gain.setTargetAtTime(0, ts + 0.04, 0.04); }
      }
      if (n.d > 0.9) {
        amp.gain.setTargetAtTime(lvl * 1.15, ts + n.d * 0.3, n.d * 0.2);
        amp.gain.setTargetAtTime(lvl * 0.8, ts + n.d * 0.7, n.d * 0.15);
      }
      lg.gain.setTargetAtTime(0, ts, 0.03);
      if (n.d > 0.45) lg.gain.setTargetAtTime(vd, ts + Math.min(0.35, n.d * 0.4), 0.25);
    });
    amp.gain.setTargetAtTime(0, T, rel / 4);
  }
  // suona-like nasal reed: detuned saws -> drive -> formant peaks
  _suona(t, dst, notes, o = {}) {
    if (!notes.length) return;
    const lastN = notes[notes.length - 1], T = t + lastN.t + lastN.d, end = T + 0.4;
    const lvl = o.lvl ?? 0.06, f0 = this._hz(notes[0].m);
    const a = this._o('sawtooth', f0, t, end), b = this._o('sawtooth', f0, t, end);
    b.detune.value = 9;
    const pre = this._g(0.35); a.connect(pre); b.connect(pre);
    const ws = this._shaper('drv', '4x'), p1 = this._f('peaking', 1150, 1.6, 9), p2 = this._f('peaking', 2700, 2, 6);
    const hp = this._f('highpass', 400, 0.7), lp = this._f('lowpass', 5000, 0.7), amp = this._g(0);
    pre.connect(ws); ws.connect(p1); p1.connect(p2); p2.connect(hp); hp.connect(lp); lp.connect(amp); amp.connect(dst);
    const lfo = this._o('sine', 5.8, t, end), lg = this._g(0);
    lfo.connect(lg); lg.connect(a.detune); lg.connect(b.detune);
    amp.gain.setValueAtTime(0, t);
    notes.forEach((n, i) => {
      const ts = t + n.t, f = this._hz(n.m);
      for (const os of [a, b]) {
        if (i > 0 && n.gr) os.frequency.setValueAtTime(this._hz(n.m + n.gr), ts - 0.07);
        os.frequency.setValueAtTime(f * 0.97, ts); os.frequency.setTargetAtTime(f, ts, 0.025);
      }
      if (i) amp.gain.setTargetAtTime(lvl * 0.35, ts - 0.04, 0.012);
      amp.gain.setTargetAtTime(lvl, ts, 0.02);
      lg.gain.setTargetAtTime(0, ts, 0.02);
      if (n.d > 0.3) lg.gain.setTargetAtTime(28, ts + 0.15, 0.12);
    });
    amp.gain.setTargetAtTime(0, T, 0.06);
  }
  // sustained pad (strings / drone). o: {lvl, cut, cutPts, att, rel, type, det, sub, q}
  _pad(t, dst, midis, dur, o = {}) {
    const lvl = o.lvl ?? 0.06, att = Math.min(o.att ?? 2.5, dur * 0.5), rel = Math.min(o.rel ?? 3, dur * 0.5), end = t + dur;
    const type = o.type || 'sawtooth', c = o.cut ?? 700, det = o.det ?? 7;
    const lp = this._f('lowpass', c, o.q ?? 0.6);
    if (o.cutPts) this._sweep(lp.frequency, t, o.cutPts);
    else { lp.frequency.setValueAtTime(c * 0.75, t); lp.frequency.linearRampToValueAtTime(c * 1.25, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(c * 0.8, end); }
    const g = this._g(0);
    const per = lvl / Math.sqrt(midis.length * 2);
    for (const m of midis) {
      const f = this._hz(m);
      for (const s of [-1, 1]) { const os = this._o(type, f, t, end + 0.05); os.detune.value = s * det + this._rnd(-2, 2); os.connect(lp); }
    }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(per, t + att);
    g.gain.setValueAtTime(per, end - rel); g.gain.linearRampToValueAtTime(0, end);
    lp.connect(g); g.connect(dst);
    if (o.sub) {
      const s = this._o('sine', this._hz(midis[0] - 12), t, end + 0.05), sg = this._g(0);
      sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(lvl * o.sub, t + att);
      sg.gain.setValueAtTime(lvl * o.sub, end - rel); sg.gain.linearRampToValueAtTime(0, end);
      s.connect(sg); sg.connect(dst);
    }
  }
  // formant voice (beasts, ghosts, grunts)
  _vox(t, dst, x) {
    const dur = x.dur, end = t + dur + 0.05;
    const src = this._o(x.wave || 'sawtooth', x.f[0][1], t, end);
    this._sweep(src.frequency, t, x.f);
    const mix = this._g(1); src.connect(mix);
    if (x.sub) {
      const s2 = this._o('sawtooth', x.f[0][1] / 2, t, end), sg = this._g(x.sub);
      this._sweep(s2.frequency, t, x.f.map(([a, b]) => [a, b / 2])); s2.connect(sg); sg.connect(mix);
    }
    if (x.jit) { const j = this._n('brown', t, end, x.jr || 1), jg = this._g(x.jit); j.connect(jg); jg.connect(src.frequency); }
    if (x.vib) { const l = this._o('sine', x.vib[0], t, end), lg = this._g(x.vib[1]); l.connect(lg); lg.connect(src.detune); }
    if (x.noise) { const n = this._n('pink', t, end), ng = this._g(x.noise); n.connect(ng); ng.connect(mix); }
    let node = mix;
    if (x.rough) {
      const am = this._g(1 - x.rough / 2), l = this._o('triangle', x.rr || 28, t, end), lg = this._g(x.rough / 2);
      l.connect(lg); lg.connect(am.gain); node.connect(am); node = am;
      if (x.rj) { const j = this._n('brown', t, end, 0.5), jg = this._g(x.rj); j.connect(jg); jg.connect(l.frequency); }
    }
    const out = this._g(0); this._pts(out.gain, t, x.env);
    for (const [ff, q, gg] of x.form) {
      const bp = this._f('bandpass', Array.isArray(ff) ? ff[0][1] : ff, q);
      if (Array.isArray(ff)) this._sweep(bp.frequency, t, ff);
      const fg = this._g(gg); node.connect(bp); bp.connect(fg); fg.connect(out);
    }
    if (x.body) { const lp = this._f('lowpass', x.body, 0.8), bg = this._g(x.bodyG ?? 0.4); node.connect(lp); lp.connect(bg); bg.connect(out); }
    if (x.drive) {
      const pre = this._g(x.drive * 0.5), ws = this._shaper('drv', '2x'), post = this._g(0.7 / Math.sqrt(x.drive));
      out.connect(pre); pre.connect(ws); ws.connect(post); post.connect(dst);
    } else out.connect(dst);
    return dur;
  }

  // ------------------------------------------------------------- spatial / voices
  _spatial(p) {
    const L = this._lis, dx = (+p.x || 0) - L.x, dy = (+p.y || 0) - L.y, dz = (+p.z || 0) - L.z;
    const d = Math.hypot(dx, dy, dz), hd = Math.hypot(dx, dz);
    let g = d <= 4 ? 1 : 4 / d;
    g *= 1 - this._sm(36, 60, d);
    const c = Math.cos(L.yaw), s = Math.sin(L.yaw);
    const right = hd > 1e-3 ? (dx * c - dz * s) / hd : 0, fwd = hd > 1e-3 ? (-dx * s - dz * c) / hd : 1;
    const pan = right * 0.85 * Math.min(1, hd / 3);
    let lp = d > 8 ? 20000 / (1 + (d - 8) / 10) : 20000;
    if (fwd < 0) lp *= 1 + 0.3 * fwd;
    return { g, pan, lp: Math.max(900, lp), r: Math.min(1, Math.sqrt(g) * 1.1), d };
  }
  _kill(V, now) {
    const i = this._voices.indexOf(V);
    if (i >= 0) this._voices.splice(i, 1);
    for (const p of [V.dry.gain, V.snd.gain]) { this._hold(p, now); p.linearRampToValueAtTime(0, now + 0.03); }
    for (const s of V.srcs) { try { s.stop(now + 0.06); } catch (e) {} }
    V.end = now + 0.12;
    this._dying.push(V);
  }
  _disc(list) { for (const n of list) { try { n.disconnect(); } catch (e) {} } }
  _reap(now) {
    if (this._voices.length && this._voices.some(v => v.end < now)) {
      this._voices = this._voices.filter(v => { if (v.end < now) { this._disc(v.disc); return false; } return true; });
    }
    if (this._dying.length) this._dying = this._dying.filter(v => { if (v.end < now) { this._disc(v.disc); return false; } return true; });
    if (this._loops.length) this._loops = this._loops.filter(L => { if (!L.alive && L.end < now) { this._disc(L.disc); return false; } return true; });
    if (this._sessions.length) this._sessions = this._sessions.filter(S => { if (S.dead && S.kill < now) { this._disc([S.out, S.wet, S.ech]); return false; } return true; });
    if (this._beds.length) this._beds = this._beds.filter(B => { if (B.dead && B.kill < now) { this._disc([B.out, B.wet]); return false; } return true; });
  }
  _tick() {
    if (!this.ok || this._ticking) return;
    this._ticking = true;
    try {
      this._lastTick = this._wall();
      const hidden = typeof document !== 'undefined' && document.hidden;
      const now = this.ctx.currentTime, h = now + (hidden ? 1.6 : GameAudio.LOOK);
      this._musicTick(now, h);
      for (const B of this._beds) if (!B.dead) this._bedTick(B, now, h);
      for (const L of this._loops) if (L.alive) { this._loopGain(L, false); if (L.tick) L.tick(now, h); }
      this._reap(now);
    } catch (e) { this._warn('tick', e); }
    this._ticking = false;
  }

  // ------------------------------------------------------------- loops
  _loopGain(L, instant) {
    const now = this.ctx.currentTime;
    let g = L.vol * L.M[0], pan = 0, r = 1;
    if (L.pos) { const sp = this._spatial(L.pos); g *= sp.g; pan = sp.pan; r = sp.r; }
    const snd = L.vol * L.M[0] * L.M[2] * r;
    if (instant) { L.out.gain.setValueAtTime(g, now); L.pan.pan.setValueAtTime(pan, now); L.snd.gain.setValueAtTime(snd, now); }
    else if (Math.abs(g - (L._g ?? -1)) > 1e-4 || Math.abs(pan - (L._p ?? 9)) > 1e-3) {
      L.out.gain.setTargetAtTime(g, now, 0.06); L.pan.pan.setTargetAtTime(pan, now, 0.06); L.snd.gain.setTargetAtTime(snd, now, 0.06);
    }
    L._g = g; L._p = pan;
  }
  _stopLoop(L, f) {
    if (!L.alive || !this.ok) return;
    L.alive = false;
    const now = this.ctx.currentTime, fd = Math.max(0.02, f);
    this._hold(L.fade.gain, now); L.fade.gain.linearRampToValueAtTime(0, now + fd);
    for (const s of L.srcs) { try { s.stop(now + fd + 0.05); } catch (e) {} }
    L.end = now + fd + 0.15;
  }
  _loop_charge(L, now) {
    const o1 = this._o('sawtooth', 110, now), o2 = this._o('sawtooth', 110, now), o3 = this._o('square', 55, now);
    o2.detune.value = 14;
    const g3 = this._g(0.25), lp = this._f('lowpass', 500, 5), trem = this._g(0.8), lfo = this._o('sine', 6, now), lg = this._g(0.2);
    o3.connect(g3); o1.connect(lp); o2.connect(lp); g3.connect(lp); lp.connect(trem);
    lfo.connect(lg); lg.connect(trem.gain);
    const nz = this._n('pink', now, null), bp = this._f('bandpass', 1200, 3), ng = this._g(0.6);
    nz.connect(bp); bp.connect(ng); ng.connect(trem);
    const sh = this._o('sine', 880, now), shg = this._g(0.03); sh.connect(shg); shg.connect(trem); // bright core
    trem.connect(L.in);
    L.setP = (p, t) => {
      p = Math.max(0.25, Math.min(4, p));
      o1.frequency.setTargetAtTime(110 * p, t, 0.05); o2.frequency.setTargetAtTime(110 * p, t, 0.05);
      o3.frequency.setTargetAtTime(55 * p, t, 0.05); sh.frequency.setTargetAtTime(880 * p, t, 0.05);
      lp.frequency.setTargetAtTime(Math.min(8000, 500 * Math.pow(p, 1.6)), t, 0.05);
      lfo.frequency.setTargetAtTime(6 * Math.pow(p, 1.4), t, 0.05);
      bp.frequency.setTargetAtTime(Math.min(9000, 1200 * p), t, 0.05);
    };
  }
  _loop_fire(L, now) {
    const roar = this._n('brown', now, null), rlp = this._f('lowpass', 420, 0.6), rg = this._g(0.8);
    roar.connect(rlp); rlp.connect(rg); rg.connect(L.in);
    const hiss = this._n('pink', now, null), hbp = this._f('bandpass', 2800, 0.6), hg = this._g(0.09);
    hiss.connect(hbp); hbp.connect(hg); hg.connect(L.in);
    const rate = this._rnd(0.9, 1.1), crk = this._n('crackle', now, null, rate), chp = this._f('highpass', 900, 0.7), cg = this._g(0.55);
    crk.connect(chp); chp.connect(cg); cg.connect(L.in);
    L.tick = (t, h) => {
      while (L.nx < h) { const tt = Math.max(L.nx, t); rg.gain.setTargetAtTime(this._rnd(0.45, 1.0), tt, 0.2); L.nx = tt + this._rnd(0.2, 0.7); }
    };
    L.setP = (p, t) => {
      roar.playbackRate.setTargetAtTime(p, t, 0.05); hiss.playbackRate.setTargetAtTime(p, t, 0.05); crk.playbackRate.setTargetAtTime(rate * p, t, 0.05);
    };
  }
  _loop_wind(L, now) {
    const W = this._windChain(L.in, 0, 1, now);
    L.tick = (t, h) => { while (L.nx < h) { const tt = Math.max(L.nx, t); this._gust(W, tt, L.pitch); L.nx = tt + this._rnd(1.0, 3.2); } };
    L.setP = (p, t) => { W.n.playbackRate.setTargetAtTime(p, t, 0.1); W.w.playbackRate.setTargetAtTime(p, t, 0.1); };
  }
  _windChain(dst, pan, str, now) {
    const n = this._n('pink', now, null), bp = this._f('bandpass', 400, 0.8), g = this._g(0.15 * str);
    const w = this._n('white', now, null), wbp = this._f('bandpass', 800, 12), wg = this._g(0);
    const r = this._f('bandpass', 5200, 0.9), rg = this._g(0);
    const p = this._pan(pan);
    n.connect(bp); bp.connect(g); g.connect(p);
    w.connect(wbp); wbp.connect(wg); wg.connect(p);
    w.connect(r); r.connect(rg); rg.connect(p);
    p.connect(dst);
    return { n, w, bp, g, wbp, wg, rg, str };
  }
  _gust(W, t, p = 1) {
    const x = Math.pow(this._rnd(0.12, 1), 1.3), tc = this._rnd(0.5, 1.5);
    W.g.gain.setTargetAtTime((0.1 + 0.4 * x) * W.str, t, tc);
    W.bp.frequency.setTargetAtTime((200 + 650 * x) * p, t, tc);
    W.wbp.frequency.setTargetAtTime((550 + 750 * x) * p, t, tc * 1.3);
    W.wg.gain.setTargetAtTime(0.9 * x * x * W.str, t, tc);
    W.rg.gain.setTargetAtTime(0.12 * x * x * x * W.str, t, tc * 0.7);
  }

  // ============================================================== SFX recipes
  // each: (t, V, o) -> duration.  V.in = voice input, V.wet = reverb-only input, V.sat() = saturated input
  _sfx_swing_light(t, V, o) {
    const p = o.pitch, k = 1 / p, a = 0.075 * k, d = 0.16 * k;
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 420 * p], [a, 1900 * p], [a + d, 650 * p]], 1.7, this._ad(a, 1.2, d));
    this._noise(t, V.in, 'white', 'highpass', 3500 * p, 0.7, this._ad(a * 0.9, 0.08, d * 0.7));
    return a + d;
  }
  _sfx_swing_heavy(t, V, o) {
    const p = o.pitch, k = 1 / p, a = 0.2 * k, d = 0.38 * k;
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 200 * p], [a, 950 * p], [a + d, 260 * p]], 1.1, this._ad(a, 1.3, d), { am: [9 * p, 0.45] });
    this._noise(t, V.in, 'brown', 'lowpass', [[0, 120 * p], [a, 320 * p], [a + d, 120 * p]], 0.8, this._ad(a, 0.9, d));
    this._noise(t, V.in, 'white', 'bandpass', 2600 * p, 0.8, this._ad(a * 0.9, 0.07, d * 0.6));
    return a + d;
  }
  _sfx_swing_blade(t, V, o) {
    const p = o.pitch, k = 1 / p, a = 0.06 * k, d = 0.14 * k;
    this._noise(t, V.in, 'white', 'bandpass', [[0, 1600 * p], [a, 5200 * p], [a + d, 2400 * p]], 3.2, this._ad(a, 0.9, d));
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 700 * p], [a, 1600 * p], [a + d, 800 * p]], 1.5, this._ad(a, 0.45, d));
    this._tone(t + a * 0.6, V.in, 'sine', 3720 * p, this._ad(0.004, 0.025, 0.25));
    this._tone(t + a * 0.6, V.in, 'sine', 5310 * p, this._ad(0.004, 0.018, 0.18));
    return a + d + 0.3;
  }
  _sfx_hit_staff(t, V, o) {
    const r = this._rnd(0.93, 1.07) * o.pitch;
    this._tone(t, V.sat(), 'sine', [[0, 125 * r], [0.09, 52 * r]], this._ad(0.002, 0.85, 0.22));
    this._noise(t, V.in, 'brown', 'lowpass', 800 * r, 0.8, this._ad(0.002, 0.9, 0.11));
    this._noise(t, V.in, 'white', 'bandpass', 2300 * r, 2.2, this._ad(0.001, 0.55, 0.035));
    this._tone(t, V.in, 'triangle', [[0, 560 * r], [0.05, 520 * r]], this._ad(0.001, 0.25, 0.06));
    this._noise(t, V.in, 'pink', 'bandpass', 1100 * r, 1, this._ad(0.002, 0.4, 0.06));
    return 0.3;
  }
  _sfx_hit_heavy(t, V, o) {
    const r = this._rnd(0.95, 1.05) * o.pitch;
    this._tone(t, V.sat(), 'sine', [[0, 95 * r], [0.35, 33 * r]], this._ad(0.003, 0.95, 0.9));
    this._noise(t, V.in, 'brown', 'lowpass', 380 * r, 0.8, this._ad(0.003, 1.0, 0.35));
    this._noise(t, V.in, 'white', 'bandpass', 1500 * r, 1, this._ad(0.001, 0.6, 0.05));
    this._noise(t, V.in, 'grit', 'bandpass', 2200 * r, 0.8, this._ad(0.02, 0.6, 0.5));
    this._noise(t + 0.08, V.in, 'grit', 'lowpass', 1200 * r, 0.7, this._ad(0.02, 0.4, 0.4), { rate: 0.7 });
    return 1.0;
  }
  _sfx_hit_metal(t, V, o) {
    const f = this._rnd(640, 860) * o.pitch;
    this._partials(t, V.in, f, [1, 2.76, 5.4, 8.93, 1.49], [1, 0.6, 0.35, 0.2, 0.3], [0.7, 0.4, 0.2, 0.1, 0.35], 0.2, { beat: [2.1, 0, 0, 0, 1.3] });
    this._noise(t, V.in, 'white', 'bandpass', 3500, 1.2, this._ad(0.001, 0.55, 0.03));
    this._noise(t, V.in, 'grit', 'highpass', 4000, 0.7, this._ad(0.003, 0.25, 0.12), { rate: 1.5 });
    return 0.9;
  }
  _sfx_hit_player(t, V, o) {
    const r = this._rnd(0.92, 1.08) * o.pitch;
    this._tone(t, V.sat(), 'sine', [[0, 90 * r], [0.12, 45 * r]], this._ad(0.003, 0.85, 0.25));
    this._noise(t, V.in, 'brown', 'lowpass', 450 * r, 0.8, this._ad(0.002, 0.8, 0.12));
    this._noise(t, V.in, 'pink', 'bandpass', 900 * r, 1, this._ad(0.001, 0.3, 0.045));
    const g = this._rnd(0.9, 1.15) * r, gt = t + 0.012;
    this._vox(gt, V.in, {
      dur: 0.24, f: [[0, 160 * g], [0.05, 178 * g], [0.24, 112 * g]], jit: 6, rough: 0.25, rr: 40, noise: 0.25,
      form: [[560 * g, 5, 2.4], [980 * g, 6, 1.5], [2450 * g, 8, 0.5]], body: 700, bodyG: 0.2,
      env: [[0, 0, 0], [0.015, 0.3, 1], [0.08, 0.22, 1], [0.24, 1e-4, 2]],
    });
    return 0.35;
  }
  _sfx_footstep(t, V, o) {
    const r = this._rnd(0.85, 1.15) * o.pitch;
    this._noise(t, V.in, 'brown', 'lowpass', 520 * r, 0.9, this._ad(0.003, 0.9 * this._rnd(0.8, 1), 0.07));
    this._noise(t + 0.012, V.in, 'grit', 'bandpass', 2100 * r, 0.9, this._ad(0.004, 0.45 * this._rnd(0.6, 1), 0.06));
    this._noise(t + 0.045 * this._rnd(0.8, 1.2), V.in, 'pink', 'lowpass', 1000 * r, 0.7, this._ad(0.004, 0.3, 0.05));
    return 0.14;
  }
  _sfx_dodge(t, V, o) {
    const p = o.pitch, a = 0.08 / p, d = 0.2 / p;
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 600 * p], [a, 1700 * p], [a + d, 600 * p]], 1.3, this._ad(a, 1.0, d), { am: [23, 0.45] });
    this._noise(t, V.in, 'white', 'highpass', 4500, 0.7, this._ad(a, 0.06, d * 0.7));
    this._noise(t + 0.2, V.in, 'brown', 'lowpass', 900, 0.7, this._ad(0.01, 0.16, 0.08));
    return 0.34;
  }
  _sfx_perfect_dodge(t, V, o) {
    const p = o.pitch, T = 0.42;
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 350], [T, 3200]], 1.2, [[0, 1e-4, 0], [T, 0.8, 2], [T + 0.05, 1e-4, 2]]);
    this._noise(t, V.in, 'white', 'highpass', [[0, 2000], [T, 7000]], 0.7, [[0, 1e-4, 0], [T, 0.12, 2], [T + 0.04, 1e-4, 2]]);
    this._tone(t + T - 0.02, V.sat(), 'sine', [[0, 110], [0.6, 42]], this._ad(0.01, 0.5, 0.8));
    const notes = [86, 89, 93, 96, 98, 101];
    for (let i = 0; i < 7; i++) this._ping(t + T + i * 0.07 + this._rnd(0, 0.03), V.in, this._hz(this._pick(notes)) * p, 0.07, 1.1, this._rnd(-0.7, 0.7), [[1, 1], [2.76, 0.12]]);
    const tr = this._g(0.7), l = this._o('sine', 7, t + T, t + T + 1.7), lg = this._g(0.3);
    l.connect(lg); lg.connect(tr.gain); tr.connect(V.in);
    this._tone(t + T, tr, 'sine', this._hz(93) * p, [[0, 0, 0], [0.08, 0.06, 1], [1.6, 1e-4, 2]]);
    this._tone(t + T, tr, 'sine', this._hz(98) * p, [[0, 0, 0], [0.08, 0.05, 1], [1.6, 1e-4, 2]]);
    return T + 1.7;
  }
  _sfx_focus_gain(t, V, o) {
    const f = this._hz(this._pick([93, 96, 98])) * o.pitch;
    this._ping(t, V.in, f, 0.14, 0.18, 0, [[1, 1], [2, 0.25]]);
    return 0.25;
  }
  _sfx_focus_full(t, V, o) {
    const p = o.pitch;
    this._ping(t, V.in, this._hz(93) * p, 0.16, 0.7, -0.15, [[1, 1], [2, 0.3], [3.01, 0.1]]);
    this._ping(t + 0.09, V.in, this._hz(98) * p, 0.18, 0.9, 0.15, [[1, 1], [2, 0.3], [3.01, 0.1]]);
    this._noise(t, V.in, 'white', 'bandpass', 6000, 2, this._ad(0.05, 0.05, 0.4));
    return 1.0;
  }
  _sfx_spell_immobilize(t, V, o) {
    const p = o.pitch;
    this._bell(t, V.in, 220 * p, 3.5, 0.55);
    this._noise(t, V.in, 'white', 'bandpass', [[0, 1500], [0.35, 7000]], 1.2, this._ad(0.12, 0.22, 0.8));
    this._noise(t + 0.05, V.in, 'grit', 'highpass', 3000, 0.7, this._ad(0.002, 0.3, 0.15));
    const hi = [98, 101, 103, 105, 108];
    for (let i = 0; i < 12; i++) this._ping(t + this._rnd(0.05, 0.9), V.in, this._hz(this._pick(hi)) * p, this._rnd(0.03, 0.06), this._rnd(0.3, 0.6), this._rnd(-0.8, 0.8), [[1, 1], [2.76, 0.15]]);
    return 3.6;
  }
  _sfx_spell_clone(t, V, o) {
    const p = o.pitch;
    for (const [dt, pan, lv] of [[0, 0, 1], [0.1, -0.6, 0.7], [0.19, 0.6, 0.7]]) {
      const P = this._pan(pan); P.connect(V.in);
      this._noise(t + dt, P, 'pink', 'bandpass', [[0, 1600 * p], [0.3, 450 * p]], 0.9, this._ad(0.012, 0.9 * lv, 0.35));
      this._tone(t + dt, P, 'sine', [[0, 200 * p], [0.05, 90 * p]], this._ad(0.002, 0.35 * lv, 0.06));
    }
    const hi = [96, 98, 101, 103, 105];
    for (let i = 0; i < 10; i++) this._ping(t + this._rnd(0.1, 0.7), V.in, this._hz(this._pick(hi)) * p, this._rnd(0.03, 0.055), this._rnd(0.3, 0.6), this._rnd(-0.8, 0.8), [[1, 1], [2.76, 0.1]]);
    return 1.3;
  }
  _sfx_spell_rocksolid(t, V, o) {
    const p = o.pitch;
    this._gong(t + 0.03, V.in, 98 * p, 2.8, 0.5);
    this._partials(t + 0.03, V.in, 311 * p, [1, 1.83, 2.71, 3.62, 4.95], [1, 0.7, 0.5, 0.35, 0.2], [1.6, 1.2, 0.9, 0.6, 0.4], 0.07, { att: 0.12, bend: [1.05, 0.35] });
    this._noise(t + 0.03, V.in, 'white', 'bandpass', 3000, 1.5, this._ad(0.001, 0.4, 0.04));
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 2000], [0.25, 5000]], 1, this._ad(0.08, 0.18, 0.2));
    return 3.0;
  }
  _sfx_rocksolid_deflect(t, V, o) {
    const f = this._rnd(225, 255) * o.pitch;
    this._partials(t, V.in, f, [1, 2.32, 4.25, 6.63, 9.38, 1.51], [1, 0.7, 0.5, 0.3, 0.18, 0.4], [2.6, 1.6, 1.0, 0.6, 0.35, 1.2], 0.2, { beat: [1.3, 1.9, 0, 0, 0, 0.9] });
    this._noise(t, V.in, 'white', 'bandpass', 3200, 1, this._ad(0.001, 0.7, 0.03));
    this._tone(t, V.sat(), 'sine', [[0, 95], [0.2, 48]], this._ad(0.002, 0.6, 0.25));
    this._noise(t, V.in, 'grit', 'highpass', 3500, 0.7, this._ad(0.002, 0.35, 0.25), { rate: 1.4 });
    return 2.8;
  }
  _sfx_gourd(t, V, o) {
    const p = o.pitch;
    for (const b of [0, 0.22, 0.43, 0.64]) {
      const tt = t + b + this._rnd(0, 0.04);
      this._tone(tt, V.in, 'sine', [[0, this._rnd(190, 240) * p], [0.06, this._rnd(420, 520) * p]], this._ad(0.008, 0.45, 0.085));
      this._noise(tt, V.in, 'brown', 'lowpass', 380, 0.8, this._ad(0.01, 0.45, 0.09));
      this._tone(tt + 0.02, V.in, 'sine', [[0, 120], [0.1, 80]], this._ad(0.01, 0.3, 0.1));
    }
    // built-in heal shimmer; muted automatically if the game also plays 'heal' separately
    V.healG = this._g(1); V.healG.connect(V.in); V.disc.push(V.healG);
    this._sfx_heal(t + 0.9, { in: V.healG, wet: V.wet }, { pitch: p, lvl: 0.8 });
    return 3.1;
  }
  _sfx_heal(t, V, o) {
    const p = o.pitch, L = o.lvl ?? 1;
    [74, 77, 81, 84, 86, 89, 93].forEach((m, i) => this._ping(t + i * 0.075, V.in, this._hz(m) * p, 0.075 * L, 1.1, (i / 6 - 0.5) * 0.6, [[1, 1], [2, 0.2]], 0.02));
    this._tone(t, V.in, 'sine', this._hz(74) * p, [[0, 0, 0], [0.5, 0.06 * L, 1], [2.0, 1e-4, 2]]);
    this._tone(t, V.in, 'sine', this._hz(81) * p, [[0, 0, 0], [0.5, 0.045 * L, 1], [2.0, 1e-4, 2]]);
    this._noise(t, V.in, 'white', 'bandpass', [[0, 2500], [0.8, 6500]], 2, this._ad(0.5, 0.05 * L, 0.8));
    return 2.1;
  }
  _sfx_wolf_growl(t, V, o) {
    const r = this._rnd(0.9, 1.1) * o.pitch, dur = this._rnd(0.9, 1.3);
    this._vox(t, V.in, {
      dur, f: [[0, 78 * r], [0.25 * dur, 96 * r], [dur, 72 * r]], sub: 0.4, jit: 10 * r, rough: 0.85, rr: this._rnd(24, 32), rj: 8, noise: 0.6,
      form: [[340 * r, 4, 2.2], [[[0, 850 * r], [dur * 0.5, 1050 * r], [dur, 800 * r]], 5, 1.5], [2300 * r, 6, 0.6]], body: 500, bodyG: 0.9,
      env: [[0, 0, 0], [0.12, 0.9, 1], [dur - 0.25, 0.75, 1], [dur, 1e-4, 2]], drive: 2,
    });
    return dur + 0.1;
  }
  _sfx_wolf_hurt(t, V, o) {
    const r = this._rnd(0.9, 1.12) * o.pitch, dur = 0.38;
    this._vox(t, V.in, {
      dur, f: [[0, 330 * r], [0.04, 520 * r], [dur, 300 * r]], jit: 12, rough: 0.35, rr: 48, noise: 0.35,
      form: [[750 * r, 4, 1.8], [1600 * r, 5, 1.2], [2900 * r, 6, 0.5]], body: 900, bodyG: 0.3,
      env: [[0, 0, 0], [0.012, 0.9, 1], [0.1, 0.6, 1], [dur, 1e-4, 2]],
    });
    this._tone(t, V.in, 'triangle', [[0, 900 * r], [0.25, 620 * r]], this._ad(0.02, 0.05, 0.25));
    this._noise(t, V.in, 'pink', 'bandpass', 1200, 1, this._ad(0.005, 0.25, 0.08));
    return 0.5;
  }
  _sfx_wolf_death(t, V, o) {
    const r = this._rnd(0.92, 1.08) * o.pitch, dur = 1.5;
    this._vox(t, V.in, {
      dur, f: [[0, 420 * r], [0.15, 540 * r], [0.5, 470 * r], [dur, 190 * r]], jit: 8, rough: 0.5, rr: 34, rj: 10, noise: 0.35,
      form: [[[[0, 700 * r], [dur, 380 * r]], 5, 1.8], [[[0, 1250 * r], [dur, 850 * r]], 6, 1.1], [2700 * r, 7, 0.4]], body: 700, bodyG: 0.35,
      env: [[0, 0, 0], [0.03, 0.8, 1], [0.5, 0.65, 1], [1.0, 0.35, 1], [dur, 1e-4, 2]],
    });
    this._noise(t + 1.1, V.in, 'pink', 'bandpass', 1100, 0.8, [[0, 0, 0], [0.1, 0.18, 1], [0.7, 1e-4, 2]]);
    this._noise(t + 1.2, V.in, 'brown', 'lowpass', 300, 0.7, this._ad(0.005, 0.45, 0.2));
    return 2.0;
  }
  _sfx_boss_roar(t, V, o) {
    const r = this._rnd(0.95, 1.05) * o.pitch, dur = 2.6;
    const env = [[0, 0, 0], [0.28, 0.9, 1], [1.6, 0.8, 1], [dur, 1e-4, 2]];
    this._vox(t, V.in, {
      dur, f: [[0, 58 * r], [0.4, 74 * r], [1.4, 68 * r], [dur, 50 * r]], sub: 0.5, jit: 12, rough: 0.9, rr: 21, rj: 6, noise: 0.8,
      form: [[[[0, 560 * r], [0.5, 720 * r], [dur, 520 * r]], 3, 2.4], [[[0, 1000 * r], [0.5, 1250 * r], [dur, 950 * r]], 4, 1.6], [2500 * r, 5, 0.8]],
      body: 400, bodyG: 1.2, env, drive: 2.5,
    });
    this._vox(t + 0.05, V.in, {
      dur, f: [[0, 118 * r], [0.45, 150 * r], [1.5, 138 * r], [dur, 100 * r]], jit: 15, rough: 0.6, rr: 33, rj: 8, noise: 0.5,
      form: [[800 * r, 3, 1.6], [1350 * r, 4, 1.1], [2900 * r, 5, 0.5]], body: 700, bodyG: 0.4,
      env: env.map(([a, b, c]) => [a, b * 0.6, c]), drive: 2,
    });
    this._tone(t, V.sat(), 'sine', [[0, 46 * r], [dur, 38 * r]], [[0, 0, 0], [0.4, 0.5, 1], [1.8, 0.4, 1], [dur, 1e-4, 2]]);
    this._noise(t, V.in, 'pink', 'bandpass', 650, 0.6, [[0, 0, 0], [0.3, 0.3, 1], [dur, 1e-4, 2]]);
    return dur + 0.2;
  }
  _sfx_wight_moan(t, V, o) {
    const r = this._rnd(0.9, 1.1) * o.pitch, dur = 2.6;
    const f = [[0, 180 * r], [0.9, 235 * r], [1.6, 205 * r], [dur, 150 * r]];
    const form = [[[[0, 320], [1.2, 650], [dur, 340]], 6, 3.0], [[[0, 800], [1.2, 1050], [dur, 780]], 7, 1.2], [2400, 8, 0.3]];
    this._vox(t, V.in, { dur, wave: 'triangle', f, jit: 3, rough: 0.12, rr: 6, noise: 0.15, form, body: 400, bodyG: 0.5, vib: [4.3, 35], env: [[0, 0, 0], [0.5, 0.7, 1], [2.0, 0.6, 1], [dur, 1e-4, 2]] });
    this._vox(t + 0.15, V.in, { dur: dur - 0.15, wave: 'triangle', f: f.map(([a, b]) => [a, b * 1.059]), jit: 3, rough: 0.12, rr: 5, form, body: 400, bodyG: 0.5, vib: [3.7, 30], env: [[0, 0, 0], [0.6, 0.32, 1], [1.8, 0.28, 1], [dur - 0.15, 1e-4, 2]] });
    this._noise(t, V.wet, 'white', 'bandpass', [[0, 2000], [dur, 3200]], 2.5, [[0, 0, 0], [0.8, 0.1, 1], [dur, 1e-4, 2]]);
    return dur + 0.2;
  }
  _sfx_wisp(t, V, o) {
    const p = o.pitch, dur = 0.7;
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 500 * p], [0.25, 1800 * p], [dur, 800 * p]], 3, this._ad(0.2, 0.9, 0.5), { fm: [8, 300] });
    this._noise(t, V.in, 'brown', 'lowpass', 400, 0.7, this._ad(0.05, 0.45, 0.4));
    this._tone(t, V.in, 'sine', [[0, 1100 * p], [0.3, 1450 * p], [dur, 900 * p]], this._ad(0.15, 0.03, 0.5));
    return dur + 0.1;
  }
  _sfx_fire_burst(t, V, o) {
    const p = o.pitch;
    this._noise(t, V.in, 'brown', 'lowpass', [[0, 250 * p], [0.12, 2600 * p], [0.9, 500 * p]], 1.2, [[0, 0, 0], [0.08, 1.1, 1], [1.0, 1e-4, 2]]);
    this._noise(t, V.in, 'pink', 'highpass', 1800 * p, 0.7, this._ad(0.06, 0.2, 0.7));
    this._noise(t, V.in, 'crackle', 'highpass', 1200, 0.7, [[0, 0, 0], [0.05, 0.9, 1], [1.3, 1e-4, 2]], { rate: 1.2 });
    this._tone(t, V.sat(), 'sine', [[0, 75], [0.25, 38]], this._ad(0.005, 0.5, 0.35));
    return 1.35;
  }
  _sfx_slam(t, V, o) {
    const r = this._rnd(0.95, 1.05) * o.pitch;
    this._tone(t, V.sat(), 'sine', [[0, 80 * r], [0.45, 28 * r]], this._ad(0.003, 1.0, 1.1));
    this._noise(t, V.in, 'brown', 'lowpass', 220 * r, 0.8, this._ad(0.004, 1.0, 0.8));
    this._noise(t, V.in, 'white', 'bandpass', 1200 * r, 0.8, this._ad(0.001, 0.5, 0.04));
    this._noise(t, V.in, 'grit', 'bandpass', 900 * r, 0.7, this._ad(0.03, 0.8, 0.9));
    this._noise(t + 0.15, V.in, 'grit', 'lowpass', 2500, 0.7, this._ad(0.03, 0.45, 0.6), { rate: 0.8 });
    return 1.4;
  }
  _sfx_shockwave(t, V, o) {
    const p = o.pitch;
    this._tone(t, V.sat(), 'sine', [[0, 140 * p], [0.7, 30 * p]], this._ad(0.01, 0.8, 0.9));
    this._noise(t, V.in, 'pink', 'lowpass', [[0, 3000 * p], [0.8, 150 * p]], 0.9, this._ad(0.02, 0.7, 0.8));
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 1200 * p], [0.7, 200 * p]], 4, this._ad(0.02, 0.4, 0.7));
    return 1.0;
  }
  _sfx_enemy_death(t, V, o) {
    const p = o.pitch;
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 300 * p], [0.9, 2600 * p]], 2.2, [[0, 0, 0], [0.35, 0.6, 1], [1.0, 1e-4, 2]]);
    this._noise(t, V.in, 'white', 'bandpass', [[0, 1500 * p], [0.9, 6000 * p]], 1.5, this._ad(0.4, 0.06, 0.5));
    this._ping(t + 0.25, V.in, this._hz(81) * p, 0.07, 1.4, -0.2, [[1, 1], [2, 0.2], [3, 0.08]], 0.01);
    this._ping(t + 0.42, V.in, this._hz(86) * p, 0.06, 1.4, 0.2, [[1, 1], [2, 0.2], [3, 0.08]], 0.01);
    return 1.9;
  }
  _sfx_will_pickup(t, V, o) {
    const [a, b] = this._pick([[86, 93], [89, 96], [81, 86], [84, 91]]), p = o.pitch;
    this._ping(t, V.in, this._hz(a) * p, 0.09, 0.8, -0.1, [[1, 1], [2.76, 0.08]], 0.004);
    this._ping(t + 0.07, V.in, this._hz(b) * p, 0.08, 0.9, 0.1, [[1, 1], [2.76, 0.08]], 0.004);
    return 1.1;
  }
  _sfx_shrine_rest(t, V, o) {
    const p = o.pitch;
    this._bell(t, V.in, 147 * p, 5.5, 0.45);
    this._pad(t + 0.1, V.in, [53, 60, 65, 69, 74], 5, { type: 'triangle', lvl: 0.12, att: 0.8, rel: 3.5, cut: 1800, det: 5 });
    [53, 57, 60, 65, 69, 74].forEach((m, i) => this._zheng(t + 0.25 + i * 0.11, V.in, m, { vel: 0.45, orn: i === 5 ? 'vib' : null }));
    return 6;
  }
  _sfx_bell(t, V, o) { this._bell(t, V.in, 110 * o.pitch, 9, 0.8); return 9; }
  _sfx_gong(t, V, o) { this._gong(t, V.in, 92 * o.pitch, 6.5, 0.75); return 6.5; }
  _sfx_ui_hover(t, V, o) { this._tone(t, V.in, 'sine', 2400 * o.pitch, this._ad(0.002, 0.08, 0.03)); return 0.05; }
  _sfx_ui_click(t, V, o) {
    this._tone(t, V.in, 'triangle', [[0, 950 * o.pitch], [0.04, 760 * o.pitch]], this._ad(0.001, 0.3, 0.05));
    this._noise(t, V.in, 'white', 'bandpass', 2800, 3, this._ad(0.001, 0.3, 0.015));
    return 0.08;
  }
  _sfx_ui_open(t, V, o) {
    this._noise(t, V.in, 'pink', 'bandpass', [[0, 700], [0.18, 2200], [0.4, 1200]], 1.2, this._ad(0.15, 0.3, 0.25));
    this._zheng(t + 0.04, V.in, 69, { vel: 0.4, dur: 2.0 });
    this._zheng(t + 0.11, V.in, 74, { vel: 0.35, dur: 2.0 });
    return 2.4;
  }
  _sfx_boss_intro(t, V, o) {
    this._drum(t, V.in, 'B', 1.1);
    this._drum(t + 0.42, V.in, 'B', 0.8);
    this._gong(t + 0.01, V.in, 85, 6, 0.6);
    this._pad(t, V.in, [26, 33, 38], 5.5, { type: 'sawtooth', lvl: 0.3, att: 2.0, rel: 3, cutPts: [[0, 120], [2.2, 900], [5.5, 200]], sub: 0.5 });
    return 6.5;
  }
  _sfx_victory(t, V, o) {
    this._gong(t, V.in, 110, 4.5, 0.45);
    this._drum(t, V.in, 'B', 0.9);
    for (const n of this._glissNotes(5, 15, 0.5)) this._zheng(t + 0.05 + n.dt, V.in, n.m, { vel: 0.35 + 0.35 * n.k, dur: 1.2 });
    [53, 60, 65, 69, 72, 77].forEach((m, i) => this._zheng(t + 0.62 + i * 0.025, V.in, m, { vel: 0.6 }));
    this._flute(t + 0.6, V.in, [{ t: 0, d: 0.35, m: 81 }, { t: 0.35, d: 1.6, m: 84 }], { lvl: 0.09, bright: 0.45, vd: 16 });
    this._pad(t + 0.55, V.in, [41, 48, 53, 57], 3.6, { type: 'triangle', lvl: 0.1, att: 0.3, rel: 2.5, cut: 1500 });
    return 4.8;
  }
  _sfx_death(t, V, o) {
    this._tone(t, V.sat(), 'sine', [[0, 60], [0.5, 30]], this._ad(0.004, 0.9, 1.4));
    this._noise(t, V.in, 'brown', 'lowpass', 160, 0.7, this._ad(0.004, 0.8, 0.8));
    this._gong(t + 0.02, V.in, 62, 6, 0.5);
    this._pad(t, V.in, [26, 27, 38], 5.5, { type: 'sawtooth', lvl: 0.16, att: 0.3, rel: 4.5, cut: 220 });
    return 6.5;
  }

  // ================================================================== music
  _newSession(mode) {
    const B = this._bus.music, boss = mode === 'boss';
    const S = { mode, q: [], sorted: true, until: 0, st: {}, dead: false, kill: 0 };
    S.lvl = { title: 1.7, explore: 1.7, boss: 1.05, victory: 1.25, death: 1.3 }[mode];
    S.out = this._g(0); S.out.connect(B.in);
    S.wet = this._g(0); S.wet.connect(B.rev);
    S.ech = this._g(0); S.ech.connect(this._echoIn);
    const inst = (trim, rev, echo) => {
      const i = this._g(trim); i.connect(S.out);
      if (rev) { const r = this._g(rev); i.connect(r); r.connect(S.wet); }
      if (echo) { const e = this._g(echo); i.connect(e); e.connect(S.ech); }
      return i;
    };
    // guzheng body EQ
    S.z = this._g(1);
    const e1 = this._f('peaking', 220, 1.0, 2.5), e2 = this._f('peaking', 3000, 1.2, 3), e3 = this._f('highshelf', 7500, 0.7, -4);
    S.z.connect(e1); e1.connect(e2); e2.connect(e3);
    e3.connect(inst(0.5, boss ? 0.22 : 0.5, boss ? 0 : 0.18));
    S.d = inst(0.62, boss ? 0.25 : 0.5, 0);
    S.p = inst(1, boss ? 0.2 : 0.35, 0);
    S.fl = inst(1, boss ? 0.35 : 0.6, boss ? 0.12 : 0.3);
    return S;
  }
  _endSession(S, now, f) {
    S.dead = true; S.q = []; S.kill = now + f + 0.3;
    for (const g of [S.out, S.wet, S.ech]) { this._hold(g.gain, now); g.gain.linearRampToValueAtTime(0, now + f); }
  }
  _ev(S, t, f, must) { S.q.push({ t, f, must }); S.sorted = false; }
  _musicTick(now, h) {
    for (const S of this._sessions) {
      if (S.dead) continue;
      let guard = 0;
      while (S.until < h + 1.0 && guard++ < 64) {
        if (S.until < now) S.until = now + 0.05;
        S.until = this['_cmp_' + (S.mode === 'explore' ? 'title' : S.mode)](S, S.until);
      }
      if (!S.sorted) { S.q.sort((a, b) => a.t - b.t); S.sorted = true; }
      while (S.q.length && S.q[0].t < h) {
        const e = S.q.shift();
        if (e.t < now - 0.03 && !(e.must && e.t > now - 4)) continue; // late (throttled tab) -> drop
        try { e.f(Math.max(e.t, now)); } catch (err) { this._warn('music event', err); }
      }
    }
  }
  _melody(bars, o) {
    const out = [], W = [[-3, 0.3], [-2, 1], [-1, 3], [0, 0.5], [1, 3], [2, 1], [3, 0.35], [4, 0.15], [-4, 0.15]], total = bars * 4;
    let deg = o.start;
    for (let bar = 0; bar < bars; bar++) {
      const last = bar === bars - 1, rh = this._pick(last ? o.end : o.rh);
      let bb = bar * 4;
      for (let i = 0; i < rh.length; i++) {
        const d = rh[i], fin = last && i === rh.length - 1;
        if (!fin && out.length && Math.random() < o.rest) { bb += d; continue; }
        if (fin) deg = this._nearChord(deg, o.cd, o.lo, o.hi);
        else if (out.length) {
          const bias = bb < total * 0.45 ? 1 : -1;
          const s = this._wpick(W.map(([st, p]) => [st, p * (st * bias > 0 ? 1.6 : 1)]));
          let nd = deg + s;
          if (nd < o.lo || nd > o.hi) nd = deg - s;
          deg = Math.max(o.lo, Math.min(o.hi, nd));
        }
        out.push({ b: bb, d, deg });
        bb += d;
      }
    }
    return out;
  }
  _nearChord(deg, cd, lo, hi) {
    let best = deg, bd = 99;
    for (let d = lo; d <= hi; d++) if (cd.includes(((d % 5) + 5) % 5) && Math.abs(d - deg) < bd) { bd = Math.abs(d - deg); best = d; }
    return best;
  }
  _emitZheng(S, t, beat, mel, o = {}) {
    mel.forEach((x, i) => {
      const last = i === mel.length - 1, m = this._dm(x.deg), r = Math.random();
      let orn = null, iv = 200;
      if (last) orn = r < 0.3 ? 'fall' : 'vib';
      else if (x.d >= 2) orn = r < 0.45 ? 'vib' : r < 0.62 ? 'up' : r < 0.74 ? 'bend' : null;
      else if (x.d >= 1) orn = r < 0.18 ? 'vib' : r < 0.3 ? 'up' : null;
      if (orn === 'up' || orn === 'fall') iv = (m - this._dm(x.deg - 1)) * 100;
      if (orn === 'bend') iv = (this._dm(x.deg + 1) - m) * 100;
      const vel = (o.vel ?? 0.6) + (x.b % 4 === 0 ? 0.12 : 0) + this._rnd(-0.08, 0.06);
      const tt = t + x.b * beat + this._rnd(-0.015, 0.015), fs = Math.min(x.d * beat * 0.55, 1.4);
      if (o.trem && x.d >= 1.5) { this._trem(S, tt, m, x.d * beat, vel); this._ev(S, tt, T => this._zheng(T, S.z, m - 12, { vel: vel * 0.7 })); return; }
      this._ev(S, tt, T => this._zheng(T, S.z, m, { vel, orn, iv, fs }));
      if (x.d >= 2 && Math.random() < (o.oct ?? 0.25) && m - 12 >= 45) this._ev(S, tt + 0.012, T => this._zheng(T, S.z, m - 12, { vel: vel * 0.6 }));
    });
  }
  _trem(S, t, m, dur, vel) { // 摇指 tremolo
    const step = 1 / 14;
    for (let x = 0; x < dur - 0.05; x += step) {
      const k = x / dur, v = vel * (0.7 + 0.3 * Math.sin(k * Math.PI)) * this._rnd(0.85, 1);
      this._ev(S, t + x, T => this._zheng(T, S.z, m, { vel: v, dur: step * 1.6, tw: 0 }));
    }
  }
  _groups(mel, maxBeats) { // split melody into legato groups at rests / breath points
    const out = []; let g = [], prevEnd = -1;
    for (const x of mel) {
      if (g.length && (Math.abs(x.b - prevEnd) > 0.01 || x.b - g[0].b >= maxBeats)) { out.push(g); g = []; }
      g.push(x); prevEnd = x.b + x.d;
    }
    if (g.length) out.push(g);
    return out;
  }
  _emitWind(S, t, beat, mel, o, suona) {
    for (const g of this._groups(mel, suona ? 8 : 7)) {
      const g0 = g[0].b;
      const notes = g.map((x, i) => ({
        t: (x.b - g0) * beat, d: x.d * beat * (i === g.length - 1 ? 0.92 : 1), m: this._dm(x.deg) + (o.oct || 0),
        gr: i > 0 && Math.random() < (suona ? 0.4 : 0.25) ? this._dm(x.deg + 1) - this._dm(x.deg) : 0,
      }));
      this._ev(S, t + g0 * beat, T => (suona ? this._suona(T, S.fl, notes, o) : this._flute(T, S.fl, notes, o)));
    }
  }

  // title / explore: slow rubato-ish phrases over a drone
  _cmp_title(S, t) {
    const st = S.st, ex = S.mode === 'explore', beat = ex ? 60 / 54 : 1, len = beat * 16;
    const R = (a, b) => this._rnd(a, b), P = a => this._pick(a);
    const first = !st.n;
    if (first) st.n = 0;
    if (!st.prog || st.pi >= st.prog.length) { st.prog = P(GameAudio.PROG_CALM); st.pi = 0; }
    const root = st.prog[st.pi++], bass = this._bass(root), cd = GameAudio.CHORD_DEG[root];
    this._ev(S, first ? t : t - 1.5, T => this._pad(T, S.p, [bass, bass + 7, bass + 12], len + (first ? 1.5 : 3), { lvl: ex ? 0.042 : 0.052, cut: ex ? 520 : 650, att: first ? 4 : 3, rel: 3, sub: 0.25 }), true);
    let type;
    if (ex) type = first ? 'sparse' : P(['sparse', 'sparse', 'rest', 'zheng', 'xiao', 'sparse', 'zheng']);
    else type = first ? 'intro' : (st.n % 2 ? P(['xiao', 'xiao', 'sparse']) : 'zheng');
    st.n++;
    const z = (b, m, o) => this._ev(S, t + b * beat + R(-0.012, 0.012), T => this._zheng(T, S.z, m, o));
    if (type !== 'rest' && Math.random() < 0.6) z(0, bass + 12, { vel: 0.5, orn: Math.random() < 0.3 ? 'vib' : null });
    if (type === 'intro') {
      for (const n of this._glissNotes(0, 10, 1.3)) this._ev(S, t + 0.3 + n.dt, T => this._zheng(T, S.z, n.m, { vel: 0.22 + 0.3 * n.k }));
      const mel = this._melody(3, { lo: 3, hi: 12, start: P([8, 10]), rh: GameAudio.RH_CALM, end: GameAudio.RH_END, rest: 0.25, cd });
      this._emitZheng(S, t + 4 * beat, beat, mel, { vel: 0.55 });
    } else if (type === 'zheng') {
      const mel = this._melody(4, { lo: 3, hi: 12, start: P([5, 7, 8, 10]), rh: GameAudio.RH_CALM, end: GameAudio.RH_END, rest: ex ? 0.4 : 0.22, cd });
      this._emitZheng(S, t, beat, mel, { vel: ex ? 0.48 : 0.58 });
    } else if (type === 'xiao') {
      const mel = this._melody(4, { lo: 5, hi: 11, start: P([7, 8, 10]), rh: GameAudio.RH_XIAO, end: [[4], [3, 1]], rest: 0.15, cd });
      for (const x of mel) x.b += 0.5;
      this._emitWind(S, t, beat, mel.filter(x => x.b < 16), { lvl: ex ? 0.04 : 0.05, bright: 0.12, vd: 14 }, false);
      for (const b of [0, 8]) [12, 19, 24].forEach((iv, i) => z(b + 0.5 * i + 0.5, bass + iv, { vel: 0.32 }));
    } else if (type === 'sparse') {
      const pool = []; for (let d = 3; d <= 11; d++) if (cd.includes(d % 5) || Math.random() < 0.3) pool.push(d);
      let b = R(0.5, 2.5);
      const k = 3 + ((Math.random() * 3) | 0);
      for (let i = 0; i < k && b < 15; i++) {
        const d = P(pool), m = this._dm(d);
        const orn = P(['vib', null, 'up', 'vib', 'bend']);
        const iv = orn === 'up' ? (m - this._dm(d - 1)) * 100 : (this._dm(d + 1) - m) * 100;
        z(b, m, { vel: R(0.38, 0.58), orn, iv });
        b += R(1.5, 4);
      }
    }
    return t + len;
  }

  // boss: taiko ostinato ~100 BPM, guzheng arps / tremolo, drone, suona
  _cmp_boss(S, t) {
    const st = S.st, I = this._intensity, beat = 0.6, s16 = beat / 4, bar = beat * 4, P = a => this._pick(a);
    if (st.bar === undefined) st.bar = 0;
    const bi = st.bar % 4, si = st.bar % 8;
    if (bi === 0 || !st.prog) st.prog = P(GameAudio.PROG_BOSS);
    const root = st.prog[bi], bass = this._bass(root), hi = I >= 0.5;
    if (bi === 0) this._ev(S, st.bar ? t - 0.6 : t, T => this._pad(T, S.p, [26, 38, 45], bar * 4 + (st.bar ? 1.2 : 0.6), { lvl: 0.05 + 0.03 * I, cut: 300 + 500 * I, att: st.bar ? 0.6 : 1.5, rel: 0.6, sub: 0.3 }), true);
    // drums
    const pat = bi === 3 ? P(GameAudio.FILLS) : P(GameAudio.PATS);
    for (let i = 0; i < 16; i++) { const c = pat[i]; if (c !== '.') this._ev(S, t + i * s16, T => this._drum(T, S.d, c, 1)); }
    if (I > 0.4) {
      const p2 = P(GameAudio.HIPATS), v = 0.4 + 0.5 * I;
      for (let i = 0; i < 16; i++) { const c = p2[i]; if (c !== '.') this._ev(S, t + i * s16, T => this._drum(T, S.d, c, v)); }
      if (hi) for (const i of [4, 12]) this._ev(S, t + i * s16, T => this._drum(T, S.d, 'K', 0.7));
    }
    const accent = st.accent; st.accent = false;
    const b0 = st.bar === 0;
    if (si === 0 || (hi && bi === 0) || accent) this._ev(S, t, T => { if (!(b0 && this._recent('boss_intro'))) this._cymbal(T, S.d, 0.6 + 0.3 * I, 2.2); });
    if (si === 0 || accent) this._ev(S, t, T => { if (!(b0 && this._recent('boss_intro'))) this._gong(T, S.d, 88, 4.5, 0.35); });
    // bass plucks (damped for drive)
    for (const i of (hi ? [0, 3, 6, 8, 11, 14] : [0, 6, 10])) this._ev(S, t + i * s16, T => this._zheng(T, S.z, bass, { vel: i === 0 ? 0.85 : 0.6, dur: s16 * 2.5, pan: -0.15 }));
    // lead phrase over bars 4-7 of each 8-bar section
    if (si === 4) {
      const suona = Math.random() < 0.3 + 0.45 * I;
      const mel = this._melody(4, { lo: suona ? 9 : 8, hi: 15, start: P([10, 12, 13]), rh: GameAudio.RH_BOSS, end: [[2, 2], [4], [3, 1]], rest: 0.1, cd: [0, 3] });
      st.leadUntil = t + bar * 4;
      if (suona) this._emitWind(S, t, beat, mel, { lvl: 0.055 + 0.02 * I }, true);
      else this._emitZheng(S, t, beat, mel, { vel: 0.8, oct: 0.6, trem: I > 0.3 });
    }
    // guzheng arpeggios
    const lead = st.leadUntil && st.leadUntil > t + 0.01;
    const notes = this._arpSet(root, 57, 81);
    const ap = hi || (!lead && Math.random() < 0.35) ? P(GameAudio.ARP16) : GameAudio.ARP8;
    const v0 = lead ? 0.28 : 0.42;
    for (let i = 0; i < 16; i++) {
      const k = ap[i];
      if (k < 0) continue;
      const m = notes[Math.min(k, notes.length - 1)], v = v0 + (i % 4 === 0 ? 0.14 : 0) + this._rnd(-0.04, 0.04);
      this._ev(S, t + i * s16, T => this._zheng(T, S.z, m, { vel: v, dur: s16 * 3, tw: 0 }));
    }
    st.bar++;
    return t + bar;
  }
  _arpSet(root, lo, hi) {
    const pcs = GameAudio.ARP_PC[root] || [0, 3, 7], out = [];
    for (let m = lo; m <= hi; m++) if (pcs.includes((((m - 38) % 12) + 12) % 12)) out.push(m);
    return out;
  }

  _cmp_victory(S, t) {
    const st = S.st, P = a => this._pick(a);
    if (!st.done) {
      st.done = 1;
      this._ev(S, t + 0.5, T => this._victoryCue(S, T), true);
      return t + 0.5 + 0.8 + 9 * 0.62;
    }
    this._ev(S, t - 2, T => this._pad(T, S.p, [41, 48, 53, 57, 62], 14, { lvl: 0.035, cut: 900, att: 3.5, rel: 4, type: 'triangle' }), true);
    if (Math.random() < 0.5) this._ev(S, t + this._rnd(2, 8), T => this._zheng(T, S.z, P([65, 69, 72, 74, 77]), { vel: 0.3, orn: 'vib' }));
    return t + 10;
  }
  _victoryCue(S, t0) { // ~6.5 s cue; if the 'victory' sting SFX just played, skip the duplicate opening accents
    const beat = 0.62, sting = this._recent('victory', 1.5), tm = t0 + (sting ? 1.4 : 0.8);
    if (!sting) {
      this._drum(t0, S.d, 'B', 1); this._cymbal(t0, S.d, 0.7, 2.5); this._gong(t0, S.d, 110, 5, 0.3);
      for (const n of this._glissNotes(5, 15, 0.55)) this._zheng(t0 + 0.05 + n.dt, S.z, n.m, { vel: 0.35 + 0.4 * n.k });
    }
    const mel = [[0, 1, 72], [1, 0.5, 74], [1.5, 0.5, 77], [2, 1, 79], [3, 2, 81], [5, 0.5, 79], [5.5, 0.5, 81], [6, 3, 84]];
    this._flute(tm, S.fl, mel.map(([b, d, m], i) => ({ t: b * beat, d: d * beat, m, gr: i === 4 || i === 7 ? 2 : 0 })), { lvl: 0.1, bright: 0.45, vd: 16, rel: 1.2 });
    mel.forEach(([b, d, m]) => this._zheng(tm + b * beat, S.z, m - 12, { vel: 0.55, orn: d >= 2 ? 'vib' : null }));
    for (const [b, c, v] of [[0, 'B', 0.8], [2, 'B', 0.7], [3, 'M', 0.6], [4, 'B', 0.7], [5, 'M', 0.5], [5.25, 'S', 0.5], [5.5, 'S', 0.6], [5.75, 'S', 0.7], [6, 'B', 1]]) this._drum(tm + b * beat, S.d, c, v);
    this._cymbal(tm + 6 * beat, S.d, 0.8, 3);
    [53, 60, 65, 69, 72, 77].forEach((m, i) => this._zheng(tm + 6 * beat + i * 0.03, S.z, m, { vel: 0.65, orn: i === 5 ? 'vib' : null }));
    this._pad(t0, S.p, [41, 48, 53, 57], (tm - t0) + 10 * beat, { lvl: 0.06, cut: 1400, att: 0.6, rel: 3, type: 'triangle' });
  }

  _cmp_death(S, t) {
    const st = S.st, first = !st.n, P = a => this._pick(a);
    st.n = (st.n || 0) + 1;
    if (first) this._ev(S, t + 0.25, T => { if (!this._recent('death')) { this._drum(T, S.d, 'B', 0.8); this._gong(T, S.d, 62, 6, 0.3); } });
    this._ev(S, first ? t : t - 2.5, T => this._pad(T, S.p, [26, 38, 45], first ? 13 : 14.5, { lvl: 0.07, cut: 240, att: first ? 2 : 2.5, rel: 2.5, type: 'sawtooth', sub: 0.3 }), true);
    if (Math.random() < 0.35) this._ev(S, t + 1, T => this._pad(T, S.p, [39], 9, { lvl: 0.02, cut: 400, att: 4, rel: 4 }));
    let x = this._rnd(1.5, 4);
    while (x < 11.5) {
      const m = P([38, 41, 45, 43, 48, 50]), orn = P(['fall', 'vib', null]);
      this._ev(S, t + x, T => this._zheng(T, S.z, m, { vel: this._rnd(0.35, 0.5), orn, iv: 200, fs: 0.8 }));
      x += this._rnd(3, 6);
    }
    if (Math.random() < 0.25) this._ev(S, t + this._rnd(3, 9), T => this._bell(T, S.d, 98, 7, 0.25));
    return t + 12;
  }

  // =============================================================== ambience
  _newBed(zone) {
    const now = this.ctx.currentTime, R = (a, b) => this._rnd(a, b);
    const B = { zone, dead: false, kill: 0, srcs: [], out: this._g(0), wet: this._g(0), winds: [] };
    B.out.connect(this._bus.amb.in); B.wet.connect(this._bus.amb.rev);
    this._collect = B.srcs;
    try {
      const str = zone === 'forest' ? 0.5 : 0.32;
      for (const pan of [-0.7, 0.7]) B.winds.push(this._windChain(B.out, pan, str, now));
      const room = this._n('brown', now, null), rl = this._f('lowpass', 140, 0.7), rg = this._g(zone === 'temple' ? 0.035 : 0.025);
      room.connect(rl); rl.connect(rg); rg.connect(B.out);
    } finally { this._collect = null; }
    B.nx = zone === 'forest'
      ? { gust: now, cricket: now + R(1, 4), bird: now + R(3, 9), howl: now + R(30, 70) }
      : { gust: now, cricket: now + R(3, 8), chime: now + R(2, 6), bell: now + R(10, 25), muyu: now + R(40, 80) };
    return B;
  }
  _far(B, cut, pan, wet) {
    const lp = this._f('lowpass', cut, 0.7), p = this._pan(pan), w = this._g(wet);
    lp.connect(p); p.connect(B.out); lp.connect(w); w.connect(B.wet);
    return lp;
  }
  _bedTick(B, now, h) {
    const nx = B.nx, R = (a, b) => this._rnd(a, b), forest = B.zone === 'forest';
    while (nx.gust < h) { const t = Math.max(nx.gust, now); for (const W of B.winds) this._gust(W, t + R(0, 0.4)); nx.gust = t + R(1.2, 3.5); }
    while (nx.cricket < h) {
      const t = Math.max(nx.cricket, now);
      this._cricket(t, this._far(B, 9000, R(-0.8, 0.8), 0.2), R(2, 5), R(0.01, 0.02));
      nx.cricket = t + (forest ? R(3, 8) : R(6, 14));
    }
    if (forest) {
      while (nx.bird < h) { const t = Math.max(nx.bird, now); this._bird(t, this._far(B, R(4000, 8000), R(-0.9, 0.9), 0.35), R(0.02, 0.05)); nx.bird = t + R(6, 18); }
      while (nx.howl < h) {
        const t = Math.max(nx.howl, now);
        if (Math.random() < 0.4) this._howl(t, this._far(B, 1400, R(-0.8, 0.8), 1.2), R(0.05, 0.08));
        nx.howl = t + R(45, 110);
      }
    } else {
      while (nx.chime < h) { const t = Math.max(nx.chime, now); this._chimes(t, B); nx.chime = t + R(5, 14); }
      while (nx.bell < h) { const t = Math.max(nx.bell, now); this._bell(t, this._far(B, 900, R(-0.5, 0.5), 1.4), 98, 8, 0.22); nx.bell = t + R(40, 80); }
      while (nx.muyu < h) {
        const t = Math.max(nx.muyu, now);
        if (Math.random() < 0.45) {
          const d = this._far(B, 2500, R(-0.6, 0.6), 0.8), f = R(560, 700), n = 8 + ((Math.random() * 9) | 0), per = R(0.55, 0.7);
          for (let i = 0; i < n; i++) this._drum(t + i * per * R(0.98, 1.02), d, 'W', 0.09 * R(0.8, 1), f);
        }
        nx.muyu = t + R(70, 140);
      }
    }
  }
  _cricket(t, dst, dur, lvl) {
    const f = this._rnd(4200, 5200), o = this._o('sine', f, t, t + dur + 0.1), g = this._g(0);
    o.connect(g); g.connect(dst);
    const per = this._rnd(0.35, 0.6), np = 2 + ((Math.random() * 3) | 0), pl = this._rnd(0.012, 0.02);
    for (let x = 0; x < dur; x += per) {
      for (let k = 0; k < np; k++) {
        const tt = t + x + k * pl * 2;
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.003);
        g.gain.setValueAtTime(lvl, tt + pl - 0.003); g.gain.linearRampToValueAtTime(0, tt + pl);
      }
    }
  }
  _bird(t, dst, lvl) {
    const kind = this._pick(['chirp', 'chirp', 'trill', 'whistle']), segs = [];
    if (kind === 'chirp') {
      const n = 2 + ((Math.random() * 4) | 0), f = this._rnd(2600, 3800), up = Math.random() < 0.5;
      let x = 0;
      for (let i = 0; i < n; i++) { const d = this._rnd(0.05, 0.09); segs.push([x, d, up ? f : f * 1.35, up ? f * 1.35 : f, lvl]); x += d + this._rnd(0.06, 0.16); }
    } else if (kind === 'whistle') {
      const f = this._rnd(1900, 2600);
      segs.push([0, 0.28, f, f * 1.12, lvl * 0.9], [0.34, 0.3, f * 0.92, f * 0.8, lvl * 0.9]);
    } else {
      const d = this._rnd(0.35, 0.7), f = this._rnd(3000, 4200);
      segs.push([0, d, f, f * 0.85, lvl * 0.8]);
    }
    const lastS = segs[segs.length - 1], end = t + lastS[0] + lastS[1] + 0.05;
    const o = this._o('sine', segs[0][2], t, end), g = this._g(0);
    if (kind === 'trill') { const m = this._o('square', this._rnd(16, 26), t, end), mg = this._g(segs[0][2] * 0.12); m.connect(mg); mg.connect(o.frequency); }
    for (const [dt, d, a, b, l] of segs) {
      const tt = t + dt, at = Math.min(0.04, d * 0.25);
      o.frequency.setValueAtTime(a, tt); o.frequency.exponentialRampToValueAtTime(b, tt + d);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(l, tt + at); g.gain.setValueAtTime(l, tt + d - at); g.gain.linearRampToValueAtTime(0, tt + d);
    }
    o.connect(g); g.connect(dst);
  }
  _howl(t, dst, lvl) {
    const r = this._rnd(0.9, 1.1), dur = 2.8;
    this._vox(t, dst, {
      dur, f: [[0, 330 * r], [0.6, 540 * r], [2.0, 520 * r], [dur, 400 * r]], vib: [5, 12], jit: 3, rough: 0.1, rr: 30, noise: 0.2,
      form: [[400 * r, 5, 2], [900 * r, 6, 1], [2500, 8, 0.2]], body: 600, bodyG: 0.3,
      env: [[0, 0, 0], [0.4, lvl, 1], [2.1, lvl * 0.85, 1], [dur, 1e-4, 2]],
    });
  }
  _chimes(t, B) {
    const n = 2 + ((Math.random() * 5) | 0), d = this._far(B, 7000, 0, 0.8);
    let x = 0;
    for (let i = 0; i < n; i++) {
      this._ping(t + x, d, this._hz(this._pick([81, 84, 86, 89, 91])), this._rnd(0.006, 0.014), this._rnd(1.2, 2.2), this._rnd(-0.7, 0.7), [[1, 1], [2.42, 0.35], [4.1, 0.12]]);
      x += this._rnd(0.05, 0.35);
    }
  }
}
