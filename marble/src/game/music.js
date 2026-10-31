/* 弹弹珠机 - 背景音乐:原曲播放器 (命名空间: MG.music)
 * 播放 assets/bgm/ 下的原曲音频文件(用户自行放置,见 assets/bgm/README.txt)。
 * 网页端用 <audio>,小游戏端用 InnerAudioContext;缺文件自动跳过不报错。
 * 点击左上角音符图标切歌;音效按钮静音时一并暂停。
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});

  var SONGS = [
    { name: '甩葱歌', file: 'assets/bgm/01-ievan.mp3' },
    { name: '卡农', file: 'assets/bgm/02-canon.mp3' },
    { name: '欢乐颂', file: 'assets/bgm/03-ode.mp3' },
    { name: '康康舞曲', file: 'assets/bgm/04-cancan.mp3' },
    { name: '小星星', file: 'assets/bgm/05-twinkle.mp3' }
  ];

  var platform = null;
  var idx = 0;
  var el = null;        /* 网页端 <audio> */
  var innerEl = null;   /* 小游戏端 InnerAudio */
  var wantPlay = false;
  var started = false;
  var muted = false;

  function init(pl) {
    platform = pl;
    idx = (pl.storage.get('mm_song', 0) | 0) % SONGS.length;
  }

  function song() { return SONGS[idx]; }
  function songCount() { return SONGS.length; }
  function current() { return idx; }

  function setSong(i) {
    idx = ((i % SONGS.length) + SONGS.length) % SONGS.length;
    if (wantPlay && started && !muted) play();
    return SONGS[idx].name;
  }

  function next() { return setSong(idx + 1); }

  function ensureWebEl() {
    if (el) return el;
    try {
      el = new root.Audio();
      el.loop = true;
      el.volume = 0.28;
    } catch (e) { el = null; }
    return el;
  }

  function ensureInner() {
    if (innerEl) return innerEl;
    if (platform.createInnerAudio) innerEl = platform.createInnerAudio();
    if (innerEl) {
      innerEl.loop = true;
      innerEl.volume = 0.3;
    }
    return innerEl;
  }

  function play() {
    wantPlay = true;
    if (muted) return;
    var s = SONGS[idx];
    if (platform.isMinigame) {
      var inel = ensureInner();
      if (!inel) return;
      try {
        inel.stop();
        inel.src = s.file;
        inel.play();
      } catch (e) { }
      return;
    }
    var a = ensureWebEl();
    if (!a) return;
    try {
      a.src = s.file;
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () { /* 自动播放被拦:等首次手势 */ });
    } catch (e) { }
  }

  function pause() {
    wantPlay = false;
    try { if (el) el.pause(); } catch (e) { }
    try { if (innerEl) innerEl.pause(); } catch (e) { }
  }

  /* 首次用户手势后调用:浏览器允许出声了 */
  function unlock() {
    if (started) return;
    started = true;
    if (wantPlay && !muted) play();
  }

  function setMuted(m) {
    muted = !!m;
    if (muted) pause();
    else if (wantPlay && started) play();
  }

  MG.music = {
    init: init,
    song: song,
    songCount: songCount,
    current: current,
    setSong: setSong,
    next: next,
    play: play,
    pause: pause,
    unlock: unlock,
    setMuted: setMuted
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
