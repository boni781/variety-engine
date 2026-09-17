import socket
import threading
import time
import webview
import os
import sys
import json
import tempfile
import urllib.request
import urllib.error
import subprocess
import tkinter as tk
from tkinter import ttk
from pathlib import Path

from app import app


# ============================================================
# CONFIG
# ============================================================

HOST = "127.0.0.1"

GITHUB_OWNER = "boni781"
GITHUB_REPO = "variety-engine"

APP_EXE = "VarietyEngine.exe"
UPDATER_EXE = "VarietyEngineUpdater.exe"

APP_NAME = "Variety Engine"


# ============================================================
# DEBUG LOG
# ============================================================

def get_debug_log_path():
    """
    Log diagnostik disimpan di:
    %LOCALAPPDATA%\\Variety Engine\\update_debug.log
    """

    local_app_data = os.environ.get("LOCALAPPDATA")

    if local_app_data:
        log_dir = Path(local_app_data) / APP_NAME
    else:
        log_dir = Path.home() / APP_NAME

    log_dir.mkdir(parents=True, exist_ok=True)

    return log_dir / "update_debug.log"


DEBUG_LOG = get_debug_log_path()


def debug_log(message):
    """
    Menulis log diagnostik tanpa mengganggu aplikasi.
    """

    try:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

        with open(DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")

    except Exception:
        pass


def clear_debug_log():
    """
    Membuat log baru setiap kali aplikasi dijalankan.
    """

    try:
        DEBUG_LOG.parent.mkdir(parents=True, exist_ok=True)

        with open(DEBUG_LOG, "w", encoding="utf-8") as f:
            f.write("============================================================\n")
            f.write("VARIETY ENGINE UPDATE DEBUG LOG\n")
            f.write("============================================================\n")

    except Exception:
        pass


# ============================================================
# PATH
# ============================================================

def get_app_dir():

    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent

    return Path(__file__).resolve().parent


def get_install_root():

    app_dir = get_app_dir()

    return app_dir.parent

def get_updater_path():
    if not getattr(sys, "frozen", False):
        return Path(__file__).resolve().parent / "dist" / UPDATER_EXE

    exe_dir = Path(sys.executable).resolve().parent

    # Jika dijalankan dari dist saat development
    if exe_dir.name.lower() == "dist":
        return exe_dir / UPDATER_EXE

    # Instalasi utama:
    # Variety Engine\
    # ├── VarietyEngineUpdater.exe
    # └── VarietyEngine\
    #     └── VarietyEngine.exe
    return exe_dir.parent / UPDATER_EXE
# ============================================================
# FLASK
# ============================================================

def get_free_port(host=HOST):

    with socket.socket() as sock:

        sock.bind((host, 0))

        return sock.getsockname()[1]


def run_flask(port):

    debug_log(f"Flask starting on {HOST}:{port}")

    app.run(
        host=HOST,
        port=port,
        debug=False,
        use_reloader=False,
        threaded=True,
    )


def wait_for_server(host, port, timeout=15):

    start = time.time()

    while time.time() - start < timeout:

        try:

            with socket.create_connection(
                (host, port),
                timeout=0.5
            ):

                debug_log("Flask server berhasil dijalankan.")

                return True

        except OSError:

            time.sleep(0.1)

    debug_log("ERROR: Flask server gagal dijalankan.")

    return False


# ============================================================
# VERSION
# ============================================================

def version_tuple(version):

    try:

        version = str(version).strip()

        if version.lower().startswith("v"):
            version = version[1:]

        return tuple(
            int(x)
            for x in version.split(".")
        )

    except Exception:

        return (0,)


def get_local_version():

    app_dir = get_app_dir()

    version_file = app_dir / "version.json"

    debug_log(f"Mencari version.json: {version_file}")

    if not version_file.exists():

        debug_log("ERROR: version.json tidak ditemukan.")

        return "0.0.0"

    try:

        with open(
            version_file,
            "r",
            encoding="utf-8-sig"
        ) as f:

            data = json.load(f)

        version = str(
            data.get("version", "0.0.0")
        ).strip()

        debug_log(
            f"Versi lokal terbaca: {version}"
        )

        return version

    except Exception as e:

        debug_log(
            f"ERROR membaca version.json: {repr(e)}"
        )

        return "0.0.0"


# ============================================================
# GITHUB
# ============================================================

def check_latest_version():

    url = (
        f"https://api.github.com/repos/"
        f"{GITHUB_OWNER}/"
        f"{GITHUB_REPO}/releases/latest"
    )

    debug_log(
        f"Mengecek GitHub release: {url}"
    )

    try:

        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "VarietyEngine-Updater"
            },
        )

        with urllib.request.urlopen(
            request,
            timeout=10
        ) as response:

            raw_data = response.read()

        data = json.loads(
            raw_data.decode("utf-8")
        )

        tag_name = str(
            data.get("tag_name", "")
        ).strip()

        debug_log(
            f"GitHub release tag: {tag_name}"
        )

        if not tag_name:

            debug_log(
                "ERROR: GitHub tidak memberikan tag_name."
            )

            return {
                "success": False,
                "version": "",
                "data": data,
            }

        return {
            "success": True,
            "version": tag_name,
            "data": data,
        }

    except urllib.error.HTTPError as e:

        debug_log(
            f"GitHub HTTPError: {e.code} {e.reason}"
        )

        return {
            "success": False,
            "version": "",
            "data": None,
        }

    except urllib.error.URLError as e:

        debug_log(
            f"GitHub URLError: {repr(e)}"
        )

        return {
            "success": False,
            "version": "",
            "data": None,
        }

    except Exception as e:

        debug_log(
            f"GitHub check ERROR: {repr(e)}"
        )

        return {
            "success": False,
            "version": "",
            "data": None,
        }


