"""发布前把页面里 CSS / JS 的 ?v= 版本号加一。

浏览器会长期缓存 CSS 和 JS，改了内容但文件名不变时访客仍会看到旧样式，
所以每次发布前需要改版本号。脚本只在样式或脚本确实有改动时才加一。

覆盖全部引用 styles.css / script.js / netease-* 的页面，保持全局版本号一致。
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = (
    ROOT / "index.html",
    ROOT / "hidden.html",
    ROOT / "404.html",
    ROOT / "netease" / "index.html",
)

WATCHED = ("styles.css", "script.js", "assets/netease-music.js", "assets/netease-theme.css")
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


def current_version(pages: list[Path]) -> int:
    highest = 0
    for path in pages:
        text = path.read_text(encoding="utf-8")
        for name in TARGETS:
            for match in re.finditer(rf"{re.escape(name)}\?v=(\d+)", text):
                highest = max(highest, int(match.group(1)))
    return highest


def main() -> int:
    force = "--force" in sys.argv
    pages = [path for path in PAGES if path.exists()]
    if not pages:
        print("找不到任何页面文件")
        return 1

    current = current_version(pages)

    touched = [name for name in WATCHED if name in changed_files()]
    if force:
        touched = ["--force"]
    if not touched:
        # 即使不加一，也把所有页面对齐到当前最高版本号，消除跨页版本漂移
        for path in pages:
            text = path.read_text(encoding="utf-8")
            updated = bump(text, current)
            if updated != text:
                path.write_text(updated, encoding="utf-8")
        print(f"样式与脚本没有新改动，版本号对齐保持 v={current}")
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
