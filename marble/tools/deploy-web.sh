#!/bin/bash
# 弹弹珠吧 网页版一键部署 → 阿里云 ECS(47.107.188.59)
# 只上传有差异的文件(服务器按流量计费),上传后自动验证线上指纹。
# 用法: 在 Git Bash 里执行  bash marble/tools/deploy-web.sh
set -e

HOST=root@47.107.188.59
REMOTE_DIR=/www/wwwroot/marble-machine
SRC="$(cd "$(dirname "$0")/.." && pwd)"          # marble/ 目录
STAGE=$(mktemp -d)
TMPF=/tmp/_mg_deploy_$$.txt

cleanup() { rm -rf "$STAGE" "$TMPF" "${TMPF}_local" "${TMPF}_remote"; }
trap cleanup EXIT

# 1. 组装暂存目录(不含 wav 母带,线上只用 m4a/ogg)
mkdir -p "$STAGE/assets/bgm"
cp "$SRC/index.html" "$STAGE/"
cp -r "$SRC/src" "$STAGE/src"
cp "$SRC"/assets/bgm/*.m4a "$SRC"/assets/bgm/*.ogg "$STAGE/assets/bgm/" 2>/dev/null || true
cp -r "$SRC/assets/sounds" "$SRC/assets/logo" "$STAGE/assets/"

# 2. 与线上逐文件比对 md5
cd "$STAGE"
find . -type f | sed 's|^\./||' | sort > "$TMPF"
md5sum $(cat "$TMPF") | awk '{sub(/^\*/,"",$2); print $2, $1}' | sort > "${TMPF}_local"
scp -q -o BatchMode=yes "$TMPF" "$HOST:/tmp/_mg_files.txt"
ssh -o BatchMode=yes "$HOST" "cd $REMOTE_DIR && md5sum \$(cat /tmp/_mg_files.txt) 2>/dev/null | awk '{print \$2, \$1}' | sort" > "${TMPF}_remote"

CHANGED=$(join "${TMPF}_local" "${TMPF}_remote" 2>/dev/null | awk '$2 != $3 {print $1}')
MISSING=$(comm -23 <(awk '{print $1}' "${TMPF}_local") <(awk '{print $1}' "${TMPF}_remote"))

# 3. 上传差异文件
TOTAL=$(echo $CHANGED $MISSING | tr -s ' ' '\n' | grep -c . || true)
if [ "$TOTAL" = "0" ] || [ -z "$TOTAL" ]; then
  echo "✓ 线上已是最新,无需上传"
else
  echo "↑ 上传 $TOTAL 个变更文件:"
  for f in $CHANGED $MISSING; do
    ssh -o BatchMode=yes "$HOST" "mkdir -p $REMOTE_DIR/$(dirname "$f")"
    scp -q -o BatchMode=yes "$STAGE/$f" "$HOST:$REMOTE_DIR/$f"
    echo "    $f"
  done
fi

# 4. 通过 nginx 验证线上真的是新代码(主循环加固注释 = 修复指纹)
if ssh -o BatchMode=yes "$HOST" "curl -s http://127.0.0.1/marble/src/game/marble-game.js -H 'Host: qiongkura.xyz' | grep -q '先排下一帧再画本帧'"; then
  echo "✓ 线上验证通过 → http://47.107.188.59/marble/"
else
  echo "✗ 线上验证失败,检查 nginx 与文件权限"
  exit 1
fi
