/**
 * 增量同步站点静态文件到阿里云 ECS (Nginx)。
 *
 * 读取根目录 .env（已被 .gitignore 忽略，不进公开 Git 仓库）：
 *   DEPLOY_HOST=root@...
 *   DEPLOY_SITE_DIR=/www/wwwroot/my-profile
 *   DEPLOY_MARBLE_DIR=/www/wwwroot/marble-machine
 *
 * 原理：
 *   1. 计算本地可发布白名单文件的 MD5（自动跳过 .git / .env / .tmp / netease / tools 等）
 *   2. 单次 SSH 拉取远端对应目录现有文件的 MD5
 *   3. 仅将新增或变更的文件打包通过单条 SSH tar 流上传并设置 www:www 权限，不动 .well-known
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDotEnv(path.join(ROOT, '.env'));

const HOST = process.env.DEPLOY_HOST;
const SITE_DIR = process.env.DEPLOY_SITE_DIR || '/www/wwwroot/my-profile';
const MARBLE_DIR = process.env.DEPLOY_MARBLE_DIR || '/www/wwwroot/marble-machine';

if (!HOST) {
  console.error('未配置 DEPLOY_HOST（请在项目根目录 .env 中设置 DEPLOY_HOST=user@ip）');
  process.exit(1);
}

function md5File(fp) {
  return crypto.createHash('md5').update(fs.readFileSync(fp)).digest('hex');
}

function walkFiles(dir, prefix = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full, rel));
    else if (ent.isFile()) out.push(rel);
  }
  return out;
}

/** 收集主站允许对外分发的静态文件（相对 ROOT） */
function collectSiteFiles() {
  const topFiles = [
    'index.html',
    '404.html',
    'hidden.html',
    'robots.txt',
    'styles.css',
    'script.js',
    'a1a2376d0e4961fe96a7394f897609a5.txt',
  ].filter((f) => fs.existsSync(path.join(ROOT, f)));

  const fonts = walkFiles(path.join(ROOT, 'fonts'), 'fonts').filter((f) =>
    /^fonts\/(inter|noto)-(400|600)\.woff2$/i.test(f),
  );

  const assets = walkFiles(path.join(ROOT, 'assets'), 'assets').filter(
    (f) => !/^assets\/netease-/i.test(f),
  );

  const portfolio = [
    ...(fs.existsSync(path.join(ROOT, 'portfolio', 'index.html')) ? ['portfolio/index.html'] : []),
    ...walkFiles(path.join(ROOT, 'portfolio', 'assets'), 'portfolio/assets').filter((f) =>
      /\.(webp)$/i.test(f) && !/my-profile\.webp$/i.test(f),
    ),
  ];

  return [...topFiles, ...fonts, ...assets, ...portfolio];
}

/** 收集弹珠游戏网页端精简文件（相对 ROOT/marble） */
function collectMarbleFiles() {
  const mRoot = path.join(ROOT, 'marble');
  if (!fs.existsSync(mRoot)) return [];
  const list = [];
  if (fs.existsSync(path.join(mRoot, 'index.html'))) list.push('index.html');
  list.push(...walkFiles(path.join(mRoot, 'src'), 'src').filter((f) => f.endsWith('.js')));
  if (fs.existsSync(path.join(mRoot, 'assets', 'logo', 'cadpa-8.png'))) {
    list.push('assets/logo/cadpa-8.png');
  }
  list.push(
    ...walkFiles(path.join(mRoot, 'assets', 'bgm'), 'assets/bgm').filter((f) =>
      /\.(m4a|ogg)$/i.test(f),
    ),
  );
  return list;
}

function getRemoteHashes(remoteDir) {
  const cmd = `if [ -d '${remoteDir}' ]; then cd '${remoteDir}' && find . -maxdepth 4 -type f -not -path './.well-known*' | sed 's|^\\./||' | xargs -r md5sum; fi`;
  const out = execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', HOST, cmd], {
    encoding: 'utf8',
  });
  const map = new Map();
  for (const line of out.split(/\r?\n/)) {
    const m = /^([0-9a-f]{32})\s+\*?(.+)$/i.exec(line.trim());
    if (m) map.set(m[2], m[1].toLowerCase());
  }
  return map;
}

function syncGroup(label, baseLocalDir, files, remoteDir) {
  const remote = getRemoteHashes(remoteDir);
  const changed = files.filter((rel) => md5File(path.join(baseLocalDir, rel)) !== remote.get(rel));

  if (changed.length === 0) {
    console.log(`✓ [${label}] 远端已是最新（共 ${files.length} 个文件）`);
    return 0;
  }

  console.log(`↑ [${label}] 同步 ${changed.length} 个变更文件 → ${HOST}:${remoteDir}`);
  for (const f of changed) console.log(`    ${f}`);

  const tmpTar = path.join(os.tmpdir(), `qk-deploy-${Date.now()}-${Math.random().toString(16).slice(2)}.tar.gz`);
  const listFile = `${tmpTar}.list`;
  try {
    fs.writeFileSync(listFile, changed.join('\n') + '\n', 'utf8');
    execFileSync('tar', ['-czf', tmpTar, '-C', baseLocalDir, '-T', listFile]);
    const tarBytes = fs.readFileSync(tmpTar);
    const res = spawnSync(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=15',
        HOST,
        `mkdir -p '${remoteDir}' && tar -xzf - -C '${remoteDir}' && chown -R www:www '${remoteDir}'`,
      ],
      { input: tarBytes, encoding: 'utf8' },
    );
    if (res.status !== 0) {
      throw new Error(res.stderr || `ssh tar 退出码 ${res.status}`);
    }
  } finally {
    try { fs.unlinkSync(tmpTar); } catch {}
    try { fs.unlinkSync(listFile); } catch {}
  }
  return changed.length;
}

const siteChanged = syncGroup('my-profile', ROOT, collectSiteFiles(), SITE_DIR);
const marbleChanged = syncGroup('marble', path.join(ROOT, 'marble'), collectMarbleFiles(), MARBLE_DIR);
console.log(`完成：共同步 ${siteChanged + marbleChanged} 个变更文件。`);
