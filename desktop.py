"""
Variety Engine - Desktop Launcher
Tahap 1:
- Menjalankan Flask di background
- Membuka UI Flask di window desktop menggunakan PyWebView
- Tidak membuka Chrome/Edge sebagai browser biasa
- Tidak mengubah app.py atau service yang sudah ada
"""

import socket
import threading
import time

import webview

from app import app


HOST = "127.0.0.1"


def get_free_port(host=HOST):
    """Mencari port lokal yang tersedia."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return sock.getsockname()[1]


def run_flask(port):
    """Menjalankan Flask tanpa debug/reloader."""
    app.run(
        host=HOST,
        port=port,
        debug=False,
        use_reloader=False,
        threaded=True,
    )


def wait_for_server(host, port, timeout=15):
    """Menunggu sampai Flask benar-benar siap menerima koneksi."""
    start = time.time()

    while time.time() - start < timeout:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.1)

    return False


def main():
    port = get_free_port()

    flask_thread = threading.Thread(
        target=run_flask,
        args=(port,),
        daemon=True,
    )
    flask_thread.start()

    if not wait_for_server(HOST, port):
        raise RuntimeError(
            "Variety Engine gagal memulai server internal Flask."
        )

    window = webview.create_window(
        "Variety Engine",
        f"http://{HOST}:{port}/",
        width=1400,
        height=900,
        min_size=(1000, 650),
        resizable=True,
        text_select=True,
    )

    webview.start()


if __name__ == "__main__":
    main()
