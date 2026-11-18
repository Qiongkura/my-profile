/* 弹弹弹珠吧 - 实体 (命名空间: MG.entities) */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});
  var CFG = MG.config;

  /* 一颗弹珠(动态球体,物理世界里由 World 驱动;构造期完整初始化字段以固定对象形状) */
  function Marble(x, y, vx, vy, skin) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = CFG.ballR;
    this.skin = skin || 0;
    this.bet = 1;
    this.mult = 2;
    this.dead = false;
    this.age = 0;
    this.refundT = 0;
    this.stuckTotal = 0;
    this.rescueCd = 0;
    this.rescues = 0;
    this.nudgeCd = 0;
    this.wallSndT = 0;
    this.trail = [];
    this.trailT = 0;
  }

  MG.entities = { Marble: Marble };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
