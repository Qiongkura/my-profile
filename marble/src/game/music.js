/* 弹弹弹珠吧 - 背景音乐:原曲播放器 (命名空间: MG.music)
 * 网页端:首次用户手势解锁后只加载当前曲目,其余切歌时按需加载(省流量)。
 * 小游戏端:优先加载当前曲目所在 BGM 分包并即刻出声,另一分包后台静默预载。
 */
(function (root) {
  'use strict';
  var MG = root.MG || (root.MG = {});

  /* 播放文件链:依次尝试(线上仅分发压缩后的 m4a/ogg,不含冗余 wav) */
  var SONGS = [
    { name: '甩葱歌(MMD)', files: ['assets/bgm/01-ievan.m4a', 'assets/bgm/01-ievan.ogg'] },
    { name: '最炫民族风', files: ['assets/bgm/06-zuixuan.m4a'] },
    { name: '小苹果', files: ['assets/bgm/07-pingguo.m4a'] },
    { name: '卡农', files: ['assets/bgm/02-canon.m4a'] },
    { name: '欢乐颂', files: ['assets/bgm/03-ode.m4a'] },
    { name: '康康舞曲', files: ['assets/bgm/04-cancan.m4a'] },
    { name: '小星星', files: ['assets/bgm/05-twinkle.m4a'] }
  ];

  var platform = null;
  var idx = 0;
  var cache = [];       /* 网页端:每首歌一个 <audio>,按需缓存 */
  var innerEl = null;   /* 小游戏端 InnerAudio */
  var pkgState = {};    /* 小游戏端分包状态: undefined=未加载, 1=加载中, 2=就绪 */
  var pkgWaiters = {};
  var wantPlay = false;
  var started = false;
  var muted = false;
  var vol = 0.8;
  var OUT_VOL = 0.32;
  var failSkipCount = 0;

  function init(pl) {
    platform = pl;
    idx = ((pl.storage.get('mm_song', 0) | 0) % SONGS.length + SONGS.length) % SONGS.length;
    wantPlay = true;   /* 默认开启背景音乐(静音/切歌可控) */
  }

  function song() { return SONGS[idx]; }
  function songCount() { return SONGS.length; }
  function current() { return idx; }

  function setSong(i) {
    idx = ((i % SONGS.length) + SONGS.length) % SONGS.length;
    failSkipCount = 0;
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
        } else if (i === idx && wantPlay && started && !muted && failSkipCount < SONGS.length - 1) {
          /* 当前曲目全部格式不可用时自动跳下一首,最多尝试一轮防死循环 */
          failSkipCount++;
          idx = (idx + 1) % SONGS.length;
          play();
        }
      };
      a.src = SONGS[i].files[0];
      a.load();
    } catch (e) { a = null; }
    cache[i] = a;
    return a;
  }

  function webPlay(i) {
    var a = webEl(i);
    if (!a) return;
    var st = a._st;
    if (!st || st.fi >= SONGS[i].files.length) return;
    var p = a.play();
    if (p && p.catch) p.catch(function () { /* 自动播放被拦:等首次手势 */ });
  }

  function webPauseAll() {
    for (var i = 0; i < cache.length; i++) {
      try { if (cache[i]) cache[i].pause(); } catch (e) { }
    }
  }

  /* ---- 小游戏端:按需分包加载 ---- */

  function songSubpkg(i) {
    var src = SONGS[i] && SONGS[i].files[0];
    if (!src) return null;
    var slash = src.indexOf('/');
    if (slash > 0 && src.indexOf('bgm') === 0) return src.slice(0, slash);
    return null;
  }

  function ensurePkg(pkg, cb) {
    if (!pkg || !platform || !platform.loadSubpackage || pkgState[pkg] === 2) {
      if (cb) cb(true);
      return;
    }
    if (!pkgWaiters[pkg]) pkgWaiters[pkg] = [];
    if (cb) pkgWaiters[pkg].push(cb);
    if (pkgState[pkg] === 1) return;
    pkgState[pkg] = 1;
    platform.loadSubpackage(pkg, function (ok) {
      pkgState[pkg] = ok === false ? 0 : 2;
      var list = pkgWaiters[pkg] || [];
      pkgWaiters[pkg] = [];
      for (var k = 0; k < list.length; k++) list[k](ok !== false);
    });
  }

  function innerStop() {
    try { if (innerEl) { innerEl.stop(); } } catch (e) { }
  }

  function innerPlay() {
    var targetIdx = idx;
    var pkg = songSubpkg(targetIdx);
    ensurePkg(pkg, function (ok) {
      if (!ok || targetIdx !== idx || !wantPlay || muted) return;
      if (!innerEl && platform.createInnerAudio) innerEl = platform.createInnerAudio();
      if (!innerEl) return;
      innerEl.loop = true;
      innerEl.volume = vol * OUT_VOL;
      innerStop();
      innerEl.src = SONGS[targetIdx].files[0];
      try { innerEl.play(); } catch (e) { }
    });
  }

  function play() {
    wantPlay = true;
    if (!started || muted) return;
    if (platform.isMinigame) innerPlay();
    else { webPauseAll(); webPlay(idx); }
  }

  function pause() {
    wantPlay = false;
    webPauseAll();
    innerStop();
  }

  /* 首次用户手势后调用:先加载当前曲目所在分包即刻出声,再静默预载另一分包 */
  function unlock() {
    if (started) return;
    started = true;
    if (platform.isMinigame) {
      var curPkg = songSubpkg(idx);
      ensurePkg(curPkg, function () {
        if (wantPlay && !muted) innerPlay();
        var other = curPkg === 'bgm1' ? 'bgm2' : (curPkg === 'bgm2' ? 'bgm1' : null);
        if (other) ensurePkg(other);
      });
      return;
    }
    webEl(idx);
    if (wantPlay && !muted) play();
  }

  function setMuted(m) {
    muted = !!m;
    if (muted) {
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
