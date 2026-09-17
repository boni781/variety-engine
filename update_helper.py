import argparse
import os
import shutil
import subprocess
import tempfile
import time
import zipfile
import json
import threading
import tkinter as tk
from tkinter import ttk
from pathlib import Path


APP_EXE = "VarietyEngine.exe"
DATA_FOLDER = "data"


# ============================================================
# PROCESS
# ============================================================

def wait_for_process_exit(pid, timeout=30, update_window=None):
    if not pid:
        return True

    start = time.time()

    while time.time() - start < timeout:

        try:
            os.kill(pid, 0)

            if update_window:
                elapsed = int(time.time() - start)

                update_window.update(
                    status="Menunggu Variety Engine ditutup...",
                    progress=None,
                    detail=f"Menunggu proses selesai... {elapsed} detik"
                )

            time.sleep(0.5)

        except OSError:
            break

    # Beri waktu Windows melepas file handle
    time.sleep(2)

    return True

class UpdateCancelled(Exception):
    pass

# ============================================================
# UPDATE WINDOW
# ============================================================

class UpdateWindow:

    def __init__(self):

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
            self.cancel
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

        self.status_var = tk.StringVar(
            value="Menyiapkan update..."
        )

        tk.Label(
            body,
            textvariable=self.status_var,
            font=("Segoe UI", 11, "bold")
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
            pady=15
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

        # ----------------------------------------------------
        # CANCEL
        # ----------------------------------------------------

        self.cancel_event = threading.Event()

        self.cancel_button = tk.Button(
            body,
            text="Batalkan",
            command=self.cancel,
            width=14
        )

        self.cancel_button.pack(
            pady=(15, 0)
        )

    def update(
        self,
        status=None,
        progress=None,
        detail=None
    ):

        try:

            if status is not None:
                self.status_var.set(status)

            if progress is not None:
                self.progress["value"] = progress

            if detail is not None:
                self.detail_var.set(detail)

            self.root.update_idletasks()

        except Exception:
            pass

    def cancel(self):

        if self.cancel_event.is_set():
            return

        self.cancel_event.set()

        try:

            self.cancel_button.config(
                state="disabled",
                text="Membatalkan..."
            )

            self.status_var.set(
                "Membatalkan update..."
            )

            self.detail_var.set(
                "Menghentikan proses dan mengembalikan aplikasi..."
            )

            self.root.update_idletasks()

        except Exception:
            pass

    def is_cancelled(self):

        return self.cancel_event.is_set()

    def close(self):

        try:
            self.root.destroy()

        except Exception:
            pass

    def run(self):

        self.root.mainloop()


# ============================================================
# EXTRACT ZIP
# ============================================================

def extract_update(
    zip_path,
    temp_dir,
    update_window
):

    update_window.update(
        status="Mengekstrak update...",
        progress=0,
        detail="Membaca file update..."
    )

    with zipfile.ZipFile(
        zip_path,
        "r"
    ) as z:

        members = [
            member
            for member in z.infolist()
            if not member.is_dir()
        ]

        total_files = len(members)

        if total_files == 0:
            raise RuntimeError(
                "ZIP update tidak berisi file."
            )

        extracted = 0

        for member in members:

            if update_window.is_cancelled():
                raise UpdateCancelled()
          
            # ------------------------------------------------
            # SECURITY
            # ------------------------------------------------

            member_path = Path(member.filename)

            if member_path.is_absolute():

                raise RuntimeError(
                    "ZIP update memiliki path yang tidak aman."
                )

            destination = (
                temp_dir
                / member_path
            ).resolve()

            temp_root = (
                temp_dir
            ).resolve()

            if (
                destination != temp_root
                and temp_root not in destination.parents
            ):

                raise RuntimeError(
                    "ZIP update memiliki path yang tidak aman."
                )

            # ------------------------------------------------
            # EXTRACT
            # ------------------------------------------------

            destination.parent.mkdir(
                parents=True,
                exist_ok=True
            )

            with z.open(member) as source:
                with open(destination, "wb") as target:
                    shutil.copyfileobj(
                        source,
                        target
                    )

            extracted += 1

            percent = (
                extracted
                / total_files
                * 100
            )

            update_window.update(
                status="Mengekstrak update...",
                progress=percent,
                detail=(
                    f"{extracted} / "
                    f"{total_files} file"
                )
            )

    # --------------------------------------------------------
    # FIND APP FOLDER
    # --------------------------------------------------------

    extracted_app = (
        temp_dir
        / "VarietyEngine"
    )

    if not extracted_app.is_dir():

        raise RuntimeError(
            "Struktur ZIP tidak sesuai. "
            "Folder VarietyEngine tidak ditemukan."
        )

    new_exe = (
        extracted_app
        / APP_EXE
    )

    if not new_exe.is_file():

        raise RuntimeError(
            "VarietyEngine.exe tidak ditemukan "
            "di dalam ZIP update."
        )

    return extracted_app


# ============================================================
# COLLECT UPDATE FILES
# ============================================================

def collect_update_files(
    extracted_app
):

    files = []

    for path in extracted_app.rglob("*"):

        if not path.is_file():
            continue

        relative = path.relative_to(
            extracted_app
        )

        # ----------------------------------------------------
        # JANGAN SENTUH DATA
        # ----------------------------------------------------

        if relative.parts:

            first_folder = (
                relative.parts[0].lower()
            )

            if first_folder == DATA_FOLDER.lower():
                continue

        files.append(relative)

    return files


# ============================================================
# UPDATE APPLICATION
# ============================================================

def update_application(
    zip_path,
    target_dir,
    update_window
):

    zip_path = Path(
        zip_path
    ).resolve()

    target_dir = Path(
        target_dir
    ).resolve()

    if not zip_path.is_file():

        raise FileNotFoundError(
            f"ZIP update tidak ditemukan:\n{zip_path}"
        )

    if not target_dir.is_dir():

        raise FileNotFoundError(
            f"Folder aplikasi tidak ditemukan:\n{target_dir}"
        )

    parent_dir = target_dir.parent

    temp_dir = Path(
        tempfile.mkdtemp(
            prefix="variety_update_",
            dir=str(parent_dir)
        )
    )

    backup_dir = Path(
        tempfile.mkdtemp(
            prefix="variety_backup_",
            dir=str(parent_dir)
        )
    )

    backed_up = []

    try:

        # ====================================================
        # 1. EXTRACT
        # ====================================================

        extracted_app = extract_update(
            zip_path,
            temp_dir,
            update_window
        )

        # ====================================================
        # 2. COLLECT FILES
        # ====================================================

        update_files = collect_update_files(
            extracted_app
        )

        if not update_files:

            raise RuntimeError(
                "Tidak ada file aplikasi yang dapat diperbarui."
            )

        # ====================================================
        # 3. BACKUP FILE YANG AKAN DIGANTI
        # ====================================================

        update_window.update(
            status="Menyiapkan pemasangan...",
            progress=0,
            detail=(
                f"Menyiapkan {len(update_files)} file..."
            )
        )

        total_files = len(update_files)

        for index, relative in enumerate(
            update_files,
            start=1
        ):
            
            if update_window.is_cancelled():
                raise UpdateCancelled()

            old_file = (
                target_dir
                / relative
            )

            if old_file.is_file():

                backup_file = (
                    backup_dir
                    / relative
                )

                backup_file.parent.mkdir(
                    parents=True,
                    exist_ok=True
                )

                shutil.copy2(
                    old_file,
                    backup_file
                )

                backed_up.append(
                    relative
                )

            percent = (
                index
                / total_files
                * 100
            )

            update_window.update(
                status="Menyiapkan pemasangan...",
                progress=percent,
                detail=(
                    f"Backup {index} / "
                    f"{total_files} file"
                )
            )

        # ====================================================
        # 4. COPY FILE UPDATE
        # ====================================================

        copied = 0

        for index, relative in enumerate(
            update_files,
            start=1
        ):
            if update_window.is_cancelled():
                raise UpdateCancelled()            

            source_file = (
                extracted_app
                / relative
            )

            destination_file = (
                target_dir
                / relative
            )

            destination_file.parent.mkdir(
                parents=True,
                exist_ok=True
            )

            try:

                last_error = None

                for attempt in range(60):

                    if update_window.is_cancelled():
                        raise UpdateCancelled()

                    try:

                        # ------------------------------------------------
                        # HAPUS FILE LAMA TERLEBIH DAHULU
                        # ------------------------------------------------

                        if destination_file.exists():

                            destination_file.unlink()

                        # ------------------------------------------------
                        # PASTIKAN FILE LAMA SUDAH HILANG
                        # ------------------------------------------------

                        if destination_file.exists():

                            raise PermissionError(
                                "File lama belum dapat dihapus."
                            )

                        # ------------------------------------------------
                        # COPY FILE BARU
                        # ------------------------------------------------

                        shutil.copy2(
                            source_file,
                            destination_file
                        )

                        last_error = None
                        break

                    except PermissionError as e:

                        last_error = e

                        time.sleep(0.5)

                if last_error is not None:

                    raise PermissionError(
                        "File aplikasi masih digunakan "
                        "oleh proses lain setelah menunggu.\n\n"
                        f"File: {destination_file}"
                    )

            except PermissionError:

                raise

            copied += 1

            percent = (
                index
                / total_files
                * 100
            )

            update_window.update(
                status="Memasang update...",
                progress=percent,
                detail=(
                    f"{index} / "
                    f"{total_files} file"
                )
            )

        # ====================================================
        # 5. VERIFY
        # ====================================================

        update_window.update(
            status="Memverifikasi update...",
            progress=0,
            detail="Memeriksa file aplikasi..."
        )

        final_exe = (
            target_dir
            / APP_EXE
        )

        if not final_exe.is_file():

            raise RuntimeError(
                "Update gagal: "
                "VarietyEngine.exe tidak ditemukan "
                "setelah pemasangan."
            )

        # ----------------------------------------------------
        # VERIFY ALL UPDATE FILES
        # ----------------------------------------------------

        for index, relative in enumerate(
            update_files,
            start=1
        ):
            if update_window.is_cancelled():
                raise UpdateCancelled()

            destination_file = (
                target_dir
                / relative
            )

            if not destination_file.is_file():

                raise RuntimeError(
                    "File update tidak ditemukan "
                    "setelah pemasangan:\n"
                    f"{destination_file}"
                )

            percent = (
                index
                / total_files
                * 100
            )

            update_window.update(
                status="Memverifikasi update...",
                progress=percent,
                detail=(
                    f"Verifikasi {index} / "
                    f"{total_files} file"
                )
            )

        # ====================================================
        # 6. SUCCESS
        # ====================================================

        update_window.update(
            status="Update berhasil!",
            progress=100,
            detail=(
                f"{copied} file berhasil diperbarui."
            )
        )

        return True

    except Exception:

        # ====================================================
        # ROLLBACK
        # ====================================================

        update_window.update(
            status="Update gagal. Mengembalikan file...",
            progress=0,
            detail="Melakukan rollback..."
        )

        for relative in backed_up:

            backup_file = (
                backup_dir
                / relative
            )

            original_file = (
                target_dir
                / relative
            )

            if not backup_file.is_file():
                continue

            try:

                original_file.parent.mkdir(
                    parents=True,
                    exist_ok=True
                )

                shutil.copy2(
                    backup_file,
                    original_file
                )

            except Exception:
                pass

        raise

    finally:

        # ====================================================
        # CLEAN TEMP
        # ====================================================

        shutil.rmtree(
            temp_dir,
            ignore_errors=True
        )

        shutil.rmtree(
            backup_dir,
            ignore_errors=True
        )


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description="Variety Engine Updater"
    )

    parser.add_argument(
        "--zip",
        required=True
    )

    parser.add_argument(
        "--target",
        required=True
    )

    parser.add_argument(
        "--pid",
        type=int,
        default=None
    )

    parser.add_argument(
        "--restart",
        action="store_true"
    )
    
    parser.add_argument(
        "--version",
        required=True
    )

    args = parser.parse_args()

    update_window = UpdateWindow()

    result = {
        "success": False,
        "error": None
    }

    def worker():

        try:

            # =================================================
            # 1. STOP APPLICATION
            # =================================================

            update_window.root.after(
                0,
                update_window.update,
                "Menutup Variety Engine...",
                0,
                "Menutup aplikasi lama..."
            )

            try:

                subprocess.run(
                    [
                        "taskkill",
                        "/F",
                        "/T",
                        "/IM",
                        "VarietyEngine.exe",
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                )
                
            except UpdateCancelled:

                # ================================================
                # UPDATE DIBATALKAN
                # ================================================

                try:

                    update_window.root.after(
                        0,
                        update_window.update,
                        "Update dibatalkan.",
                        100,
                        "Mengembalikan dan membuka Variety Engine..."
                    )

                    # Tunggu sebentar agar rollback selesai
                    time.sleep(1)

                    exe = (
                        Path(args.target).resolve()
                        / APP_EXE
                    )

                    if exe.is_file():

                        subprocess.Popen(
                            [str(exe)],
                            cwd=str(exe.parent)
                        )

                    # Hapus ZIP temporary
                    try:

                        zip_file = Path(
                            args.zip
                        )

                        if zip_file.exists():
                            zip_file.unlink()

                    except Exception:
                        pass
                    
                    if update_window.is_cancelled():
                        raise UpdateCancelled()

                    time.sleep(1)

                    os._exit(0)

                except Exception:

                    os._exit(1)


            except UpdateCancelled:

                try:

                    update_window.root.after(
                        0,
                        update_window.update,
                        "Update dibatalkan.",
                        100,
                        "Mengembalikan dan membuka Variety Engine..."
                    )

                    time.sleep(1)

                    exe = (
                        Path(args.target).resolve()
                        / APP_EXE
                    )

                    if exe.is_file():

                        subprocess.Popen(
                            [str(exe)],
                            cwd=str(exe.parent)
                        )

                    # Hapus ZIP temporary
                    try:

                        zip_file = Path(
                            args.zip
                        )

                        if zip_file.exists():
                            zip_file.unlink()

                    except Exception:
                        pass

                    time.sleep(1)

                    os._exit(0)

                except Exception:

                    os._exit(1)

            except Exception as e:

                result["error"] = e

                update_window.root.after(
                    0,
                    update_window.update,
                    "Update gagal.",
                    0,
                    f"{type(e).__name__}: {e}"
                )
                
            except Exception:
                pass

            # Beri waktu Windows melepas file handle
            time.sleep(3)

            # Pastikan VarietyEngine.exe benar-benar sudah berhenti
            process_stopped = False

            for _ in range(30):

                try:

                    result = subprocess.run(
                        [
                            "tasklist",
                            "/FI",
                            "IMAGENAME eq VarietyEngine.exe",
                        ],
                        capture_output=True,
                        text=True,
                        creationflags=subprocess.CREATE_NO_WINDOW,
                    )

                    if "VarietyEngine.exe" not in result.stdout:
                        process_stopped = True
                        break

                except Exception:
                    break

                time.sleep(0.5)

            if not process_stopped:

                raise RuntimeError(
                    "Variety Engine tidak dapat dihentikan. "
                    "Update dibatalkan untuk mencegah file rusak."
                )

            time.sleep(1)

            # =================================================
            # 2. UPDATE
            # =================================================

            update_application(
                args.zip,
                args.target,
                update_window
            )

            # =================================================
            # 3. UPDATE VERSION
            # =================================================

            version_file = (
                Path(args.target).resolve()
                / "version.json"
            )

            new_version = str(
                args.version
            ).strip().lstrip("v")

            with open(
                version_file,
                "w",
                encoding="utf-8"
            ) as f:

                json.dump(
                    {
                        "version": new_version
                    },
                    f,
                    indent=4
                )

            # =================================================
            # 4. DELETE ZIP
            # =================================================
            try:

                zip_file = Path(
                    args.zip
                )

                if zip_file.exists():
                    zip_file.unlink()

            except Exception:
                pass

            # =================================================
            # 4. RESTART
            # =================================================

            if args.restart:

                exe = (
                    Path(args.target).resolve()
                    / APP_EXE
                )

                if not exe.is_file():

                    raise FileNotFoundError(
                        f"Variety Engine tidak ditemukan:\n{exe}"
                    )

                update_window.root.after(
                    0,
                    update_window.update,
                    "Update selesai!",
                    100,
                    "Membuka Variety Engine..."
                )

                time.sleep(1.5)

                subprocess.Popen(
                    [str(exe)],
                    cwd=str(exe.parent)
                )
                
                time.sleep(1)
                os._exit(0)

                result["success"] = True

                update_window.root.after(
                    0,
                    update_window.close
                )

            else:

                result["success"] = True

                update_window.root.after(
                    0,
                    update_window.close
                )

        except Exception as e:

            result["error"] = e

            update_window.root.after(
                0,
                update_window.update,
                "Update gagal.",
                0,
                f"{type(e).__name__}: {e}"
            )

    threading = __import__("threading")

    threading.Thread(
        target=worker,
        daemon=True
    ).start()

    update_window.run()

    if result["error"]:

        raise result["error"]


if __name__ == "__main__":
    main()