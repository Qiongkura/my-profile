/* 弹弹珠机 - 平台适配层 (命名空间: MG.platform)
 * 一套代码适配三端:
 *   browser : 任意现代浏览器(开发/调试用)
 *   wechat  : 微信小游戏 (wx)
 *   douyin  : 抖音小游戏 (tt)
 * 对上层暴露统一 API:canvas / 尺寸 / 触摸 / 存储 / 震动 / 音效播放 / 离屏画布。
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});

  function detect() {
    if (typeof tt !== 'undefined' && tt.getSystemInfoSync) return 'douyin';
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) return 'wechat';
    return 'browser';
  }

  function metrics() {
    try {
      if (typeof tt !== 'undefined' && tt.getSystemInfoSync) {
        var t = tt.getSystemInfoSync();
        return { w: t.windowWidth || 375, h: t.windowHeight || 667, dpr: Math.min(t.pixelRatio || 2, 2) };
      }
      if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
        var s = wx.getSystemInfoSync();
        return { w: s.windowWidth || 375, h: s.windowHeight || 667, dpr: Math.min(s.pixelRatio || 2, 2) };
      }
    } catch (e) { /* fallback */ }
    var w = (typeof window !== 'undefined' && window.innerWidth) || 375;
    var h = (typeof window !== 'undefined' && window.innerHeight) || 667;
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    return { w: w, h: h, dpr: Math.min(dpr, 2) };
  }

  function create() {
    var name = detect();
    var isMinigame = name !== 'browser';
    var g = isMinigame ? root : (typeof window !== 'undefined' ? window : root);
    var sys = name === 'wechat' ? wx : (name === 'douyin' ? tt : null);
    var api = {
      name: name,
      isMinigame: isMinigame,
      canvas: null,
      cssW: 375, cssH: 667, dpr: 2,
      _resizeCbs: [],
      _audioPool: {}
    };

    /* ---------- 画布与尺寸 ---------- */
    if (isMinigame) {
      api.canvas = sys.createCanvas(); // 第一次调用 = 屏幕画布
    } else {
      api.canvas = document.getElementById('game');
    }

    function applySize() {
      var m = metrics();
      api.cssW = m.w; api.cssH = m.h; api.dpr = m.dpr;
      api.canvas.width = Math.round(m.w * m.dpr);
      api.canvas.height = Math.round(m.h * m.dpr);
      if (!isMinigame) {
        api.canvas.style.width = m.w + 'px';
        api.canvas.style.height = m.h + 'px';
      }
      for (var i = 0; i < api._resizeCbs.length; i++) api._resizeCbs[i](api);
    }
    api.applySize = applySize;
    api.onResize = function (cb) { api._resizeCbs.push(cb); };

    /* ---------- 触摸输入(统一为 CSS 像素坐标) ---------- */
    function normTouch(e) {
      var t = (e.touches && e.touches.length ? e.touches[0] : (e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : e));
      var x = t.clientX != null ? t.clientX : (t.pageX != null ? t.pageX : (t.x || 0));
      var y = t.clientY != null ? t.clientY : (t.pageY != null ? t.pageY : (t.y || 0));
      return { x: x, y: y, id: t.identifier != null ? t.identifier : 0 };
    }

    if (isMinigame) {
      sys.onTouchStart(function (e) { api._fire('down', normTouch(e)); });
      sys.onTouchMove(function (e) { api._fire('move', normTouch(e)); });
      sys.onTouchEnd(function (e) { api._fire('up', normTouch(e)); });
      sys.onTouchCancel && sys.onTouchCancel(function (e) { api._fire('up', normTouch(e)); });
    } else {
      var cvs = api.canvas;
      if (window.PointerEvent) {
        cvs.addEventListener('pointerdown', function (e) { api._fire('down', { x: e.clientX, y: e.clientY, id: e.pointerId }); e.preventDefault(); });
        cvs.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || e.isPrimary) api._fire('move', { x: e.clientX, y: e.clientY, id: e.pointerId }); });
        cvs.addEventListener('pointerup', function (e) { api._fire('up', { x: e.clientX, y: e.clientY, id: e.pointerId }); e.preventDefault(); });
        cvs.addEventListener('pointercancel', function (e) { api._fire('up', { x: e.clientX, y: e.clientY, id: e.pointerId }); });
      } else {
        cvs.addEventListener('touchstart', function (e) { api._fire('down', normTouch(e)); e.preventDefault(); }, { passive: false });
        cvs.addEventListener('touchmove', function (e) { api._fire('move', normTouch(e)); e.preventDefault(); }, { passive: false });
        cvs.addEventListener('touchend', function (e) { api._fire('up', normTouch(e)); e.preventDefault(); }, { passive: false });
        cvs.addEventListener('mousedown', function (e) { api._fire('down', { x: e.clientX, y: e.clientY, id: 0 }); });
        cvs.addEventListener('mousemove', function (e) { api._fire('move', { x: e.clientX, y: e.clientY, id: 0 }); });
        cvs.addEventListener('mouseup', function (e) { api._fire('up', { x: e.clientX, y: e.clientY, id: 0 }); });
      }
      document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    }

    api.volume = 0.8;   // 主音量(小游戏端音效缩放)

    api._handlers = { down: [], move: [], up: [] };
    api.onTouch = function (type, cb) { api._handlers[type].push(cb); };
    api._fire = function (type, pt) {
      var hs = api._handlers[type];
      for (var i = 0; i < hs.length; i++) hs[i](pt);
    };

    /* ---------- 存储 ---------- */
    api.storage = {
      get: function (key, def) {
        try {
          if (isMinigame) {
            var v = sys.getStorageSync(key);
            return (v === '' || v == null) ? def : v;
          }
          var raw = window.localStorage.getItem(key);
          return raw == null ? def : JSON.parse(raw);
        } catch (e) { return def; }
      },
      set: function (key, val) {
        try {
          if (isMinigame) sys.setStorageSync(key, val);
          else window.localStorage.setItem(key, JSON.stringify(val));
        } catch (e) { /* ignore */ }
      }
    };

    /* ---------- 震动 ---------- */
    api.vibrate = function () {
      try {
        if (name === 'wechat' && wx.vibrateShort) wx.vibrateShort({ type: 'light' });
        else if (name === 'douyin' && tt.vibrateShort) tt.vibrateShort({});
        else if (navigator && navigator.vibrate) navigator.vibrate(20);
      } catch (e) { /* ignore */ }
    };

    /* ---------- 小游戏端音效播放(浏览器端用 WebAudio 合成,不走这里) ---------- */
    api.playSound = function (name, vol) {
      vol = (vol || 1) * (api.volume || 0.8);
      if (!isMinigame) return false;
      try {
        var pool = api._audioPool;
        var au = pool[name];
        if (!au) {
          au = sys.createInnerAudioContext();
          au.src = 'assets/sounds/' + name + '.wav';
          au.obeyMuteSwitch = true;
          pool[name] = au;
        }
        try { au.stop(); } catch (e) { }
        au.volume = vol != null ? vol : 1;
        au.play();
        return true;
      } catch (e) { return false; }
    };

    /* ---------- 背景音乐(小游戏端 InnerAudio;网页端用 <audio>) ---------- */
    api.createInnerAudio = function () {
      try { return sys.createInnerAudioContext(); } catch (e) { return null; }
    };

    /* ---------- 离屏画布(背景缓存用) ---------- */
    api.createOffscreen = function (w, h) {
      var c;
      if (isMinigame) c = sys.createCanvas();
      else c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    };

    /* ---------- 分享(小游戏端) ---------- */
    api.share = function (title) {
      try {
        if (name === 'wechat' && wx.shareAppMessage) {
          wx.shareAppMessage({ title: title });
          return true;
        }
        if (name === 'douyin' && tt.shareAppMessage) {
          tt.shareAppMessage({ title: title });
          return true;
        }
      } catch (e) { /* ignore */ }
      return false;
    };

    if (isMinigame) {
      try { sys.showShareMenu && sys.showShareMenu({}); } catch (e) { }
    }

    api.setPreferredFramesPerSecond = function (fps) {
      try {
        if (isMinigame && sys.setPreferredFramesPerSecond) sys.setPreferredFramesPerSecond(fps);
      } catch (e) { }
    };

    applySize();
    if (!isMinigame && typeof window !== 'undefined') {
      window.addEventListener('resize', applySize);
    }
    return api;
  }

  MG.platform = { create: create, detect: detect };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
