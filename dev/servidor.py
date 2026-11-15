"""Servidor de desarrollo de Enzo: igual que http.server, pero sin caché,
para que el navegador siempre cargue la versión más reciente de los archivos.
Uso: python3 dev/servidor.py [puerto]"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 4200
    ThreadingHTTPServer(("127.0.0.1", puerto), partial(SinCache, directory=RAIZ)).serve_forever()
