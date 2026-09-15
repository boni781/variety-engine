import pandas as pd

from normalization_service import normalize_for_filter


def normalize_match_value(value, mode="default"):
    """
    Normalisasi nilai yang digunakan sebagai kunci matching.
    """

    return normalize_for_filter(
        value,
        parameter_type="text",
        mode=mode
    )


def build_lookup(
    df,
    key_column,
    normalization="default"
):
    """
    Membuat lookup:
        normalized_key -> daftar index Excel
    """

    lookup = {}

    for index, value in df[key_column].items():

        if pd.isna(value):
            continue

        normalized = normalize_match_value(
            value,
            normalization
        )

        if normalized == "":
            continue

        if normalized not in lookup:
            lookup[normalized] = []

        lookup[normalized].append(index)

    return lookup


def match_data(
    shp_df,
    excel_df,
    shp_key,
    excel_key,
    normalization="default"
):
    """
    Matching SHP dengan Excel berdasarkan satu atribut kunci.

    Hasil:
        matched
        excel_only
        shp_only
    """

    if shp_key not in shp_df.columns:
        raise ValueError(
            f"Atribut SHP '{shp_key}' tidak ditemukan."
        )

    if excel_key not in excel_df.columns:
        raise ValueError(
            f"Atribut Excel '{excel_key}' tidak ditemukan."
        )

    excel_lookup = build_lookup(
        excel_df,
        excel_key,
        normalization
    )

    shp_lookup = build_lookup(
        shp_df,
        shp_key,
        normalization
    )

    matched = []
    excel_only = []
    shp_only = []

    matched_excel_indices = set()
    matched_shp_indices = set()

    # =========================================
    # MATCH SHP → EXCEL
    # =========================================

    for shp_index, shp_value in shp_df[shp_key].items():

        if pd.isna(shp_value):
            continue

        normalized = normalize_match_value(
            shp_value,
            normalization
        )

        if normalized == "":
            continue

        excel_indices = excel_lookup.get(
            normalized,
            []
        )

        if excel_indices:

            for excel_index in excel_indices:

                matched.append({
                    "shp_index": shp_index,
                    "excel_index": excel_index,
                    "key": normalized,
                    "shp_value": shp_value,
                    "excel_value": excel_df.loc[
                        excel_index,
                        excel_key
                    ],
                    "status": "MATCH"
                })

                matched_shp_indices.add(
                    shp_index
                )

                matched_excel_indices.add(
                    excel_index
                )

    # =========================================
    # EXCEL ONLY
    # =========================================

    for excel_index, excel_value in excel_df[excel_key].items():

        if excel_index in matched_excel_indices:
            continue

        if pd.isna(excel_value):
            continue

        normalized = normalize_match_value(
            excel_value,
            normalization
        )

        if normalized == "":
            continue

        excel_only.append({
            "excel_index": excel_index,
            "key": normalized,
            "excel_value": excel_value,
            "status": "EXCEL_ONLY"
        })

    # =========================================
    # SHP ONLY
    # =========================================

    for shp_index, shp_value in shp_df[shp_key].items():

        if shp_index in matched_shp_indices:
            continue

        if pd.isna(shp_value):
            continue

        normalized = normalize_match_value(
            shp_value,
            normalization
        )

        if normalized == "":
            continue

        shp_only.append({
            "shp_index": shp_index,
            "key": normalized,
            "shp_value": shp_value,
            "status": "SHP_ONLY"
        })

    return {
        "matched": matched,
        "excel_only": excel_only,
        "shp_only": shp_only,
        "summary": {
            "matched": len(matched),
            "excel_only": len(excel_only),
            "shp_only": len(shp_only)
        }
    }
    
