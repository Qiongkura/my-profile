/**
 * 本地预览服务器 —— 静态文件 + 真·Pages Function。
 *
 * 为什么不用 `tools/serve.py`：那是纯静态服务，**不会执行 `functions/`**。
 * 所以在它上面打开 /netease/ 永远是「内置代理没响应，已退回离线识别」，
 * 你没法在本地看到真实效果，只能 push 上去才知道对不对。
 *
 * 这个脚本把 `functions/api/[[path]].js` 的 `onRequest` 直接挂进 HTTP 服务器，
 * 跟 Cloudflare 跑的是同一份代码、同一条路径（`/api/...`），
 * 所以本地看到的和线上是一致的。
 *
 *   node tools/serve-local.mjs              # 默认 8000
 *   node tools/serve-local.mjs 8080
 *   NETEASE_COOKIE="MUSIC_U=xxx" node tools/serve-local.mjs   # 带上会员 Cookie 试播放
 *
 * 然后打开 http://localhost:8000/netease/ 。
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8000);
const PAGES_FN = path.join(ROOT, 'functions', 'api', '[[path]].js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/** 环境变量就是 Pages 后台那个「Environment variables」，键名保持一致 */
const env = {
  NETEASE_COOKIE: process.env.NETEASE_COOKIE || '',
  ALLOW_ORIGIN: process.env.ALLOW_ORIGIN || '',
};

let onRequest;
try {
  ({ onRequest } = await import(pathToFileURL(PAGES_FN).href));
} catch (err) {
  console.error(`\n加载 Pages Function 失败：${PAGES_FN}\n${err.message}\n`);
  console.error('先跑一次 `node tools/sync-pages-proxy.mjs` 生成它。\n');
  process.exit(1);
}

/** 把 Node 的 IncomingMessage 转成 Web 标准 Request */
function toRequest(req) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(', '));
  }
  return new Request(url.toString(), { method: req.method, headers });
}

/** 把 Web 标准 Response 写回 Node 的 ServerResponse */
async function sendResponse(res, response) {
  const headers = {};
  for (const [k, v] of response.headers) headers[k] = v;
  res.writeHead(response.status, headers);
  if (!response.body) return res.end();
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** 静态文件，支持 Range（音频要能拖进度条） */
async function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';

  let file = path.join(ROOT, rel);
  // 别让 ../ 跑出仓库
  if (!path.resolve(file).startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  let stat = null;
  try {
    stat = await fsp.stat(file);
  } catch {
    /* 落到下面回首页 */
  }

  // 目录 → 找 index.html
  if (stat?.isDirectory()) {
    file = path.join(file, 'index.html');
    try {
      stat = await fsp.stat(file);
    } catch {
      stat = null;
    }
  }

  // 站点线上没配 404 页（不存在的路径会返回首页内容，HTTP 200），这里保持一致
  if (!stat) {
    file = path.join(ROOT, 'index.html');
    try {
      stat = await fsp.stat(file);
    } catch {
      res.writeHead(404).end('not found');
      return;
    }
  }

  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    'Accept-Ranges': 'bytes',
  };

  const range = req.headers.range;
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Number(m[2]) : stat.size - 1;
    if (start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
      return;
    }
    headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    headers['Content-Length'] = end - start + 1;
    res.writeHead(206, headers);
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }

  headers['Content-Length'] = stat.size;
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname;

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const started = Date.now();
    try {
      const response = await onRequest({ request: toRequest(req), env });
      await sendResponse(res, response);
      console.log(`  /api  ${String(response.status).padEnd(4)} ${pathname}${new URL(req.url, 'http://x').search}  ${Date.now() - started}ms`);
    } catch (err) {
      console.error('  /api  500', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(err?.stack || err));
    }
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n本地预览  http://localhost:${PORT}`);
  console.log(`  解析页  http://localhost:${PORT}/netease/`);
  console.log(`  代理    http://localhost:${PORT}/api/health`);
  console.log(`  Cookie  ${env.NETEASE_COOKIE ? '已配（能试播放）' : '没配（只有元数据和歌词）'}`);
  console.log('\nCtrl+C 退出。跟线上一样，静态走文件、/api 走真正的 Pages Function。\n');
});
