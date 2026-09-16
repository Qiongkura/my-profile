/* 自动生成，不要手改。
 *
 * 源文件：../netease-music-parser/proxy/handler.js
 * 同步命令：node tools/sync-pages-proxy.mjs
 *
 * 这份文件就是整个代理。Pages 会在 /api/* 上调用下面的 onRequest，
 * 剥掉 /api 前缀之后交给和独立 Worker 完全一样的那份 handler。
 *
 * 为什么整份内联而不是 import：见 tools/sync-pages-proxy.mjs 的注释。
 */

/**
 * 代理核心逻辑（Web 标准 Request -> Response）。
 *
 * 同一份代码被两个入口复用：
 *   - proxy/worker.js      Cloudflare Workers / 其它边缘运行时
 *   - proxy/node-server.mjs  本地开发用的 Node HTTP 服务器
 *
 * 设计上刻意做成「白名单路由」而不是万能转发，
 * 避免部署出去以后被人当成公开的 CORS 跳板。
 */

const UPSTREAM = 'https://music.163.com';

/** 上游接口必须带上 Referer，否则会 403 */
const BASE_HEADERS = {
  Referer: 'https://music.163.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

/**
 * 桌面客户端的身份，抄自 Netease_url（Suxiaoqinx）那个 Python 项目。
 *
 * 它那边请求的是同一批 `music.163.com/api/...` 接口，但从头到尾**没有任何风控处理**
 * （全库搜不到 462 / verify / captcha），说明它压根不触发。
 * 它跟我们的差别有三处，这是其中一处：UA 是桌面客户端而不是浏览器。
 *
 * 这里只作为**可选**身份，用 `/diag?ua=desktop` 做 A/B 实测，
 * 验证有用再改默认值 —— 别凭感觉换。
 */
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/2.10.2.200154';

/**
 * 桌面客户端那套匿名指纹 cookie。
 *
 * 注意：这**不是**登录态，`MUSIC_U` 才是。它只是让请求看起来像客户端发的。
 * 拿不到播放直链跟这个无关（那个必须 MUSIC_U）。
 */
const DESKTOP_COOKIE = 'os=pc; appver=8.9.75; osver=; deviceId=pyncm!';

/** 极简内存缓存，边缘节点上足够用了 */
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/** 撞上风控最多重发几次（不含首次）。默认 0，理由见 fetchUpstream 的注释 */
const DEFAULT_RISK_RETRIES = 0;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expire) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  // 别让 Map 无限长大
  if (cache.size > 500) cache.clear();
  cache.set(key, { value, expire: Date.now() + CACHE_TTL });
}

/**
 * 对外状态码映射：**5xx 一律降成 429**。
 *
 * 原因（2026-09 实测，踩了很久）：Cloudflare Pages 会把函数返回的 **5xx
 * 整个替换掉**，客户端拿到的是 Cloudflare 自己的纯文本页
 * `error code: 502`，我们自己写的 `message` 一个字都传不出去。
 * 表现极具误导性 —— 看起来像函数被平台掐死了，其实是响应被换掉了。
 *
 * 4xx 不会被替换（404 / 400 / 405 都实测过，原样带 body 出来），
 * 所以对外统一用 4xx，**真实状态码放在 body 的 `code` 字段里**。
 * 用 429 是因为这些失败绝大多数就是「上游在限我们」，语义最贴。
 *
 * 这一层很关键：前端靠 body 里的 message 把原因显示给用户，
 * 一旦被替换成 `error code: 502`，用户就只看到一个看不懂的错误码。
 */
function wireStatus(status) {
  return status >= 500 ? 429 : status;
}

/** 统一响应头 */
function corsHeaders(env = {}) {
  return {
    'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'public, max-age=300',
  };
}

function json(data, { status = 200, env = {}, extra = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status: wireStatus(status),
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(env), ...extra },
  });
}

/**
 * 体检一下配的 Cookie。
 *
 * 关键点：MUSIC_U 才是登录凭证。很多人只填了 os=pc 这种，
 * 看着「有 Cookie」其实完全没用，所以要单独把这件事报出来。
 */
