from pathlib import Path
import json
import zipfile
import subprocess

import geopandas as gpd



def extract_shapefile(archive_path, extract_dir):
    """
    Mengekstrak ZIP atau RAR dan mencari file .shp.
    """

    archive_path = Path(archive_path)
    extract_dir = Path(extract_dir)

    extract_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    extension = archive_path.suffix.lower()


    # =====================================================
    # ZIP
    # =====================================================

    if extension == ".zip":

        with zipfile.ZipFile(
            archive_path,
            "r"
        ) as zip_ref:

            zip_ref.extractall(
                extract_dir
            )


    # =====================================================
    # RAR
    # =====================================================
    elif extension == ".rar":

        winrar_path = Path(
            r"C:\Program Files\WinRAR\WinRAR.exe"
        )

        if not winrar_path.exists():

            raise RuntimeError(
                "WinRAR tidak ditemukan di "
                "C:\\Program Files\\WinRAR\\WinRAR.exe"
            )

        try:

            subprocess.run(
                [
                    str(winrar_path),
                    "x",
                    "-y",
                    "-ibck",
                    str(archive_path),
                    str(extract_dir) + "\\"
                ],
                check=True,
                capture_output=True,
                text=True
            )

        except subprocess.CalledProcessError as error:

            raise RuntimeError(
                "Gagal mengekstrak file RAR: "
                + (
                    error.stderr
                    or error.stdout
                    or "Unknown error"
                )
            )


    else:

        raise ValueError(
            "Format file tidak didukung. "
            "Gunakan .ZIP atau .RAR."
        )


    # =====================================================
    # CARI SHP
    # =====================================================

    shp_files = list(
        extract_dir.rglob("*.shp")
    )


    if not shp_files:

        raise ValueError(
            "File ZIP/RAR tidak mengandung "
            "file .shp."
        )


    # Untuk sementara gunakan SHP pertama
    shp_path = shp_files[0]


    # =====================================================
    # CEK KOMPONEN SHAPEFILE
    # =====================================================

    base_path = shp_path.with_suffix("")


    required_files = [

        base_path.with_suffix(".shp"),

        base_path.with_suffix(".shx"),

        base_path.with_suffix(".dbf"),

    ]


    missing_files = [

        file.name

        for file in required_files

        if not file.exists()

    ]


    if missing_files:

        raise ValueError(
            "Komponen Shapefile tidak lengkap: "
            + ", ".join(missing_files)
        )


    return shp_path


def read_shapefile(shp_path):

    shp_path = Path(
        shp_path
    )


    if not shp_path.exists():

        raise FileNotFoundError(
            f"File Shapefile tidak ditemukan: "
            f"{shp_path}"
        )


    gdf = gpd.read_file(
        shp_path
    )


    return gdf


def shapefile_to_geojson(gdf):

    if gdf.empty:

        return {
            "type": "FeatureCollection",
            "features": []
        }


    # =====================================================
    # PETA WEB MEMBUTUHKAN WGS84 / EPSG:4326
    # =====================================================

    if gdf.crs is not None:

        try:

            gdf = gdf.to_crs(
                epsg=4326
            )

        except Exception:

            pass


    return json.loads(
        gdf.to_json()
    )