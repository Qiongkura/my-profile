# -*- coding: utf-8 -*-
"""本地开发服务器:禁用缓存,改代码刷新即生效。
运行: python tools/devserver.py [端口]
默认端口 8377。Ctrl+C 停止。
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8377


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 安静模式


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
        print('开发服务器:http://127.0.0.1:%d/ (无缓存)' % PORT)
        httpd.serve_forever()
