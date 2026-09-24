// ---------------------------------------------------------------------------
// Enemies: wolf scouts & guards, 幽魂 (Wandering Wight), 广智 (Guangzhi)
// ---------------------------------------------------------------------------
const K = Anim.K;

// ---- Wight clips ------------------------------------------------------------------
Anim.H = (() => {
  const P = Anim.poser(Models.WIGHT);
  const H = {};
  const arms = { armL: [-0.55, 0, 0.3], foreL: [-1.25, 0, 0], armR: [-0.55, 0, -0.3], foreR: [-1.25, 0, 0] };
  H.idle = P({ hips: [0.08, 0, 0], spine: [0.2, 0, 0], chest: [0.18, 0, 0], neck: [-0.15, 0, 0], head: [-0.12, 0, 0], thighL: [-0.25, 0, 0.1], shinL: [0.4, 0, 0], thighR: [-0.1, 0, -0.1], shinR: [0.35, 0, 0], ...arms });
  H.carry = P({ spine: [0.3, 0, 0], chest: [0.2, 0, 0], neck: [-0.3, 0, 0], head: [-0.1, 0, 0], ...arms });
  const lean = { hips: [-0.35, 0, 0], spine: [-0.35, 0, 0], chest: [-0.25, 0, 0], neck: [0.3, 0, 0], head: [0.3, 0, 0], thighL: [-0.5, 0, 0.1], shinL: [0.6, 0, 0], thighR: [0.3, 0, -0.1], shinR: [0.5, 0, 0], armL: [0.7, 0, 0.5], foreL: [-0.4, 0, 0], armR: [0.7, 0, -0.5], foreR: [-0.4, 0, 0] };
  const slam = { hips: [1.0, 0, 0], spine: [0.55, 0, 0], chest: [0.35, 0, 0], neck: [0.4, 0, 0], head: [0.35, 0, 0], thighL: [-1.3, 0, 0.1], shinL: [1.2, 0, 0], thighR: [0.4, 0, -0.1], shinR: [0.4, 0, 0], armL: [0.9, 0, 0.8], foreL: [-0.2, 0, 0], armR: [0.9, 0, -0.8], foreR: [-0.2, 0, 0] };
  H.headbutt = {
    dur: 2.3, keys: [K(0, H.idle), K(0.72, P(lean), 'io'), K(0.95, P(slam), 'i'), K(1.6, P(slam)), K(2.3, H.idle, 'io')],
    hit: [0.82, 1.0], dmg: 85, hitShape: { joint: 'head', off: [0, 0.5, 0.2], r: 0.7 }, move: [[0.75, 0.95, 9]], aoe: { t: 0.95, r: 2.4, dmg: 30 }, track: 0.7, knock: true, shake: 0.6,
    sfx: [[0.3, 'wight_moan', 0.9]],
  };
  H.headbutt2 = {
    dur: 3.1, keys: [K(0, H.idle), K(0.6, P(lean), 'io'), K(0.8, P(slam), 'i'), K(1.1, P(slam)), K(1.45, P(lean), 'io'), K(1.65, P(slam), 'i'), K(2.4, P(slam)), K(3.1, H.idle, 'io')],
    hits: [[0.68, 0.84, 70], [1.52, 1.7, 85]], hitShape: { joint: 'head', off: [0, 0.5, 0.2], r: 0.7 }, move: [[0.62, 0.8, 9], [1.47, 1.65, 9]], aoe: { t: 1.65, r: 2.6, dmg: 35 }, track: 1.4, knock: true, shake: 0.6,
    sfx: [[0.2, 'wight_moan', 1.1]],
  };
  const spinP = P({ hips: [0.1, 0, 0], spine: [0.15, 0, 0], chest: [0.1, 0, 0], neck: [-0.1, 0, 0], head: [-0.05, 0, 0], armL: [0, 0, 1.4], foreL: [-0.2, 0, 0], armR: [0, 0, -1.4], foreR: [-0.2, 0, 0], thighL: [-0.3, 0, 0.2], shinL: [0.5, 0, 0], thighR: [0.1, 0, -0.2], shinR: [0.4, 0, 0] });
  H.spin = {
    dur: 2.8, keys: [K(0, H.idle), K(0.55, spinP, 'io'), K(2.2, spinP), K(2.8, H.idle, 'io')],
    hit: [0.6, 2.2], multi: 0.28, dmg: 32, hitShape: { joint: 'head', off: [0, 0.5, 0.1], r: 1.1 }, spin: [0.55, 2.2, 13], move: [[0.6, 2.2, 3.8]], track: 2.2,
    sfx: [[0.5, 'wight_moan', 1.3], [0.9, 'swing_heavy', 0.7], [1.4, 'swing_heavy', 0.72], [1.9, 'swing_heavy', 0.7]],
  };
  const crouch = P({ hips: [0.4, 0, 0], spine: [0.3, 0, 0], chest: [0.2, 0, 0], neck: [-0.2, 0, 0], thighL: [-1.2, 0, 0.15], shinL: [1.9, 0, 0], thighR: [-1.0, 0, -0.15], shinR: [1.8, 0, 0], armL: [0.6, 0, 0.6], foreL: [-0.5, 0, 0], armR: [0.6, 0, -0.6], foreR: [-0.5, 0, 0] });
  const airUp = P({ air: 1, hp: [0, 2.2, 0], hips: [-0.2, 0, 0], spine: [-0.2, 0, 0], chest: [-0.1, 0, 0], neck: [0.2, 0, 0], head: [0.2, 0, 0], thighL: [-0.4, 0, 0.1], shinL: [0.9, 0, 0], thighR: [-0.2, 0, -0.1], shinR: [0.9, 0, 0], armL: [-2.6, 0, 0.4], foreL: [-0.3, 0, 0], armR: [-2.6, 0, -0.4], foreR: [-0.3, 0, 0] });
  const airDown = P({ air: 1, hp: [0, 1.4, 0.3], hips: [1.4, 0, 0], spine: [0.4, 0, 0], chest: [0.2, 0, 0], neck: [0.3, 0, 0], head: [0.3, 0, 0], thighL: [-1.6, 0, 0.1], shinL: [1.2, 0, 0], thighR: [-1.4, 0, -0.1], shinR: [1.2, 0, 0], armL: [0.6, 0, 1.2], foreL: [-0.2, 0, 0], armR: [0.6, 0, -1.2], foreR: [-0.2, 0, 0] });
  const landed = P({ air: 1, hp: [0, -0.1, 0.5], hips: [1.5, 0, 0], spine: [0.4, 0, 0], chest: [0.2, 0, 0], neck: [0.3, 0, 0], head: [0.3, 0, 0], thighL: [-1.4, 0, 0.2], shinL: [1.6, 0, 0], thighR: [-1.2, 0, -0.2], shinR: [1.6, 0, 0], armL: [0.5, 0, 1.3], foreL: [-0.2, 0, 0], armR: [0.5, 0, -1.3], foreR: [-0.2, 0, 0] });
  H.jump = {
    dur: 2.7, keys: [K(0, H.idle), K(0.5, crouch, 'io'), K(0.85, airUp, 'o'), K(1.2, airDown, 'io'), K(1.35, landed, 'i'), K(2.1, landed), K(2.7, H.idle, 'io')],
    leap: [0.5, 1.35], aoe: { t: 1.35, r: 3.8, dmg: 95, knock: true }, track: 0.5, shake: 0.9,
    sfx: [[0.45, 'wight_moan', 0.8]],
  };
  const castUp = P({ hips: [-0.05, 0, 0], spine: [-0.1, 0, 0], chest: [-0.15, 0, 0], neck: [0.1, 0, 0], head: [0.1, 0, 0], armL: [-2.8, 0, 0.5], foreL: [-0.4, 0, 0], armR: [-2.8, 0, -0.5], foreR: [-0.4, 0, 0], thighL: [-0.2, 0, 0.1], shinL: [0.3, 0, 0], thighR: [0.1, 0, -0.1], shinR: [0.3, 0, 0] });
  H.cast = {
    dur: 2.0, keys: [K(0, H.idle), K(0.6, castUp, 'io'), K(1.3, castUp), K(2.0, H.idle, 'io')],
    wisps: 0.75, track: 1.2, sfx: [[0.3, 'wight_moan', 1.2]],
  };
  H.hit = { dur: 0.5, keys: [K(0, H.idle), K(0.08, P({ ...lean, hips: [-0.2, 0.2, 0], head: [0.5, 0.2, 0.2] }), 'o'), K(0.5, H.idle, 'io')], move: [[0, 0.12, -1.5]] };
  H.stagger = { dur: 2.0, keys: [K(0, H.idle), K(0.2, P({ ...lean, hips: [-0.4, 0.3, 0.2], head: [0.6, 0.3, 0.3] }), 'o'), K(0.7, P({ hips: [0.6, 0, 0], spine: [0.5, 0, 0], neck: [0.3, 0, 0], head: [0.3, 0, 0], thighL: [-1.2, 0, 0.2], shinL: [2.0, 0, 0], thighR: [-0.9, 0, -0.2], shinR: [1.9, 0, 0], armL: [0.3, 0, 0.5], foreL: [-0.3, 0, 0], armR: [0.3, 0, -0.5], foreR: [-0.3, 0, 0] }), 'io'), K(1.6, P({ hips: [0.6, 0, 0], spine: [0.5, 0, 0], neck: [0.3, 0, 0], head: [0.35, 0, 0], thighL: [-1.2, 0, 0.2], shinL: [2.0, 0, 0], thighR: [-0.9, 0, -0.2], shinR: [1.9, 0, 0], armL: [0.3, 0, 0.5], foreL: [-0.3, 0, 0], armR: [0.3, 0, -0.5], foreR: [-0.3, 0, 0] })), K(2.0, H.idle, 'io')], move: [[0, 0.2, -3]] };
  H.death = { dur: 2.4, keys: [K(0, H.idle), K(0.4, P({ ...lean, head: [0.6, 0.4, 0.3] }), 'o'), K(1.4, P({ air: 1, hp: [0, -0.45, -0.3], hips: [-1.4, 0.3, 0.2], spine: [-0.2, 0, 0], neck: [0.3, 0, 0], head: [0.3, 0.5, 0], thighL: [-1.0, 0, 0.3], shinL: [0.9, 0, 0], thighR: [-0.8, 0, -0.3], shinR: [0.8, 0, 0], armL: [0, 0, 1.4], armR: [0, 0, -1.4] }), 'i'), K(2.4, P({ air: 1, hp: [0, -0.5, -0.3], hips: [-1.5, 0.3, 0.2], spine: [-0.2, 0, 0], neck: [0.3, 0, 0], head: [0.3, 0.6, 0], thighL: [-0.9, 0, 0.3], shinL: [0.8, 0, 0], thighR: [-0.7, 0, -0.3], shinR: [0.7, 0, 0], armL: [0, 0, 1.5], armR: [0, 0, -1.5] }))] };
  H.roar = { dur: 2.0, keys: [K(0, H.idle), K(0.5, castUp, 'io'), K(1.5, castUp), K(2.0, H.idle, 'io')], sfx: [[0.3, 'wight_moan', 0.7]] };
  return H;
})();

