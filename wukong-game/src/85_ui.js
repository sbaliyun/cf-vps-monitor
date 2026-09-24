// ---------------------------------------------------------------------------
// HUD & overlays (DOM)
// ---------------------------------------------------------------------------
const UI = (() => {
  const $ = id => document.getElementById(id);
  let el = {};
  let toastT = 0, zoneT = 0, hintsT = 0;
  const mbars = new Map();
  const _v = new THREE.Vector3();
  let bossRef = null;

  function init() {
    el = {
      hud: $('hud'), hpFl: $('hpFl'), hpTr: $('hpTr'), mpFl: $('mpFl'), stFl: $('stFl'),
      barHp: $('barHp'), barMp: $('barMp'), barSt: $('barSt'),
      gourdN: $('gourdN'), slot1: $('slot1'), slot2: $('slot2'), slot3: $('slot3'), slotGourd: $('slotGourd'),
      pips: [...document.querySelectorAll('#focus .pip')],
      will: $('will'), zone: $('zone'), zoneName: $('zoneName'), zoneSub: $('zoneSub'),
      lockon: $('lockon'), mbars: $('mbars'), prompt: $('prompt'), promptTxt: $('promptTxt'), toast: $('toast'),
      boss: $('boss'), bossName: $('bossName'), bossFl: $('bossFl'), bossTr: $('bossTr'), bossPz: $('bossPz'),
      hints: $('hints'), vign: $('vign'),
      chapter: $('chapterCard'), bossCard: $('bossCard'), bossTitle: $('bossTitle'), bossEpi: $('bossEpi'),
      death: $('deathCard'), win: $('winCard'), fade: $('fade'),
    };
    hintsT = 26;
    addEventListener('keydown', e => { if (e.code === 'KeyH') { hintsT = el.hints.classList.contains('off') ? 999 : 0; } });
  }
  function hud(on) { el.hud.classList.toggle('on', on); }
  function toast(msg, dur = 2) { el.toast.textContent = msg; el.toast.classList.add('on'); toastT = dur; }
  function flashBar(name) {
    const b = name === 'stamina' ? el.barSt : name === 'mana' ? el.barMp : el.barHp;
    b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
  }
  function focusPulse(level) { const p = el.pips[level - 1]; if (p) { p.classList.remove('pulse'); void p.offsetWidth; p.classList.add('pulse'); } }
  function focusUse() { }
  function zone(name, sub) {
    el.zoneName.textContent = name; el.zoneSub.textContent = sub || '';
    el.zone.classList.add('on'); zoneT = 4;
  }
  function showBoss(e) { bossRef = e; el.bossName.textContent = e.name; el.boss.classList.add('on'); }
  function hideBoss() { bossRef = null; el.boss.classList.remove('on'); }
  function bossCard(name, epi, dur = 3.2) {
    hintsT = 0;
    el.bossTitle.textContent = name; el.bossEpi.textContent = epi;
    el.bossCard.classList.add('on');
    setTimeout(() => el.bossCard.classList.remove('on'), dur * 1000);
  }
  function chapter(on) { el.chapter.classList.toggle('on', on); }
  function death(on) { el.death.classList.toggle('on', on); }
  function win(on, st) {
    if (st) {
      const m = Math.floor(st.time / 60), s = Math.floor(st.time % 60);
      $('stTime').textContent = `${m}:${String(s).padStart(2, '0')}`;
      $('stDeaths').textContent = st.deaths; $('stWill').textContent = st.will; $('stPerfect').textContent = st.perfect;
    }
    el.win.classList.toggle('on', on);
    el.win.style.pointerEvents = on ? 'auto' : 'none';
  }
  function fade(on) { el.fade.classList.toggle('on', on); }

  function project(p, cam) {
    _v.copy(p).project(cam);
    if (_v.z > 1) return null;
    return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight };
  }
  let lastHp = -1, lastBossHp = -1;
  const cache = new Map();
  // write a style property only when its value changed (avoids layout thrash)
  function css(elm, prop, val) {
    let m = cache.get(elm); if (!m) cache.set(elm, m = {});
    if (m[prop] === val) return;
    m[prop] = val;
    if (prop.startsWith('--')) elm.style.setProperty(prop, val); else elm.style[prop] = val;
  }
  function update(dt, player, cam, game) {
    // bars
    const hpP = player.hp / player.maxHp * 100;
    css(el.hpFl, 'width', hpP.toFixed(1) + '%');
    if (Math.abs(hpP - lastHp) > 0.01) { css(el.hpTr, 'width', hpP.toFixed(1) + '%'); lastHp = hpP; }
    css(el.mpFl, 'width', (player.mana / player.maxMana * 100).toFixed(1) + '%');
    css(el.stFl, 'width', (player.stamina / player.maxStamina * 100).toFixed(1) + '%');
    css(el.stFl, 'opacity', player.exhausted ? '0.45' : '1');
    if (el.gourdN.textContent !== String(player.gourd)) el.gourdN.textContent = player.gourd;
    el.slotGourd.classList.toggle('dim', player.gourd <= 0);
    for (const [k, s] of [['spell1', el.slot1], ['spell2', el.slot2], ['spell3', el.slot3]]) {
      const p = player.cd[k] / player.cdMax[k];
      css(s.firstElementChild, '--p', (p * 100).toFixed(1) + '%');
      s.classList.toggle('dim', p > 0 || player.mana < player.manaCost[k]);
    }
    for (let i = 0; i < 4; i++) {
      const f = U.clamp(player.focus - i, 0, 1);
      css(el.pips[i].firstChild, '--f', (f * 100).toFixed(0) + '%');
      el.pips[i].classList.toggle('full', f >= 1);
    }
    if (el.will.textContent !== String(player.will)) el.will.textContent = player.will;
    css(el.vign, 'opacity', (player.alive ? U.clamp(1 - player.hp / player.maxHp / 0.3, 0, 1) * (0.75 + Math.sin(performance.now() * 0.006) * 0.25) : 0).toFixed(2));
    // toasts / zone / hints
    toastT -= dt; if (toastT <= 0) el.toast.classList.remove('on');
    zoneT -= dt; if (zoneT <= 0) el.zone.classList.remove('on');
    hintsT -= dt; el.hints.classList.toggle('off', hintsT <= 0);
    // lock-on reticle
    const lk = player.lock;
    if (lk && lk.alive) {
      const s = project(_v.set(lk.pos.x, lk.pos.y + lk.height * lk.scaleMul * 0.6, lk.pos.z), cam);
      if (s) { el.lockon.classList.add('on'); el.lockon.style.transform = `translate(${s.x}px, ${s.y}px)`; } else el.lockon.classList.remove('on');
    } else el.lockon.classList.remove('on');
    // minion hp bars
    for (const e of game.enemies) {
      let b = mbars.get(e);
      const show = !e.boss && e.alive && e.active && e.hpBarT > 0 && e.hp < e.maxHp;
      if (!show) { if (b) b.hidden = true; continue; }
      if (!b) { b = document.createElement('div'); b.className = 'mbar'; b.appendChild(document.createElement('i')); el.mbars.appendChild(b); mbars.set(e, b); }
      const s = project(_v.set(e.pos.x, e.pos.y + e.height * e.scaleMul + 0.35, e.pos.z), cam);
      if (!s) { b.hidden = true; continue; }
      b.hidden = false; b.style.transform = `translate(${s.x}px, ${s.y}px)`;
      b.firstChild.style.width = (e.hp / e.maxHp * 100) + '%';
    }
    // boss
    if (bossRef) {
      const p = Math.max(0, bossRef.hp / bossRef.maxHp * 100);
      css(el.bossFl, 'width', p.toFixed(1) + '%');
      if (Math.abs(p - lastBossHp) > 0.01) { css(el.bossTr, 'width', p.toFixed(1) + '%'); lastBossHp = p; }
      css(el.bossPz, 'width', (100 - bossRef.poise / bossRef.maxPoise * 100).toFixed(1) + '%');
    }
    // interaction prompt
    const s = game.nearShrine && game.nearShrine();
    el.prompt.classList.toggle('on', !!s && player.state === 'move' && player.alive);
  }
  return { init, hud, toast, flashBar, focusPulse, focusUse, zone, showBoss, hideBoss, bossCard, chapter, death, win, fade, update };
})();
