// ---------------------------------------------------------------------------
// Animation library: poses, procedural locomotion, attack clips
// Conventions (character faces +Z, left = +X):
//   thigh/arm x < 0 swings forward; shin x > 0 bends knee; fore x < 0 bends elbow
//   spine/chest x > 0 leans forward; y > 0 twists to the left
//   weapon w: p = right-hand position in CHEST space, d = weapon axis (+Y end) in chest space,
//   g = hand position along the weapon axis, g2/w2 = left-hand grip & weight
// ---------------------------------------------------------------------------
const Anim = (() => {
  const O = Rig.JI;
  const { O_HP } = Rig;

  function poser(spec) {
    const footH = spec.hipH - spec.thigh - spec.shin - 0.03;
    const P = (desc = {}, base = null) => {
      const p = Rig.pose(desc, base);
      const hx = p[O.hips * 3];
      for (const S of ['L', 'R']) {
        const t = O['thigh' + S] * 3, s = O['shin' + S] * 3, f = O['foot' + S] * 3;
        if (!desc['foot' + S]) p[f] = -(hx + p[t] + p[s]) * 0.9;
      }
      if (!desc.hp && !desc.air) {
        const ext = S => {
          const t = O['thigh' + S] * 3, s = O['shin' + S] * 3;
          const a1 = hx + p[t], a2 = a1 + p[s], z = p[t + 2];
          return 0.03 * Math.cos(hx) + spec.thigh * Math.cos(a1) * Math.cos(z) + spec.shin * Math.cos(a2) * Math.cos(z) + footH;
        };
        p[O_HP + 1] = Math.max(ext('L'), ext('R')) - spec.hipH;
      }
      return p;
    };
    return P;
  }

  // ---- Procedural locomotion ---------------------------------------------------
  // out: pose array; base: stance pose (weapon carry etc.); phase: cycle radians
  // f/s: forward & lateral speed fractions (-1..1); run: 0 walk .. 1 run .. 1.6 sprint
  function locomotion(out, base, phase, f, s, run, spec, P) {
    out.set(base);
    const amp = U.clamp(Math.hypot(f, s), 0, 1);
    const sn = Math.sin(phase), cs = Math.cos(phase);
    const A = (0.42 + run * 0.28) * amp;
    const fd = amp > 0.01 ? f / Math.max(amp, 1e-3) : 1, sd = amp > 0.01 ? s / Math.max(amp, 1e-3) : 0;
    const lean = (0.08 + run * 0.2) * amp * fd;
    const set = (j, i, v) => { out[O[j] * 3 + i] += v; };
    // legs
    set('thighL', 0, -A * sn * fd); set('thighR', 0, A * sn * fd);
    set('thighL', 2, A * 0.55 * sn * sd); set('thighR', 2, -A * 0.55 * sn * sd);
    const kb = (0.25 + run * 0.55) * amp;
    set('shinL', 0, kb * Math.max(0, Math.sin(phase + 1.3)) * 1.6 + 0.08 * amp);
    set('shinR', 0, kb * Math.max(0, Math.sin(phase + 1.3 + Math.PI)) * 1.6 + 0.08 * amp);
    // torso
    set('hips', 1, 0.14 * sn * amp * fd); set('chest', 1, -0.2 * sn * amp * fd);
    set('hips', 2, -0.05 * cs * amp);
    set('spine', 0, lean); set('chest', 0, lean * 0.6); set('neck', 0, -lean * 0.8); set('head', 0, -lean * 0.4);
    // arms (left arm FK swing; right arm follows the weapon)
    set('armL', 0, (0.35 + run * 0.35) * sn * amp * fd); set('foreL', 0, -(0.3 + run * 0.6) * amp);
    // weapon bob
    out[Rig.O_W + 1] += Math.abs(cs) * 0.02 * amp; out[Rig.O_W + 2] += -sn * 0.03 * amp;
    // re-level feet & ground
    const hx = out[O.hips * 3];
    for (const S of ['L', 'R']) {
      const t = O['thigh' + S] * 3, sI = O['shin' + S] * 3, fI = O['foot' + S] * 3;
      out[fI] = -(hx + out[t] + out[sI]) * 0.85 + (S === 'L' ? Math.max(0, -sn) : Math.max(0, sn)) * 0.3 * amp * run;
    }
    const footH = spec.hipH - spec.thigh - spec.shin - 0.03;
    const ext = S => {
      const t = O['thigh' + S] * 3, sI = O['shin' + S] * 3;
      const a1 = hx + out[t], a2 = a1 + out[sI], z = out[t + 2];
      return 0.03 + spec.thigh * Math.cos(a1) * Math.cos(z) + spec.shin * Math.cos(a2) * Math.cos(z) + footH;
    };
    const ground = Math.max(ext('L'), ext('R')) - spec.hipH;
    out[O_HP + 1] = ground - Math.abs(sn) * 0.015 * amp + (run > 0.9 ? Math.max(0, cs * cs - 0.5) * 0.05 * amp : 0);
    return out;
  }

  // ---- Monkey (Destined One) ------------------------------------------------------
  const MP = poser(Models.MONKEY);
  const M = {};
  // stances
  M.idle = MP({
    hips: [0.06, 0.25, 0], spine: [0.14, -0.1, 0], chest: [0.14, -0.1, 0], neck: [-0.16, 0.05, 0], head: [-0.1, 0.12, 0],
    thighL: [-0.3, 0, 0.08], shinL: [0.42, 0, 0], thighR: [0.12, 0, -0.08], shinR: [0.3, 0, 0],
    armL: [0.05, 0, 0.22], foreL: [-0.55, 0, 0],
    w: { p: [-0.2, -0.04, 0.24], d: [-0.12, 0.75, -0.65], g: -0.55 }, tail: 0.2,
  });
  M.guard = MP({
    hips: [0.1, 0.35, 0], spine: [0.14, -0.15, 0], chest: [0.12, -0.2, 0], neck: [-0.18, 0.15, 0], head: [-0.08, 0.1, 0],
    thighL: [-0.45, 0, 0.12], shinL: [0.6, 0, 0], thighR: [0.2, 0, -0.12], shinR: [0.5, 0, 0],
    armL: [-0.4, 0, 0.3], foreL: [-1.0, 0, 0],
    w: { p: [-0.1, -0.06, 0.34], d: [0.45, 0.5, 0.75], g: -0.55, g2: -0.12, w2: 1 }, tail: 0.5,
  });
  M.carry = MP({
    spine: [0.12, 0, 0], chest: [0.08, 0, 0], neck: [-0.1, 0, 0],
    armL: [0, 0, 0.18], foreL: [-0.4, 0, 0],
    w: { p: [-0.26, -0.28, -0.02], d: [-0.12, -0.18, -1], g: -0.3 }, tail: 0.6,
  });
  M.sprintCarry = MP({
    spine: [0.3, 0, 0], chest: [0.2, 0, 0], neck: [-0.3, 0, 0], head: [-0.15, 0, 0],
    armL: [0, 0, 0.25], foreL: [-0.6, 0, 0],
    w: { p: [-0.3, -0.25, -0.12], d: [-0.2, -0.05, -1], g: -0.15 }, tail: 1,
  });

  // helpers for attack keyframes
  const K = (t, p, e) => [t, p, e];
  const legsLunge = { thighL: [-0.7, 0, 0.1], shinL: [0.75, 0, 0], thighR: [0.45, 0, -0.1], shinR: [0.35, 0, 0] };
  const legsSet = { thighL: [-0.4, 0, 0.12], shinL: [0.6, 0, 0], thighR: [0.25, 0, -0.12], shinR: [0.5, 0, 0] };

  // Light combo 1: horizontal sweep right -> left
  M.l1 = {
    dur: 0.62, cancel: 0.3, keys: [
      K(0, MP({ ...legsSet, hips: [0.1, -0.35, 0], spine: [0.1, -0.3, 0], chest: [0.05, -0.7, 0], head: [0, 0.5, 0], armL: [-0.3, 0, 0.5], foreL: [-0.8, 0, 0], w: { p: [-0.45, 0.14, -0.08], d: [-0.55, 0.35, -0.75], g: -0.95 } })),
      K(0.08, MP({ ...legsLunge, hips: [0.1, -0.1, 0], spine: [0.15, -0.1, 0], chest: [0.1, -0.3, 0], armL: [-0.2, 0, 0.6], foreL: [-0.7, 0, 0], w: { p: [-0.32, 0.06, 0.38], d: [-0.3, 0.06, 1], g: -0.95 } }), 'i'),
      K(0.16, MP({ ...legsLunge, hips: [0.12, 0.2, 0], spine: [0.15, 0.15, 0], chest: [0.12, 0.45, 0], armL: [0.1, 0, 0.7], foreL: [-0.5, 0, 0], w: { p: [0.12, 0.02, 0.44], d: [0.9, -0.04, 0.45], g: -0.95 } }), 'l'),
      K(0.28, MP({ ...legsLunge, hips: [0.12, 0.3, 0], spine: [0.15, 0.25, 0], chest: [0.12, 0.75, 0], armL: [0.2, 0, 0.6], foreL: [-0.5, 0, 0], w: { p: [0.3, 0.0, 0.2], d: [0.75, -0.15, -0.65], g: -0.95 } }), 'o'),
      K(0.62, M.guard, 'io'),
    ], hit: [0.07, 0.22], dmg: 24, poise: 10, move: [[0, 0.2, 3.2]], sfx: [[0.05, 'swing_light', 1.0]], trail: [0.03, 0.3],
  };
  // Light combo 2: backhand left -> right
  M.l2 = {
    dur: 0.62, cancel: 0.3, keys: [
      K(0, MP({ ...legsLunge, hips: [0.12, 0.35, 0], spine: [0.15, 0.25, 0], chest: [0.12, 0.8, 0], armL: [0.1, 0, 0.5], foreL: [-0.6, 0, 0], w: { p: [0.28, 0.08, 0.12], d: [0.7, 0.25, -0.7], g: -0.95 } })),
      K(0.08, MP({ ...legsSet, hips: [0.1, 0.1, 0], spine: [0.15, 0.1, 0], chest: [0.1, 0.25, 0], armL: [0, 0, 0.5], foreL: [-0.6, 0, 0], w: { p: [0.05, 0.08, 0.45], d: [0.35, 0.08, 1], g: -0.95 } }), 'i'),
      K(0.16, MP({ ...legsSet, thighR: [-0.5, 0, -0.1], shinR: [0.7, 0, 0], thighL: [0.35, 0, 0.1], shinL: [0.4, 0, 0], hips: [0.1, -0.25, 0], spine: [0.15, -0.2, 0], chest: [0.1, -0.5, 0], armL: [-0.3, 0, 0.8], foreL: [-0.4, 0, 0], w: { p: [-0.36, 0.02, 0.36], d: [-0.95, 0.0, 0.3], g: -0.95 } }), 'l'),
      K(0.3, MP({ ...legsSet, thighR: [-0.5, 0, -0.1], shinR: [0.7, 0, 0], thighL: [0.35, 0, 0.1], shinL: [0.4, 0, 0], hips: [0.1, -0.35, 0], spine: [0.15, -0.3, 0], chest: [0.1, -0.8, 0], armL: [-0.4, 0, 0.8], foreL: [-0.4, 0, 0], w: { p: [-0.42, 0.0, 0.02], d: [-0.7, -0.2, -0.7], g: -0.95 } }), 'o'),
      K(0.62, M.guard, 'io'),
    ], hit: [0.07, 0.22], dmg: 26, poise: 10, move: [[0, 0.2, 3.0]], sfx: [[0.05, 'swing_light', 0.92]], trail: [0.03, 0.3],
  };
  // Light combo 3: two-handed overhead chop
  M.l3 = {
    dur: 0.7, cancel: 0.36, keys: [
      K(0, MP({ ...legsSet, hips: [-0.05, -0.2, 0], spine: [-0.15, -0.1, 0], chest: [-0.25, -0.25, 0], neck: [0.1, 0, 0], armL: [-2.2, 0, 0.3], foreL: [-1, 0, 0], w: { p: [-0.12, 0.42, 0.05], d: [0.1, 0.55, -0.85], g: -0.85, g2: -0.45, w2: 1 } })),
      K(0.11, MP({ ...legsLunge, hips: [0.05, 0, 0], spine: [0.05, 0, 0], chest: [0.0, -0.05, 0], armL: [-2.2, 0, 0.3], foreL: [-1, 0, 0], w: { p: [-0.05, 0.35, 0.32], d: [0.05, 0.85, 0.55], g: -0.85, g2: -0.45, w2: 1 } }), 'i'),
      K(0.19, MP({ ...legsLunge, thighL: [-0.9, 0, 0.1], shinL: [1.0, 0, 0], hips: [0.25, 0, 0], spine: [0.3, 0, 0], chest: [0.4, 0, 0], neck: [-0.4, 0, 0], armL: [-1.2, 0, 0.2], foreL: [-0.4, 0, 0], w: { p: [0.0, -0.05, 0.45], d: [0.04, -0.33, 1], g: -0.85, g2: -0.45, w2: 1 } }), 'l'),
      K(0.36, MP({ ...legsLunge, thighL: [-0.9, 0, 0.1], shinL: [1.0, 0, 0], hips: [0.25, 0, 0], spine: [0.3, 0, 0], chest: [0.35, 0, 0], neck: [-0.4, 0, 0], armL: [-1.2, 0, 0.2], foreL: [-0.4, 0, 0], w: { p: [0.0, -0.07, 0.42], d: [0.04, -0.36, 1], g: -0.85, g2: -0.45, w2: 1 } }), 'o'),
      K(0.7, M.guard, 'io'),
    ], hit: [0.1, 0.22], dmg: 32, poise: 18, move: [[0, 0.2, 3.5]], sfx: [[0.07, 'swing_light', 0.8]], trail: [0.06, 0.28], shake: 0.25,
  };
  // Light combo 4: staff twirl (propeller) - multi hit
  {
    const keys = [K(0, MP({ ...legsSet, hips: [0.1, 0, 0], spine: [0.12, 0, 0], chest: [0.1, 0, 0], armL: [-0.6, 0, 0.6], foreL: [-0.8, 0, 0], w: { p: [-0.08, 0.1, 0.42], d: [1, 0.05, 0.3], g: 0 } }))];
    const dirs = [[0, 1, 0.3], [-1, 0.05, 0.3], [0, -1, 0.3], [1, 0.05, 0.3]];
    let t = 0.05;
    for (let i = 0; i < 9; i++) {
      const d = dirs[i % 4];
      keys.push(K(t, MP({ ...(i % 2 ? legsLunge : legsSet), hips: [0.12, 0, 0], spine: [0.14, 0, 0], chest: [0.12, (i % 2 ? 0.1 : -0.1), 0], armL: [-0.6, 0, 0.6], foreL: [-0.8, 0, 0], w: { p: [-0.06 + (i % 2 ? 0.04 : 0), 0.1, 0.44], d, g: 0 } }), 'l'));
      t += 0.055;
    }
    keys.push(K(0.8, M.guard, 'io'));
    M.l4 = { dur: 0.8, cancel: 0.52, keys, hit: [0.05, 0.5], multi: 0.13, dmg: 11, poise: 5, move: [[0, 0.5, 2.0]], sfx: [[0.04, 'swing_light', 1.2], [0.2, 'swing_light', 1.25], [0.36, 'swing_light', 1.3]], trail: [0.03, 0.5] };
  }
  // Light combo 5: leaping overhead smash (finisher)
  M.l5 = {
    dur: 1.05, cancel: 0.8, keys: [
      K(0, MP({ thighL: [-0.9, 0, 0.12], shinL: [1.4, 0, 0], thighR: [0.1, 0, -0.12], shinR: [1.3, 0, 0], hips: [0.25, -0.3, 0], spine: [0.2, -0.2, 0], chest: [0.1, -0.4, 0], armL: [-0.5, 0, 0.5], foreL: [-1, 0, 0], w: { p: [-0.35, 0.05, -0.12], d: [-0.3, 0.3, -0.9], g: -0.9, g2: -0.5, w2: 0.6 } })),
      K(0.2, MP({ air: 1, hp: [0, 0.45, 0], thighL: [-1.2, 0, 0.1], shinL: [1.6, 0, 0], thighR: [-0.4, 0, -0.1], shinR: [1.2, 0, 0], hips: [-0.1, 0, 0], spine: [-0.2, 0, 0], chest: [-0.35, 0, 0], neck: [0.2, 0, 0], armL: [-2.6, 0, 0.3], foreL: [-0.8, 0, 0], w: { p: [-0.05, 0.5, -0.05], d: [0.05, 0.3, -1], g: -0.9, g2: -0.5, w2: 1 } }), 'o'),
      K(0.36, MP({ air: 1, hp: [0, 0.62, 0], thighL: [-1.3, 0, 0.1], shinL: [1.8, 0, 0], thighR: [-0.9, 0, -0.1], shinR: [1.7, 0, 0], hips: [-0.1, 0, 0], spine: [-0.25, 0, 0], chest: [-0.4, 0, 0], neck: [0.25, 0, 0], armL: [-2.8, 0, 0.3], foreL: [-0.6, 0, 0], w: { p: [0.0, 0.55, 0.1], d: [0.02, 1, -0.15], g: -0.9, g2: -0.5, w2: 1 } }), 'o'),
      K(0.46, MP({ ...legsLunge, thighL: [-1.1, 0, 0.12], shinL: [1.5, 0, 0], thighR: [0.2, 0, -0.12], shinR: [1.3, 0, 0], hips: [0.4, 0, 0], spine: [0.4, 0, 0], chest: [0.55, 0, 0], neck: [-0.55, 0, 0], armL: [-1.3, 0, 0.2], foreL: [-0.3, 0, 0], w: { p: [0.0, -0.06, 0.46], d: [0.02, -0.36, 1], g: -0.9, g2: -0.5, w2: 1 } }), 'i'),
      K(0.78, MP({ ...legsLunge, thighL: [-1.1, 0, 0.12], shinL: [1.5, 0, 0], thighR: [0.2, 0, -0.12], shinR: [1.3, 0, 0], hips: [0.38, 0, 0], spine: [0.38, 0, 0], chest: [0.5, 0, 0], neck: [-0.5, 0, 0], armL: [-1.3, 0, 0.2], foreL: [-0.3, 0, 0], w: { p: [0.0, -0.08, 0.44], d: [0.02, -0.38, 1], g: -0.9, g2: -0.5, w2: 1 } })),
      K(1.05, M.guard, 'io'),
    ], hit: [0.4, 0.5], dmg: 55, poise: 35, move: [[0.08, 0.45, 5.5]], sfx: [[0.3, 'swing_heavy', 1.0]], trail: [0.3, 0.5], aoe: { t: 0.46, r: 3.2, dmg: 30 }, shake: 0.6, big: true,
  };

  // Heavy (charged smash)
  M.charge = MP({
    thighL: [-0.7, 0, 0.18], shinL: [1.0, 0, 0], thighR: [0.35, 0, -0.18], shinR: [0.9, 0, 0],
    hips: [0.1, -0.4, 0], spine: [-0.05, -0.2, 0], chest: [-0.2, -0.35, 0], neck: [0.05, 0.4, 0], head: [0, 0.2, 0],
    armL: [-2.4, 0, 0.3], foreL: [-1.0, 0, 0],
    w: { p: [-0.1, 0.44, -0.08], d: [0.05, 0.5, -0.9], g: -0.95, g2: -0.52, w2: 1 }, tail: 1,
  });
  M.heavy = {
    dur: 0.95, cancel: 0.7, keys: [
      K(0, M.charge),
      K(0.1, MP({ ...legsLunge, hips: [0.05, 0, 0], spine: [0, 0, 0], chest: [-0.1, 0, 0], armL: [-2.4, 0, 0.3], foreL: [-0.9, 0, 0], w: { p: [-0.02, 0.45, 0.3], d: [0.02, 0.8, 0.6], g: -0.95, g2: -0.52, w2: 1 } }), 'i'),
      K(0.18, MP({ ...legsLunge, thighL: [-1.0, 0, 0.12], shinL: [1.1, 0, 0], hips: [0.35, 0, 0], spine: [0.35, 0, 0], chest: [0.5, 0, 0], neck: [-0.5, 0, 0], armL: [-1.3, 0, 0.2], foreL: [-0.3, 0, 0], w: { p: [0.0, -0.05, 0.48], d: [0.02, -0.36, 1], g: -0.95, g2: -0.52, w2: 1 } }), 'l'),
      K(0.55, MP({ ...legsLunge, thighL: [-1.0, 0, 0.12], shinL: [1.1, 0, 0], hips: [0.33, 0, 0], spine: [0.33, 0, 0], chest: [0.45, 0, 0], neck: [-0.45, 0, 0], armL: [-1.3, 0, 0.2], foreL: [-0.3, 0, 0], w: { p: [0.0, -0.07, 0.46], d: [0.02, -0.38, 1], g: -0.95, g2: -0.52, w2: 1 } })),
      K(0.95, M.guard, 'io'),
    ], hit: [0.1, 0.22], dmg: 40, poise: 40, move: [[0, 0.18, 4.0]], sfx: [[0.04, 'swing_heavy', 1]], trail: [0.02, 0.24], aoe: { t: 0.18, r: 2.2, dmg: 0 }, shake: 0.5, big: true,
  };

  // Dodge (low dash)
  M.dodge = {
    dur: 0.46, cancel: 0.3, keys: [
      K(0, MP({ thighL: [-0.8, 0, 0.1], shinL: [1.2, 0, 0], thighR: [0.4, 0, -0.1], shinR: [1.1, 0, 0], hips: [0.3, 0, 0], spine: [0.45, 0, 0], chest: [0.3, 0, 0], neck: [-0.5, 0, 0], armL: [0.6, 0, 0.5], foreL: [-0.8, 0, 0], w: { p: [-0.3, -0.3, -0.1], d: [-0.15, -0.3, -1], g: -0.2 }, tail: 1 })),
      K(0.16, MP({ thighL: [-1.2, 0, 0.1], shinL: [1.7, 0, 0], thighR: [0.2, 0, -0.1], shinR: [1.8, 0, 0], hips: [0.5, 0, 0], spine: [0.55, 0, 0], chest: [0.35, 0, 0], neck: [-0.6, 0, 0], armL: [0.8, 0, 0.6], foreL: [-1.0, 0, 0], w: { p: [-0.3, -0.32, -0.1], d: [-0.15, -0.3, -1], g: -0.2 }, tail: 1 }), 'o'),
      K(0.46, M.guard, 'io'),
    ], iframes: [0.02, 0.32], move: [[0, 0.3, 11]],
  };

  // Hit reactions
  M.hit = {
    dur: 0.42, cancel: 0.36, keys: [
      K(0, M.guard),
      K(0.07, MP({ ...legsSet, hips: [-0.15, 0.3, 0.1], spine: [-0.25, 0, 0.1], chest: [-0.3, 0.2, 0.1], neck: [0.3, 0, 0], head: [0.3, 0.3, 0], armL: [-0.6, 0, 0.9], foreL: [-0.4, 0, 0], w: { p: [-0.35, 0.05, 0.2], d: [0.2, 0.9, 0.3], g: -0.5 } }), 'o'),
      K(0.42, M.guard, 'io'),
    ], move: [[0, 0.15, -3]],
  };
  M.knockdown = {
    dur: 1.5, cancel: 1.35, keys: [
      K(0, M.guard),
      K(0.12, MP({ air: 1, hp: [0, 0.1, -0.2], thighL: [-0.9, 0, 0.2], shinL: [0.8, 0, 0], thighR: [-0.6, 0, -0.2], shinR: [0.6, 0, 0], hips: [-0.8, 0, 0], spine: [-0.3, 0, 0], chest: [-0.2, 0, 0], neck: [0.3, 0, 0], armL: [-0.3, 0, 1.2], foreL: [-0.4, 0, 0], w: { p: [-0.4, 0.2, 0.0], d: [-0.6, 0.6, 0.5], g: -0.3 } }), 'o'),
      K(0.45, MP({ air: 1, hp: [0, -0.72, -0.35], thighL: [-1.2, 0, 0.3], shinL: [1.2, 0, 0], thighR: [-0.8, 0, -0.2], shinR: [0.9, 0, 0], hips: [-1.45, 0, 0], spine: [-0.1, 0, 0], chest: [-0.1, 0, 0], neck: [0.2, 0, 0], armL: [-0.2, 0, 1.4], foreL: [-0.2, 0, 0], w: { p: [-0.45, 0.1, 0.0], d: [-0.8, 0.2, 0.5], g: -0.3 } }), 'i'),
      K(0.9, MP({ air: 1, hp: [0, -0.7, -0.35], thighL: [-1.4, 0, 0.3], shinL: [1.6, 0, 0], thighR: [-0.9, 0, -0.2], shinR: [1.2, 0, 0], hips: [-1.35, 0, 0], spine: [0, 0, 0], chest: [0.1, 0, 0], neck: [0.1, 0, 0], armL: [-0.2, 0, 1.2], foreL: [-0.4, 0, 0], w: { p: [-0.45, 0.1, 0.0], d: [-0.8, 0.2, 0.5], g: -0.3 } })),
      K(1.2, MP({ thighL: [-1.4, 0, 0.1], shinL: [2.2, 0, 0], thighR: [0.3, 0, -0.1], shinR: [1.9, 0, 0], hips: [0.4, 0, 0], spine: [0.4, 0, 0], chest: [0.2, 0, 0], neck: [-0.4, 0, 0], armL: [0.2, 0, 0.4], foreL: [-0.6, 0, 0], w: { p: [-0.3, -0.3, 0.1], d: [0.1, 0.9, 0.3], g: -0.8 } }), 'o'),
      K(1.5, M.guard, 'io'),
    ], move: [[0, 0.4, -5.5]], iframes: [0.0, 1.3],
  };
  // Gourd drink
  M.drink = {
    dur: 1.25, cancel: 1.1, keys: [
      K(0, M.idle),
      K(0.25, MP({ hips: [0.05, 0.2, 0], spine: [0.05, 0, 0], chest: [-0.05, 0, 0], neck: [-0.35, 0, 0], head: [-0.3, 0, 0], armL: [-1.9, 0.3, 0.25], foreL: [-2.3, 0, 0], thighL: [-0.2, 0, 0.08], shinL: [0.3, 0, 0], thighR: [0.1, 0, -0.08], shinR: [0.25, 0, 0], w: { p: [-0.2, -0.04, 0.24], d: [-0.12, 0.75, -0.65], g: -0.55 } }), 'io'),
      K(0.85, MP({ hips: [0.05, 0.2, 0], spine: [0.0, 0, 0], chest: [-0.1, 0, 0], neck: [-0.45, 0, 0], head: [-0.35, 0, 0], armL: [-2.1, 0.3, 0.2], foreL: [-2.4, 0, 0], thighL: [-0.2, 0, 0.08], shinL: [0.3, 0, 0], thighR: [0.1, 0, -0.08], shinR: [0.25, 0, 0], w: { p: [-0.2, -0.04, 0.24], d: [-0.12, 0.75, -0.65], g: -0.55 } })),
      K(1.25, M.idle, 'io'),
    ], sfx: [[0.3, 'gourd', 1]],
  };
  // Spell casts
  M.castPoint = {
    dur: 0.6, cancel: 0.42, keys: [
      K(0, M.guard),
      K(0.12, MP({ ...legsSet, hips: [0.1, 0.4, 0], spine: [0.1, 0.2, 0], chest: [0.05, 0.4, 0], neck: [-0.1, -0.4, 0], head: [0, -0.3, 0], armL: [-1.45, -0.2, 0.15], foreL: [-0.15, 0, 0], w: { p: [-0.35, -0.1, -0.05], d: [-0.3, -0.4, -1], g: -0.4 } }), 'o'),
      K(0.4, MP({ ...legsSet, hips: [0.1, 0.4, 0], spine: [0.1, 0.2, 0], chest: [0.05, 0.4, 0], neck: [-0.1, -0.4, 0], head: [0, -0.3, 0], armL: [-1.5, -0.2, 0.15], foreL: [-0.1, 0, 0], w: { p: [-0.35, -0.1, -0.05], d: [-0.3, -0.4, -1], g: -0.4 } })),
      K(0.6, M.guard, 'io'),
    ],
  };
  M.castBlow = {
    dur: 0.8, cancel: 0.6, keys: [
      K(0, M.guard),
      K(0.18, MP({ ...legsSet, hips: [0.05, 0.2, 0], spine: [0.0, 0, 0], chest: [-0.1, 0.1, 0], neck: [-0.2, 0, 0], head: [0, 0, 0], armL: [-1.7, 0.2, -0.3], foreL: [-2.4, 0, 0], w: { p: [-0.3, -0.15, 0.1], d: [0.1, 0.95, 0.2], g: -0.6 } }), 'io'),
      K(0.36, MP({ ...legsLunge, hips: [0.15, 0.1, 0], spine: [0.2, 0, 0], chest: [0.2, 0, 0], neck: [-0.25, 0, 0], head: [0, 0, 0], armL: [-1.3, 0, 0.9], foreL: [-0.3, 0, 0], w: { p: [-0.3, -0.15, 0.1], d: [0.1, 0.95, 0.2], g: -0.6 } }), 'o'),
      K(0.8, M.guard, 'io'),
    ],
  };
  M.rockSolid = {
    dur: 0.85, cancel: 0.8, keys: [
      K(0, M.guard),
      K(0.08, MP({ thighL: [-0.6, 0, 0.35], shinL: [0.9, 0, 0], thighR: [0.3, 0, -0.35], shinR: [0.8, 0, 0], hips: [0.15, 0, 0], spine: [0.15, 0, 0], chest: [0.1, 0, 0], neck: [-0.2, 0, 0], armL: [-0.6, 0, 0.6], foreL: [-1.2, 0, 0], w: { p: [-0.22, 0.14, 0.36], d: [1, 0.08, 0.15], g: -0.35, g2: 0.3, w2: 1 } }), 'o'),
      K(0.65, MP({ thighL: [-0.6, 0, 0.35], shinL: [0.9, 0, 0], thighR: [0.3, 0, -0.35], shinR: [0.8, 0, 0], hips: [0.15, 0, 0], spine: [0.15, 0, 0], chest: [0.1, 0, 0], neck: [-0.2, 0, 0], armL: [-0.6, 0, 0.6], foreL: [-1.2, 0, 0], w: { p: [-0.22, 0.14, 0.36], d: [1, 0.08, 0.15], g: -0.35, g2: 0.3, w2: 1 } })),
      K(0.85, M.guard, 'io'),
    ],
  };
  M.counter = {
    ...M.l1, dur: 0.7, cancel: 0.45, dmg: 70, poise: 60, move: [[0, 0.2, 4]], sfx: [[0.03, 'swing_heavy', 1.1]], shake: 0.5, big: true,
  };
  M.rest = {
    dur: 1.6, cancel: 1.6, keys: [
      K(0, M.idle),
      K(0.5, MP({ thighL: [-1.5, 0, 0.3], shinL: [2.5, 0, 0], thighR: [0.2, 0, -0.1], shinR: [2.4, 0, 0], hips: [0.1, 0, 0], spine: [0.15, 0, 0], chest: [0.15, 0, 0], neck: [0.2, 0, 0], head: [0.2, 0, 0], armL: [-0.9, 0, -0.1], foreL: [-1.4, 0, 0], w: { p: [-0.06, -0.08, 0.3], d: [0.02, 1, 0.05], g: 0.2 } }), 'io'),
      K(1.2, MP({ thighL: [-1.5, 0, 0.3], shinL: [2.5, 0, 0], thighR: [0.2, 0, -0.1], shinR: [2.4, 0, 0], hips: [0.1, 0, 0], spine: [0.15, 0, 0], chest: [0.15, 0, 0], neck: [0.25, 0, 0], head: [0.25, 0, 0], armL: [-0.9, 0, -0.1], foreL: [-1.4, 0, 0], w: { p: [-0.06, -0.08, 0.3], d: [0.02, 1, 0.05], g: 0.2 } })),
      K(1.6, M.idle, 'io'),
    ],
  };
  M.death = {
    dur: 2.0, cancel: 99, keys: [
      K(0, M.guard),
      K(0.3, MP({ thighL: [-1.4, 0, 0.1], shinL: [2.4, 0, 0], thighR: [-0.1, 0, -0.1], shinR: [2.3, 0, 0], hips: [0.3, 0, 0], spine: [0.4, 0, 0], chest: [0.3, 0, 0], neck: [0.3, 0, 0], armL: [0.3, 0, 0.2], foreL: [-0.2, 0, 0], w: { p: [-0.35, -0.35, 0.2], d: [-0.3, -0.5, 1], g: -0.3 } }), 'o'),
      K(1.0, MP({ air: 1, hp: [0, -0.75, 0.25], thighL: [-0.3, 0, 0.1], shinL: [0.4, 0, 0], thighR: [-0.1, 0, -0.1], shinR: [0.3, 0, 0], hips: [1.45, 0, 0.1], spine: [0.1, 0, 0], chest: [0.0, 0, 0], neck: [-0.3, 0.6, 0], armL: [-2.6, 0, 0.3], foreL: [-0.2, 0, 0], w: { p: [-0.4, 0.3, 0.1], d: [-0.8, 0.5, 0.2], g: -0.3 } }), 'i'),
      K(2.0, MP({ air: 1, hp: [0, -0.78, 0.25], thighL: [-0.3, 0, 0.1], shinL: [0.4, 0, 0], thighR: [-0.1, 0, -0.1], shinR: [0.3, 0, 0], hips: [1.5, 0, 0.1], spine: [0.1, 0, 0], chest: [0.0, 0, 0], neck: [-0.3, 0.6, 0], armL: [-2.6, 0, 0.3], foreL: [-0.2, 0, 0], w: { p: [-0.4, 0.3, 0.1], d: [-0.8, 0.5, 0.2], g: -0.3 } })),
    ],
  };

  // ---- Wolves (saber scout / glaive guard) --------------------------------------------
  const WP = poser(Models.WOLF);
  const W = {};
  W.idle = WP({
    hips: [0.15, 0.2, 0], spine: [0.25, -0.05, 0], chest: [0.2, -0.1, 0], neck: [-0.3, 0, 0], head: [-0.15, 0, 0],
    thighL: [-0.45, 0, 0.12], shinL: [0.85, 0, 0], thighR: [0.1, 0, -0.12], shinR: [0.75, 0, 0],
    armL: [-0.3, 0, 0.35], foreL: [-0.7, 0, 0],
    w: { p: [-0.3, -0.2, 0.25], d: [0.1, 0.35, 1], g: 0 }, tail: 0.3,
  });
  W.carry = WP({
    spine: [0.2, 0, 0], chest: [0.1, 0, 0], neck: [-0.25, 0, 0], armL: [0, 0, 0.2], foreL: [-0.5, 0, 0],
    w: { p: [-0.3, -0.3, 0.12], d: [-0.1, -0.2, 1], g: 0 }, tail: 0.5,
  });
  const wLegA = { thighL: [-0.6, 0, 0.12], shinL: [0.9, 0, 0], thighR: [0.35, 0, -0.12], shinR: [0.7, 0, 0] };
  const wLegB = { thighL: [-0.9, 0, 0.12], shinL: [1.0, 0, 0], thighR: [0.5, 0, -0.12], shinR: [0.5, 0, 0] };
  W.slash = {
    dur: 1.25, keys: [
      K(0, W.idle),
      K(0.5, WP({ ...wLegA, hips: [0.05, -0.4, 0], spine: [0.05, -0.3, 0], chest: [-0.15, -0.6, 0], neck: [-0.1, 0.6, 0], armL: [-0.6, 0, 0.6], foreL: [-0.8, 0, 0], w: { p: [-0.38, 0.45, -0.12], d: [-0.3, 0.6, -0.75], g: 0 }, jaw: 0.4 }), 'io'),
      K(0.64, WP({ ...wLegB, hips: [0.25, 0.15, 0], spine: [0.3, 0.1, 0], chest: [0.3, 0.4, 0], neck: [-0.4, -0.3, 0], armL: [0.2, 0, 0.5], foreL: [-0.5, 0, 0], w: { p: [0.1, -0.15, 0.45], d: [0.6, -0.55, 0.6], g: 0 }, jaw: 0.5 }), 'i'),
      K(0.9, WP({ ...wLegB, hips: [0.25, 0.2, 0], spine: [0.3, 0.1, 0], chest: [0.3, 0.5, 0], neck: [-0.4, -0.3, 0], armL: [0.2, 0, 0.5], foreL: [-0.5, 0, 0], w: { p: [0.2, -0.25, 0.35], d: [0.7, -0.6, 0.2], g: 0 }, jaw: 0.2 }), 'o'),
      K(1.25, W.idle, 'io'),
    ], hit: [0.54, 0.72], dmg: 55, move: [[0.5, 0.7, 4.5]], sfx: [[0.52, 'swing_blade', 1], [0.2, 'wolf_growl', 1]], trail: [0.5, 0.75], track: 0.5,
  };
  W.combo = {
    dur: 1.7, keys: [
      K(0, W.idle),
      K(0.42, WP({ ...wLegA, hips: [0.1, 0.4, 0], spine: [0.1, 0.3, 0], chest: [0.05, 0.7, 0], armL: [-0.2, 0, 0.4], foreL: [-0.9, 0, 0], w: { p: [0.2, 0.2, 0.05], d: [0.8, 0.3, -0.5], g: 0 }, jaw: 0.3 }), 'io'),
      K(0.54, WP({ ...wLegB, hips: [0.2, -0.1, 0], spine: [0.25, -0.1, 0], chest: [0.2, -0.3, 0], armL: [-0.2, 0, 0.5], foreL: [-0.6, 0, 0], w: { p: [-0.25, 0.05, 0.45], d: [-0.9, -0.1, 0.4], g: 0 }, jaw: 0.5 }), 'i'),
      K(0.74, WP({ ...wLegB, hips: [0.2, -0.2, 0], spine: [0.25, -0.2, 0], chest: [0.1, -0.6, 0], armL: [-0.2, 0, 0.5], foreL: [-0.6, 0, 0], w: { p: [-0.4, 0.2, 0.1], d: [-0.6, 0.5, -0.6], g: 0 } }), 'o'),
      K(1.02, WP({ ...wLegA, thighR: [-0.8, 0, -0.12], shinR: [1.0, 0, 0], thighL: [0.4, 0, 0.12], shinL: [0.6, 0, 0], hips: [0.3, 0.1, 0], spine: [0.3, 0.1, 0], chest: [0.35, 0.4, 0], armL: [0.2, 0, 0.5], foreL: [-0.5, 0, 0], w: { p: [0.1, -0.2, 0.45], d: [0.55, -0.6, 0.6], g: 0 }, jaw: 0.5 }), 'i'),
      K(1.3, WP({ ...wLegA, hips: [0.25, 0.1, 0], spine: [0.3, 0.1, 0], chest: [0.3, 0.4, 0], armL: [0.2, 0, 0.5], foreL: [-0.5, 0, 0], w: { p: [0.2, -0.25, 0.3], d: [0.6, -0.7, 0.2], g: 0 } }), 'o'),
      K(1.7, W.idle, 'io'),
    ], hits: [[0.44, 0.6, 40], [0.9, 1.08, 50]], move: [[0.42, 0.6, 3], [0.9, 1.05, 3.5]], sfx: [[0.45, 'swing_blade', 1.1], [0.92, 'swing_blade', 0.95]], trail: [0.42, 1.12], track: 0.42,
  };
  W.lunge = {
    dur: 1.5, keys: [
      K(0, W.idle),
      K(0.55, WP({ thighL: [-0.9, 0, 0.12], shinL: [1.5, 0, 0], thighR: [0.4, 0, -0.12], shinR: [1.4, 0, 0], hips: [0.4, 0, 0], spine: [0.3, 0, 0], chest: [0.1, -0.3, 0], neck: [-0.5, 0.3, 0], armL: [-0.8, 0, 0.5], foreL: [-0.6, 0, 0], w: { p: [-0.32, 0.0, -0.18], d: [-0.05, 0.1, 1], g: 0 }, jaw: 0.6 }), 'io'),
      K(0.72, WP({ thighL: [-1.2, 0, 0.12], shinL: [0.8, 0, 0], thighR: [0.9, 0, -0.12], shinR: [0.2, 0, 0], hips: [0.45, 0, 0], spine: [0.35, 0, 0], chest: [0.3, 0.2, 0], neck: [-0.6, -0.1, 0], armL: [0.8, 0, 0.3], foreL: [-0.2, 0, 0], w: { p: [-0.12, 0.05, 0.56], d: [0.05, 0.05, 1], g: 0 }, jaw: 0.6 }), 'i'),
      K(1.0, WP({ thighL: [-1.2, 0, 0.12], shinL: [0.9, 0, 0], thighR: [0.8, 0, -0.12], shinR: [0.3, 0, 0], hips: [0.4, 0, 0], spine: [0.3, 0, 0], chest: [0.25, 0.2, 0], neck: [-0.5, -0.1, 0], armL: [0.6, 0, 0.3], foreL: [-0.3, 0, 0], w: { p: [-0.12, 0.0, 0.52], d: [0.05, 0.0, 1], g: 0 } })),
      K(1.5, W.idle, 'io'),
    ], hit: [0.62, 0.82], dmg: 60, move: [[0.58, 0.8, 11]], sfx: [[0.58, 'swing_blade', 0.85], [0.1, 'wolf_growl', 0.9]], track: 0.55,
  };
  // glaive guard
  W.gIdle = WP({
    hips: [0.1, 0.4, 0], spine: [0.2, -0.1, 0], chest: [0.15, -0.3, 0], neck: [-0.25, 0.3, 0], head: [-0.1, 0.1, 0],
    thighL: [-0.45, 0, 0.14], shinL: [0.8, 0, 0], thighR: [0.2, 0, -0.14], shinR: [0.7, 0, 0],
    armL: [-0.6, 0, 0.3], foreL: [-1.0, 0, 0],
    w: { p: [-0.25, -0.12, 0.2], d: [0.2, 0.55, 0.8], g: -0.3, g2: 0.15, w2: 1 }, tail: 0.3,
  });
  W.gCarry = WP({
    spine: [0.2, 0, 0], chest: [0.1, 0, 0], neck: [-0.25, 0, 0], armL: [0, 0, 0.2], foreL: [-0.5, 0, 0],
    w: { p: [-0.3, -0.25, 0.1], d: [0.05, 0.6, 0.8], g: -0.3 }, tail: 0.5,
  });
  W.sweep = {
    dur: 1.6, keys: [
      K(0, W.gIdle),
      K(0.6, WP({ ...wLegA, hips: [0.1, -0.5, 0], spine: [0.1, -0.3, 0], chest: [0.05, -0.8, 0], neck: [-0.2, 0.7, 0], armL: [-0.8, 0, 0.5], foreL: [-1.0, 0, 0], w: { p: [-0.42, 0.08, -0.1], d: [-0.6, 0.15, -0.8], g: -0.3, g2: 0.15, w2: 1 }, jaw: 0.4 }), 'io'),
      K(0.78, WP({ ...wLegB, hips: [0.2, 0.1, 0], spine: [0.25, 0.1, 0], chest: [0.2, 0.3, 0], armL: [-0.8, 0, 0.5], foreL: [-0.6, 0, 0], w: { p: [-0.1, 0.0, 0.46], d: [0.1, -0.05, 1], g: -0.3, g2: 0.15, w2: 1 }, jaw: 0.5 }), 'i'),
      K(0.95, WP({ ...wLegB, hips: [0.2, 0.35, 0], spine: [0.25, 0.25, 0], chest: [0.2, 0.8, 0], armL: [-0.6, 0, 0.5], foreL: [-0.6, 0, 0], w: { p: [0.25, -0.02, 0.3], d: [0.95, -0.05, -0.2], g: -0.3, g2: 0.15, w2: 1 } }), 'l'),
      K(1.2, WP({ ...wLegA, hips: [0.15, 0.4, 0], spine: [0.2, 0.3, 0], chest: [0.15, 0.9, 0], armL: [-0.5, 0, 0.5], foreL: [-0.7, 0, 0], w: { p: [0.3, -0.05, 0.1], d: [0.6, -0.1, -0.8], g: -0.3, g2: 0.15, w2: 1 } }), 'o'),
      K(1.6, W.gIdle, 'io'),
    ], hit: [0.7, 0.98], dmg: 65, move: [[0.6, 0.9, 3]], sfx: [[0.7, 'swing_heavy', 0.9], [0.25, 'wolf_growl', 0.8]], trail: [0.66, 1.0], track: 0.6,
  };
  W.slam = {
    dur: 1.8, keys: [
      K(0, W.gIdle),
      K(0.7, WP({ ...wLegA, hips: [-0.05, -0.2, 0], spine: [-0.15, -0.1, 0], chest: [-0.3, -0.2, 0], neck: [0.1, 0.2, 0], armL: [-2.5, 0, 0.3], foreL: [-0.8, 0, 0], w: { p: [-0.12, 0.48, -0.02], d: [0.05, 0.55, -0.85], g: -0.3, g2: 0.1, w2: 1 }, jaw: 0.6 }), 'io'),
      K(0.86, WP({ ...wLegB, hips: [0.35, 0, 0], spine: [0.35, 0, 0], chest: [0.45, 0, 0], neck: [-0.5, 0, 0], armL: [-1.2, 0, 0.2], foreL: [-0.3, 0, 0], w: { p: [0.0, -0.05, 0.5], d: [0.03, -0.5, 1], g: -0.3, g2: 0.1, w2: 1 }, jaw: 0.6 }), 'i'),
      K(1.3, WP({ ...wLegB, hips: [0.33, 0, 0], spine: [0.33, 0, 0], chest: [0.42, 0, 0], neck: [-0.45, 0, 0], armL: [-1.2, 0, 0.2], foreL: [-0.3, 0, 0], w: { p: [0.0, -0.08, 0.48], d: [0.03, -0.55, 1], g: -0.3, g2: 0.1, w2: 1 } })),
      K(1.8, W.gIdle, 'io'),
    ], hit: [0.78, 0.9], dmg: 80, move: [[0.7, 0.86, 3]], sfx: [[0.76, 'swing_heavy', 0.8]], trail: [0.72, 0.92], aoe: { t: 0.86, r: 2.4, dmg: 40 }, track: 0.7, shake: 0.4,
  };
  W.thrust = {
    dur: 1.5, keys: [
      K(0, W.gIdle),
      K(0.55, WP({ thighL: [-0.7, 0, 0.14], shinL: [1.2, 0, 0], thighR: [0.4, 0, -0.14], shinR: [1.1, 0, 0], hips: [0.3, -0.3, 0], spine: [0.2, -0.2, 0], chest: [0.05, -0.4, 0], neck: [-0.3, 0.5, 0], armL: [-0.9, 0, 0.3], foreL: [-1.0, 0, 0], w: { p: [-0.35, 0.05, -0.15], d: [0.1, 0.1, 1], g: -0.45, g2: 0.0, w2: 1 }, jaw: 0.5 }), 'io'),
      K(0.72, WP({ thighL: [-1.1, 0, 0.14], shinL: [0.8, 0, 0], thighR: [0.8, 0, -0.14], shinR: [0.3, 0, 0], hips: [0.35, 0.1, 0], spine: [0.3, 0.1, 0], chest: [0.3, 0.2, 0], neck: [-0.55, -0.2, 0], armL: [-1.4, 0, 0.2], foreL: [-0.2, 0, 0], w: { p: [-0.1, 0.02, 0.56], d: [0.03, 0.0, 1], g: -0.45, g2: 0.0, w2: 1 } }), 'i'),
      K(1.05, WP({ thighL: [-1.1, 0, 0.14], shinL: [0.8, 0, 0], thighR: [0.8, 0, -0.14], shinR: [0.3, 0, 0], hips: [0.35, 0.1, 0], spine: [0.3, 0.1, 0], chest: [0.3, 0.2, 0], neck: [-0.55, -0.2, 0], armL: [-1.4, 0, 0.2], foreL: [-0.2, 0, 0], w: { p: [-0.1, 0.0, 0.54], d: [0.03, -0.02, 1], g: -0.45, g2: 0.0, w2: 1 } })),
      K(1.5, W.gIdle, 'io'),
    ], hit: [0.64, 0.8], dmg: 60, move: [[0.6, 0.78, 9]], sfx: [[0.62, 'swing_blade', 0.8]], track: 0.55,
  };
  W.hit = {
    dur: 0.5, keys: [
      K(0, W.idle),
      K(0.07, WP({ thighL: [-0.4, 0, 0.12], shinL: [0.7, 0, 0], thighR: [0.2, 0, -0.12], shinR: [0.7, 0, 0], hips: [-0.1, 0.3, 0.1], spine: [-0.2, 0, 0.1], chest: [-0.35, 0.3, 0.15], neck: [0.3, 0, 0], head: [0.3, 0.3, 0], armL: [-0.5, 0, 0.9], foreL: [-0.4, 0, 0], w: { p: [-0.4, 0.1, 0.1], d: [-0.2, 0.9, 0.3], g: 0 }, jaw: 0.7 }), 'o'),
      K(0.5, W.idle, 'io'),
    ], move: [[0, 0.15, -2.5]],
  };
  W.stagger = {
    dur: 1.4, keys: [
      K(0, W.idle),
      K(0.12, WP({ thighL: [-0.2, 0, 0.2], shinL: [0.5, 0, 0], thighR: [0.4, 0, -0.2], shinR: [0.6, 0, 0], hips: [-0.3, 0.4, 0.15], spine: [-0.3, 0, 0.15], chest: [-0.4, 0.4, 0.15], neck: [0.4, 0, 0], head: [0.3, 0.4, 0], armL: [-0.8, 0, 1.2], foreL: [-0.3, 0, 0], w: { p: [-0.45, 0.25, 0.0], d: [-0.4, 0.9, 0.1], g: 0 }, jaw: 0.8 }), 'o'),
      K(0.7, WP({ thighL: [-0.9, 0, 0.1], shinL: [1.9, 0, 0], thighR: [0.1, 0, -0.1], shinR: [1.8, 0, 0], hips: [0.4, 0.1, 0], spine: [0.5, 0, 0], chest: [0.4, 0, 0], neck: [-0.2, 0, 0], armL: [0.2, 0, 0.3], foreL: [-0.4, 0, 0], w: { p: [-0.3, -0.35, 0.2], d: [0.1, -0.6, 1], g: 0 }, jaw: 0.3 }), 'io'),
      K(1.1, WP({ thighL: [-0.9, 0, 0.1], shinL: [1.9, 0, 0], thighR: [0.1, 0, -0.1], shinR: [1.8, 0, 0], hips: [0.4, 0.1, 0], spine: [0.5, 0, 0], chest: [0.4, 0, 0], neck: [-0.2, 0, 0], armL: [0.2, 0, 0.3], foreL: [-0.4, 0, 0], w: { p: [-0.3, -0.35, 0.2], d: [0.1, -0.6, 1], g: 0 } })),
      K(1.4, W.idle, 'io'),
    ], move: [[0, 0.2, -4]],
  };
  W.death = {
    dur: 1.6, keys: [
      K(0, W.idle),
      K(0.25, WP({ thighL: [-0.3, 0, 0.2], shinL: [0.9, 0, 0], thighR: [0.1, 0, -0.2], shinR: [1.1, 0, 0], hips: [-0.3, 0.5, 0.2], spine: [-0.3, 0, 0.1], chest: [-0.4, 0.3, 0.1], neck: [0.5, 0, 0], head: [0.4, 0.3, 0], armL: [-0.8, 0, 1.3], foreL: [-0.2, 0, 0], w: { p: [-0.5, 0.3, 0.0], d: [-0.6, 0.7, 0.2], g: 0 }, jaw: 0.9 }), 'o'),
      K(0.8, WP({ air: 1, hp: [0, -0.8, -0.2], thighL: [-0.9, 0, 0.3], shinL: [0.9, 0, 0], thighR: [-0.6, 0, -0.2], shinR: [0.8, 0, 0], hips: [-1.5, 0.3, 0.1], spine: [-0.1, 0, 0], chest: [-0.1, 0, 0], neck: [0.3, 0.5, 0], armL: [-0.3, 0, 1.4], foreL: [-0.2, 0, 0], w: { p: [-0.5, 0.2, 0.0], d: [-0.8, 0.2, 0.5], g: 0 }, jaw: 0.5 }), 'i'),
      K(1.6, WP({ air: 1, hp: [0, -0.85, -0.2], thighL: [-0.8, 0, 0.3], shinL: [0.8, 0, 0], thighR: [-0.5, 0, -0.2], shinR: [0.7, 0, 0], hips: [-1.55, 0.3, 0.1], spine: [-0.1, 0, 0], chest: [-0.1, 0, 0], neck: [0.3, 0.6, 0], armL: [-0.3, 0, 1.4], foreL: [-0.2, 0, 0], w: { p: [-0.5, 0.2, 0.0], d: [-0.8, 0.2, 0.5], g: 0 }, jaw: 0.5 })),
    ], move: [[0, 0.3, -2]],
  };
  W.roar = {
    dur: 1.2, keys: [
      K(0, W.idle),
      K(0.3, WP({ ...wLegA, hips: [-0.1, 0, 0], spine: [-0.2, 0, 0], chest: [-0.3, 0, 0], neck: [0.4, 0, 0], head: [0.4, 0, 0], armL: [-0.3, 0, 0.8], foreL: [-1.2, 0, 0], w: { p: [-0.4, 0.1, 0.1], d: [-0.2, 0.9, 0.3], g: 0 }, jaw: 1 }), 'o'),
      K(0.9, WP({ ...wLegA, hips: [-0.1, 0, 0], spine: [-0.2, 0, 0], chest: [-0.3, 0, 0], neck: [0.4, 0, 0], head: [0.45, 0, 0], armL: [-0.3, 0, 0.8], foreL: [-1.2, 0, 0], w: { p: [-0.4, 0.1, 0.1], d: [-0.2, 0.9, 0.3], g: 0 }, jaw: 1 })),
      K(1.2, W.idle, 'io'),
    ], sfx: [[0.25, 'wolf_growl', 0.8]],
  };

  return { poser, locomotion, M, W, MP, WP, K };
})();
