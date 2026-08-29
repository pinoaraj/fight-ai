from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _send(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            self._send({'asyncJobs': False})
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != '/analyze':
            self.send_error(404)
            return
        length = int(self.headers.get('content-length', '0'))
        if length:
            self.rfile.read(length)
        self._send({'report': {
            'mainTakeaway': 'Mock backend contract OK',
            'strengths': [{'title': 'Jab', 'description': 'Visible', 'timestamps': [2]}],
            'weaknesses': [{'title': 'Guardia', 'description': 'Recuperar mano', 'recommendation': 'Volver a mejilla', 'timestamps': [4]}],
            'drills': [{'name': 'Jab-reset', 'duration': '2 min', 'goal': 'Recuperación'}],
            'nextSessionGoals': ['Salir con guardia'],
            'strategy': {'opponentAnalysis': {'observedOpponentPatterns': [], 'tacticalHypotheses': [], 'rematchPlan': ['Jab y salida']}},
            'realVision': {'videoAI': {'usedInReport': False}}
        }})

HTTPServer(('127.0.0.1', 8787), Handler).serve_forever()
