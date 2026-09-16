"""发布前把页面里 CSS / JS 的 ?v= 版本号加一。

浏览器会长期缓存 CSS 和 JS，改了内容但文件名不变时访客仍会看到旧样式，
所以每次发布前需要改版本号。脚本只在样式或脚本确实有改动时才加一。

管两个页面：
  index.html          主页（styles.css / script.js）
  netease/index.html  网易云解析页（styles.css / netease-music.js / netease-theme.css）
两个页面共用同一个版本号，styles.css 改动时一起刷新，不会出现一页新一页旧。
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = (ROOT / "index.html", ROOT / "netease" / "index.html")

# 只要这些文件有改动就升版本号（路径按 git status 的写法）
WATCHED = ("styles.css", "script.js", "assets/netease-music.js", "assets/netease-theme.css")

# 页面上真正要替换的 ?v= 目标
TARGETS = ("styles.css", "script.js", "netease-music.js", "netease-theme.css")


def changed_files() -> set[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    return {line[3:].strip() for line in result.stdout.splitlines() if line.strip()}


def bump(text: str, version: int) -> str:
    for name in TARGETS:
        text = re.sub(rf"({re.escape(name)}\?v=)\d+", rf"\g<1>{version}", text)
    return text


def main() -> int:
    force = "--force" in sys.argv
    pages = [path for path in PAGES if path.exists()]
    if not pages:
        print("找不到任何页面文件")
        return 1

    # 以主页的版本号为基准，保证两页一致
    primary = pages[0].read_text(encoding="utf-8")
    match = re.search(r"styles\.css\?v=(\d+)", primary)
    current = int(match.group(1)) if match else 0

    touched = [name for name in WATCHED if name in changed_files()]
    if force:
        touched = ["--force"]
    if not touched:
        print(f"样式与脚本没有改动，版本号保持 v={current}")
        return 0

    new_version = current + 1
    for path in pages:
        text = path.read_text(encoding="utf-8")
        updated = bump(text, new_version)
        if updated != text:
            path.write_text(updated, encoding="utf-8")

    print(f"检测到 {', '.join(touched)} 有改动，资源版本号升级为 v={new_version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