def compare_matched_attributes(
    shp_df,
    excel_df,
    matched,
    shp_key,
    excel_key,
    normalization="default"
):
    """
    Membandingkan atribut pada data yang sudah MATCH.

    Hasil:
        same
        new_attributes
        conflicts
    """

    same = []
    new_attributes = []
    conflicts = []

    # Atribut ID tidak perlu dibandingkan
    shp_columns = [
        column
        for column in shp_df.columns
        if column != shp_key
        and column != "geometry"
    ]

    excel_columns = [
        column
        for column in excel_df.columns
        if column != excel_key
    ]

    # Pasangan atribut berdasarkan nama kolom.
    # Untuk sementara kita hanya membandingkan
    # atribut yang mempunyai nama sama.
    common_columns = [
        column
        for column in excel_columns
        if column in shp_columns
    ]

    # Atribut yang ada di Excel tetapi belum ada di SHP
    excel_new_columns = [
        column
        for column in excel_columns
        if column not in shp_columns
    ]

    for match in matched:

        shp_index = match["shp_index"]
        excel_index = match["excel_index"]

        key = match["key"]

        # =========================================
        # ATRIBUT YANG SUDAH ADA DI KEDUA DATA
        # =========================================

        for column in common_columns:

            shp_value = shp_df.loc[
                shp_index,
                column
            ]

            excel_value = excel_df.loc[
                excel_index,
                column
            ]

            # Kedua nilai kosong → tidak perlu diproses
            shp_empty = (
                pd.isna(shp_value)
                or str(shp_value).strip() == ""
            )

            excel_empty = (
                pd.isna(excel_value)
                or str(excel_value).strip() == ""
            )

            if shp_empty and excel_empty:
                continue

            # SHP kosong → Excel dapat mengisi
            if shp_empty and not excel_empty:

                new_attributes.append({
                    "shp_index": shp_index,
                    "excel_index": excel_index,
                    "key": key,
                    "attribute": column,
                    "shp_value": None,
                    "excel_value": excel_value,
                    "status": "NEW_ATTRIBUTE"
                })

                continue

            # Excel kosong → pertahankan SHP
            if not shp_empty and excel_empty:

                same.append({
                    "shp_index": shp_index,
                    "excel_index": excel_index,
                    "key": key,
                    "attribute": column,
                    "shp_value": shp_value,
                    "excel_value": None,
                    "status": "SAME"
                })

                continue

            # =====================================
            # NORMALISASI PERBANDINGAN
            # =====================================

            shp_normalized = normalize_match_value(
                shp_value,
                normalization
            )

            excel_normalized = normalize_match_value(
                excel_value,
                normalization
            )

            # Nilai sama
            if shp_normalized == excel_normalized:

                same.append({
                    "shp_index": shp_index,
                    "excel_index": excel_index,
                    "key": key,
                    "attribute": column,
                    "shp_value": shp_value,
                    "excel_value": excel_value,
                    "status": "SAME"
                })

            # Nilai berbeda → CONFLICT
            else:

                conflicts.append({
                    "shp_index": shp_index,
                    "excel_index": excel_index,
                    "key": key,
                    "attribute": column,
                    "shp_value": shp_value,
                    "excel_value": excel_value,
                    "decision": "keep_shp",
                    "status": "CONFLICT"
                })

        # =========================================
        # ATRIBUT BARU DARI EXCEL
        # =========================================

        for column in excel_new_columns:

            excel_value = excel_df.loc[
                excel_index,
                column
            ]

            if pd.isna(excel_value):
                continue

            if str(excel_value).strip() == "":
                continue

            new_attributes.append({
                "shp_index": shp_index,
                "excel_index": excel_index,
                "key": key,
                "attribute": column,
                "shp_value": None,
                "excel_value": excel_value,
                "status": "NEW_ATTRIBUTE"
            })

    return {
        "same": same,
        "new_attributes": new_attributes,
        "conflicts": conflicts,
        "summary": {
            "same": len(same),
            "new_attributes": len(new_attributes),
            "conflicts": len(conflicts)
        }
    }