export function inspectCookie(env = {}) {
  const raw = env.NETEASE_COOKIE || '';
  if (!raw) {
    return {
      configured: false,
      hasMusicU: false,
      length: 0,
      verdict: '还没配 NETEASE_COOKIE',
      hint: '网易现在对未登录请求一律不返回播放直链，配了才有机会。步骤见 docs/playback.md',
    };
  }
  const hasMusicU = /(^|;\s*)MUSIC_U=/.test(raw);
  return {
    configured: true,
    hasMusicU,
    length: raw.length,
    verdict: hasMusicU ? '找到了 MUSIC_U，格式看着是对的' : '没有 MUSIC_U，这个 Cookie 基本是无效的',
    hint: hasMusicU
      ? '格式对不代表能播，还得看具体歌曲的版权，可以用 /verify 实测'
      : '只填 os=pc 之类的没用，MUSIC_U 才是登录凭证。步骤见 docs/playback.md',
  };
}

/**
 * 组装上游请求头。
 *
 * @param {object} env
 * @param {'browser'|'desktop'} [identity] 见 DESKTOP_UA 的注释，默认浏览器身份
 */
function upstreamHeaders(env = {}, identity = 'browser') {
  const headers = { ...BASE_HEADERS };
  if (identity === 'desktop') headers['User-Agent'] = DESKTOP_UA;

  // 登录态永远优先。没有登录态时，客户端身份会带一份匿名设备指纹 cookie
  // （那玩意儿不是登录态，拿不到直链，只是让请求看起来像客户端发的）
  if (env.NETEASE_COOKIE) {
    headers.Cookie = env.NETEASE_COOKIE;
  } else if (identity === 'desktop') {
    headers.Cookie = DESKTOP_COOKIE;
  }
  return headers;
}

/**
 * 网易云的风控响应。
 *
 * 典型长这样：{ code: -462, data: { verifyType: 40, verifyUrl: '.../encrypt-pages' } }
 * 意思是「你先去过个验证」—— 跟参数没关系，隔几秒重发就可能过。
 * 实测从 Cloudflare 的出口 IP 请求 /playlist、/album、/artist 会间歇性中招，
 * 而 /song、/lyric 基本不中，所以这是网易按接口 + 按 IP 的分级风控。
 */
export function isRiskControl(data) {
  return Boolean(data && (data.code === -462 || data.data?.verifyType || data.verifyType));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 请求上游并返回 JSON。
 *
 * 关于「撞上风控要不要自动重试」：**默认不重试**，原因是实测重试没用。
 *
 * 风控是按**出口 IP** 判定的，而**同一次函数调用里的多个请求会复用同一条连接、
 * 也就是同一个出口 IP**。所以在一个请求里连发三次，三次撞的是同一个被标记的 IP，
 * 结果几乎一样（实测 `/diag?n=6` 六次全部 -462）。
 * 反过来，**跨请求**的出口 IP 是会变的：连着打 8 次真实接口，
 * 结果是「过、拦、过、拦、拦、拦、拦、拦」——所以正确的做法是让用户隔几秒再点一次，
 * 那是一次新调用、一个新出口 IP，有实打实的概率命中干净的节点。
 *
 * 结论：**失败就快速失败，把原因说清楚，别在一个请求里空转。**
 * 想自己试重试：Pages 环境变量 `RISK_RETRIES=1`，或者用 `/diag?retries=N` 先量一量。
 *
 * 另一条必须守住的：**风控响应绝不能进缓存。**
 * 一旦把一次偶发的 -462 缓存 5 分钟，等于把瞬时故障钉死成持续故障。
 *
 * @param {string} url
 * @param {object} env
 * @param {{ noCache?: boolean, retries?: number, extraHeaders?: Record<string,string>, identity?: 'browser'|'desktop' }} [options]
 */
async function fetchUpstream(url, env = {}, options = {}) {
  const cached = options.noCache ? null : cacheGet(url);
  if (cached) return cached;

  const envRetries = Number(env.RISK_RETRIES);
  const retries = options.retries ?? (Number.isFinite(envRetries) ? envRetries : DEFAULT_RISK_RETRIES);
  let last = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        ...upstreamHeaders(env, options.identity),
        ...(options.extraHeaders || {}),
      },
    });
    if (!res.ok) {
      throw Object.assign(new Error(`上游返回 HTTP ${res.status}`), { status: res.status });
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw Object.assign(new Error('上游返回的不是 JSON'), { status: 502, body: text.slice(0, 200) });
    }

    if (!isRiskControl(data)) {
      cacheSet(url, data);
      return data;
    }

    last = data;
    // 还在风控里。默认不会走到这（retries=0），开了重试才睡一下再发
    if (attempt < retries) await sleep(150 + Math.random() * 350);
  }

  // 重试完还是被拦，原样返回但**不缓存**，下次请求会重新试
  return last;
}

