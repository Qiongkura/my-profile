/**
 * 把 netease-music-parser 的代理核心同步成 Cloudflare Pages Function。
 *
 *   node tools/sync-pages-proxy.mjs           # 生成 / 更新
 *   node tools/sync-pages-proxy.mjs --check   # 只检查有没有漂移，不写文件
 *
 * 为什么是「整份内联」而不是 import：
 *   Pages Functions 按 functions/ 下的文件路径生成路由，
 *   目录里任何不导出处理函数的 .js 都可能让构建失败 —— 构建失败就整个站点发不出去。
 *   所以共享代码不能以模块形式放在 functions/ 里，只能内联进这一个文件。
 *
 * 源文件改了之后记得重跑一次，否则线上跑的还是旧逻辑。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const PARSER_DIR = process.env.NETEASE_PARSER_DIR
  ? path.resolve(process.env.NETEASE_PARSER_DIR)
  : path.resolve(ROOT, '..', 'netease-music-parser');

const SOURCE = path.join(PARSER_DIR, 'proxy', 'handler.js');
const TARGET = path.join(ROOT, 'functions', 'api', '[[path]].js');

if (!existsSync(SOURCE)) {
  console.error(`找不到源文件：${SOURCE}`);
  console.error('如果 netease-music-parser 不在 my-profile 旁边，用 NETEASE_PARSER_DIR 指定它的路径。');
  process.exit(1);
}

const raw = readFileSync(SOURCE, 'utf8');

// 去掉 default 导出：Pages Functions 靠 onRequest / onRequestGet 这类具名导出工作，
// 同时留一个 default 会让入口变得含糊。
const body = raw
  .replace(/^export default \{[\s\S]*?\};\s*$/m, '')
  .trimEnd();

const generated = `/* 自动生成，不要手改。
 *
 * 源文件：${path.relative(ROOT, SOURCE).replace(/\\/g, '/')}
 * 同步命令：node tools/sync-pages-proxy.mjs
 *
 * 这份文件就是整个代理。Pages 会在 /api/* 上调用下面的 onRequest，
 * 剥掉 /api 前缀之后交给和独立 Worker 完全一样的那份 handler。
 *
 * 为什么整份内联而不是 import：见 tools/sync-pages-proxy.mjs 的注释。
 */

${body}

/**
 * Pages Function 入口。
 * 请求 /api/song?id=1 -> 剥掉 /api -> 交给 handleRequest 处理 /song?id=1
 */
export const onRequest = (context) => {
  const url = new URL(context.request.url);
  const stripped = url.pathname.replace(/^\\/api(?=\\/|$)/, '') || '/';
  url.pathname = stripped;
  return handleRequest(new Request(url.toString(), context.request), context.env || {});
};
`;

if (CHECK) {
  const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
  if (current === generated) {
    console.log('Pages Function 与源文件一致');
    process.exit(0);
  }
  console.error('Pages Function 和源文件不一致，跑一次 node tools/sync-pages-proxy.mjs 同步');
  process.exit(1);
}

mkdirSync(path.dirname(TARGET), { recursive: true });
writeFileSync(TARGET, generated, 'utf8');
// 用 byteLength 而不是 .length —— 后者数的是 UTF-16 码元，中文会少算。
// 这个数字是用来跟线上 curl 回来的字节数对照的，必须是真的字节数。
console.log(`已生成 ${path.relative(ROOT, TARGET)}（${Buffer.byteLength(generated, 'utf8')} 字节）`);
