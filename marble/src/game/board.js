/* 弹弹弹珠吧 - 机器布局生成 (命名空间: MG.board)
 * 复刻玻璃珠游艺机布局:
 *   - 右下角弹道:拉杆把弹珠竖直向上弹,冲过顶部导弧拐入场内
 *   - 斜面场地:四角圆弧(右上为弹道导弧,左上为拐弯弧)
 *   - 钉阵(部分带红/绿 LED)+ 3 个大弹柱
 *   - 底部 13 个洞口:没有分数,只负责亮灯(亮灯由游戏层按投入档位控制)
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});
  var CFG = MG.config;
  var U = MG.util;

  function build(round, W, H, rng) {
    var L = CFG.layout;
    var backH = L.backH;
    var panelH = L.panelH;
    var fieldX0 = L.fieldX0;

    /* ---- 右侧弹道(右下角向上,单珠宽) ---- */
    var laneX0 = W - L.laneW;
    var laneX1 = W - 15;
    var laneCx = (laneX0 + 8 + (W - 28)) / 2;
    /* ---- 场地几何 ---- */
    var floorY = H - panelH - 14;
    var fieldRight = laneX0 - 10;

    /* ---- 右侧弹道底部与场地底线齐平 ---- */
    var laneFloorY = floorY;
    var spawn = { x: laneCx, y: laneFloorY - 42 };

    /* ---- 底部洞口(13 个,无分数) ---- */
    var n = CFG.pockets.count;
    var innerX0 = fieldX0 + 7;
    var pw = (fieldRight - innerX0) / n;
    var holes = [];
    for (var i = 0; i < n; i++) {
      holes.push({
        x0: innerX0 + i * pw, x1: innerX0 + (i + 1) * pw,
        cx: innerX0 + (i + 0.5) * pw,
        lit: false, flash: 0
      });
    }
    var capY = floorY - CFG.pockets.capOff;

    /* 洞间隔针:低弹性 + 近零摩擦 */
    var dividers = [];
    for (var d = 1; d < n; d++) {
      var dx = innerX0 + d * pw;
      dividers.push({ x1: dx, y1: capY - 40, x2: dx, y2: floorY, half: 3, e: 0.08, friction: 0.995, kind: 'divider' });
    }

    /* ---- 钉阵 ---- */
    var pegTop = L.pegTop;
    var pegBottom = floorY - L.pegBottomPad;
    var rows = U.clamp(Math.floor((pegBottom - pegTop) / 92), 4, 7);
    var rowGap = (pegBottom - pegTop) / (rows - 1);
    var fieldW = fieldRight - fieldX0;
    var spacing = fieldW / 8;
    var pegs = [];
    for (var r = 0; r < rows; r++) {
      var count = (r % 2 === 0) ? 8 : 7;
      var off = (r % 2 === 0) ? spacing / 2 : spacing;
      var y = pegTop + r * rowGap + (rng() - 0.5) * 10;
      for (var c = 0; c < count; c++) {
        var x = fieldX0 + off + c * spacing + (rng() - 0.5) * 10;
        x = U.clamp(x, fieldX0 + 52, fieldRight - 43);
        var led = rng();
        pegs.push({
          x: x, y: y, r: CFG.pegR, flash: 0,
          led: led < 0.28 ? 'red' : (led < 0.52 ? 'green' : null),
          slideDir: (x > fieldRight - 150) ? -1 : ((x < fieldX0 + 150) ? 1 : (rng() < 0.5 ? -1 : 1))
        });
      }
    }

    /* ---- 大弹柱 ---- */
    var bumpers = [];
    var BF = L.bumpers;
    for (var bi = 0; bi < BF.fx.length; bi++) {
      bumpers.push({
        x: fieldX0 + 34 + BF.fx[bi] * (fieldW - 68),
        y: pegTop + BF.fy[bi] * (pegBottom - pegTop),
        r: BF.r, kind: 'bumper', boost: BF.boost, pulse: 0
      });
    }

    /* 清理与弹柱冲突的钉子 */
    var cleared = [];
    for (var pi = 0; pi < pegs.length; pi++) {
      var peg = pegs[pi];
      var bad = false;
      for (var q = 0; q < bumpers.length; q++) {
        if (U.dist(peg.x, peg.y, bumpers[q].x, bumpers[q].y) < bumpers[q].r + peg.r + CFG.ballR * 2 + 6) { bad = true; break; }
      }
      if (!bad) cleared.push(peg);
    }
    pegs = cleared;

    /* ---- 弧段工具 ---- */
    function arcSegs(cx, cy, radius, a0, a1, steps) {
      var out = [];
      for (var s = 0; s < steps; s++) {
        var b0 = a0 + (a1 - a0) * (s / steps);
        var b1 = a0 + (a1 - a0) * ((s + 1) / steps);
        out.push({
          x1: cx + Math.cos(b0) * radius, y1: cy + Math.sin(b0) * radius,
          x2: cx + Math.cos(b1) * radius, y2: cy + Math.sin(b1) * radius,
          half: 8, e: 0.05, kind: 'rail'
        });
      }
      return out;
    }

    /* ---- 墙体 ---- */
    var R = L.cornerR;
    var ceilingY = L.ceilingY;
    var cornerL = { cx: fieldX0 + R, cy: ceilingY + R, r: R };
    var cornerR2 = { cx: W - 21 - R, cy: ceilingY + R, r: R };
    var rightWallCx = W - 21;
    var walls = [
      { x1: fieldX0, y1: ceilingY, x2: fieldX0, y2: floorY, half: 7, e: 0.45, kind: 'wall' },
      { x1: rightWallCx, y1: ceilingY, x2: rightWallCx, y2: laneFloorY, half: 7, e: 0.4, kind: 'wall' },
      { x1: cornerL.cx, y1: ceilingY, x2: cornerR2.cx, y2: ceilingY, half: 7, e: 0.05, kind: 'wall' },
      { x1: laneX0, y1: L.laneTop, x2: laneX0, y2: laneFloorY, half: 8, e: 0.05, kind: 'wall' },
      { x1: fieldX0, y1: floorY, x2: W - 15, y2: floorY, half: 8, e: 0.2, kind: 'wall' }
    ];
    var arcTL = arcSegs(cornerL.cx, cornerL.cy, R, -Math.PI / 2, -Math.PI, 6);
    arcTL.forEach(function (sg) { sg.e = 0.45; sg.kind = 'wall'; });
    var arcTR = arcSegs(cornerR2.cx, cornerR2.cy, R, 0, -Math.PI / 2, 6);
    for (var a1 = 0; a1 < arcTL.length; a1++) walls.push(arcTL[a1]);
    for (var a2 = 0; a2 < arcTR.length; a2++) walls.push(arcTR[a2]);

    /* 墙边斜挡板 */
    var deflectors = [];
    var deflectYs = [pegTop + 40, pegTop + 220, pegTop + 400];
    for (var dy = 0; dy < deflectYs.length; dy++) {
      var yy = deflectYs[dy];
      if (yy > pegBottom - 60) break;
      deflectors.push({ x1: fieldX0 + 20, y1: yy, x2: fieldX0 + 54, y2: yy + 26, half: 5, e: 0.15, friction: 0.995, kind: 'deflector' });
      deflectors.push({ x1: laneX0 - 9, y1: yy, x2: laneX0 - 43, y2: yy + 26, half: 5, e: 0.15, friction: 0.995, kind: 'deflector' });
    }
    for (var dc = 0; dc < deflectors.length; dc++) walls.push(deflectors[dc]);

    /* 贴墙壁钉:选在两档斜挡板正中间(距上下挡板均 >= 75px),并参与钉距过滤防夹球 */
    var bumpY = (pegBottom - 36 >= pegTop + 325) ? (pegTop + 325) : (pegTop + 145);
    var wallBumps = [
      { x: fieldX0 + 10, y: bumpY, r: 11, flash: 0, led: null, slideDir: 1 },
      { x: laneX0 - 10, y: bumpY, r: 11, flash: 0, led: null, slideDir: -1 }
    ];

    /* 挡板与壁钉周围不许有小于(球直径+6)的夹缝 */
    var kept2 = [];
    for (var pq = 0; pq < pegs.length; pq++) {
      var pg = pegs[pq], near = false;
      for (var dq = 0; dq < deflectors.length; dq++) {
        var dg = deflectors[dq];
        var vx2 = dg.x2 - dg.x1, vy2 = dg.y2 - dg.y1;
        var tt2 = ((pg.x - dg.x1) * vx2 + (pg.y - dg.y1) * vy2) / (vx2 * vx2 + vy2 * vy2);
        tt2 = tt2 < 0 ? 0 : (tt2 > 1 ? 1 : tt2);
        var qx = dg.x1 + vx2 * tt2, qy = dg.y1 + vy2 * tt2;
        if (U.dist(pg.x, pg.y, qx, qy) < pg.r + dg.half + CFG.ballR * 2 + 6) { near = true; break; }
      }
      if (!near) {
        for (var wb = 0; wb < wallBumps.length; wb++) {
          if (U.dist(pg.x, pg.y, wallBumps[wb].x, wallBumps[wb].y) < pg.r + wallBumps[wb].r + CFG.ballR * 2 + 6) { near = true; break; }
        }
      }
      if (!near) kept2.push(pg);
    }
    pegs = kept2;
    for (var wbi = 0; wbi < wallBumps.length; wbi++) pegs.push(wallBumps[wbi]);

    /* ---- 边框 LED 灯带点位(复古主题绘制;极简主题忽略) ---- */
    var leds = [];
    var step = 46;
    for (var lx = cornerL.cx; lx <= cornerR2.cx; lx += step) leds.push({ x: lx, y: ceilingY });
    for (var la = -Math.PI / 2 + 0.4; la < -0.1; la += Math.PI / 9) leds.push({ x: cornerR2.cx + Math.cos(la) * (R - 10), y: cornerR2.cy + Math.sin(la) * (R - 10) });
    for (var ly = cornerR2.cy + 30; ly <= floorY - 30; ly += step) leds.push({ x: W - 21, y: ly });
    for (var bx = fieldRight - 20; bx >= fieldX0 + 30; bx -= step) leds.push({ x: bx, y: floorY + 6 });
    for (var ly2 = floorY - 30; ly2 >= cornerL.cy + 30; ly2 -= step) leds.push({ x: fieldX0, y: ly2 });
    for (var la2 = -Math.PI + 0.4; la2 < -Math.PI / 2 - 0.1; la2 += Math.PI / 9) leds.push({ x: cornerL.cx + Math.cos(la2) * (R - 10), y: cornerL.cy + Math.sin(la2) * (R - 10) });
    for (var li = 0; li < leds.length; li++) leds[li].color = (li % 2 === 0) ? 'red' : 'green';

    /* 40% 临界速度:按"出生点到顶轨"的爬升高度计算 */
    var climb = spawn.y - ceilingY;
    var crestSpeed = Math.sqrt(2 * CFG.gravity * climb + 550 * 550);

    return {
      W: W, H: H,
      crestSpeed: crestSpeed,
      backH: backH, panelH: panelH,
      fieldX0: fieldX0, fieldRight: fieldRight, floorY: floorY,
      lane: { x0: laneX0, x1: laneX1, cx: laneCx, top: L.laneTop, floorY: laneFloorY, spawn: spawn },
      pegs: pegs, bumpers: bumpers,
      holes: holes, pw: pw, capY: capY, holeN: n, innerX0: innerX0,
      dividers: dividers, walls: walls,
      ceilingY: ceilingY, cornerL: cornerL, cornerR: cornerR2,
      borderLeds: leds
    };
  }

  MG.board = { build: build };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