# ============================================================
# FIND UPDATE ASSET
# ============================================================

def find_update_asset(release_data, latest_version):

    if not release_data:

        debug_log(
            "ERROR: release_data kosong."
        )

        return None

    assets = release_data.get(
        "assets",
        []
    )

    debug_log(
        f"Jumlah asset release: {len(assets)}"
    )

    expected_name = (
        f"VarietyEngine-{latest_version}.zip"
    )

    expected_name_without_v = (
        f"VarietyEngine-{str(latest_version).lstrip('v')}.zip"
    )

    debug_log(
        f"Mencari asset: {expected_name}"
    )

    # --------------------------------------------------------
    # EXACT MATCH
    # --------------------------------------------------------

    for asset in assets:

        name = str(
            asset.get("name", "")
        )

        debug_log(
            f"Asset ditemukan: {name}"
        )

        if name == expected_name:

            url = asset.get(
                "browser_download_url"
            )

            debug_log(
                f"Asset exact match ditemukan: {url}"
            )

            return {
                "name": name,
                "url": url,
            }

        if name == expected_name_without_v:

            url = asset.get(
                "browser_download_url"
            )

            debug_log(
                f"Asset match tanpa v ditemukan: {url}"
            )

            return {
                "name": name,
                "url": url,
            }

    # --------------------------------------------------------
    # FALLBACK ZIP
    # --------------------------------------------------------

    for asset in assets:

        name = str(
            asset.get("name", "")
        )

        if name.lower().endswith(".zip"):

            url = asset.get(
                "browser_download_url"
            )

            debug_log(
                f"Fallback ZIP ditemukan: {name}"
            )

            return {
                "name": name,
                "url": url,
            }

    debug_log(
        "ERROR: Tidak ada asset ZIP ditemukan."
    )

    return None


# ============================================================
# UPDATE WINDOW
# ============================================================

