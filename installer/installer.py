import os
import shutil
import subprocess
import sys
import tempfile
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk


APP_NAME = "Variety Engine"
EXE_NAME = "VarietyEngine.exe"
LAUNCHER_NAME = "VarietyEngineLauncher.exe"
UPDATER_NAME = "VarietyEngineUpdater.exe"
SETUP_NAME = "VarietyEngineSetup.exe"


def base_dir():
    return (
        Path(sys._MEIPASS)
        if getattr(sys, "frozen", False)
        else Path(__file__).resolve().parent.parent
    )


def source_dir():
    if getattr(sys, "frozen", False):
        return base_dir() / "VarietyEngine"

    return (
        base_dir()
        / "dist"
        / "VarietyEngine.exe"
    )


def updater_source():
    if getattr(sys, "frozen", False):
        return base_dir() / UPDATER_NAME

    return (
        base_dir()
        / "dist"
        / UPDATER_NAME
    )


def launcher_source():
    if getattr(sys, "frozen", False):
        return base_dir() / LAUNCHER_NAME

    return (
        base_dir()
        / "dist"
        / LAUNCHER_NAME
    )


def setup_source():
    if getattr(sys, "frozen", False):
        return Path(sys.executable)

    return (
        base_dir()
        / "dist"
        / SETUP_NAME
    )


def default_dir():
    return (
        Path(
            os.environ.get(
                "LOCALAPPDATA",
                Path.home(),
            )
        )
        / "Programs"
        / "Variety Engine"
    )


def shortcut(target, link):
    ps = shutil.which("powershell.exe")

    if not ps:
        return False

    q = lambda s: s.replace("'", "''")

    script = (
        "$w=New-Object -ComObject WScript.Shell;"
        f"$s=$w.CreateShortcut('{q(str(link))}');"
        f"$s.TargetPath='{q(str(target))}';"
        f"$s.WorkingDirectory='{q(str(target.parent))}';"
        f"$s.IconLocation='{q(str(target))},0';"
        f"$s.Description='{APP_NAME}';"
        "$s.Save()"
    )

    r = subprocess.run(
        [
            ps,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ],
        capture_output=True,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )

    return (
        r.returncode == 0
        and link.exists()
    )


# ============================================================
# INSTALLER UI
# ============================================================