// ---- Guangzhi clips -----------------------------------------------------------------
Anim.G = (() => {
  const P = Anim.poser(Models.WOLF);
  const G = {};
  const legsW = { thighL: [-0.55, 0, 0.2], shinL: [0.85, 0, 0], thighR: [0.28, 0, -0.2], shinR: [0.75, 0, 0] };
  const legsL = { thighL: [-0.85, 0, 0.16], shinL: [0.95, 0, 0], thighR: [0.5, 0, -0.16], shinR: [0.45, 0, 0] };
  const grip = { g: -0.28, g2: 0.22, w2: 1 };
  G.idle = P({ ...legsW, hips: [0.12, 0.45, 0], spine: [0.15, -0.12, 0], chest: [0.12, -0.35, 0], neck: [-0.2, 0.35, 0], head: [-0.1, 0.1, 0], armL: [-0.6, 0, 0.3], foreL: [-1.0, 0, 0], w: { p: [-0.18, -0.02, 0.32], d: [0.55, 0.6, 0.55], ...grip }, tail: 0.4 });
  G.carry = P({ spine: [0.22, 0, 0], chest: [0.1, 0, 0], neck: [-0.25, 0, 0], armL: [0, 0, 0.2], foreL: [-0.5, 0, 0], w: { p: [-0.3, -0.22, 0.05], d: [0.05, 0.15, 1], g: 0 }, tail: 0.6 });
  const W = (p, d, extra = {}) => ({ w: { p, d, ...grip, ...extra } });
  G.combo = {
    dur: 2.4, keys: [
      K(0, G.idle),
      K(0.42, P({ ...legsW, hips: [0.1, -0.4, 0], spine: [0.1, -0.3, 0], chest: [0.0, -0.8, 0], neck: [-0.1, 0.7, 0], armL: [-0.5, 0, 0.5], foreL: [-1, 0, 0], ...W([-0.42, 0.15, -0.05], [-0.6, 0.3, -0.75]) }), 'io'),
      K(0.56, P({ ...legsL, hips: [0.2, 0.15, 0], spine: [0.25, 0.15, 0], chest: [0.2, 0.45, 0], neck: [-0.3, -0.3, 0], armL: [-0.5, 0, 0.6], foreL: [-0.8, 0, 0], ...W([0.1, 0.0, 0.46], [0.9, -0.08, 0.4]) }), 'i'),
      K(0.74, P({ ...legsL, hips: [0.2, 0.3, 0], spine: [0.25, 0.25, 0], chest: [0.2, 0.8, 0], neck: [-0.3, -0.5, 0], armL: [-0.4, 0, 0.6], foreL: [-0.8, 0, 0], ...W([0.3, 0.05, 0.18], [0.7, 0.15, -0.7]) }), 'o'),
      K(1.0, P({ ...legsW, hips: [0.15, 0.35, 0], spine: [0.2, 0.25, 0], chest: [0.1, 0.8, 0], neck: [-0.2, -0.5, 0], armL: [-0.4, 0, 0.6], foreL: [-0.9, 0, 0], ...W([0.32, 0.12, 0.12], [0.75, 0.25, -0.6]) }), 'io'),
      K(1.14, P({ ...legsL, thighR: [-0.8, 0, -0.16], shinR: [0.9, 0, 0], thighL: [0.45, 0, 0.16], shinL: [0.5, 0, 0], hips: [0.2, -0.2, 0], spine: [0.25, -0.2, 0], chest: [0.2, -0.5, 0], neck: [-0.3, 0.3, 0], armL: [-0.6, 0, 0.6], foreL: [-0.7, 0, 0], ...W([-0.2, 0.0, 0.46], [-0.9, -0.05, 0.4]) }), 'i'),
      K(1.32, P({ ...legsL, thighR: [-0.8, 0, -0.16], shinR: [0.9, 0, 0], thighL: [0.45, 0, 0.16], shinL: [0.5, 0, 0], hips: [0.2, -0.3, 0], spine: [0.25, -0.3, 0], chest: [0.2, -0.8, 0], neck: [-0.3, 0.5, 0], armL: [-0.6, 0, 0.6], foreL: [-0.7, 0, 0], ...W([-0.36, 0.0, 0.16], [-0.7, -0.1, -0.7]) }), 'o'),
      K(1.55, P({ ...legsW, hips: [-0.05, -0.1, 0], spine: [-0.15, -0.1, 0], chest: [-0.3, -0.2, 0], neck: [0.1, 0.2, 0], armL: [-2.4, 0, 0.3], foreL: [-0.9, 0, 0], ...W([-0.1, 0.46, 0.05], [0.08, 0.6, -0.8]) }), 'io'),
      K(1.7, P({ ...legsL, hips: [0.35, 0, 0], spine: [0.35, 0, 0], chest: [0.45, 0, 0], neck: [-0.5, 0, 0], armL: [-1.3, 0, 0.2], foreL: [-0.3, 0, 0], ...W([0.0, -0.05, 0.5], [0.03, -0.35, 1]) }), 'i'),
      K(1.95, P({ ...legsL, hips: [0.33, 0, 0], spine: [0.33, 0, 0], chest: [0.42, 0, 0], neck: [-0.45, 0, 0], armL: [-1.3, 0, 0.2], foreL: [-0.3, 0, 0], ...W([0.0, -0.07, 0.48], [0.03, -0.37, 1]) })),
      K(2.4, G.idle, 'io'),
    ], hits: [[0.48, 0.66, 70], [1.06, 1.24, 70], [1.6, 1.74, 95]], move: [[0.44, 0.6, 4], [1.02, 1.16, 4], [1.56, 1.7, 5]], trail: [0.44, 1.76], aoe: { t: 1.7, r: 2.2, dmg: 30 }, track: 1.5, trackRate: 5, shake: 0.4,
    sfx: [[0.46, 'swing_blade', 0.8], [1.04, 'swing_blade', 0.85], [1.58, 'swing_heavy', 0.85]],
  };
  const crouch = P({ thighL: [-1.1, 0, 0.15], shinL: [1.7, 0, 0], thighR: [0.1, 0, -0.15], shinR: [1.6, 0, 0], hips: [0.4, 0, 0], spine: [0.3, 0, 0], chest: [0.1, -0.3, 0], neck: [-0.3, 0.3, 0], armL: [-0.6, 0, 0.5], foreL: [-1, 0, 0], ...W([-0.35, 0.0, -0.1], [-0.3, 0.3, -0.9]) });
  const air1 = P({ air: 1, hp: [0, 1.6, 0], thighL: [-1.2, 0, 0.1], shinL: [1.5, 0, 0], thighR: [-0.5, 0, -0.1], shinR: [1.3, 0, 0], hips: [-0.15, 0, 0], spine: [-0.25, 0, 0], chest: [-0.35, 0, 0], neck: [0.25, 0, 0], armL: [-2.6, 0, 0.3], foreL: [-0.8, 0, 0], ...W([-0.05, 0.5, -0.05], [0.05, 0.4, -1]) });
  const air2 = P({ air: 1, hp: [0, 1.9, 0], thighL: [-1.3, 0, 0.1], shinL: [1.8, 0, 0], thighR: [-0.9, 0, -0.1], shinR: [1.7, 0, 0], hips: [-0.1, 0, 0], spine: [-0.3, 0, 0], chest: [-0.4, 0, 0], neck: [0.25, 0, 0], armL: [-2.8, 0, 0.3], foreL: [-0.6, 0, 0], ...W([0.0, 0.52, 0.1], [0.02, 1, -0.2]) });
  const land = P({ ...legsL, thighL: [-1.1, 0, 0.12], shinL: [1.4, 0, 0], thighR: [0.2, 0, -0.12], shinR: [1.3, 0, 0], hips: [0.4, 0, 0], spine: [0.4, 0, 0], chest: [0.5, 0, 0], neck: [-0.55, 0, 0], armL: [-1.3, 0, 0.2], foreL: [-0.3, 0, 0], ...W([0.0, -0.06, 0.48], [0.02, -0.36, 1]) });
  G.leap = {
    dur: 2.1, keys: [K(0, G.idle), K(0.5, crouch, 'io'), K(0.8, air1, 'o'), K(1.0, air2, 'io'), K(1.12, land, 'i'), K(1.6, land), K(2.1, G.idle, 'io')],
    hit: [1.02, 1.16], dmg: 105, leap: [0.5, 1.12], aoe: { t: 1.12, r: 3.0, dmg: 45 }, trail: [0.95, 1.16], track: 0.5, knock: true, shake: 0.7,
    sfx: [[0.5, 'swing_heavy', 0.7], [1.0, 'swing_heavy', 0.9]],
  };
  // spinning wheel dash
  {
    const keys = [K(0, G.idle), K(0.5, P({ ...legsW, hips: [0.2, 0, 0], spine: [0.2, 0, 0], chest: [0.1, 0, 0], armL: [-1.0, 0, 0.8], foreL: [-0.5, 0, 0], w: { p: [-0.08, 0.1, 0.45], d: [1, 0.05, 0.25], g: 0 } }), 'io')];
    const dirs = [[0, 1, 0.25], [-1, 0.05, 0.25], [0, -1, 0.25], [1, 0.05, 0.25]];
    let t = 0.58;
    for (let i = 0; i < 24; i++) { keys.push(K(t, P({ ...(i % 2 ? legsL : legsW), hips: [0.25, 0, 0], spine: [0.25, 0, 0], chest: [0.15, 0, 0], armL: [-1.0, 0, 0.8], foreL: [-0.5, 0, 0], w: { p: [-0.06, 0.1, 0.46], d: dirs[i % 4], g: 0 } }), 'l')); t += 0.055; }
    keys.push(K(2.5, G.idle, 'io'));
    G.spin = { dur: 2.5, keys, hit: [0.58, 1.9], multi: 0.22, dmg: 32, move: [[0.6, 1.9, 7.5]], trail: [0.58, 1.9], track: 1.9, trackRate: 2.2, sfx: [[0.6, 'swing_blade', 1.3], [0.9, 'swing_blade', 1.35], [1.2, 'swing_blade', 1.3], [1.5, 'swing_blade', 1.35], [1.8, 'swing_blade', 1.3]] };
  }
  G.wave = {
    dur: 1.9, keys: [
      K(0, G.idle),
      K(0.65, P({ thighL: [-0.8, 0, 0.15], shinL: [1.3, 0, 0], thighR: [0.4, 0, -0.15], shinR: [1.1, 0, 0], hips: [0.35, -0.5, 0], spine: [0.3, -0.3, 0], chest: [0.2, -0.6, 0], neck: [-0.4, 0.6, 0], armL: [-0.4, 0, 0.6], foreL: [-0.8, 0, 0], ...W([-0.4, -0.25, -0.1], [-0.5, -0.45, -0.75]) }), 'io'),
      K(0.82, P({ ...legsL, hips: [0.05, 0.2, 0], spine: [-0.05, 0.15, 0], chest: [-0.2, 0.4, 0], neck: [0, -0.3, 0], armL: [-2.0, 0, 0.4], foreL: [-0.5, 0, 0], ...W([0.05, 0.4, 0.3], [0.3, 0.9, 0.3]) }), 'i'),
      K(1.3, P({ ...legsL, hips: [0.05, 0.2, 0], spine: [-0.05, 0.15, 0], chest: [-0.2, 0.4, 0], neck: [0, -0.3, 0], armL: [-2.0, 0, 0.4], foreL: [-0.5, 0, 0], ...W([0.05, 0.42, 0.28], [0.3, 0.9, 0.3]) })),
      K(1.9, G.idle, 'io'),
    ], hit: [0.7, 0.86], dmg: 70, wave: 0.8, trail: [0.66, 0.88], track: 0.65, sfx: [[0.7, 'fire_burst', 1]],
  };
  const roarP = P({ ...legsW, hips: [-0.15, 0, 0], spine: [-0.25, 0, 0], chest: [-0.35, 0, 0], neck: [0.4, 0, 0], head: [0.45, 0, 0], armL: [-0.3, 0, 1.1], foreL: [-0.6, 0, 0], ...W([-0.3, 0.45, 0.0], [0.1, 1, 0.05], { w2: 0 }), jaw: 1 });
  G.burst = {
    dur: 3.0, keys: [K(0, G.idle), K(0.6, roarP, 'io'), K(1.45, roarP), K(1.6, P({ ...legsL, hips: [0.3, 0, 0], spine: [0.3, 0, 0], chest: [0.3, 0, 0], neck: [-0.3, 0, 0], armL: [-1.2, 0, 0.3], foreL: [-0.4, 0, 0], ...W([0.0, -0.05, 0.46], [0.02, -0.4, 1]), jaw: 0.6 }), 'i'), K(2.3, P({ ...legsL, hips: [0.3, 0, 0], spine: [0.3, 0, 0], chest: [0.3, 0, 0], neck: [-0.3, 0, 0], armL: [-1.2, 0, 0.3], foreL: [-0.4, 0, 0], ...W([0.0, -0.06, 0.45], [0.02, -0.42, 1]) })), K(3.0, G.idle, 'io')],
    aoe: { t: 1.6, r: 5.5, dmg: 90, knock: true, fire: true }, shake: 1.0, sfx: [[0.4, 'boss_roar', 1]],
  };
  G.backstep = { dur: 0.9, keys: [K(0, G.idle), K(0.25, P({ air: 1, hp: [0, 0.35, 0], ...legsW, thighL: [-0.9, 0, 0.2], shinL: [1.3, 0, 0], thighR: [-0.3, 0, -0.2], shinR: [1.2, 0, 0], hips: [-0.1, 0.3, 0], spine: [0, -0.1, 0], chest: [-0.1, -0.3, 0], neck: [0, 0.3, 0], armL: [-0.6, 0, 0.4], foreL: [-1, 0, 0], ...W([-0.2, 0.0, 0.3], [0.5, 0.6, 0.6]) }), 'o'), K(0.9, G.idle, 'io')], move: [[0, 0.45, -10]], iframes: [0, 0.4] };
  G.hit = { dur: 0.55, keys: [K(0, G.idle), K(0.08, P({ ...legsW, hips: [-0.1, 0.4, 0.1], spine: [-0.2, 0, 0.1], chest: [-0.35, 0.3, 0.15], neck: [0.3, 0, 0], head: [0.3, 0.3, 0], armL: [-0.5, 0, 0.9], foreL: [-0.4, 0, 0], ...W([-0.35, 0.1, 0.1], [0.3, 0.9, 0.3], { w2: 0.5 }), jaw: 0.7 }), 'o'), K(0.55, G.idle, 'io')], move: [[0, 0.12, -2]] };
  const kneel = P({ thighL: [-1.2, 0, 0.1], shinL: [2.0, 0, 0], thighR: [0.2, 0, -0.1], shinR: [1.9, 0, 0], hips: [0.4, 0.1, 0], spine: [0.5, 0, 0], chest: [0.4, 0, 0], neck: [-0.2, 0, 0], armL: [0.2, 0, 0.3], foreL: [-0.4, 0, 0], w: { p: [-0.3, -0.35, 0.25], d: [0.1, -0.6, 1], g: 0 }, jaw: 0.4 });
  G.stagger = { dur: 2.2, keys: [K(0, G.idle), K(0.15, P({ thighL: [-0.2, 0, 0.2], shinL: [0.5, 0, 0], thighR: [0.4, 0, -0.2], shinR: [0.6, 0, 0], hips: [-0.3, 0.4, 0.15], spine: [-0.3, 0, 0.15], chest: [-0.4, 0.4, 0.15], neck: [0.4, 0, 0], head: [0.3, 0.4, 0], armL: [-0.8, 0, 1.2], foreL: [-0.3, 0, 0], w: { p: [-0.45, 0.25, 0.0], d: [-0.4, 0.9, 0.1], g: 0 }, jaw: 0.8 }), 'o'), K(0.7, kneel, 'io'), K(1.8, kneel), K(2.2, G.idle, 'io')], move: [[0, 0.2, -4]] };
  G.death = { dur: 3.2, keys: [K(0, G.idle), K(0.3, P({ thighL: [-0.2, 0, 0.2], shinL: [0.5, 0, 0], thighR: [0.4, 0, -0.2], shinR: [0.6, 0, 0], hips: [-0.3, 0.4, 0.15], spine: [-0.3, 0, 0.15], chest: [-0.4, 0.4, 0.15], neck: [0.5, 0, 0], head: [0.4, 0.4, 0], armL: [-0.8, 0, 1.2], foreL: [-0.3, 0, 0], w: { p: [-0.45, 0.25, 0.0], d: [-0.4, 0.9, 0.1], g: 0 }, jaw: 1 }), 'o'), K(1.0, kneel, 'io'), K(2.0, kneel), K(3.2, P({ air: 1, hp: [0, -0.85, 0.3], hips: [1.5, 0, 0.1], spine: [0.1, 0, 0], neck: [-0.3, 0.6, 0], thighL: [-0.3, 0, 0.1], shinL: [0.4, 0, 0], thighR: [-0.1, 0, -0.1], shinR: [0.3, 0, 0], armL: [-2.6, 0, 0.3], foreL: [-0.2, 0, 0], w: { p: [-0.4, 0.3, 0.1], d: [-0.8, 0.5, 0.2], g: 0 } }), 'i')] };
  G.intro = { dur: 3.2, keys: [K(0, P({ ...legsW, hips: [0.05, 0, 0], spine: [0.05, 0, 0], chest: [0, 0, 0], neck: [-0.05, 0, 0], armL: [0, 0, 0.2], foreL: [-0.3, 0, 0], w: { p: [-0.25, -0.2, 0.15], d: [0.05, 1, 0.1], g: 0 } })), K(1.2, roarP, 'io'), K(2.4, roarP), K(3.2, G.idle, 'io')], sfx: [[1.0, 'boss_roar', 0.9]] };
  return G;
})();