class UpdateWindow:

    def __init__(
        self,
        local_version,
        latest_version
    ):

        self.root = tk.Tk()

        self.root.title(
            "Variety Engine Update"
        )

        self.root.geometry(
            "560x300"
        )

        self.root.resizable(
            False,
            False
        )

        self.root.protocol(
            "WM_DELETE_WINDOW",
            lambda: None
        )

        # ----------------------------------------------------
        # HEADER
        # ----------------------------------------------------

        header = tk.Frame(
            self.root,
            bg="#172033",
            height=80
        )

        header.pack(
            fill="x"
        )

        header.pack_propagate(
            False
        )

        tk.Label(
            header,
            text="Variety Engine",
            font=("Segoe UI", 18, "bold"),
            fg="white",
            bg="#172033"
        ).pack(
            pady=(12, 0)
        )

        tk.Label(
            header,
            text="Update",
            font=("Segoe UI", 10),
            fg="#cbd5e1",
            bg="#172033"
        ).pack()

        # ----------------------------------------------------
        # BODY
        # ----------------------------------------------------

        body = tk.Frame(
            self.root,
            padx=30,
            pady=20
        )

        body.pack(
            fill="both",
            expand=True
        )

        self.title_label = tk.Label(
            body,
            text=(
                f"Update tersedia: "
                f"{local_version} → {latest_version}"
            ),
            font=("Segoe UI", 12, "bold")
        )

        self.title_label.pack(
            pady=(0, 15)
        )

        self.status_var = tk.StringVar(
            value="Menyiapkan update..."
        )

        tk.Label(
            body,
            textvariable=self.status_var,
            font=("Segoe UI", 10)
        ).pack(
            anchor="w"
        )

        self.progress = ttk.Progressbar(
            body,
            orient="horizontal",
            mode="determinate",
            length=500,
            maximum=100
        )

        self.progress.pack(
            pady=12
        )

        self.detail_var = tk.StringVar(
            value=""
        )

        tk.Label(
            body,
            textvariable=self.detail_var,
            font=("Segoe UI", 9)
        ).pack(
            anchor="w"
        )

    def update(
        self,
        status=None,
        progress=None,
        detail=None
    ):

        try:

            if status is not None:

                self.status_var.set(
                    status
                )

            if progress is not None:

                self.progress["value"] = (
                    progress
                )

            if detail is not None:

                self.detail_var.set(
                    detail
                )

            self.root.update_idletasks()

        except Exception:

            pass

    def close(self):

        try:

            self.root.destroy()

        except Exception:

            pass

    def run(self):

        self.root.mainloop()


# ============================================================
# DOWNLOAD UPDATE
# ============================================================

def download_update(
    url,
    destination,
    update_window
):

    debug_log(
        f"Memulai download update: {url}"
    )

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "VarietyEngine-Updater"
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=30
    ) as response:

        total_size = response.headers.get(
            "Content-Length"
        )

        if total_size:

            total_size = int(
                total_size
            )

        else:

            total_size = 0

        debug_log(
            f"Ukuran download: {total_size} bytes"
        )

        downloaded = 0

        chunk_size = 1024 * 1024

        with open(
            destination,
            "wb"
        ) as f:

            while True:

                chunk = response.read(
                    chunk_size
                )

                if not chunk:
                    break

                f.write(chunk)

                downloaded += len(chunk)

                if total_size:

                    percent = (
                        downloaded
                        / total_size
                        * 100
                    )

                    downloaded_mb = (
                        downloaded
                        / 1024
                        / 1024
                    )

                    total_mb = (
                        total_size
                        / 1024
                        / 1024
                    )

                    update_window.root.after(
                        0,
                        update_window.update,
                        "Mengunduh update...",
                        percent,
                        (
                            f"{downloaded_mb:.1f} MB "
                            f"/ {total_mb:.1f} MB"
                        )
                    )

                else:

                    downloaded_mb = (
                        downloaded
                        / 1024
                        / 1024
                    )

                    update_window.root.after(
                        0,
                        update_window.update,
                        "Mengunduh update...",
                        None,
                        (
                            f"{downloaded_mb:.1f} MB"
                        )
                    )

    debug_log(
        f"Download selesai: {destination}"
    )


# ============================================================
# START UPDATE
# ============================================================