class Installer:

    def __init__(self, root):

        self.root = root

        root.title(
            "Variety Engine Setup"
        )

        root.geometry(
            "680x460"
        )

        root.resizable(
            False,
            False
        )

        root.configure(
            bg="#f5f7fb"
        )

        self.build()


    def build(self):

        h = tk.Frame(
            self.root,
            bg="#172033",
            height=105,
        )

        h.pack(
            fill="x"
        )

        h.pack_propagate(
            False
        )

        tk.Label(
            h,
            text="V",
            font=("Segoe UI", 28, "bold"),
            fg="white",
            bg="#2563eb",
            width=3,
        ).place(
            x=34,
            y=25,
        )

        tk.Label(
            h,
            text="Variety Engine",
            font=("Segoe UI", 22, "bold"),
            fg="white",
            bg="#172033",
        ).place(
            x=125,
            y=22,
        )

        tk.Label(
            h,
            text="Setup & Installation",
            font=("Segoe UI", 10),
            fg="#cbd5e1",
            bg="#172033",
        ).place(
            x=127,
            y=60,
        )

        m = tk.Frame(
            self.root,
            bg="#f5f7fb",
        )

        m.pack(
            fill="both",
            expand=True,
            padx=34,
            pady=22,
        )

        tk.Label(
            m,
            text="Install Variety Engine",
            font=("Segoe UI", 16, "bold"),
            fg="#172033",
            bg="#f5f7fb",
        ).pack(
            anchor="w"
        )

        tk.Label(
            m,
            text="Pilih lokasi instalasi aplikasi.",
            font=("Segoe UI", 9),
            fg="#64748b",
            bg="#f5f7fb",
        ).pack(
            anchor="w",
            pady=(5, 20),
        )

        tk.Label(
            m,
            text="Lokasi instalasi",
            font=("Segoe UI", 10, "bold"),
            fg="#334155",
            bg="#f5f7fb",
        ).pack(
            anchor="w"
        )

        row = tk.Frame(
            m,
            bg="#f5f7fb",
        )

        row.pack(
            fill="x",
            pady=(7, 20),
        )

        self.loc = tk.StringVar(
            value=str(
                default_dir()
            )
        )

        self.entry = tk.Entry(
            row,
            textvariable=self.loc,
            font=("Segoe UI", 10),
            relief="solid",
            bd=1,
        )

        self.entry.pack(
            side="left",
            fill="x",
            expand=True,
            ipady=8,
        )

        self.browse = tk.Button(
            row,
            text="Browse",
            command=self.browse_folder,
            bg="#e2e8f0",
            fg="#334155",
            relief="flat",
            padx=14,
            pady=8,
        )

        self.browse.pack(
            side="left",
            padx=(8, 0),
        )

        self.sc = tk.BooleanVar(
            value=True
        )

        tk.Checkbutton(
            m,
            text="Buat shortcut Variety Engine di Desktop",
            variable=self.sc,
            font=("Segoe UI", 9),
            fg="#334155",
            bg="#f5f7fb",
            activebackground="#f5f7fb",
            selectcolor="#f5f7fb",
        ).pack(
            anchor="w"
        )

        self.status = tk.StringVar(
            value="Siap untuk instalasi."
        )

        tk.Label(
            m,
            textvariable=self.status,
            font=("Segoe UI", 9),
            fg="#64748b",
            bg="#f5f7fb",
            anchor="w",
            justify="left",
        ).pack(
            anchor="w",
            pady=(22, 7),
        )

        self.progress = ttk.Progressbar(
            m,
            maximum=100,
        )

        self.progress.pack(
            fill="x"
        )

        b = tk.Frame(
            m,
            bg="#f5f7fb",
        )

        b.pack(
            fill="x",
            pady=(24, 0),
        )

        tk.Button(
            b,
            text="Batal",
            command=self.root.destroy,
            bg="#e2e8f0",
            fg="#334155",
            relief="flat",
            padx=18,
            pady=9,
        ).pack(
            side="right"
        )

        self.install = tk.Button(
            b,
            text="Install",
            command=self.start,
            bg="#2563eb",
            fg="white",
            relief="flat",
            padx=25,
            pady=9,
        )

        self.install.pack(
            side="right",
            padx=(0, 8),
        )


    def browse_folder(self):

        p = filedialog.askdirectory(
            title="Pilih Lokasi Instalasi"
        )

        if p:
            self.loc.set(p)


    def start(self):

        src = source_dir()

        if not src.exists():

            messagebox.showerror(
                "File Tidak Ditemukan",
                f"File hasil build tidak ditemukan:\n\n{src}",
            )

            return

        self.install.config(
            state="disabled"
        )

        self.browse.config(
            state="disabled"
        )

        self.entry.config(
            state="disabled"
        )

        threading.Thread(
            target=self.do_install,
            args=(
                Path(
                    self.loc.get()
                ),
                src,
            ),
            daemon=True,
        ).start()


    def set(
        self,
        status,
        progress,
    ):

        self.root.after(
            0,
            lambda: (
                self.status.set(status),
                self.progress.configure(
                    value=progress
                ),
            ),
        )


    def do_install(
        self,
        root,
        src,
    ):

        try:

            app = (
                root
                / "VarietyEngine"
            )

            exe = (
                app
                / EXE_NAME
            )

            # =================================================
            # TAHAP 1 - MENYIAPKAN
            # =================================================

            self.set(
                "Menyiapkan folder instalasi...",
                2,
            )

            root.mkdir(
                parents=True,
                exist_ok=True,
            )

            app.mkdir(
                parents=True,
                exist_ok=True,
            )

            # =================================================
            # TAHAP 2 - MENYIAPKAN FILE APLIKASI
            # =================================================

            self.set(
                "Menyiapkan file aplikasi...",
                5,
            )

            if not src.exists():

                raise FileNotFoundError(
                    f"File aplikasi tidak ditemukan:\n{src}"
                )

            if not src.is_file():

                raise RuntimeError(
                    "Source aplikasi harus berupa "
                    "VarietyEngine.exe."
                )

            total_size = src.stat().st_size

            if total_size <= 0:

                raise RuntimeError(
                    "VarietyEngine.exe kosong."
                )

            # =================================================
            # TAHAP 3 - MENYALIN APLIKASI
            # =================================================

            self.set(
                "Menyalin Variety Engine...",
                10,
            )

            destination = (
                app
                / EXE_NAME
            )

            try:

                shutil.copy2(
                    src,
                    destination,
                )

            except PermissionError:

                raise PermissionError(
                    "Variety Engine sedang berjalan.\n\n"
                    "Tutup aplikasi Variety Engine "
                    "terlebih dahulu lalu jalankan Setup kembali."
                )

            self.set(
                (
                    "Variety Engine berhasil disalin.\n"
                    f"{total_size / 1024 / 1024:.1f} MB"
                ),
                80,
            )

            # =================================================
            # TAHAP 4 - VERSION.JSON
            # =================================================

            self.set(
                "Memasang informasi versi...",
                90,
            )

            version_src = (
                base_dir()
                / "version.json"
            )

            version_dst = (
                app
                / "version.json"
            )

            if version_src.exists():

                shutil.copy2(
                    version_src,
                    version_dst,
                )

            # =================================================
            # TAHAP 5 - LAUNCHER
            # =================================================

            self.set(
                "Memasang Launcher...",
                92,
            )

            launcher_src = (
                launcher_source()
            )

            launcher_dst = (
                app
                / LAUNCHER_NAME
            )

            if launcher_src.exists():

                shutil.copy2(
                    launcher_src,
                    launcher_dst,
                )

            if not launcher_dst.exists():

                raise FileNotFoundError(
                    f"{LAUNCHER_NAME} "
                    "tidak ditemukan setelah instalasi:\n"
                    f"{launcher_dst}"
                )

            # =================================================
            # TAHAP 6 - UPDATER
            # =================================================

            self.set(
                "Memasang Updater...",
                94,
            )

            updater_src = (
                updater_source()
            )

            updater_dst = (
                root
                / UPDATER_NAME
            )

            if updater_src.exists():

                try:

                    shutil.copy2(
                        updater_src,
                        updater_dst,
                    )

                except PermissionError:

                    raise PermissionError(
                        "VarietyEngineUpdater.exe sedang digunakan.\n\n"
                        "Tutup proses updater terlebih dahulu."
                    )

            if not updater_dst.exists():

                raise FileNotFoundError(
                    f"{UPDATER_NAME} "
                    "tidak ditemukan setelah instalasi:\n"
                    f"{updater_dst}"
                )

            # =================================================
            # TAHAP 7 - SETUP
            # =================================================

            self.set(
                "Menyiapkan installer...",
                96,
            )

            setup_src = (
                setup_source()
            )

            setup_dst = (
                root
                / SETUP_NAME
            )

            # Jangan menyalin Setup.exe ke dirinya sendiri
            current_setup = (
                Path(sys.executable).resolve()
                if getattr(sys, "frozen", False)
                else None
            )

            if (
                setup_src.exists()
                and (
                    current_setup is None
                    or setup_src.resolve()
                    != current_setup
                )
            ):

                shutil.copy2(
                    setup_src,
                    setup_dst,
                )

            # Jika sedang menjalankan Setup.exe
            # langsung dari hasil build, tidak perlu
            # memaksakan copy dirinya sendiri.
            if not setup_dst.exists():

                if current_setup is not None:

                    try:

                        shutil.copy2(
                            current_setup,
                            setup_dst,
                        )

                    except Exception:
                        pass

            # =================================================
            # TAHAP 8 - VALIDASI
            # =================================================

            self.set(
                "Memeriksa file aplikasi...",
                97,
            )

            if not exe.exists():

                raise FileNotFoundError(
                    f"{EXE_NAME} tidak ditemukan."
                )

            if not version_dst.exists():

                raise FileNotFoundError(
                    "version.json tidak ditemukan "
                    "setelah instalasi."
                )

            if not launcher_dst.exists():

                raise FileNotFoundError(
                    f"{LAUNCHER_NAME} tidak ditemukan."
                )

            if not updater_dst.exists():

                raise FileNotFoundError(
                    f"{UPDATER_NAME} tidak ditemukan."
                )

            # =================================================
            # TAHAP 9 - SHORTCUT
            # =================================================

            msg = (
                "Shortcut Desktop tidak dibuat."
            )

            if self.sc.get():

                self.set(
                    "Membuat shortcut Desktop...",
                    98,
                )

                desk = (
                    Path.home()
                    / "Desktop"
                )

                desk.mkdir(
                    exist_ok=True
                )

                shortcut_path = (
                    desk
                    / "Variety Engine.lnk"
                )

                msg = (
                    "Shortcut Desktop berhasil dibuat."
                    if shortcut(
                        launcher_dst,
                        shortcut_path,
                    )
                    else
                    "Shortcut Desktop gagal dibuat."
                )

            # =================================================
            # SELESAI
            # =================================================

            self.set(
                "Instalasi selesai.",
                100,
            )

            self.root.after(
                100,
                lambda: self.finish(
                    launcher_dst,
                    app,
                    msg,
                ),
            )

        except Exception as e:

            self.root.after(
                100,
                lambda: messagebox.showerror(
                    "Instalasi Gagal",
                    str(e),
                ),
            )

            self.root.after(
                150,
                lambda: (
                    self.install.config(
                        state="normal"
                    ),
                    self.browse.config(
                        state="normal"
                    ),
                    self.entry.config(
                        state="normal"
                    ),
                ),
            )


    def finish(
        self,
        launcher,
        app,
        msg,
    ):

        messagebox.showinfo(
            "Instalasi Berhasil",
            f"Variety Engine berhasil diinstal.\n\n"
            f"Lokasi:\n{app}\n\n"
            f"{msg}",
        )

        try:

            subprocess.Popen(
                [str(launcher)],
                cwd=str(app),
            )

        except Exception as e:

            messagebox.showwarning(
                "Peringatan",
                "Instalasi berhasil, tetapi aplikasi "
                "tidak dapat dibuka otomatis.\n\n"
                f"{e}",
            )

        self.root.destroy()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    root = tk.Tk()

    Installer(root)

    root.mainloop()