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
    H_MAX: 1560,

    /* 物理:斜面滚珠(低重力慢滚),弹道爬升需要较高初速 */
    gravity: 2000,       // 斜面下滑分量(真实 45° 倾斜比例)
    maxSpeed: 3400,        // 全局限速
    airDrag: 0.1,
    ballR: 15,
    pegR: 9,

    /* 布局 */
    layout: {
      backH: 323,          // 顶部标题面板高度(底缘 = 顶轨上缘 323,与轨相接,不浮空)
      panelH: 250,         // 底部操作台
      fieldX0: 21,         // 场地左缘(左墙轨中心,轨带 14..28 与白框相接,沿边界)
      ceilingY: 330,       // 顶部导轨(轨带上缘与标题面板底缘齐平)
      cornerR: 64,         // 左右导流圆弧角(缩小:两侧导轨大部分竖直,只留小圆角)
      laneW: 80,           // 右侧弹道宽(内墙 face 到右墙 face 40px,球径 30 顺滑通过)
      laneTop: 445,        // 弹道内墙顶端,弹珠越过它进入场内
      pegTop: 430,
      pegBottomPad: 160,
      bumpers: { r: 17, boost: 0, fx: [0.22, 0.7, 0.45], fy: [0.3, 0.42, 0.68] }
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
      maxSpeed: 3400,      // 100% = 掠过顶轨直到最左
      crestPower: 0.4,     // 蓄力 40% = 恰好飞出发射区(前段曲线终点)
      crestSpeed: 1900,    // 40% 时的临界速度(实测标定);后 60% 线性增大到 maxSpeed
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

    colors: {},
    themeName: 'min',

    /* 双主题配色:极简(默认)/ 复古街机(可选,setTheme 原地覆写 colors) */
    palettes: {
      min: {
        /* 机台(暖白极简) */
        cabYellow: '#f6f4ef', cabYellowHi: '#fbfaf7', cabYellowLo: '#e7e4da',
        frame: '#ffffff', panelText: '#3a3a3a',
        fieldTop: '#f3f1ea', fieldBot: '#eeebe2',
        star: 'rgba(255,255,255,0.8)', glassShine: 'rgba(255,255,255,0.30)',
        ledRed: '#e8553f', ledGreen: '#58b26a', ledDim: 'rgba(0,0,0,0.10)',
        segBg: '#1d1d1f', segFrame: 'rgba(255,255,255,0.06)', segRed: '#ff5340',
        pegBody: '#ffffff', pegRim: 'rgba(0,0,0,0.10)', pegFlash: '#ffffff',
        bumperRing: 'rgba(0,0,0,0.12)',
        rail: '#2f2d29', railHi: '#3a3833', holeDark: '#141311', holeLit: '#ff4a38',
        marbleTints: ['#7ec8ff', '#ff9ecb', '#b5e8a0', '#ffd966', '#c9a8ff', '#ff8a5c'],
        text: '#3a3a3a', cream: '#ffffff', dim: '#9a9a9a', gold: '#ffcf5e', red: '#e8553f',
        /* 主题差异件 */
        laneArrow: 'rgba(0,0,0,0.14)', laneSlot: 'rgba(0,0,0,0.045)',
        laneEdge: '#dcd8cc', capDot: '#dcd8cc',
        trackMain: '#e0dcd1', trackHi: 'rgba(255,255,255,0.85)',
        dividerLine: 'rgba(255,255,255,0.28)', capFill: '#ffffff', capStroke: 'rgba(0,0,0,0.12)',
        holeStroke: 'rgba(255,255,255,0.10)',
        ledLabel: 'rgba(255,255,255,0.4)', finePrint: 'rgba(58,58,58,0.55)',
        barTrack: 'rgba(0,0,0,0.07)',
        goBg: '#3a3a3a', goPress: '#2e2e2e', goRing: null,
        selBg: '#3a3a3a', selSub: 'rgba(255,255,255,0.7)',
        pillBg: '#ffffff', pillLine: 'rgba(0,0,0,0.08)', pillText: '#3a3a3a',
        pillDis: 'rgba(0,0,0,0.04)', pillDisText: 'rgba(0,0,0,0.28)',
        pow1: '#c9c5bc', pow2: '#3a3a3a', pow3: '#e8553f',
        pulseColor: '#ffffff', pulseRing: 'rgba(58,58,58,'
      },
      arcade: {
        /* 机台(金黄街机) */
        cabYellow: '#f9b234', cabYellowHi: '#ffcf5e', cabYellowLo: '#e0961f',
        frame: '#f8f4ea', panelText: '#6b4409',
        fieldTop: '#f8e3ad', fieldBot: '#eccf85',
        star: 'rgba(255,255,255,0.8)', glassShine: 'rgba(255,255,255,0.30)',
        ledRed: '#ff4a3a', ledGreen: '#3ce06a', ledDim: 'rgba(120,80,30,0.35)',
        segBg: '#1c0604', segFrame: '#3a1508', segRed: '#ff3222',
        pegBody: 'rgba(255,255,255,0.85)', pegRim: 'rgba(166,120,52,0.75)', pegFlash: '#ffffff',
        bumperRing: 'rgba(166,120,52,0.9)',
        rail: '#8a5a22', railHi: '#a5712e', holeDark: '#31200c', holeLit: '#ff3b2e',
        marbleTints: ['#7ec8ff', '#ff9ecb', '#b5e8a0', '#ffd966', '#c9a8ff', '#ff8a5c'],
        text: '#6b4409', cream: '#fff8ea', dim: '#a8813f', gold: '#ffcf5e', red: '#e8352e',
        /* 主题差异件 */
        laneArrow: 'rgba(255,209,102,0.5)', laneSlot: 'rgba(120,80,30,0.14)',
        laneEdge: '#e0961f', capDot: '#ffcf5e',
        trackMain: '#e0961f', trackHi: '#ffcf5e',
        dividerLine: 'rgba(90,55,15,0.55)', capFill: '#fdf9f2', capStroke: '#c9973f',
        holeStroke: 'rgba(255,255,255,0.28)',
        ledLabel: 'rgba(255,120,100,0.75)', finePrint: 'rgba(107,68,9,0.8)',
        barTrack: 'rgba(90,55,15,0.25)',
        goBg: '#e0392e', goPress: '#c62f2f', goRing: '#ffffff',
        selBg: '#e8352e', selSub: '#ffd9c9',
        pillBg: '#fff8ea', pillLine: '#e8b45a', pillText: '#6b4409',
        pillDis: 'rgba(120,90,50,0.35)', pillDisText: 'rgba(107,68,9,0.5)',
        pow1: '#7ec850', pow2: '#ffb84d', pow3: '#ff5c47',
        pulseColor: '#ffd166', pulseRing: 'rgba(255,255,255,'
      }
    },

    setTheme: function (name) {
      var p = this.palettes[name] || this.palettes.min;
      var c = this.colors;
      for (var k in p) c[k] = p[k];
      this.themeName = (name === 'arcade') ? 'arcade' : 'min';
    }
  };

  CFG.setTheme('min');

  MG.config = CFG;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
