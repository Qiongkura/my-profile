"""发布前把 index.html 里 styles.css / script.js 的 ?v= 版本号加一。

浏览器会长期缓存 CSS 和 JS，改了内容但文件名不变时访客仍会看到旧样式，
所以每次发布前需要改版本号。脚本只在样式或脚本确实有改动时才加一。
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
WATCHED = ("styles.css", "script.js")


def changed_files() -> set[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    return {line[3:].strip() for line in result.stdout.splitlines() if line.strip()}


def main() -> int:
    force = "--force" in sys.argv
    text = INDEX.read_text(encoding="utf-8")
    match = re.search(r"styles\.css\?v=(\d+)", text)
    current = int(match.group(1)) if match else 0

    touched = [name for name in WATCHED if name in changed_files()]
    if force:
        touched = ["--force"]
    if not touched:
        print(f"样式与脚本没有改动，版本号保持 v={current}")
        return 0

    new_version = current + 1
    text = re.sub(r"(styles\.css\?v=)\d+", rf"\g<1>{new_version}", text)
    text = re.sub(r"(script\.js\?v=)\d+", rf"\g<1>{new_version}", text)
    INDEX.write_text(text, encoding="utf-8")
    print(f"检测到 {', '.join(touched)} 有改动，资源版本号升级为 v={new_version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
