'use strict';
/* 王者之弈 · 声音：古筝拨弦（Karplus-Strong）与合成音效 */
(function (G) {
  const AU = G.audio = { ctx: null, sfxOn: true, musicOn: true, ready: false };
  try { const s = JSON.parse(localStorage.getItem('wzzy_audio') || '{}'); if (s.sfx === false) AU.sfxOn = false; if (s.music === false) AU.musicOn = false; } catch (e) { /* ignore */ }
  AU.saveSettings = function () { try { localStorage.setItem('wzzy_audio', JSON.stringify({ sfx: AU.sfxOn, music: AU.musicOn })); } catch (e) { /* ignore */ } };

  const plucks = {};
  let noiseBuf = null;
  AU.init = function () {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = AU.ctx = new AC();
    AU.master = ctx.createGain(); AU.master.gain.value = 0.8; AU.master.connect(ctx.destination);
    AU.sfxGain = ctx.createGain(); AU.sfxGain.gain.value = 0.55; AU.sfxGain.connect(AU.master);
    AU.musicGain = ctx.createGain(); AU.musicGain.gain.value = AU.musicOn ? 0.22 : 0; AU.musicGain.connect(AU.master);
    // 混响
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    conv.buffer = ir;
    AU.rev = ctx.createGain(); AU.rev.gain.value = 0.3; AU.rev.connect(conv); conv.connect(AU.master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    AU.ready = true;
    if (AU.musicOn) AU.startMusic();
  };

  // 古筝音：Karplus-Strong
  function pluckBuf(freq) {
    const k = Math.round(freq);
    if (plucks[k]) return plucks[k];
    const ctx = AU.ctx, sr = ctx.sampleRate, dur = 2.2;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr), d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq)), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let p = 0, prev = 0;
    for (let i = 0; i < d.length; i++) {
      const cur = ring[p];
      const nx = ring[(p + 1) % N];
      ring[p] = (cur + nx) * 0.4985;
      d[i] = cur * 0.6 + prev * 0.4; prev = cur;
      p = (p + 1) % N;
    }
    for (let i = 0; i < 200; i++) d[i] *= i / 200;
    plucks[k] = buf;
    return buf;
  }
  function pluck(freq, when, vol, dest, pan) {
    const ctx = AU.ctx;
    const src = ctx.createBufferSource(); src.buffer = pluckBuf(freq);
    const g = ctx.createGain(); g.gain.value = vol;
    let node = g;
    if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    src.connect(g); node.connect(dest || AU.sfxGain); node.connect(AU.rev);
    src.start(when || ctx.currentTime);
  }
  function tone(type, f0, f1, dur, vol, when, dest) {
    const ctx = AU.ctx, t = when || ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || AU.sfxGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, fType, f0, f1, when) {
    const ctx = AU.ctx, t = when || ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = fType || 'bandpass'; f.frequency.setValueAtTime(f0 || 1200, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(AU.sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  // 宫商角徵羽（D 调五声）
  const PENTA = [146.83, 164.81, 185.0, 220.0, 246.94];
  const note = i => PENTA[((i % 5) + 5) % 5] * Math.pow(2, Math.floor(i / 5));

  let lastHit = 0;
  AU.play = function (name) {
    if (!AU.ready || !AU.sfxOn) return;
    const ctx = AU.ctx, t = ctx.currentTime;
    switch (name) {
      case 'click': tone('sine', 900, 700, 0.06, 0.12); break;
      case 'buy': pluck(note(10), t, 0.5); pluck(note(12), t + 0.06, 0.4); tone('triangle', 1760, 2200, 0.08, 0.06, t + 0.02); break;
      case 'sell': pluck(note(9), t, 0.4); pluck(note(6), t + 0.07, 0.35); break;
      case 'refresh': noise(0.22, 0.25, 'bandpass', 600, 3200); pluck(note(8), t + 0.05, 0.25); break;
      case 'xp': pluck(note(7), t, 0.3); pluck(note(9), t + 0.05, 0.3); break;
      case 'levelup': [0, 2, 4, 5, 7].forEach((n, i) => pluck(note(8 + n), t + i * 0.07, 0.4)); break;
      case 'place': tone('sine', 420, 300, 0.07, 0.15); break;
      case 'equip': tone('triangle', 660, 990, 0.1, 0.12); break;
      case 'combine': [0, 2, 4].forEach((n, i) => pluck(note(10 + n), t + i * 0.05, 0.4)); tone('sine', 1320, 1980, 0.25, 0.08, t + 0.1); break;
      case 'star2': [0, 2, 4, 7].forEach((n, i) => pluck(note(10 + n), t + i * 0.06, 0.45)); break;
      case 'star3': [0, 2, 4, 5, 7, 9, 10].forEach((n, i) => pluck(note(8 + n), t + i * 0.07, 0.5)); tone('sine', 880, 1760, 0.8, 0.1, t + 0.3); break;
      case 'error': tone('square', 180, 140, 0.12, 0.06); break;
      case 'gong': { tone('sine', 98, 92, 2.2, 0.35); tone('sine', 196, 190, 1.4, 0.12); tone('sine', 311, 305, 1.0, 0.06); noise(0.3, 0.12, 'lowpass', 900, 200); break; }
      case 'battle': tone('sawtooth', 110, 55, 0.4, 0.08); noise(0.5, 0.2, 'lowpass', 400, 80); pluck(note(5), t, 0.5); pluck(note(7), t + 0.12, 0.5); break;
      case 'hit': if (t - lastHit < 0.045) return; lastHit = t; noise(0.07, 0.12, 'bandpass', 1800 + Math.random() * 800, 500); break;
      case 'hitm': if (t - lastHit < 0.045) return; lastHit = t; tone('sine', 700 + Math.random() * 200, 300, 0.1, 0.06); break;
      case 'cast': noise(0.35, 0.18, 'bandpass', 400, 2400); pluck(note(11 + Math.floor(Math.random() * 3)), t, 0.35); break;
      case 'bigcast': noise(0.6, 0.3, 'lowpass', 2400, 200); tone('sawtooth', 220, 55, 0.6, 0.08); pluck(note(5), t, 0.5); break;
      case 'death': tone('triangle', 400, 120, 0.25, 0.08); break;
      case 'win': [0, 2, 4, 7].forEach((n, i) => pluck(note(10 + n), t + i * 0.09, 0.45)); break;
      case 'lose': [7, 4, 2, 0].forEach((n, i) => pluck(note(5 + n), t + i * 0.12, 0.4)); break;
      case 'augment': [0, 4, 7, 9, 12].forEach((n, i) => pluck(note(7 + n), t + i * 0.05, 0.4)); tone('sine', 1200, 2400, 0.6, 0.06); break;
      case 'gold': [0, 1, 2, 3].forEach(i => tone('triangle', 1800 + i * 220, 2400 + i * 220, 0.08, 0.06, t + i * 0.05)); break;
      case 'victory': [0, 2, 4, 5, 7, 9, 10, 12].forEach((n, i) => pluck(note(5 + n), t + i * 0.1, 0.5)); tone('sine', 98, 98, 2.5, 0.2); break;
      case 'defeat': [9, 7, 4, 2, 0].forEach((n, i) => pluck(note(n), t + i * 0.18, 0.45)); break;
      case 'open': pluck(note(12), t, 0.35); pluck(note(14), t + 0.08, 0.3); break;
    }
  };

  /* 背景乐：生成式五声旋律 */
  let musicTimer = null, beat = 0, nextT = 0, melodyPos = 7;
  AU.startMusic = function () {
    if (!AU.ready || musicTimer) return;
    nextT = AU.ctx.currentTime + 0.1; beat = 0;
    musicTimer = setInterval(schedule, 120);
  };
  AU.stopMusic = function () { clearInterval(musicTimer); musicTimer = null; };
  function schedule() {
    const ctx = AU.ctx; if (!ctx) return;
    const spb = 60 / 76 / 2; // 八分音符
    while (nextT < ctx.currentTime + 0.4) {
      const bar = Math.floor(beat / 8), pos = beat % 8;
      // 低音
      if (pos === 0) pluck(note([0, -2, -3, -1][bar % 4]), nextT, 0.5, AU.musicGain, -0.3);
      if (pos === 4) pluck(note([2, 1, 0, 2][bar % 4]), nextT, 0.35, AU.musicGain, -0.2);
      // 旋律
      const play = pos % 2 === 0 ? Math.random() < 0.75 : Math.random() < 0.3;
      if (play) {
        melodyPos += pick([-2, -1, -1, 0, 1, 1, 2]);
        melodyPos = Math.max(5, Math.min(14, melodyPos));
        pluck(note(melodyPos), nextT, 0.28 + Math.random() * 0.12, AU.musicGain, 0.25);
        if (Math.random() < 0.18) pluck(note(melodyPos + 1), nextT + spb * 0.5, 0.18, AU.musicGain, 0.3); // 滑音装饰
      }
      // 木鱼
      if (pos === 6 && bar % 2 === 1) tone('sine', 820, 760, 0.05, 0.05, nextT, AU.musicGain);
      nextT += spb; beat++;
    }
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  AU.setMusic = function (on) {
    AU.musicOn = on; AU.saveSettings();
    if (!AU.ready) return;
    AU.musicGain.gain.setTargetAtTime(on ? 0.22 : 0, AU.ctx.currentTime, 0.2);
    if (on) AU.startMusic();
  };
  AU.setSfx = function (on) { AU.sfxOn = on; AU.saveSettings(); };
})(window.G);
