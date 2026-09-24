// ---------------------------------------------------------------------------
// Game: bootstrap, main loop, rules, flow
// ---------------------------------------------------------------------------
const QUALITY = {
  low: { pr: 0.8, shadows: 1, veg: 0.45, grass: 22000, grassRadius: 28, leaves: 120, bloom: false, maxPr: 1 },
  medium: { pr: 1.0, shadows: 1, veg: 0.75, grass: 55000, grassRadius: 38, leaves: 280, bloom: true, maxPr: 1.25 },
  high: { pr: 1.0, shadows: 2, veg: 1.0, grass: 100000, grassRadius: 48, leaves: 450, bloom: true, maxPr: 2 },
};

const Game = (() => {
  const G = {};
  let renderer, scene, camera, composer, bloom, gradePass, gcam;
  let player, clones = [];
  const enemies = [];
  let last = performance.now(), time = 0;
  let timeScale = 1, slowT = 0, slowScale = 1, hitstopT = 0;
  let qualityName = 'medium';
  const orbs = [];
  let lastShrine = null;
  let currentZone = null;
  let bossActive = null;
  let arena = null;
  let gateCollider = null;
  const defeated = new Set();
  const stats = { time: 0, deaths: 0, will: 0, perfect: 0 };
  const tokens = new Set();
  let titleT = 0;
  let renderScale = 1, frameAcc = 0, frameN = 0, perfT = 0;
  G.state = 'loading';
  G.enemies = enemies;

  // ---- audio (graceful fallback if the synth is unavailable) --------------------
  const nullLoop = { setVolume() { }, setPos() { }, setPitch() { }, stop() { } };
  G.audio = typeof GameAudio !== 'undefined' ? new GameAudio() : { init() { }, setVolumes() { }, setMusic() { }, setMusicIntensity() { }, setListener() { }, play() { }, loop() { return nullLoop; }, setAmbience() { }, update() { } };
  const safeAudio = {};
  for (const k of ['init', 'setVolumes', 'setMusic', 'setMusicIntensity', 'setListener', 'play', 'loop', 'setAmbience', 'update']) {
    safeAudio[k] = (...a) => { try { const r = G.audio[k] && G.audio[k](...a); return r === undefined && k === 'loop' ? nullLoop : r; } catch (e) { return k === 'loop' ? nullLoop : undefined; } };
  }
  G.audio = safeAudio;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('wk_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('wk_' + k, JSON.stringify(v)); } catch (e) { } },
  };

  // ---- post processing -------------------------------------------------------------
  const GradeShader = {
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.9 }, chroma: { value: 0 }, desat: { value: 0 }, radial: { value: 0 }, grain: { value: 0.035 }, gold: { value: 0 }, red: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float time, vignette, chroma, desat, radial, grain, gold, red; uniform vec2 res; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv; vec2 c = uv - 0.5;
        vec3 col;
        if (radial > 0.002) {
          col = vec3(0.0);
          for (int i = 0; i < 10; i++) col += texture2D(tDiffuse, uv - c * radial * 0.09 * float(i) / 9.0).rgb;
          col /= 10.0;
        } else col = texture2D(tDiffuse, uv).rgb;
        if (chroma > 0.002) {
          col.r = mix(col.r, texture2D(tDiffuse, uv + c * chroma * 0.018).r, 0.9);
          col.b = mix(col.b, texture2D(tDiffuse, uv - c * chroma * 0.018).b, 0.9);
        }
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        // split tone: cool shadows, warm highlights
        col += vec3(0.018, 0.004, -0.02) * smoothstep(0.35, 1.0, l);
        col += vec3(-0.012, 0.002, 0.018) * (1.0 - smoothstep(0.0, 0.35, l));
        col = mix(col, vec3(l), desat);
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
        col = mix(col, col * vec3(1.2, 0.95, 0.6) + vec3(0.05, 0.03, 0.0), gold);
        col = mix(col, col * vec3(1.15, 0.7, 0.65), red);
        float v = smoothstep(0.95, 0.25, length(c * vec2(1.0, 0.85)));
        col *= mix(1.0, v, vignette);
        col += (hash(uv * res + fract(time) * 100.0) - 0.5) * grain;
        gl_FragColor = vec4(col, 1.0);
      }`,
  };

  const GodRayShader = {
    uniforms: { tDiffuse: { value: null }, sunPos: { value: new THREE.Vector2(0.5, 0.5) }, strength: { value: 0 }, threshold: { value: 0.9 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 sunPos; uniform float strength, threshold; varying vec2 vUv;
      void main(){
        vec4 base = texture2D(tDiffuse, vUv);
        if (strength <= 0.001) { gl_FragColor = base; return; }
        const int N = 36;
        vec2 delta = (vUv - sunPos) * (0.92 / float(N));
        vec2 uv = vUv; float illum = 1.0; vec3 acc = vec3(0.0);
        float jitter = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
        uv -= delta * jitter;
        for (int i = 0; i < N; i++) {
          uv -= delta;
          vec3 s = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
          float l = max(dot(s, vec3(0.3, 0.59, 0.11)) - threshold, 0.0);
          acc += min(s, vec3(6.0)) * min(l, 3.0) * illum;
          illum *= 0.955;
        }
        acc /= float(N);
        float fall = 1.0 - smoothstep(0.0, 1.1, length((vUv - sunPos) * vec2(1.6, 1.0)));
        gl_FragColor = vec4(base.rgb + acc * strength * fall * vec3(1.0, 0.82, 0.6), base.a);
      }`,
  };
  let godPass = null;
  const _sun = new THREE.Vector3(), _cd = new THREE.Vector3();
  function updateGodRays() {
    if (!godPass) return;
    _sun.copy(camera.position).addScaledVector(CONFIG.SUN_DIR, 500).project(camera);
    camera.getWorldDirection(_cd);
    const facing = _cd.dot(CONFIG.SUN_DIR);
    const onScreen = 1 - U.smoothstep(0.9, 1.6, Math.max(Math.abs(_sun.x), Math.abs(_sun.y)));
    godPass.uniforms.sunPos.value.set(_sun.x * 0.5 + 0.5, _sun.y * 0.5 + 0.5);
    godPass.uniforms.strength.value = facing > 0 && _sun.z < 1 ? U.smoothstep(0.1, 0.6, facing) * onScreen * 1.35 : 0;
  }
  function setupRenderer(q) {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, q.maxPr) * q.pr);
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = q.shadows > 0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game').appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1400);
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new RenderPass(scene, camera));
    if (q.bloom) { godPass = new ShaderPass(GodRayShader); composer.addPass(godPass); }
    if (q.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.42, 0.55, 0.92); composer.addPass(bloom); }
    composer.addPass(new OutputPass());
    gradePass = new ShaderPass(GradeShader);
    composer.addPass(gradePass);
    addEventListener('resize', onResize);
  }
  function onResize() {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    gradePass.uniforms.res.value.set(innerWidth, innerHeight);
  }
  function applyRenderScale() {
    const q = QUALITY[qualityName];
    const pr = Math.min(devicePixelRatio, q.maxPr) * q.pr * renderScale;
    renderer.setPixelRatio(pr); composer.setPixelRatio(pr); onResize();
  }

  // ---- loading ------------------------------------------------------------------------
  const progress = (p, txt) => { document.getElementById('ldbar').style.width = (p * 100) + '%'; if (txt) document.getElementById('ldtxt').textContent = txt; };
  const tick = () => new Promise(r => setTimeout(r, 16));
  async function boot() {
    qualityName = window.__forceQuality || store.get('quality', matchMedia('(pointer: coarse)').matches ? 'low' : 'medium');
    if (!QUALITY[qualityName]) qualityName = 'medium';
    const q = QUALITY[qualityName];
    progress(0.05, '山 雨 欲 来');
    await tick();
    setupRenderer(q);
    UI.init();
    Input.init(renderer.domElement);
    Input.sensitivity = store.get('sens', 1);
    progress(0.15, '开 山 辟 地'); await tick();
    World.build({ scene, renderer, quality: q });
    progress(0.55, '草 木 生 发'); await tick();
    FX.init(scene, camera);
    gcam = new GameCamera(camera);
    progress(0.65, '天 命 降 临'); await tick();
    player = new Player();
    scene.add(player.root);
    const s0 = World.shrines[0];
    lastShrine = s0;
    player.respawn(s0.spawn, s0.yaw);
    progress(0.72, '妖 魔 横 行'); await tick();
    spawnEnemies();
    for (let i = 0; i < 3; i++) { const c = new Clone(); scene.add(c.root); clones.push(c); }
    progress(0.9, '钟 声 渐 起'); await tick();
    // warm up shaders
    gcam.snap(player);
    try { renderer.compile(scene, camera); } catch (e) { }
    composer.render();
    progress(1, '');
    await tick();
    wireMenus();
    toTitle(true);
    requestAnimationFrame(loop);
  }
  function spawnEnemies() {
    const defs = [
      ['scout', -9, 99, 0.3], ['scout', -3, 92, -0.4],
      ['guard', 7, 52, 0.1], ['scout', 2.5, 57, 0.4], ['scout', 12, 48, -0.3],
      ['wight', -3, -7, 0],
      ['scout', -1.2, -47, 0], ['guard', 1.5, -52, 0],
      ['guangzhi', 0, -104, 0],
    ];
    for (const [k, x, z, yaw] of defs) {
      const e = new Enemy(k, new THREE.Vector3(x, 0, z), { yaw });
      scene.add(e.root); enemies.push(e);
    }
  }

  // ---- menus --------------------------------------------------------------------------
  function wireMenus() {
    const $ = id => document.getElementById(id);
    const click = (id, fn) => $(id).addEventListener('click', () => { G.audio.play('ui_click'); fn(); });
    document.querySelectorAll('.menu-btn').forEach(b => b.addEventListener('mouseenter', () => G.audio.play('ui_hover')));
    click('btnStart', startGame);
    click('btnControls', () => $('controls').hidden = false);
    click('btnCloseControls', () => $('controls').hidden = true);
    click('btnSettings', () => $('settings').hidden = false);
    click('btnCloseSettings', () => { $('settings').hidden = true; });
    click('btnResume', resume);
    click('btnPControls', () => $('controls').hidden = false);
    click('btnPSettings', () => $('settings').hidden = false);
    click('btnRestart', () => { resume(); respawnAtShrine(); });
    click('btnFree', () => { UI.win(false); G.state = 'play'; Input.enabled = true; UI.hud(true); G.audio.setMusic('explore'); });
    click('btnAgain', () => { UI.win(false); defeated.delete('guangzhi'); respawnAtShrine(); });
    const seg = $('qSeg');
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.q === qualityName);
      b.addEventListener('click', () => {
        store.set('quality', b.dataset.q);
        seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        const nq = QUALITY[b.dataset.q]; qualityName = b.dataset.q; renderScale = 1; applyRenderScale();
        if (bloom) bloom.enabled = nq.bloom;
        UI.toast('画质已切换，植被密度在刷新页面后生效', 2.5);
      });
    });
    const vm = $('volMaster'), vmu = $('volMusic'), sens = $('sens');
    vm.value = store.get('volMaster', 0.8); vmu.value = store.get('volMusic', 0.7); sens.value = store.get('sens', 1);
    const applyVol = () => { G.audio.setVolumes({ master: +vm.value, music: +vmu.value }); store.set('volMaster', +vm.value); store.set('volMusic', +vmu.value); };
    vm.addEventListener('input', applyVol); vmu.addEventListener('input', applyVol);
    sens.addEventListener('input', () => { Input.sensitivity = +sens.value; store.set('sens', +sens.value); });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && G.state === 'play' && G.hadLock) pause();
      if (document.pointerLockElement) G.hadLock = true;
    });
    addEventListener('keydown', e => {
      if (e.code === 'Enter' && G.state === 'title' && document.getElementById('controls').hidden && document.getElementById('settings').hidden) startGame();
    });
  }
  function pause() {
    if (G.state !== 'play') return;
    G.state = 'paused'; Input.enabled = false; G.hadLock = false;
    document.getElementById('pause').hidden = false;
    Input.exitLock();
  }
  function resume() {
    document.getElementById('pause').hidden = true;
    document.getElementById('controls').hidden = true;
    document.getElementById('settings').hidden = true;
    if (G.state === 'paused') { G.state = 'play'; Input.enabled = true; if (!Input.touch) Input.requestLock(); }
  }

  // ---- flow ---------------------------------------------------------------------------
  function toTitle(first) {
    G.state = 'title';
    document.getElementById('title').hidden = false;
    document.getElementById('title').style.opacity = 1;
    UI.hud(false);
    const ld = document.getElementById('loading');
    ld.style.opacity = 0; setTimeout(() => ld.hidden = true, 1300);
    player.anim.stanceA = Anim.M.idle;
    titleT = 0;
    gcam.cinematic = (dt, gc) => {
      titleT += dt;
      const a = -0.9 + Math.sin(titleT * 0.05) * 0.35;
      const c = player.pos;
      const r = 3.6;
      gc.cam.position.set(c.x + Math.sin(a) * r, c.y + 1.25 + Math.sin(titleT * 0.13) * 0.08, c.z + Math.cos(a) * r);
      const right = U.tmpV[1].set(Math.cos(a), 0, -Math.sin(a));
      gc.cam.lookAt(U.tmpV[2].set(c.x, c.y + 1.2, c.z).addScaledVector(right, -0.95));
      gc.cam.fov = 45; gc.cam.updateProjectionMatrix();
    };
  }
  function startGame() {
    if (G.state !== 'title') return;
    G.audio.init();
    G.audio.setVolumes({ master: store.get('volMaster', 0.8), music: store.get('volMusic', 0.7), sfx: 1, ambience: 0.8 });
    G.state = 'intro';
    const t = document.getElementById('title');
    t.style.opacity = 0; setTimeout(() => t.hidden = true, 1000);
    UI.chapter(true);
    G.audio.play('gong');
    G.audio.setMusic('explore');
    setTimeout(() => {
      gcam.cinematic = null; gcam.fovBase = 55; gcam.snap(player);
      UI.chapter(false);
      setTimeout(() => {
        G.state = 'play'; Input.enabled = true; UI.hud(true);
        if (!Input.touch) Input.requestLock();
        currentZone = null;
      }, 900);
    }, 3400);
  }
  G.startBoss = (e) => {
    if (bossActive === e) return;
    bossActive = e;
    e.state = 'alert';
    e.anim.play(e.kind === 'guangzhi' ? Anim.G.intro : Anim.H.roar, 0.2);
    UI.bossCard(e.name, e.kind === 'guangzhi' ? '观音禅院 · 赤潮双刃' : '残塔 · 巨首游魂');
    UI.showBoss(e);
    G.audio.play('boss_intro');
    G.audio.setMusic('boss'); G.audio.setMusicIntensity(0);
    if (e.kind === 'guangzhi') {
      arena = { x: 0, z: -92, r: 30, rect: World.COURTYARD };
      if (!gateCollider) { gateCollider = { type: 'box', x: 0, z: -64.2, hx: 2.4, hz: 0.6, rot: 0 }; World.addCollider(gateCollider); }
      gateCollider.hx = 2.4;
    } else arena = { x: -3, z: -4, r: 22 };
    if (!player.lock) player.lock = e;
    bossCinematic(e);
  };
  function bossCinematic(e) {
    let t = 0;
    Input.enabled = false;
    const f = e.forward(new THREE.Vector3());
    const base = Math.atan2(f.x, f.z);
    const head = new THREE.Vector3();
    gcam.cinematic = (dt, gc) => {
      t += dt;
      const s = e.scaleMul;
      head.set(e.pos.x, e.pos.y + e.height * s * 0.8, e.pos.z);
      const ang = base + 0.55 - t * 0.1;
      const dist = (2.6 + t * 0.35) * s + (e.kind === 'wight' ? 1.5 : 0);
      gc.cam.position.set(e.pos.x + Math.sin(ang) * dist, e.pos.y + (0.7 + t * 0.05) * s, e.pos.z + Math.cos(ang) * dist);
      gc.cam.lookAt(head);
      gc.cam.fov = 42; gc.cam.updateProjectionMatrix();
    };
    setTimeout(() => {
      gcam.cinematic = null;
      gcam.yaw = Math.atan2(-(e.pos.x - player.pos.x), -(e.pos.z - player.pos.z)); gcam.pitch = 0.15;
      if (G.state === 'play') Input.enabled = true;
    }, 3000);
  }
  G.onBossPhase2 = (e) => {
    G.audio.setMusicIntensity(1);
    G.shake(0.6);
    UI.toast(e.kind === 'guangzhi' ? '广智 · 烈焰加身' : '幽魂 · 怨气翻涌', 2.2);
  };
  function endBoss(e, won) {
    if (bossActive !== e) return;
    bossActive = null; arena = null;
    UI.hideBoss();
    if (gateCollider) gateCollider.hx = 0.0001;
    G.audio.setMusicIntensity(0);
    if (!won) return;
    defeated.add(e.kind);
    G.slowmo(2.2, 0.22);
    G.audio.setMusic(e.kind === 'guangzhi' ? 'victory' : 'explore');
    if (e.kind === 'wight') { setTimeout(() => { UI.toast('幽魂 · 已伏', 3); }, 1800); }
    else {
      setTimeout(() => {
        if (!player.alive) return;
        G.state = 'victory'; Input.enabled = false; Input.exitLock(); UI.hud(false);
        stats.will = player.will;
        UI.win(true, stats);
      }, 4200);
    }
  }
  G.onEnemyDeath = (e) => {
    tokens.delete(e);
    if (player.lock === e) player.lock = null;
    const n = e.boss ? 24 : 5, val = e.boss ? (e.kind === 'guangzhi' ? 40 : 25) : 6;
    for (let i = 0; i < n; i++) orbs.push({ p: e.pos.clone().add(new THREE.Vector3(FX.R(-0.6, 0.6), FX.R(0.6, 1.8), FX.R(-0.6, 0.6))), v: new THREE.Vector3(FX.R(-2, 2), FX.R(1, 4), FX.R(-2, 2)), t: -0.6 - Math.random() * 0.8, val });
    if (e.boss) endBoss(e, true);
    player.addFocus(0.3);
  };
  G.onPlayerDeath = () => {
    stats.deaths++;
    G.audio.play('death'); G.audio.setMusic('death');
    if (bossActive) { const b = bossActive; endBoss(b, false); }
    G.slowmo(1.2, 0.3);
    setTimeout(() => { UI.death(true); UI.hud(false); }, 1400);
    setTimeout(() => { respawnAtShrine(); }, 5200);
  };
  function respawnAtShrine() {
    UI.fade(true);
    setTimeout(() => {
      UI.death(false);
      Combat.clearProjectiles();
      for (const c of clones) if (c.active) c.vanish();
      if (bossActive) endBoss(bossActive, false);
      for (const e of enemies) if (!(e.boss && defeated.has(e.kind))) { e.reset(); }
      tokens.clear();
      const s = lastShrine;
      player.respawn(s.spawn, s.yaw);
      gcam.snap(player);
      G.state = 'play'; Input.enabled = true; UI.hud(true);
      G.audio.setMusic('explore');
      setTimeout(() => UI.fade(false), 300);
    }, 900);
  }
  G.restAtShrine = (s) => {
    lastShrine = s;
    player.hp = player.maxHp; player.mana = player.maxMana; player.gourd = player.maxGourd; player.stamina = player.maxStamina;
    for (const k in player.cd) player.cd[k] = 0;
    for (const e of enemies) if (!e.boss && (!e.alive || e.state !== 'idle')) e.reset();
    G.audio.play('shrine_rest');
    FX.puff(player.pos, [1.6, 1.2, 0.5], 30, 1.2);
    UI.toast('敬香歇息 · 气血尽复 · 妖魔重现', 2.8);
  };
  G.nearShrine = () => {
    if (!player || !player.alive) return null;
    for (const s of World.shrines) if (Math.hypot(player.pos.x - s.pos.x, player.pos.z - s.pos.z) < 2.6) return s;
    return null;
  };

  // ---- combat rules -------------------------------------------------------------------------
  G.hitstop = (d) => { hitstopT = Math.max(hitstopT, d); };
  G.slowmo = (d, s) => { slowT = d; slowScale = s; };
  G.shake = (a, pos) => {
    if (pos && player) { const d = pos.distanceTo(player.pos); a *= U.clamp(1.3 - d / 20, 0, 1); }
    gcam && gcam.shake(a);
  };
  const post = { chroma: 0, radial: 0, gold: 0, red: 0, desat: 0 };
  G.damageEnemy = (e, info) => {
    if (!e.alive) return;
    e.takeHit(info);
    const heavy = info.kind === 'heavy';
    const clone = info.kind === 'clone';
    if (!clone) {
      G.hitstop(heavy ? 0.1 : 0.05);
      G.shake(heavy ? 0.35 : 0.14);
      FX.hitSparks(info.point, info.dir, heavy ? 26 : 12, [1, 0.72, 0.35], heavy ? 9 : 6);
      FX.inkSplash(info.point, info.dir, heavy ? 14 : 7);
      G.audio.play(heavy ? 'hit_heavy' : 'hit_staff', { pos: info.point, pitch: 0.9 + Math.random() * 0.2 });
      if (heavy) { post.chroma = 0.6; gcam.fovKick = -2.5; }
    } else {
      FX.hitSparks(info.point, info.dir, 5, [1, 0.8, 0.4], 4);
      G.audio.play('hit_staff', { pos: info.point, volume: 0.35, pitch: 1.2 });
    }
  };
  G.damagePlayer = (info) => {
    if (!player.alive || G.state !== 'play') return;
    if (player.iframe) {
      if (!info.dot && player.anim.clip === Anim.M.dodge && player.dodgeT < 0.34 && !player.perfectUsed) perfectDodge(info);
      return;
    }
    if (player.rockT > 0 && !info.dot && info.from) { deflect(info); return; }
    player.takeHit(info);
    G.hitstop(info.dot ? 0 : 0.06);
    if (!info.dot) {
      G.shake(info.knock ? 0.55 : 0.3);
      post.chroma = 0.45; post.red = 0.28;
      G.audio.play('hit_player', { pos: player.pos });
      FX.inkSplash(info.point || player.pos, info.dir || U.tmpV[0].set(0, 0, 1), 12);
      if (info.kind === 'fire') FX.fireBurst(info.point || player.pos, 10, 0.5);
    } else post.red = Math.max(post.red, 0.12);
  };
  function perfectDodge(info) {
    player.perfectUsed = true; stats.perfect++;
    G.slowmo(0.6, 0.22);
    post.radial = 0.9; post.gold = 0.35;
    player.addFocus(0.6);
    G.audio.play('perfect_dodge');
    FX.afterimage(player.model.meshes, 0xffc060, 0.7, 0.6);
    UI.toast('识 破', 1);
  }
  function deflect(info) {
    const a = info.from;
    G.audio.play('rocksolid_deflect', { pos: player.pos });
    FX.hitSparks(U.tmpV[0].copy(player.pos).setY(player.pos.y + 1.2), null, 30, [1, 0.85, 0.5], 9);
    FX.shockwave(player.pos, 2.5, [1, 0.8, 0.4], 0.4, 0.2);
    G.slowmo(0.4, 0.2); post.gold = 0.4;
    player.addFocus(1);
    if (a && a.alive) {
      if (a.boss) { a.poise -= 90; if (a.poise <= 0) a.takeHit({ amount: 1, poise: 0, kind: 'heavy' }); }
      else a.takeHit({ amount: 10, poise: 999, kind: 'heavy' });
    }
    player.counter(a || player);
    UI.toast('铜头铁臂 · 反击', 1.2);
  }
  G.requestAttackToken = (e) => {
    if (tokens.has(e)) return true;
    if (tokens.size >= 2) return false;
    tokens.add(e); return true;
  };
  G.releaseAttackToken = (e) => { tokens.delete(e); };
  G.separate = (a) => {
    const list = a === player ? enemies : [player, ...enemies];
    for (const b of list) {
      if (b === a || !b.alive || !b.active) continue;
      const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, d = Math.hypot(dx, dz);
      const m = a.radius * a.scaleMul + b.radius * b.scaleMul;
      if (d < m && d > 1e-4) { const push = (m - d) * (b === player ? 1 : 0.5); a.pos.x += dx / d * push; a.pos.z += dz / d * push; }
    }
    if (a === player && arena) {
      if (arena.rect) {
        const r = arena.rect; a.pos.x = U.clamp(a.pos.x, r.x0 + 0.5, r.x1 - 0.5); a.pos.z = U.clamp(a.pos.z, r.z0 + 0.5, Math.min(r.z1 - 0.5, -65.2));
      } else {
        const dx = a.pos.x - arena.x, dz = a.pos.z - arena.z, d = Math.hypot(dx, dz);
        if (d > arena.r) { a.pos.x = arena.x + dx / d * arena.r; a.pos.z = arena.z + dz / d * arena.r; }
      }
    }
  };
  G.pickLockTarget = (range = 26, exclude = null) => {
    let best = null, bs = 1e9;
    const cf = U.tmpV[0]; camera.getWorldDirection(cf);
    for (const e of enemies) {
      if (!e.alive || !e.active || e === exclude) continue;
      const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d > range) continue;
      const dot = (dx * cf.x + dz * cf.z) / (d * Math.hypot(cf.x, cf.z) || 1);
      const s = d * (1.6 - dot) + (e.boss ? -3 : 0);
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  };
  G.spawnClones = (p) => {
    G.audio.play('spell_clone', { pos: p.pos });
    clones.forEach((c, i) => {
      const a = p.yaw + (i - 1) * 1.3 + Math.PI;
      const pos = p.pos.clone().add(new THREE.Vector3(Math.sin(a) * 1.6, 0, Math.cos(a) * 1.6));
      World.collide(pos, 0.4, true);
      pos.y = World.heightAt(pos.x, pos.z);
      c.spawn(pos, p.yaw);
    });
  };

  // ---- main loop ------------------------------------------------------------------------------
  function loop(now) {
    requestAnimationFrame(loop);
    let rdt = Math.min((now - last) / 1000, 1 / 20); last = now;
    // dynamic resolution
    frameAcc += rdt; frameN++; perfT += rdt;
    if (perfT > 2.5 && G.state === 'play' && !window.__simSteps) {
      const avg = frameAcc / frameN;
      if (avg > 1 / 38 && renderScale > 0.6) { renderScale = Math.max(0.6, renderScale - 0.1); applyRenderScale(); }
      else if (avg < 1 / 58 && renderScale < 1) { renderScale = Math.min(1, renderScale + 0.05); applyRenderScale(); }
      perfT = 0; frameAcc = 0; frameN = 0;
    }
    if (G.state === 'paused') { composer.render(); return; }
    if (G.state === 'title' || G.state === 'intro') { step(rdt, now); updateGodRays(); Models.sunView.value.copy(CONFIG.SUN_DIR).transformDirection(camera.matrixWorldInverse); composer.render(); return; }
    const sub = window.__simSteps || 1;
    for (let i = 0; i < sub; i++) step(rdt, now);
    updateGodRays();
    Models.sunView.value.copy(CONFIG.SUN_DIR).transformDirection(camera.matrixWorldInverse);
    composer.render();
  }
  function step(rdt, now) {
    // time scaling
    if (slowT > 0) { slowT -= rdt; timeScale = U.damp(timeScale, slowScale, 20, rdt); } else timeScale = U.damp(timeScale, 1, 6, rdt);
    let dt = rdt * timeScale;
    if (hitstopT > 0) { hitstopT -= rdt; dt *= 0.04; }
    time += dt;
    if (G.state === 'play') stats.time += rdt;

    const inp = Input.frame();
    if (inp.pressed('pause')) { if (G.state === 'play') pause(); }

    if (player) {
      if (G.state === 'play' || G.state === 'victory') player.update(dt, G.state === 'play' ? inp : { moveX: 0, moveY: 0, pressed: () => false, down: () => false }, gcam);
      else { player.syncRoot(); player.anim.update(dt); for (const r of player.ribbons) r.update(dt); }
      for (const e of enemies) {
        const far = e.pos.distanceToSquared(player.pos) > 90 * 90;
        e.rig.root.visible = e.active && (!far || e.boss);
        if (!far || e.state !== 'idle') e.update(dt, player);
      }
      for (const c of clones) c.update(dt);
      Combat.updateProjectiles(dt, player);
      updateOrbs(dt);
      if (G.state === 'play') updateZone();
    }
    gcam.update(rdt * (hitstopT > 0 ? 0.3 : 1) * Math.max(timeScale, 0.5), player, G.state === 'play' ? inp : { lookX: 0, lookY: 0, zoom: 0 });
    World.update(dt, time, camera, player.pos);
    FX.update(dt, time);
    UI.update(rdt, player, camera, G);
    G.audio.setListener(camera.position, gcam.yaw);
    G.audio.update(rdt);
    Input.endFrame();
    // post uniforms
    post.chroma = U.damp(post.chroma, 0, 5, rdt); post.radial = U.damp(post.radial, 0, 3, rdt);
    post.gold = U.damp(post.gold, 0, 2.5, rdt); post.red = U.damp(post.red, 0, 3, rdt);
    const u = gradePass.uniforms;
    u.time.value = now / 1000; u.chroma.value = post.chroma; u.radial.value = post.radial + (timeScale < 0.5 ? 0.15 : 0);
    u.gold.value = post.gold + (player.state === 'charge' ? Math.floor(player.focus) * 0.03 : 0);
    u.red.value = post.red; u.desat.value = player.alive ? U.clamp(0.35 - player.hp / player.maxHp, 0, 0.35) : U.clamp(u.desat.value + rdt * 0.4, 0, 0.8);
  }
  function updateOrbs(dt) {
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.t += dt;
      const target = U.tmpV[5].set(player.pos.x, player.pos.y + 1.1, player.pos.z);
      if (o.t < 0) { o.v.multiplyScalar(0.94); o.v.y -= dt * 0.5; }
      else { const dir = target.clone().sub(o.p); const d = dir.length(); o.v.lerp(dir.normalize().multiplyScalar(9 + o.t * 12), U.dampK(6, dt)); if (d < 0.5) { player.will += o.val; player.mana = Math.min(player.maxMana, player.mana + 1.5); orbs.splice(i, 1); if (Math.random() < 0.4) G.audio.play('will_pickup', { volume: 0.4 }); continue; } }
      o.p.addScaledVector(o.v, dt);
      FX.add.emit({ x: o.p.x, y: o.p.y, z: o.p.z, life: 0.25, s0: 0.14, s1: 0.02, c0: [2.4, 1.7, 0.7, 0.9], c1: [1.2, 0.6, 0.2, 0] });
    }
  }
  function updateZone() {
    const z = World.zoneAt(player.pos.x, player.pos.z);
    if (z !== currentZone) {
      const first = !currentZone;
      currentZone = z;
      UI.zone(z.name, z.sub);
      G.audio.setAmbience(z.amb);
      if (first) G.audio.play('bell', { volume: 0.5 });
    }
  }

  Object.defineProperty(G, 'player', { get: () => player });
  Object.defineProperty(G, 'camera', { get: () => camera });
  Object.defineProperty(G, 'scene', { get: () => scene });
  Object.defineProperty(G, 'renderer', { get: () => renderer });
  G.boot = boot;
  G.debug = {
    teleport(x, z, yaw = Math.PI) { player.pos.set(x, World.heightAt(x, z), z); player.yaw = yaw; gcam.snap(player); },
    enemies: () => enemies.map(e => ({ k: e.kind, hp: Math.round(e.hp), st: e.state, alive: e.alive, p: [e.pos.x.toFixed(1), e.pos.z.toFixed(1)] })),
    get stats() { return stats; },
  };
  return G;
})();

Game.boot().catch(e => {
  console.error(e);
  const t = document.getElementById('ldtxt');
  if (t) t.textContent = '加载失败：' + (e && e.message ? e.message : e) + '（请尝试刷新或更换浏览器）';
});
window.__game = Game;
