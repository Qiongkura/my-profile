/**
 * 独立解析页（my-profile/netease/index.html）的端到端体检。
 *
 * 和 netease-music-parser/tools/verify-e2e.mjs 的区别：
 *   那个测的是「插件本身」，这个测的是「页面把插件用对了没有」。
 *   所以这里真的把 index.html 塞进 jsdom、真的执行页面里的内联脚本，
 *   然后把 window.fetch 接到 proxy/handler.js 上 —— 走的是和线上部署一样的代码路径。
 *
 *   node tools/page-e2e.mjs            # 在站点根目录跑
 *   node tools/page-e2e.mjs --offline  # 只测离线识别，不碰网络
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');

const OFFLINE = process.argv.includes('--offline');

// 路径相对脚本本身算，这样在哪个目录下调用都行
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGE = path.join(ROOT, 'netease/index.html');
const PLUGIN = path.join(ROOT, 'assets/netease-music.js');
const PROXY = 'file:///I:/projects/netease-music-parser/proxy/handler.js';
const { handleRequest } = await import(PROXY);

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

/* ------------------------------------------------------------------ */

const html = readFileSync(PAGE, 'utf8');
const pluginSource = readFileSync(PLUGIN, 'utf8');

/** 抠出页面里所有 <script>（没有 src 的）内联脚本 */
function inlineScripts(source) {
  return [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

const INLINE = inlineScripts(html);

let pass = 0;
let fail = 0;

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  ${green('✓')} ${label}${detail ? dim('  ' + detail) : ''}`);
  } else {
    fail += 1;
    console.log(`  ${red('✗')} ${label}${detail ? '  ' + detail : ''}`);
  }
}

/**
 * 起一个跑着真实页面的 jsdom。
 * @param {string} search 页面 URL 的 query，例如 '?api=https://proxy.test'
 */
function bootPage(search) {
  const dom = new JSDOM(html, {
    url: `https://qiongkura.test/netease/${search}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });

  const { window } = dom;

  // 页面的脚本会 fetch(apiBase + '/health')，插件的请求也会走 window.fetch。
  // 两个都接到同一个 handler 上，等于把线上代理搬到了本地。
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    return handleRequest(new Request(url, init), {});
  };

  // 插件本体
  window.eval(pluginSource);

  // 页面自己的内联脚本（head 里那段语言初始化 + body 末尾的页面逻辑）
  for (const code of INLINE) window.eval(code);

  return dom;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */

console.log(bold('\n独立解析页 · 端到端体检'));
console.log(dim(`页面 ${PAGE}`));
console.log(dim(`模式 ${OFFLINE ? '离线（不碰网络）' : '真实网络 + 真实代理'}`));

/* ---------------------------------------------------------- 1. 离线识别 */

console.log(bold('\n[1] 没配后端 → 退化成离线识别，页面不能白屏'));

{
  const dom = bootPage('?u=https://music.163.com/%23/song?id=186016');
  await wait(200);
  const { document } = dom.window;

  const status = document.getElementById('np-status');
  check('状态条提示没配后端', status?.getAttribute('data-state') === 'warn', `state=${status?.getAttribute('data-state')}`);

  const hit = document.querySelector('#np-result .np-hit');
  check('渲染出离线识别卡', Boolean(hit));

  const idText = document.querySelector('#np-result .np-hit-id')?.textContent?.trim();
  check('识别出 ID 186016', idText === '186016', `id=${idText}`);

  const kind = document.querySelector('#np-result .np-hit-kind')?.textContent?.trim();
  check('识别出类型「单曲」', kind === '单曲', `kind=${kind}`);

  const link = document.querySelector('#np-result .np-hit-actions a')?.getAttribute('href') || '';
  check('给出官方链接', link.includes('music.163.com'), link);

  const btn = document.getElementById('np-hit-config');
  check('有「配置后端」按钮', Boolean(btn));

  dom.window.close();
}

/* --------------------------------------------------- 2. 纯 ID 的类型选择 */

console.log(bold('\n[2] 纯 ID 不带类型 → 先让用户选类型'));

{
  const dom = bootPage('?api=https://proxy.test&u=186016');
  await wait(300);
  const { document } = dom.window;

  const picker = document.getElementById('np-type');
  check('出现类型选择器', Boolean(picker));

  const options = picker ? [...picker.options].map((o) => o.value) : [];
  check('选项含 单曲/歌单/专辑', ['song', 'playlist', 'album'].every((v) => options.includes(v)), options.join(','));

  check('还没发解析请求', !document.querySelector('#np-result .nmp-card'));

  dom.window.close();
}

/* ------------------------------------------------------------ 3. 完整解析 */

if (!OFFLINE) {
  console.log(bold('\n[3] 配了后端 → 真实解析成卡片（真实网络）'));

  const cases = [
    ['单曲', 'https://music.163.com/%23/song?id=186016', '晴天'],
    ['专辑', 'https://music.163.com/album?id=18905', ''],
    ['歌单', 'https://music.163.com/%23/playlist?id=2884035', ''],
  ];

  for (const [label, src, expectTitle] of cases) {
    const dom = bootPage(`?api=https://proxy.test&u=${src}`);
    // 每张卡都要真的去 music.163.com 拿数据，给足时间
    await wait(9000);
    const { document } = dom.window;

    const card = document.querySelector('#np-result .nmp-card');
    check(`${label} · 渲染出卡片`, Boolean(card));

    if (card) {
      const title = card.querySelector('.nmp-title')?.textContent?.trim() || '';
      check(`${label} · 卡片有标题`, title.length > 0, title.slice(0, 40));
      if (expectTitle) {
        check(`${label} · 标题含「${expectTitle}」`, title.includes(expectTitle), title);
      }
      // 注意：封面图本身的 class 就是 nmp-cover（骨架屏的 div 也用这个名字）
      const img = card.querySelector('img.nmp-cover')?.getAttribute('src') || '';
      check(`${label} · 有封面`, img.startsWith('http'), img.slice(0, 60));
    }

    const err = document.querySelector('#np-result .nmp-error');
    if (err) check(`${label} · 没有报错块`, false, err.textContent.trim().slice(0, 80));

    dom.window.close();
  }

  console.log(bold('\n[4] /health 体检'));

  {
    const dom = bootPage('?api=https://proxy.test');
    await wait(2500);
    const { document } = dom.window;
    const status = document.getElementById('np-status');
    const state = status?.getAttribute('data-state');
    const text = document.getElementById('np-status-text')?.textContent?.trim() || '';
    check('后端体检通过', state === 'ok', `state=${state}`);
    check('报告了能力', text.includes('能力') || text.includes('capability'), text.slice(0, 90));
    dom.window.close();
  }
}

/* ------------------------------------------------------------------ */

console.log(
  `\n${fail === 0 ? green('全部通过') : red('有失败项')}  ${bold(`${pass} 通过`)}${fail ? ' / ' + red(`${fail} 失败`) : ''}\n`
);

process.exit(fail === 0 ? 0 : 1);
