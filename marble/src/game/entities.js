/* 弹弹珠机 - 实体 (命名空间: MG.entities) */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});
  var CFG = MG.config;

  /* 一颗弹珠(动态球体,物理世界里由 World 驱动) */
  function Marble(x, y, vx, vy, skin) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = CFG.ballR;
    this.skin = skin || 0;
    this.points = 0;      // 这颗弹珠本局攒到的分(落袋时乘槽位倍数)
    this.dead = false;
    this.age = 0;
    this.slowT = 0;       // 低速计时(卡住检测)
    this.nudges = 0;      // 被顶开次数
    this.trail = [];
    this.trailT = 0;
    this.wallSndT = 0;
  }

  MG.entities = { Marble: Marble };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
