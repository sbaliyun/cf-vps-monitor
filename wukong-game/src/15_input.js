// ---------------------------------------------------------------------------
// Input: keyboard + mouse (pointer lock), gamepad, touch controls
// Actions: light, heavy(hold), dodge, sprint(hold), lock, spell1..3, gourd,
//          interact, pause
// ---------------------------------------------------------------------------
const Input = (() => {
  const keys = new Set();
  const pressed = new Set();   // edge-triggered this frame
  const released = new Set();
  let mdx = 0, mdy = 0, wheel = 0;
  let locked = false;
  let enabled = false;
  const touch = { active: false, mx: 0, my: 0, lookId: null, lastX: 0, lastY: 0, moveId: null, ox: 0, oy: 0, held: new Set() };
  let sensitivity = 1;
  let gpPrev = {};
  let canvas;

  const KEYMAP = {
    KeyJ: 'light', KeyK: 'heavy', Space: 'dodge', ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyQ: 'lock', Tab: 'lock',
    Digit1: 'spell1', Digit2: 'spell2', Digit3: 'spell3', KeyR: 'gourd', KeyE: 'interact', KeyF: 'interact', Escape: 'pause', KeyP: 'pause',
  };
  const actionDown = new Set();

  function press(a) { if (!actionDown.has(a)) { actionDown.add(a); pressed.add(a); } }
  function release(a) { if (actionDown.has(a)) { actionDown.delete(a); released.add(a); } }

  function init(cv) {
    canvas = cv;
    addEventListener('keydown', e => {
      if (!enabled && e.code !== 'Escape') return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      keys.add(e.code);
      const a = KEYMAP[e.code]; if (a) press(a);
    });
    addEventListener('keyup', e => {
      keys.delete(e.code);
      const a = KEYMAP[e.code]; if (a) release(a);
    });
    addEventListener('blur', () => { keys.clear(); for (const a of [...actionDown]) release(a); });
    canvas.addEventListener('mousedown', e => {
      if (!enabled) return;
      if (!locked && !touch.active) requestLock();
      if (e.button === 0) press('light');
      if (e.button === 2) press('heavy');
      if (e.button === 1) { press('lock'); e.preventDefault(); }
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) release('light');
      if (e.button === 2) release('heavy');
      if (e.button === 1) release('lock');
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      if (!enabled) return;
      if (locked || document.pointerLockElement === canvas) { mdx += e.movementX; mdy += e.movementY; }
      else if (e.buttons === 0 && !touch.active) { mdx += e.movementX * 0.6; mdy += e.movementY * 0.6; }
    });
    addEventListener('wheel', e => { if (enabled) wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
    initTouch();
  }
  function requestLock() {
    try {
      const r = canvas.requestPointerLock && canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => { });
    } catch (e) { }
  }
  function exitLock() { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } }

  // ---- Touch ----------------------------------------------------------------------
  function initTouch() {
    const ui = document.getElementById('touch');
    if (!ui) return;
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isTouch) return;
    touch.active = true; ui.hidden = false;
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    const onStart = e => {
      for (const t of e.changedTouches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const btn = el && el.closest('[data-act]');
        if (btn) { const a = btn.dataset.act; press(a); touch.held.add(t.identifier + ':' + a); btn.classList.add('on'); e.preventDefault(); continue; }
        if (t.clientX < innerWidth * 0.42 && touch.moveId === null) {
          touch.moveId = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY; touch.mx = touch.my = 0;
          stick.style.left = (t.clientX - 60) + 'px'; stick.style.top = (t.clientY - 60) + 'px'; stick.classList.add('on');
        } else if (touch.lookId === null) { touch.lookId = t.identifier; touch.lastX = t.clientX; touch.lastY = t.clientY; }
      }
    };
    const onMove = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === touch.moveId) {
          let dx = t.clientX - touch.ox, dy = t.clientY - touch.oy; const l = Math.hypot(dx, dy), m = 50;
          if (l > m) { dx *= m / l; dy *= m / l; }
          touch.mx = dx / m; touch.my = dy / m;
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
        } else if (t.identifier === touch.lookId) {
          mdx += (t.clientX - touch.lastX) * 1.6; mdy += (t.clientY - touch.lastY) * 1.6;
          touch.lastX = t.clientX; touch.lastY = t.clientY;
        }
      }
      e.preventDefault();
    };
    const onEnd = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === touch.moveId) { touch.moveId = null; touch.mx = touch.my = 0; knob.style.transform = ''; stick.classList.remove('on'); }
        if (t.identifier === touch.lookId) touch.lookId = null;
        for (const k of [...touch.held]) {
          const [id, a] = k.split(':');
          if (+id === t.identifier) { release(a); touch.held.delete(k); document.querySelectorAll(`[data-act="${a}"]`).forEach(b => b.classList.remove('on')); }
        }
      }
    };
    const layer = document.getElementById('game');
    layer.addEventListener('touchstart', onStart, { passive: false });
    layer.addEventListener('touchmove', onMove, { passive: false });
    layer.addEventListener('touchend', onEnd); layer.addEventListener('touchcancel', onEnd);
    ui.addEventListener('touchstart', onStart, { passive: false });
    ui.addEventListener('touchmove', onMove, { passive: false });
    ui.addEventListener('touchend', onEnd); ui.addEventListener('touchcancel', onEnd);
  }

  // ---- Gamepad ---------------------------------------------------------------------
  const gp = { mx: 0, my: 0, lx: 0, ly: 0, connected: false };
  const GPMAP = { 2: 'light', 3: 'heavy', 1: 'dodge', 0: 'sprint', 5: 'lock', 11: 'lock', 12: 'gourd', 14: 'spell1', 15: 'spell3', 13: 'spell2', 9: 'pause', 4: 'interact' };
  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(x => x);
    if (!p) { gp.connected = false; return; }
    gp.connected = true;
    const dz = v => Math.abs(v) < 0.15 ? 0 : v;
    gp.mx = dz(p.axes[0]); gp.my = dz(p.axes[1]); gp.lx = dz(p.axes[2]); gp.ly = dz(p.axes[3]);
    for (const [bi, a] of Object.entries(GPMAP)) {
      const b = p.buttons[bi]; const down = b && b.pressed;
      const k = 'gp' + bi;
      if (down && !gpPrev[k]) press(a);
      if (!down && gpPrev[k]) release(a);
      gpPrev[k] = down;
    }
  }

  // ---- Per-frame API -----------------------------------------------------------------
  function frame() {
    pollGamepad();
    const out = {
      moveX: 0, moveY: 0, lookX: 0, lookY: 0, zoom: 0,
      down: a => actionDown.has(a),
      pressed: a => pressed.has(a),
      released: a => released.has(a),
    };
    if (keys.has('KeyW') || keys.has('ArrowUp')) out.moveY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) out.moveY += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) out.moveX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) out.moveX += 1;
    out.moveX += touch.mx + gp.mx; out.moveY += touch.my + gp.my;
    const l = Math.hypot(out.moveX, out.moveY); if (l > 1) { out.moveX /= l; out.moveY /= l; }
    out.lookX = mdx * 0.0024 * sensitivity + gp.lx * 0.05 * sensitivity;
    out.lookY = mdy * 0.0024 * sensitivity + gp.ly * 0.035 * sensitivity;
    out.zoom = wheel;
    mdx = mdy = 0; wheel = 0;
    return out;
  }
  function endFrame() { pressed.clear(); released.clear(); }
  function clear() { pressed.clear(); released.clear(); for (const a of [...actionDown]) actionDown.delete(a); keys.clear(); }

  return {
    init, frame, endFrame, clear, requestLock, exitLock,
    get locked() { return locked; }, get touch() { return touch.active; },
    set enabled(v) { enabled = v; if (!v) clear(); }, get enabled() { return enabled; },
    set sensitivity(v) { sensitivity = v; }, get sensitivity() { return sensitivity; },
    press, release,
  };
})();
