/* 弹弹弹珠吧 - 游戏主逻辑 (命名空间: MG.Game)
 * 复刻玻璃珠游艺机:
 *   - 右下角先选投入弹珠数(1~5 颗)= 选倍率 ×2~×6,投入越多亮灯的洞越少
 *   - 按住蓄力,松手把弹珠从右下角往上弹,冲过顶部导弧拐入斜面场地
 *   - 力度太小弹珠滚回来,退还投入;从亮灯的洞滑落 = 中奖,赢回 投入×倍率 颗
 *   - ×6 中奖送礼品卡,每次中奖送玩具球;弹珠库见底本局结束
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
    this.songIdx = platform.storage.get('mm_song', 0) | 0;
    /* 双声道音量:音效 / 音乐各自独立(旧 mm_vol 迁移为两者初值) */
    var legacyVol = Math.max(0, Math.min(1, platform.storage.get('mm_vol', 0.8)));
    this.volSfx = Math.max(0, Math.min(1, platform.storage.get('mm_vol_sfx', legacyVol)));
    this.volMusic = Math.max(0, Math.min(1, platform.storage.get('mm_vol_music', legacyVol)));
    MG.music.init(platform);
    MG.music.setMuted(this.muted);
    MG.music.setVolume(this.volMusic);
    MG.audio.setVolume(this.volSfx);
    MG.music.setSong(this.songIdx);

    /* 视口 */
    this.view = { scale: 1, offX: 0, offY: 0, W: CFG.DESIGN_W, H: 1500 };
    this.computeView();

    /* 状态 */
    this.state = 'menu';
    this.stateT = 0;
    this.time = 0;
    this.bank = 0;
    this.selIdx = 0;
    this.launched = 0;
    this.wins = 0;
    this.maxWin = 0;
    this.prizeBalls = 0;
    this.giftCards = 0;
    this.tierPopT = 0;
    this.newRecord = false;
    this.roundEnded = false;
    this.lastEarned = 0;
    this.skinIdx = 0;
    this.endTimer = -1;
    this.launcherCool = 0;
    this.launcherPulse = 0;
    this.charging = false;
    this.chargeT = 0;
    this.sliderArmed = false;
    this._downT = 0;
    this.frameButtons = [];
    this.fx = MG.fx.create();
    this.bg = null;
    this._segSprites = {};

    /* 预先绑定高频 UI 回调,避免每帧重复产生函数闭包 */
    this._onToggleMute = function () { self.toggleMute(); };
    this._onCycleMusic = function () { self.cycleMusic(); };
    this._onBackHome = function () { self.backToMenu(); };
    this._onPause = function () { self.state = 'pause'; self.stateT = 0; self.charging = false; MG.music.pause(); };
    this._onResume = function () { self.state = 'play'; self.stateT = 0; MG.music.play(); };
    this._onStartGame = function () { self.startGame(); };
    this._onRestart = function () { self.restartRound(); };
    this._onOpenHelp = function () { self.state = 'help'; self.stateT = 0; };
    this._onCloseHelp = function () { self.state = 'menu'; self.stateT = 0; };
    this._onToggleTheme = function () { self.setTheme(self.theme === 'arcade' ? 'min' : 'arcade'); };
    this._onSidebar = function () { self.platform.addToSidebar(); };
    this._onShare = function () {
      self.platform.share('我在「弹弹弹珠吧」中了 ' + self.wins + ' 次,最大单次赢 ' + U.fmt(self.maxWin) + ' 颗弹珠!');
    };
    this._tierCbs = [];
    for (var ti = 0; ti < CFG.tiers.length; ti++) {
      (function (idx) {
        self._tierCbs.push(function () { self.selectTier(idx); });
      })(ti);
    }

    /* 主题:极简(默认)/ 复古街机 */
    this.theme = platform.storage.get('mm_theme', 'min') === 'arcade' ? 'arcade' : 'min';
    CFG.setTheme(this.theme);

    this.buildBoard(0);

    /* 输入 */
    platform.onTouch('down', function (pt) { self.handleDown(pt); });
    platform.onTouch('move', function (pt) {
      if (self.sliderArmed) {
        var p = self.toLogical(pt.x, pt.y);
        self.setChannelVolume(self.sliderArmed, p.x);
      }
    });
    platform.onTouch('up', function (pt) { self.handleUp(pt); });
    platform.onResize(function () {
      /* 窗口尺寸变化时先退还在飞弹珠的投入,重建棋盘后恢复亮灯状态 */
      if (self.world && self.world.balls.length > 0) {
        for (var bi = 0; bi < self.world.balls.length; bi++) {
          var mb = self.world.balls[bi];
          if (!mb.dead) self.bank += (mb.bet || 1);
        }
      }
      self.computeView();
      self._segSprites = {};
      self.buildBoard(self.round || 0);
      if (self.state === 'play' || self.state === 'pause' || self.state === 'result') {
        self.applyLit();
      }
    });
  }

  /* ================= 视口 ================= */

  Game.prototype.computeView = function () {
    var p = this.platform;
    var safe = p.safeTop || 0;
    var availH = Math.max(400, p.cssH - safe);
    var H = U.clamp(CFG.DESIGN_W * availH / p.cssW, CFG.H_MIN, CFG.H_MAX);
    var scale = Math.min(p.cssW / CFG.DESIGN_W, availH / H);
    this.view.W = CFG.DESIGN_W;
    this.view.H = H;
    this.view.scale = scale;
    this.view.offX = (p.cssW - CFG.DESIGN_W * scale) / 2;
    this.view.offY = safe + (availH - H * scale) / 2;
    this.iconRowY = 42;
    if (p.capsuleY) {
      this.iconRowY = U.clamp((p.capsuleY + (p.iconRowAdjCss || 0) - this.view.offY) / scale, 8, 96);
    }
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
      peg.kind = 'peg'; peg.e = 0.12;
      this.world.addCircle(peg);
    }
    for (i = 0; i < this.board.bumpers.length; i++) {
      var bumper = this.board.bumpers[i];
      bumper.e = 0.25;
      this.world.addCircle(bumper);
    }
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
    MG.music.play();   /* 确保从暂停回菜单再开局时背景音乐正常恢复 */
    this.bank = CFG.startBank;
    this.selIdx = 0;
    this.launched = 0;
    this.wins = 0;
    this.maxWin = 0;
    this.prizeBalls = 0;
    this.giftCards = 0;
    this.roundEnded = false;
    this.buildBoard(1);
    this.applyLit();
    this.state = 'play';
    this.stateT = 0;
    MG.audio.play('click');
  };

  Game.prototype.restartRound = function () {
    MG.music.play();
    this.bank = CFG.startBank;
    this.selIdx = 0;
    this.launched = 0;
    this.wins = 0;
    this.maxWin = 0;
    this.prizeBalls = 0;
    this.giftCards = 0;
    this.roundEnded = false;
    this.buildBoard((this.round || 0) + 1);
    this.applyLit();
    this.state = 'play';
    this.stateT = 0;
    MG.audio.play('click');
  };

  Game.prototype.backToMenu = function () {
    this.charging = false;
    this.sliderArmed = false;
    this.state = 'menu';
    this.stateT = 0;
    this.buildBoard(0);
    MG.audio.play('click');
  };

  Game.prototype.cycleMusic = function () {
    var name = MG.music.next();
    this.platform.storage.set('mm_song', MG.music.current());
    var isArc = this.theme === 'arcade';
    this.fxLabel(150, (this.iconRowY || 42) + 54, '♪ ' + name, {
      size: 22,
      color: isArc ? '#fff8ea' : '#2f2d29',
      stroke: isArc ? 'rgba(60,34,6,0.7)' : 'rgba(255,255,255,0.9)',
      life: 1.5
    });
    MG.audio.play('click');
  };

  Game.prototype.toggleMute = function () {
    this.muted = MG.audio.toggleMuted();
    this.platform.storage.set('mm_mute', this.muted);
    MG.music.setMuted(this.muted);
    if (!this.muted) MG.audio.play('click');
  };

  Game.prototype.endRound = function () {
    if (this.roundEnded) return;
    this.roundEnded = true;
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

  /* 余额不足当前档位时自动退到最高可投档位 */
  Game.prototype.clampTier = function () {
    while (this.selIdx > 0 && CFG.tiers[this.selIdx].cost > this.bank) {
      this.selIdx--;
    }
  };

  Game.prototype.selectTier = function (idx) {
    var t = CFG.tiers[idx];
    if (!t || t.cost > this.bank || idx === this.selIdx) return;
    this.selIdx = idx;
    this.applyLit();
    this.tierPopT = 0.2;
    MG.audio.play('click');
  };

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
    MG.music.unlock();
    var p = this.toLogical(pt.x, pt.y);
    for (var i = this.frameButtons.length - 1; i >= 0; i--) {
      var b = this.frameButtons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        b.cb();
        return;
      }
    }
    if (this.state === 'pause' && this.sliders) {
      for (var s = 0; s < this.sliders.length; s++) {
        var sl = this.sliders[s];
        if (p.x >= sl.x - 20 && p.x <= sl.x + sl.w + 20 && Math.abs(p.y - sl.knobY) < 32) {
          this.sliderArmed = sl;
          this.setChannelVolume(sl, p.x);
          return;
        }
      }
    }
    if (this.state !== 'play') return;
    if (this.world.balls.length > 0) {
      this.fxLabel(this.board.lane.cx - 10, this.board.lane.floorY - 130, '等上一颗落定', { size: 22, color: '#fff8ea', life: 0.8 });
      return;
    }
    if (this.bank < this.tier().cost) {
      this.fxLabel(this.board.lane.cx - 10, this.board.lane.floorY - 80, '弹珠不够', { size: 22, color: '#e8352e' });
      return;
    }
    this.charging = true;
    this.chargeT = 0;
    this._downT = this.time;
  };

  Game.prototype.setChannelVolume = function (sl, x) {
    var v = U.clamp((x - sl.x) / sl.w, 0, 1);
    v = Math.round(v * 100) / 100;
    if (sl.key === 'music') {
      this.volMusic = v;
      MG.music.setVolume(v);
      this.platform.storage.set('mm_vol_music', v);
    } else {
      this.volSfx = v;
      MG.audio.setVolume(v);
      this.platform.storage.set('mm_vol_sfx', v);
    }
  };

  Game.prototype.handleUp = function () {
    if (this.sliderArmed) { this.sliderArmed = false; return; }
    if (!this.charging) return;
    this.charging = false;
    if (this.state !== 'play') return;
    var quick = (this.time - this._downT) < CFG.launcher.tapJudge;
    var power = quick ? CFG.launcher.tapPower : this.chargePower();
    this.launch(power);
  };

  Game.prototype.chargePower = function () {
    var c = (this.chargeT * CFG.launcher.chargeSpeed) % 1;
    if (c < 0) c += 1;
    return c < 0.5 ? c * 2 : 2 - c * 2;
  };

  Game.prototype.launch = function (power) {
    if (this.state !== 'play' || this.launcherCool > 0) return;
    if (this.world.balls.length > 0) {
      this.fxLabel(this.board.lane.cx - 10, this.board.lane.floorY - 130, '等上一颗落定', { size: 22, color: '#fff8ea', life: 0.8 });
      return;
    }
    var tier = this.tier();
    if (this.bank < tier.cost) {
      this.fxLabel(this.board.lane.cx - 10, this.board.lane.floorY - 80, '弹珠不够', { size: 22, color: '#e8352e' });
      return;
    }
    this.bank -= tier.cost;
    this.launched++;

    var lane = this.board.lane;
    var cp = CFG.launcher.crestPower;
    var crest = this.board.crestSpeed || CFG.launcher.crestSpeed;
    var frac = (crest - CFG.launcher.minSpeed) / (CFG.launcher.maxSpeed - CFG.launcher.minSpeed);
    var lp;
    if (power <= cp) {
      var t = power / cp;
      t = t * t * (3 - 2 * t);
      lp = t * frac;
    } else {
      lp = frac + (1 - frac) * ((power - cp) / (1 - cp));
    }
    var speed = U.lerp(CFG.launcher.minSpeed, CFG.launcher.maxSpeed, lp);
    var jx = U.rand(-16, 16);
    var m = new MG.entities.Marble(lane.spawn.x + jx * 0.4, lane.spawn.y, jx * 3, -speed * U.rand(0.975, 1.025), this.skinIdx++ % C.marbleTints.length);
    m.bet = tier.cost;
    m.mult = tier.mult;
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
        if (!(e.circle.sndCd > 0)) {
          e.circle.sndCd = 0.15;
          MG.audio.play('bumper', { vol: Math.min(1, 0.4 + e.speed / 2000) });
        }
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

  Game.prototype.fxLabel = function (x, y, str, opts) {
    opts = opts || {};
    var size = opts.size || 24;
    var half = str.length * size * 0.46 + 14;
    var cx = U.clamp(x, half, this.view.W - half);
    MG.fx.text(this.fx, cx, y, str, opts);
  };

  Game.prototype.refund = function (m) {
    this.bank += (m.bet || 1);
    MG.fx.drop(this.fx, m.x, m.y, m.r, C.marbleTints[m.skin % C.marbleTints.length]);
    m.dead = true;
    var lane = this.board.lane;
    this.fxLabel(lane.cx - 20, lane.floorY - 90, '力气太小 退' + (m.bet || 1) + '颗', { size: 24, color: '#fff8ea', life: 1.1 });
    MG.audio.play('click');
  };

  Game.prototype.rescueRefund = function (m) {
    this.bank += (m.bet || 1);
    MG.fx.drop(this.fx, m.x, m.y, m.r, C.marbleTints[m.skin % C.marbleTints.length]);
    m.dead = true;
    MG.fx.text(this.fx, m.x, m.y - 44, '退' + (m.bet || 1) + '颗', { size: 22, color: '#9a9a9a', life: 1.1 });
    MG.audio.play('click');
  };

  Game.prototype.setTheme = function (t) {
    this.theme = (t === 'arcade') ? 'arcade' : 'min';
    this.platform.storage.set('mm_theme', this.theme);
    MG.config.setTheme(this.theme);
    this._segSprites = {};
    this.buildBg();
  };

  Game.prototype.themeLabel = function () {
    return this.theme === 'arcade' ? '复古街机' : '极简';
  };

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
      MG.fx.drop(this.fx, m.x, m.y, m.r, C.marbleTints[m.skin % C.marbleTints.length]);

      MG.fx.text(this.fx, this.view.W / 2, b.floorY - 170, '中 奖  ×' + (m.mult || 2), { size: 56, color: '#e8352e', life: 1.6 });
      this.fxLabel(hole.cx, b.floorY - 96, '+' + gained + ' 颗  玩具球+1' + (gotCard ? '  礼品卡+1' : ''), { size: 26, color: '#fff8ea', life: 1.5 });
      MG.fx.burst(this.fx, hole.cx, b.floorY - 30, '#ff4a3a', 44, 440);
      MG.fx.ring(this.fx, hole.cx, b.floorY - 30, '#ff4a3a', 120, 0.5, 6);
      MG.audio.play('jackpot');
      MG.fx.shake(this.fx, 10);
      this.platform.vibrate();
    } else {
      hole.flash = 0.6;
      MG.fx.drop(this.fx, m.x, m.y, m.r, C.marbleTints[m.skin % C.marbleTints.length]);
      MG.fx.burst(this.fx, m.x, b.floorY - 26, '#d9b26a', 8, 180);
      MG.audio.play('slot', { pitch: 0.85, vol: 0.6 });
    }
    this.clampTier();
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
    var i;

    if (this.charging && this.world.balls.length === 0 && this.launcherCool <= 0) {
      this.chargeT += dt;
    }
    this.launcherCool -= dt;
    this.launcherPulse = Math.max(0, this.launcherPulse - dt * 4);

    this.world.step(dt, 12);

    var balls = this.world.balls;
    var alive = 0;
    for (i = 0; i < balls.length; i++) {
      var m = balls[i];
      if (m.dead) continue;
      alive++;

      m.age += dt;
      m.wallSndT -= dt;

      /* 拖尾(复用槽位对象避免高频分配) */
      m.trailT -= dt;
      if (m.trailT <= 0) {
        m.trailT = 0.035;
        if (m.trail.length < 7) {
          m.trail.push({ x: m.x, y: m.y });
        } else {
          var oldest = m.trail.shift();
          oldest.x = m.x; oldest.y = m.y;
          m.trail.push(oldest);
        }
      }

      var speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);

      /* 弹道内滚回检测 */
      if (m.x > b.lane.x0 - 5 && m.y > b.lane.floorY - 190) {
        if (speed < CFG.launcher.refundSlow) m.refundT = (m.refundT || 0) + dt;
        else m.refundT = 0;
        if (m.refundT > CFG.launcher.refundTime) { this.refund(m); continue; }
      } else {
        m.refundT = 0;

        if (m.y > b.capY - 6 && m.y < b.floorY + 30 && m.x < b.lane.x0 - 10) {
          this.captureHole(m);
          continue;
        }

        if (speed < 40) m.stuckTotal = (m.stuckTotal || 0) + dt;
        else m.stuckTotal = Math.max(0, (m.stuckTotal || 0) - dt * 2);
        if (m.rescueCd > 0) m.rescueCd -= dt;
        if (m.stuckTotal > 2.2 && !(m.rescueCd > 0)) {
          m.rescueCd = 0.6;
          m.rescues = (m.rescues || 0) + 1;
          m.vx += U.rand(-240, 240);
          m.vy += U.rand(60, 150);
          MG.fx.text(this.fx, m.x, m.y - 26, '解救', { size: 18, color: '#9a9a9a', life: 0.7 });
        }
        if (m.rescues > 4 || m.age > 25) {
          this.rescueRefund(m);
          continue;
        }
      }
    }

    for (i = 0; i < b.pegs.length; i++) b.pegs[i].flash = Math.max(0, b.pegs[i].flash - dt * 3.5);
    for (i = 0; i < b.bumpers.length; i++) {
      b.bumpers[i].pulse = Math.max(0, b.bumpers[i].pulse - dt * 3);
      if (b.bumpers[i].sndCd > 0) b.bumpers[i].sndCd -= dt;
    }
    for (i = 0; i < b.holes.length; i++) b.holes[i].flash = Math.max(0, b.holes[i].flash - dt * 2);

    if (!this.roundEnded && this.bank < 1 && alive === 0) {
      if (this.endTimer < 0) this.endTimer = 1.0;
      this.endTimer -= dt;
      if (this.endTimer <= 0) { this.endTimer = -1; this.endRound(); }
    }
  };

  /* ================= 背景缓存(整个静态机台 + 静态圆钉) ================= */

  Game.prototype.buildBg = function () {
    var p = this.platform;
    var W = this.view.W, H = this.view.H;
    var b = this.board;
    var cw = p.canvas.width, ch = p.canvas.height;
    /* 复用同一张离屏画布,避免每次重建/换主题泄漏 ~5MB 纹理 */
    var off = this.bg;
    if (!off) {
      off = p.createOffscreen(cw, ch);
    } else if (off.width !== cw || off.height !== ch) {
      off.width = cw;
      off.height = ch;
    }
    var ctx = off.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    var ui = MG.ui;
    if (p.isMinigame) {
      ctx.fillStyle = C.cabYellowHi;
      ctx.fillRect(0, 0, cw, ch);
    }

    var s = this.view.scale * p.dpr;
    ctx.setTransform(s, 0, 0, s, this.view.offX * p.dpr, this.view.offY * p.dpr);

    /* ---- 机身 ---- */
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

    var ARC = CFG.themeName === 'arcade';

    /* ---- 顶部标题面板 ---- */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (ARC) {
      ui.drawStarSticker(ctx, 60, 120, 13, 0.2, 0.8);
      ui.drawStarSticker(ctx, 268, 44, 10, 0.5, 0.7);
      ui.drawStarSticker(ctx, 600, 40, 12, 0.1, 0.8);
      ui.drawStarSticker(ctx, 40, 240, 11, 0.7, 0.7);
      ui.drawStarSticker(ctx, 300, 250, 9, 0.3, 0.6);
      ui.drawPuppy(ctx, 152, (this.iconRowY || 42) + 80, 50);
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
      ctx.fillText('弹弹弹珠吧', 0, 2);
      ui.drawStarSticker(ctx, -146, 0, 9, 0, 0.95);
      ui.drawStarSticker(ctx, 146, 0, 9, 0, 0.95);
      ctx.restore();
    } else {
      var titleY = Math.max(196, (this.iconRowY || 42) + 64);
      ui.font(ctx, 46);
      ctx.fillStyle = C.panelText;
      ctx.fillText('弹弹弹珠吧', 160, titleY);
      ui.font(ctx, 17, false);
      ctx.fillStyle = C.dim;
      ctx.fillText('MARBLE MACHINE', 160, titleY + 40);
    }

    /* 深色 LED 显示屏底座 */
    this._ledBank = { x: 300, y: 200, w: 200, h: 84 };
    this._ledTier = { x: 512, y: 200, w: 140, h: 84 };
    var leds = [this._ledBank, this._ledTier];
    var labels = ['弹珠库', '倍率'];
    for (var li = 0; li < 2; li++) {
      var lr = leds[li];
      ui.rr(ctx, lr.x, lr.y, lr.w, lr.h, 14);
      ctx.fillStyle = C.segBg;
      ctx.fill();
      ui.font(ctx, 16, false);
      ctx.fillStyle = C.ledLabel;
      ctx.fillText(labels[li], lr.x + lr.w / 2, lr.y + 20);
    }

    /* ---- 场地 ---- */
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
    var field = ctx.createLinearGradient(0, b.ceilingY, 0, b.floorY);
    field.addColorStop(0, C.fieldTop);
    field.addColorStop(1, C.fieldBot);
    ctx.fillStyle = field;
    ctx.fill();

    if (ARC) {
      ctx.save();
      fieldPath(ctx);
      ctx.clip();
      var deco = [[120, 470, 16], [380, 430, 13], [560, 500, 15], [210, 700, 18], [480, 760, 14], [90, 950, 15], [340, 1000, 17], [560, 1010, 13], [160, 1150, 14], [420, 1180, 12]];
      for (var di = 0; di < deco.length; di++) {
        ui.drawStarSticker(ctx, deco[di][0], deco[di][1], deco[di][2], di * 0.7, 0.5);
      }
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = C.glassShine;
      ctx.beginPath();
      ctx.moveTo(W * 0.16, b.ceilingY);
      ctx.lineTo(W * 0.4, b.ceilingY);
      ctx.lineTo(W * 0.12, b.floorY);
      ctx.lineTo(-W * 0.12, b.floorY);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(W * 0.52, b.ceilingY);
      ctx.lineTo(W * 0.6, b.ceilingY);
      ctx.lineTo(W * 0.32, b.floorY);
      ctx.lineTo(W * 0.24, b.floorY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* ---- 静态圆钉烘焙进离屏层(极简主题全部圆钉 + 复古主题非 LED 钉) ---- */
    for (var pi = 0; pi < b.pegs.length; pi++) {
      var spg = b.pegs[pi];
      if (ARC && spg.led) continue;
      ctx.beginPath();
      ctx.arc(spg.x + 1, spg.y + 2, spg.r, 0, U.TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(spg.x, spg.y, spg.r, 0, U.TAU);
      ctx.fillStyle = C.pegBody;
      ctx.fill();
      ctx.strokeStyle = C.pegRim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* ---- 发射道槽 ---- */
    ctx.fillStyle = C.laneSlot;
    ctx.fillRect(b.lane.x0 + 8, b.lane.top, (W - 28) - (b.lane.x0 + 8), b.lane.floorY - b.lane.top);
    ctx.fillStyle = C.laneEdge;
    ctx.fillRect(b.lane.x0 - 7, b.lane.top, 14, b.lane.floorY - b.lane.top);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.trackMain;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(b.fieldX0, b.floorY - 56);
    ctx.lineTo(b.fieldX0, b.cornerL.cy);
    ctx.arc(b.cornerL.cx, b.cornerL.cy, b.cornerL.r, Math.PI, Math.PI * 1.5, false);
    ctx.lineTo(b.cornerR.cx, b.ceilingY);
    ctx.arc(b.cornerR.cx, b.cornerR.cy, b.cornerR.r, Math.PI * 1.5, Math.PI * 2, false);
    ctx.lineTo(W - 21, b.floorY - 56);
    ctx.stroke();
    ctx.strokeStyle = C.trackHi;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    /* 墙边斜挡板 */
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.trackMain;
    ctx.lineWidth = 10;
    for (var wi = 0; wi < b.walls.length; wi++) {
      var wsg = b.walls[wi];
      if (wsg.kind !== 'deflector') continue;
      ctx.beginPath();
      ctx.moveTo(wsg.x1, wsg.y1);
      ctx.lineTo(wsg.x2, wsg.y2);
      ctx.stroke();
    }
    ctx.restore();

    /* 弹道内墙顶圆帽 */
    ctx.beginPath();
    ctx.arc(b.lane.x0, b.lane.top, 8, 0, U.TAU);
    ctx.fillStyle = C.capDot;
    ctx.fill();

    /* ---- 边框 LED 灯带(复古主题静态底) ---- */
    if (ARC) {
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
    }

    /* ---- 洞口条 ---- */
    ui.rr(ctx, b.fieldX0 - 8, b.floorY - 58, b.fieldRight - b.fieldX0 + 16, 66, 16);
    if (ARC) {
      var rail = ctx.createLinearGradient(0, b.floorY - 58, 0, b.floorY + 8);
      rail.addColorStop(0, C.railHi);
      rail.addColorStop(1, C.rail);
      ctx.fillStyle = rail;
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,55,15,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = C.rail;
      ctx.fill();
    }

    for (var hi = 0; hi < b.holes.length; hi++) {
      var hk = b.holes[hi];
      ctx.beginPath();
      ctx.ellipse(hk.cx, b.floorY - 26, b.pw * 0.5 - 6, 14, 0, 0, U.TAU);
      ctx.fillStyle = C.holeDark;
      ctx.fill();
      ctx.strokeStyle = C.holeStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    /* 隔针 */
    for (var dvi = 0; dvi < b.dividers.length; dvi++) {
      var dv = b.dividers[dvi];
      ctx.strokeStyle = C.dividerLine;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(dv.x1, dv.y1);
      ctx.lineTo(dv.x1, b.floorY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dv.x1, dv.y1, 5.5, 0, U.TAU);
      ctx.fillStyle = C.capFill;
      ctx.fill();
      ctx.strokeStyle = C.capStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* ---- 操作台 ---- */
    var panelY = H - b.panelH;
    ui.rr(ctx, 8, panelY, W - 12, H - panelY - 4, 24);
    if (ARC) {
      var panel = ctx.createLinearGradient(0, panelY, 0, H);
      panel.addColorStop(0, C.cabYellowHi);
      panel.addColorStop(1, C.cabYellow);
      ctx.fillStyle = panel;
      ctx.fill();
      ctx.strokeStyle = C.frame;
      ctx.lineWidth = 6;
      ctx.stroke();
    } else {
      ctx.fillStyle = C.cabYellowHi;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.textAlign = 'left';
    ui.font(ctx, 22);
    ctx.fillStyle = C.panelText;
    ctx.fillText('弹珠库', 46, panelY + 40);

    /* GO 按钮底座 */
    this._go = { x: 195, y: panelY + 148, r: 44 };
    if (ARC) {
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
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(40,35,25,0.22)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.beginPath();
      ctx.arc(this._go.x, this._go.y, this._go.r, 0, U.TAU);
      ctx.fillStyle = C.goBg;
      ctx.fill();
      ctx.restore();
    }

    /* 力度条 */
    this._bar = { x: 288, y: panelY + 56, w: 32, h: b.panelH - 118 };
    ui.rr(ctx, this._bar.x, this._bar.y, this._bar.w, this._bar.h, 10);
    ctx.fillStyle = C.barTrack;
    ctx.fill();
    if (ARC) {
      ctx.strokeStyle = C.panelText;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ui.font(ctx, 18, false);
    ctx.fillStyle = C.dim;
    ctx.fillText('力度', this._bar.x + this._bar.w / 2, this._bar.y - 16);

    ctx.textAlign = 'center';
    ui.font(ctx, 20);
    ctx.fillStyle = C.panelText;
    ctx.fillText('投入弹珠(选倍率)', 536, panelY + 40);
    ui.font(ctx, 16, false);
    ctx.fillStyle = C.dim;
    ctx.fillText('投入越多 · 倍率越高 · 亮灯越少', 536, panelY + 148);

    ctx.textAlign = 'center';
    ui.font(ctx, 11, false);
    ctx.fillStyle = C.finePrint;
    ctx.fillText('本游戏适合8周岁以上用户使用 · 弹珠只供游戏，严禁吞食', W / 2, panelY + 202);

    ui.font(ctx, 20, false);
    ctx.fillStyle = ARC ? C.panelText : C.dim;
    ctx.fillText('按住蓄力 · 松手弹珠', this._go.x, panelY + b.panelH - 20);

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
    var allowTopHud = (st !== 'help');

    /* 顶部图标簇(help 全屏遮罩时不注册底层按钮,防穿透) */
    MG.ui.iconButton(this, 56, this.iconRowY, 24, 'sound', allowTopHud ? this._onToggleMute : null);
    MG.ui.iconButton(this, 106, this.iconRowY, 24, 'music', allowTopHud ? this._onCycleMusic : null);
    if (p.name === 'douyin' && st === 'menu') {
      MG.ui.iconButton(this, 206, this.iconRowY, 24, 'sidebar', this._onSidebar);
    }
    if (st !== 'menu') {
      MG.ui.iconButton(this, 156, this.iconRowY, 24, 'home', allowTopHud ? this._onBackHome : null);
    }

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

    /* 菜单/说明页切歌提示飘字统一在最上层绘制(此前仅 play 绘制导致菜单切歌无提示) */
    if ((st === 'menu' || st === 'help') && MG.fx.hasActive(this.fx)) {
      MG.fx.render(ctx, this.fx);
    }
  };

  Game.prototype.renderPlay = function () {
    var ctx = this.ctx;
    var p = this.platform;
    var b = this.board;
    var W = this.view.W, H = this.view.H;
    var t = this.time;
    var ui = MG.ui;
    var ARC = CFG.themeName === 'arcade';
    var isPlay = (this.state === 'play');
    var i;

    /* ---- 背板:LED 数值 + 暂停按钮(仅 play 态注册可点区域,防弹窗点击穿透) ---- */
    this.drawSeg('bank', this._ledBank, String(this.bank));
    this.drawSeg('tier', this._ledTier, '×' + this.tier().mult);
    ui.iconButton(this, 206, this.iconRowY, 24, 'pause', isPlay ? this._onPause : null);
    if (p.name === 'douyin') {
      ui.iconButton(this, 256, this.iconRowY, 24, 'sidebar', isPlay ? this._onSidebar : null);
    }

    /* ---- 弹道箭头 ---- */
    var gap = 90;
    var anim = (t * 170) % gap;
    ctx.fillStyle = C.laneArrow;
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

    /* ---- 边框 LED 追逐灯(复古主题:用预渲染辉光替代逐帧 shadowBlur) ---- */
    if (ARC) {
      var bl = b.borderLeds;
      var head = Math.floor(t * 7) % bl.length;
      for (var k = 0; k < 3; k++) {
        var idx = (head + k) % bl.length;
        var bd = bl[idx];
        var col = bd.color === 'red' ? C.ledRed : C.ledGreen;
        var a0 = 0.9 - k * 0.25;
        ui.drawGlow(ctx, bd.x, bd.y, 14, 14, col, a0 * 0.85, p);
        ctx.save();
        ctx.globalAlpha = a0;
        ctx.beginPath();
        ctx.arc(bd.x, bd.y, 5.5, 0, U.TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      }
    }

    /* ---- 拉杆闪亮(发射瞬间) ---- */
    if (this.launcherPulse > 0) {
      ctx.save();
      ctx.globalAlpha = this.launcherPulse * 0.55;
      ctx.beginPath();
      ctx.arc(b.lane.cx, b.lane.floorY - 30, 19, 0, U.TAU);
      ctx.fillStyle = C.pulseColor;
      ctx.fill();
      ctx.restore();
    }

    /* ---- 钉子动态层(静态钉已在 buildBg 烘焙;此处仅画复古 LED 钉与受击闪光) ---- */
    for (i = 0; i < b.pegs.length; i++) {
      var pg = b.pegs[i];
      if (ARC && pg.led) {
        var lc = pg.led === 'red' ? C.ledRed : C.ledGreen;
        var pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7);
        ui.drawGlow(ctx, pg.x, pg.y, pg.r + 8 + pulse * 4, pg.r + 8 + pulse * 4, lc, 0.55 + pulse * 0.35, p);
        ctx.beginPath();
        ctx.arc(pg.x, pg.y, pg.r, 0, U.TAU);
        ctx.fillStyle = lc;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pg.x - pg.r * 0.3, pg.y - pg.r * 0.3, pg.r * 0.3, 0, U.TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
      }
      if (pg.flash > 0) {
        ctx.globalAlpha = pg.flash * 0.9;
        ctx.fillStyle = C.pegFlash;
        ctx.beginPath();
        ctx.arc(pg.x, pg.y, pg.r + 3, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* ---- 大弹柱 ---- */
    for (i = 0; i < b.bumpers.length; i++) {
      var bp = b.bumpers[i];
      var r = bp.r + bp.pulse * 5;
      if (ARC) {
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
      } else {
        ctx.beginPath();
        ctx.arc(bp.x + 1.5, bp.y + 2.5, r, 0, U.TAU);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, r, 0, U.TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = C.bumperRing;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, r * 0.55, 0, U.TAU);
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    /* ---- 亮灯洞(动态辉光精灵) ---- */
    var holeRx = b.pw * 0.5 - 6;
    for (i = 0; i < b.holes.length; i++) {
      var hk = b.holes[i];
      if (hk.lit) {
        var pulse2 = 0.5 + 0.5 * Math.sin(t * 3.4 + i);
        ui.drawGlow(ctx, hk.cx, b.floorY - 26, holeRx + 14 + pulse2 * 6, 26 + pulse2 * 5, C.holeLit, 0.7 + pulse2 * 0.25, p);
        ctx.beginPath();
        ctx.ellipse(hk.cx, b.floorY - 26, holeRx, 14, 0, 0, U.TAU);
        ctx.fillStyle = C.holeLit;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hk.cx, b.floorY - 26, holeRx * 0.45, 5.5, 0, 0, U.TAU);
        ctx.fillStyle = '#ffd9c9';
        ctx.fill();
      }
      if (hk.flash > 0) {
        ctx.globalAlpha = hk.flash * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(hk.cx, b.floorY - 26, holeRx, 14, 0, 0, U.TAU);
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
      ui.drawMarble(ctx, m.x, m.y, m.r, tintC, this);
    }

    /* ---- 特效(仅在有活跃粒子/飘字时执行圆角裁剪绘制) ---- */
    if (MG.fx.hasActive(this.fx)) {
      ctx.save();
      ui.rr(ctx, 2, 2, W - 4, H - 4, 34);
      ctx.clip();
      MG.fx.render(ctx, this.fx);
      ctx.restore();
    }

    /* ---- 操作台动态:档位按钮 / GO / 力度条 / 托盘 ---- */
    var cw = 70, ch = 64, gap2 = 5;
    var cx0 = 536 - (CFG.tiers.length * (cw + gap2) - gap2) / 2;
    for (i = 0; i < CFG.tiers.length; i++) {
      var tp = CFG.tiers[i];
      var cx = cx0 + i * (cw + gap2);
      var cy = H - b.panelH + 62;
      var disabled = tp.cost > this.bank;
      var selected = !disabled && (i === this.selIdx);
      ui.rr(ctx, cx, cy, cw, ch, 14);
      if (selected) {
        ctx.fillStyle = C.selBg;
        ctx.fill();
      } else if (disabled) {
        ctx.fillStyle = C.pillDis;
        ctx.fill();
      } else {
        ctx.fillStyle = C.pillBg;
        ctx.fill();
      }
      ctx.strokeStyle = selected ? C.selBg : C.pillLine;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.font(ctx, 17, false);
      ctx.fillStyle = selected ? C.selSub : (disabled ? C.pillDisText : C.dim);
      ctx.fillText(tp.cost + '颗', cx + cw / 2, cy + 18);
      ui.font(ctx, 26);
      ctx.fillStyle = selected ? '#ffffff' : (disabled ? C.pillDisText : C.pillText);
      ctx.fillText('×' + tp.mult, cx + cw / 2, cy + 44);
      if (isPlay && !disabled) {
        this.frameButtons.push({ x: cx, y: cy, w: cw, h: ch, cb: this._tierCbs[i] });
      }
    }

    var power = this.charging ? this.chargePower() : 0;
    var pc = power < 0.4 ? C.pow1 : (power < 0.8 ? C.pow2 : C.pow3);

    if (power > 0.01) {
      var bar = this._bar;
      var fh = (bar.h - 8) * power;
      ui.rr(ctx, bar.x + 4, bar.y + bar.h - 4 - fh, bar.w - 8, fh, 7);
      ctx.fillStyle = pc;
      ctx.fill();
    }

    var go = this._go;
    var pressed = this.charging;
    ctx.beginPath();
    ctx.arc(go.x, go.y, pressed ? go.r - 3 : go.r, 0, U.TAU);
    if (ARC) {
      var gg = ctx.createRadialGradient(go.x - 12, go.y - 14, 6, go.x, go.y, go.r);
      gg.addColorStop(0, pressed ? '#ff8f7a' : '#ff6a52');
      gg.addColorStop(1, pressed ? C.goPress : C.goBg);
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.strokeStyle = C.goRing;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = pressed ? C.goPress : C.goBg;
      ctx.fill();
    }
    ui.font(ctx, 30);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GO', go.x, go.y + 1);

    if (this.charging) {
      ctx.beginPath();
      ctx.arc(go.x, go.y, go.r + 10, -Math.PI / 2, -Math.PI / 2 + power * U.TAU * 0.83);
      ctx.strokeStyle = pc;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    if (this.launcherPulse > 0) {
      ctx.beginPath();
      ctx.arc(go.x, go.y, go.r + 10 + this.launcherPulse * 14, 0, U.TAU);
      ctx.strokeStyle = C.pulseRing + (0.45 * this.launcherPulse) + ')';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    /* 弹珠库托盘点位(走离屏弹珠精灵缓存) */
    var n2 = Math.min(this.bank, 6);
    for (i = 0; i < n2; i++) {
      var tx = 50 + (i % 3) * 34;
      var ty = H - b.panelH + 86 + Math.floor(i / 3) * 36;
      ui.drawMarble(ctx, tx, ty, 12, tints[i % tints.length], this);
    }
    if (this.bank > 6) {
      ui.font(ctx, 22);
      ctx.textAlign = 'left';
      ctx.fillStyle = C.panelText;
      ctx.fillText('×' + this.bank, 50, H - b.panelH + 168);
    }
  };

  /* 红色 LED 数码管(按内容脏标记缓存到小离屏条,保留发光质感且零逐帧重算) */
  Game.prototype.drawSeg = function (slotKey, rect, text) {
    var ctx = this.ctx;
    var p = this.platform;
    var s = this.view.scale * p.dpr;
    var entry = this._segSprites[slotKey];
    var sig = text + '|' + this.theme + '|' + Math.round(s * 100);
    if ((!entry || entry.sig !== sig) && p.createOffscreen) {
      try {
        var pw = Math.max(8, Math.ceil(rect.w * s));
        var ph = Math.max(8, Math.ceil(rect.h * s));
        var cvs = entry ? entry.cvs : p.createOffscreen(pw, ph);
        if (cvs.width !== pw || cvs.height !== ph) { cvs.width = pw; cvs.height = ph; }
        var sctx = cvs.getContext('2d');
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.clearRect(0, 0, pw, ph);
        sctx.setTransform(s, 0, 0, s, 0, 0);
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        MG.ui.segFont(sctx, rect.w > 180 ? 52 : 46);
        sctx.shadowColor = C.segRed;
        sctx.shadowBlur = 16;
        sctx.fillStyle = C.segRed;
        sctx.fillText(text, rect.w / 2, rect.h * 0.62);
        entry = { cvs: cvs, sig: sig, w: pw / s, h: ph / s };
        this._segSprites[slotKey] = entry;
      } catch (e) { entry = null; }
    }
    if (entry) {
      ctx.drawImage(entry.cvs, rect.x, rect.y, entry.w, entry.h);
      return;
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h * 0.62);
    MG.ui.segFont(ctx, rect.w > 180 ? 52 : 46);
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
    var g = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : null);
    var cvs = this.platform.canvas;
    var raf = null;
    if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame;
    else if (cvs && typeof cvs.requestAnimationFrame === 'function') raf = function (cb) { cvs.requestAnimationFrame(cb); };
    else if (g && typeof g.requestAnimationFrame === 'function') raf = function (cb) { g.requestAnimationFrame(cb); };
    var nowSec = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? function () { return performance.now() / 1000; }
      : function () { return Date.now() / 1000; };
    function loop() {
      if (raf) raf(loop);
      var t = nowSec();
      if (!self._last) self._last = t;
      var dt = Math.max(0, Math.min(0.05, t - self._last));
      self._last = t;
      try {
        self.frame(dt);
      } catch (e) {
        var msg = String((e && e.stack) || e);
        if (!self.errors) self.errors = [];
        if (self.errors.indexOf(msg) < 0 && self.errors.length < 20) self.errors.push(msg);
        try { console.error('[MG frame]', e); } catch (e2) { }
      }
    }
    if (raf) raf(loop);
    else setInterval(loop, 16);
  };

  MG.Game = Game;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
