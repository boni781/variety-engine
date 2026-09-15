def normalize_value(value):
    """
    Normalisasi nilai umum:
    - ubah menjadi string
    - hapus spasi di awal/akhir
    - ubah menjadi lowercase
    - gabungkan whitespace berlebih
    """
    if value is None:
        return ""

    text = str(value).strip().lower()
    text = " ".join(text.split())

    return text


def normalize_variety(value):
    """
    Normalisasi nama varietas.

    Semua whitespace dihilangkan sehingga:
    BM 1612  -> bm1612
    BM1612   -> bm1612
    BM  1612 -> bm1612
    TK 316   -> tk316
    TK316    -> tk316
    """
    if value is None:
        return ""

    text = str(value).strip().lower()

    # Hilangkan seluruh whitespace
    text = "".join(text.split())

    return text


def values_equal(value_a, value_b, parameter=None):
    """
    Membandingkan dua nilai setelah normalisasi.

    Untuk parameter varietas, perbandingan menggunakan
    normalize_variety().
    """
    if parameter and str(parameter).lower() in {
        "varietas",
        "variety",
        "nama varietas",
        "nama_varietas",
    }:
        return normalize_variety(value_a) == normalize_variety(value_b)

    return normalize_value(value_a) == normalize_value(value_b)


def find_duplicate_candidates(values):
    """
    Mencari nilai yang menjadi duplikat setelah normalisasi umum.
    """
    groups = {}

    for value in values:
        normalized = normalize_value(value)

        if not normalized:
            continue

        groups.setdefault(normalized, []).append(value)

    return {
        normalized: original_values
        for normalized, original_values in groups.items()
        if len(original_values) > 1
    }


def find_space_variants(values):
    """
    Mencari variasi nama varietas yang sebenarnya sama
    karena perbedaan spasi atau kapitalisasi.

    Contoh:
    BM 1612
    BM1612
    bm 1612

    akan masuk dalam satu kelompok.
    """
    groups = {}

    for value in values:
        normalized = normalize_variety(value)

        if not normalized:
            continue

        groups.setdefault(normalized, []).append(value)

    return {
        normalized: original_values
        for normalized, original_values in groups.items()
        if len(set(map(str, original_values))) > 1
    }


def compare_varieties(excel_values, master_varieties):
    """
    Membandingkan varietas dari Excel dengan master varietas.

    Perbedaan kapitalisasi dan whitespace dianggap sama.
    """
    master_map = {}

    for master in master_varieties:
        normalized = normalize_variety(master)

        if normalized:
            master_map[normalized] = master

    result = []

    for excel_value in excel_values:
        normalized = normalize_variety(excel_value)

        result.append({
            "excel_value": excel_value,
            "normalized": normalized,
            "matched": normalized in master_map,
            "master_value": master_map.get(normalized),
        })

    return result

def normalize_for_filter(value, parameter_type="text", mode="default"):
    """
    Normalisasi fleksibel untuk kebutuhan filtering.

    parameter_type:
    - text
    - numeric

    mode:
    - default : menggunakan normalize_value()
    - variety : menggunakan normalize_variety()
    - compact : menghilangkan seluruh whitespace
    """

    # =====================================================
    # NUMERIC
    # =====================================================

    if parameter_type == "numeric":

        if value is None:
            return None

        try:
            return float(value)

        except (ValueError, TypeError):
            return None


    # =====================================================
    # TEXT
    # =====================================================

    if mode == "variety":
        return normalize_variety(value)

    if mode == "compact":
        if value is None:
            return ""

        return "".join(
            str(value).strip().lower().split()
        )


    # =====================================================
    # DEFAULT
    # =====================================================

    return normalize_value(value)