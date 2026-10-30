/* 弹弹珠机 - 音频模块 (命名空间: MG.audio)
 * 浏览器端: WebAudio 实时合成(无需任何音频文件)
 * 小游戏端: 播放 assets/sounds/*.wav (由 tools/gen-audio.js 生成)
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});

  var _platform = null;
  var _muted = false;
  var _actx = null;
  var _master = null;

  function init(platform) {
    _platform = platform;
  }

  function ensureCtx() {
    if (_muted) return null;
    if (!_actx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        _actx = new AC();
        _master = _actx.createGain();
        _master.gain.value = 0.5;
        _master.connect(_actx.destination);
      } catch (e) { return null; }
    }
    if (_actx.state === 'suspended') { try { _actx.resume(); } catch (e) { } }
    return _actx;
  }

  /* 首次用户手势时调用,解锁 iOS/安卓 WebAudio */
  function unlock() { ensureCtx(); }

  function tone(o) {
    var a = ensureCtx();
    if (!a) return;
    try {
      var t0 = a.currentTime + (o.delay || 0);
      var osc = a.createOscillator();
      var g = a.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(Math.max(1, o.f), t0);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + o.dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, o.vol || 0.3), t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g); g.connect(_master);
      osc.start(t0); osc.stop(t0 + o.dur + 0.03);
    } catch (e) { /* ignore */ }
  }

  /* 合成音色表(仅浏览器端使用) */
  function synth(name, o) {
    o = o || {};
    var p = o.pitch || 1;
    switch (name) {
      case 'peg':
        tone({ f: 640 * p, f2: 1100 * p, dur: 0.07, type: 'triangle', vol: 0.22 });
        break;
      case 'bumper':
        tone({ f: 300, f2: 620, dur: 0.13, type: 'square', vol: 0.14 });
        tone({ f: 160, f2: 90, dur: 0.12, type: 'sine', vol: 0.3 });
        break;
      case 'mover':
        tone({ f: 240, f2: 420, dur: 0.1, type: 'triangle', vol: 0.2 });
        break;
      case 'star':
        tone({ f: 880, dur: 0.09, type: 'triangle', vol: 0.25 });
        tone({ f: 1320, dur: 0.12, type: 'triangle', vol: 0.22, delay: 0.07 });
        break;
      case 'slot':
        tone({ f: 520, f2: 260, dur: 0.2, type: 'sine', vol: 0.35 });
        tone({ f: 660, dur: 0.14, type: 'triangle', vol: 0.18, delay: 0.06 });
        break;
      case 'jackpot':
        (function () {
          var notes = [523, 659, 784, 1046, 1318];
          for (var i = 0; i < notes.length; i++) {
            tone({ f: notes[i], dur: 0.12, type: 'triangle', vol: 0.26, delay: i * 0.085 });
          }
          tone({ f: 1568, dur: 0.3, type: 'sine', vol: 0.2, delay: 0.45 });
        })();
        break;
      case 'launch':
        tone({ f: 320, f2: 90, dur: 0.18, type: 'sawtooth', vol: 0.18 });
        tone({ f: 900, f2: 1400, dur: 0.08, type: 'sine', vol: 0.12 });
        break;
      case 'click':
        tone({ f: 660, f2: 500, dur: 0.05, type: 'square', vol: 0.16 });
        break;
      case 'over':
        tone({ f: 392, dur: 0.2, type: 'sine', vol: 0.3 });
        tone({ f: 311, dur: 0.2, type: 'sine', vol: 0.3, delay: 0.17 });
        tone({ f: 262, dur: 0.34, type: 'sine', vol: 0.3, delay: 0.34 });
        break;
      case 'record':
        (function () {
          var notes = [523, 659, 784, 1046];
          for (var i = 0; i < notes.length; i++) {
            tone({ f: notes[i], dur: 0.1, type: 'square', vol: 0.15, delay: i * 0.07 });
          }
        })();
        break;
      case 'bonus':
        tone({ f: 700, f2: 1200, dur: 0.16, type: 'triangle', vol: 0.25 });
        tone({ f: 1000, f2: 1600, dur: 0.18, type: 'triangle', vol: 0.2, delay: 0.1 });
        break;
    }
  }

  function play(name, o) {
    if (_muted) return;
    if (_platform && _platform.isMinigame) {
      _platform.playSound(name, (o && o.vol) || 1);
    } else {
      synth(name, o);
    }
  }

  function setMuted(m) { _muted = !!m; }
  function toggleMuted() { _muted = !_muted; return _muted; }
  function isMuted() { return _muted; }

  MG.audio = {
    init: init,
    unlock: unlock,
    play: play,
    setMuted: setMuted,
    toggleMuted: toggleMuted,
    isMuted: isMuted
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