/** 从分享链接里把 type/id 抠出来（代理端也要做一次，用于 /resolve） */
export function parseNeteaseUrl(input) {
  if (!input) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }

  if (/^163cn\.tv$/i.test(url.hostname)) {
    return { short: true, url: url.href, id: url.pathname.replace(/^\/+/, '').split('/')[0] };
  }
  if (!/(^|\.)music\.163\.com$/i.test(url.hostname)) return null;

  const hash = url.hash.replace(/^#/, '');
  const qi = hash.indexOf('?');
  const hashPath = qi === -1 ? hash : hash.slice(0, qi);
  const fullPath = (url.pathname + (hashPath.startsWith('/') ? hashPath : '')).replace(/\/{2,}/g, '/');
  const params = new URLSearchParams(url.search.replace(/^\?/, '') + '&' + (qi === -1 ? '' : hash.slice(qi + 1)));

  const rules = [
    [/^\/(?:#\/)?m?\/?song/i, 'song'],
    [/^\/(?:#\/)?m?\/?playlist/i, 'playlist'],
    [/^\/discover\/toplist/i, 'playlist'],
    [/^\/(?:#\/)?m?\/?album/i, 'album'],
    [/^\/(?:#\/)?m?\/?artist/i, 'artist'],
    [/^\/(?:#\/)?m?\/?djradio/i, 'djradio'],
    [/^\/(?:#\/)?m?\/?program/i, 'program'],
    [/^\/(?:#\/)?m?\/?mv/i, 'mv'],
    [/^\/(?:#\/)?m?\/?video/i, 'video'],
  ];
  const id = params.get('id') || '';
  for (const [re, type] of rules) {
    if (re.test(fullPath)) return { type, id, url: url.href };
  }
  if (id) return { type: '', id, url: url.href };
  return null;
}

/**
 * 路由表：路径 -> 上游 URL 构造器
 * 想加接口就在这里加一条，别的地方不用动。
 */
const ROUTES = {
  '/song': (p) => `${UPSTREAM}/api/song/detail?ids=${encodeURIComponent(`[${p.get('id')}]`)}`,

  '/song/url': (p) =>
    `${UPSTREAM}/api/song/enhance/player/url?ids=${encodeURIComponent(`[${p.get('id')}]`)}&br=${p.get('br') || 320000}`,

  '/lyric': (p) => `${UPSTREAM}/api/song/lyric?id=${p.get('id')}&lv=1&kv=1&tv=-1`,

  '/playlist': (p) => `${UPSTREAM}/api/v6/playlist/detail?id=${p.get('id')}&n=${p.get('limit') || 1000}&s=8`,

  // 注意：老的 /api/album/{id} 现在会返回 -462「绑定手机」，改用 v1
  '/album': (p) => `${UPSTREAM}/api/v1/album/${p.get('id')}`,

  '/artist': (p) => `${UPSTREAM}/api/artist/${p.get('id')}`,

  // 老路径 /api/program/detail 已 404，现在是 /api/dj/program/detail
  '/program': (p) => `${UPSTREAM}/api/dj/program/detail?id=${p.get('id')}`,

  '/djradio': (p) =>
    `${UPSTREAM}/api/dj/program/byradio?radioId=${p.get('id')}&limit=${p.get('limit') || 100}&offset=0&asc=false`,

  '/search': (p) =>
    `${UPSTREAM}/api/search/get/web?csrf_token=&s=${encodeURIComponent(p.get('q') || '')}` +
    `&type=${p.get('type') || 1}&offset=0&total=true&limit=${p.get('limit') || 30}`,
};

/**
 * 主处理函数。
 * @param {Request} request
 * @param {Record<string,string>} [env]
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, env = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }
  if (request.method !== 'GET') {
    return json({ code: 405, message: '只支持 GET' }, { status: 405, env });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/' || path === '/health') {
    return json({
      code: 200,
      service: 'netease-music-parser-proxy',
      // /resolve /verify /diag 是特殊路由，不走 ROUTES 表，这里手动补上
      routes: ['/resolve', '/verify', '/diag', '/health', ...Object.keys(ROUTES)],
      hasCookie: Boolean(env.NETEASE_COOKIE),
      cookie: inspectCookie(env),
      // 一句话说清这个后端现在能干什么
      capability: env.NETEASE_COOKIE
        ? '元数据 + 歌词 + 播放地址（能不能播看具体歌曲）'
        : '只有元数据和歌词，播放地址拿不到（缺 NETEASE_COOKIE）',
    }, { env });
  }

  try {
    // ---- Cookie 体检：拿一首歌实测一下，绕开缓存 ----
    if (path === '/verify') {
      const probeId = url.searchParams.get('id') || '186016';
      const br = url.searchParams.get('br') || 320000;
      const apiUrl = `${UPSTREAM}/api/song/enhance/player/url?ids=${encodeURIComponent(`[${probeId}]`)}&br=${br}`;
      const data = await fetchUpstream(apiUrl, env, { noCache: true });
      const item = data?.data?.[0];
      const ok = Boolean(item?.url);
      const cookie = inspectCookie(env);

      return json(
        {
          code: 200,
          ok,
          probeId,
          cookie,
          url: ok ? item.url : null,
          br: item?.br || 0,
          reason: ok
            ? ''
            : !cookie.configured
              ? '还没配 NETEASE_COOKIE'
              : cookie.hasMusicU
                ? 'Cookie 有了，但这首还是拿不到直链（可能已下架 / 版权受限 / 或 Cookie 过期了）'
                : 'Cookie 里没有 MUSIC_U',
          upstream: ok
            ? undefined
            : {
                code: item?.code,
                cannotListenReason: item?.freeTrialPrivilege?.cannotListenReason,
              },
        },
        { env },
      );
    }

    // ---- 短链解析 ----
    if (path === '/resolve') {
      const target = url.searchParams.get('url');
      if (!target) return json({ code: 400, message: '缺少 url 参数' }, { status: 400, env });

      const parsed = parseNeteaseUrl(target);
      if (!parsed) return json({ code: 400, message: '不是网易云音乐的链接' }, { status: 400, env });

      if (!parsed.short) {
        return json({ code: 200, type: parsed.type, id: parsed.id, url: parsed.url }, { env });
      }

      // 跟一次 302，Location 里就是真实链接
      const res = await fetch(parsed.url, {
        redirect: 'manual',
        headers: upstreamHeaders(env),
      });
      const location = res.headers.get('location') || '';
      const real = parseNeteaseUrl(location);
      if (!real || !real.id) {
        return json({ code: 404, message: '短链没跳到有效页面', location }, { status: 404, env });
      }
      return json({ code: 200, type: real.type, id: real.id, url: real.url, from: parsed.url }, { env });
    }

    // ---- 播放地址：三级降级，尽量给一个能播的 url ----
    if (path === '/song/url') {
      const id = url.searchParams.get('id');
      if (!id) return json({ code: 400, message: '缺少 id 参数' }, { status: 400, env });
      const br = url.searchParams.get('br') || 320000;

      const apiUrl = `${UPSTREAM}/api/song/enhance/player/url?ids=${encodeURIComponent(`[${id}]`)}&br=${br}`;
      const data = await fetchUpstream(apiUrl, env);
      const item = data?.data?.[0];
      if (item?.url) return json(data, { env });

      // 1) 接口没给直链，退回老的外链接口试试
      //    （网易现在多数情况会 302 到 /404，所以必须检查落点）
      let direct = '';
      try {
        const res = await fetch(`${UPSTREAM}/song/media/outer/url?id=${id}.mp3`, {
          redirect: 'manual',
          headers: upstreamHeaders(env),
        });
        const location = res.headers.get('location') || '';
        if (/^https?:\/\//.test(location) && !/\/404(\?|$)/.test(location)) direct = location;
      } catch {
        /* 拿不到就算了，下面会给明确原因 */
      }

      return json(
        {
          data: [
            {
              id: Number(id),
              url: direct || null,
              br: direct ? Number(br) : 0,
              size: 0,
              free: Boolean(direct),
              // 实测：不带登录 Cookie 时，连 fee=0 的免费歌曲也不会返回直链，
              // 老的外链接口也已经 302 到 /404，所以这里的提示要说实话
              reason: direct
                ? ''
                : env.NETEASE_COOKIE
                  ? '这首歌需要 VIP 或已下架，当前 Cookie 也拿不到直链'
                  : '后端没配登录 Cookie（NETEASE_COOKIE 要填真实登录后的 MUSIC_U），网易对未登录请求一律不返回直链',
            },
          ],
          code: 200,
        },
        { env },
      );
    }

    // ---- 风控诊断：连着打同一个接口 n 次，把每次的结果记下来 ----
    //
    // 存在的意义：风控是「按出口 IP + 按接口」的，只有从 Cloudflare 内部发请求
    // 才看得到真实情况，本地跑什么都测不出来。两个模式用来区分故障原因：
    //   mode=parse（默认）走完整流程，会 JSON.parse 上游响应
    //   mode=raw          只发请求、只记状态码和字节数，不解析
    // 如果 raw 能跑完而 parse 跑不完，那就是撞了 CPU 上限，不是网络问题。
    //
    //   /diag?path=/album&id=18905&n=3
    //   /diag?path=/album&id=18905&n=3&mode=raw
    //   /diag?path=/album&id=18905&n=3&retries=2        # 量一量重试到底有没有用
    //   /diag?path=/album&id=18905&n=3&realip=1.2.3.4   # 试 X-Real-IP 有没有用
    //   /diag?path=/album&id=18905&n=3&ua=compare       # 浏览器 UA vs 桌面客户端 UA，交替 A/B
    if (path === '/diag') {
      const target = url.searchParams.get('path') || '/album';
      const builder = ROUTES[target];
      if (!builder) {
        return json(
          { code: 400, message: `path 只能是：${Object.keys(ROUTES).join(' / ')}` },
          { status: 400, env },
        );
      }
      const n = Math.min(Math.max(Number(url.searchParams.get('n')) || 3, 1), 6);
      const raw = url.searchParams.get('mode') === 'raw';
      const retries = Math.min(Math.max(Number(url.searchParams.get('retries')) || 0, 0), 3);
      const ua = ['browser', 'desktop', 'compare'].includes(url.searchParams.get('ua'))
        ? url.searchParams.get('ua')
        : 'browser';
      const realip = url.searchParams.get('realip') || '';
      const extraHeaders = realip ? { 'X-Real-IP': realip, 'X-Forwarded-For': realip } : undefined;
      const apiUrl = builder(url.searchParams);

      const attempts = [];
      for (let i = 0; i < n; i++) {
        // compare 模式：同一个时间窗口里交替用两种身份，避开「出口 IP 自己在漂」
        // 这个混淆因素。分开跑两批是测不准的，因为风控是随机的。
        const identity = ua === 'compare' ? (i % 2 === 0 ? 'browser' : 'desktop') : ua;
        const started = Date.now();
        try {
          if (raw) {
            const res = await fetch(apiUrl, {
              headers: { ...upstreamHeaders(env, identity), ...(extraHeaders || {}) },
            });
            const text = await res.text();
            attempts.push({
              i: i + 1,
              identity,
              ms: Date.now() - started,
              http: res.status,
              bytes: text.length,
            });
          } else {
            const data = await fetchUpstream(apiUrl, env, {
              noCache: true,
              retries,
              identity,
              extraHeaders,
            });
            attempts.push({
              i: i + 1,
              identity,
              ms: Date.now() - started,
              code: data?.code ?? null,
              riskControl: isRiskControl(data),
            });
          }
        } catch (err) {
          attempts.push({ i: i + 1, identity, ms: Date.now() - started, error: err?.message || String(err) });
        }
        if (i < n - 1) await sleep(200);
      }

      const tally = (who) => {
        const of = attempts.filter((a) => a.identity === who);
        const blocked = of.filter((a) => a.riskControl).length;
        return { total: of.length, blocked, passed: of.length - blocked };
      };

      let summary;
      if (raw) {
        summary = `${n} 次请求都完成了（不解析响应体）`;
      } else if (ua === 'compare') {
        const b = tally('browser');
        const d = tally('desktop');
        summary =
          `浏览器 UA ${b.passed}/${b.total} 通过，桌面客户端 UA ${d.passed}/${d.total} 通过` +
          (d.passed > b.passed ? ' —— 桌面身份明显更好，值得改成默认' : ' —— 没有明显差别，别改');
      } else {
        const t = tally(ua);
        summary = `${ua} 身份：${n} 次里 ${t.blocked} 次被风控${t.blocked ? '' : '，这个出口 IP 目前是干净的'}`;
      }

      return json(
        {
          code: 200,
          mode: raw ? 'raw' : 'parse',
          retries,
          ua,
          upstream: apiUrl,
          realip: realip || null,
          attempts,
          ...(ua === 'compare' && !raw ? { browser: tally('browser'), desktop: tally('desktop') } : {}),
          summary,
        },
        { env, extra: { 'Cache-Control': 'no-store' } },
      );
    }

    // ---- 白名单转发 ----
    const builder = ROUTES[path];
    if (!builder) {
      return json({ code: 404, message: `未知路由 ${path}`, routes: Object.keys(ROUTES) }, { status: 404, env });
    }

    const data = await fetchUpstream(builder(url.searchParams), env);

    // 重试完还在风控里，别把 -462 那坨东西原样丢给前端
    // （前端拿到 {code:-462, data:{verifyType...}} 只会显示「没找到内容」，等于没说）
    //
    // 状态码用 429 而不是 502：Cloudflare Pages 会把 5xx 换成它自己的错误页，
    // 我们这条 message 就传不出去了。详见 wireStatus() 的注释。
    if (isRiskControl(data)) {
      return json(
        {
          code: 429,
          message:
            '网易云风控拦截（-462）：这次请求的出口 IP 被网易临时标记了，跟链接本身没关系。' +
            '过几秒再点一次解析通常就好了 —— 每次请求走的是不同的边缘节点。',
          upstream: { code: data?.code, verifyUrl: data?.data?.verifyUrl },
        },
        { status: 429, env },
      );
    }

    return json(data, { env });
  } catch (err) {
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    const wire = wireStatus(status);
    return json(
      {
        code: wire,
        message: err?.message || String(err),
        // 对外被降级过就把真实状态码留下来，免得排查时一头雾水
        ...(wire !== status ? { upstreamStatus: status } : {}),
      },
      { status, env },
    );
  }
}

/**
 * Pages Function 入口。
 * 请求 /api/song?id=1 -> 剥掉 /api -> 交给 handleRequest 处理 /song?id=1
 */
export const onRequest = (context) => {
  const url = new URL(context.request.url);
  const stripped = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  url.pathname = stripped;
  return handleRequest(new Request(url.toString(), context.request), context.env || {});
};
