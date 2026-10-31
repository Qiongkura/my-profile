/* 弹弹珠机 - 背景音乐:原曲播放器 (命名空间: MG.music)
 * 播放 assets/bgm/ 下的原曲音频文件(用户自行放置,见 assets/bgm/README.txt)。
 * 网页端:每首歌一个 <audio> 且首次解锁时全部预加载 → 切歌即时出声。
 * 小游戏端:InnerAudioContext 复用单个实例,换 src 即切。
 * 缺文件自动跳到同曲下一个格式,再不行切下一首;点击音符图标切歌。
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});

  /* 播放文件链:依次尝试(想换曲目/放原曲,编辑对应数组即可) */
  var SONGS = [
    { name: '甩葱歌(MMD)', files: ['assets/bgm/01-ievan.m4a', 'assets/bgm/01-ievan.ogg', 'assets/bgm/01-ievan.wav'] },
    { name: '最炫民族风', files: ['assets/bgm/06-zuixuan.m4a'] },
    { name: '小苹果', files: ['assets/bgm/07-pingguo.m4a'] },
    { name: '卡农', files: ['assets/bgm/02-canon.m4a', 'assets/bgm/02-canon.wav'] },
    { name: '欢乐颂', files: ['assets/bgm/03-ode.m4a', 'assets/bgm/03-ode.wav'] },
    { name: '康康舞曲', files: ['assets/bgm/04-cancan.m4a', 'assets/bgm/04-cancan.wav'] },
    { name: '小星星', files: ['assets/bgm/05-twinkle.wav'] }
  ];

  var platform = null;
  var idx = 0;
  var cache = [];       /* 网页端:每首歌一个 <audio>,预加载 */
  var innerEl = null;   /* 小游戏端 InnerAudio */
  var wantPlay = false;
  var started = false;
  var muted = false;
  var vol = 0.8;
  var OUT_VOL = 0.32;

  function init(pl) {
    platform = pl;
    idx = (pl.storage.get('mm_song', 0) | 0) % SONGS.length;
    wantPlay = true;   /* 默认开启背景音乐(静音/切歌可控) */
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

  /* ---- 网页端:每首歌缓存一个 audio,加载期就完成文件回退 ---- */

  function webEl(i) {
    if (i in cache) return cache[i];
    var a = null;
    try {
      a = new root.Audio();
      a.loop = true;
      a.preload = 'auto';
      a.volume = vol * OUT_VOL;
      var st = { fi: 0 };
      a._st = st;
      a.onerror = function () {
        st.fi++;
        if (st.fi < SONGS[i].files.length) {
          a.src = SONGS[i].files[st.fi];
          a.load();
        }
      };
      a.src = SONGS[i].files[0];
      a.load();
    } catch (e) { a = null; }
    cache[i] = a;
    return a;
  }

  /* 播第 i 首:文件链在预加载时已解析好,直接出声 */
  function webPlay(i) {
    var a = webEl(i);
    if (!a) return;
    var st = a._st;
    if (!st || st.fi >= SONGS[i].files.length) return; /* 该曲没有可用文件 */
    var p = a.play();
    if (p && p.catch) p.catch(function () { /* 自动播放被拦:等首次手势 */ });
  }

  function webPauseAll() {
    for (var i = 0; i < cache.length; i++) {
      try { if (cache[i]) cache[i].pause(); } catch (e) { }
    }
  }

  /* ---- 小游戏端 ---- */

  function innerStop() {
    try { if (innerEl) { innerEl.stop(); } } catch (e) { }
  }

  function innerPlay() {
    if (!innerEl && platform.createInnerAudio) innerEl = platform.createInnerAudio();
    if (!innerEl) return;
    innerEl.loop = true;
    innerEl.volume = vol * OUT_VOL;
    innerStop();
    innerEl.src = SONGS[idx].files[0];
    try { innerEl.play(); } catch (e) { }
  }

  function play() {
    wantPlay = true;
    if (muted) return;
    if (platform.isMinigame) innerPlay();
    else { webPauseAll(); webPlay(idx); }
  }

  function pause() {
    wantPlay = false;
    webPauseAll();
    innerStop();
  }

  /* 首次用户手势后调用:浏览器允许出声了;顺带预加载全部曲目 */
  function unlock() {
    if (started) return;
    started = true;
    if (!platform.isMinigame) {
      for (var i = 0; i < SONGS.length; i++) webEl(i);
    }
    if (wantPlay && !muted) play();
  }

  function setMuted(m) {
    muted = !!m;
    if (muted) {
      /* 停声但保留 wantPlay:取消静音后音乐能接续回来 */
      webPauseAll();
      innerStop();
    } else if (wantPlay && started) {
      play();
    }
  }

  function setVolume(v) {
    vol = Math.max(0, Math.min(1, v));
    for (var i = 0; i < cache.length; i++) {
      try { if (cache[i]) cache[i].volume = vol * OUT_VOL; } catch (e) { }
    }
    try { if (innerEl) innerEl.volume = vol * OUT_VOL; } catch (e) { }
  }

  MG.music = {
    init: init,
    setVolume: setVolume,
    _debug: function () {
      var a = cache[idx];
      return {
        idx: idx, started: started, wantPlay: wantPlay, muted: muted, cached: cache.length,
        el: a ? { src: (a.src || '').split('/').pop(), paused: a.paused, volume: a.volume } : null
      };
    },
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
