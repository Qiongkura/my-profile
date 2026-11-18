/* 弹弹弹珠吧 - UI 绘制与界面 (命名空间: MG.ui)
 * 界面层支持极简风与复古街机双主题;弹珠与发光光晕采用离屏精灵缓存,消除每帧渐变与高斯模糊开销。
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});
  var CFG = MG.config;
  var U = MG.util;
  var C = CFG.colors;

  /* 极简 UI 配色 */
  var INK = '#3a3a3a';
  var SUB = '#9a9a9a';
  var BODY = '#6a6a6a';
  var ACCENT = '#e8553f';
  var HAIR = 'rgba(0,0,0,0.07)';

  var _marbleCache = {};
  var _marbleCacheCount = 0;
  var _glowCache = {};

  /* 白卡片:柔和分层投影(免实时大半径 shadowBlur) */
  function card(ctx, x, y, w, h, r) {
    ctx.fillStyle = 'rgba(40,35,25,0.06)';
    rr(ctx, x - 3, y + 6, w + 6, h + 8, r + 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,35,25,0.09)';
    rr(ctx, x - 1, y + 3, w + 2, h + 3, r + 1);
    ctx.fill();
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fill();
    rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ---------- 基础绘制工具 ---------- */

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function font(ctx, size, bold) {
    ctx.font = (bold === false ? '' : 'bold ') + Math.round(size) + 'px sans-serif';
  }

  function segFont(ctx, size) {
    ctx.font = 'bold ' + Math.round(size) + 'px "Courier New", monospace';
  }

  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* 预渲染径向辉光贴图(替代移动端极慢的逐帧 ctx.shadowBlur) */
  function drawGlow(ctx, x, y, rx, ry, hexColor, alpha, platform) {
    if (alpha <= 0.01) return;
    var sp = _glowCache[hexColor];
    if (!sp && platform && platform.createOffscreen) {
      try {
        var sz = 64;
        var cvs = platform.createOffscreen(sz, sz);
        var gctx = cvs.getContext('2d');
        var g = gctx.createRadialGradient(sz / 2, sz / 2, 2, sz / 2, sz / 2, sz / 2);
        g.addColorStop(0, rgba(hexColor, 0.9));
        g.addColorStop(0.45, rgba(hexColor, 0.38));
        g.addColorStop(1, rgba(hexColor, 0));
        gctx.fillStyle = g;
        gctx.fillRect(0, 0, sz, sz);
        sp = cvs;
        _glowCache[hexColor] = sp;
      } catch (e) { sp = null; }
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    if (sp) {
      ctx.drawImage(sp, x - rx, y - ry, rx * 2, ry * 2);
    } else {
      ctx.fillStyle = hexColor;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, U.TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* 原始矢量弹珠绘制 */
  function drawMarbleRaw(ctx, x, y, r, color) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3.5, r * 0.98, r * 0.82, 0, 0, U.TAU);
    ctx.fillStyle = 'rgba(96,58,14,0.25)';
    ctx.fill();
    var g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.38, r * 0.08, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.42, rgba(color, 0.96));
    g.addColorStop(0.85, rgba(color, 0.9));
    g.addColorStop(1, 'rgba(255,255,255,0.75)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.12, y + r * 0.14, r * 0.4, 0, U.TAU);
    ctx.fillStyle = rgba(color, 0.72);
    ctx.fill();
    ctx.strokeStyle = 'rgba(112,74,26,0.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.36, y - r * 0.42, r * 0.24, 0, U.TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.3, y + r * 0.42, r * 0.1, 0, U.TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.restore();
  }

  /* 玻璃弹珠(优先走离屏精灵缓存,免每帧 createRadialGradient) */
  function drawMarble(ctx, x, y, r, color, game) {
    if (game && game.platform && game.platform.createOffscreen) {
      var s = game.view.scale * game.platform.dpr;
      var key = color + '|' + Math.round(r * 10) + '|' + Math.round(s * 100);
      var sp = _marbleCache[key];
      if (!sp) {
        try {
          if (_marbleCacheCount > 48) { _marbleCache = {}; _marbleCacheCount = 0; }
          var pad = 6;
          var lw = r * 2 + pad * 2;
          var lh = r * 2 + pad * 2;
          var pw = Math.max(8, Math.ceil(lw * s));
          var ph = Math.max(8, Math.ceil(lh * s));
          var cvs = game.platform.createOffscreen(pw, ph);
          var sctx = cvs.getContext('2d');
          sctx.setTransform(s, 0, 0, s, 0, 0);
          drawMarbleRaw(sctx, r + pad, r + pad, r, color);
          sp = { cvs: cvs, ox: r + pad, oy: r + pad, w: pw / s, h: ph / s };
          _marbleCache[key] = sp;
          _marbleCacheCount++;
        } catch (e) { sp = null; }
      }
      if (sp) {
        ctx.drawImage(sp.cvs, x - sp.ox, y - sp.oy, sp.w, sp.h);
        return;
      }
    }
    drawMarbleRaw(ctx, x, y, r, color);
  }

  /* 五角星贴纸 */
  function drawStarSticker(ctx, x, y, R, rot, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = (rot || 0) + i * Math.PI / 5 - Math.PI / 2;
      var rad = (i % 2 === 0) ? R : R * 0.45;
      var px = x + Math.cos(ang) * rad;
      var py = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = C.star;
    ctx.fill();
    ctx.restore();
  }

  /* 小狗头(致敬吉童机) */
  function drawPuppy(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = '#a4622a';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.78, y - r * 0.1, r * 0.34, r * 0.55, -0.35, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * 0.78, y - r * 0.1, r * 0.34, r * 0.55, 0.35, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
    ctx.fillStyle = '#fdf9f2';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * 0.34, y - r * 0.18, r * 0.4, r * 0.42, 0.2, 0, U.TAU);
    ctx.fillStyle = '#b9743a';
    ctx.fill();
    ctx.fillStyle = '#2b1c10';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.08, r * 0.1, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.3, y - r * 0.08, r * 0.1, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - r * 0.27, y - r * 0.12, r * 0.035, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.33, y - r * 0.12, r * 0.035, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#3a2414';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.2, r * 0.13, r * 0.09, 0, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a2414';
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.beginPath();
    ctx.arc(x - r * 0.12, y + r * 0.3, r * 0.12, 0.2, Math.PI - 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r * 0.12, y + r * 0.3, r * 0.12, 0.4, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,130,140,0.5)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.5, y + r * 0.26, r * 0.13, r * 0.08, 0, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * 0.5, y + r * 0.26, r * 0.13, r * 0.08, 0, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#e8352e';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.15, y - r * 0.92);
    ctx.lineTo(x - r * 0.5, y - r * 1.15);
    ctx.lineTo(x - r * 0.42, y - r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.15, y - r * 0.92);
    ctx.lineTo(x + r * 0.22, y - r * 1.12);
    ctx.lineTo(x + r * 0.08, y - r * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.12, y - r * 0.9, r * 0.09, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- 按钮 ---------- */

  function button(game, x, y, w, h, label, cb, opts) {
    opts = opts || {};
    var ctx = game.ctx;
    var primary = !!opts.primary;
    var arcade = CFG.themeName === 'arcade';
    if (primary) {
      if (arcade) {
        ctx.fillStyle = 'rgba(120,60,10,0.28)';
        rr(ctx, x, y + 4, w, h, h / 2);
        ctx.fill();
        var grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, '#ff7a5c');
        grad.addColorStop(1, '#e8352e');
        rr(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = grad;
        ctx.fill();
        rr(ctx, x, y, w, h, h / 2);
        ctx.strokeStyle = '#ffd0b3';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(40,35,25,0.16)';
        rr(ctx, x, y + 5, w, h, h / 2);
        ctx.fill();
        rr(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = INK;
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
    } else if (arcade) {
      rr(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = C.cream;
      ctx.fill();
      rr(ctx, x, y, w, h, h / 2);
      ctx.strokeStyle = '#e8b45a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#7a4a1f';
    } else {
      rr(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      rr(ctx, x, y, w, h, h / 2);
      ctx.strokeStyle = HAIR;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = INK;
    }
    font(ctx, opts.size || 30, opts.bold !== false);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    if (cb) game.frameButtons.push({ x: x, y: y, w: w, h: h, cb: cb });
  }

  /* 圆形小图标按钮:磨砂白圆 + 细图标 */
  function iconButton(game, cx, cy, r, kind, cb) {
    var ctx = game.ctx;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, U.TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    var ic = 'rgba(58,58,58,0.85)';
    var dim = 'rgba(58,58,58,0.32)';
    if (kind === 'pause') {
      ctx.fillStyle = ic;
      rr(ctx, cx - r * 0.35, cy - r * 0.38, r * 0.24, r * 0.76, 2);
      ctx.fill();
      rr(ctx, cx + r * 0.11, cy - r * 0.38, r * 0.24, r * 0.76, 2);
      ctx.fill();
    } else if (kind === 'music') {
      var mc = game.muted ? dim : ic;
      ctx.fillStyle = mc;
      ctx.strokeStyle = mc;
      ctx.lineWidth = Math.max(1.5, r * 0.14);
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.16, cy + r * 0.3, r * 0.22, r * 0.15, -0.25, 0, U.TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.04, cy + r * 0.26);
      ctx.lineTo(cx + r * 0.04, cy - r * 0.44);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.04, cy - r * 0.44);
      ctx.quadraticCurveTo(cx + r * 0.44, cy - r * 0.34, cx + r * 0.42, cy - r * 0.06);
      ctx.stroke();
    } else if (kind === 'sidebar') {
      ctx.strokeStyle = ic;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.32, cy - r * 0.52);
      ctx.lineTo(cx + r * 0.32, cy - r * 0.52);
      ctx.lineTo(cx + r * 0.32, cy + r * 0.55);
      ctx.lineTo(cx, cy + r * 0.22);
      ctx.lineTo(cx - r * 0.32, cy + r * 0.55);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.3);
      ctx.lineTo(cx, cy + r * 0.1);
      ctx.moveTo(cx - r * 0.18, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.18, cy - r * 0.1);
      ctx.stroke();
    } else if (kind === 'home') {
      ctx.fillStyle = ic;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.52, cy - r * 0.05);
      ctx.lineTo(cx, cy - r * 0.52);
      ctx.lineTo(cx + r * 0.52, cy - r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - r * 0.36, cy - r * 0.05, r * 0.72, r * 0.46);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(cx - r * 0.11, cy + r * 0.1, r * 0.22, r * 0.31);
    } else {
      ctx.fillStyle = game.muted ? dim : ic;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy - r * 0.16);
      ctx.lineTo(cx - r * 0.1, cy - r * 0.16);
      ctx.lineTo(cx + r * 0.18, cy - r * 0.42);
      ctx.lineTo(cx + r * 0.18, cy + r * 0.42);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.16);
      ctx.lineTo(cx - r * 0.42, cy + r * 0.16);
      ctx.closePath();
      ctx.fill();
      if (game.muted) {
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.5, cy - r * 0.5);
        ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
        ctx.stroke();
      } else {
        ctx.strokeStyle = ic;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + r * 0.3, cy, r * 0.3, -0.9, 0.9);
        ctx.stroke();
      }
    }
    if (cb) game.frameButtons.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, cb: cb });
  }

  /* ---------- 主菜单 ---------- */

  function renderMenu(game, decoOnly) {
    var ctx = game.ctx;
    var W = game.view.W, H = game.view.H;
    var t = game.time;
    var top = CFG.layout.backH, bottom = H - CFG.layout.panelH;

    ctx.fillStyle = 'rgba(30,26,20,0.55)';
    ctx.fillRect(0, top, W, bottom - top);

    /* 弹跳装饰玻璃珠 */
    var tints = C.marbleTints;
    for (var i = 0; i < 5; i++) {
      var mx = W * (0.13 + 0.18 * i);
      var my = bottom - 160 - Math.abs(Math.sin(t * 1.8 + i * 1.3)) * 110;
      ctx.save();
      ctx.globalAlpha = 0.95;
      drawMarble(ctx, mx, my, 13 + (i % 3) * 4, tints[i % tints.length], game);
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (decoOnly) return;

    var bw = 400, bh = 88, bx = W / 2 - bw / 2;
    var by0 = Math.min(top + (bottom - top) * 0.20, bottom - 556);
    by0 = Math.max(by0, top + 24);
    button(game, bx, by0, bw, bh, '开始游戏', game._onStartGame, { primary: true, size: 38 });
    button(game, bx, by0 + 116, bw, bh, '玩法说明', game._onOpenHelp, { size: 32 });
    button(game, bx, by0 + 232, bw, bh * 0.72, game.muted ? '声音:关' : '声音:开', game._onToggleMute, { size: 26 });
    button(game, bx, by0 + 232 + bh * 0.72 + 16, bw, bh * 0.62, '机台风格 · ' + game.themeLabel(), game._onToggleTheme, { size: 24, bold: false });

    ctx.textAlign = 'center';
    font(ctx, 21, false);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    var ft = '玩具球 ' + game.prizeBallsTotal + '    礼品卡 ' + game.giftCardsTotal + '    最大单次 +' + U.fmt(game.bestWin);
    ctx.fillText(ft, W / 2, bottom - 166);

    /* ---- 审核要求:健康游戏忠告 + 适龄提示(官方 CADPA 标识) ---- */
    font(ctx, 13);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText('《健康游戏忠告》', W / 2, bottom - 146);
    font(ctx, 12, false);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText('抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。', W / 2, bottom - 122);
    ctx.fillText('适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。', W / 2, bottom - 100);

    var badgeY = bottom - 52;
    /* 三级加载(带加载锁防止每帧重复发起请求):文件路径 → 内嵌 data URI → 手绘兜底 */
    if (!game.ageBadge && !game.ageBadgeLoading && !game.ageBadgeFailed) {
      game.ageBadgeLoading = true;
      try {
        var bi = game.platform.createImage();
        var failToData = function () {
          if (!MG.ageBadgeData) { game.ageBadgeLoading = false; game.ageBadgeFailed = true; return; }
          bi.onload = function () { game.ageBadgeLoading = false; game.ageBadge = bi; };
          bi.onerror = function () { game.ageBadgeLoading = false; game.ageBadgeFailed = true; };
          bi.src = MG.ageBadgeData;
        };
        bi.onload = function () { game.ageBadgeLoading = false; game.ageBadge = bi; };
        bi.onerror = failToData;
        bi.src = 'assets/logo/cadpa-8.png';
      } catch (e) {
        game.ageBadgeLoading = false;
        game.ageBadgeFailed = true;
      }
    }
    if (game.ageBadge && game.ageBadge.width > 0 && game.ageBadge.height > 0) {
      var bh2 = 64, bw2 = bh2 * (game.ageBadge.width / game.ageBadge.height);
      ctx.drawImage(game.ageBadge, W / 2 - 250, badgeY - bh2 / 2, bw2, bh2);
    } else {
      rr(ctx, W / 2 - 250, badgeY - 17, 40, 34, 8);
      ctx.fillStyle = '#2fa84f';
      ctx.fill();
      font(ctx, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('8+', W / 2 - 230, badgeY);
    }
    ctx.textAlign = 'left';
    font(ctx, 13, false);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText('适龄提示：本游戏适合8周岁以上用户使用', W / 2 - 150, badgeY);
  }

  /* ---------- 玩法说明 ---------- */

  function renderHelp(game) {
    var ctx = game.ctx;
    var W = game.view.W, H = game.view.H;
    ctx.fillStyle = 'rgba(25,22,18,0.5)';
    ctx.fillRect(0, 0, W, H);

    var lines = [
      '右下角先选投入弹珠数:1~5 颗',
      '投入越多倍率越高:×2 → ×3 → ×4 → ×5 → ×6',
      '倍率越高,底部亮灯的洞越少(×6 只亮 1 个)',
      '按住蓄力,松手把弹珠从右下角往上弹(点按只是轻弹)',
      '力度太小弹珠会滚回来,退还投入',
      '弹珠从亮灯的洞滑落 = 中奖,赢回 投入×倍率 颗',
      '每次中奖送玩具球,×6 以上再送礼品卡;弹珠库见底则结束'
    ];
    var cw = Math.min(690, W - 40);
    var ch = 90 + lines.length * 56 + 120;
    var cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
    card(ctx, cx, cy, cw, ch, 30);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    font(ctx, 36);
    ctx.fillStyle = INK;
    ctx.fillText('玩法说明', W / 2, cy + 56);

    font(ctx, 24, false);
    for (var i = 0; i < lines.length; i++) {
      ctx.fillStyle = i === 4 ? ACCENT : BODY;
      ctx.fillText(lines[i], W / 2, cy + 118 + i * 52);
    }

    var bw = 300, bh = 74;
    button(game, W / 2 - bw / 2, cy + ch - bh - 30, bw, bh, '返回', game._onCloseHelp, { primary: true, size: 30 });
  }

  /* ---------- 暂停 ---------- */

  function renderPause(game) {
    var ctx = game.ctx;
    var W = game.view.W, H = game.view.H;
    var arcade = CFG.themeName === 'arcade';
    ctx.fillStyle = arcade ? 'rgba(50,30,5,0.6)' : 'rgba(25,22,18,0.45)';
    ctx.fillRect(0, 0, W, H);

    var cw = 520, ch = 508;
    var cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
    if (arcade) {
      rr(ctx, cx, cy, cw, ch, 26);
      ctx.fillStyle = C.cream;
      ctx.fill();
      ctx.strokeStyle = '#e8b45a';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      card(ctx, cx, cy, cw, ch, 30);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    font(ctx, 36);
    ctx.fillStyle = arcade ? '#6b4409' : INK;
    ctx.fillText('已暂停', W / 2, cy + 56);

    var bw = 400, bh = 66, bx = W / 2 - bw / 2;
    button(game, bx, cy + 96, bw, bh, '继续游戏', game._onResume, { primary: true, size: 30 });
    button(game, bx, cy + 172, bw, bh, '重新开始', game._onRestart, { size: 28 });
    button(game, bx, cy + 242, bw, 48, '机台风格 · ' + game.themeLabel(), game._onToggleTheme, { size: 24, bold: false });

    /* 双声道音量滑条:音效 / 音乐 各自独立 */
    var tx = cx + 60, tw = cw - 120;
    game.sliders = [
      { key: 'sfx', x: tx, w: tw, knobY: cy + 330 },
      { key: 'music', x: tx, w: tw, knobY: cy + 398 }
    ];
    var rows = [
      { sl: game.sliders[0], label: '音效', v: game.volSfx },
      { sl: game.sliders[1], label: '音乐', v: game.volMusic }
    ];
    for (var si = 0; si < rows.length; si++) {
      var row = rows[si];
      var trackY = row.sl.knobY;
      rr(ctx, tx, trackY - 6, tw, 12, 6);
      ctx.fillStyle = arcade ? 'rgba(90,55,15,0.25)' : 'rgba(0,0,0,0.08)';
      ctx.fill();
      var fv = Math.max(0, Math.min(1, row.v != null ? row.v : 0));
      var fillW = Math.round(tw * fv);
      if (fillW > 6) {
        rr(ctx, tx, trackY - 6, fillW, 12, 6);
        ctx.fillStyle = arcade ? '#a4622a' : INK;
        ctx.fill();
      }
      if (arcade) {
        ctx.beginPath();
        ctx.arc(tx + fillW, trackY, 14, 0, U.TAU);
        ctx.fillStyle = '#fff8ea';
        ctx.fill();
        ctx.strokeStyle = '#a4622a';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(tx + fillW, trackY + 2, 14.5, 0, U.TAU);
        ctx.fillStyle = 'rgba(40,35,25,0.16)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tx + fillW, trackY, 14, 0, U.TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = HAIR;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      font(ctx, 19, false);
      ctx.fillStyle = arcade ? C.panelText : SUB;
      ctx.fillText(row.label, tx, trackY - 26);
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(fv * 100) + '%', tx + tw, trackY - 26);
    }
  }

  /* ---------- 结算 ---------- */

  function renderResult(game) {
    var ctx = game.ctx;
    var W = game.view.W, H = game.view.H;
    ctx.fillStyle = 'rgba(25,22,18,0.5)';
    ctx.fillRect(0, 0, W, H);

    var compact = H < 1400;
    var cw = 620, ch = compact ? 540 : 600;
    var cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
    card(ctx, cx, cy, cw, ch, 30);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    font(ctx, 38);
    ctx.fillStyle = INK;
    ctx.fillText('弹珠用完啦', W / 2, cy + 78);

    font(ctx, 24, false);
    ctx.fillStyle = SUB;
    ctx.fillText('发射 ' + game.launched + ' 次 · 中奖 ' + game.wins + ' 次', W / 2, cy + 142);
    font(ctx, 62);
    ctx.fillStyle = ACCENT;
    ctx.fillText('最大单次 +' + U.fmt(game.lastEarned), W / 2, cy + 208);

    font(ctx, 26, false);
    ctx.fillStyle = BODY;
    ctx.fillText('玩具球 ×' + game.prizeBalls + '    礼品卡 ×' + game.giftCards, W / 2, cy + 282);
    font(ctx, 25, false);
    ctx.fillStyle = SUB;
    ctx.fillText('最大单次纪录  +' + U.fmt(game.bestWin), W / 2, cy + 336);
    if (game.newRecord) {
      var bw2 = 110, bh2 = 40;
      rr(ctx, W / 2 + 120, cy + 336 - bh2 / 2, bw2, bh2, bh2 / 2);
      ctx.fillStyle = ACCENT;
      ctx.fill();
      font(ctx, 22, false);
      ctx.fillStyle = '#fff';
      ctx.fillText('新纪录', W / 2 + 175, cy + 336);
    }

    var bw = 420, bh = 82, bx = W / 2 - bw / 2;
    var by = cy + (compact ? 400 : 430);
    if (game.platform.isMinigame) {
      button(game, bx, by, bw, bh * 0.72, '分享给好友', game._onShare, { size: 26 });
      by += bh * 0.72 + 24;
    }
    button(game, bx, by, bw, bh, '再来一局(补20颗)', game._onRestart, { primary: true, size: 32 });
  }

  MG.ui = {
    rr: rr,
    font: font,
    segFont: segFont,
    rgba: rgba,
    drawGlow: drawGlow,
    drawMarble: drawMarble,
    drawStarSticker: drawStarSticker,
    drawPuppy: drawPuppy,
    button: button,
    iconButton: iconButton,
    renderMenu: renderMenu,
    renderHelp: renderHelp,
    renderPause: renderPause,
    renderResult: renderResult
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
