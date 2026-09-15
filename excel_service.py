import pandas as pd


# =====================================================
# KONFIGURASI HEADER
# =====================================================

KNOWN_HEADER_ROWS = {
    # Contoh:
    # "MASTER TAKSASI 25-26": 6,
    # "SUM 1": 4,
}


# =====================================================
# DAFTAR SHEET
# =====================================================

def get_sheet_names(filepath):

    excel_file = pd.ExcelFile(
        filepath
    )

    return excel_file.sheet_names


# =====================================================
# KANDIDAT HEADER
# =====================================================

def get_header_candidates(
    filepath,
    sheet_name
):

    df = pd.read_excel(
        filepath,
        sheet_name=sheet_name,
        header=None
    )

    known_row = KNOWN_HEADER_ROWS.get(
        sheet_name
    )

    if known_row is not None:

        rows = (
            known_row
            if isinstance(
                known_row,
                list
            )
            else [known_row]
        )

        candidates = []

        for row_number in rows:

            index = row_number - 1

            if (
                index < 0
                or index >= len(df)
            ):
                continue

            row = df.iloc[index]

            headers = []

            for value in row.tolist():

                if pd.isna(value):
                    headers.append("")

                else:
                    headers.append(
                        str(value).strip()
                    )

            non_empty = [
                value
                for value in headers
                if value
            ]

            candidates.append({
                "row_number": row_number,
                "headers": headers,
                "non_empty": len(non_empty),
                "header_preview": " | ".join(
                    non_empty
                )
            })

        return candidates


    # =================================================
    # AUTO DETECTION
    # =================================================

    candidates = []

    for index, row in df.iterrows():

        row_number = index + 1

        if row_number > 30:
            break

        headers = []

        for value in row.tolist():

            if pd.isna(value):
                headers.append("")

            else:
                headers.append(
                    str(value).strip()
                )

        non_empty = [
            value
            for value in headers
            if value
        ]

        if len(non_empty) < 3:
            continue

        text_count = sum(
            1
            for value in non_empty
            if not str(value)
            .replace(".", "", 1)
            .isdigit()
        )

        text_ratio = (
            text_count
            /
            len(non_empty)
        )

        if text_ratio < 0.5:
            continue

        candidates.append({
            "row_number": row_number,
            "headers": headers,
            "non_empty": len(non_empty),
            "header_preview": " | ".join(
                non_empty
            )
        })

    return candidates


# =====================================================
# MEMBACA SHEET
# =====================================================

def read_sheet_with_header(
    filepath,
    sheet_name,
    header_row
):

    df = pd.read_excel(
        filepath,
        sheet_name=sheet_name,
        header=header_row - 1
    )

    # Hapus kolom kosong
    columns_to_drop = []

    for column in df.columns:

        column_name = str(
            column
        ).strip()

        if column_name.lower().startswith(
            "unnamed"
        ):

            values = (
                df[column]
                .astype("string")
                .str.strip()
            )

            if values.dropna().empty:
                columns_to_drop.append(
                    column
                )

    if columns_to_drop:

        df = df.drop(
            columns=columns_to_drop
        )

    # Hapus kolom dan baris kosong
    df = df.dropna(
        axis=1,
        how="all"
    )

    df = df.dropna(
        axis=0,
        how="all"
    )

    # Rapikan nama kolom
    df.columns = [
        str(column).strip()
        for column in df.columns
    ]

    return df.reset_index(
        drop=True
    )


# =====================================================
# PROFIL KOLOM
# =====================================================

def get_column_profile(df):

    profile = []

    for column in df.columns:

        series = df[column]

        non_empty = series.dropna()

        unique = (
            non_empty
            .astype(str)
            .str.strip()
            .unique()
        )

        profile.append({
            "column": str(column),
            "total": len(series),
            "non_empty": len(non_empty),
            "empty": len(series) - len(non_empty),
            "unique": len(unique)
        })

    return profile


# =====================================================
# HEADER VALUES
# =====================================================

def get_header_values(
    filepath,
    sheet_name,
    header_row
):

    df = pd.read_excel(
        filepath,
        sheet_name=sheet_name,
        header=None
    )

    index = int(header_row) - 1

    if (
        index < 0
        or index >= len(df)
    ):
        return []

    row = df.iloc[index]

    result = []

    for value in row.tolist():

        if pd.isna(value):
            result.append("")

        else:
            result.append(
                str(value).strip()
            )

    return result
