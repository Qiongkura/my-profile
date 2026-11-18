/* 弹弹弹珠吧 - 轻量物理引擎 (命名空间: MG.physics)
 * 处理:圆球(动态) vs 圆(静态/移动) vs 线段(墙/隔板) vs 圆球之间的碰撞。
 * 零依赖、无 DOM,可在浏览器 / 微信小游戏 / 抖音小游戏直接运行。
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});

  function World(opts) {
    opts = opts || {};
    this.g = opts.gravity != null ? opts.gravity : 2100;
    this.maxSpeed = opts.maxSpeed != null ? opts.maxSpeed : 1500;
    this.airDrag = opts.airDrag != null ? opts.airDrag : 0.08;
    this.balls = [];
    this.circles = [];   // {x,y,r,kind,e,boost,vx,vy,disabled}
    this.segs = [];      // {x1,y1,x2,y2,half,e,kind}
    this.onEvent = null; // function({type, ...})
  }

  World.prototype.addBall = function (b) {
    b.vx = b.vx || 0; b.vy = b.vy || 0;
    b.dead = false;
    this.balls.push(b);
    return b;
  };

  World.prototype.addCircle = function (c) { this.circles.push(c); return c; };

  /* 预计算静态线段的几何量,避免每帧 12 子步内重复开方 */
  World.prototype.addSeg = function (s) {
    var sx = s.x2 - s.x1, sy = s.y2 - s.y1;
    var len2 = sx * sx + sy * sy;
    var len = Math.sqrt(len2) || 1;
    s._sx = sx;
    s._sy = sy;
    s._len2 = len2;
    s._invLen2 = len2 > 0 ? 1 / len2 : 0;
    s._ux = sx / len;
    s._uy = sy / len;
    this.segs.push(s);
    return s;
  };

  World.prototype.step = function (dt, sub) {
    sub = sub || 1;
    var h = dt / sub;
    for (var i = 0; i < sub; i++) this._sub(h);
    /* 原地紧缩清理 dead 球(无死亡球时零数组分配) */
    var balls = this.balls;
    var n = balls.length;
    if (n > 0) {
      var write = 0;
      for (var j = 0; j < n; j++) {
        if (!balls[j].dead) {
          if (write !== j) balls[write] = balls[j];
          write++;
        }
      }
      if (write !== n) balls.length = write;
    }
  };

  World.prototype._sub = function (h) {
    var balls = this.balls, i, b;
    var damp = 1 - this.airDrag * h;

    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.dead) continue;
      b.vy += this.g * h;
      b.vx *= damp; b.vy *= damp;
      if (b.nudgeCd > 0) b.nudgeCd -= h;
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > this.maxSpeed) { var k = this.maxSpeed / sp; b.vx *= k; b.vy *= k; }
      b.x += b.vx * h; b.y += b.vy * h;
    }

    // 球 vs 圆(钉/弹射器)
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.dead) continue;
      var cs = this.circles;
      for (var j = 0; j < cs.length; j++) {
        var c = cs[j];
        if (c.disabled) continue;
        var dx = b.x - c.x, dy = b.y - c.y;
        var R = b.r + c.r;
        var d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        var d = Math.sqrt(d2) || 0.0001;
        var nx = dx / d, ny = dy / d;
        b.x = c.x + nx * R; b.y = c.y + ny * R;

        var mvx = c.vx || 0, mvy = c.vy || 0;
        var rvx = b.vx - mvx, rvy = b.vy - mvy;
        var vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          var e = c.e != null ? c.e : (c.kind === 'bumper' ? 0.35 : 0.5);
          /* 微小撞击不反弹:防止球在钉顶微颤卡住 */
          if (-vn < 40) e = 0;
          rvx -= (1 + e) * vn * nx;
          rvy -= (1 + e) * vn * ny;
          b.vx = rvx + mvx; b.vy = rvy + mvy;

          if (c.kind === 'bumper') {
            var spN = b.vx * nx + b.vy * ny;
            var boost = c.boost || 0;
            if (spN < boost) { b.vx += (boost - spN) * nx; b.vy += (boost - spN) * ny; }
            if (-vn > 60) this._emit({ type: 'bumper', x: c.x, y: c.y, ball: b, circle: c, speed: -vn });
          } else if (c.kind === 'peg') {
            if (-vn > 60) this._emit({ type: 'peg', x: c.x, y: c.y, ball: b, circle: c, speed: -vn });
            /* 钉顶平衡破坏(带冷却防止夹缝加速泵) */
            if (-vn < 120 && -vn > 25 && dy < 0 && !(b.nudgeCd > 0)) {
              var side = c.slideDir || (dx >= 0 ? 1 : -1);
              b.vx += side * 130;
              b.vy += 30;
              b.nudgeCd = 0.4;
            }
          }
        }
      }
    }

    // 球 vs 球
    for (i = 0; i < balls.length; i++) {
      var b1 = balls[i];
      if (b1.dead) continue;
      for (var k2 = i + 1; k2 < balls.length; k2++) {
        var b2 = balls[k2];
        if (b2.dead) continue;
        var ddx = b2.x - b1.x, ddy = b2.y - b1.y;
        var RR = b1.r + b2.r;
        var dd2 = ddx * ddx + ddy * ddy;
        if (dd2 >= RR * RR || dd2 === 0) continue;
        var dd = Math.sqrt(dd2);
        var nnx = ddx / dd, nny = ddy / dd;
        var overlap = RR - dd;
        b1.x -= nnx * overlap / 2; b1.y -= nny * overlap / 2;
        b2.x += nnx * overlap / 2; b2.y += nny * overlap / 2;
        var rv = (b2.vx - b1.vx) * nnx + (b2.vy - b1.vy) * nny;
        if (rv < 0) {
          var imp = -(1 + 0.68) * rv / 2;
          b1.vx -= imp * nnx; b1.vy -= imp * nny;
          b2.vx += imp * nnx; b2.vy += imp * nny;
          if (-rv > 60) this._emit({ type: 'ballball', x: b1.x + nnx * b1.r, y: b1.y + nny * b1.r });
        }
      }
    }

    // 球 vs 线段(墙 / 隔板)
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.dead) continue;
      var sg = this.segs;
      for (var m = 0; m < sg.length; m++) {
        var s = sg[m];
        var sx = s._sx != null ? s._sx : (s.x2 - s.x1);
        var sy = s._sy != null ? s._sy : (s.y2 - s.y1);
        var invLen2 = s._invLen2 != null ? s._invLen2 : ((sx * sx + sy * sy) > 0 ? 1 / (sx * sx + sy * sy) : 0);
        var t = invLen2 > 0 ? ((b.x - s.x1) * sx + (b.y - s.y1) * sy) * invLen2 : 0;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        var px = s.x1 + sx * t, py = s.y1 + sy * t;
        var ex = b.x - px, ey = b.y - py;
        var RS = b.r + s.half;
        var e2 = ex * ex + ey * ey;
        if (e2 >= RS * RS) continue;
        var ed = Math.sqrt(e2);
        var qnx, qny;
        if (ed > 0.0001) {
          qnx = ex / ed; qny = ey / ed;
        } else {
          var ux = s._ux != null ? s._ux : 1;
          var uy = s._uy != null ? s._uy : 0;
          qnx = -uy; qny = ux;
        }
        b.x = px + qnx * RS; b.y = py + qny * RS;
        var svn = b.vx * qnx + b.vy * qny;
        if (svn < 0) {
          var se = s.e != null ? s.e : 0.4;
          b.vx -= (1 + se) * svn * qnx;
          b.vy -= (1 + se) * svn * qny;
          var tvx = b.vx - (b.vx * qnx + b.vy * qny) * qnx;
          var tvy = b.vy - (b.vx * qnx + b.vy * qny) * qny;
          var fr = s.friction != null ? s.friction : 0.995;
          b.vx -= tvx * (1 - fr); b.vy -= tvy * (1 - fr);
          if (s.kind === 'wall' && -svn > 380) {
            this._emit({ type: 'wall', x: px, y: py, ball: b, speed: -svn });
          }
        }

        /* 端点圆帽防栖:低速球栖在段端头圆帽上时,沿帽面切向推出去 */
        if ((t <= 0 || t >= 1) && (b.vx * b.vx + b.vy * b.vy) < 25600 && !(b.nudgeCd > 0)) {
          var udx = s._ux != null ? s._ux : 1;
          var udy = s._uy != null ? s._uy : 0;
          var capDx = b.x - px, capDy = b.y - py;
          var side2 = (Math.abs(capDx) > 0.5 || Math.abs(capDy) > 0.5)
            ? ((capDx * udy - capDy * udx) > 0 ? 1 : -1)
            : -1;
          b.vx += -qny * side2 * 120;
          b.vy += qnx * side2 * 120;
          b.nudgeCd = 0.35;
        }
      }
    }

    /* 结算后统一限速 */
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.dead) continue;
      var sp2 = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp2 > this.maxSpeed) { var k3 = this.maxSpeed / sp2; b.vx *= k3; b.vy *= k3; }
    }
  };

  World.prototype._emit = function (e) {
    if (this.onEvent) this.onEvent(e);
  };

  MG.physics = {
    World: World
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
