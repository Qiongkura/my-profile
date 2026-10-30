/* 弹弹珠机 - 游戏主逻辑 (命名空间: MG.Game)
 * 复刻玻璃珠游艺机:
 *   - 右下角先选投入弹珠数(1~5 颗)= 选倍率 ×2~×10,投入越多亮灯的洞越少
 *   - 按住蓄力,松手把弹珠从右下角往上弹,冲过顶部导弧拐入斜面场地
 *   - 力度太小弹珠滚回来,退还投入;从亮灯的洞滑落 = 中奖,赢回 投入×倍率 颗
 *   - ×6 及以上中奖送礼品卡,每次中奖送玩具球;弹珠库见底本局结束
 * 状态机: menu / help / play / pause / result
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});
  var CFG = MG.config;
  var U = MG.util;
  var C = CFG.colors;

  function Game(platform) {
    var self = this;
    this.platform = platform;
    this.ctx = platform.canvas.getContext('2d');

    /* 存档 */
    this.muted = !!platform.storage.get('mm_mute', false);
    MG.audio.init(platform);
    MG.audio.setMuted(this.muted);
    this.prizeBallsTotal = platform.storage.get('mm_prizes', 0) | 0;
    this.giftCardsTotal = platform.storage.get('mm_cards', 0) | 0;
    this.bestWin = platform.storage.get('mm_bestwin', 0) | 0;

    /* 视口 */
    this.view = { scale: 1, offX: 0, offY: 0, W: CFG.DESIGN_W, H: 1500 };
    this.computeView();

    /* 状态 */
    this.state = 'menu';
    this.stateT = 0;
    this.time = 0;
    this.bank = 0;              // 弹珠库
    this.selIdx = 0;            // 选中的投入档位
    this.launched = 0;          // 本局发射次数
    this.wins = 0;
    this.maxWin = 0;
    this.prizeBalls = 0;
    this.giftCards = 0;
    this.tierPopT = 0;
    this.newRecord = false;
    this.lastEarned = 0;        // 结算页:最大单次赢取
    this.skinIdx = 0;
    this.endTimer = -1;
    this.launcherCool = 0;
    this.launcherPulse = 0;
    this.charging = false;
    this.chargeT = 0;
    this._downT = 0;
    this.frameButtons = [];
    this.fx = MG.fx.create();
    this.bg = null;

    this.buildBoard(0);

    /* 输入 */
    platform.onTouch('down', function (pt) { self.handleDown(pt); });
    platform.onTouch('move', function (pt) { });
    platform.onTouch('up', function (pt) { self.handleUp(pt); });
    platform.onResize(function () {
      self.computeView();
      self.buildBoard(self.round || 0);
    });
  }

  /* ================= 视口 ================= */

  Game.prototype.computeView = function () {
    var p = this.platform;
    var H = U.clamp(CFG.DESIGN_W * p.cssH / p.cssW, CFG.H_MIN, CFG.H_MAX);
    var scale = Math.min(p.cssW / CFG.DESIGN_W, p.cssH / H);
    this.view.W = CFG.DESIGN_W;
    this.view.H = H;
    this.view.scale = scale;
    this.view.offX = (p.cssW - CFG.DESIGN_W * scale) / 2;
    this.view.offY = (p.cssH - H * scale) / 2;
  };

  Game.prototype.toLogical = function (cx, cy) {
    return {
      x: (cx - this.view.offX) / this.view.scale,
      y: (cy - this.view.offY) / this.view.scale
    };
  };

  /* ================= 关卡构建 ================= */

  Game.prototype.buildBoard = function (round) {
    var seed = round > 0 ? ((round * 2654435761) >>> 0) : 20260101;
    var rng = U.mulberry32(seed);
    this.round = round;
    this.board = MG.board.build(round, this.view.W, this.view.H, rng);

    this.world = new MG.physics.World({
      gravity: CFG.gravity, maxSpeed: CFG.maxSpeed, airDrag: CFG.airDrag
    });
    var i;
    for (i = 0; i < this.board.pegs.length; i++) {
      var peg = this.board.pegs[i];
      peg.kind = 'peg'; peg.e = 0.55;
      this.world.addCircle(peg);
    }
    for (i = 0; i < this.board.bumpers.length; i++) this.world.addCircle(this.board.bumpers[i]);
    for (i = 0; i < this.board.dividers.length; i++) this.world.addSeg(this.board.dividers[i]);
    for (i = 0; i < this.board.walls.length; i++) this.world.addSeg(this.board.walls[i]);

    var self = this;
    this.world.onEvent = function (e) { self.onWorldEvent(e); };

    this.endTimer = -1;
    this.launcherCool = 0;
    this.charging = false;
    this.buildBg();
  };

  /* ================= 流程 ================= */

  Game.prototype.startGame = function () {
    this.bank = CFG.startBank;
    this.selIdx = 0;
    this.launched = 0;
    this.wins = 0;
    this.maxWin = 0;
    this.prizeBalls = 0;
    this.giftCards = 0;
    this.buildBoard(1);
    this.applyLit();
    this.state = 'play';
    this.stateT = 0;
    MG.audio.play('click');
  };

  Game.prototype.restartRound = function () {
    this.bank = CFG.startBank;
    this.selIdx = 0;
    this.launched = 0;
    this.wins = 0;
    this.maxWin = 0;
    this.prizeBalls = 0;
    this.giftCards = 0;
    this.buildBoard(this.round);
    this.applyLit();
    this.state = 'play';
    this.stateT = 0;
    MG.audio.play('click');
  };

  Game.prototype.backToMenu = function () {
    this.state = 'menu';
    this.stateT = 0;
    this.buildBoard(0);
    MG.audio.play('click');
  };

  Game.prototype.toggleMute = function () {
    this.muted = MG.audio.toggleMuted();
    this.platform.storage.set('mm_mute', this.muted);
    if (!this.muted) MG.audio.play('click');
  };

  Game.prototype.endRound = function () {
    this.platform.storage.set('mm_prizes', this.prizeBallsTotal + this.prizeBalls);
    this.platform.storage.set('mm_cards', this.giftCardsTotal + this.giftCards);
    this.newRecord = this.maxWin > this.bestWin && this.maxWin > 0;
    if (this.newRecord) {
      this.bestWin = this.maxWin;
      this.platform.storage.set('mm_bestwin', this.bestWin);
    }
    this.lastEarned = this.maxWin;
    this.prizeBallsTotal += this.prizeBalls;
    this.giftCardsTotal += this.giftCards;
    this.state = 'result';
    this.stateT = 0;
    MG.audio.play(this.newRecord ? 'record' : 'over');
  };

  /* ================= 倍率档位与亮灯 ================= */

  Game.prototype.tier = function () {
    return CFG.tiers[U.clamp(this.selIdx, 0, CFG.tiers.length - 1)];
  };

  /* 右下角选投入弹珠数 */
  Game.prototype.selectTier = function (idx) {
    var t = CFG.tiers[idx];
    if (!t || t.cost > this.bank || idx === this.selIdx) return;
    this.selIdx = idx;
    this.applyLit();
    this.tierPopT = 0.2;
    MG.audio.play('click');
  };

  /* 按当前档位随机点亮洞口 */
  Game.prototype.applyLit = function () {
    var holes = this.board.holes;
    var i;
    for (i = 0; i < holes.length; i++) holes[i].lit = false;
    var order = [];
    for (i = 0; i < holes.length; i++) order.push(i);
    for (i = order.length - 1; i > 0; i--) {
      var k = Math.floor(Math.random() * (i + 1));
      var tmp = order[i]; order[i] = order[k]; order[k] = tmp;
    }
    var litN = Math.min(this.tier().lit, holes.length);
    for (i = 0; i < litN; i++) holes[order[i]].lit = true;
  };

  /* ================= 输入:按住蓄力 / 松手发射 ================= */

  Game.prototype.handleDown = function (pt) {
    MG.audio.unlock();
    var p = this.toLogical(pt.x, pt.y);
    for (var i = this.frameButtons.length - 1; i >= 0; i--) {
      var b = this.frameButtons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        b.cb();
        return;
      }
    }
    if (this.state !== 'play') return;
    this.charging = true;
    this.chargeT = 0;
    this._downT = this.time;
  };

  Game.prototype.handleUp = function () {
    if (!this.charging) return;
    this.charging = false;
    if (this.state !== 'play') return;
    var quick = (this.time - this._downT) < CFG.launcher.tapJudge;
    var power = quick ? CFG.launcher.tapPower : this.chargePower();
    this.launch(power);
  };

  /* 力度三角波:0 → 1 → 0 来回摆动 */
  Game.prototype.chargePower = function () {
    var c = (this.chargeT * CFG.launcher.chargeSpeed) % 1;
    return c < 0.5 ? c * 2 : 2 - c * 2;
  };

  /* 发射:右下角向上弹(场上同时只能有一颗弹珠) */
  Game.prototype.launch = function (power) {
    if (this.state !== 'play' || this.launcherCool > 0) return;
    if (this.world.balls.length > 0) {
      MG.fx.text(this.fx, this.board.lane.cx - 10, this.board.lane.floorY - 130, '等上一颗落定', { size: 22, color: '#fff8ea', life: 0.8 });
      return;
    }
    var t = this.tier();
    if (this.bank < t.cost) {
      MG.fx.text(this.fx, this.board.lane.cx - 10, this.board.lane.floorY - 80, '弹珠不够', { size: 22, color: '#e8352e' });
      return;
    }
    this.bank -= t.cost;
    this.launched++;
    /* 亮灯洞只在换档位时重排,发射前后保持不变 */

    var lane = this.board.lane;
    var speed = U.lerp(CFG.launcher.minSpeed, CFG.launcher.maxSpeed, power);
    /* 垂直上升:无水平抖动 */
    var m = new MG.entities.Marble(lane.spawn.x, lane.spawn.y, 0, -speed, this.skinIdx++ % C.marbleTints.length);
    m.bet = t.cost;
    m.mult = t.mult;
    this.world.addBall(m);
    this.launcherCool = CFG.launcher.cooldown;
    this.launcherPulse = 1;
    MG.audio.play('launch');
    MG.fx.burst(this.fx, lane.spawn.x, lane.spawn.y, '#ffd166', 10, 240);
  };

  /* ================= 物理事件 ================= */

  Game.prototype.onWorldEvent = function (e) {
    switch (e.type) {
      case 'peg': {
        e.circle.flash = 1;
        MG.fx.burst(this.fx, e.x, e.y, e.circle.led === 'red' ? '#ff8a7a' : (e.circle.led === 'green' ? '#8affb0' : '#ffffff'), 4, 130);
        if (e.speed > 70) MG.audio.play('peg', { pitch: U.rand(0.9, 1.2) });
        break;
      }
      case 'bumper': {
        e.circle.pulse = 1;
        MG.fx.ring(this.fx, e.x, e.y, '#ffffff', 54, 0.3, 3);
        MG.audio.play('bumper');
        break;
      }
      case 'wall': {
        if (e.ball.wallSndT <= 0 && e.speed > 420) {
          e.ball.wallSndT = 0.2;
          MG.audio.play('peg', { pitch: 0.55, vol: 0.3 });
        }
        break;
      }
    }
  };

  /* 弹道内滚回:退还投入 */
  Game.prototype.refund = function (m) {
    this.bank += (m.bet || 1);
    m.dead = true;
    var lane = this.board.lane;
    MG.fx.text(this.fx, lane.cx - 20, lane.floorY - 90, '力气太小 退' + (m.bet || 1) + '颗', { size: 24, color: '#fff8ea', life: 1.1 });
    MG.audio.play('click');
  };

  /* 落入洞口:亮灯 = 中奖 */
  Game.prototype.captureHole = function (m) {
    var b = this.board;
    var idx = U.clamp(Math.floor((m.x - b.innerX0) / b.pw), 0, b.holeN - 1);
    var hole = b.holes[idx];
    m.dead = true;

    if (hole.lit) {
      var gained = (m.bet || 1) * (m.mult || this.tier().mult);
      this.bank += gained;
      this.wins++;
      if (gained > this.maxWin) this.maxWin = gained;
      this.prizeBalls += 1;
      var gotCard = (m.mult || 2) >= CFG.giftCardMult;
      if (gotCard) this.giftCards += 1;
      hole.flash = 1;

      MG.fx.text(this.fx, this.view.W / 2, b.floorY - 170, '中 奖  ×' + (m.mult || 2), { size: 56, color: '#e8352e', life: 1.6 });
      MG.fx.text(this.fx, hole.cx, b.floorY - 96, '+' + gained + ' 颗  玩具球+1' + (gotCard ? '  礼品卡+1' : ''), { size: 26, color: '#fff8ea', life: 1.5 });
      MG.fx.burst(this.fx, hole.cx, b.floorY - 30, '#ff4a3a', 44, 440);
      MG.fx.ring(this.fx, hole.cx, b.floorY - 30, '#ff4a3a', 120, 0.5, 6);
      MG.audio.play('jackpot');
      MG.fx.shake(this.fx, 10);
      this.platform.vibrate();
    } else {
      hole.flash = 0.6;
      MG.fx.burst(this.fx, m.x, b.floorY - 26, '#d9b26a', 8, 180);
      MG.audio.play('slot', { pitch: 0.85, vol: 0.6 });
    }
    /* 每颗弹珠落定后重置亮灯洞口位置(发射前后不变) */
    this.applyLit();
  };

  /* ================= 更新 ================= */

  Game.prototype.update = function (dt) {
    this.time += dt;
    this.stateT += dt;
    this.tierPopT = Math.max(0, this.tierPopT - dt);
    MG.fx.update(this.fx, dt);

    if (this.state !== 'play') return;

    var b = this.board;
    var i, k;

    if (this.charging) this.chargeT += dt;
    this.launcherCool -= dt;
    this.launcherPulse = Math.max(0, this.launcherPulse - dt * 4);

    /* 导流弧角:进入检测(在物理碰撞发生前吸附,避免撞弧反弹) */
    var pre = this.world.balls;
    for (i = 0; i < pre.length; i++) {
      var pb = pre[i];
      if (pb.dead || pb.rail) continue;
      if (pb.railCd > 0) { pb.railCd -= dt; continue; }
      if (pb.vy < -0.5 && pb.x > b.cornerR.cx - 6 && pb.y < b.cornerR.cy + 40) {
        var dxr = pb.x - b.cornerR.cx, dyr = pb.y - b.cornerR.cy;
        var dr = Math.sqrt(dxr * dxr + dyr * dyr);
        if (dr <= 59 && dr > 25) {
          var a0 = Math.atan2(dyr, dxr);
          if (a0 > 0.05) a0 = 0.05;
          if (a0 < -1.55) a0 = -1.55;
          pb.rail = { cx: b.cornerR.cx, cy: b.cornerR.cy, a: a0, aEnd: -Math.PI / 2 };
        }
      } else if (pb.vx < -0.5 && pb.x < b.cornerL.cx + 50 && pb.y < b.cornerL.cy + 40) {
        var dxl = pb.x - b.cornerL.cx, dyl = pb.y - b.cornerL.cy;
        var dl = Math.sqrt(dxl * dxl + dyl * dyl);
        if (dl <= 59 && dl > 25) {
          var aL = Math.atan2(dyl, dxl);
          if (aL > -Math.PI / 2 + 0.2) aL = -Math.PI / 2 + 0.2;
          if (aL < -Math.PI + 0.1) aL = -Math.PI + 0.1;
          pb.rail = { cx: b.cornerL.cx, cy: b.cornerL.cy, a: aL, aEnd: -Math.PI };
        }
      }
    }

    this.world.step(dt, 10);

    /* 导流弧角:贴轨滑行(吸附在圆弧路径上,不反弹) */
    var bl = this.world.balls;
    for (i = 0; i < bl.length; i++) {
      var rb = bl[i];
      if (rb.dead || !rb.rail) continue;
      var railR = 57; /* 弧半径 80 - 半厚 8 - 球半径 15 = 球心轨半径 */
      var sp = Math.sqrt(rb.vx * rb.vx + rb.vy * rb.vy) * (1 - 0.06 * dt);
      if (sp < 220 || rb.rail.a <= rb.rail.aEnd) {
        /* 滑到弧角末端:沿切线自然飞出(短时间不再吸附) */
        var ta = Math.max(rb.rail.a, rb.rail.aEnd);
        rb.x = rb.rail.cx + Math.cos(ta) * railR;
        rb.y = rb.rail.cy + Math.sin(ta) * railR;
        rb.vx = Math.sin(ta) * sp;
        rb.vy = -Math.cos(ta) * sp;
        rb.rail = null;
        rb.railCd = 0.6;
        continue;
      }
      rb.rail.a -= (sp / railR) * dt;
      rb.x = rb.rail.cx + Math.cos(rb.rail.a) * railR;
      rb.y = rb.rail.cy + Math.sin(rb.rail.a) * railR;
      rb.vx = Math.sin(rb.rail.a) * sp;
      rb.vy = -Math.cos(rb.rail.a) * sp;
    }

    /* 弹珠簿记 */
    var balls = this.world.balls;
    var alive = 0;
    for (i = 0; i < balls.length; i++) {
      var m = balls[i];
      if (m.dead) continue;
      alive++;

      m.age += dt;
      m.wallSndT -= dt;

      /* 拖尾 */
      m.trailT -= dt;
      if (m.trailT <= 0) {
        m.trailT = 0.035;
        m.trail.push({ x: m.x, y: m.y });
        if (m.trail.length > 7) m.trail.shift();
      }

      var speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);

      /* 弹道内滚回检测 */
      if (m.x > b.lane.x0 - 5 && m.y > this.view.H - 280) {
        if (speed < CFG.launcher.refundSlow) m.refundT = (m.refundT || 0) + dt;
        else m.refundT = 0;
        if (m.refundT > CFG.launcher.refundTime) { this.refund(m); continue; }
      } else {
        m.refundT = 0;

        /* 落入洞口;洞口区滞留(如骑在隔针上)短暂后按就近洞落袋 */
        if (m.y > b.capY - 70 && m.y < b.floorY + 30 && m.x < b.lane.x0 - 10) {
          var idx = U.clamp(Math.floor((m.x - b.innerX0) / b.pw), 0, b.holeN - 1);
          var inWin = Math.abs(m.x - b.holes[idx].cx) < b.pw * 0.44;
          if (inWin && m.y > b.capY) { this.captureHole(m); continue; }
          if (speed < 60) {
            m.mouthT = (m.mouthT || 0) + dt;
            if (m.mouthT > 0.45) { this.captureHole(m); continue; }
          } else {
            m.mouthT = 0;
          }
        }

        /* 卡住兜底:持续低速累计计时,超时按就近洞落袋 */
        if (speed < 40) m.stuckTotal = (m.stuckTotal || 0) + dt;
        else m.stuckTotal = Math.max(0, (m.stuckTotal || 0) - dt * 2);
        if (m.stuckTotal > 2.5) {
          MG.fx.text(this.fx, m.x, m.y - 24, '卡住啦', { size: 20, color: '#a8813f' });
          this.captureHole(m);
          continue;
        }
        if (speed < 30) m.slowT += dt; else m.slowT = Math.max(0, m.slowT - dt * 2);
        if (m.slowT > 1.2) {
          m.slowT = 0;
          m.nudges++;
          m.vx += U.rand(-140, 140);
          m.vy -= U.rand(60, 140);
        }
        if (m.nudges > 4 || m.age > 20) {
          MG.fx.text(this.fx, m.x, m.y - 24, '卡住啦', { size: 20, color: '#a8813f' });
          this.captureHole(m);
          continue;
        }
      }
    }

    /* 闪光衰减 */
    for (i = 0; i < b.pegs.length; i++) b.pegs[i].flash = Math.max(0, b.pegs[i].flash - dt * 3.5);
    for (i = 0; i < b.bumpers.length; i++) b.bumpers[i].pulse = Math.max(0, b.bumpers[i].pulse - dt * 3);
    for (i = 0; i < b.holes.length; i++) b.holes[i].flash = Math.max(0, b.holes[i].flash - dt * 2);

    /* 弹珠库见底 → 本局结束 */
    if (this.bank < 1 && alive === 0) {
      if (this.endTimer < 0) this.endTimer = 1.0;
      this.endTimer -= dt;
      if (this.endTimer <= 0) { this.endTimer = -1; this.endRound(); }
    }
  };

  /* ================= 背景缓存(整个机台) ================= */

  Game.prototype.buildBg = function () {
    var p = this.platform;
    var W = this.view.W, H = this.view.H;
    var b = this.board;
    var off = p.createOffscreen(p.canvas.width, p.canvas.height);
    var ctx = off.getContext('2d');
    var ui = MG.ui;

    var s = this.view.scale * p.dpr;
    ctx.setTransform(s, 0, 0, s, this.view.offX * p.dpr, this.view.offY * p.dpr);

    /* ---- 机身(金黄) ---- */
    ui.rr(ctx, -3, -3, W + 6, H + 6, 34);
    var body = ctx.createLinearGradient(0, 0, 0, H);
    body.addColorStop(0, C.cabYellowHi);
    body.addColorStop(0.5, C.cabYellow);
    body.addColorStop(1, C.cabYellowLo);
    ctx.fillStyle = body;
    ctx.fill();

    /* 白色外框 */
    ui.rr(ctx, 8, 8, W - 16, H - 16, 28);
    ctx.strokeStyle = C.frame;
    ctx.lineWidth = 12;
    ctx.stroke();

    /* ---- 背板 ---- */
    var backH = b.backH;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ui.drawStarSticker(ctx, 60, 120, 13, 0.2, 0.8);
    ui.drawStarSticker(ctx, 268, 44, 10, 0.5, 0.7);
    ui.drawStarSticker(ctx, 600, 40, 12, 0.1, 0.8);
    ui.drawStarSticker(ctx, 40, 240, 11, 0.7, 0.7);
    ui.drawStarSticker(ctx, 300, 250, 9, 0.3, 0.6);

    ui.drawPuppy(ctx, 152, 152, 58);

    /* 标题贴纸 */
    ctx.save();
    ctx.translate(452, 78);
    ctx.rotate(-0.025);
    ui.rr(ctx, -172, -38, 344, 76, 20);
    ctx.fillStyle = '#e8352e';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
    ui.font(ctx, 46);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('弹弹珠机', 0, 2);
    ui.drawStarSticker(ctx, -146, 0, 9, 0, 0.95);
    ui.drawStarSticker(ctx, 146, 0, 9, 0, 0.95);
    ctx.restore();

    /* 红色 LED 数码管:弹珠库 / 倍率 */
    this._ledBank = { x: 300, y: 138, w: 200, h: 84 };
    this._ledTier = { x: 512, y: 138, w: 140, h: 84 };
    var leds = [this._ledBank, this._ledTier];
    var labels = ['弹珠库', '倍率'];
    for (var li = 0; li < 2; li++) {
      var lr = leds[li];
      ui.rr(ctx, lr.x, lr.y, lr.w, lr.h, 12);
      ctx.fillStyle = C.segBg;
      ctx.fill();
      ctx.strokeStyle = C.segFrame;
      ctx.lineWidth = 4;
      ctx.stroke();
      ui.font(ctx, 18);
      ctx.fillStyle = 'rgba(255,120,100,0.75)';
      ctx.fillText(labels[li], lr.x + lr.w / 2, lr.y + 20);
    }

    /* 温馨提示行 */
    ui.font(ctx, 16);
    ctx.fillStyle = 'rgba(107,68,9,0.8)';
    ctx.fillText('本机不适合4岁以下儿童使用 · 弹珠只供游戏,严禁吞食', W / 2 - 40, 272);

    /* 背板与场地之间横梁 */
    ui.rr(ctx, 8, backH - 16, W - 16, 24, 10);
    ctx.fillStyle = C.frame;
    ctx.fill();

    /* ---- 场地(暖黄玻璃斜面,铺满全宽;左右上角对称圆角与导轨重合) ---- */
    var R2 = b.cornerL.r;
    function fieldPath(c) {
      c.beginPath();
      c.moveTo(b.fieldX0 + R2, b.ceilingY);
      c.lineTo(W - 15 - R2, b.ceilingY);
      c.arcTo(W - 15, b.ceilingY, W - 15, b.ceilingY + R2, R2);
      c.lineTo(W - 15, b.floorY - 6);
      c.lineTo(b.fieldX0, b.floorY - 6);
      c.lineTo(b.fieldX0, b.ceilingY + R2);
      c.arcTo(b.fieldX0, b.ceilingY, b.fieldX0 + R2, b.ceilingY, R2);
      c.closePath();
    }
    fieldPath(ctx);
    var field = ctx.createLinearGradient(0, backH, 0, b.floorY);
    field.addColorStop(0, C.fieldTop);
    field.addColorStop(1, C.fieldBot);
    ctx.fillStyle = field;
    ctx.fill();

    /* 白星印花 */
    ctx.save();
    fieldPath(ctx);
    ctx.clip();
    var deco = [[120, 470, 16], [380, 430, 13], [560, 500, 15], [210, 700, 18], [480, 760, 14], [90, 950, 15], [340, 1000, 17], [560, 1010, 13], [160, 1150, 14], [420, 1180, 12]];
    for (var di = 0; di < deco.length; di++) {
      ui.drawStarSticker(ctx, deco[di][0], deco[di][1], deco[di][2], di * 0.7, 0.5);
    }
    /* 玻璃反光 */
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = C.glassShine;
    ctx.beginPath();
    ctx.moveTo(W * 0.16, backH);
    ctx.lineTo(W * 0.4, backH);
    ctx.lineTo(W * 0.12, b.floorY);
    ctx.lineTo(-W * 0.12, b.floorY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W * 0.52, backH);
    ctx.lineTo(W * 0.6, backH);
    ctx.lineTo(W * 0.32, b.floorY);
    ctx.lineTo(W * 0.24, b.floorY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    /* ---- 发射道槽(场内右侧,自内墙顶以下) ---- */
    ctx.fillStyle = 'rgba(120,80,30,0.14)';
    ctx.fillRect(b.lane.x0 + 4, b.lane.top, W - 15 - b.lane.x0 - 4, b.lane.floorY - b.lane.top);
    ctx.fillStyle = C.cabYellowLo;
    ctx.fillRect(b.lane.x0 - 3, b.lane.top, 6, b.lane.floorY - b.lane.top);
    /* 拉杆旋钮 */
    ctx.beginPath();
    ctx.arc(b.lane.cx, b.lane.floorY + 40, 17, 0, U.TAU);
    ctx.fillStyle = '#c9302c';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    /* 边界与导流一体轨:左墙 → 左弧角 → 顶轨 → 右弧角 → 右墙,同款样式一气呵成 */
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.cabYellowLo;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(b.fieldX0 + 2, b.floorY - 56);
    ctx.lineTo(b.fieldX0 + 2, b.cornerL.cy);
    ctx.arc(b.cornerL.cx, b.cornerL.cy, b.cornerL.r, Math.PI, Math.PI * 1.5, false);
    ctx.lineTo(b.cornerR.cx, b.ceilingY);
    ctx.arc(b.cornerR.cx, b.cornerR.cy, b.cornerR.r, Math.PI * 1.5, Math.PI * 2, false);
    ctx.lineTo(W - 17, b.floorY - 56);
    ctx.stroke();
    ctx.strokeStyle = C.cabYellowHi;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
    /* 弹道内墙顶圆帽 */
    ctx.beginPath();
    ctx.arc(b.lane.x0, b.lane.top, 8, 0, U.TAU);
    ctx.fillStyle = C.cabYellowHi;
    ctx.fill();

    /* ---- 边框 LED 灯带(静态底) ---- */
    for (var bi = 0; bi < b.borderLeds.length; bi++) {
      var bd = b.borderLeds[bi];
      var col = bd.color === 'red' ? C.ledRed : C.ledGreen;
      ctx.beginPath();
      ctx.arc(bd.x, bd.y, 7, 0, U.TAU);
      ctx.fillStyle = C.ledDim;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bd.x, bd.y, 4.5, 0, U.TAU);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* ---- 洞口木条 ---- */
    ui.rr(ctx, b.fieldX0 - 8, b.floorY - 58, b.fieldRight - b.fieldX0 + 16, 66, 14);
    var rail = ctx.createLinearGradient(0, b.floorY - 58, 0, b.floorY + 8);
    rail.addColorStop(0, C.railHi);
    rail.addColorStop(1, C.rail);
    ctx.fillStyle = rail;
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,55,15,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (var hi = 0; hi < b.holes.length; hi++) {
      var hk = b.holes[hi];
      ctx.beginPath();
      ctx.ellipse(hk.cx, b.floorY - 26, b.pw * 0.5 - 6, 14, 0, 0, U.TAU);
      ctx.fillStyle = C.holeDark;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    /* 隔针 */
    for (var dvi = 0; dvi < b.dividers.length; dvi++) {
      var dv = b.dividers[dvi];
      ctx.strokeStyle = 'rgba(90,55,15,0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(dv.x1, dv.y1);
      ctx.lineTo(dv.x1, b.floorY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dv.x1, dv.y1, 5.5, 0, U.TAU);
      ctx.fillStyle = '#fdf9f2';
      ctx.fill();
      ctx.strokeStyle = '#c9973f';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* ---- 操作台 ---- */
    var panelY = H - b.panelH;
    ui.rr(ctx, 8, panelY, W - 12, H - panelY - 4, 24);
    var panel = ctx.createLinearGradient(0, panelY, 0, H);
    panel.addColorStop(0, C.cabYellowHi);
    panel.addColorStop(1, C.cabYellow);
    ctx.fillStyle = panel;
    ctx.fill();
    ctx.strokeStyle = C.frame;
    ctx.lineWidth = 6;
    ctx.stroke();

    /* 弹珠库托盘 */
    ctx.textAlign = 'left';
    ui.font(ctx, 22);
    ctx.fillStyle = C.panelText;
    ctx.fillText('弹珠库', 46, panelY + 40);

    /* GO 按钮(金属底座插孔) */
    this._go = { x: 195, y: panelY + 148, r: 44 };
    ctx.beginPath();
    ctx.arc(this._go.x, this._go.y, this._go.r + 12, 0, U.TAU);
    var rim = ctx.createLinearGradient(this._go.x - 56, this._go.y - 56, this._go.x + 56, this._go.y + 56);
    rim.addColorStop(0, '#e8eaee');
    rim.addColorStop(0.5, '#b9bcc4');
    rim.addColorStop(1, '#8f939e');
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this._go.x, this._go.y, this._go.r, 0, U.TAU);
    ctx.fillStyle = 'rgba(70,40,8,0.3)';
    ctx.fill();

    /* 力度条 */
    this._bar = { x: 288, y: panelY + 56, w: 32, h: b.panelH - 118 };
    ui.rr(ctx, this._bar.x, this._bar.y, this._bar.w, this._bar.h, 10);
    ctx.fillStyle = 'rgba(90,55,15,0.25)';
    ctx.fill();
    ctx.strokeStyle = C.panelText;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'center';
    ui.font(ctx, 18);
    ctx.fillStyle = C.panelText;
    ctx.fillText('力度', this._bar.x + this._bar.w / 2, this._bar.y - 16);

    /* 投入档位标签 */
    ctx.textAlign = 'center';
    ui.font(ctx, 20);
    ctx.fillStyle = C.panelText;
    ctx.fillText('投入弹珠(选倍率)', 536, panelY + 40);
    ui.font(ctx, 16);
    ctx.fillStyle = 'rgba(107,68,9,0.75)';
    ctx.fillText('投入越多 · 倍率越高 · 亮灯越少', 536, panelY + 148);

    /* 提示 */
    ui.font(ctx, 21);
    ctx.fillText('按住蓄力 · 松手弹珠', this._go.x, panelY + b.panelH - 26);

    this.bg = off;
  };

  /* ================= 渲染 ================= */

  Game.prototype.render = function () {
    var ctx = this.ctx;
    var p = this.platform;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) {
      ctx.drawImage(this.bg, 0, 0);
    } else {
      ctx.fillStyle = C.cabYellow;
      ctx.fillRect(0, 0, p.canvas.width, p.canvas.height);
    }

    var s = this.view.scale * p.dpr;
    ctx.setTransform(s, 0, 0, s,
      (this.view.offX + this.fx.sx * this.view.scale) * p.dpr,
      (this.view.offY + this.fx.sy * this.view.scale) * p.dpr);

    this.frameButtons.length = 0;

    var st = this.state;
    if (st === 'menu') {
      MG.ui.renderMenu(this, false);
    } else if (st === 'help') {
      MG.ui.renderMenu(this, true);
      MG.ui.renderHelp(this);
    } else {
      this.renderPlay();
      if (st === 'pause') MG.ui.renderPause(this);
      else if (st === 'result') MG.ui.renderResult(this);
    }
  };

  Game.prototype.renderPlay = function () {
    var ctx = this.ctx;
    var b = this.board;
    var W = this.view.W, H = this.view.H;
    var t = this.time;
    var ui = MG.ui;
    var i;

    /* ---- 背板:LED 数值 + 小按钮 ---- */
    this.drawSeg(this._ledBank, String(this.bank));
    this.drawSeg(this._ledTier, '×' + this.tier().mult);
    ui.iconButton(this, 56, 50, 24, 'sound', function () { this.toggleMute(); }.bind(this));
    ui.iconButton(this, W - 56, 50, 24, 'pause', function () { this.state = 'pause'; this.stateT = 0; }.bind(this));

    /* ---- 弹道箭头 ---- */
    var gap = 90;
    var anim = (t * 170) % gap;
    ctx.save();
    ctx.fillStyle = 'rgba(255,209,102,0.5)';
    for (i = 0; i < 5; i++) {
      var ay = b.lane.floorY - 60 - i * gap + anim;
      if (ay < b.lane.top + 30 || ay > b.lane.floorY - 20) continue;
      ctx.beginPath();
      ctx.moveTo(b.lane.cx - 9, ay + 11);
      ctx.lineTo(b.lane.cx, ay - 9);
      ctx.lineTo(b.lane.cx + 9, ay + 11);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    /* ---- 边框 LED 追逐灯 ---- */
    var bl = b.borderLeds;
    var head = Math.floor(t * 7) % bl.length;
    for (var k = 0; k < 3; k++) {
      var idx = (head + k) % bl.length;
      var bd = bl[idx];
      var col = bd.color === 'red' ? C.ledRed : C.ledGreen;
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(bd.x, bd.y, 5.5, 0, U.TAU);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9 - k * 0.25;
      ctx.fill();
      ctx.restore();
    }

    /* ---- 拉杆闪亮(发射瞬间) ---- */
    if (this.launcherPulse > 0) {
      ctx.save();
      ctx.globalAlpha = this.launcherPulse * 0.7;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(b.lane.cx, b.lane.floorY + 40, 17, 0, U.TAU);
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      ctx.restore();
    }

    /* ---- 钉子 ---- */
    for (i = 0; i < b.pegs.length; i++) {
      var p = b.pegs[i];
      if (p.led) {
        var lc = p.led === 'red' ? C.ledRed : C.ledGreen;
        var pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7);
        ctx.save();
        ctx.shadowColor = lc;
        ctx.shadowBlur = 8 + pulse * 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, U.TAU);
        ctx.fillStyle = lc;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.3, 0, U.TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, U.TAU);
        ctx.fillStyle = C.pegBody;
        ctx.fill();
        ctx.strokeStyle = C.pegRim;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.32, 0, U.TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
      }
      if (p.flash > 0) {
        ctx.globalAlpha = p.flash * 0.9;
        ctx.fillStyle = C.pegFlash;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 3, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* ---- 大弹柱 ---- */
    for (i = 0; i < b.bumpers.length; i++) {
      var bp = b.bumpers[i];
      var r = bp.r + bp.pulse * 5;
      var bg2 = ctx.createRadialGradient(bp.x - r * 0.3, bp.y - r * 0.3, 2, bp.x, bp.y, r);
      bg2.addColorStop(0, 'rgba(255,255,255,0.95)');
      bg2.addColorStop(0.6, 'rgba(235,225,200,0.9)');
      bg2.addColorStop(1, 'rgba(180,150,95,0.9)');
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, r, 0, U.TAU);
      ctx.fillStyle = bg2;
      ctx.fill();
      ctx.strokeStyle = C.bumperRing;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    /* ---- 亮灯洞(动态辉光) ---- */
    for (i = 0; i < b.holes.length; i++) {
      var hk = b.holes[i];
      if (hk.lit) {
        var pulse2 = 0.5 + 0.5 * Math.sin(t * 3.4 + i);
        ctx.save();
        ctx.shadowColor = C.holeLit;
        ctx.shadowBlur = 16 + pulse2 * 10;
        ctx.beginPath();
        ctx.ellipse(hk.cx, b.floorY - 26, b.pw * 0.5 - 6, 14, 0, 0, U.TAU);
        ctx.fillStyle = C.holeLit;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(hk.cx, b.floorY - 26, (b.pw * 0.5 - 6) * 0.45, 5.5, 0, 0, U.TAU);
        ctx.fillStyle = '#ffd9c9';
        ctx.fill();
      }
      if (hk.flash > 0) {
        ctx.globalAlpha = hk.flash * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(hk.cx, b.floorY - 26, b.pw * 0.5 - 6, 14, 0, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* ---- 玻璃弹珠 ---- */
    var tints = C.marbleTints;
    var balls = this.world.balls;
    for (i = 0; i < balls.length; i++) {
      var m = balls[i];
      if (m.dead) continue;
      var tintC = tints[m.skin % tints.length];
      for (var k2 = 0; k2 < m.trail.length; k2++) {
        var tr = m.trail[k2];
        var a = (k2 + 1) / m.trail.length;
        ctx.globalAlpha = a * 0.16;
        ctx.fillStyle = tintC;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, m.r * (0.3 + 0.5 * a), 0, U.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ui.drawMarble(ctx, m.x, m.y, m.r, tintC);
    }

    /* ---- 特效 ---- */
    MG.fx.render(ctx, this.fx);

    /* ---- 操作台动态:档位按钮 / GO / 力度条 / 托盘 ---- */

    /* 投入档位按钮(右下角) */
    var cw = 70, ch = 64, gap2 = 5;
    var cx0 = 536 - (CFG.tiers.length * (cw + gap2) - gap2) / 2;
    for (i = 0; i < CFG.tiers.length; i++) {
      var tp = CFG.tiers[i];
      var cx = cx0 + i * (cw + gap2);
      var cy = H - b.panelH + 62;
      var selected = i === this.selIdx;
      var disabled = tp.cost > this.bank;
      ui.rr(ctx, cx, cy, cw, ch, 12);
      if (selected) {
        ctx.fillStyle = '#e8352e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
      } else if (disabled) {
        ctx.fillStyle = 'rgba(120,90,50,0.35)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,90,50,0.4)';
      } else {
        ctx.fillStyle = C.cream;
        ctx.fill();
        ctx.strokeStyle = '#e8b45a';
      }
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.font(ctx, 17);
      ctx.fillStyle = selected ? '#ffd9c9' : (disabled ? 'rgba(107,68,9,0.5)' : C.dim);
      ctx.fillText(tp.cost + '颗', cx + cw / 2, cy + 18);
      ui.font(ctx, 26);
      ctx.fillStyle = selected ? '#ffffff' : (disabled ? 'rgba(107,68,9,0.5)' : '#6b4409');
      ctx.fillText('×' + tp.mult, cx + cw / 2, cy + 44);
      if (!disabled) {
        (function (idx) {
          this.frameButtons.push({ x: cx, y: cy, w: cw, h: ch, cb: function () { this.selectTier(idx); }.bind(this) });
        }).call(this, i);
      }
    }

    var power = this.charging ? this.chargePower() : 0;

    /* 力度条填充 */
    if (power > 0.01) {
      var bar = this._bar;
      var fh = (bar.h - 8) * power;
      var pc = power < 0.5 ? '#7ec850' : (power < 0.8 ? '#ffb84d' : '#ff5c47');
      ui.rr(ctx, bar.x + 4, bar.y + bar.h - 4 - fh, bar.w - 8, fh, 7);
      ctx.fillStyle = pc;
      ctx.fill();
    }

    /* GO 按钮 */
    var go = this._go;
    var pressed = this.charging;
    var gg = ctx.createRadialGradient(go.x - 12, go.y - 14, 6, go.x, go.y, go.r);
    gg.addColorStop(0, pressed ? '#ff8f7a' : '#ff6a52');
    gg.addColorStop(1, pressed ? '#c62f2f' : '#e0392e');
    ctx.beginPath();
    ctx.arc(go.x, go.y, pressed ? go.r - 3 : go.r, 0, U.TAU);
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ui.font(ctx, 32);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GO', go.x, go.y + 1);

    if (this.charging) {
      ctx.beginPath();
      ctx.arc(go.x, go.y, go.r + 12, -Math.PI / 2, -Math.PI / 2 + power * U.TAU * 0.83);
      ctx.strokeStyle = power < 0.5 ? '#7ec850' : (power < 0.8 ? '#ffb84d' : '#ff5c47');
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    if (this.launcherPulse > 0) {
      ctx.beginPath();
      ctx.arc(go.x, go.y, go.r + 12 + this.launcherPulse * 14, 0, U.TAU);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * this.launcherPulse) + ')';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    /* 弹珠库托盘点位 */
    var n2 = Math.min(this.bank, 6);
    for (i = 0; i < n2; i++) {
      var tx = 50 + (i % 3) * 34;
      var ty = H - b.panelH + 86 + Math.floor(i / 3) * 36;
      ui.drawMarble(ctx, tx, ty, 12, tints[i % tints.length]);
    }
    if (this.bank > 6) {
      ui.font(ctx, 22);
      ctx.textAlign = 'left';
      ctx.fillStyle = C.panelText;
      ctx.fillText('×' + this.bank, 50, H - b.panelH + 168);
    }
  };

  /* 红色 LED 数码管 */
  Game.prototype.drawSeg = function (rect, text) {
    var ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h * 0.62);
    MG.ui.segFont(ctx, rect.w > 180 ? 52 : 46);
    ctx.shadowColor = C.segRed;
    ctx.shadowBlur = 16;
    ctx.fillStyle = C.segRed;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  /* ================= 主循环 ================= */

  Game.prototype.frame = function (dt) {
    this.update(dt);
    this.render();
  };

  Game.prototype.start = function () {
    var self = this;
    this._last = 0;
    function loop(ts) {
      var t = (ts || Date.now()) / 1000;
      if (!self._last) self._last = t;
      var dt = Math.min(0.05, t - self._last);
      self._last = t;
      self.frame(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  };

  MG.Game = Game;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