// ---------------------------------------------------------------------------
class Enemy extends Actor {
  constructor(kind, home, opts = {}) {
    let model, spec, cfg;
    if (kind === 'scout') { model = Models.buildWolf(); spec = Models.WOLF; cfg = { hp: 190, radius: 0.42, height: 1.8, weaponSeg: [0.13, 0.98], poise: 30, name: '狼斥候', speed: 4.6, aggro: 16 }; }
    else if (kind === 'guard') { model = Models.buildWolf({ variant: 'guard' }); spec = Models.WOLF; cfg = { hp: 340, radius: 0.46, height: 1.8, weaponSeg: [0.2, 1.5], poise: 70, name: '狼校卫', speed: 4.0, aggro: 16 }; }
    else if (kind === 'wight') { model = Models.buildWight(); spec = Models.WIGHT; cfg = { hp: 1700, radius: 0.6, height: 2.3, weaponSeg: null, poise: 220, name: '幽魂', speed: 3.2, aggro: 17, boss: true }; }
    else { model = Models.buildGuangzhi(); spec = Models.WOLF; cfg = { hp: 3200, radius: 0.46, height: 1.8, weaponSeg: [-1.5, 1.5], poise: 260, name: '广智', speed: 5.2, aggro: 18, boss: true }; }
    super(model, spec, { hp: cfg.hp, radius: cfg.radius, height: cfg.height, team: 'enemy', weaponSeg: cfg.weaponSeg, weaponR: 0.09, name: cfg.name });
    this.kind = kind; this.cfg = cfg; this.boss = !!cfg.boss;
    this.home = home.clone(); this.homeYaw = opts.yaw || 0;
    this.maxPoise = cfg.poise; this.poise = cfg.poise;
    this.state = 'idle'; this.stateT = 0; this.cooldown = 1; this.recoverT = 0; this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.active = true; this.frozenT = 0; this.seal = null; this.deadT = 0;
    this.hpBar = null; this.hpBarT = 0;
    this.phase2 = false; this.leapFrom = new THREE.Vector3(); this.leapTo = new THREE.Vector3();
    this.aoeDone = false; this.waveDone = false; this.wispsDone = false;
    this.trail = null;
    this.lastAttack = null;
    this.patrolT = Math.random() * 5;
    this.fireLight = null; this.bladeFire = 0;
    this.lib = kind === 'wight' ? Anim.H : kind === 'guangzhi' ? Anim.G : Anim.W;
    this.setupStances();
    if (kind === 'guangzhi') this.trail = FX.makeTrail([0.7, 0.72, 0.8], 40);
    else if (kind !== 'wight') this.trail = FX.makeTrail([0.75, 0.8, 0.9], 30);
    if (this.trail) this.trail.mat.uniforms.intensity.value = 0.55;
    this.reset();
  }
  setupStances() {
    const L = this.lib;
    if (this.kind === 'guard') { this.anim.stanceA = Anim.W.gIdle; this.anim.stanceB = Anim.W.gCarry; }
    else { this.anim.stanceA = L.idle; this.anim.stanceB = L.carry; }
  }
  get attacks() {
    const key = this.phase2 ? 'p2' : 'p1';
    if (!this._atk) this._atk = {};
    if (!this._atk[key]) this._atk[key] = this.buildAttacks();
    return this._atk[key];
  }
  buildAttacks() {
    const W = Anim.W, H = Anim.H, G = Anim.G;
    switch (this.kind) {
      case 'scout': return [{ c: W.slash, min: 0, max: 2.6, w: 3, cd: 1.2 }, { c: W.combo, min: 0, max: 2.4, w: 2, cd: 1.6 }, { c: W.lunge, min: 3, max: 7, w: 2, cd: 2 }];
      case 'guard': return [{ c: W.sweep, min: 0, max: 3.2, w: 3, cd: 1.6 }, { c: W.slam, min: 0, max: 3.0, w: 2, cd: 2 }, { c: W.thrust, min: 2.5, max: 6.5, w: 2, cd: 1.8 }];
      case 'wight': return this.phase2
        ? [{ c: H.headbutt2, min: 0, max: 4, w: 3, cd: 1.0 }, { c: H.spin, min: 0, max: 6, w: 2, cd: 1.5 }, { c: H.jump, min: 4, max: 14, w: 3, cd: 1.5 }, { c: H.cast, min: 5, max: 20, w: 3, cd: 2 }, { c: H.headbutt, min: 0, max: 3.5, w: 1, cd: 1 }]
        : [{ c: H.headbutt, min: 0, max: 3.8, w: 3, cd: 1.3 }, { c: H.spin, min: 0, max: 5, w: 1, cd: 2 }, { c: H.jump, min: 4.5, max: 14, w: 2, cd: 2 }, { c: H.cast, min: 6, max: 20, w: 2, cd: 2.5 }];
      default: return this.phase2
        ? [{ c: G.combo, min: 0, max: 3.4, w: 3, cd: 0.8 }, { c: G.leap, min: 4, max: 13, w: 2, cd: 1 }, { c: G.spin, min: 2, max: 9, w: 2, cd: 1.2 }, { c: G.wave, min: 4, max: 18, w: 3, cd: 1.2 }]
        : [{ c: G.combo, min: 0, max: 3.4, w: 3, cd: 1.2 }, { c: G.leap, min: 4.5, max: 13, w: 2, cd: 1.6 }, { c: G.spin, min: 2.5, max: 9, w: 1, cd: 2 }];
    }
  }
  reset() {
    this.pos.copy(this.home); this.pos.y = World.heightAt(this.pos.x, this.pos.z); this.yaw = this.homeYaw;
    this.hp = this.maxHp; this.poise = this.maxPoise; this.alive = true; this.state = 'idle'; this.stateT = 0;
    this.anim.stop(0.01); this.anim.cur.set(this.anim.stanceA); this.anim.frozen = false;
    this.fx.dissolve.value = 0; this.fx.freeze.value = 0; this.frozenT = 0; this.deadT = 0;
    this.rig.root.visible = true; this.active = true; this.phase2 = false; this.bladeFire = 0;
    if (this.seal) this.seal.material.opacity = 0;
    if (this.model.materials.blade) this.model.materials.blade.emissiveIntensity = 0;
    if (this.trail && this.kind === 'guangzhi') { this.trail.mat.uniforms.color.value.setRGB(0.7, 0.72, 0.8); this.trail.mat.uniforms.intensity.value = 0.55; }
    this.model.meshes.forEach(m => m.castShadow = true);
    this.cooldown = 1; this.syncRoot();
    if (this.hpBar) this.hpBar.hidden = true;
  }
  immobilize(dur) {
    if (!this.alive) return;
    this.frozenT = dur; this.anim.frozen = true;
    if (!this.seal) this.seal = FX.sealSprite('定');
    this.seal.material.opacity = 1;
    Game.audio.play('spell_immobilize', { pos: this.pos, pitch: 1.1 });
    FX.shockwave(this.pos, 2.5, [1, 0.8, 0.3], 0.6, 0.15);
    if (this.state === 'idle') this.aggro();
  }
  aggro() {
    if (this.state !== 'idle' && this.state !== 'return') return;
    if (this.boss) { Game.startBoss(this); return; }
    this.state = 'alert'; this.anim.play(Anim.W.roar, 0.15);
    Game.audio.play('wolf_growl', { pos: this.pos });
  }
  takeHit(info) {
    if (!this.alive) return;
    this.hp -= info.amount;
    this.flashT = 0.1; this.fx.flashColor.value.setRGB(1, 0.95, 0.85);
    this.hpBarT = 6;
    if (this.state === 'idle' || this.state === 'return') this.aggro();
    if (this.hp <= 0) { this.hp = 0; this.die(); return; }
    // boss phase transition
    if (this.boss && !this.phase2 && this.hp < this.maxHp * 0.5 && this.frozenT <= 0) { this.enterPhase2(); return; }
    if (this.frozenT > 0) return;
    this.poise -= info.poise;
    const clip = this.anim.clip;
    const L = this.lib;
    if (this.poise <= 0) {
      this.poise = this.maxPoise;
      this.startClip(L.stagger || Anim.W.stagger, 'stun');
      this.forward(U.tmpV[8]);
      Game.audio.play(this.kind === 'wight' ? 'wight_moan' : 'wolf_hurt', { pos: this.pos, pitch: 0.9 });
      return;
    }
    const inAttack = this.state === 'attack' && clip;
    const armored = this.boss || (this.kind === 'guard' && info.kind !== 'heavy');
    if (!inAttack && !armored) this.startClip(L.hit || Anim.W.hit, 'stun');
    else if (inAttack && !armored && this.anim.t < (clip.hit ? clip.hit[0] : clip.hits ? clip.hits[0][0] : 1) * 0.8 && info.kind !== 'clone') this.startClip(L.hit || Anim.W.hit, 'stun');
    else { this.anim.flinch = 1; this.anim.flinchDir = Math.random() < 0.5 ? 1 : -1; }
    if (Math.random() < 0.35 && this.kind !== 'wight') Game.audio.play('wolf_hurt', { pos: this.pos, pitch: 0.9 + Math.random() * 0.3 });
  }
  enterPhase2() {
    this.phase2 = true;
    this.poise = this.maxPoise;
    if (this.kind === 'guangzhi') { this.startClip(Anim.G.burst, 'attack'); this.lastAttack = { c: Anim.G.burst, cd: 1 }; }
    else { this.startClip(Anim.H.roar, 'attack'); this.lastAttack = { c: Anim.H.roar, cd: 0.5 }; }
    Game.onBossPhase2(this);
  }
  die() {
    this.alive = false; this.state = 'dead'; this.deadT = 0;
    this.frozenT = 0; this.anim.frozen = false; this.fx.freeze.value = 0;
    if (this.seal) this.seal.material.opacity = 0;
    this.anim.play(this.lib.death || Anim.W.death, 0.1);
    Game.audio.play(this.kind === 'wight' ? 'wight_moan' : 'wolf_death', { pos: this.pos, pitch: this.kind === 'wight' ? 0.6 : 1 });
    Game.onEnemyDeath(this);
    if (this.hpBar) this.hpBar.hidden = true;
  }
  startClip(clip, state) {
    this.anim.play(clip, 0.1);
    this.state = state; this.stateT = 0;
    this.hitSet.clear(); this.segValid = false; this.multiT = 0; this.aoeDone = false; this.waveDone = false; this.wispsDone = false;
    if (this.trail) this.trail.clear();
    if (clip.leap) { this.leapFrom.copy(this.pos); }
  }
  chooseAttack(d) {
    const opts = this.attacks.filter(a => d >= a.min && d <= a.max && a !== this.lastAttack);
    const list = opts.length ? opts : this.attacks.filter(a => d >= a.min && d <= a.max);
    if (!list.length) return null;
    let tw = 0; for (const a of list) tw += a.w;
    let r = Math.random() * tw;
    for (const a of list) { r -= a.w; if (r <= 0) return a; }
    return list[0];
  }

