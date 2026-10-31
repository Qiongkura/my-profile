/* 弹弹珠机 - 轻量物理引擎 (命名空间: MG.physics)
 * 只处理:圆球(动态) vs 圆(静态/移动) vs 线段(墙/隔板) vs 圆球之间的碰撞。
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
  World.prototype.addSeg = function (s) { this.segs.push(s); return s; };

  World.prototype.step = function (dt, sub) {
    sub = sub || 1;
    var h = dt / sub;
    for (var i = 0; i < sub; i++) this._sub(h);
    // 清理 dead 球(由外部 bank 后标记)
    if (this.balls.length) {
      var alive = [];
      for (var j = 0; j < this.balls.length; j++) if (!this.balls[j].dead) alive.push(this.balls[j]);
      this.balls = alive;
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

    // 球 vs 圆(钉/弹射器/巡逻钉)
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
          /* 微小撞击不反弹:防止球在钉顶 perpetually 微颤卡住 */
          if (-vn < 40) e = 0;
          rvx -= (1 + e) * vn * nx;
          rvy -= (1 + e) * vn * ny;
          b.vx = rvx + mvx; b.vy = rvy + mvy;

          if (c.kind === 'bumper') {
            var spN = b.vx * nx + b.vy * ny;
            var boost = c.boost || 0;
            if (spN < boost) { b.vx += (boost - spN) * nx; b.vy += (boost - spN) * ny; }
            this._emit({ type: 'bumper', x: c.x, y: c.y, ball: b, circle: c, speed: -vn });
          } else if (c.kind === 'peg') {
            if (-vn > 60) this._emit({ type: 'peg', x: c.x, y: c.y, ball: b, circle: c, speed: -vn });
            /* 钉顶平衡破坏:球 nearly 静止在钉顶附近时,沿肩部向下滑出(真机圆钉不会卡球)。
               必须带冷却:step(dt,12) 每帧 12 个子步,若球被钉+墙夹住反复轻触,
               不设冷却会每子步 +130/+30 速度 → 一帧内凭空加速到数千(弹射泵) */
            if (-vn < 120 && -vn > 25 && dy < 0 && !(b.nudgeCd > 0)) {
              var side = c.slideDir || (dx >= 0 ? 1 : -1);
              b.vx += side * 130;
              b.vy += 30;
              b.nudgeCd = 0.4;
            }
          } else if (c.kind === 'mover') {
            this._emit({ type: 'mover', x: c.x, y: c.y, ball: b, circle: c, speed: -vn });
          }
        }
      }
    }

    // 球 vs 球
    for (i = 0; i < balls.length; i++) {
      var b1 = balls[i];
      if (b1.dead) continue;
      for (var k = i + 1; k < balls.length; k++) {
        var b2 = balls[k];
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
          this._emit({ type: 'ballball', x: b1.x + nnx * b1.r, y: b1.y + nny * b1.r });
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
        var sx = s.x2 - s.x1, sy = s.y2 - s.y1;
        var len2 = sx * sx + sy * sy;
        var t = len2 > 0 ? ((b.x - s.x1) * sx + (b.y - s.y1) * sy) / len2 : 0;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        var px = s.x1 + sx * t, py = s.y1 + sy * t;
        var ex = b.x - px, ey = b.y - py;
        var RS = b.r + s.half;
        var e2 = ex * ex + ey * ey;
        if (e2 >= RS * RS) continue;
        var ed = Math.sqrt(e2);
        var qnx, qny;
        if (ed > 0.0001) { qnx = ex / ed; qny = ey / ed; }
        else { var sl = Math.sqrt(len2) || 1; qnx = -sy / sl; qny = sx / sl; }
        b.x = px + qnx * RS; b.y = py + qny * RS;
        var svn = b.vx * qnx + b.vy * qny;
        if (svn < 0) {
          var se = s.e != null ? s.e : 0.4;
          b.vx -= (1 + se) * svn * qnx;
          b.vy -= (1 + se) * svn * qny;
          // 切向摩擦
          var tvx = b.vx - (b.vx * qnx + b.vy * qny) * qnx;
          var tvy = b.vy - (b.vx * qnx + b.vy * qny) * qny;
          var fr = s.friction != null ? s.friction : 0.995;
          b.vx -= tvx * (1 - fr); b.vy -= tvy * (1 - fr);
          if (s.kind === 'wall' && -svn > 380) {
            this._emit({ type: 'wall', x: px, y: py, ball: b, speed: -svn });
          }
        }

        /* 端点圆帽防栖:低速球栖在段端头圆帽上时,沿帽面切向推出去,
           绕过端头后顺杆身滑落——场地侧的滑回场地,弹道侧的滑回弹道 */
        if ((t <= 0 || t >= 1) && (b.vx * b.vx + b.vy * b.vy) < 25600 && !(b.nudgeCd > 0)) {
          var sln = Math.sqrt(len2) || 1;
          var udx = sx / sln, udy = sy / sln;
          var capDx = b.x - px, capDy = b.y - py;          /* 相对端帽中心 */
          var side = (Math.abs(capDx) > 0.5 || Math.abs(capDy) > 0.5)
            ? ((capDx * udy - capDy * udx) > 0 ? 1 : -1)   /* 朝球已偏的一侧绕出 */
            : -1;                                          /* 完全居中:默认向场地一侧 */
          b.vx += -qny * side * 120;
          b.vy += qnx * side * 120;
          b.nudgeCd = 0.35;
        }
      }
    }

    /* 结算后统一限速:夹缝里多次反射叠加的速度不允许带出子步 */
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.dead) continue;
      var sp2 = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp2 > this.maxSpeed) { var k2 = this.maxSpeed / sp2; b.vx *= k2; b.vy *= k2; }
    }
  };

  World.prototype._emit = function (e) {
    if (this.onEvent) this.onEvent(e);
  };

  /* 轨迹预演:用同一套碰撞逻辑跑一个临时球,返回采样点(用于瞄准虚线) */
  function simulatePath(x, y, vx, vy, circles, segs, opts) {
    opts = opts || {};
    var w = new World({ gravity: opts.g != null ? opts.g : 2100, maxSpeed: opts.maxSpeed != null ? opts.maxSpeed : 1500, airDrag: opts.airDrag != null ? opts.airDrag : 0.08 });
    w.circles = circles || [];
    w.segs = segs || [];
    var b = w.addBall({ x: x, y: y, vx: vx, vy: vy, r: opts.r || 15 });
    var dt = opts.dt || (1 / 120);
    var maxSteps = opts.maxSteps || 260;
    var pts = [];
    for (var i = 0; i < maxSteps; i++) {
      w.step(dt, 1);
      if (i % 3 === 0) pts.push({ x: b.x, y: b.y });
      if (b.y > (opts.stopY || 1e9)) break;
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (i > 25 && sp < 55) break;
    }
    return pts;
  }

  MG.physics = {
    World: World,
    simulatePath: simulatePath
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
