/**
 * 独立解析页（my-profile/netease/index.html）的端到端体检。
 *
 * 和 netease-music-parser/tools/verify-e2e.mjs 的区别：
 *   那个测的是「插件本身」，这个测的是「页面把插件用对了没有」。
 *   所以这里真的把 index.html 塞进 jsdom、真的执行页面里的内联脚本，
 *   再把 window.fetch 接到真实的后端实现上。
 *
 * 两条后端路径都测：
 *   - 同源 /api  -> my-profile/functions/api/[[path]].js（Cloudflare Pages Function）
 *   - 外部地址   -> netease-music-parser/proxy/handler.js（独立 Worker 那一套）
 *
 *   node tools/page-e2e.mjs            # 在站点根目录跑
 *   node tools/page-e2e.mjs --offline  # 只测离线识别，不碰网络
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');

const OFFLINE = process.argv.includes('--offline');

// 路径相对脚本本身算，这样在哪个目录下调用都行
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGE = path.join(ROOT, 'netease/index.html');
const PLUGIN = path.join(ROOT, 'assets/netease-music.js');
const PAGES_FN = path.join(ROOT, 'functions/api/[[path]].js');

const PARSER_DIR = process.env.NETEASE_PARSER_DIR || path.resolve(ROOT, '..', 'netease-music-parser');
const WORKER_HANDLER = pathToFileURL(path.join(PARSER_DIR, 'proxy/handler.js')).href;

const { handleRequest } = await import(WORKER_HANDLER);
const { onRequest: pagesOnRequest } = await import(pathToFileURL(PAGES_FN).href);

/** 页面用的假域名，两个后端都挂在它下面 */
const ORIGIN = 'https://qiongkura.test';
/** 假装成「另外部署的独立 Worker」 */
const WORKER_BASE = 'https://proxy.test';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

/* ------------------------------------------------------------------ */

const html = readFileSync(PAGE, 'utf8');

/** 抠出页面里所有 <script>（没有 src 的）内联脚本 */
const INLINE = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

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
 * @param {string} search 页面 URL 的 query，例如 '?api=off'
 * @param {{ apiDead?: boolean, riskControl?: number|'always' }} [options]
 *   apiDead     模拟「functions/ 还没被 Cloudflare 识别到」
 *   riskControl 模拟「网易云风控」：解析接口回 429 + 中文说明。
 *               数字 = 前 N 次被拦；'always' = 一直拦
 * @returns {object} jsdom 实例，额外挂了 .riskHits（被拦了几次）
 */
