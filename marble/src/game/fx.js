/* 弹弹珠机 - 粒子与特效 (命名空间: MG.fx) */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});
  var U = MG.util;

  var MAX_PARTS = 500;

  function create() {
    return { parts: [], rings: [], texts: [], drops: [], shake: 0, sx: 0, sy: 0 };
  }

  /* 弹珠落入洞口/滚回的缩球动画 */
  function drop(fx, x, y, r, color) {
    if (fx.drops.length > 16) fx.drops.shift();
    fx.drops.push({ x: x, y: y, r: r, color: color, age: 0, life: 0.22 });
  }

  function burst(fx, x, y, color, n, spd) {
    spd = spd || 260;
    for (var i = 0; i < n; i++) {
      if (fx.parts.length >= MAX_PARTS) fx.parts.shift();
      var a = U.rand(0, U.TAU);
      var v = U.rand(0.3, 1) * spd;
      fx.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: U.rand(0.3, 0.7), age: 0,
        size: U.rand(2.5, 5.5), color: color, grav: 900
      });
    }
  }

  function ring(fx, x, y, color, r1, life, w) {
    fx.rings.push({ x: x, y: y, r0: 6, r1: r1 || 60, age: 0, life: life || 0.35, color: color, w: w || 3 });
  }

  function text(fx, x, y, str, opts) {
    opts = opts || {};
    if (fx.texts.length > 24) fx.texts.shift();
    fx.texts.push({
      x: x, y: y, str: str,
      age: 0, life: opts.life || 0.9,
      size: opts.size || 26, color: opts.color || '#ffffff',
      vy: opts.vy != null ? opts.vy : -70
    });
  }

  function shake(fx, p) { fx.shake = Math.min(14, Math.max(fx.shake, p)); }

  function update(fx, dt) {
    var i;
    for (i = fx.parts.length - 1; i >= 0; i--) {
      var p = fx.parts[i];
      p.age += dt;
      if (p.age >= p.life) { fx.parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (i = fx.rings.length - 1; i >= 0; i--) {
      var r = fx.rings[i];
      r.age += dt;
      if (r.age >= r.life) fx.rings.splice(i, 1);
    }
    for (i = fx.texts.length - 1; i >= 0; i--) {
      var t = fx.texts[i];
      t.age += dt;
      if (t.age >= t.life) { fx.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= (1 - 1.6 * dt);
    }
    for (i = fx.drops.length - 1; i >= 0; i--) {
      var dr = fx.drops[i];
      dr.age += dt;
      dr.y += 46 * dt;
      if (dr.age >= dr.life) fx.drops.splice(i, 1);
    }
    if (fx.shake > 0) {
      fx.shake = Math.max(0, fx.shake - dt * 22);
      fx.sx = U.rand(-1, 1) * fx.shake;
      fx.sy = U.rand(-1, 1) * fx.shake;
    } else { fx.sx = 0; fx.sy = 0; }
  }

  function render(ctx, fx) {
    var i;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < fx.parts.length; i++) {
      var p = fx.parts[i];
      var a = 1 - p.age / p.life;
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, U.TAU);
      ctx.fill();
    }
    for (i = 0; i < fx.rings.length; i++) {
      var r = fx.rings[i];
      var k = r.age / r.life;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * U.easeOut(k), 0, U.TAU);
      ctx.stroke();
    }
    for (i = 0; i < fx.drops.length; i++) {
      var dp = fx.drops[i];
      var dk = dp.age / dp.life;
      ctx.globalAlpha = 1 - dk;
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, dp.r * (1 - dk * 0.8), 0, U.TAU);
      ctx.fillStyle = dp.color;
      ctx.fill();
      ctx.globalAlpha = (1 - dk) * 0.6;
      ctx.strokeStyle = 'rgba(90,55,15,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (i = 0; i < fx.texts.length; i++) {
      var t = fx.texts[i];
      var k2 = t.age / t.life;
      var pop = t.age < 0.12 ? U.easeOut(t.age / 0.12) * 0.35 + 0.65 : 1;
      ctx.globalAlpha = k2 > 0.6 ? 1 - (k2 - 0.6) / 0.4 : 1;
      ctx.font = 'bold ' + Math.round(t.size * pop) + 'px sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 4;
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }

  function reset(fx) {
    fx.parts.length = 0;
    fx.rings.length = 0;
    fx.texts.length = 0;
    fx.shake = 0;
  }

  MG.fx = { create: create, burst: burst, ring: ring, text: text, drop: drop, shake: shake, update: update, render: render, reset: reset };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
