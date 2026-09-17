import subprocess
import sys
from pathlib import Path


APP_EXE = "VarietyEngine.exe"


def get_app_dir():

    if getattr(
        sys,
        "frozen",
        False,
    ):

        # Launcher berada satu folder
        # dengan VarietyEngine.exe
        return Path(
            sys.executable
        ).resolve().parent

    return Path(
        __file__
    ).resolve().parent


def main():

    base = get_app_dir()

    app_exe = (
        base
        / APP_EXE
    )

    if not app_exe.exists():

        raise FileNotFoundError(
            "Variety Engine tidak ditemukan.\n\n"
            f"Lokasi: {app_exe}"
        )

    subprocess.Popen(
        [str(app_exe)],
        cwd=str(
            app_exe.parent
        ),
    )


if __name__ == "__main__":
    main()