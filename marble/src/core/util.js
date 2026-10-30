/* 弹弹珠机 - 通用工具 (命名空间: MG.util) */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});

  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dist(x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }

  function fmt(n) {
    n = Math.floor(n);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* 确定性随机(用于每关布局) */
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { t = clamp(t, 0, 1); return t * t * t; }

  MG.util = {
    TAU: TAU,
    clamp: clamp,
    lerp: lerp,
    rand: rand,
    randInt: randInt,
    pick: pick,
    dist: dist,
    fmt: fmt,
    mulberry32: mulberry32,
    easeOut: easeOut,
    easeIn: easeIn
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