def start_update():

    debug_log(
        "------------------------------------------------------------"
    )

    debug_log(
        "START UPDATE CHECK"
    )

    # --------------------------------------------------------
    # 1. CHECK FROZEN
    # --------------------------------------------------------

    frozen = getattr(
        sys,
        "frozen",
        False
    )

    debug_log(
        f"sys.frozen = {frozen}"
    )

    if not frozen:

        debug_log(
            "UPDATE DILEWATI: aplikasi berjalan dari Python."
        )

        return False

    # --------------------------------------------------------
    # 2. APP PATH
    # --------------------------------------------------------

    app_dir = get_app_dir()

    install_root = get_install_root()

    updater_path = get_updater_path()

    app_exe = app_dir / APP_EXE

    debug_log(
        f"app_dir = {app_dir}"
    )

    debug_log(
        f"install_root = {install_root}"
    )

    debug_log(
        f"app_exe = {app_exe}"
    )

    debug_log(
        f"updater_path = {updater_path}"
    )

    # --------------------------------------------------------
    # 3. CHECK APP EXE
    # --------------------------------------------------------

    if not app_exe.exists():

        debug_log(
            "UPDATE DILEWATI: VarietyEngine.exe tidak ditemukan."
        )

        return False

    debug_log(
        "OK: VarietyEngine.exe ditemukan."
    )

    # --------------------------------------------------------
    # 4. CHECK UPDATER
    # --------------------------------------------------------

    if not updater_path.exists():

        debug_log(
            "UPDATE DILEWATI: VarietyEngineUpdater.exe tidak ditemukan."
        )

        return False

    debug_log(
        "OK: VarietyEngineUpdater.exe ditemukan."
    )

    # --------------------------------------------------------
    # 5. LOCAL VERSION
    # --------------------------------------------------------

    local_version = get_local_version()

    debug_log(
        f"LOCAL VERSION = {local_version}"
    )

    # --------------------------------------------------------
    # 6. GITHUB CHECK
    # --------------------------------------------------------

    release_info = check_latest_version()

    if not release_info.get("success"):

        debug_log(
            "UPDATE DILEWATI: gagal mendapatkan release GitHub."
        )

        return False

    latest_version = release_info.get(
        "version",
        ""
    )

    release_data = release_info.get(
        "data"
    )

    debug_log(
        f"LATEST VERSION = {latest_version}"
    )

    # --------------------------------------------------------
    # 7. VERSION COMPARE
    # --------------------------------------------------------

    local_tuple = version_tuple(
        local_version
    )

    latest_tuple = version_tuple(
        latest_version
    )

    debug_log(
        f"LOCAL TUPLE = {local_tuple}"
    )

    debug_log(
        f"LATEST TUPLE = {latest_tuple}"
    )

    if latest_tuple <= local_tuple:

        debug_log(
            "UPDATE DILEWATI: tidak ada versi baru."
        )

        return False

    debug_log(
        "VERSI BARU TERSEDIA."
    )

    # --------------------------------------------------------
    # 8. FIND ZIP
    # --------------------------------------------------------

    asset = find_update_asset(
        release_data,
        latest_version
    )

    if not asset:

        debug_log(
            "UPDATE DILEWATI: asset ZIP tidak ditemukan."
        )

        return False

    asset_url = asset.get(
        "url"
    )

    asset_name = asset.get(
        "name"
    )

    debug_log(
        f"UPDATE ASSET = {asset_name}"
    )

    debug_log(
        f"UPDATE URL = {asset_url}"
    )

    # --------------------------------------------------------
    # 9. CREATE UPDATE WINDOW
    # --------------------------------------------------------

    debug_log(
        "Semua pemeriksaan berhasil."
    )

    debug_log(
        "Membuka UpdateWindow."
    )

    update_window = UpdateWindow(
        local_version,
        latest_version
    )

    result_data = {
        "success": False
    }

    # --------------------------------------------------------
    # 10. DOWNLOAD WORKER
    # --------------------------------------------------------

    def worker():

        try:

            update_window.root.after(
                0,
                update_window.update,
                "Menyiapkan download...",
                0,
                ""
            )

            temp_dir = Path(
                tempfile.gettempdir()
            )

            zip_path = (
                temp_dir
                / f"VarietyEngine-update-{latest_version}.zip"
            )

            debug_log(
                f"ZIP temporary = {zip_path}"
            )

            download_update(
                asset_url,
                zip_path,
                update_window
            )

            # ------------------------------------------------
            # 11. RUN UPDATER
            # ------------------------------------------------

            debug_log(
                "Download berhasil."
            )

            debug_log(
                "Menjalankan VarietyEngineUpdater.exe."
            )

            update_window.root.after(
                0,
                update_window.update,
                "Memasang update...",
                100,
                "Menjalankan updater..."
            )
            
            command = [
                str(updater_path),
                "--zip",
                str(zip_path),
                "--target",
                str(app_dir),
                "--pid",
                str(os.getppid()),
                "--version",
                str(latest_version),
                "--restart",
            ]

            debug_log(
                f"COMMAND UPDATER = {command}"
            )

            creation_flags = 0

            if os.name == "nt":

                creation_flags = (
                    subprocess.CREATE_NO_WINDOW
                    | subprocess.DETACHED_PROCESS
                    | subprocess.CREATE_NEW_PROCESS_GROUP
                )

            process = subprocess.Popen(
                command,
                cwd=str(install_root),
                creationflags=creation_flags,
                close_fds=True,
            )

            debug_log(
                f"Updater berhasil dijalankan. PID updater = {process.pid}"
            )

            result_data["success"] = True

            update_window.root.after(
                0,
                update_window.update,
                "Update sedang dipasang...",
                100,
                "Aplikasi akan dibuka kembali."
            )

            time.sleep(1)

            update_window.root.after(
                0,
                update_window.close
            )

        except Exception as e:

            debug_log(
                "UPDATE ERROR:"
            )

            debug_log(
                repr(e)
            )

            import traceback

            debug_log(
                traceback.format_exc()
            )

            result_data["success"] = False

            update_window.root.after(
                0,
                update_window.update,
                "Update gagal.",
                0,
                f"{type(e).__name__}: {e}"
            )

    # --------------------------------------------------------
    # 12. START WORKER
    # --------------------------------------------------------

    debug_log(
        "Memulai thread download."
    )

    threading.Thread(
        target=worker,
        daemon=True
    ).start()

    # --------------------------------------------------------
    # 13. RUN WINDOW
    # --------------------------------------------------------

    update_window.run()

    debug_log(
        f"Update window selesai. success={result_data['success']}"
    )

    return result_data["success"]


