/* 软著申请材料生成器:源程序文档(60页) + 操作说明书(正文为用户本人原话)
 * 运行: node tools/gen-copyright.js
 * 产出: docs/copyright/源程序.html、docs/copyright/操作说明书.html
 *      浏览器打开 → Ctrl+P → 另存为 PDF 即可上传软著登记系统
 * 登记格式要求: 源程序前30页+后30页、每页≥50行;说明书前30页+后30页
 *
 * 注意:说明书正文必须保持用户原话(逐字保留,只做分段与排版),
 *      以配合登记声明的"未使用AI撰写文档"要求。改内容请让用户自己提供文字。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'copyright');
const NAME = '弹弹弹珠吧游戏软件';
const VER = 'V1.0';
const PER_PAGE = 50;      /* 每页源程序行数(登记要求 ≥50) */
const WRAP = 95;          /* 超长行硬折宽度 */
const FIRST_PAGES = 30, LAST_PAGES = 30;

/* ---------- 1. 按入口 require 顺序收集源文件 ---------- */
const entry = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const files = ['game.js'];
for (const m of entry.matchAll(/require\('([^']+)'\)/g)) files.push(m[1]);
if (!files.includes('src/main.js')) files.push('src/main.js');

/* ---------- 2. 清洗:去空行、超长 base64 省略、长行硬折 ---------- */
let lines = [];
let fileCount = 0;
for (const f of files) {
  const raw = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n').split('\n');
  fileCount++;
  lines.push('/* ==================================================== */');
  lines.push('/* 文件: ' + f + ' */');
  for (let ln of raw) {
    if (!ln.trim()) continue;                                  /* 登记惯例:去掉空行 */
    if (ln.length > 1000 && /base64/.test(ln)) {
      /* agebadge.js 内嵌 36 万字符的图片数据,打印版省略避免破坏排版 */
      lines.push("MG.ageBadgeData = 'data:image/png;base64,…（图片数据共 " + ln.length + " 字符，打印版省略）';");
      continue;
    }
    while (ln.length > WRAP) { lines.push(ln.slice(0, WRAP)); ln = '      ' + ln.slice(WRAP); }
    lines.push(ln);
  }
}

/* ---------- 3. 分页:不足60页全交,超过取前30页+后30页 ---------- */
const totalPages = Math.ceil(lines.length / PER_PAGE);
let pages = [];
if (totalPages <= FIRST_PAGES + LAST_PAGES) {
  for (let p = 0; p < totalPages; p++) pages.push(lines.slice(p * PER_PAGE, (p + 1) * PER_PAGE));
} else {
  for (let p = 0; p < FIRST_PAGES; p++) pages.push(lines.slice(p * PER_PAGE, (p + 1) * PER_PAGE));
  const tailStart = lines.length - LAST_PAGES * PER_PAGE;
  for (let p = 0; p < LAST_PAGES; p++) pages.push(lines.slice(tailStart + p * PER_PAGE, tailStart + (p + 1) * PER_PAGE));
}

/* ---------- 4. 输出源程序 HTML ---------- */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pageHtml = (pg, idx) => '<div class="page">' +
  '<div class="head"><span>' + NAME + VER + '</span><span>第 ' + (idx + 1) + ' 页 / 共 ' + pages.length + ' 页</span></div>' +
  pg.map(l => '<div class="line">' + (esc(l) || '&nbsp;') + '</div>').join('') +
  '<div class="foot">第 ' + (idx + 1) + ' 页 / 共 ' + pages.length + ' 页</div>' +
  '</div>';

const srcHtml = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + NAME + VER + ' 源程序</title><style>' +
  '@page { size: A4; margin: 15mm 15mm 12mm; }' +
  'body { font-family: Consolas, "Courier New", monospace; font-size: 9.2pt; line-height: 1.32; color: #111; margin: 0; }' +
  '.page { page-break-after: always; }' +
  '.head { font-size: 9pt; color: #444; border-bottom: 0.6px solid #888; padding-bottom: 1.5mm; margin-bottom: 2mm; display: flex; justify-content: space-between; }' +
  '.line { white-space: pre-wrap; word-break: break-all; }' +
  '.foot { text-align: center; font-size: 9pt; color: #444; margin-top: 2mm; }' +
  '@media screen { body { background: #666; } .page { background: #fff; width: 180mm; min-height: 267mm; margin: 8mm auto; padding: 15mm 15mm 12mm; box-shadow: 0 2px 8px rgba(0,0,0,.4); box-sizing: border-box; } }' +
  '</style></head><body>' + pages.map(pageHtml).join('') + '</body></html>';
fs.writeFileSync(path.join(OUT, '源程序.html'), srcHtml);

/* ---------- 5. 操作说明书(正文为用户原话,逐字保留) ---------- */
const shotsDir = path.join(OUT, 'shots');
const img = (f) => {
  const p = path.join(shotsDir, f + '.png');
  return fs.existsSync(p) ? 'data:image/png;base64,' + fs.readFileSync(p).toString('base64') : '';
};
const fig = (f, cap) => '<figure><img src="' + img(f) + '" alt="' + cap + '"><figcaption>' + cap + '</figcaption></figure>';

const manual = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${NAME}${VER} 操作说明书</title><style>
@page { size: A4; margin: 20mm 18mm; }
body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 11pt; line-height: 1.75; color: #222; margin: 0; }
.cover { text-align: center; padding-top: 60mm; }
.cover h1 { font-size: 26pt; margin-bottom: 6mm; letter-spacing: 2px; }
.cover .ver { font-size: 14pt; color: #555; }
.cover .meta { margin-top: 40mm; font-size: 12pt; line-height: 2.2; color: #333; }
h2 { font-size: 15pt; border-left: 4px solid #c0392b; padding-left: 8px; margin: 8mm 0 4mm; }
p { margin: 2.5mm 0; text-align: justify; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 10.5pt; }
th, td { border: 1px solid #999; padding: 2mm 3mm; text-align: left; }
th { background: #f2f2f2; }
.figs { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin: 3mm 0; }
figure { margin: 0; text-align: center; }
figure img { width: 100%; border: 1px solid #ddd; }
figcaption { font-size: 9.5pt; color: #555; margin-top: 1.5mm; }
@media print { .sheet { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; page-break-after: always; page-break-inside: avoid; } }
@media screen { body { background: #666; } .sheet { background: #fff; width: 210mm; min-height: 297mm; margin: 8mm auto; padding: 20mm 18mm; box-shadow: 0 2px 8px rgba(0,0,0,.4); box-sizing: border-box; } }
</style></head><body>

<div class="sheet cover">
  <h1>${NAME}</h1>
  <div class="ver">版本号:${VER}</div>
  <div class="meta">
    操作说明书<br>
    著作权人:袁哲宇<br>
    开发完成日期:2026 年 10 月 20 日
  </div>
</div>

<div class="sheet">
<h2>1 玩法与操作</h2>
<p>弹珠按压蓄力，然后按照比例根据最高速度计算发射速度，松手便可发射出去。</p>
<p>投的弹珠数量最少一颗，目前最多五颗，倍率是从二倍到六倍这样增加，每增加一颗弹珠倍率增加一。投弹数量高倍率也就越高，但激活的洞口会变少，只有弹珠落入激活的洞口才能触发奖励，所以投多会更难中奖，但是奖励的更多。</p>
<p>游戏开始时弹珠库初始有20颗弹珠。</p>
<p>弹珠会撞到在洞口上方的许多钉子，这会让他们改变运行轨迹，增加趣味性，而不是直直抛出。</p>
<p>当弹珠落入已激活亮红光的洞口会弹出提示，代表已中奖，中奖会按照投入珠子数和倍率给弹珠奖励。</p>
<p>弹珠不够发射时，屏幕上会跳回合结束的提示，可以选择分享结果给朋友也可以选择再重新开一把。</p>
<p>弹珠长时间卡在钉子里会重置该弹珠，返还弹珠。滚回发射口也会退还。</p>
<p>暂停页里能继续、重新开始、换风格、调音乐音量和游戏音效音量。</p>
</div>

<div class="sheet">
<h2>2 声音与音乐</h2>
<p>目前设置了卡农、欢乐颂、康康舞曲等歌曲，点击左上角的音效、音乐按钮即可分别关闭。</p>

<h2>3 视觉主题</h2>
<p>有两种视觉风格，一种是仿照传统街机的外观及视觉元素，一种是简约版的现代风，在暂停后可在暂停页面点击切换。复古街机主题主要为黄色、有霓虹灯、有边框跑马灯。</p>

<h2>4 适龄提示</h2>
<p>首页有《健康游戏忠告》和适龄标记。</p>

<h2>5 数据记录</h2>
<p>保存奖励数据。</p>

<h2>6 运行平台</h2>
<p>在网页，微信小游戏和抖音小游戏能玩。</p>
</div>

<div class="sheet">
<h2>7 设计初衷</h2>
<p>我希望玩家玩这个游戏时能想起自己小时候在街旁的快乐时光，也能够享受游戏，消磨时间。</p>

<h2>8 界面截图</h2>
<div class="figs">${fig('01-menu', '图1 主菜单')}${fig('02-help', '图2 玩法说明')}</div>
<div class="figs">${fig('03-play', '图3 对局界面')}${fig('04-flight', '图4 弹珠飞行中')}</div>
<div class="figs">${fig('05-arcade', '图5 复古街机主题')}</div>
</div>

<div class="sheet">
<h2>9 版本信息</h2>
<table>
<tr><th>软件全称</th><td>${NAME}</td></tr>
<tr><th>版本号</th><td>${VER}</td></tr>
<tr><th>开发完成日期</th><td>2026 年 10 月 20 日</td></tr>
<tr><th>开发方式</th><td>单独开发</td></tr>
<tr><th>编程语言</th><td>JavaScript(HTML5 Canvas)</td></tr>
</table>
</div>

</body></html>`;
fs.writeFileSync(path.join(OUT, '操作说明书.html'), manual);

/* ---------- 6. 统计输出 ---------- */
console.log('源文件 ' + fileCount + ' 个,有效代码行 ' + lines.length);
console.log('源程序文档: ' + pages.length + ' 页(总页数 ' + totalPages + '),每页 ' + PER_PAGE + ' 行');
console.log('产出目录: ' + OUT);
