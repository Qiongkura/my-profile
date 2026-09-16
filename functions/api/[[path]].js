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

/** 极简内存缓存，边缘节点上足够用了 */
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/** 撞上风控最多重发几次（不含首次） */
const RISK_RETRIES = 2;

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
    status,
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

/** 带上 cookie（配了 NETEASE_COOKIE 才能拿到 VIP 歌曲的直链） */
function upstreamHeaders(env = {}) {
  const headers = { ...BASE_HEADERS };
  if (env.NETEASE_COOKIE) headers.Cookie = env.NETEASE_COOKIE;
  return headers;
}

/**
 * 网易云的风控响应。
 *
 * 典型长这样：{ code: -462, data: { verifyType: 40, verifyUrl: '.../encrypt-pages' } }
 * 意思是「你先去过个验证」—— 跟参数没关系，同一秒重发就可能过。
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
 * 两个要点：
 *   1. 撞上风控就重发。它是概率性的，实测 3 次里能过 2 次，重试是最省事的解法。
 *   2. **风控响应绝不能进缓存。** 一旦把 -462 缓存 5 分钟，等于把一次偶发失败
 *      钉死成一个持续故障，重试也没用（因为根本不会打到上游）。
 *
 * @param {string} url
 * @param {object} env
 * @param {{ noCache?: boolean, retries?: number }} [options] 诊断类请求要绕开缓存，否则测不出当前 Cookie 的状态
 */
async function fetchUpstream(url, env = {}, options = {}) {
  const cached = options.noCache ? null : cacheGet(url);
  if (cached) return cached;

  const retries = options.retries ?? RISK_RETRIES;
  let last = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: upstreamHeaders(env) });
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
    // 还在风控里，喘口气再来。加抖动，避免并发请求整齐地一起重试
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
      // /resolve 和 /verify 是特殊路由，不走 ROUTES 表，这里手动补上
      routes: ['/resolve', '/verify', '/health', ...Object.keys(ROUTES)],
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

    // ---- 白名单转发 ----
    const builder = ROUTES[path];
    if (!builder) {
      return json({ code: 404, message: `未知路由 ${path}`, routes: Object.keys(ROUTES) }, { status: 404, env });
    }

    const data = await fetchUpstream(builder(url.searchParams), env);

    // 重试完还在风控里，别把 -462 那坨东西原样丢给前端
    // （前端拿到 {code:-462, data:{verifyType...}} 只会显示「没找到内容」，等于没说）
    if (isRiskControl(data)) {
      return json(
        {
          code: 502,
          message:
            '网易云风控拦截（-462）：自动重试了几次都没过。这是按出口 IP 临时标记的，' +
            '等一会儿再点通常就好了；如果一直这样，说明这个边缘节点被网易盯上了。',
          upstream: { code: data?.code, verifyUrl: data?.data?.verifyUrl },
        },
        { status: 502, env },
      );
    }

    return json(data, { env });
  } catch (err) {
    return json(
      { code: err?.status || 500, message: err?.message || String(err) },
      { status: err?.status && err.status >= 400 && err.status < 600 ? err.status : 500, env },
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