# ============================================================
# MAIN
# ============================================================

def main():

    clear_debug_log()

    debug_log(
        "============================================================"
    )

    debug_log(
        "VARIETY ENGINE START"
    )

    debug_log(
        f"Python executable = {sys.executable}"
    )

    debug_log(
        f"Current directory = {os.getcwd()}"
    )

    debug_log(
        f"Frozen = {getattr(sys, 'frozen', False)}"
    )

    # ========================================================
    # UPDATE CHECK
    # ========================================================

    if getattr(sys, "frozen", False):

        try:

            updated = start_update()

            debug_log(
                f"start_update() returned: {updated}"
            )

            if updated:

                debug_log(
                    "Update berhasil dijalankan."
                )

                debug_log(
                    "Menutup proses aplikasi lama."
                )

                os._exit(0)

        except Exception as e:

            debug_log(
                "FATAL ERROR pada start_update():"
            )

            debug_log(
                repr(e)
            )

            import traceback

            debug_log(
                traceback.format_exc()
            )

    # ========================================================
    # START FLASK
    # ========================================================

    debug_log(
        "Melanjutkan ke Flask/PyWebView."
    )

    port = get_free_port()

    debug_log(
        f"Port Flask = {port}"
    )

    flask_thread = threading.Thread(
        target=run_flask,
        args=(port,),
        daemon=True
    )

    flask_thread.start()

    if not wait_for_server(
        HOST,
        port
    ):

        raise RuntimeError(
            "Variety Engine gagal memulai "
            "server internal Flask."
        )

    # ========================================================
    # PYWEBVIEW
    # ========================================================

    debug_log(
        "Membuka PyWebView."
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

    debug_log(
        "PyWebView ditutup."
    )


if __name__ == "__main__":

    main()