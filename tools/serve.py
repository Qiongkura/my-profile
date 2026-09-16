"""本地预览用的静态服务器，比 `python -m http.server` 多支持 HTTP Range。

音频/视频只有在服务器返回 Accept-Ranges 并能按 Range 响应时才能拖动进度条。
标准库的 http.server 不支持，于是本地预览 HI-FI 播放器时进度条会拖不动
（线上 Cloudflare / GitHub Pages 都支持，不受影响）。

    python tools/serve.py            # 默认 8000
    python tools/serve.py 8080

然后打开 http://localhost:8000 。
"""
from __future__ import annotations

import http.server
import io
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        try:
            with open(path, "rb") as handle:
                data = handle.read()
        except OSError:
            self.send_error(404, "File not found")
            return None

        size = len(data)
        start, end, status = 0, size - 1, 200

        header = self.headers.get("Range")
        match = RANGE_RE.fullmatch(header.strip()) if header else None
        if match and (match.group(1) or match.group(2)):
            if match.group(1) == "":
                start = max(0, size - int(match.group(2)))
            else:
                start = int(match.group(1))
                if match.group(2):
                    end = min(int(match.group(2)), size - 1)
            if start >= size or start > end:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return None
            status = 206

        body = data[start : end + 1]
        self.send_response(status)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Accept-Ranges", "bytes")
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        return io.BytesIO(body)


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = lambda *args, **kwargs: RangeHandler(*args, directory=str(ROOT), **kwargs)  # noqa: E731
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"serving {ROOT} at http://localhost:{port}  (Ctrl+C 结束)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止")
    return 0


if __name__ == "__main__":
    sys.exit(main())
