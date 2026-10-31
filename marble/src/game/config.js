/* 弹弹珠机 - 全局配置与调参 (命名空间: MG.config)
 * 复刻「玻璃珠自动贩卖游艺机」:
 *   - 右下角拉杆把弹珠往上弹,沿右侧弹道冲过顶部导弧拐入斜面场地
 *   - 场地斜面约 45°(低重力慢滚),弹珠穿过 LED 钉阵滚落
 *   - 右下角自选投入弹珠数(1~5 颗)= 选倍率 ×2~×10;
 *     投入越多亮灯的洞越少;从亮灯洞滑落赢回 投入×倍率 颗弹珠
 *   - 洞口没有分数,只负责亮灯
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});

  var CFG = {
    /* 逻辑分辨率:宽度固定 750,高度按屏幕比例自适应 */
    DESIGN_W: 750,
    H_MIN: 1200,
    H_MAX: 1800,

    /* 物理:斜面滚珠(低重力慢滚),弹道爬升需要较高初速 */
    gravity: 2000,       // 斜面下滑分量(真实 45° 倾斜比例)
    maxSpeed: 2800,        // 全局限速
    airDrag: 0.1,
    ballR: 15,
    pegR: 9,

    /* 布局 */
    layout: {
      backH: 300,          // 顶部背板
      panelH: 250,         // 底部操作台
      fieldX0: 30,         // 场地左缘(左墙内面)
      ceilingY: 330,       // 顶部导轨(场内,弹珠沿它横扫)
      cornerR: 140,        // 左右两个导流圆弧角(加大:贴轨滑行清晰可见)
      laneW: 88,           // 右侧弹道宽(加宽:球心离右墙 10px,避开导流弧端点)
      laneTop: 445,        // 弹道内墙顶端,弹珠越过它进入场内
      pegTop: 540,
      pegBottomPad: 160,
      bumpers: { r: 17, boost: 300, fx: [0.22, 0.7, 0.45], fy: [0.3, 0.42, 0.68] }
    },

    /* 底部洞口:13 个,没有分数,只会亮灯 */
    pockets: {
      count: 13,
      capOff: 46
    },

    /* 倍率档位:右下角自选投入弹珠数 → 倍率 / 亮灯数 */
    tiers: [
      { cost: 1, mult: 2, lit: 5 },
      { cost: 2, mult: 3, lit: 4 },
      { cost: 3, mult: 4, lit: 3 },
      { cost: 4, mult: 5, lit: 2 },
      { cost: 5, mult: 6, lit: 1 }
    ],
    winBase: 0,            // 中奖直接赢 投入×倍率 颗弹珠(无额外基础分)
    giftCardMult: 6,       // ×6 及以上中奖送礼品卡
    startBank: 20,         // 每局初始弹珠库

    /* 发射(右下角,竖直向上) */
    launcher: {
      minSpeed: 500,       // 0% = 只弹起一点点,滚回退还
      maxSpeed: 2450,      // 100% = 掠过顶轨直到最左
      crestPower: 0.4,     // 蓄力 40% = 恰好飞出发射区(前段曲线终点)
      crestSpeed: 2000,    // 40% 时的临界速度;后 60% 线性增大到 maxSpeed
      cooldown: 0.3,
      tapPower: 0.05,      // 快速点按 = 5% 轻弹(必须蓄力才有速度)
      chargeSpeed: 0.8,
      tapJudge: 0.16,
      refundSlow: 60,      // 弹道内低速视为滚回
      refundTime: 0.4
    },

    /* 计分 */
    scoring: {
      bumper: 0,           // 大弹柱不再给分,纯物理乐趣
      bonusScore: 0        // 已由弹珠库经济取代
    },

    colors: {
      /* 机台(暖白极简) */
      cabYellow: '#f6f4ef',
      cabYellowHi: '#fbfaf7',
      cabYellowLo: '#e7e4da',
      frame: '#ffffff',
      panelText: '#3a3a3a',
      /* 场地(浅暖灰) */
      fieldTop: '#f3f1ea',
      fieldBot: '#eeebe2',
      star: 'rgba(255,255,255,0.8)',
      glassShine: 'rgba(255,255,255,0.30)',
      /* LED */
      ledRed: '#e8553f',
      ledGreen: '#58b26a',
      ledDim: 'rgba(0,0,0,0.10)',
      segBg: '#1d1d1f',
      segFrame: 'rgba(255,255,255,0.06)',
      segRed: '#ff5340',
      /* 场内元件 */
      pegBody: '#ffffff',
      pegRim: 'rgba(0,0,0,0.10)',
      pegFlash: '#ffffff',
      bumperRing: 'rgba(0,0,0,0.12)',
      /* 洞口 */
      rail: '#2f2d29',
      railHi: '#3a3833',
      holeDark: '#141311',
      holeLit: '#ff4a38',
      /* 玻璃弹珠 */
      marbleTints: ['#7ec8ff', '#ff9ecb', '#b5e8a0', '#ffd966', '#c9a8ff', '#ff8a5c'],
      /* 文案 */
      text: '#3a3a3a',
      cream: '#ffffff',
      dim: '#9a9a9a',
      gold: '#ffcf5e',
      red: '#e8553f'
    }
  };

  MG.config = CFG;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
