/* 构建微信小游戏 + 抖音小游戏目录(纯 Node + ffmpeg)
 * 运行: node tools/build-minigames.js
 * 产出: dist/wx/   → 微信开发者工具导入
 *       dist/douyin/ → 抖音开发者工具导入
 *
 * 要点:
 *   - 主包只含代码(<4MB 限制);全部 BGM 压成 56k 单声道放进两个分包
 *     (bgm1: 甩葱/欢乐颂/最炫/小苹果, bgm2: 卡农/康康),单分包 <4MB
 *   - music.js 里的音乐路径在构建时改写为分包路径 assets/bgm/X → bgmN/X
 *   - 解锁后先 loadSubpackage 再播放(见 music.js)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FFMPEG = process.env.FFMPEG ||
  'C:/Users/Administrator/AppData/Roaming/DeepSeek Harness Desktop/ffmpeg.exe';

/* BGM 分包编排:song 文件名(不带扩展) → 分包目录 */
const PKG1 = ['01-ievan', '03-ode', '06-zuixuan', '07-pingguo'];
const PKG2 = ['02-canon', '04-cancan', '05-twinkle'];
const pkgOf = {};

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

function dirSize(p) {
  let n = 0;
  if (!fs.existsSync(p)) return 0;
  for (const f of fs.readdirSync(p)) {
    const fp = path.join(p, f);
    n += fs.statSync(fp).isDirectory() ? dirSize(fp) : fs.statSync(fp).size;
  }
  return n;
}

/* 1. 解析 game.js 的 require 顺序(入口事实来源) */
const entrySrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const mods = [];
for (const m of entrySrc.matchAll(/require\('([^']+)'\)/g)) mods.push(m[1]);
if (!mods.length) {
  console.error('未能从根目录 game.js 解析出 require 列表');
  process.exit(1);
}

/* 2. 压缩 BGM → 56k 单声道 m4a 到临时目录,并登记分包 */
const bgmSrc = path.join(ROOT, 'assets', 'bgm');
const bgmTmp = path.join(DIST, '_bgm');
/* 保留开发者在工具里设置的 AppID:重建前快照,构建后回写 */
function readSavedAppid(plat, fallback) {
  try {
    var c = JSON.parse(fs.readFileSync(path.join(DIST, plat, 'project.config.json'), 'utf8'));
    if (c.appid && c.appid !== 'touristappid' && c.appid.indexOf('xxxx') < 0) return c.appid;
  } catch (e) { }
  return fallback;
}
var savedWxAppid = readSavedAppid('wx', 'wxb50c82e104da0f57');
var savedDyAppid = readSavedAppid('douyin', 'tt69951f28f7eace8c02');
var overwriteMode = false;
try { fs.rmSync(DIST, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); }
catch (e) {
  /* 开发者工具占用目录时改为原地覆盖(旧文件保留,新文件全部更新) */
  overwriteMode = true;
  console.log('dist 被占用 → 原地覆盖模式');
}
fs.mkdirSync(bgmTmp, { recursive: true });
var tryRm = function (p2) { try { fs.rmSync(p2, { recursive: true, force: true }); } catch (e) { } };
for (const name of PKG1.concat(PKG2)) {
  const out = path.join(bgmTmp, name + '.m4a');
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', path.join(bgmSrc, name + '.m4a'),
    '-ac', '1', '-b:a', '56k', '-c:a', 'aac', out]);
  pkgOf[name] = PKG1.indexOf(name) >= 0 ? 'bgm1' : 'bgm2';
}

/* 3. music.js 路径改写:assets/bgm/X.m4a → bgmN/X.m4a */
let musicSrc = fs.readFileSync(path.join(ROOT, 'src', 'game', 'music.js'), 'utf8');
for (const name of Object.keys(pkgOf)) {
  musicSrc = musicSrc.split('assets/bgm/' + name + '.m4a').join(pkgOf[name] + '/' + name + '.m4a');
}

