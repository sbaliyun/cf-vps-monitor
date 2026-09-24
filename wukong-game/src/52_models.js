// ---------------------------------------------------------------------------
// Procedural character models (materials, textures, meshes on rigs)
// ---------------------------------------------------------------------------
const Models = (() => {
  const { limb, ell, cone, cyl, tubeAlong, skirtPanel, torso, sculpt } = Rig;
  const TEX = {};

  // ---- Textures ---------------------------------------------------------------
  function furTex() {
    if (TEX.fur) return TEX.fur;
    TEX.fur = U.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
      const r = U.mulberry32(11);
      for (let i = 0; i < 5200; i++) {
        const x = r() * w, y = r() * h, len = 5 + r() * 12, a = (r() - 0.5) * 0.5;
        const l = 70 + r() * 150;
        g.strokeStyle = `rgba(${l},${l},${l},0.55)`; g.lineWidth = 0.8 + r() * 0.9;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.sin(a) * len * 0.5 + (r() - 0.5) * 2, y + len * 0.5, x + Math.sin(a) * len, y + Math.cos(a) * len); g.stroke();
        // wrap
        if (y + len > h) { g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + Math.sin(a) * len, y - h + Math.cos(a) * len); g.stroke(); }
      }
    }, { srgb: false });
    TEX.fur.repeat.set(3, 3);
    return TEX.fur;
  }
  function tigerTex() {
    if (TEX.tiger) return TEX.tiger;
    TEX.tiger = U.canvasTex(512, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#6a3c18'); gr.addColorStop(0.7, '#8e5a26'); gr.addColorStop(1, '#b89060');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = U.mulberry32(5);
      for (let i = 0; i < 16; i++) {
        const x0 = (i / 16) * w + r() * 12;
        g.fillStyle = 'rgba(22,14,8,0.92)';
        g.beginPath();
        const wd = 6 + r() * 9;
        g.moveTo(x0, -5);
        for (let y = 0; y <= h * 0.85; y += 16) g.lineTo(x0 + Math.sin(y * 0.03 + i) * 10 + (r() - 0.5) * 4, y);
        for (let y = h * 0.85; y >= 0; y -= 16) g.lineTo(x0 + wd * (1 - y / h) + Math.sin(y * 0.03 + i) * 10, y);
        g.closePath(); g.fill();
      }
      for (let i = 0; i < 3000; i++) {
        const x = r() * w, y = r() * h, l = r() < 0.5 ? 0 : 255;
        g.strokeStyle = `rgba(${l},${l * 0.8},${l * 0.5},0.08)`;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y + 6); g.stroke();
      }
      // ragged dark hem
      g.fillStyle = 'rgba(40,25,12,0.6)'; g.fillRect(0, h - 10, w, 10);
    });
    return TEX.tiger;
  }
  function clothTex() {
    if (TEX.cloth) return TEX.cloth;
    TEX.cloth = U.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, w, h);
      const r = U.mulberry32(21);
      for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.07})`; g.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; g.fillRect(x, 0, 1, h); }
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(40,30,20,${r() * 0.12})`; g.beginPath(); g.arc(r() * w, r() * h, 4 + r() * 22, 0, 7); g.fill(); }
    });
    TEX.cloth.repeat.set(2, 2);
    return TEX.cloth;
  }
  function leatherTex() {
    if (TEX.leather) return TEX.leather;
    TEX.leather = U.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#a08c78'; g.fillRect(0, 0, w, h);
      const r = U.mulberry32(31);
      for (let i = 0; i < 900; i++) { const l = 90 + r() * 90; g.fillStyle = `rgba(${l},${l * 0.85},${l * 0.7},0.18)`; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 6, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(40,25,15,0.5)'; g.setLineDash([4, 3]); g.lineWidth = 1.2;
      for (let y = 20; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    });
    return TEX.leather;
  }
  function lacquerTex() {
    if (TEX.lacquer) return TEX.lacquer;
    TEX.lacquer = U.canvasTex(64, 512, (g, w, h) => {
      g.fillStyle = '#6a2a1c'; g.fillRect(0, 0, w, h);
      const r = U.mulberry32(41);
      for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(20,5,2,${0.1 + r() * 0.25})`; g.lineWidth = 0.6 + r() * 1.5; g.beginPath(); const x = r() * w; g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 8, h * 0.3, x + (r() - 0.5) * 8, h * 0.6, x + (r() - 0.5) * 6, h); g.stroke(); }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,220,180,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 1, 10 + r() * 30); }
    });
    return TEX.lacquer;
  }
  function kasayaTex() {
    if (TEX.kasaya) return TEX.kasaya;
    TEX.kasaya = U.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#7a2616'; g.fillRect(0, 0, w, h);
      const r = U.mulberry32(51);
      for (let y = 0; y < h; y += 42) for (let x = 0; x < w; x += 64) {
        const l = r() * 30; g.fillStyle = `rgb(${110 + l},${34 + l * 0.3},${22})`; g.fillRect(x + 3, y + 3, 58, 36);
      }
      g.strokeStyle = '#b08a3a'; g.lineWidth = 3;
      for (let y = 0; y <= h; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(20,10,5,${r() * 0.15})`; g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 15, 0, 7); g.fill(); }
    });
    return TEX.kasaya;
  }
  function skinBump() {
    if (TEX.skin) return TEX.skin;
    TEX.skin = U.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      const r = U.mulberry32(61);
      for (let i = 0; i < 260; i++) {
        g.strokeStyle = `rgba(${r() < 0.5 ? 30 : 200},${r() < 0.5 ? 30 : 200},${r() < 0.5 ? 30 : 200},0.25)`;
        g.lineWidth = 0.7 + r() * 2; g.beginPath(); const x = r() * w, y = r() * h;
        g.moveTo(x, y); g.bezierCurveTo(x + 10, y + (r() - 0.5) * 6, x + 20, y + (r() - 0.5) * 6, x + 30 + r() * 20, y + (r() - 0.5) * 8); g.stroke();
      }
      for (let i = 0; i < 1500; i++) { const l = 100 + r() * 60; g.fillStyle = `rgba(${l},${l},${l},0.3)`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    }, { srgb: false });
    return TEX.skin;
  }

  // ---- Character FX (hit flash, freeze, dissolve) ---------------------------------
  function makeFX() {
    return { flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 0.95, 0.9) }, freeze: { value: 0 }, dissolve: { value: 0 }, rim: { value: 0 }, rimColor: { value: new THREE.Color(1, 0.7, 0.3) } };
  }
  const sunView = { value: new THREE.Vector3(0, 0, -1) };
  function fxify(mat, fx) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSunView = sunView;
      sh.uniforms.uFlash = fx.flash; sh.uniforms.uFlashColor = fx.flashColor; sh.uniforms.uFreeze = fx.freeze;
      sh.uniforms.uDissolve = fx.dissolve; sh.uniforms.uRim = fx.rim; sh.uniforms.uRimColor = fx.rimColor;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDisP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDisP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vDisP; uniform float uFlash, uFreeze, uDissolve, uRim; uniform vec3 uFlashColor, uRimColor, uSunView;
        float dh(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        float dn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z); }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float dnz = dn(vDisP * 18.0) * 0.6 + dn(vDisP * 47.0) * 0.4;
          if (uDissolve > 0.0 && dnz < uDissolve) discard;`)
        .replace('#include <opaque_fragment>', `
          float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 2.5);
          outgoingLight += uRimColor * fres * uRim;
          // sun-wrapped rim light (fur halo when backlit)
          float backlit = max(dot(-normalize(vViewPosition), uSunView), 0.0);
          outgoingLight += vec3(1.0, 0.72, 0.42) * pow(fres, 3.0) * backlit * 0.9;
          outgoingLight = mix(outgoingLight, uFlashColor * 1.2, uFlash) + uFlashColor * fres * uFlash * 2.0;
          outgoingLight = mix(outgoingLight, outgoingLight * vec3(1.1, 0.9, 0.55) + vec3(0.9, 0.62, 0.2) * (0.15 + fres * 1.3), uFreeze);
          if (uDissolve > 0.0 && dnz < uDissolve + 0.06) outgoingLight += vec3(2.5, 1.2, 0.35) * (1.0 - (dnz - uDissolve) / 0.06);
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'charfx';
    return mat;
  }

  function furMat(color, fx, sheen = 0xd8c0a0, extra = {}) {
    return fxify(new THREE.MeshPhysicalMaterial({
      color, map: furTex(), bumpMap: furTex(), bumpScale: 1.6, roughness: 0.88, metalness: 0,
      sheen: 1, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.45, ...extra,
    }), fx);
  }
  const std = (fx, o) => fxify(new THREE.MeshStandardMaterial(o), fx);

  // secondary motion for hanging panels following the thighs
  function panelDriver(rig, panels) {
    return (r) => {
      const tl = r.j.thighL.rotation, tr = r.j.thighR.rotation;
      for (const p of panels) {
        let x;
        if (p.side === 'F') x = Math.min(tl.x, tr.x, 0) * 0.85;
        else if (p.side === 'B') x = Math.max(tl.x, tr.x, 0) * 0.85;
        else if (p.side === 'L') { x = tl.x * 0.6; p.obj.rotation.z = Math.max(tl.z, 0) * 0.8 + 0.04; }
        else { x = tr.x * 0.6; p.obj.rotation.z = Math.min(tr.z, 0) * 0.8 - 0.04; }
        p.obj.rotation.x = x + (p.side === 'F' ? -0.06 : p.side === 'B' ? 0.1 : 0);
      }
    };
  }
  function addPanels(mb, mat, rTop, rBot, h, y, jag = 0.03) {
    const panels = [];
    const defs = [['F', 0, 1.75], ['B', Math.PI, 1.75], ['L', Math.PI / 2, 1.55], ['R', -Math.PI / 2, 1.55]];
    for (const [side, mid, span] of defs) {
      const g = skirtPanel(rTop, rBot, h, mid, span, 8, jag);
      const m = new THREE.Mesh(g, mat);
      const o = new THREE.Group(); o.position.y = y; o.add(m);
      mb.addObject('hips', o);
      panels.push({ side, obj: o });
    }
    return panels;
  }

  // ---- The Destined One (monkey) ------------------------------------------------------
  const MONKEY = { hipH: 0.9, spine: 0.1, chest: 0.2, neck: [0, 0.25, 0.02], head: [0, 0.08, 0.02], shoulder: [0.19, 0.2, -0.02], upper: 0.29, fore: 0.28, hipW: 0.1, thigh: 0.41, shin: 0.40, tail: { n: 6, root: [0, 0.02, -0.12], seg: 0.1, base: -1.15, curl: 0.3 } };

  function buildStaff(fx, clone) {
    const L = 2.3;
    const g = new THREE.Group();
    const gold = clone ? null : std(fx, { color: 0xd6a54a, metalness: 1, roughness: 0.28, envMapIntensity: 1.6 });
    const shaftMat = clone ? null : std(fx, { color: 0xffffff, map: lacquerTex(), metalness: 0.15, roughness: 0.32, envMapIntensity: 1.2 });
    const cm = clone;
    const parts = [];
    const add = (geo, mat, y = 0) => { geo.translate(0, y, 0); parts.push([geo, mat || cm]); };
    add(cyl(0.024, 0.024, L - 0.42, 12), shaftMat);
    for (const s of [-1, 1]) {
      add(cyl(0.031, 0.029, 0.22, 16), gold, s * (L / 2 - 0.11));
      for (let k = 0; k < 3; k++) { const t = new THREE.TorusGeometry(0.032, 0.006, 6, 16); t.rotateX(Math.PI / 2); add(t, gold, s * (L / 2 - 0.02 - k * 0.09)); }
      const d = new THREE.SphereGeometry(0.031, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); if (s < 0) d.rotateX(Math.PI); add(d, gold, s * L / 2);
    }
    // merge per material
    const byMat = new Map();
    for (const [geo, mat] of parts) { const k = mat.uuid; if (!byMat.has(k)) byMat.set(k, { mat, geos: [] }); byMat.get(k).geos.push(geo.index ? geo.toNonIndexed() : geo); }
    for (const e of byMat.values()) {
      e.geos.forEach(q => { for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); });
      const m = new THREE.Mesh(mergeGeometries(e.geos), e.mat); m.castShadow = true; g.add(m);
    }
    // energy glow shell (focus / charge)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(cyl(0.055, 0.055, L + 0.05, 12, true), glowMat);
    glow.renderOrder = 5; g.add(glow);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(cyl(0.03, 0.03, L, 8, true), coreMat);
    g.add(core);
    return { obj: g, len: L, glowMat, coreMat };
  }

  function buildMonkey({ clone = false } = {}) {
    const rig = new Rig.Humanoid(MONKEY);
    const fx = makeFX();
    let M;
    if (clone) {
      const cm = new THREE.MeshStandardMaterial({ color: 0xffc860, emissive: 0xffa030, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.4, metalness: 0.2, depthWrite: true });
      fxify(cm, fx);
      M = { fur: cm, furDark: cm, furLight: cm, skin: cm, face: cm, gold: cm, cloth: cm, tiger: cm, leather: cm, red: cm, eye: cm, dark: cm, bronze: cm, gourd: cm };
    } else {
      M = {
        fur: furMat(0x7a5530, fx, 0xd8b080),
        furDark: furMat(0x4a3220, fx, 0xb89060),
        furLight: furMat(0x9a7448, fx, 0xe8c89a),
        skin: std(fx, { color: 0x6e4a36, roughness: 0.62, bumpMap: skinBump(), bumpScale: 0.6 }),
        face: std(fx, { color: 0x9a6a50, roughness: 0.55, bumpMap: skinBump(), bumpScale: 0.5 }),
        gold: std(fx, { color: 0xd8a84e, metalness: 1, roughness: 0.3, envMapIntensity: 1.5 }),
        bronze: std(fx, { color: 0x8a6a42, metalness: 0.85, roughness: 0.42, envMapIntensity: 1.2 }),
        cloth: std(fx, { color: 0x6e665a, map: clothTex(), roughness: 0.95 }),
        tiger: std(fx, { map: tigerTex(), roughness: 0.85, side: THREE.DoubleSide, bumpMap: furTex(), bumpScale: 0.8 }),
        leather: std(fx, { color: 0x5a4030, map: leatherTex(), roughness: 0.7 }),
        red: std(fx, { color: 0x8a2018, map: clothTex(), roughness: 0.9, side: THREE.DoubleSide }),
        eye: std(fx, { color: 0xffc040, emissive: 0xff9a10, emissiveIntensity: 0.9, roughness: 0.2 }),
        dark: std(fx, { color: 0x1a120c, roughness: 0.5 }),
        gourd: std(fx, { color: 0x8a3a1a, roughness: 0.25, metalness: 0.05, envMapIntensity: 1.2 }),
      };
    }
    const mb = new Rig.ModelBuilder(rig);
    // torso (lean, hunched, muscular)
    mb.add('hips', ell(0.165, 0.13, 0.13), M.fur, [0, 0.0, -0.01]);
    mb.add('spine', ell(0.15, 0.15, 0.125), M.fur, [0, 0.09, 0.01]);
    mb.add('spine', ell(0.11, 0.12, 0.08), M.furLight, [0, 0.08, 0.06]);
    mb.add('chest', ell(0.195, 0.18, 0.145), M.fur, [0, 0.1, 0.01]);
    mb.add('chest', ell(0.15, 0.12, 0.09), M.furLight, [0, 0.12, 0.07]);
    mb.add('chest', ell(0.21, 0.13, 0.14), M.furDark, [0, 0.19, -0.06]);  // hunched upper back
    mb.add('chest', ell(0.09, 0.09, 0.09), M.fur, [0.175, 0.2, -0.02]);
    mb.add('chest', ell(0.09, 0.09, 0.09), M.fur, [-0.175, 0.2, -0.02]);
    // fur tufts on the back / shoulders break the silhouette
    for (let i = 0; i < 12; i++) {
      const a = -1.3 + (i / 11) * 2.6;
      mb.add('chest', cone(0.04, 0.13, 5), i % 2 ? M.fur : M.furDark, [Math.sin(a) * 0.19, 0.2 + Math.cos(a) * 0.05, -0.1 - Math.cos(a) * 0.05], [-2.3, 0, -a * 0.8]);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mb.add('spine', cone(0.035, 0.1, 5), M.furDark, [Math.sin(a) * 0.1, 0.12, -0.1 + Math.cos(a) * 0.03], [-2.5, 0, Math.sin(a) * 0.6]);
    }
    // baldric across the chest
    mb.add('chest', tubeAlong([[0.16, 0.26, 0.03], [0.05, 0.2, 0.155], [-0.08, 0.06, 0.155], [-0.17, -0.06, 0.07]], 0.016, 16, 6), M.leather);
    mb.add('chest', tubeAlong([[0.16, 0.26, 0.03], [0.1, 0.2, -0.16], [-0.06, 0.06, -0.16], [-0.17, -0.06, 0.02]], 0.016, 16, 6), M.leather);
    // shoulder pauldron (left)
    const pauld = new THREE.SphereGeometry(0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2);
    mb.add('armL', pauld, M.bronze, [0.01, 0.02, 0], [0, 0, -0.35], [1, 0.75, 1.05]);
    mb.add('armL', new THREE.TorusGeometry(0.1, 0.008, 6, 20).rotateX(Math.PI / 2), M.gold, [0.03, -0.035, 0], [0, 0, -0.35]);
    // neck + mane
    mb.add('neck', cyl(0.07, 0.08, 0.16), M.fur, [0, 0.04, 0]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2; if (Math.cos(a) > 0.7) continue;
      mb.add('neck', cone(0.04, 0.14, 5), i % 2 ? M.fur : M.furDark, [Math.sin(a) * 0.085, 0.0, Math.cos(a) * 0.08], [Math.cos(a) * 1.4 + 0.3, 0, -Math.sin(a) * 1.4]);
    }
    // head: fur skull, heart-shaped face, heavy brow, deep-set golden eyes
    mb.add('head', ell(0.11, 0.115, 0.118), M.fur, [0, 0.1, -0.01]);
    mb.add('head', ell(0.088, 0.092, 0.06), M.face, [0, 0.07, 0.07]);
    mb.add('head', ell(0.062, 0.05, 0.062), M.face, [0, 0.02, 0.11]);
    mb.add('head', ell(0.05, 0.025, 0.04), M.face, [0, -0.012, 0.1]);         // chin
    mb.add('head', limb(0.15, 0.027, 0.027, 8, 3), M.furDark, [0.075, 0.113, 0.1], [0, 0.15, -Math.PI / 2]);  // brow ridge
    for (const s of [-1, 1]) {
      mb.add('head', ell(0.016, 0.014, 0.01), M.eye, [s * 0.036, 0.085, 0.118]);
      mb.add('head', ell(0.007, 0.009, 0.004), M.dark, [s * 0.036, 0.085, 0.127]);
      mb.add('head', ell(0.028, 0.038, 0.012), M.face, [s * 0.11, 0.08, 0.0], [0, s * 0.5, 0]);
      mb.add('head', ell(0.007, 0.005, 0.005), M.dark, [s * 0.012, 0.035, 0.168]);
      // cheek fur / sideburns framing the face
      for (let k = 0; k < 4; k++) mb.add('head', cone(0.03, 0.11, 5), k % 2 ? M.fur : M.furLight, [s * (0.092 + k * 0.004), 0.02 + k * 0.035, 0.05 - k * 0.025], [0.3, 0, s * (1.95 - k * 0.25)]);
    }
    mb.add('head', ell(0.03, 0.004, 0.01), M.dark, [0, 0.0, 0.158]);          // mouth line
    // crown fur tufts
    for (let i = 0; i < 11; i++) {
      const a = -1.3 + i * 0.26;
      mb.add('head', cone(0.038, 0.13, 5), i % 2 ? M.furDark : M.fur, [Math.sin(a) * 0.075, 0.19, -0.04 + Math.cos(a) * 0.02 - 0.05], [-1.0, 0, -a * 0.6]);
    }
    // golden circlet 紧箍
    const band = new THREE.TorusGeometry(0.114, 0.01, 8, 32); band.rotateX(Math.PI / 2);
    mb.add('head', band, M.gold, [0, 0.142, 0.004], [0.14, 0, 0]);
    for (const s of [-1, 1]) mb.add('head', new THREE.TorusGeometry(0.016, 0.005, 6, 14), M.gold, [s * 0.022, 0.162, 0.115], [0.1, 0, 0]);
    // arms
    for (const S of ['L', 'R']) {
      mb.add('arm' + S, limb(0.29, 0.068, 0.052), M.fur);
      mb.add('arm' + S, ell(0.055, 0.1, 0.05), M.fur, [0, -0.12, 0.02]);
      mb.add('fore' + S, limb(0.28, 0.056, 0.042), M.fur);
      mb.add('fore' + S, ell(0.058, 0.065, 0.058), M.fur, [0, -0.005, 0]);
      mb.add('fore' + S, cyl(0.056, 0.05, 0.13, 14), M.bronze, [0, -0.19, 0]);
      mb.add('fore' + S, new THREE.TorusGeometry(0.055, 0.007, 6, 16).rotateX(Math.PI / 2), M.gold, [0, -0.125, 0]);
      for (let k = 0; k < 3; k++) mb.add('fore' + S, cone(0.02, 0.08, 4), M.fur, [0, -0.06 - k * 0.04, -0.045], [-2.6, 0, 0]);
      mb.add('hand' + S, ell(0.045, 0.052, 0.042), M.skin, [0, -0.04, 0.005]);
      mb.add('hand' + S, ell(0.018, 0.03, 0.018), M.skin, [S === 'L' ? -0.035 : 0.035, -0.03, 0.03], [0.4, 0, 0]);
    }
    // legs
    for (const S of ['L', 'R']) {
      mb.add('thigh' + S, limb(0.41, 0.092, 0.064), M.fur);
      mb.add('shin' + S, limb(0.4, 0.062, 0.044), M.fur);
      mb.add('shin' + S, ell(0.07, 0.075, 0.07), M.fur, [0, -0.01, 0.005]);
      mb.add('shin' + S, cyl(0.064, 0.052, 0.26, 12), M.cloth, [0, -0.25, 0]);
      for (let k = 0; k < 4; k++) mb.add('shin' + S, new THREE.TorusGeometry(0.062 - k * 0.003, 0.0035, 5, 14).rotateX(Math.PI / 2 + 0.25), M.dark, [0, -0.15 - k * 0.06, 0]);
      mb.add('foot' + S, ell(0.048, 0.035, 0.1), M.skin, [0, -0.03, 0.045]);
      for (let k = -1; k <= 1; k++) mb.add('foot' + S, ell(0.014, 0.012, 0.025), M.skin, [k * 0.024, -0.045, 0.13]);
    }
    // belt, sash
    const belt = new THREE.TorusGeometry(0.175, 0.03, 8, 28); belt.rotateX(Math.PI / 2); belt.scale(1, 1, 0.85);
    mb.add('hips', belt, M.leather, [0, 0.07, 0]);
    const sash = new THREE.TorusGeometry(0.182, 0.02, 6, 28); sash.rotateX(Math.PI / 2); sash.scale(1, 1, 0.86);
    mb.add('hips', sash, M.red, [0, 0.03, 0]);
    mb.add('hips', ell(0.045, 0.04, 0.03), M.red, [0.05, 0.03, 0.15]);
    // gourd on the left hip
    const gp = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, y = -t * 0.24; const r = 0.004 + Math.max(Math.sin(t * Math.PI * 1.0) * 0.0, 0) + (t < 0.4 ? Math.sin(t / 0.4 * Math.PI) * 0.045 : Math.sin((t - 0.4) / 0.6 * Math.PI) * 0.068) + 0.006; gp.push(new THREE.Vector2(r, y)); }
    const gourdGeo = new THREE.LatheGeometry(gp, 16);
    const hipGourd = new THREE.Mesh(gourdGeo, M.gourd); hipGourd.position.set(0.2, 0.05, -0.02); hipGourd.rotation.z = 0.15;
    mb.addObject('hips', hipGourd);
    const handGourd = new THREE.Mesh(gourdGeo, M.gourd); handGourd.position.set(0, -0.02, 0.04); handGourd.rotation.set(-2.6, 0, 0); handGourd.visible = false;
    mb.addObject('handL', handGourd);
    // tail
    for (let i = 0; i < rig.tail.length; i++) {
      const r0 = 0.034 - i * 0.004, r1 = r0 - 0.004;
      mb.add('tail' + i, limb(0.11, r0, r1, 8, 3), M.fur, [0, 0, 0], [Math.PI / 2, 0, 0]);
    }
    mb.add('tail' + (rig.tail.length - 1), ell(0.04, 0.04, 0.07), M.furDark, [0, 0, -0.1]);
    // tiger-skin skirt panels (secondary motion)
    const panels = addPanels(mb, M.tiger, 0.18, 0.245, 0.3, 0.06, 0.045);
    rig.post = panelDriver(rig, panels);
    const meshes = mb.build(true);
    // staff
    const staff = buildStaff(fx, clone ? M.gold : null);
    rig.attachWeapon(staff.obj, staff.len);
    staff.obj.traverse(c => { if (c.isMesh && c.material.type !== 'MeshBasicMaterial') meshes.push(c); });
    rig.root.traverse(c => { if (c.isMesh) c.frustumCulled = false; });
    return { rig, fx, meshes, staff, materials: M, hipGourd, handGourd };
  }

  // ---- Wolf demons -------------------------------------------------------------------
  const WOLF = { hipH: 1.0, spine: 0.12, chest: 0.23, neck: [0, 0.27, 0.05], head: [0, 0.09, 0.03], shoulder: [0.21, 0.2, -0.01], upper: 0.31, fore: 0.29, hipW: 0.11, thigh: 0.44, shin: 0.44, jaw: [0, 0.035, 0.07], tail: { n: 5, root: [0, 0.0, -0.14], seg: 0.13, base: -1.3, curl: 0.06 } };

  function wolfHead(mb, M, fx) {
    mb.add('head', ell(0.105, 0.1, 0.118), M.fur, [0, 0.09, 0.02]);
    mb.add('head', limb(0.17, 0.062, 0.03, 12, 4), M.fur, [0, 0.075, 0.1], [-Math.PI / 2 - 0.08, 0, 0]);
    mb.add('head', ell(0.022, 0.018, 0.02), M.dark, [0, 0.083, 0.29]);
    mb.add('jaw', limb(0.14, 0.042, 0.022, 10, 3), M.fur, [0, -0.005, 0.02], [-Math.PI / 2 + 0.1, 0, 0]);
    mb.add('jaw', ell(0.03, 0.01, 0.1), M.mouth, [0, 0.008, 0.09]);
    for (const s of [-1, 1]) {
      mb.add('head', ell(0.016, 0.012, 0.012), M.eye, [s * 0.048, 0.115, 0.125]);
      mb.add('head', cone(0.038, 0.12, 5), M.fur, [s * 0.062, 0.19, 0.0], [-0.35, 0, -s * 0.35]);
      mb.add('head', cone(0.024, 0.08, 4), M.skinDark, [s * 0.062, 0.185, 0.012], [-0.35, 0, -s * 0.35]);
      for (let k = 0; k < 3; k++) mb.add('head', cone(0.03, 0.11, 5), M.fur, [s * 0.1, 0.05 + k * 0.03, 0.02 - k * 0.03], [0.2, 0, s * (1.8 - k * 0.2)]);
      // fangs
      mb.add('head', cone(0.007, 0.035, 4), M.teeth, [s * 0.026, 0.035, 0.22], [Math.PI, 0, 0]);
      mb.add('jaw', cone(0.006, 0.028, 4), M.teeth, [s * 0.022, 0.03, 0.12]);
    }
    // brow
    mb.add('head', limb(0.12, 0.02, 0.02, 6, 2), M.fur, [0.06, 0.135, 0.11], [0, 0, -Math.PI / 2]);
  }
  function wolfBody(mb, M, rig, opts) {
    mb.add('hips', torso([[-0.08, 0.12], [0.0, 0.16], [0.08, 0.15]], 0.82), M.fur);
    mb.add('spine', torso([[-0.02, 0.14], [0.08, 0.15], [0.16, 0.17]], 0.8), M.fur);
    mb.add('spine', ell(0.1, 0.1, 0.06), M.furLight, [0, 0.07, 0.085]);
    mb.add('chest', torso([[-0.04, 0.16], [0.06, 0.2], [0.15, 0.215], [0.24, 0.19], [0.31, 0.11]], 0.78), M.fur, [0, 0, -0.01]);
    mb.add('chest', ell(0.19, 0.12, 0.12), M.fur, [0, 0.21, -0.07]);
    // shaggy back and shoulders
    for (let i = 0; i < 14; i++) {
      const a = -1.4 + (i / 13) * 2.8;
      mb.add('chest', cone(0.05, 0.16, 5), i % 2 ? M.fur : M.furLight, [Math.sin(a) * 0.19, 0.22 + Math.cos(a) * 0.05, -0.1 - Math.cos(a) * 0.05], [-2.3, 0, -a * 0.8]);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mb.add('spine', cone(0.045, 0.13, 5), M.fur, [Math.sin(a) * 0.12, 0.12, -0.11 + Math.cos(a) * 0.03], [-2.5, 0, Math.sin(a) * 0.6]);
    }
    mb.add('neck', cyl(0.065, 0.085, 0.2), M.fur, [0, 0.04, 0]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      mb.add('neck', cone(0.05, 0.17, 5), i % 2 ? M.fur : M.furLight, [Math.sin(a) * 0.085, -0.02, Math.cos(a) * 0.085], [Math.cos(a) * 1.5 + 0.2, 0, -Math.sin(a) * 1.5]);
    }
    for (const S of ['L', 'R']) {
      mb.add('arm' + S, limb(0.31, 0.066, 0.05), M.fur);
      mb.add('fore' + S, limb(0.29, 0.052, 0.04), M.fur);
      mb.add('fore' + S, ell(0.058, 0.062, 0.058), M.fur, [0, -0.005, 0]);
      mb.add('fore' + S, cyl(0.058, 0.05, 0.16, 12), M.iron, [0, -0.18, 0]);
      for (let k = 0; k < 3; k++) mb.add('fore' + S, cone(0.022, 0.09, 4), M.fur, [0, -0.04 - k * 0.035, -0.045], [-2.6, 0, 0]);
      mb.add('hand' + S, ell(0.045, 0.055, 0.04), M.skinDark, [0, -0.04, 0.005]);
      for (let k = 0; k < 3; k++) mb.add('hand' + S, cone(0.008, 0.04, 4), M.teeth, [(k - 1) * 0.022, -0.09, 0.02], [Math.PI - 0.3, 0, 0]);
      mb.add('thigh' + S, limb(0.44, 0.09, 0.06), M.fur);
      mb.add('shin' + S, limb(0.44, 0.058, 0.04), M.fur);
      mb.add('shin' + S, ell(0.068, 0.075, 0.068), M.fur, [0, -0.01, 0.005]);
      mb.add('shin' + S, cyl(0.064, 0.05, 0.26, 12), M.cloth, [0, -0.27, 0]);
      for (let k = 0; k < 4; k++) mb.add('shin' + S, new THREE.TorusGeometry(0.062 - k * 0.003, 0.0035, 5, 14).rotateX(Math.PI / 2 + 0.25), M.leather, [0, -0.17 - k * 0.06, 0]);
      mb.add('foot' + S, ell(0.055, 0.04, 0.11), M.fur, [0, -0.035, 0.05]);
      for (let k = -1; k <= 1; k++) mb.add('foot' + S, cone(0.008, 0.035, 4), M.teeth, [k * 0.025, -0.06, 0.155], [Math.PI / 2, 0, 0]);
    }
    // armour: curved leather breastplate + straps + iron pauldrons
    const plate = new THREE.CylinderGeometry(0.215, 0.19, 0.2, 18, 2, true, -1.25, 2.5);
    plate.scale(1, 1, 0.8);
    mb.add('chest', plate, M.leather, [0, 0.1, 0.0]);
    const back = new THREE.CylinderGeometry(0.2, 0.18, 0.16, 16, 1, true, Math.PI - 0.9, 1.8); back.scale(1, 1, 0.8);
    mb.add('chest', back, M.leather, [0, 0.12, -0.01]);
    mb.add('chest', tubeAlong([[0.17, 0.25, 0.02], [0.1, 0.24, 0.14], [-0.1, 0.24, 0.14], [-0.17, 0.25, 0.02]], 0.014, 12, 5), M.leather);
    const pauld = new THREE.SphereGeometry(0.115, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1);
    for (const S of ['L', 'R']) {
      mb.add('arm' + S, pauld, M.iron, [S === 'L' ? 0.01 : -0.01, 0.02, 0], [0, 0, S === 'L' ? -0.4 : 0.4], [1, 0.72, 1.05]);
      if (opts.heavy) mb.add('arm' + S, pauld, M.iron, [S === 'L' ? 0.02 : -0.02, -0.04, 0], [0, 0, S === 'L' ? -0.6 : 0.6], [1.08, 0.66, 1.1]);
    }
    const belt = new THREE.TorusGeometry(0.165, 0.028, 8, 26); belt.rotateX(Math.PI / 2); belt.scale(1, 1, 0.84);
    mb.add('hips', belt, M.leather, [0, 0.07, 0]);
    mb.add('hips', ell(0.05, 0.05, 0.02), M.iron, [0, 0.07, 0.145]);
    if (opts.heavy) mb.add('chest', ell(0.13, 0.11, 0.05), M.iron, [0, 0.1, 0.16]);
    // bushy tail
    for (let i = 0; i < rig.tail.length; i++) {
      const r0 = 0.055 + Math.sin((i + 0.6) / rig.tail.length * Math.PI) * 0.035;
      mb.add('tail' + i, ell(r0, r0, 0.11), M.fur, [0, 0, -0.065]);
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + i; mb.add('tail' + i, cone(r0 * 0.6, 0.12, 4), k % 2 ? M.fur : M.furLight, [Math.sin(a) * r0 * 0.7, Math.cos(a) * r0 * 0.7, -0.08], [-Math.PI / 2 - 0.5 * Math.cos(a), 0, 0.5 * Math.sin(a)]); }
    }
  }
  function wolfMaterials(fx, furColor = 0x5c5854, lightColor = 0x8e8a82) {
    return {
      fur: furMat(furColor, fx, 0xb8b0a8),
      furLight: furMat(lightColor, fx, 0xd8d0c8),
      skinDark: std(fx, { color: 0x2a2220, roughness: 0.6 }),
      dark: std(fx, { color: 0x0e0b0a, roughness: 0.3 }),
      mouth: std(fx, { color: 0x4a1a18, roughness: 0.5 }),
      teeth: std(fx, { color: 0xd8d0b8, roughness: 0.4 }),
      eye: std(fx, { color: 0xffb020, emissive: 0xff8a00, emissiveIntensity: 1.6, roughness: 0.2 }),
      leather: std(fx, { color: 0x4a3526, map: leatherTex(), roughness: 0.75 }),
      iron: std(fx, { color: 0x4a4744, metalness: 0.8, roughness: 0.45, envMapIntensity: 1.0 }),
      cloth: std(fx, { color: 0x6e645a, map: clothTex(), roughness: 0.95 }),
      red: std(fx, { color: 0x5a1c16, map: clothTex(), roughness: 0.9, side: THREE.DoubleSide }),
      steel: std(fx, { color: 0xa8aeb4, metalness: 0.95, roughness: 0.25, envMapIntensity: 1.4 }),
      wood: std(fx, { color: 0x3a2618, map: lacquerTex(), roughness: 0.6 }),
      gold: std(fx, { color: 0xc8984a, metalness: 1, roughness: 0.35, envMapIntensity: 1.3 }),
    };
  }
  function saber(M) {
    const g = new THREE.Group();
    const sh = new THREE.Shape();
    const N = 12, len = 0.82;
    sh.moveTo(0.012, 0);
    for (let i = 0; i <= N; i++) { const t = i / N; sh.lineTo(0.012 + t * t * 0.07, t * len); }
    sh.lineTo(0.012 + 0.07 - 0.05, len + 0.06);
    for (let i = N; i >= 0; i--) { const t = i / N; sh.lineTo(-0.035 + t * t * 0.07 - t * 0.02 * (1 - t), t * len * 0.98); }
    const blade = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
    blade.translate(0, 0.13, -0.004);
    const bm = new THREE.Mesh(blade, M.steel); g.add(bm);
    const guard = new THREE.Mesh(ell(0.055, 0.012, 0.04), M.gold); guard.position.y = 0.12; g.add(guard);
    const grip = new THREE.Mesh(cyl(0.017, 0.019, 0.22, 8), M.leather); grip.position.y = 0.0; g.add(grip);
    const pom = new THREE.Mesh(ell(0.024, 0.02, 0.024), M.gold); pom.position.y = -0.12; g.add(pom);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    return { obj: g, len: 1.0, tip: 0.13 + len, base: 0.13 };
  }
  function glaive(M, len = 1.9) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(cyl(0.022, 0.022, len, 10), M.wood); g.add(shaft);
    const sh = new THREE.Shape();
    sh.moveTo(-0.03, 0); sh.bezierCurveTo(0.09, 0.12, 0.12, 0.3, 0.05, 0.56); sh.lineTo(0.0, 0.5); sh.bezierCurveTo(-0.02, 0.35, -0.05, 0.15, -0.06, 0.05);
    sh.lineTo(-0.09, 0.12); sh.lineTo(-0.07, 0.0);
    const blade = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
    blade.translate(0, len / 2, -0.005);
    const b = new THREE.Mesh(blade, M.steel); g.add(b);
    const collar = new THREE.Mesh(cyl(0.035, 0.03, 0.08, 10), M.gold); collar.position.y = len / 2; g.add(collar);
    const butt = new THREE.Mesh(cone(0.025, 0.14, 6), M.iron); butt.rotation.x = Math.PI; butt.position.y = -len / 2 - 0.06; g.add(butt);
    const tassel = new THREE.Mesh(cone(0.05, 0.16, 6), M.red); tassel.rotation.x = Math.PI; tassel.position.y = len / 2 - 0.08; g.add(tassel);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    return { obj: g, len: len + 0.6, tip: len / 2 + 0.56, base: len / 2 - 0.02 };
  }

  function buildWolf({ variant = 'scout' } = {}) {
    const rig = new Rig.Humanoid(WOLF);
    const fx = makeFX();
    const heavy = variant === 'guard';
    const M = heavy ? wolfMaterials(fx, 0x4a4642, 0x7a766e) : wolfMaterials(fx);
    const mb = new Rig.ModelBuilder(rig);
    wolfHead(mb, M, fx);
    wolfBody(mb, M, rig, { heavy });
    if (heavy) {
      // helmet
      const helm = new THREE.SphereGeometry(0.125, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.3);
      mb.add('head', helm, M.iron, [0, 0.12, 0.0], [-0.15, 0, 0]);
      mb.add('head', cone(0.012, 0.14, 5), M.red, [0, 0.26, -0.02], [-0.3, 0, 0]);
    }
    const panels = addPanels(mb, M.red, 0.17, 0.22, heavy ? 0.42 : 0.36, 0.06, 0.05);
    rig.post = panelDriver(rig, panels);
    const meshes = mb.build(true);
    const weapon = heavy ? glaive(M) : saber(M);
    rig.attachWeapon(weapon.obj, weapon.len);
    weapon.obj.traverse(c => { if (c.isMesh) meshes.push(c); });
    if (heavy) rig.root.scale.setScalar(1.12);
    rig.root.traverse(c => { if (c.isMesh) c.frustumCulled = false; });
    return { rig, fx, meshes, weapon, materials: M };
  }

  // ---- Guangzhi (wolf monk) ------------------------------------------------------------
  function twinBlade(M) {
    const g = new THREE.Group();
    const L = 1.7;
    const shaft = new THREE.Mesh(cyl(0.026, 0.026, L, 12), M.wood); g.add(shaft);
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-0.045, 0); sh.bezierCurveTo(-0.06, 0.18, -0.02, 0.4, 0.04, 0.62); sh.bezierCurveTo(0.08, 0.45, 0.1, 0.2, 0.05, 0.0);
      sh.lineTo(0.09, -0.04); sh.lineTo(-0.08, -0.04);
      const bl = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1 });
      bl.translate(0, 0, -0.006);
      const m = new THREE.Mesh(bl, M.blade); m.position.y = s * (L / 2 + 0.04); if (s < 0) m.rotation.z = Math.PI;
      g.add(m);
      const c = new THREE.Mesh(cyl(0.04, 0.034, 0.1, 12), M.gold); c.position.y = s * (L / 2 - 0.02); g.add(c);
      for (let k = 0; k < 2; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 14), M.gold); t.rotation.x = Math.PI / 2; t.position.y = s * (0.18 + k * 0.08); g.add(t); }
    }
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    return { obj: g, len: L + 1.3, tips: [L / 2 + 0.66, -(L / 2 + 0.66)] };
  }
  function buildGuangzhi() {
    const spec = { ...WOLF, tail: { n: 5, root: [0, 0.0, -0.14], seg: 0.13, base: -1.35, curl: 0.05 } };
    const rig = new Rig.Humanoid(spec);
    const fx = makeFX();
    const M = wolfMaterials(fx, 0x77736c, 0xb0aaa0);
    M.robe = std(fx, { color: 0x2a2d34, map: clothTex(), roughness: 0.92, side: THREE.DoubleSide });
    M.robeIn = std(fx, { color: 0xc8c0b0, map: clothTex(), roughness: 0.9, side: THREE.DoubleSide });
    M.kasaya = std(fx, { map: kasayaTex(), roughness: 0.85, side: THREE.DoubleSide });
    M.beads = std(fx, { color: 0x3a1a10, roughness: 0.3, metalness: 0.1, envMapIntensity: 1.2 });
    M.blade = std(fx, { color: 0xb0a8a0, metalness: 0.95, roughness: 0.22, emissive: 0xff4a10, emissiveIntensity: 0, envMapIntensity: 1.4 });
    const mb = new Rig.ModelBuilder(rig);
    wolfHead(mb, M, fx);
    // body (fur beneath robe)
    mb.add('hips', ell(0.16, 0.12, 0.13), M.robe);
    mb.add('spine', ell(0.15, 0.15, 0.13), M.robe, [0, 0.09, 0.01]);
    mb.add('chest', ell(0.215, 0.195, 0.165), M.robe, [0, 0.1, 0.015]);
    mb.add('chest', ell(0.2, 0.13, 0.14), M.robe, [0, 0.2, -0.06]);
    mb.add('chest', ell(0.07, 0.13, 0.03), M.robeIn, [0, 0.16, 0.16], [0.2, 0, 0]);
    mb.add('neck', cyl(0.062, 0.08, 0.2), M.fur, [0, 0.04, 0]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      mb.add('neck', cone(0.045, 0.15, 5), i % 2 ? M.fur : M.furLight, [Math.sin(a) * 0.08, -0.02, Math.cos(a) * 0.08], [Math.cos(a) * 1.5 + 0.2, 0, -Math.sin(a) * 1.5]);
    }
    // kasaya over the left shoulder
    mb.add('chest', tubeAlong([[0.2, 0.28, -0.02], [0.08, 0.22, 0.17], [-0.1, 0.02, 0.18], [-0.2, -0.12, 0.08]], 0.05, 20, 8), M.kasaya, [0, 0, 0], [0, 0, 0], [1, 1, 0.6]);
    mb.add('chest', tubeAlong([[0.2, 0.28, -0.02], [0.1, 0.2, -0.18], [-0.08, 0.0, -0.18], [-0.2, -0.12, -0.05]], 0.05, 20, 8), M.kasaya, [0, 0, 0], [0, 0, 0], [1, 1, 0.6]);
    mb.add('armL', new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.kasaya, [0, 0.02, 0], [0, 0, -0.3], [1, 0.8, 1.1]);
    // prayer beads
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const y = 0.26 - (1 + Math.cos(a)) * 0.07;
      mb.add('chest', new THREE.SphereGeometry(i === 0 ? 0.03 : 0.021, 10, 8), M.beads, [Math.sin(a) * 0.15, y, Math.cos(a) * 0.14 + 0.02]);
    }
    for (const S of ['L', 'R']) {
      mb.add('arm' + S, limb(0.31, 0.068, 0.056), M.robe);
      mb.add('fore' + S, limb(0.29, 0.05, 0.04), M.fur);
      const sleeve = cyl(0.075, 0.13, 0.26, 14, true);
      mb.add('fore' + S, sleeve, M.robe, [0, -0.12, 0]);
      mb.add('fore' + S, cyl(0.072, 0.128, 0.255, 14, true), M.robeIn, [0, -0.121, 0]);
      mb.add('hand' + S, ell(0.045, 0.055, 0.04), M.skinDark, [0, -0.04, 0.005]);
      mb.add('thigh' + S, limb(0.44, 0.085, 0.06), M.robe);
      mb.add('shin' + S, limb(0.44, 0.055, 0.04), M.cloth);
      mb.add('foot' + S, ell(0.055, 0.04, 0.11), M.skinDark, [0, -0.035, 0.05]);
    }
    const belt = new THREE.TorusGeometry(0.175, 0.03, 8, 26); belt.rotateX(Math.PI / 2); belt.scale(1, 1, 0.85);
    mb.add('hips', belt, M.kasaya, [0, 0.07, 0]);
    for (let i = 0; i < rig.tail.length; i++) {
      const r0 = 0.055 + Math.sin((i + 0.5) / rig.tail.length * Math.PI) * 0.035;
      mb.add('tail' + i, ell(r0, r0, 0.1), i % 2 ? M.fur : M.furLight, [0, 0, -0.06]);
    }
    const panels = addPanels(mb, M.robe, 0.18, 0.4, 0.9, 0.08, 0.06);
    rig.post = panelDriver(rig, panels);
    const meshes = mb.build(true);
    const weapon = twinBlade(M);
    rig.attachWeapon(weapon.obj, weapon.len);
    weapon.obj.traverse(c => { if (c.isMesh) meshes.push(c); });
    rig.root.scale.setScalar(1.25);
    rig.root.traverse(c => { if (c.isMesh) c.frustumCulled = false; });
    return { rig, fx, meshes, weapon, materials: M };
  }

  // ---- Wandering Wight 幽魂 (giant-headed ghost monk) -------------------------------------
  const WIGHT = { hipH: 0.62, spine: 0.09, chest: 0.16, neck: [0, 0.18, 0.05], head: [0, 0.03, 0.03], shoulder: [0.16, 0.15, 0], upper: 0.3, fore: 0.3, hipW: 0.08, thigh: 0.28, shin: 0.28 };
  function buildWight() {
    const rig = new Rig.Humanoid(WIGHT);
    const fx = makeFX();
    const M = {
      skin: std(fx, { color: 0x6a6c64, roughness: 0.72, bumpMap: skinBump(), bumpScale: 1.6 }),
      skinDark: std(fx, { color: 0x3e3c38, roughness: 0.8 }),
      robe: std(fx, { color: 0x6a6458, map: clothTex(), roughness: 0.95, side: THREE.DoubleSide }),
      robeDark: std(fx, { color: 0x4a443c, map: clothTex(), roughness: 0.95, side: THREE.DoubleSide }),
      beads: std(fx, { color: 0x2a1a12, roughness: 0.35, envMapIntensity: 1.2 }),
      crease: std(fx, { color: 0x2a2620, roughness: 0.9 }),
      red: std(fx, { color: 0x9a2018, roughness: 0.6 }),
      nail: std(fx, { color: 0x3a342a, roughness: 0.4 }),
    };
    const mb = new Rig.ModelBuilder(rig);
    // body
    mb.add('hips', ell(0.13, 0.1, 0.11), M.robe);
    mb.add('spine', ell(0.12, 0.12, 0.1), M.robe, [0, 0.07, 0.01]);
    mb.add('chest', ell(0.17, 0.15, 0.13), M.robe, [0, 0.08, 0.0]);
    mb.add('chest', ell(0.06, 0.11, 0.03), M.robeDark, [0, 0.12, 0.12], [0.2, 0, 0]);
    // huge sculpted head
    const HR = 0.62;
    const head = sculpt(HR, [
      { d: [0.3, 0.32, 0.9], a: 0.1, sx: 0.22, sy: 0.1 }, { d: [-0.3, 0.32, 0.9], a: 0.1, sx: 0.22, sy: 0.1 },   // brow
      { d: [0.28, 0.16, 0.95], a: -0.09, sx: 0.14, sy: 0.09 }, { d: [-0.28, 0.16, 0.95], a: -0.09, sx: 0.14, sy: 0.09 }, // sockets
      { d: [0.28, 0.13, 0.95], a: 0.03, sx: 0.1, sy: 0.04 }, { d: [-0.28, 0.13, 0.95], a: 0.03, sx: 0.1, sy: 0.04 }, // lids
      { d: [0, 0.05, 1], a: 0.18, sx: 0.09, sy: 0.17 },                                                           // nose
      { d: [0, -0.08, 1], a: 0.05, sx: 0.13, sy: 0.05 },                                                          // nostrils
      { d: [0.36, -0.12, 0.92], a: 0.06, sx: 0.18, sy: 0.15 }, { d: [-0.36, -0.12, 0.92], a: 0.06, sx: 0.18, sy: 0.15 }, // cheeks
      { d: [0, -0.27, 0.96], a: -0.06, sx: 0.24, sy: 0.035 },                                                     // mouth
      { d: [0, -0.35, 0.94], a: 0.03, sx: 0.2, sy: 0.05 },                                                        // lower lip
      { d: [0, -0.55, 0.83], a: 0.05, sx: 0.2, sy: 0.12 },                                                        // chin
      { d: [0, 0.62, 0.78], a: -0.018, sx: 0.4, sy: 0.02 }, { d: [0, 0.7, 0.7], a: -0.018, sx: 0.4, sy: 0.02 },   // forehead wrinkles
      { d: [0, 0.54, 0.84], a: -0.015, sx: 0.35, sy: 0.02 },
      { d: [0.95, 0.1, 0.1], a: -0.04, sx: 0.2, sy: 0.25 }, { d: [-0.95, 0.1, 0.1], a: -0.04, sx: 0.2, sy: 0.25 },  // temples
      { d: [0, -1, 0], a: -0.12, sx: 0.5, sy: 0.5 },                                                             // flat underside
    ], 56, 40, 0.012);
    mb.add('head', head, M.skin, [0, 0.52, 0.1]);
    for (const s of [-1, 1]) {
      mb.add('head', new THREE.TorusGeometry(0.1, 0.01, 6, 20, Math.PI * 0.7), M.crease, [s * 0.18, 0.61, 0.66], [0.25, s * 0.28, Math.PI * 1.15]);
      mb.add('head', ell(0.07, 0.15, 0.1), M.skin, [s * 0.6, 0.47, 0.12], [0, s * -0.3, s * 0.15]);     // ears
      mb.add('head', ell(0.035, 0.1, 0.05), M.skinDark, [s * 0.62, 0.47, 0.14], [0, s * -0.3, s * 0.15]);
    }
    mb.add('head', ell(0.028, 0.028, 0.015), M.red, [0, 0.8, 0.6], [0.6, 0, 0]);                  // urna
    mb.add('neck', cyl(0.07, 0.09, 0.16), M.skin, [0, 0.03, 0]);
    // beads
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      mb.add('chest', new THREE.SphereGeometry(0.045, 10, 8), M.beads, [Math.sin(a) * 0.2, 0.2 - (1 + Math.cos(a)) * 0.04, Math.cos(a) * 0.17 + 0.03]);
    }
    for (const S of ['L', 'R']) {
      mb.add('arm' + S, limb(0.3, 0.055, 0.04), M.robe);
      mb.add('arm' + S, cyl(0.06, 0.1, 0.22, 12, true), M.robeDark, [0, -0.16, 0]);
      mb.add('fore' + S, limb(0.3, 0.038, 0.032), M.skin);
      mb.add('hand' + S, ell(0.07, 0.085, 0.045), M.skin, [0, -0.06, 0.01]);
      for (let k = 0; k < 4; k++) {
        mb.add('hand' + S, limb(0.1, 0.014, 0.01, 6, 2), M.skin, [(k - 1.5) * 0.03, -0.13, 0.02], [0.3, 0, (k - 1.5) * 0.12]);
        mb.add('hand' + S, cone(0.01, 0.04, 4), M.nail, [(k - 1.5) * 0.034, -0.24, 0.05], [Math.PI - 0.3, 0, 0]);
      }
      mb.add('thigh' + S, limb(0.28, 0.06, 0.045), M.robe);
      mb.add('shin' + S, limb(0.28, 0.04, 0.032), M.skin);
      mb.add('foot' + S, ell(0.05, 0.03, 0.1), M.skin, [0, -0.025, 0.04]);
    }
    const panels = addPanels(mb, M.robe, 0.15, 0.3, 0.55, 0.08, 0.1);
    rig.post = panelDriver(rig, panels);
    const meshes = mb.build(true);
    rig.root.scale.setScalar(1.35);
    rig.root.traverse(c => { if (c.isMesh) c.frustumCulled = false; });
    return { rig, fx, meshes, weapon: null, materials: M };
  }

  return { buildMonkey, buildWolf, buildGuangzhi, buildWight, makeFX, fxify, MONKEY, WOLF, WIGHT, sunView };
})();
