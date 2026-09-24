'use strict';
/* 王者之弈 · 启动与主循环 */
(function (G) {
  function ready() {
    const fontReady = document.fonts && document.fonts.load
      ? Promise.race([
          Promise.all([
            document.fonts.load('40px "Ma Shan Zheng"', '王者之弈战法猎刺辅长三稷城楚神金禄刷学商力泉疾暴甲龙财息贤兵先盾生血背斩将宝星王赌侠骸箱契训'),
            document.fonts.load('700 20px "Barlow Condensed"', '0123456789')
          ]),
          new Promise(r => setTimeout(r, 2500))
        ]).catch(() => {})
      : Promise.resolve();
    fontReady.then(start);
  }
  function start() {
    G.art.preload();
    G.render.init(document.getElementById('cv'));
    G.ui.init();
    const unlock = () => { G.audio.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      try {
        if (!G.ui.isPaused()) G.tick(dt);
        G.render.frame(dt, G.view);
        G.ui.frame(dt);
      } catch (e) { console.error(e); }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    G.booted = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})(window.G);
