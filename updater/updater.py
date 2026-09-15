import json
import urllib.request
import tkinter as tk
from tkinter import messagebox


# ============================================================
# KONFIGURASI GITHUB
# ============================================================

GITHUB_OWNER = "boni781"
GITHUB_REPO = "variety-engine"
CURRENT_VERSION = "1.0.0"


# ============================================================
# VERSI
# ============================================================

def version_tuple(version):
    """
    Mengubah:
        1.2.3
    menjadi:
        (1, 2, 3)
    """
    version = str(version).strip().lower().replace("v", "")

    try:
        return tuple(int(x) for x in version.split("."))
    except ValueError:
        return (0, 0, 0)


def is_newer(current, latest):
    return version_tuple(latest) > version_tuple(current)


# ============================================================
# CEK GITHUB
# ============================================================

def check_latest_version():

    url = (
        f"https://api.github.com/repos/"
        f"{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"
    )

    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "Variety-Engine-Updater"
        }
    )

    try:

        with urllib.request.urlopen(request, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))

        tag = data.get("tag_name", "")
        latest_version = tag.lstrip("vV")

        return {
            "success": True,
            "version": latest_version,
            "release_name": data.get("name", ""),
            "release_url": data.get("html_url", ""),
            "body": data.get("body", ""),
            "assets": data.get("assets", [])
        }

    except Exception as e:

        return {
            "success": False,
            "error": str(e)
        }


# ============================================================
# TEST
# ============================================================

def main():

    result = check_latest_version()

    root = tk.Tk()
    root.withdraw()

    if not result["success"]:

        messagebox.showerror(
            "Update",
            "Tidak dapat memeriksa update.\n\n"
            f"{result['error']}"
        )

        root.destroy()
        return

    latest = result["version"]

    if is_newer(CURRENT_VERSION, latest):

        messagebox.showinfo(
            "Update Tersedia",
            f"Versi aplikasi saat ini : {CURRENT_VERSION}\n"
            f"Versi terbaru           : {latest}\n\n"
            "Update tersedia."
        )

    else:

        messagebox.showinfo(
            "Variety Engine",
            f"Versi aplikasi : {CURRENT_VERSION}\n\n"
            "Aplikasi sudah menggunakan versi terbaru."
        )

    root.destroy()


if __name__ == "__main__":
    main()