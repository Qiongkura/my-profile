/* 弹弹珠机 - 启动入口(三端共用) */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});

  function boot() {
    var platform = MG.platform.create();
    platform.setPreferredFramesPerSecond(60);
    var game = new MG.Game(platform);
    window.__mgGame = game;   /* 调试句柄 */
    game.start();
    MG.__game = game; /* 调试用 */
    return game;
  }

  MG.main = { boot: boot };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  } else {
    boot(); /* 小游戏环境无 document,直接启动 */
  }
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
