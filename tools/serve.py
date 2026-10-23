"""개발용 로컬 서버: 브라우저가 예전 파일을 캐시에서 쓰지 않도록 no-store 헤더를 붙입니다.

사용법 (프로젝트 폴더에서):  python3 tools/serve.py [포트]
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
