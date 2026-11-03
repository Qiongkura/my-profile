/* 软著申请材料生成器:源程序文档(60页) + 操作说明书(含界面截图)
 * 运行: node tools/gen-copyright.js
 * 产出: docs/copyright/源程序.html、docs/copyright/操作说明书.html
 *      浏览器打开 → Ctrl+P → 另存为 PDF 即可上传软著登记系统
 * 登记格式要求: 源程序前30页+后30页、每页≥50行;说明书前30页+后30页
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

/* ---------- 5. 操作说明书(截图内嵌 base64) ---------- */
const shotsDir = path.join(OUT, 'shots');
const img = (f) => {
  const p = path.join(shotsDir, f + '.png');
  return fs.existsSync(p) ? 'data:image/png;base64,' + fs.readFileSync(p).toString('base64') : '';
};
const fig = (f, cap) => '<figure><img src="' + img(f) + '" alt="' + cap + '"><figcaption>' + cap + '</figcaption></figure>';

const manual = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${NAME}${VER} 操作说明书</title><style>
@page { size: A4; margin: 20mm 18mm; }
body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 11pt; line-height: 1.75; color: #222; margin: 0; }
.page { page-break-after: always; }
.cover { text-align: center; padding-top: 60mm; }
.cover h1 { font-size: 26pt; margin-bottom: 6mm; letter-spacing: 2px; }
.cover .ver { font-size: 14pt; color: #555; }
.cover .meta { margin-top: 40mm; font-size: 12pt; line-height: 2.2; color: #333; }
h2 { font-size: 15pt; border-left: 4px solid #c0392b; padding-left: 8px; margin: 8mm 0 4mm; }
h3 { font-size: 12.5pt; margin: 6mm 0 3mm; }
p { margin: 2.5mm 0; text-align: justify; }
ul, ol { margin: 2mm 0; padding-left: 6mm; }
li { margin: 1.2mm 0; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 10.5pt; }
th, td { border: 1px solid #999; padding: 2mm 3mm; text-align: left; }
th { background: #f2f2f2; }
.figs { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin: 3mm 0; }
figure { margin: 0; text-align: center; }
figure img { width: 100%; border: 1px solid #ddd; }
figcaption { font-size: 9.5pt; color: #555; margin-top: 1.5mm; }
.note { background: #faf6ea; border: 1px solid #e0d6b8; padding: 3mm 4mm; font-size: 10.5pt; }
@media print { .sheet { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; page-break-after: always; page-break-inside: avoid; } }
@media screen { body { background: #666; } .sheet { background: #fff; width: 210mm; min-height: 297mm; margin: 8mm auto; padding: 20mm 18mm; box-shadow: 0 2px 8px rgba(0,0,0,.4); box-sizing: border-box; } }
</style></head><body>

<div class="sheet cover">
  <h1>${NAME}</h1>
  <div class="ver">版本号:${VER}</div>
  <div class="meta">
    操作说明书<br>
    著作权人:________________________(登记时填写身份证姓名)<br>
    开发完成日期:2026 年 10 月 20 日
  </div>
</div>

<div class="sheet">
<h2>1 软件概述</h2>
<p>${NAME}(\u4ee5\u4e0b\u7b80\u79f0\u201c\u672c\u8f6f\u4ef6\u201d)\u662f\u4e00\u6b3e\u4ee5\u73bb\u7483\u5f39\u73e0\u6e38\u827a\u673a\u4e3a\u9898\u6750\u7684\u4f11\u95f2\u76ca\u667a\u5c0f\u6e38\u620f\u3002\u73a9\u5bb6\u901a\u8fc7\u6295\u5165\u5f39\u73e0\u9009\u62e9\u500d\u7387\u6863\u4f4d\u3001\u6309\u4f4f\u84c4\u529b\u540e\u677e\u624b\u53d1\u5c04\uff0c\u5f39\u73e0\u5728\u9489\u9635\u4e0e\u5f39\u67f1\u4e4b\u95f4\u53d1\u751f\u7269\u7406\u78b0\u649e\u540e\u843d\u5165\u673a\u53f0\u5e95\u90e8\u6d1e\u53e3\uff0c\u4f9d\u636e\u843d\u70b9\u662f\u5426\u4e3a\u4eae\u706f\u6d1e\u53e3\u4e0e\u5f53\u524d\u500d\u7387\u7ed3\u7b97\u5956\u52b1\u3002</p>
<p>\u672c\u8f6f\u4ef6\u91c7\u7528\u81ea\u7814 Canvas 2D \u6e32\u67d3\u5f15\u64ce\u4e0e\u81ea\u7814\u8f7b\u91cf\u7269\u7406\u5f15\u64ce\uff0c\u4e00\u5957\u4ee3\u7801\u540c\u65f6\u9002\u914d\u6d4f\u89c8\u5668、\u5fae\u4fe1\u5c0f\u6e38\u620f\u4e0e\u6296\u97f3\u5c0f\u6e38\u620f\u4e09\u4e2a\u8fd0\u884c\u73af\u5883\uff0c\u65e0\u9700\u5b89\u88c5\u5373\u53ef\u73a9\u3002</p>

<h3>1.1 主要功能</h3>
<ul>
  <li><b>弹珠发射</b>:\u6309\u4f4f\u5c4f\u5e55\u84c4\u529b\u3001\u677e\u624b\u53d1\u5c04\uff0c\u529b\u5ea6\u6b63\u5f26\u6ce2\u5f62\u5b9e\u65f6\u56de\u663e\uff0c\u529b\u5ea6\u51b3\u5b9a\u5f39\u73e0\u8fdb\u5165\u673a\u53f0\u7684\u9ad8\u5ea6\u4e0e\u8f68\u8ff9\u3002</li>
  <li><b>\u6295\u6ce8\u500d\u7387</b>:1~\u0035\u9897\u5f39\u73e0\u5bf9\u5e94 \u00d72~\u00d76 \u500d\u7387\uff0c\u6295\u6ce8\u8d8a\u591a\u500d\u7387\u8d8a\u9ad8\u3001\u4eae\u706f\u6d1e\u53e3\u8d8a\u5c11\u3002</li>
  <li><b>\u7269\u7406\u78b0\u649e</b>:\u5f39\u73e0\u4e0e\u9489\u5b50\u3001\u5f39\u67f1\u3001\u5899\u4f53\u53d1\u751f\u771f\u5b9e\u5f39\u6027\u78b0\u649e\uff0c\u652f\u6301\u8fde\u7eed\u5b50\u6b65\u8ba1\u7b97\u4e0e\u5168\u5c40\u9650\u901f\u3002</li>
  <li><b>\u4e2d\u5956\u7ed3\u7b97</b>:\u5f39\u73e0\u843d\u5165\u4eae\u706f\u6d1e\u53e3\u5373\u6309\u5f53\u524d\u500d\u7387\u8ba1\u7b97\u5956\u52b1\u5f39\u73e0\u4e0e\u5956\u54c1\u5361\u3002</li>
  <li><b>\u4e3b\u9898\u5207\u6362</b>:\u201c\u6781\u7b80\u201d\u4e0e\u201c\u590d\u53e4\u8857\u673a\u201d\u53cc\u4e3b\u9898\uff0c\u8c03\u8272\u677f\u5373\u65f6\u751f\u6548\u3002</li>
  <li><b>\u97f3\u6548\u4e0e\u97f3\u4e50</b>:\u7a0b\u5e8f\u751f\u6210\u97f3\u6548 + \u5206\u5305\u52a0\u8f7d\u7684\u80cc\u666f\u97f3\u4e50\uff0c\u652f\u6301\u97f3\u91cf\u8c03\u8282\u3002</li>
  <li><b>\u9002\u9f84\u63d0\u793a</b>:\u9996\u9875\u5c55\u793a\u6807\u51c6\u9002\u9f84\u63d0\u793a\u6807\u8bc6\u4e0e\u5065\u5eb7\u6e38\u620f\u5ba3\u8a00\u3002</li>
</ul>
</div>

<div class="sheet">
<h2>2 运行环境</h2>
<table>
<tr><th>\u9879\u76ee</th><th>\u8bf4\u660e</th></tr>
<tr><td>\u786c\u4ef6\u73af\u5883</td><td>\u667a\u80fd\u624b\u673a(Android / iOS)\u3001\u4e2a\u4eba\u7535\u8111</td></tr>
<tr><td>\u8f6f\u4ef6\u73af\u5883</td><td>\u5fae\u4fe1\u5c0f\u6e38\u620f\u8fd0\u884c\u73af\u5883、\u6296\u97f3\u5c0f\u6e38\u620f\u8fd0\u884c\u73af\u5883\u3001Chrome / Safari / Edge \u7b49\u73b0\u4ee3\u6d4f\u89c8\u5668</td></tr>
<tr><td>\u7f16\u7a0b\u8bed\u8a00</td><td>JavaScript(HTML5 Canvas)</td></tr>
<tr><td>\u4f9d\u8d56</td><td>\u65e0\u7b2c\u4e09\u65b9\u6e38\u620f\u5f15\u64ce\uff0c\u96f6\u5916\u90e8\u8fd0\u884c\u65f6\u4f9d\u8d56</td></tr>
</table>

<h2>3 \u754c\u9762\u4e0e\u64cd\u4f5c\u8bf4\u660e</h2>
<h3>3.1 \u4e3b\u83dc\u5355</h3>
<p>\u6253\u5f00\u8f6f\u4ef6\u540e\u8fdb\u5165\u4e3b\u83dc\u5355\u3002\u9876\u90e8\u4e3a\u97f3\u6548\u3001\u97f3\u4e50\u56fe\u6807\uff1b\u4e2d\u90e8\u4e3a\u300c\u5f00\u59cb\u6e38\u620f\u300d\u300c\u73a9\u6cd5\u8bf4\u660e\u300d\u300c\u58f0\u97f3\u300d\u300c\u673a\u53f0\u98ce\u683c\u300d\u56db\u4e2a\u6309\u94ae\uff1b\u5e95\u90e8\u663e\u793a\u5386\u53f2\u6210\u7ee9\u4e0e\u9002\u9f84\u63d0\u793a\u3002</p>
<div class="figs">${fig('01-menu', '\u56fe1 \u4e3b\u83dc\u5355\u754c\u9762')}${fig('02-help', '\u56fe2 \u73a9\u6cd5\u8bf4\u660e\u754c\u9762')}</div>
</div>

<div class="sheet">
<h3>3.2 \u5bf9\u5c40\u754c\u9762</h3>
<p>\u8fdb\u5165\u5bf9\u5c40\u540e\uff0c\u754c\u9762\u4e0a\u90e8\u4e3a\u5f39\u73e0\u5e93\u4f59\u989d\u4e0e\u5f53\u524d\u500d\u7387\u6570\u7801\u7ba1\uff1b\u4e2d\u90e8\u4e3a\u673a\u53f0\u533a\u57df\uff0c\u5305\u542b\u9489\u9635\u3001\u5f39\u67f1\u3001\u5f39\u9053\u4e0e\u5e95\u90e8\u4eae\u706f\u6d1e\u53e3\uff1b\u4e0b\u90e8\u4e3a\u6295\u6ce8\u533a\u3002</p>
<div class="figs">${fig('03-play', '\u56fe3 \u5bf9\u5c40\u754c\u9762\u4e0e\u6295\u6ce8\u533a')}${fig('04-flight', '\u56fe4 \u5f39\u73e0\u98de\u884c\u4e2d')}</div>
<ul>
  <li><b>\u6295\u6ce8</b>:\u70b9\u51fb\u300c1\u9897 \u00d72\u300d~\u300c5\u9897 \u00d76\u300d\u9009\u62e9\u6863\u4f4d\uff0c\u6bcf\u5c40\u6295\u5165\u5bf9\u5e94\u6570\u91cf\u7684\u5f39\u73e0\u3002</li>
  <li><b>\u53d1\u5c04</b>:\u6309\u4f4f\u5f39\u73e0/\u5f39\u9053\u533a\u84c4\u529b\uff0c\u5de6\u4e0b\u89d2\u529b\u5ea6\u6761\u5b9e\u65f6\u56de\u663e\uff0c\u677e\u624b\u53d1\u5c04\u3002</li>
  <li><b>\u6682\u505c</b>:\u70b9\u51fb\u53f3\u4e0a\u89d2\u6682\u505c\u6309\u94ae\u6216\u6309\u952e\u6682\u505c\uff0c\u53ef\u5728\u6682\u505c\u9762\u677f\u8c03\u8282\u97f3\u91cf\u6216\u8fd4\u56de\u4e3b\u83dc\u5355\u3002</li>
</ul>
<h3>3.3 \u590d\u53e4\u4e3b\u9898</h3>
<p>\u5728\u4e3b\u83dc\u5355\u70b9\u51fb\u300c\u673a\u53f0\u98ce\u683c\u300d\u53ef\u5728\u201c\u6781\u7b80\u201d\u4e0e\u201c\u590d\u53e4\u8857\u673a\u201d\u4e24\u5957\u89c6\u89c9\u4e3b\u9898\u95f4\u5207\u6362\uff0c\u5207\u6362\u7acb\u5373\u751f\u6548\u5e76\u4fdd\u5b58\u3002</p>
<div class="figs">${fig('05-arcade', '\u56fe5 \u590d\u53e4\u8857\u673a\u4e3b\u9898')}</div>
</div>

<div class="sheet">
<h2>4 \u73a9\u6cd5\u89c4\u5219</h2>
<ol>
  <li>\u6bcf\u5c40\u5f00\u59cb\u524d\u9009\u62e9\u6295\u6ce8\u6863\u4f4d(1~\u0035 \u9897\uff0c\u5bf9\u5e94 \u00d72~\u00d76 \u500d\u7387)\uff0c\u6295\u6ce8\u5f39\u73e0\u4ece\u5f39\u73e0\u5e93\u6263\u9664\u3002</li>
  <li>\u6309\u4f4f\u84c4\u529b\u3001\u677e\u624b\u53d1\u5c04\uff0c\u5f39\u73e0\u6cbf\u5f39\u9053\u8fdb\u5165\u9489\u9635\u3002</li>
  <li>\u5f39\u73e0\u7ecf\u8fc7\u9489\u9635\u3001\u5f39\u67f1\u4e0e\u5899\u4f53\u7684\u591a\u6b21\u78b0\u649e\u540e\u81ea\u7136\u4e0b\u843d\uff0c\u6700\u7ec8\u843d\u5165\u673a\u53f0\u5e95\u90e8\u67d0\u4e00\u6d1e\u53e3\u3002</li>
  <li>\u82e5\u843d\u5165\u4eae\u706f(\u7ea2\u8272 LED)\u6d1e\u53e3\uff0c\u5219\u6309\u5f53\u524d\u500d\u7387\u83b7\u5f97\u5956\u52b1\uff1b\u82e5\u843d\u5165\u672a\u4eae\u706f\u6d1e\u53e3\u5219\u672c\u5c40\u65e0\u5956\u3002</li>
  <li>\u6295\u6ce8\u8d8a\u591a\u3001\u500d\u7387\u8d8a\u9ad8\uff0c\u4eae\u706f\u6d1e\u53e3\u6570\u91cf\u8d8a\u5c11\uff0c\u4e2d\u5956\u96be\u5ea6\u76f8\u5e94\u63d0\u5347\u3002</li>
  <li>\u5f39\u73e0\u957f\u65f6\u95f4\u5361\u6ede\u65f6\uff0c\u7cfb\u7edf\u811a\u672c\u4f1a\u81ea\u52a8\u89e3\u6551\u5f39\u73e0\uff1b\u5f39\u73e0\u6eda\u56de\u5f39\u9053\u5219\u9000\u8fd8\u672c\u5c40\u6295\u6ce8\u3002</li>
</ol>

<h2>5 \u6280\u672f\u7279\u70b9</h2>
<ul>
  <li>\u81ea\u7814 Canvas 2D \u6e32\u67d3\u5f15\u64ce\uff1a\u4e0d\u4f9d\u8d56\u7b2c\u4e09\u65b9\u6e38\u620f\u5f15\u64ce\uff0c\u7edf\u4e00\u9002\u914d\u6d4f\u89c8\u5668\u3001\u5fae\u4fe1\u5c0f\u6e38\u620f\u3001\u6296\u97f3\u5c0f\u6e38\u620f\u4e09\u7aef\u3002</li>
  <li>\u81ea\u7814\u8f7b\u91cf\u7269\u7406\u5f15\u64ce\uff1a\u652f\u6301\u5706-\u5706、\u5706-\u7ebf\u6bb5\u78b0\u649e\u4e0e\u6bcf\u5e27 12 \u5b50\u6b65\u79bb\u6563\u79ef\u5206\uff0c\u542b\u91cd\u529b\u3001\u7a7a\u6c14\u963b\u529b\u4e0e\u5168\u5c40\u901f\u5ea6\u4e0a\u9650\u3002</li>
  <li>\u4e24\u6bb5\u5f0f\u84c4\u529b\u529b\u5ea6\u66f2\u7ebf\uff1a\u5148\u66f2\u7ebf\u540e\u7ebf\u6027\uff0c\u6839\u636e\u5c4f\u5e55\u9ad8\u5ea6\u52a8\u6001\u6807\u5b9a\u8fc7\u5f2f\u4e34\u754c\u901f\u5ea6\u3002</li>
  <li>\u53cc\u4e3b\u9898\u8c03\u8272\u677f\u7cfb\u7edf\uff1a\u8fd0\u884c\u65f6\u539f\u5730\u8986\u5199\u8c03\u8272\u677f\uff0c\u5207\u6362\u4e3b\u9898\u4e0d\u91cd\u5efa\u573a\u666f\u3002</li>
  <li>\u97f3\u9891\u5206\u5305\u4e0e\u4e09\u7ea7\u52a0\u8f7d\uff1a\u80cc\u666f\u97f3\u4e50\u62c6\u5206\u5230\u5b50\u5305\u6309\u9700\u52a0\u8f7d\uff0c\u97f3\u6548\u7531 WebAudio \u7a0b\u5e8f\u5408\u6210\u3002</li>
  <li>\u81ea\u9002\u5e94\u89c6\u53e3\uff1a750 \u903b\u8f91\u5bbd\u5ea6\u3001\u5c4f\u5e55\u5b89\u5168\u533a\u9002\u914d\uff0c\u9002\u5e94\u4e0d\u540c\u5c4f\u5e55\u6bd4\u4f8b\u4e0e\u6a2a\u7ad6\u5c4f\u5207\u6362\u3002</li>
</ul>

<h2>6 \u7248\u672c\u4fe1\u606f</h2>
<table>
<tr><th>\u8f6f\u4ef6\u5168\u79f0</th><td>${NAME}</td></tr>
<tr><th>\u7248\u672c\u53f7</th><td>${VER}</td></tr>
<tr><th>\u5f00\u53d1\u5b8c\u6210\u65e5\u671f</th><td>2026 \u5e74 10 \u6708 20 \u65e5</td></tr>
<tr><th>\u5f00\u53d1\u65b9\u5f0f</th><td>\u72ec\u7acb\u5f00\u53d1</td></tr>
<tr><th>\u7f16\u7a0b\u8bed\u8a00</th><td>JavaScript(HTML5 Canvas)</td></tr>
</table>
<p class="note">\u672c\u8bf4\u660e\u4e66\u4e0e\u300a\u6e90\u7a0b\u5e8f\u300b\u914d\u5957\u4f7f\u7528\uff0c\u4ec5\u4f9b\u8457\u4f5c\u6743\u767b\u8bb0\u5ba1\u67e5\u4e4b\u7528\u3002</p>
</div>

</body></html>`;
fs.writeFileSync(path.join(OUT, '操作说明书.html'), manual);

/* ---------- 6. 统计输出 ---------- */
console.log('源文件 ' + fileCount + ' 个,有效代码行 ' + lines.length);
console.log('源程序文档: ' + pages.length + ' 页(总页数 ' + totalPages + '),每页 ' + PER_PAGE + ' 行');
console.log('产出目录: ' + OUT);