function bootPage(search, options = {}) {
  let riskHits = 0;
  /** 每次走解析接口的请求都记下来，用来按接口分别数次数 */
  const hits = [];

  const dom = new JSDOM(html, {
    url: `${ORIGIN}/netease/${search}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });

  const { window } = dom;

  // ⚠️ 用 Node 原生的 AbortController 换掉 jsdom 的。
  // 页面和插件发请求时都会带 signal，而 jsdom 30 的 AbortSignal 传进 Node 的
  // `new Request(url, { signal })` 会直接抛
  // "RequestInit: Expected signal ... to be an instance of AbortSignal"
  // （Node 24 + jsdom 30 实测），所有 fetch 全灭，页面就退化成"后端没响应"。
  // Node 原生的 signal 两边都认。
  window.AbortController = AbortController;

  // jsdom 不实现媒体播放：play() 只会往控制台吐一句 "Not implemented"，
  // 而且**不派发 play 事件** —— 插件的按钮图标全靠这个事件驱动，
  // 不桩的话「点了之后有没有变成暂停」根本观察不到。
  const { HTMLMediaElement } = window;
  HTMLMediaElement.prototype.play = function play() {
    this._nmpPaused = false;
    this.dispatchEvent(new window.Event('play'));
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function pause() {
    this._nmpPaused = true;
    this.dispatchEvent(new window.Event('pause'));
  };
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get() {
      return this._nmpPaused !== false;
    },
  });

  // 页面的脚本会 fetch(apiBase + '/health')，插件的请求也会走 window.fetch。
  // 相对路径（/api/...）交给真的 Pages Function，
  // 绝对地址（proxy.test）交给独立 Worker 那份 handler —— 两条路跑的都是真实代码。
  window.fetch = (input, init) => {
    const raw = typeof input === 'string' ? input : input.url;
    const absolute = new URL(raw, `${ORIGIN}/`).toString();
    const request = new Request(absolute, init);

    if (absolute.startsWith(WORKER_BASE)) return handleRequest(request, {});

    if (options.apiDead) {
      // 模拟「functions/ 还没被 Cloudflare 识别到」：/api/* 返回 404 HTML
      return Promise.resolve(
        new Response('<!doctype html><title>404</title>', {
          status: 404,
          headers: { 'content-type': 'text/html' },
        }),
      );
    }

    // 每个请求都记一笔（含 /health），后面按接口分别数次数。
    // 放在风控判断之前，这样不开风控的用例也能用 hits 数请求。
    hits.push(absolute);

    // 风控只影响解析接口，体检照常通过 —— 这样才能测出「后端是好的，只是这次被拦了」
    //
    // riskControl 传数字 = 前 N 次被拦、之后放行（用来验证客户端会自动换新请求重试）；
    // 传 'always' = 一直拦（用来验证重试用尽后给用户的提示）。
    if (options.riskControl && !/\/health(\?|$)/.test(absolute)) {
      riskHits += 1;
      const stillBlocked = options.riskControl === 'always' || riskHits <= Number(options.riskControl);
      if (stillBlocked) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: 429,
              message:
                '网易云风控拦截（-462）：这次请求的出口 IP 被网易临时标记了，跟链接本身没关系。' +
                '过几秒再点一次解析通常就好了 —— 每次请求走的是不同的边缘节点。',
              upstream: { code: -462 },
            }),
            { status: 429, headers: { 'content-type': 'application/json; charset=utf-8' } },
          ),
        );
      }
    }

    return pagesOnRequest({ request, env: {} });
  };

  // 插件本体
  window.eval(readFileSync(PLUGIN, 'utf8'));

  // 页面自己的内联脚本（head 里那段语言初始化 + body 末尾的页面逻辑）
  for (const code of INLINE) window.eval(code);

  Object.defineProperty(dom, 'riskHits', { get: () => riskHits });
  Object.defineProperty(dom, 'hits', { get: () => hits.slice() });

  return dom;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 从卡片里读几个关键字段，顺便断言 */
function inspectCard(document, label, expectTitle = '') {
  const card = document.querySelector('#np-result .nmp-card');
  check(`${label} · 渲染出卡片`, Boolean(card));
  if (!card) return;

  const title = card.querySelector('.nmp-title')?.textContent?.trim() || '';
  check(`${label} · 卡片有标题`, title.length > 0, title.slice(0, 40));
  if (expectTitle) check(`${label} · 标题含「${expectTitle}」`, title.includes(expectTitle), title);

  // 注意：封面图本身的 class 就是 nmp-cover（骨架屏的 div 也用这个名字）
  const img = card.querySelector('img.nmp-cover')?.getAttribute('src') || '';
  check(`${label} · 有封面`, img.startsWith('http'), img.slice(0, 60));

  const err = document.querySelector('#np-result .nmp-error');
  if (err) check(`${label} · 没有报错块`, false, err.textContent.trim().slice(0, 80));
}

/* ------------------------------------------------------------------ */

console.log(bold('\n独立解析页 · 端到端体检'));
console.log(dim(`页面 ${PAGE}`));
console.log(dim(`同源后端 ${path.relative(ROOT, PAGES_FN)}`));
console.log(dim(`外部后端 ${path.relative(ROOT, path.join(PARSER_DIR, 'proxy/handler.js'))}`));
console.log(dim(`模式 ${OFFLINE ? '离线（不碰网络）' : '真实网络 + 真实代理'}`));

/* ---------------------------------------------------------- 1. 离线识别 */

console.log(bold('\n[1] ?api=off → 强制走离线识别，页面不能白屏'));

{
  const dom = bootPage('?api=off&u=https://music.163.com/%23/song?id=3423857646');
  await wait(300);
  const { document } = dom.window;

  const status = document.getElementById('np-status');
  check('状态条提示没配后端', status?.getAttribute('data-state') === 'warn', `state=${status?.getAttribute('data-state')}`);

  const hit = document.querySelector('#np-result .np-hit');
  check('渲染出离线识别卡', Boolean(hit));

  const idText = document.querySelector('#np-result .np-hit-id')?.textContent?.trim();
  check('识别出 ID 3423857646', idText === '3423857646', `id=${idText}`);

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
  const dom = bootPage(`?api=${encodeURIComponent(WORKER_BASE)}&u=3423857646`);
  await wait(300);
  const { document } = dom.window;

  const picker = document.getElementById('np-type');
  check('出现类型选择器', Boolean(picker));

  const options = picker ? [...picker.options].map((o) => o.value) : [];
  check('选项含 单曲/歌单/专辑', ['song', 'playlist', 'album'].every((v) => options.includes(v)), options.join(','));

  check('还没发解析请求', !document.querySelector('#np-result .nmp-card'));

  dom.window.close();
}

/* ------------------------------------------------ 3. 内置代理没部署好 */

console.log(bold('\n[3] 内置代理没部署好 → 自动退回离线，不弹报错'));

{
  const dom = bootPage('?u=https://music.163.com/%23/song?id=3423857646', { apiDead: true });
  await wait(2500);
  const { document } = dom.window;

  const status = document.getElementById('np-status');
  check('状态条提示内置代理没响应', status?.getAttribute('data-state') === 'bad', `state=${status?.getAttribute('data-state')}`);

  const statusText = document.getElementById('np-status-text')?.textContent?.trim() || '';
  check('文案提示可能还在部署', statusText.includes('还在部署'), statusText.slice(0, 50));

  check('退回离线识别卡', Boolean(document.querySelector('#np-result .np-hit')));
  const extra = document.querySelector('#np-result .np-hit-extra')?.textContent || '';
  check('离线卡说明了原因', extra.includes('后端连不上'), extra.slice(0, 40));
  check('没有报错块', !document.querySelector('#np-result .nmp-error'));

  dom.window.close();
}

/* ------------------------------------------------- 4. 风控 429 要能看懂 */

console.log(bold('\n[4] 网易云风控（429）→ 客户端会自动换新请求重试，救得回来就不打扰用户'));

{
  // 前 2 次被拦、第 3 次放行。
  // 这模拟的是线上的真实情况：风控按出口 IP 判，同一个请求里重试没用，
  // 但换一个新请求（新的 HTTP 往返 → Cloudflare 重新选节点）就等于重新抽签。
  const dom = bootPage('?u=https://music.163.com/%23/song?id=3423857646', { riskControl: 2 });
  await wait(9000);
  const { document } = dom.window;

  const status = document.getElementById('np-status');
  check('体检仍然通过（后端本身是好的）', status?.getAttribute('data-state') === 'ok', `state=${status?.getAttribute('data-state')}`);

  // 数「解析接口」的次数，不是「所有请求」的次数。
  // 卡片现在还会顺手拉一次歌词（/lyric），算进总数里会让这条断言莫名其妙地飘。
  const songHits = dom.hits.filter((url) => /\/song(\?|$)/.test(url)).length;
  check(
    '解析接口确实发了 3 次（前 2 次被拦）',
    songHits === 3,
    `song ${songHits} 次 / 全部 ${dom.hits.length} 次`,
  );

  // 重试救回来了 → 应该是正常卡片，不该出现报错卡
  const card = document.querySelector('#np-result .nmp-card--song');
  check('重试之后解析成功', Boolean(card), document.querySelector('#np-result .nmp-card--error') ? '出现了报错卡' : '没有卡片');
  check('标题是凡常恩典', card?.querySelector('.nmp-title')?.textContent?.trim() === '凡常恩典', card?.querySelector('.nmp-title')?.textContent);
  check('没有报错块', !document.querySelector('#np-result .nmp-card--error'));

  dom.window.close();
}

console.log(bold('\n[4b] 风控一直不放行 → 报错卡要说清「已经自动试过几次」'));

{
  const dom = bootPage('?u=https://music.163.com/%23/song?id=3423857646', { riskControl: 'always' });
  await wait(12000);
  const { document } = dom.window;

  // 插件渲染的是 .nmp-card--error，原因写在 .nmp-sub 里。
  // 别找 .nmp-error —— 那个类名不存在（踩过一次）。
  const errCard = document.querySelector('#np-result .nmp-card--error');
  const errText = errCard?.querySelector('.nmp-sub')?.textContent?.trim() || '';
  check('出现了报错卡', Boolean(errCard), errText.slice(0, 40));
  check('带上了代理给的中文说明', /风控/.test(errText), errText.slice(0, 110));
  check('不是光秃秃一个状态码', !/^接口返回 HTTP 429$/.test(errText), errText.slice(0, 70));
  check('说明已经自动重试过', /自动换新请求重试/.test(errText), errText.slice(0, 130));
  const songHits = dom.hits.filter((url) => /\/song(\?|$)/.test(url)).length;
  check('解析接口一共发了 3 次（1 + 2 次重试）', songHits === 3, `song ${songHits} 次`);

  dom.window.close();
}

/* ---------------------------------------- 5. 同源 /api（Pages Function） */

if (!OFFLINE) {
  console.log(bold('\n[5] 默认配置 → 走本站自带的 /api（Cloudflare Pages Function）'));

  {
    const dom = bootPage('?u=https://music.163.com/%23/song?id=3423857646');
    await wait(9000);
    const { document } = dom.window;

    const status = document.getElementById('np-status');
    check('状态条 ok', status?.getAttribute('data-state') === 'ok', `state=${status?.getAttribute('data-state')}`);
    const statusText = document.getElementById('np-status-text')?.textContent?.trim() || '';
    check('文案提到「本站自带」', statusText.includes('本站自带'), statusText.slice(0, 50));

    inspectCard(document, '同源 /api 单曲', '凡常恩典');

    // 没配 Cookie 也**要**有播放键。
    // 能不能放是逐首决定的（实测热歌榜约一半不带 Cookie 也能放），
    // 所以不能因为后端没 Cookie 就把它藏起来。
    const result = document.getElementById('np-result');
    check('没配 Cookie 也要保留播放键', Boolean(result.querySelector('.nmp-play')));
    check('不该出现「只能看不能听」那种说明', !result.querySelector('.nmp-note'));

    // 播放器控件 + 歌词：这几样都在**打包后的插件**里，页面本身一行都没写，
    // 所以在这里过一遍才能确认构建产物真的带上了它们。
    check('有进度条', Boolean(result.querySelector('[data-nmp-seek]')));
    check('有音量条和静音键', Boolean(result.querySelector('[data-nmp-volume]') && result.querySelector('[data-nmp-action="mute"]')));
    check('时间显示是初始值', result.querySelector('.nmp-time-cur')?.textContent?.trim() === '0:00');
    const lyricLines = result.querySelectorAll('.nmp-lyric-line');
    check('歌词自动加载出来了', lyricLines.length > 0, `${lyricLines.length} 行`);
    check('歌词第一行有时间戳', /^\d/.test(lyricLines[0]?.dataset.nmpTime || ''), lyricLines[0]?.dataset.nmpTime);

    dom.window.close();
  }

  /* ------------------------------ 5b. 合集（歌单）的播放 / 暂停键 */

  console.log(bold('\n[5b] 歌单：封面和每一行都要有播放/暂停键'));

  {
    const dom = bootPage('?u=https://music.163.com/%23/playlist?id=2884035');
    await wait(9000);
    const { document } = dom.window;
    const result = document.getElementById('np-result');

    check('歌单卡渲染出来了', Boolean(result.querySelector('.nmp-card--collection')), result.querySelector('.nmp-title')?.textContent?.trim());

    // 曲目表默认收着，所以封面上必须有常驻的播放键。
    // 只有行内按钮的话，第一眼根本找不到「怎么暂停」—— 用户就是这么反馈的。
    const cover = result.querySelector('.nmp-play');
    check('封面上有播放键', Boolean(cover));
    check('封面键初始是「播放」', cover?.getAttribute('aria-label') === '播放', cover?.getAttribute('aria-label'));

    result.querySelector('.nmp-toggle')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    const rows = result.querySelectorAll('.nmp-track');
    const rowBtns = result.querySelectorAll('.nmp-track-play');
    check('曲目行渲染出来了', rows.length > 0, `${rows.length} 行`);
    check('每一行都有自己的播放键', rowBtns.length === rows.length, `${rowBtns.length} / ${rows.length}`);
    check(
      '可播的行都标了 data-nmp-playable',
      result.querySelectorAll('.nmp-track[data-nmp-playable="1"]').length === rows.length,
    );
    check('行内键的 aria-label 带曲名', /^播放 /.test(rowBtns[0]?.getAttribute('aria-label') || ''), rowBtns[0]?.getAttribute('aria-label'));

    // 点第一行的键，应该真的去要播放地址（能不能拿到是另一回事）
    const before = dom.hits.filter((u) => /\/song\/url/.test(u)).length;
    rowBtns[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await wait(5000);
    const after = dom.hits.filter((u) => /\/song\/url/.test(u)).length;
    check('点行内键会去要播放地址', after > before, `/song/url ${before} → ${after}`);

    if (rows[0].dataset.nmpActive === '1') {
      check('在放的那一行，图标换成暂停', /M7 5h3\.2v14H7z/.test(rowBtns[0].innerHTML));
      check('封面上的键也换成暂停', /M7 5h3\.2v14H7z/.test(cover.innerHTML));
    } else {
      // 这一首恰好放不了：不该点亮，而且要给出原因
      check('放不了的那首不会被点亮，并且给了原因', Boolean(result.querySelector('.nmp-notice')));
    }

    dom.window.close();
  }

  /* -------------------------------------- 6. 外部地址（独立 Worker） */

  console.log(bold('\n[6] ?api=<外部地址> → 走独立 Worker 那份 handler（真实网络）'));

  const external = [
    ['单曲', 'https://music.163.com/%23/song?id=3423857646', '凡常恩典'],
    ['专辑', 'https://music.163.com/album?id=389627625', ''],
    ['歌单', 'https://music.163.com/%23/playlist?id=2884035', ''],
  ];

  for (const [label, src, expectTitle] of external) {
    const dom = bootPage(`?api=${encodeURIComponent(WORKER_BASE)}&u=${src}`);
    await wait(9000);
    inspectCard(dom.window.document, label, expectTitle);
    dom.window.close();
  }

  console.log(bold('\n[7] /health 体检（同源）'));

  {
    const dom = bootPage('');
    await wait(3000);
    const { document } = dom.window;
    const status = document.getElementById('np-status');
    check('后端体检通过', status?.getAttribute('data-state') === 'ok', `state=${status?.getAttribute('data-state')}`);
    const text = document.getElementById('np-status-text')?.textContent?.trim() || '';
    check('报告了能力', text.includes('能力') || text.includes('capability'), text.slice(0, 90));
    dom.window.close();
  }
}

/* ------------------------------------------------------------------ */

console.log(
  `\n${fail === 0 ? green('全部通过') : red('有失败项')}  ${bold(`${pass} 通过`)}${fail ? ' / ' + red(`${fail} 失败`) : ''}\n`
);

process.exit(fail === 0 ? 0 : 1);