/* 4. 组装单平台目录 */
function buildPlatform(plat, extraFiles) {
  const dest = path.join(DIST, plat);
  fs.mkdirSync(dest, { recursive: true });
  for (const rel of mods) {
    let code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (rel.indexOf('music.js') >= 0) code = musicSrc;   /* 换成改写过路径的版本 */
    fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
    fs.writeFileSync(path.join(dest, rel), code);
  }
  copyDir(path.join(ROOT, 'assets'), path.join(dest, 'assets'));
  tryRm(path.join(dest, 'assets', 'bgm'));   /* 音乐走分包 */
  copyDir(path.join(bgmTmp), path.join(dest, 'bgm1'));
  tryRm(path.join(dest, 'bgm1', '02-canon.m4a'));
  tryRm(path.join(dest, 'bgm1', '04-cancan.m4a'));
  copyDir(path.join(bgmTmp), path.join(dest, 'bgm2'));
  tryRm(path.join(dest, 'bgm2', '01-ievan.m4a'));
  tryRm(path.join(dest, 'bgm2', '03-ode.m4a'));
  tryRm(path.join(dest, 'bgm2', '06-zuixuan.m4a'));
  tryRm(path.join(dest, 'bgm2', '07-pingguo.m4a'));
  /* 小游戏分包根目录必须各有 game.js 入口(即使为空) */
  fs.writeFileSync(path.join(dest, 'bgm1', 'game.js'), '/* BGM 分包入口(音频资源) */\n');
  fs.writeFileSync(path.join(dest, 'bgm2', 'game.js'), '/* BGM 分包入口(音频资源) */\n');
  for (const f of Object.keys(extraFiles)) {
    fs.writeFileSync(path.join(dest, f), extraFiles[f]);
  }
  const sizes = {
    total: (dirSize(dest) / 1048576).toFixed(2),
    main: ((dirSize(dest) - dirSize(path.join(dest, 'bgm1')) - dirSize(path.join(dest, 'bgm2'))) / 1048576).toFixed(2),
    bgm1: (dirSize(path.join(dest, 'bgm1')) / 1048576).toFixed(2),
    bgm2: (dirSize(path.join(dest, 'bgm2')) / 1048576).toFixed(2)
  };
  console.log(plat + ' → ' + dest + '  总 ' + sizes.total + 'MB | 主包 ' + sizes.main + 'MB | 分包 ' + sizes.bgm1 + '/' + sizes.bgm2 + 'MB');
}

/* 5. 微信 */
buildPlatform('wx', {
  'game.js': '/* 弹弹珠机 - 微信小游戏入口 */\n' + mods.map(rel => "require('./" + rel + "');").join('\n') + '\n',
  'game.json': JSON.stringify({
    deviceOrientation: 'portrait',
    showStatusBar: false,
    subpackages: [{ name: 'bgm1', root: 'bgm1' }, { name: 'bgm2', root: 'bgm2' }]
  }, null, 2),
  'project.config.json': JSON.stringify({
    description: '弹弹珠机 - 微信小游戏',
    compileType: 'game',
    appid: savedWxAppid,
    projectname: 'marble-machine',
    libVersion: 'latest',
    setting: { es6: true, minified: false, urlCheck: false, ignoreUploadUnusedFiles: true }
  }, null, 2)
});

/* 6. 抖音 */
buildPlatform('douyin', {
  'game.js': '/* 弹弹珠机 - 抖音小游戏入口 */\n' + mods.map(rel => "require('./" + rel + "');").join('\n') + '\n',
  'game.json': JSON.stringify({
    deviceOrientation: 'portrait',
    showStatusBar: false,
    subpackages: [{ name: 'bgm1', root: 'bgm1' }, { name: 'bgm2', root: 'bgm2' }]
  }, null, 2),
  'project.config.json': JSON.stringify({
    miniprogramRoot: './',
    compileType: 'game',
    appid: savedDyAppid,
    projectName: 'marble-machine',
    setting: { es6: true, minified: false }
  }, null, 2)
});

/* 7. 清理压缩临时目录 */
fs.rmSync(bgmTmp, { recursive: true, force: true });
console.log('完成。用对应开发者工具打开 dist/wx 或 dist/douyin,填入自己的 AppID。');