  update(dt, player) {
    if (!this.active) return;
    this.stateT += dt;
    this.hpBarT -= dt;
    this.poise = Math.min(this.maxPoise, this.poise + dt * this.maxPoise * 0.06);
    if (!this.alive) {
      this.deadT += dt;
      this.anim.update(dt);
      if (this.deadT > 1.2) {
        this.fx.dissolve.value = U.clamp((this.deadT - 1.2) / 1.6, 0, 1);
        if (this.deadT > 1.6) this.model.meshes.forEach(m => m.castShadow = false);
        if (Math.random() < dt * 30 && this.deadT < 2.8) FX.spiritMote(U.tmpV[9].set(this.pos.x + FX.R(-0.5, 0.5), this.pos.y + FX.R(0.2, 1.5), this.pos.z + FX.R(-0.5, 0.5)), [1.6, 1.0, 0.45]);
      }
      if (this.deadT > 3) { this.rig.root.visible = false; this.active = false; }
      this.updateFX(dt);
      return;
    }
    // immobilized
    if (this.frozenT > 0) {
      this.frozenT -= dt;
      this.fx.freeze.value = U.damp(this.fx.freeze.value, 1, 12, dt);
      if (this.seal) {
        this.seal.position.set(this.pos.x, this.pos.y + this.height * this.scaleMul + 0.7, this.pos.z);
        this.seal.material.opacity = U.clamp(this.frozenT * 2, 0, 1) * (0.8 + Math.sin(performance.now() * 0.01) * 0.2);
        this.seal.material.rotation = Math.sin(performance.now() * 0.002) * 0.1;
      }
      if (this.frozenT <= 0) {
        this.anim.frozen = false;
        FX.puff(this.pos, [1.6, 1.2, 0.4], 12, 0.8);
        if (this.seal) this.seal.material.opacity = 0;
        if (this.boss && !this.phase2 && this.hp < this.maxHp * 0.5) this.enterPhase2();
      }
      this.anim.update(dt); this.updateFX(dt); this.syncRoot();
      return;
    }
    this.fx.freeze.value = U.damp(this.fx.freeze.value, 0, 8, dt);

    const d = this.distTo(player);
    const clip = this.anim.clip;
    let move = 0, strafe = 0, faceRate = 8;
    const toP = U.tmpV[10].set(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    switch (this.state) {
      case 'idle': {
        this.patrolT -= dt;
        const hd = Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z);
        if (hd > 1) { this.faceTowards(this.home, 4, dt); move = 1.3; }
        else this.yaw = U.dampAngle(this.yaw, this.homeYaw + Math.sin(this.patrolT * 0.3) * 0.6, 1, dt);
        if (player.alive && d < this.cfg.aggro && Game.state === 'play') this.aggro();
        break;
      }
      case 'alert':
        this.faceTowards(player.pos, 6, dt);
        if (!clip) this.state = 'chase';
        break;
      case 'chase': {
        if (!player.alive) { this.state = 'return'; break; }
        this.cooldown -= dt;
        const reach = this.boss ? 3 : 2.2;
        this.faceTowards(player.pos, 8, dt);
        const canAttack = this.cooldown <= 0 && (this.boss || Game.requestAttackToken(this));
        const atk = canAttack ? this.chooseAttack(d) : null;
        if (atk) {
          this.lastAttack = atk; this.cooldown = atk.cd * (this.phase2 ? 0.75 : 1) + Math.random() * 0.5;
          this.startClip(atk.c, 'attack');
          break;
        }
        if (d > reach + 1.2) move = d > 8 ? this.cfg.speed : this.cfg.speed * 0.75;
        else if (d < reach - 0.8) move = -1.6;
        else strafe = 1.4 * this.strafeDir;
        if (Math.random() < dt * 0.3) this.strafeDir *= -1;
        // leash for minions
        if (!this.boss && Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) > 40) this.state = 'return';
        break;
      }
      case 'attack': {
        if (!clip) { this.state = 'recover'; this.recoverT = (this.boss ? 0.2 : 0.5) + Math.random() * (this.boss ? 0.5 : 1.0); Game.releaseAttackToken(this); break; }
        this.processAttack(dt, player);
        break;
      }
      case 'recover': {
        this.recoverT -= dt;
        this.faceTowards(player.pos, 6, dt);
        strafe = 1.2 * this.strafeDir;
        if (d < 1.6) move = -1.5;
        if (this.recoverT <= 0) this.state = 'chase';
        break;
      }
      case 'stun': {
        const ms = this.anim.moveSpeed();
        if (ms) this.pos.addScaledVector(this.forward(U.tmpV[11]), ms * dt);
        if (!clip) { this.state = 'chase'; Game.releaseAttackToken(this); }
        break;
      }
      case 'return': {
        const hd = Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z);
        this.faceTowards(this.home, 6, dt); move = 3;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.2 * dt);
        if (hd < 1.2) { this.state = 'idle'; this.hp = this.maxHp; }
        if (player.alive && d < this.cfg.aggro * 0.6) this.state = 'chase';
        break;
      }
    }
    // locomotion
    if (this.state !== 'attack' && this.state !== 'stun' && this.state !== 'alert') {
      const f = this.forward(U.tmpV[11]);
      const r = U.tmpV[12].set(f.z, 0, -f.x);
      this.vel.x = U.damp(this.vel.x, f.x * move + r.x * strafe, 8, dt);
      this.vel.z = U.damp(this.vel.z, f.z * move + r.z * strafe, 8, dt);
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      const sp = Math.hypot(this.vel.x, this.vel.z);
      this.anim.speed = sp; this.anim.run = U.clamp(sp / 4, 0, 1.2);
      this.anim.f = sp > 0.05 ? (move / Math.max(Math.hypot(move, strafe), 0.01)) * Math.min(1, sp / 2) : 0;
      this.anim.s = sp > 0.05 ? (strafe / Math.max(Math.hypot(move, strafe), 0.01)) * Math.min(1, sp / 2) * -1 : 0;
      this.anim.stanceW = U.damp(this.anim.stanceW, U.clamp((sp - 1) / 3, 0, 1), 6, dt);
    } else this.vel.set(0, 0, 0);
    World.collide(this.pos, this.radius * this.scaleMul, true);
    Game.separate(this);
    this.pos.y = World.heightAt(this.pos.x, this.pos.z);
    this.syncRoot();
    this.anim.update(dt);
    this.updateFX(dt);
    this.updateBladeFire(dt);
  }

  processAttack(dt, player) {
    const clip = this.anim.clip, t = this.anim.t;
    // tracking
    if (clip.track && t < clip.track) this.faceTowards(player.pos, clip.trackRate || 7, dt);
    // spin (wight)
    if (clip.spin && t >= clip.spin[0] && t <= clip.spin[1]) {
      this.yaw += clip.spin[2] * dt;
      const tgt = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      const f = U.tmpV[11].set(Math.sin(tgt), 0, Math.cos(tgt));
      this.pos.addScaledVector(f, this.anim.moveSpeed() * dt);
      if (Math.random() < dt * 12) FX.dust(this.pos, 1, 0.8);
    } else if (clip.leap && t >= clip.leap[0] && t <= clip.leap[1]) {
      // ballistic leap toward the target point
      if (!this.leapSet) { this.leapSet = true; this.leapFrom.copy(this.pos); this.leapTo.copy(player.pos); const dd = this.leapFrom.distanceTo(this.leapTo); if (dd > 14) this.leapTo.lerpVectors(this.leapFrom, this.leapTo, 14 / dd); }
      const k = U.smooth((t - clip.leap[0]) / (clip.leap[1] - clip.leap[0]));
      const nx = U.lerp(this.leapFrom.x, this.leapTo.x, k), nz = U.lerp(this.leapFrom.z, this.leapTo.z, k);
      this.pos.x = nx; this.pos.z = nz;
    } else {
      this.leapSet = false;
      const ms = this.anim.moveSpeed();
      if (ms) {
        // don't push through the player
        let s = ms;
        if (ms > 0 && this.distTo(player) < this.radius * this.scaleMul + player.radius + 0.4) s = 0;
        this.pos.addScaledVector(this.forward(U.tmpV[11]), s * dt);
      }
    }
    // trail
    if (this.trail && clip.trail && t >= clip.trail[0] && t <= clip.trail[1] && this.rig.weapon) {
      if (this.kind === 'guangzhi') { this.rig.weaponPoint(0.6, U.tmpV[3]); this.rig.weaponPoint(1.5, U.tmpV[4]); }
      else { this.rig.weaponPoint(this.weaponSeg[0], U.tmpV[3]); this.rig.weaponPoint(this.weaponSeg[1], U.tmpV[4]); }
      this.trail.push(U.tmpV[3], U.tmpV[4]);
    }
    // hit windows
    const windows = clip.hits || (clip.hit ? [[clip.hit[0], clip.hit[1], clip.dmg]] : []);
    let active = false;
    windows.forEach((w, i) => {
      if (t < w[0] || t > w[1]) return;
      active = true;
      if (this.hitWindow !== i) { this.hitWindow = i; this.hitSet.clear(); }
      if (clip.multi) { this.multiT -= dt; if (this.multiT <= 0) { this.multiT = clip.multi; this.hitSet.clear(); } }
      if (this.hitSet.has(player)) return;
      let hits;
      if (clip.hitShape) {
        const j = this.rig.j[clip.hitShape.joint];
        const c = U.tmpV[13].set(...clip.hitShape.off); j.localToWorld(c);
        hits = Combat.sphereHit(c, clip.hitShape.r * this.scaleMul, [player]);
      } else hits = Combat.sweepWeapon(this, [player], 0.05);
      if (hits.length) {
        this.hitSet.add(player);
        const dir = U.tmpV[14].subVectors(player.pos, this.pos).setY(0).normalize().clone();
        const mult = this.phase2 ? 1.12 : 1;
        Game.damagePlayer({ amount: w[2] * mult, from: this, point: hits[0].point, dir, kind: this.bladeFire > 0.5 ? 'fire' : 'blade', knock: clip.knock && i === windows.length - 1 });
      }
    });
    if (!active) this.segValid = false;
    // aoe
    if (clip.aoe && !this.aoeDone && t >= clip.aoe.t) {
      this.aoeDone = true;
      let p;
      if (this.rig.weapon && this.kind !== 'wight' && clip !== Anim.G.burst) { p = this.rig.weaponPoint(1.2, U.tmpV[6]).clone(); }
      else p = this.pos.clone().addScaledVector(this.forward(U.tmpV[11]), this.kind === 'wight' ? 1.2 * this.scaleMul : 0);
      p.y = World.heightAt(p.x, p.z);
      const fire = clip.aoe.fire || (this.kind === 'guangzhi' && this.phase2);
      FX.slamFX(p, clip.aoe.r, fire ? [1.3, 0.5, 0.15] : this.kind === 'wight' ? [0.5, 0.8, 1.3] : [0.9, 0.75, 0.55]);
      if (fire) { FX.fireBurst(p, 40, clip.aoe.r * 0.5, true); Game.audio.play('fire_burst', { pos: p }); this.spawnFireGround(p, clip.aoe.r * 0.7, 5); }
      Game.audio.play('slam', { pos: p, pitch: 0.8 });
      Game.shake(clip.shake || 0.5, p);
      if (player.alive && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < clip.aoe.r + player.radius && !this.hitSet.has(player)) {
        Game.damagePlayer({ amount: clip.aoe.dmg * (this.phase2 ? 1.12 : 1), from: this, point: player.pos.clone().setY(player.pos.y + 0.8), dir: U.tmpV[14].subVectors(player.pos, p).setY(0).normalize().clone(), kind: fire ? 'fire' : 'blunt', knock: clip.aoe.knock });
      }
      if (clip === Anim.G.burst) { this.bladeFire = 1; if (this.trail) { this.trail.mat.uniforms.color.value.setRGB(1.0, 0.42, 0.12); this.trail.mat.uniforms.intensity.value = 1.0; } }
    }
    // fire wave
    if (clip.wave && !this.waveDone && t >= clip.wave) { this.waveDone = true; this.spawnFireWave(player); }
    // wisps
    if (clip.wisps && !this.wispsDone && t >= clip.wisps) { this.wispsDone = true; this.spawnWisps(player); }
  }

  updateBladeFire(dt) {
    if (this.kind !== 'guangzhi') return;
    const mat = this.model.materials.blade;
    mat.emissiveIntensity = U.damp(mat.emissiveIntensity, this.bladeFire * 2.2, 3, dt);
    if (this.bladeFire > 0.5 && this.alive) {
      if (!this.fireLight) { this.fireLight = World.reserveLight(); }
      for (const y of [1.2, -1.2]) {
        let n = dt * 110;
        while (n > 0) {
          if (n < 1 && Math.random() > n) break;
          n -= 1;
          const p = this.rig.weaponPoint(y * (0.72 + Math.random() * 0.5), U.tmpV[15]);
          FX.flame(p, 0.85, 1.7);
          if (Math.random() < 0.2) FX.ember(p, 0.5);
        }
      }
      if (this.fireLight) {
        this.fireLight.position.copy(this.pos).setY(this.pos.y + 1.6);
        this.fireLight.color.setRGB(1, 0.5, 0.18);
        this.fireLight.distance = 12;
        this.fireLight.intensity = 6 + Math.sin(performance.now() * 0.02) * 1.5;
      }
    } else if (this.fireLight) { this.fireLight.intensity = 0; }
  }
  spawnFireGround(p, r, life) {
    const owner = this;
    Combat.spawnHazard({
      pos: p.clone(), r, life, dmg: 12, tick: 0.5, owner,
      update: (h, dt) => {
        const k = 1 - h.age / h.life;
        if (Math.random() < dt * 25 * k * r) {
          const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * h.r;
          const q = U.tmpV[15].set(h.pos.x + Math.cos(a) * rr, 0, h.pos.z + Math.sin(a) * rr); q.y = World.heightAt(q.x, q.z);
          FX.flame(q, 0.8 * k + 0.3, 1.2);
        }
      },
    });
  }
  spawnFireWave(player) {
    const f = this.forward(new THREE.Vector3());
    const start = this.pos.clone().addScaledVector(f, 1.5);
    const owner = this;
    Game.audio.play('fire_burst', { pos: start });
    let dropT = 0;
    Combat.spawnProjectile({
      pos: start.setY(start.y + 0.5), vel: f.multiplyScalar(12), r: 1.1, dmg: 75, life: 1.5, kind: 'fire', owner, knock: true,
      update: (p, dt) => {
        p.pos.y = World.heightAt(p.pos.x, p.pos.z) + 0.5;
        for (let i = 0; i < 4; i++) FX.flame(U.tmpV[15].set(p.pos.x + FX.R(-0.6, 0.6), p.pos.y - 0.4, p.pos.z + FX.R(-0.6, 0.6)), 1.3, 2.2);
        dropT -= dt;
        if (dropT <= 0) { dropT = 0.22; owner.spawnFireGround(p.pos.clone().setY(p.pos.y - 0.5), 1.2, 3.5); }
      },
    });
  }
  spawnWisps(player) {
    const n = this.phase2 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.yaw;
      const p = this.pos.clone().add(new THREE.Vector3(Math.cos(a) * 1.6, 2.6 * this.scaleMul, Math.sin(a) * 1.6));
      const light = null;
      const delay = 0.5 + i * 0.25;
      Combat.spawnProjectile({
        pos: p, vel: new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)).multiplyScalar(2), r: 0.45, dmg: 45, life: 6 + delay, kind: 'ghost', owner: this, homing: 0, delayT: delay,
        update: (pr, dt) => {
          pr.delayT -= dt;
          if (pr.delayT <= 0 && !pr.homing) { pr.homing = 1.8; pr.vel.setLength(7.5); Game.audio.play('wisp', { pos: pr.pos }); }
          if (pr.delayT > 0) pr.vel.multiplyScalar(0.96);
          for (let k = 0; k < 2; k++) FX.add.emit({ x: pr.pos.x + FX.R(-0.1, 0.1), y: pr.pos.y + FX.R(-0.1, 0.1), z: pr.pos.z + FX.R(-0.1, 0.1), vx: FX.R(-0.3, 0.3), vy: FX.R(0.3, 1), vz: FX.R(-0.3, 0.3), life: FX.R(0.3, 0.6), s0: FX.R(0.3, 0.5), s1: 0.05, c0: [0.5, 1.2, 2.6, 0.9], c1: [0.2, 0.4, 1.4, 0] });
          FX.add.emit({ x: pr.pos.x, y: pr.pos.y, z: pr.pos.z, life: 0.05, s0: 0.7, s1: 0.7, c0: [0.9, 1.6, 3, 0.6], c1: [0.5, 1, 2, 0.6] });
        },
        onEnd: (pr) => { FX.hitSparks(pr.pos, null, 10, [0.4, 0.7, 1.4], 4); },
      });
    }
  }
}
