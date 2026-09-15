const state = {
  filename: "",
  sheet: "",
  header: null
};

function saveAppState() {

    try {

        const snapshot = {
            filename: state.filename,
            sheet: state.sheet,
            header: state.header,

            previewVisible:
                !$("headerPreview").classList.contains("hidden"),

            filterApplied:
                !$("filteredTableBody").querySelector(".empty-state") ||
                Number($("filteredCount").textContent || 0) > 0,

            selectedFilters:
                JSON.parse(
                    JSON.stringify(
                        selectedFilters
                    )
                )
        };

        localStorage.setItem(
            "variety_engine_state",
            JSON.stringify(snapshot)
        );

    } catch (error) {

        console.warn(
            "[Variety Engine] Gagal menyimpan state:",
            error
        );

    }

}

const $ = (id) =>
  document.getElementById(id);


// =====================================================
// UI
// =====================================================

function showLoading(
  message = "Memproses..."
) {

  $("loadingText").textContent =
    message;

  $("loading").classList.remove(
    "hidden"
  );
}


function hideLoading() {

  $("loading").classList.add(
    "hidden"
  );
}


function showToast(message) {

  $("toast").textContent =
    message;

  $("toast").classList.remove(
    "hidden"
  );

  setTimeout(() => {

    $("toast").classList.add(
      "hidden"
    );

  }, 3500);
}


async function api(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      options
    );

  
  const data =
    await response.json();


  if (
    !response.ok
    ||
    data.success === false
  ) {

    throw new Error(
      data.message
      ||
      "Terjadi kesalahan."
    );

  }

  return data;
}


// =====================================================
// UPLOAD EXCEL
// =====================================================

$("uploadBtn")
  .addEventListener(
    "click",
    async () => {

      const file =
        $("excelFile").files[0];

      if (!file) {

        showToast(
          "Silakan pilih file Excel terlebih dahulu."
        );

        return;
      }

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      try {

        showLoading(
          "Mengunggah dan membaca Excel..."
        );

        const data =
          await api(
            "/api/upload",
            {
              method: "POST",
              body: formData
            }
          );

        state.filename =
          data.filename;

        state.sheet = "";
        state.header = null;
        selectedFilters.length = 0;

        saveAppState();  

        $("fileInfo").textContent =
          `File aktif: ${data.filename} • ${data.sheets.length} sheet`;

        $("fileInfo")
          .classList
          .remove("hidden");

        populateSheets(
          data.sheets
        );


        showToast(
          "File Excel berhasil dimuat."
        );

      } catch (error) {

        showToast(
          error.message
        );

      } finally {

        hideLoading();

      }

    }
  );


// =====================================================
// SHEET
// =====================================================

function populateSheets(
  sheets
) {

  const select =
    $("sheetSelect");

  select.innerHTML =
    '<option value="">Pilih Sheet</option>';

  $("headerSelect").innerHTML =
    '<option value="">Pilih Header</option>';

  $("headerPreview")
    .classList
    .add("hidden");
  
  sheets.forEach(
    sheet => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        sheet;

      option.textContent =
        sheet;

      select.appendChild(
        option
      );

    }
  );

  select.disabled =
    false;

  $("headerSelect").disabled =
    true;

  $("previewBtn").disabled =
    true;
}


$("sheetSelect")
  .addEventListener(
    "change",
    async () => {

      const sheet =
        $("sheetSelect").value;

      if (!sheet) {

        $("headerSelect").disabled =
          true;

        $("previewBtn").disabled =
          true;

        return;
      }

      state.sheet =
        sheet;

      state.header = null;
      selectedFilters.length = 0;

      saveAppState();

      try {

        showLoading(
          "Mencari kandidat header..."
        );

        const data =
          await api(
            `/api/headers?sheet=${encodeURIComponent(sheet)}`
          );

        populateHeaders(
          data.candidates
        );

      } catch (error) {

        showToast(
          error.message
        );

      } finally {

        hideLoading();

      }

    }
  );


// =====================================================
// HEADER
// =====================================================

function populateHeaders(
  candidates
) {

  const select =
    $("headerSelect");

  select.innerHTML =
    '<option value="">Pilih Header</option>';

  candidates.forEach(
    candidate => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        candidate.row_number;

      option.textContent =
        `Baris ${candidate.row_number} — ${candidate.non_empty} kolom`;

      option.dataset.preview =
        candidate.header_preview || "";

      select.appendChild(
        option
      );

    }
  );

  select.disabled =
    candidates.length === 0;

  if (!candidates.length) {

    showToast(
      "Tidak ditemukan kandidat header pada 30 baris pertama."
    );

  }
}


$("headerSelect")
  .addEventListener(
    "change",
    () => {

      const option =
        $("headerSelect")
        .selectedOptions[0];

      const value =
        $("headerSelect").value;

      if (!value) {

        $("headerPreview")
          .classList
          .add("hidden");

        $("previewBtn").disabled =
          true;

        return;
      }

      $("headerPreview").innerHTML =
        `<strong>Preview Header:</strong><br>${escapeHtml(
          option.dataset.preview || ""
        )}`;

      $("headerPreview")
        .classList
        .remove("hidden");

      $("previewBtn").disabled =
        false;

      state.header =
        Number(value);

      saveAppState();

      loadParameters();

    }
  );


// =====================================================
// PREVIEW
// =====================================================

$("previewBtn")
  .addEventListener(
    "click",
    async () => {

      if (
        !state.sheet
        ||
        !state.header
      ) {

        showToast(
          "Sheet dan header harus dipilih."
        );

        return;
      }

      try {

        showLoading(
          "Membaca data..."
        );

        const data =
          await api(
            `/api/preview?sheet=${encodeURIComponent(state.sheet)}&header=${state.header}&limit=100`
          );

        renderPreview(
          data
        );

        saveAppState();

      } catch (error) {

        showToast(
          error.message
        );

      } finally {

        hideLoading();

      }

    }
  );


function renderPreview(
  data
) {

  $("kpiSheet").textContent =
    data.sheet;

  $("kpiHeader").textContent =
    `Baris ${data.header_row}`;

  $("kpiRows").textContent =
    Number(
      data.total_rows
    ).toLocaleString(
      "id-ID"
    );

  $("kpiColumns").textContent =
    Number(
      data.total_columns
    ).toLocaleString(
      "id-ID"
    );

  $("countText").textContent =
    `${data.rows.length.toLocaleString("id-ID")} preview / ${data.total_rows.toLocaleString("id-ID")} data`;


  const thead =
    $("tableHead");

  const tbody =
    $("tableBody");

  thead.innerHTML =
    "";

  tbody.innerHTML =
    "";


  if (!data.columns.length) {

    tbody.innerHTML =
      `<tr>
        <td class="empty">
          Tidak ada kolom.
        </td>
      </tr>`;

    return;
  }


  const headerRow =
    document.createElement(
      "tr"
    );


  data.columns.forEach(
    (column, index) => {

      const th =
        document.createElement(
          "th"
        );

      th.textContent =
        column
        ||
        `Kolom ${index + 1}`;

      headerRow.appendChild(
        th
      );

    }
  );


  thead.appendChild(
    headerRow
  );


  if (!data.rows.length) {

    const tr =
      document.createElement(
        "tr"
      );

    const td =
      document.createElement(
        "td"
      );

    td.colSpan =
      data.columns.length;

    td.className =
      "empty";

    td.textContent =
      "Tidak ada data.";

    tr.appendChild(
      td
    );

    tbody.appendChild(
      tr
    );

    return;
  }


  data.rows.forEach(
    row => {

      const tr =
        document.createElement(
          "tr"
        );

      data.columns.forEach(
        column => {

          const td =
            document.createElement(
              "td"
            );

          let value =
            row[column];

          if (
            value === null
            ||
            value === undefined
          ) {
            value = "";
          }

          td.textContent =
            value;

          tr.appendChild(
            td
          );

        }
      );

      tbody.appendChild(
        tr
      );

    }
  );
}

// =====================================================
// ESCAPE
// =====================================================

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


// =====================================================
// PARAMETER BUILDER
// =====================================================

const selectedFilters = [];

// =========================================================
// EXPORT DATA MODAL
// =========================================================

const exportDataBtn = document.getElementById("exportDataBtn");
const exportDataModal = document.getElementById("exportDataModal");
const closeExportDataModal = document.getElementById("closeExportDataModal");
const cancelExportDataBtn = document.getElementById("cancelExportDataBtn");

if (exportDataBtn && exportDataModal) {
  exportDataBtn.addEventListener("click", () => {
    exportDataModal.classList.remove("hidden");
  });
}

if (closeExportDataModal && exportDataModal) {
  closeExportDataModal.addEventListener("click", () => {
    exportDataModal.classList.add("hidden");
  });
}

if (cancelExportDataBtn && exportDataModal) {
  cancelExportDataBtn.addEventListener("click", () => {
    exportDataModal.classList.add("hidden");
  });
}

// =====================================================
// LOAD PARAMETERS
// =====================================================

async function loadParameters() {

    const sheet =
        $("sheetSelect").value;

    const header =
        $("headerSelect").value;

    const parameterSelect =
        $("parameterSelect");

    if (!sheet || !header) {

        parameterSelect.innerHTML =
            '<option value="">Pilih parameter...</option>';

        parameterSelect.disabled =
            true;

        return;
    }

    try {

        showLoading(
            "Membaca daftar parameter..."
        );

        const data =
            await api(
                `/api/parameters?sheet=${encodeURIComponent(sheet)}&header=${encodeURIComponent(header)}`
            );


        parameterSelect.innerHTML =
            '<option value="">Pilih parameter...</option>';


        data.parameters.forEach(
            parameter => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    parameter.name;

                option.textContent =
                    `${parameter.name} (${parameter.type})`;

                option.dataset.type =
                    parameter.type;

                option.dataset.nonEmpty =
                    parameter.non_empty;

                parameterSelect.appendChild(
                    option
                );

            }
        );


        parameterSelect.disabled =
            false;


    } catch (error) {

        console.error(
            "[Variety Engine] Gagal memuat parameter:",
            error
        );

        showToast(
            error.message
        );

    } finally {

        hideLoading();

    }

}


// =====================================================
// DAFTAR ATRIBUT / KOLOM
// =====================================================

function getAvailableParameters() {

    return Array
        .from(
            $("parameterSelect").options
        )
        .filter(
            option =>
                option.value
        )
        .map(
            option => ({

                name:
                    option.value,

                type:
                    option.dataset.type ||
                    "text"

            })
        );

}


// =====================================================
// CONDITION KOSONG
// =====================================================

function createCondition() {

    return {

        parameter:
            "",

        type:
            "text",

        operator:
            "=",

        value:
            [],

        groups:
            [],

        loading:
            false,

        loadError:
            ""

    };

}


// =====================================================
// PARAMETER / KELOMPOK KOSONG
// =====================================================

function createParameterGroup() {

    return {

        name:
            `Parameter ${selectedFilters.length + 1}`,

        conditions: [
            createCondition()
        ],

        comment:
            ""

    };

}


// =====================================================
// TAMBAH PARAMETER
// =====================================================

$("addParameterBtn")
    .addEventListener(
        "click",
        () => {

            const group =
                createParameterGroup();


            selectedFilters.push(
                group
            );


            saveAppState();

            renderSelectedFilters();

        }
    );


// =====================================================
// RENDER PARAMETER
// =====================================================

function renderSelectedFilters() {

    const container =
        $("selectedParameters");

    const applyButton =
        $("applyFilterBtn");


    if (!selectedFilters.length) {

        container.innerHTML = `
            <div class="empty-state">
                Belum ada parameter yang dibuat.
            </div>
        `;

        applyButton.disabled =
            true;

        return;

    }


    container.innerHTML =
        "";


    selectedFilters.forEach(
        (group, groupIndex) => {

            const wrapper =
                document.createElement(
                    "div"
                );

            wrapper.className =
                "parameter-group";


            // =================================================
            // HEADER PARAMETER
            // =================================================

            const header =
                document.createElement(
                    "div"
                );

            header.className =
                "parameter-group-header";


            header.innerHTML = `

                <div class="parameter-group-title">

                    <span class="parameter-group-number">
                        ${groupIndex + 1}
                    </span>

                    <input
                        type="text"
                        class="parameter-group-name"
                        data-group-index="${groupIndex}"
                        value="${escapeHtml(
                            group.name || ""
                        )}"
                        placeholder="Nama parameter"
                    >

                </div>


                <div class="parameter-group-meta">

                    <span class="parameter-group-count">
                        ${group.conditions.length}
                        FILTER
                    </span>


                    <button
                        type="button"
                        class="remove-parameter-group"
                        data-group-index="${groupIndex}"
                        title="Hapus parameter"
                    >
                        ×
                    </button>

                </div>

            `;


            wrapper.appendChild(
                header
            );


            // =================================================
            // BODY
            // =================================================

            const body =
                document.createElement(
                    "div"
                );

            body.className =
                "parameter-group-body";


            // =================================================
            // LABEL FILTER
            // =================================================

            const filterLabel =
                document.createElement(
                    "div"
                );

            filterLabel.className =
                "parameter-filter-label";

            filterLabel.textContent =
                "Filter";


            body.appendChild(
                filterLabel
            );


            // =================================================
            // SETIAP FILTER / ATRIBUT
            // =================================================

            group.conditions.forEach(
                (
                    condition,
                    conditionIndex
                ) => {

                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "parameter-condition";


                    // =============================================
                    // PILIH ATRIBUT / KOLOM
                    // =============================================

                    const attributeSelect =
                        document.createElement(
                            "select"
                        );

                    attributeSelect.className =
                        "parameter-condition-select";

                    attributeSelect.dataset.groupIndex =
                        groupIndex;

                    attributeSelect.dataset.conditionIndex =
                        conditionIndex;


                    attributeSelect.innerHTML = `
                        <option value="">
                            Pilih atribut...
                        </option>
                    `;


                    getAvailableParameters()
                        .forEach(
                            parameter => {

                                const option =
                                    document.createElement(
                                        "option"
                                    );

                                option.value =
                                    parameter.name;

                                option.textContent =
                                    parameter.name;

                                option.dataset.type =
                                    parameter.type;


                                if (
                                    condition.parameter ===
                                    parameter.name
                                ) {

                                    option.selected =
                                        true;

                                }


                                attributeSelect.appendChild(
                                    option
                                );

                            }
                        );


                    row.appendChild(
                        attributeSelect
                    );


                    // =============================================
                    // OPERATOR
                    // =============================================

                    const operatorSelect =
                        document.createElement(
                            "select"
                        );

                    operatorSelect.className =
                        "parameter-condition-operator";

                    operatorSelect.dataset.groupIndex =
                        groupIndex;

                    operatorSelect.dataset.conditionIndex =
                        conditionIndex;


                    operatorSelect.innerHTML = `

                        <option value="=">=</option>

                        <option value="!=">≠</option>

                        <option value=">">&gt;</option>

                        <option value=">=">&ge;</option>

                        <option value="<">&lt;</option>

                        <option value="<=">&le;</option>

                        <option value="BETWEEN">
                            BETWEEN
                        </option>

                    `;


                    operatorSelect.value =
                        condition.operator || "=";


                    row.appendChild(
                        operatorSelect
                    );


                    // =============================================
                    // VALUE
                    // =============================================

                    const valueContainer =
                        document.createElement(
                            "div"
                        );

                    valueContainer.className =
                        "parameter-condition-value";


                    // ---------------------------------------------
                    // TEXT / OBJECT
                    // ---------------------------------------------

                    if (
                        condition.parameter &&
                        (
                            condition.type === "text" ||
                            condition.type === "object"
                        )
                    ) {

                        valueContainer.innerHTML = `

                            <div class="parameter-value-box">

                                <input
                                    type="text"
                                    class="parameter-search"
                                    data-group-index="${groupIndex}"
                                    data-condition-index="${conditionIndex}"
                                    placeholder="🔍 Cari nilai..."
                                >


                                <div
                                    class="parameter-options"
                                    data-group-index="${groupIndex}"
                                    data-condition-index="${conditionIndex}"
                                ></div>


                                <div
                                    class="parameter-selected-count"
                                    data-group-index="${groupIndex}"
                                    data-condition-index="${conditionIndex}"
                                >
                                    0 nilai dipilih
                                </div>

                            </div>

                        `;

                    }


                    // ---------------------------------------------
                    // NUMERIC
                    // ---------------------------------------------

                    else if (
                        condition.parameter &&
                        condition.type === "numeric"
                    ) {

                        const isBetween =
                            condition.operator ===
                            "BETWEEN";


                        let minValue =
                            "";

                        let maxValue =
                            "";


                        if (
                            isBetween
                        ) {

                            if (
                                Array.isArray(
                                    condition.value
                                )
                            ) {

                                minValue =
                                    condition.value[0] ??
                                    "";

                                maxValue =
                                    condition.value[1] ??
                                    "";

                            }

                        }

                        else {

                            minValue =
                                Array.isArray(
                                    condition.value
                                )
                                    ? (
                                        condition.value[0] ??
                                        ""
                                    )
                                    : (
                                        condition.value ??
                                        ""
                                    );

                        }


                        valueContainer.innerHTML = `

                            <div
                                class="numeric-filter-controls"
                            >

                                ${
                                    isBetween
                                        ? `

                                            <input
                                                type="number"
                                                class="filter-value condition-value-min"
                                                data-group-index="${groupIndex}"
                                                data-condition-index="${conditionIndex}"
                                                value="${escapeHtml(
                                                    minValue
                                                )}"
                                                placeholder="Minimum"
                                            >

                                            <span
                                                class="between-separator"
                                            >
                                                sampai
                                            </span>

                                            <input
                                                type="number"
                                                class="filter-value condition-value-max"
                                                data-group-index="${groupIndex}"
                                                data-condition-index="${conditionIndex}"
                                                value="${escapeHtml(
                                                    maxValue
                                                )}"
                                                placeholder="Maksimum"
                                            >

                                        `
                                        : `

                                            <input
                                                type="number"
                                                class="filter-value condition-value"
                                                data-group-index="${groupIndex}"
                                                data-condition-index="${conditionIndex}"
                                                value="${escapeHtml(
                                                    minValue
                                                )}"
                                                placeholder="Masukkan nilai"
                                            >

                                        `
                                }

                            </div>

                        `;

                    }


                    // ---------------------------------------------
                    // BELUM MEMILIH ATRIBUT
                    // ---------------------------------------------

                    else {

                        valueContainer.innerHTML = `

                            <div
                                class="parameter-empty-value"
                            >
                                Pilih atribut terlebih dahulu
                            </div>

                        `;

                    }


                    row.appendChild(
                        valueContainer
                    );


                    // =============================================
                    // HAPUS FILTER
                    // =============================================

                    const removeCondition =
                        document.createElement(
                            "button"
                        );

                    removeCondition.type =
                        "button";

                    removeCondition.className =
                        "remove-condition";

                    removeCondition.dataset.groupIndex =
                        groupIndex;

                    removeCondition.dataset.conditionIndex =
                        conditionIndex;

                    removeCondition.title =
                        "Hapus filter";

                    removeCondition.textContent =
                        "×";


                    row.appendChild(
                        removeCondition
                    );


                    body.appendChild(
                        row
                    );

                }
            );


            // =================================================
            // TAMBAH FILTER
            // =================================================

            const addConditionButton =
                document.createElement(
                    "button"
                );

            addConditionButton.type =
                "button";

            addConditionButton.className =
                "add-condition-button";

            addConditionButton.dataset.groupIndex =
                groupIndex;

            addConditionButton.textContent =
                "+ Tambah Filter";


            body.appendChild(
                addConditionButton
            );


            // =================================================
            // KOMENTAR
            // =================================================

            const commentWrapper =
                document.createElement(
                    "div"
                );

            commentWrapper.className =
                "parameter-comment";


            commentWrapper.innerHTML = `

                <label
                    class="parameter-comment-label"
                >
                    Komentar
                </label>


                <textarea
                    class="parameter-comment-input"
                    data-group-index="${groupIndex}"
                    placeholder="Masukkan komentar..."
                    rows="1"
                >${escapeHtml(
                    group.comment || ""
                )}</textarea>

            `;


            body.appendChild(
                commentWrapper
            );


            wrapper.appendChild(
                body
            );


            container.appendChild(
                wrapper
            );

            // =================================================
            // RENDER NILAI SETELAH PARAMETER MASUK DOM
            // =================================================

            group.conditions.forEach(
                (condition, conditionIndex) => {

                    if (
                        condition.parameter &&
                        (
                            condition.type === "text" ||
                            condition.type === "object"
                        )
                    ) {

                        renderConditionOptions(
                            groupIndex,
                            conditionIndex
                        );

                    }

                }
            );

        }
    );


    applyButton.disabled =
        false;


    bindParameterBuilderEvents();

}


// =====================================================
// RENDER NILAI ATRIBUT
// =====================================================

function renderConditionOptions(
    groupIndex,
    conditionIndex
) {

    const group =
        selectedFilters[groupIndex];

    if (!group) {
        return;
    }


    const condition =
        group.conditions[
            conditionIndex
        ];

    if (!condition) {
        return;
    }


    const container =
        document.querySelector(
            `.parameter-options[data-group-index="${groupIndex}"][data-condition-index="${conditionIndex}"]`
        );


    const countElement =
        document.querySelector(
            `.parameter-selected-count[data-group-index="${groupIndex}"][data-condition-index="${conditionIndex}"]`
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    // ---------------------------------------------
    // LOADING
    // ---------------------------------------------

    if (
        condition.loading
    ) {

        container.innerHTML = `

            <div class="parameter-no-data">

                <span class="parameter-loading">

                    <span
                        class="parameter-loading-spinner"
                    ></span>

                    Memuat nilai...

                </span>

            </div>

        `;

        return;

    }


    // ---------------------------------------------
    // ERROR
    // ---------------------------------------------

    if (
        condition.loadError
    ) {

        container.innerHTML = `

            <div
                class="parameter-no-data"
                style="color:#c0392b;"
            >
                ⚠ ${escapeHtml(
                    condition.loadError
                )}
            </div>

        `;

        return;

    }


    // ---------------------------------------------
    // KOSONG
    // ---------------------------------------------

    if (
        !condition.groups ||
        !condition.groups.length
    ) {

        container.innerHTML = `

            <div class="parameter-no-data">
                Tidak ada nilai.
            </div>

        `;

        return;

    }


    const selectedValues =
        Array.isArray(
            condition.value
        )
            ? condition.value
            : [];


    // ---------------------------------------------
    // RENDER CHECKBOX
    // ---------------------------------------------

    condition.groups.forEach(
        groupData => {

            const normalized =
                groupData.normalized;


            const isSelected =
                selectedValues.includes(
                    normalized
                );


            const label =
                document.createElement(
                    "label"
                );

            label.className =
                "parameter-option";


            label.dataset.search =
                groupData.values
                    .join(" ")
                    .toLowerCase();


            label.innerHTML = `

                <input
                    type="checkbox"
                    class="condition-checkbox"
                    data-group-index="${groupIndex}"
                    data-condition-index="${conditionIndex}"
                    value="${escapeHtml(
                        normalized
                    )}"
                    ${
                        isSelected
                            ? "checked"
                            : ""
                    }
                >


                <span
                    class="parameter-option-label"
                >

                    <span
                        class="parameter-option-name"
                    >
                        ${escapeHtml(
                            groupData.values.join(
                                " / "
                            )
                        )}
                    </span>


                    <span
                        class="parameter-option-count"
                    >
                        ${Number(
                            groupData.count
                        ).toLocaleString(
                            "id-ID"
                        )}
                    </span>

                </span>

            `;


            container.appendChild(
                label
            );

        }
    );


    updateConditionSelectedCount(
        groupIndex,
        conditionIndex
    );

}


// =====================================================
// JUMLAH NILAI TERPILIH
// =====================================================

function updateConditionSelectedCount(
    groupIndex,
    conditionIndex
) {

    const condition =
        selectedFilters[
            groupIndex
        ]
            ?.conditions[
                conditionIndex
            ];


    const countElement =
        document.querySelector(
            `.parameter-selected-count[data-group-index="${groupIndex}"][data-condition-index="${conditionIndex}"]`
        );


    if (
        !condition ||
        !countElement
    ) {
        return;
    }


    const count =
        Array.isArray(
            condition.value
        )
            ? condition.value.length
            : 0;


    countElement.textContent =
        `${count.toLocaleString(
            "id-ID"
        )} nilai dipilih`;

}


// =====================================================
// LOAD NILAI ATRIBUT
// =====================================================

async function loadConditionValues(
    groupIndex,
    conditionIndex
) {

    const group =
        selectedFilters[
            groupIndex
        ];


    if (!group) {
        return;
    }


    const condition =
        group.conditions[
            conditionIndex
        ];


    if (
        !condition ||
        !condition.parameter
    ) {
        return;
    }


    condition.loading =
        true;

    condition.loadError =
        "";


    renderSelectedFilters();


    try {

        const url =
            `/api/group-values` +
            `?sheet=${encodeURIComponent(
                state.sheet
            )}` +
            `&header=${encodeURIComponent(
                state.header
            )}` +
            `&parameter=${encodeURIComponent(
                condition.parameter
            )}`;


        console.log(
            "[Variety Engine] Memuat nilai atribut:",
            condition.parameter
        );


        const data =
            await api(
                url
            );


        condition.groups =
            Array.isArray(
                data.groups
            )
                ? data.groups
                : [];


        condition.loading =
            false;


        renderSelectedFilters();


    } catch (error) {

        console.error(
            "[Variety Engine] Gagal memuat nilai atribut:",
            error
        );


        condition.loading =
            false;

        condition.loadError =
            error.message ||
            "Gagal memuat nilai.";

        condition.groups =
            [];


        renderSelectedFilters();


        showToast(
            `Gagal memuat ${condition.parameter}: ${condition.loadError}`
        );

    }

}


// =====================================================
// SEARCH NILAI
// =====================================================

function searchConditionValues(
    groupIndex,
    conditionIndex,
    keyword
) {

    const container =
        document.querySelector(
            `.parameter-options[data-group-index="${groupIndex}"][data-condition-index="${conditionIndex}"]`
        );


    if (!container) {
        return;
    }


    const search =
        String(
            keyword || ""
        )
            .trim()
            .toLowerCase();


    const options =
        Array.from(
            container.querySelectorAll(
                ".parameter-option"
            )
        );


    // Jika pencarian kosong,
    // tampilkan kembali semua rekomendasi
    if (!search) {

        options.forEach(
            option => {

                option.style.display =
                    "flex";

            }
        );

        return;
    }


    // -------------------------------------------------
    // HITUNG TINGKAT KEDEKATAN
    // -------------------------------------------------

    const normalizeSearch =
        value =>
            String(value || "")
                .toLowerCase()
                .replace(
                    /\s+/g,
                    ""
                );


    const normalizedSearch =
        normalizeSearch(search);

    const searchTokens =
        normalizedSearch
            .split("")
            .filter(Boolean);

    const rankedOptions =
        options.map(
            option => {

                const text =
                    option.dataset.search ||
                    "";


                const normalizedText =
                    normalizeSearch(text);


                let score =
                    0;

                let matchedCharacters = 0;

                let searchPosition = 0;

                for (
                    const character of searchTokens
                ) {

                    const foundPosition =
                        normalizedText.indexOf(
                            character,
                            searchPosition
                        );

                    if (
                        foundPosition !== -1
                    ) {

                        matchedCharacters++;

                        searchPosition =
                            foundPosition + 1;

                    }

                }

                if (
                    searchTokens.length > 0
                ) {

                    const similarity =
                        matchedCharacters /
                        searchTokens.length;

                    if (
                        similarity >= 0.8
                    ) {

                        score +=
                            Math.round(
                                similarity * 100
                            );

                    }

                }                    

                // -----------------------------------------
                // 1. PERSIS SAMA
                // -----------------------------------------

                if (
                    normalizedText ===
                    normalizedSearch
                ) {

                    score +=
                        1000;

                }


                // -----------------------------------------
                // 2. DIAWALI TEKS PENCARIAN
                // -----------------------------------------

                if (
                    normalizedText.startsWith(
                        normalizedSearch
                    )
                ) {

                    score +=
                        500;

                }


                // -----------------------------------------
                // 3. MENGANDUNG TEKS
                // -----------------------------------------

                if (
                    normalizedText.includes(
                        normalizedSearch
                    )
                ) {

                    score +=
                        300;

                }


                // -----------------------------------------
                // 4. KATA ASLI
                // -----------------------------------------

                if (
                    text.includes(
                        search
                    )
                ) {

                    score +=
                        200;

                }


                return {
                    option,
                    text: normalizedText,
                    score
                };

            }
        );


    // -------------------------------------------------
    // HANYA TAMPILKAN YANG RELEVAN
    // -------------------------------------------------

    const matched =
        rankedOptions
            .filter(
                item =>
                    item.score > 0
            )
            .sort(
                (a, b) => {

                    if (
                        b.score !==
                        a.score
                    ) {

                        return (
                            b.score -
                            a.score
                        );

                    }


                    // Jika skor sama,
                    // yang lebih pendek lebih dekat
                    return (
                        a.text.length -
                        b.text.length
                    );

                }
            );


    // -------------------------------------------------
    // URUTKAN ULANG REKOMENDASI
    // -------------------------------------------------

    matched.forEach(
        item => {

            item.option.style.display =
                "flex";

            container.appendChild(
                item.option
            );

        }
    );


    // -------------------------------------------------
    // SEMBUNYIKAN YANG TIDAK COCOK
    // -------------------------------------------------

    rankedOptions
        .filter(
            item =>
                item.score === 0
        )
        .forEach(
            item => {

                item.option.style.display =
                    "none";

            }
        );

}

// =====================================================
// BUILDER EVENTS
// =====================================================

function bindParameterBuilderEvents() {


    // =================================================
    // NAMA PARAMETER
    // =================================================

    document
        .querySelectorAll(
            ".parameter-group-name"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    () => {

                        const groupIndex =
                            Number(
                                input.dataset.groupIndex
                            );


                        if (
                            selectedFilters[
                                groupIndex
                            ]
                        ) {

                            selectedFilters[
                                groupIndex
                            ].name =
                                input.value;


                            saveAppState();

                        }

                    }
                );

            }
        );


    // =================================================
    // HAPUS PARAMETER
    // =================================================

    document
        .querySelectorAll(
            ".remove-parameter-group"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const groupIndex =
                            Number(
                                button.dataset.groupIndex
                            );


                        selectedFilters.splice(
                            groupIndex,
                            1
                        );


                        saveAppState();

                        renderSelectedFilters();

                    }
                );

            }
        );


    // =================================================
    // PILIH ATRIBUT
    // =================================================

    document
        .querySelectorAll(
            ".parameter-condition-select"
        )
        .forEach(
            select => {

                select.addEventListener(
                    "change",
                    async () => {

                        const groupIndex =
                            Number(
                                select.dataset.groupIndex
                            );

                        const conditionIndex =
                            Number(
                                select.dataset.conditionIndex
                            );


                        const condition =
                            selectedFilters[
                                groupIndex
                            ]
                                ?.conditions[
                                    conditionIndex
                                ];


                        if (!condition) {
                            return;
                        }


                        const option =
                            select.selectedOptions[0];


                        condition.parameter =
                            select.value;


                        condition.type =
                            option
                                ? (
                                    option.dataset.type ||
                                    "text"
                                )
                                : "text";


                        condition.operator =
                            "=";


                        condition.value =
                            (
                                condition.type === "text" ||
                                condition.type === "object"
                            )
                                ? []
                                : "";


                        condition.groups =
                            [];

                        condition.loading =
                            false;

                        condition.loadError =
                            "";


                        saveAppState();


                        renderSelectedFilters();


                        if (
                            condition.parameter
                        ) {

                            await loadConditionValues(
                                groupIndex,
                                conditionIndex
                            );

                        }

                    }
                );

            }
        );


    // =================================================
    // OPERATOR
    // =================================================

    document
        .querySelectorAll(
            ".parameter-condition-operator"
        )
        .forEach(
            select => {

                select.addEventListener(
                    "change",
                    () => {

                        const groupIndex =
                            Number(
                                select.dataset.groupIndex
                            );

                        const conditionIndex =
                            Number(
                                select.dataset.conditionIndex
                            );


                        const condition =
                            selectedFilters[
                                groupIndex
                            ]
                                ?.conditions[
                                    conditionIndex
                                ];


                        if (!condition) {
                            return;
                        }


                        condition.operator =
                            select.value;


                        if (
                            select.value ===
                            "BETWEEN"
                        ) {

                            if (
                                !Array.isArray(
                                    condition.value
                                )
                            ) {

                                condition.value = [
                                    condition.value ||
                                    "",

                                    ""
                                ];

                            }

                        }

                        else {

                            if (
                                Array.isArray(
                                    condition.value
                                )
                            ) {

                                condition.value =
                                    condition.value[0] ||
                                    "";

                            }

                        }


                        saveAppState();

                        renderSelectedFilters();

                    }
                );

            }
        );


    // =================================================
    // TAMBAH FILTER
    // =================================================

    document
        .querySelectorAll(
            ".add-condition-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const groupIndex =
                            Number(
                                button.dataset.groupIndex
                            );


                        const group =
                            selectedFilters[
                                groupIndex
                            ];


                        if (!group) {
                            return;
                        }


                        group.conditions.push(
                            createCondition()
                        );


                        saveAppState();

                        renderSelectedFilters();

                    }
                );

            }
        );


    // =================================================
    // HAPUS FILTER
    // =================================================

    document
        .querySelectorAll(
            ".remove-condition"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const groupIndex =
                            Number(
                                button.dataset.groupIndex
                            );


                        const conditionIndex =
                            Number(
                                button.dataset.conditionIndex
                            );


                        const group =
                            selectedFilters[
                                groupIndex
                            ];


                        if (!group) {
                            return;
                        }


                        if (
                            group.conditions.length <=
                            1
                        ) {

                            showToast(
                                "Minimal harus ada 1 filter."
                            );

                            return;

                        }


                        group.conditions.splice(
                            conditionIndex,
                            1
                        );


                        saveAppState();

                        renderSelectedFilters();

                    }
                );

            }
        );


    // =================================================
    // CHECKBOX NILAI
    // =================================================

    document
        .querySelectorAll(
            ".condition-checkbox"
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    "change",
                    () => {

                        const groupIndex =
                            Number(
                                checkbox.dataset.groupIndex
                            );

                        const conditionIndex =
                            Number(
                                checkbox.dataset.conditionIndex
                            );


                        const condition =
                            selectedFilters[
                                groupIndex
                            ]
                                ?.conditions[
                                    conditionIndex
                                ];


                        if (!condition) {
                            return;
                        }


                        if (
                            !Array.isArray(
                                condition.value
                            )
                        ) {

                            condition.value =
                                [];

                        }


                        if (
                            checkbox.checked
                        ) {

                            if (
                                !condition.value.includes(
                                    checkbox.value
                                )
                            ) {

                                condition.value.push(
                                    checkbox.value
                                );

                            }

                        }

                        else {

                            condition.value =
                                condition.value.filter(
                                    value =>
                                        value !==
                                        checkbox.value
                                );

                        }


                        updateConditionSelectedCount(
                            groupIndex,
                            conditionIndex
                        );


                        saveAppState();

                    }
                );

            }
        );


    // =================================================
    // NILAI NUMERIC / TEXT
    // =================================================

    document
        .querySelectorAll(
            ".condition-value"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    () => {

                        const groupIndex =
                            Number(
                                input.dataset.groupIndex
                            );

                        const conditionIndex =
                            Number(
                                input.dataset.conditionIndex
                            );


                        const condition =
                            selectedFilters[
                                groupIndex
                            ]
                                ?.conditions[
                                    conditionIndex
                                ];


                        if (!condition) {
                            return;
                        }


                        condition.value =
                            input.value;


                        saveAppState();

                    }
                );

            }
        );


    // =================================================
    // BETWEEN MINIMUM
    // =================================================

    document
        .querySelectorAll(
            ".condition-value-min"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    () => {

                        const groupIndex =
                            Number(
                                input.dataset.groupIndex
                            );

                        const conditionIndex =
                            Number(
                                input.dataset.conditionIndex
                            );


                        const condition =
                            selectedFilters[
                                groupIndex
                            ]
                                ?.conditions[
                                    conditionIndex
                                ];


                        if (!condition) {
                            return;
                        }


                        if (
                            !Array.isArray(
                                condition.value
                            )
                        ) {

                            condition.value = [
                                "",
                                ""
                            ];

                        }


                        condition.value[0] =
                            input.value;


                        saveAppState();

                    }
                );

            }
        );


    // =================================================
    // BETWEEN MAXIMUM
    // =================================================

    document
        .querySelectorAll(
            ".condition-value-max"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    () => {

                        const groupIndex =
                            Number(
                                input.dataset.groupIndex
                            );

                        const conditionIndex =
                            Number(
                                input.dataset.conditionIndex
                            );


                        const condition =
                            selectedFilters[
                                groupIndex
                            ]
                                ?.conditions[
                                    conditionIndex
                                ];


                        if (!condition) {
                            return;
                        }


                        if (
                            !Array.isArray(
                                condition.value
                            )
                        ) {

                            condition.value = [
                                "",
                                ""
                            ];

                        }


                        condition.value[1] =
                            input.value;


                        saveAppState();

                    }
                );

            }
        );


    // =================================================
    // SEARCH
    // =================================================

    document
        .querySelectorAll(
            ".parameter-search"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    () => {

                        searchConditionValues(
                            Number(
                                input.dataset.groupIndex
                            ),

                            Number(
                                input.dataset.conditionIndex
                            ),

                            input.value
                        );

                    }
                );

            }
        );


    // =================================================
    // KOMENTAR
    // =================================================

    document
        .querySelectorAll(
            ".parameter-comment-input"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    () => {

                        const groupIndex =
                            Number(
                                input.dataset.groupIndex
                            );


                        if (
                            selectedFilters[
                                groupIndex
                            ]
                        ) {

                            selectedFilters[
                                groupIndex
                            ].comment =
                                input.value;


                            saveAppState();

                        }

                    }
                );

            }
        );

}


// =====================================================
// APPLY FILTER
// =====================================================
$("applyFilterBtn")
    .addEventListener(
        "click",
        async () => {

            // ---------------------------------------------
            // VALIDASI PARAMETER
            // ---------------------------------------------

            if (!selectedFilters.length) {

                showToast(
                    "Belum ada parameter yang dipilih."
                );

                return;
            }


            // ---------------------------------------------
            // SINKRONISASI NILAI INPUT KE STATE
            // ---------------------------------------------

            selectedFilters.forEach(
                (filter, index) => {

                    // =========================================
                    // NUMERIC BETWEEN
                    // =========================================

                    if (
                        filter.type === "numeric" &&
                        filter.operator === "BETWEEN"
                    ) {

                        const minInput =
                            document.querySelector(
                                `.filter-value-min[data-index="${index}"]`
                            );

                        const maxInput =
                            document.querySelector(
                                `.filter-value-max[data-index="${index}"]`
                            );


                        const minimum =
                            minInput
                                ? minInput.value
                                : "";


                        const maximum =
                            maxInput
                                ? maxInput.value
                                : "";


                        filter.value = [
                            minimum,
                            maximum
                        ];

                    }

                    // =========================================
                    // NUMERIC BIASA
                    // =========================================

                    else if (
                        filter.type === "numeric"
                    ) {

                        const input =
                            document.querySelector(
                                `.filter-value[data-index="${index}"]`
                            );


                        if (input) {

                            filter.value =
                                input.value;

                        }

                    }

                }
            );


            // ---------------------------------------------
            // VALIDASI NILAI
            // ---------------------------------------------

            for (
                const filter
                of selectedFilters
            ) {

                // =========================================
                // TEXT / CATEGORICAL
                // =========================================

                if (
                    filter.type === "text" ||
                    filter.type === "object"
                ) {

                    if (
                        !Array.isArray(
                            filter.value
                        ) ||
                        filter.value.length === 0
                    ) {

                        showToast(
                            `Parameter "${filter.parameter}" belum memiliki nilai.`
                        );

                        return;
                    }

                }

                // =========================================
                // NUMERIC
                // =========================================

                else if (
                    filter.type === "numeric"
                ) {

                    // -----------------------------------------
                    // BETWEEN
                    // -----------------------------------------

                    if (
                        filter.operator === "BETWEEN"
                    ) {

                        if (
                            !Array.isArray(
                                filter.value
                            ) ||
                            filter.value.length < 2 ||
                            filter.value[0] === "" ||
                            filter.value[1] === ""
                        ) {

                            showToast(
                                `Parameter "${filter.parameter}" harus memiliki nilai minimum dan maksimum.`
                            );

                            return;
                        }


                        const minimum =
                            Number(
                                filter.value[0]
                            );

                        const maximum =
                            Number(
                                filter.value[1]
                            );


                        if (
                            !Number.isFinite(
                                minimum
                            ) ||
                            !Number.isFinite(
                                maximum
                            )
                        ) {

                            showToast(
                                `Nilai BETWEEN untuk "${filter.parameter}" tidak valid.`
                            );

                            return;
                        }


                        if (
                            minimum > maximum
                        ) {

                            showToast(
                                `Nilai minimum tidak boleh lebih besar dari maksimum.`
                            );

                            return;
                        }

                    }

                    // -----------------------------------------
                    // OPERATOR BIASA
                    // -----------------------------------------

                    else {

                        if (
                            filter.value === "" ||
                            filter.value === null ||
                            filter.value === undefined
                        ) {

                            showToast(
                                `Parameter "${filter.parameter}" belum memiliki nilai.`
                            );

                            return;
                        }

                    }

                }

            }


            // ---------------------------------------------
            // LOADING
            // ---------------------------------------------

            showLoading(
                "Menerapkan filter data..."
            );

            // ---------------------------------------------
            // LOADING
            // ---------------------------------------------

            showLoading(
                "Menerapkan filter data..."
            );


            try {

                console.log(
                    "[Variety Engine] FILTER:",
                    selectedFilters
                );


                // -----------------------------------------
                // REQUEST
                // -----------------------------------------

                const response =
                    await api(
                        "/api/filter",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({

                                sheet:
                                    state.sheet,

                                header:
                                    state.header,

                                filters:
                                    selectedFilters,

                                commentColumnTitle: document.getElementById("commentColumnTitle").value 
                           
                            })
                        }
                    );


                console.log(
                    "[Variety Engine] HASIL FILTER:",
                    response
                );


                // -----------------------------------------
                // TAMPILKAN HASIL
                // -----------------------------------------

                renderFilteredResults(
                    response
                );

                saveAppState();

                showToast(
                    `Filter selesai. ${Number(
                        response.total || 0
                    ).toLocaleString("id-ID")} data ditemukan.`
                );


            } catch (error) {

                console.error(
                    "[Variety Engine] FILTER ERROR:",
                    error
                );

                showToast(
                    error.message ||
                    "Gagal menerapkan filter."
                );

            } finally {

                hideLoading();

            }

        }
    );


// =====================================================
// CLEAR FILTER
// =====================================================

$("clearFilterBtn")
    .addEventListener(
        "click",
        () => {

            selectedFilters.length =
                0;

            saveAppState();

            renderSelectedFilters();

            $("exportExcelBtn").disabled = true;

            $("filteredCount")
                .textContent = "-";

            $("filteredTableHead")
                .innerHTML = "";

            $("filteredTableBody")
                .innerHTML = `
                    <tr>
                        <td class="empty-state">
                            Tentukan parameter dan filter terlebih dahulu.
                        </td>
                    </tr>
                `;

        }
    );

// =========================================================
// EXPORT HASIL FILTER KE EXCEL
// =========================================================

$("exportExcelBtn").addEventListener("click", async () => {

    if (!state.sheet || state.header === null) {
        showToast(
            "Sheet dan header belum dipilih.",
            "error"
        );
        return;
    }

    if (selectedFilters.length === 0) {
        showToast(
            "Belum ada filter yang dipilih.",
            "error"
        );
        return;
    }

    try {

        showLoading(
            "Menyiapkan file Excel..."
        );


        // -------------------------------------------------
        // Sinkronkan nilai input numeric dari UI
        // -------------------------------------------------

        selectedFilters.forEach(
            (filter, index) => {

                const wrapper =
                    document.querySelector(
                        `.parameter-filter[data-index="${index}"]`
                    );

                if (!wrapper) {
                    return;
                }


                if (
                    filter.type === "numeric"
                ) {

                    // -----------------------------------------
                    // BETWEEN
                    // -----------------------------------------

                    if (
                        filter.operator === "BETWEEN"
                    ) {

                        const minInput =
                            wrapper.querySelector(
                                `.filter-value-min[data-index="${index}"]`
                            );

                        const maxInput =
                            wrapper.querySelector(
                                `.filter-value-max[data-index="${index}"]`
                            );

                        filter.value = [
                            minInput
                                ? minInput.value
                                : "",

                            maxInput
                                ? maxInput.value
                                : ""
                        ];

                    }

                    // -----------------------------------------
                    // Numeric biasa
                    // -----------------------------------------

                    else {

                        const input =
                            wrapper.querySelector(
                                `.filter-value[data-index="${index}"]`
                            );

                        filter.value =
                            input
                                ? input.value
                                : "";
                    }
                }
            }
        );


        // -------------------------------------------------
        // Request export
        // -------------------------------------------------

        const response = await fetch(
            "/api/filter",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    sheet: state.sheet,
                    header: state.header,
                    filters: selectedFilters,
                    commentColumnTitle: document.getElementById("commentColumnTitle").value,
                    export: true
                })
            }
        );


        // -------------------------------------------------
        // Cek response
        // -------------------------------------------------

        if (!response.ok) {

            let message =
                "Gagal membuat file Excel.";

            try {

                const errorData =
                    await response.json();

                if (
                    errorData.message
                ) {
                    message =
                        errorData.message;
                }

                else if (
                    errorData.error
                ) {
                    message =
                        errorData.error;
                }

            } catch (error) {
                // Response bukan JSON
            }

            throw new Error(
                message
            );
        }


        // -------------------------------------------------
        // Ambil file
        // -------------------------------------------------

        const blob =
            await response.blob();


        // -------------------------------------------------
        // Nama file
        // -------------------------------------------------

        let filename =
            "hasil_filter.xlsx";

        const disposition =
            response.headers.get(
                "Content-Disposition"
            );

        if (disposition) {

            const match =
                disposition.match(
                    /filename="?([^"]+)"?/i
                );

            if (
                match &&
                match[1]
            ) {
                filename =
                    match[1];
            }
        }


        // -------------------------------------------------
        // Download
        // -------------------------------------------------

        const url =
            window.URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                "a"
            );

        link.href = url;
        link.download = filename;

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        window.URL.revokeObjectURL(
            url
        );


        showToast(
            "File Excel berhasil dibuat.",
            "success"
        );


    } catch (error) {

        console.error(
            "EXPORT EXCEL ERROR:",
            error
        );

        showToast(
            error.message ||
            "Gagal membuat file Excel.",
            "error"
        );

    } finally {

        hideLoading();

    }

});

// =====================================================
// RENDER FILTERED RESULTS
// =====================================================

function renderFilteredResults(data) {

    const countElement =
        $("filteredCount");

    const shownElement =
        $("filteredShown");

    const thead =
        $("filteredTableHead");

    const tbody =
        $("filteredTableBody");


    // -------------------------------------------------
    // RESET
    // -------------------------------------------------

    thead.innerHTML =
        "";

    tbody.innerHTML =
        "";


    // -------------------------------------------------
    // JUMLAH DATA
    // -------------------------------------------------

    const total =
        Number(
            data.total || 0
        );

    $("exportExcelBtn").disabled = total === 0;

    const shown =
        Number(
            data.shown || 0
        );
    
    

    countElement.textContent =
        total.toLocaleString(
            "id-ID"
        );
    
    if (shownElement) {

        if (shown < total) {

            shownElement.textContent =
                ` • Menampilkan ${shown.toLocaleString("id-ID")} data`;

        } else {

            shownElement.textContent =
                ` • Menampilkan seluruh ${shown.toLocaleString("id-ID")} data`;

        }

    }


    // -------------------------------------------------
    // TIDAK ADA DATA
    // -------------------------------------------------

    if (
        !data.columns ||
        !data.columns.length
    ) {

        tbody.innerHTML = `
            <tr>
                <td class="empty-state">
                    Tidak ada kolom hasil.
                </td>
            </tr>
        `;

        return;
    }


    // -------------------------------------------------
    // HEADER TABLE
    // -------------------------------------------------

    const headerRow =
        document.createElement(
            "tr"
        );


    data.columns.forEach(
        (column, index) => {

            const th =
                document.createElement(
                    "th"
                );

            th.textContent =
                column ||
                `Kolom ${index + 1}`;

            headerRow.appendChild(
                th
            );

        }
    );


    thead.appendChild(
        headerRow
    );


    // -------------------------------------------------
    // DATA KOSONG
    // -------------------------------------------------

    if (
        !data.rows ||
        !data.rows.length
    ) {

        const tr =
            document.createElement(
                "tr"
            );

        const td =
            document.createElement(
                "td"
            );

        td.colSpan =
            data.columns.length;

        td.className =
            "empty-state";

        td.textContent =
            "Tidak ada data yang sesuai dengan filter.";

        tr.appendChild(
            td
        );

        tbody.appendChild(
            tr
        );

        return;
    }


    // -------------------------------------------------
    // RENDER ROW
    // -------------------------------------------------

    data.rows.forEach(
        row => {

            const tr =
                document.createElement(
                    "tr"
                );


            data.columns.forEach(
                column => {

                    const td =
                        document.createElement(
                            "td"
                        );


                    let value =
                        row[column];


                    if (
                        value === null ||
                        value === undefined
                    ) {

                        value = "";

                    }


                    td.textContent =
                        value;


                    tr.appendChild(
                        td
                    );

                }
            );


            tbody.appendChild(
                tr
            );

        }
    );


    // -------------------------------------------------
    // INFO JUMLAH DATA YANG DITAMPILKAN
    // -------------------------------------------------

    if (
        shown < total
    ) {

        console.log(
            `[Variety Engine] Menampilkan ${shown} dari ${total} data.`
        );

    }

}

// =====================================================
// RESTORE APP STATE
// =====================================================

async function restoreAppState() {

    try {

        const saved =
            localStorage.getItem(
                "variety_engine_state"
            );

        if (!saved) {
            return;
        }

        const snapshot =
            JSON.parse(saved);

        if (!snapshot) {
            return;
        }


        // =================================================
        // 1. CEK EXCEL AKTIF
        // =================================================

        const sheetsData =
            await api(
                "/api/sheets"
            );

        if (
            !sheetsData.sheets ||
            !sheetsData.sheets.length
        ) {

            return;
        }


        // =================================================
        // 2. PULIHKAN NAMA FILE
        // =================================================

        state.filename =
            snapshot.filename || "";

        if (state.filename) {

            $("fileInfo").textContent =
                `File aktif: ${state.filename} • ${sheetsData.sheets.length} sheet`;

            $("fileInfo")
                .classList
                .remove("hidden");

        }


        // =================================================
        // 3. PULIHKAN SHEET
        // =================================================

        populateSheets(
            sheetsData.sheets
        );

        if (
            !snapshot.sheet ||
            !sheetsData.sheets.includes(
                snapshot.sheet
            )
        ) {

            return;
        }

        state.sheet =
            snapshot.sheet;

        $("sheetSelect").value =
            snapshot.sheet;


        // =================================================
        // 4. LOAD HEADER
        // =================================================

        showLoading(
            "Memulihkan Sheet dan Header..."
        );

        const headerData =
            await api(
                `/api/headers?sheet=${encodeURIComponent(
                    state.sheet
                )}`
            );

        populateHeaders(
            headerData.candidates
        );


        if (
            snapshot.header === null ||
            snapshot.header === undefined
        ) {

            return;
        }


        // =================================================
        // 5. PULIHKAN HEADER
        // =================================================

        const headerExists =
            headerData.candidates.some(
                candidate =>
                    Number(
                        candidate.row_number
                    ) === Number(
                        snapshot.header
                    )
            );

        if (!headerExists) {

            console.warn(
                "[Variety Engine] Header tersimpan tidak ditemukan."
            );

            return;
        }

        state.header =
            Number(
                snapshot.header
            );

        $("headerSelect").value =
            String(
                state.header
            );


        const selectedHeader =
            $("headerSelect")
                .selectedOptions[0];

        if (selectedHeader) {

            $("headerPreview").innerHTML =
                `<strong>Preview Header:</strong><br>${escapeHtml(
                    selectedHeader.dataset.preview || ""
                )}`;

            $("headerPreview")
                .classList
                .remove("hidden");

            $("previewBtn").disabled =
                false;

        }


        // =================================================
        // 6. LOAD PARAMETER
        // =================================================

        await loadParameters();


        // =================================================
        // 7. PULIHKAN FILTER
        // =================================================

        selectedFilters.length =
            0;

        if (
            Array.isArray(
                snapshot.selectedFilters
            )
        ) {

            snapshot.selectedFilters.forEach(
                savedFilter => {

                    // =========================================
                    // FORMAT BARU
                    // =========================================

                    if (
                        Array.isArray(
                            savedFilter.conditions
                        )
                    ) {

                        selectedFilters.push({

                            name:
                                savedFilter.name ||
                                `Parameter ${
                                    selectedFilters.length + 1
                                }`,

                            conditions:
                                savedFilter.conditions.map(
                                    condition => ({

                                        parameter:
                                            condition.parameter ||
                                            "",

                                        type:
                                            condition.type ||
                                            "text",

                                        operator:
                                            condition.operator ||
                                            "=",

                                        value:
                                            condition.value ??
                                            [],

                                        groups:
                                            [],

                                        loading:
                                            false,

                                        loadError:
                                            ""

                                    })
                                ),

                            comment:
                                savedFilter.comment ||
                                ""

                        });

                    }


                    // =========================================
                    // FORMAT LAMA
                    // Supaya state lama tidak menyebabkan error
                    // =========================================

                    else if (
                        savedFilter.parameter
                    ) {

                        selectedFilters.push({

                            name:
                                savedFilter.parameter,

                            conditions: [

                                {

                                    parameter:
                                        savedFilter.parameter,

                                    type:
                                        savedFilter.type ||
                                        "text",

                                    operator:
                                        savedFilter.operator ||
                                        "=",

                                    value:
                                        savedFilter.value ??
                                        [],

                                    groups:
                                        [],

                                    loading:
                                        false,

                                    loadError:
                                        ""

                                }

                            ],

                            comment:
                                ""

                        });

                    }

                }
            );

        }


        // =================================================
        // 8. RENDER FILTER
        // =================================================

        renderSelectedFilters();

        // =================================================
        // 9. LOAD NILAI SETIAP ATRIBUT
        // =================================================

        for (
            let groupIndex = 0;
            groupIndex < selectedFilters.length;
            groupIndex++
        ) {

            const group =
                selectedFilters[groupIndex];

            if (
                !group ||
                !Array.isArray(group.conditions)
            ) {
                continue;
            }


            for (
                let conditionIndex = 0;
                conditionIndex < group.conditions.length;
                conditionIndex++
            ) {

                const condition =
                    group.conditions[conditionIndex];

                if (
                    condition &&
                    condition.parameter
                ) {

                    await loadConditionValues(
                        groupIndex,
                        conditionIndex
                    );

                }

            }

        }


        // =================================================
        // 10. RENDER ULANG
        // =================================================

        renderSelectedFilters();


        // =================================================
        // 10. PULIHKAN PREVIEW
        // =================================================

        if (
            snapshot.previewVisible
        ) {

            try {

                showLoading(
                    "Memulihkan preview data..."
                );

                const previewData =
                    await api(
                        `/api/preview?sheet=${encodeURIComponent(
                            state.sheet
                        )}&header=${state.header}&limit=100`
                    );

                renderPreview(
                    previewData
                );

            } catch (error) {

                console.warn(
                    "[Variety Engine] Gagal memulihkan preview:",
                    error
                );

            }

        }


        // =================================================
        // 11. PULIHKAN HASIL FILTER
        // =================================================

        if (
            snapshot.filterApplied &&
            selectedFilters.length
        ) {

            try {

                showLoading(
                    "Memulihkan hasil filter..."
                );


                const filterResponse =
                    await api(
                        "/api/filter",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({

                                sheet:
                                    state.sheet,

                                header:
                                    state.header,

                                filters:
                                    selectedFilters

                            })
                        }
                    );


                renderFilteredResults(
                    filterResponse
                );


            } catch (error) {

                console.warn(
                    "[Variety Engine] Gagal memulihkan hasil filter:",
                    error
                );

            }

        }


        showToast(
            "Kondisi aplikasi berhasil dipulihkan."
        );


    } catch (error) {

        console.warn(
            "[Variety Engine] Gagal memulihkan state:",
            error
        );

    } finally {

        hideLoading();

    }

}

document.addEventListener(
    "DOMContentLoaded",
    () => {

        restoreAppState();

    }
);

// =========================================================
// EXPORT DATA - POPUP
// =========================================================

const confirmExportDataBtn =
  document.getElementById("confirmExportDataBtn");

if (confirmExportDataBtn) {

  confirmExportDataBtn.addEventListener(
    "click",
    async () => {

      const selectedMode =
        document.querySelector(
          'input[name="exportMode"]:checked'
        );

      if (!selectedMode) {
        return;
      }

      const exportMode =
        selectedMode.value;

        // Tetap buka popup selama proses export
        exportDataModal.classList.remove(
        "hidden"
        );

        // Tampilkan progress
        $("exportProgressContainer")
        .classList
        .remove("hidden");

        $("exportProgressBar").style.width = "0%";
        $("exportProgressPercent").textContent = "0%";
        $("exportProgressText").textContent =
        "Menyiapkan export...";
        $("exportProgressStatus").textContent =
        "Memulai...";      

        // Polling progress export
        const progressInterval = setInterval(
        async () => {

            try {

            const progressResponse =
                await fetch(
                "/api/filter-export-progress"
                );

            if (!progressResponse.ok) {
                return;
            }

            const progress =
                await progressResponse.json();


            const percent =
                Number(
                progress.progress || 0
                );


            $("exportProgressBar")
                .style
                .width = `${percent}%`;


            $("exportProgressPercent")
                .textContent =
                `${percent}%`;


            $("exportProgressText")
                .textContent =
                percent >= 100
                ? "Export selesai"
                : "Sedang memproses...";


            $("exportProgressStatus")
                .textContent =
                progress.status ||
                "Memproses...";


            } catch (error) {

            console.warn(
                "[Variety Engine] Gagal membaca progress export:",
                error
            );

            }

        },
        500
        );
        
      console.log(
        "[Variety Engine] EXPORT MODE:",
        exportMode
      );

      try {

        // ---------------------------------------------
        // VALIDASI
        // ---------------------------------------------

        if (
          !state.sheet ||
          state.header === null
        ) {

          throw new Error(
            "Sheet dan header belum dipilih."
          );

        }


        if (
          exportMode === "filtered" &&
          selectedFilters.length === 0
        ) {

          throw new Error(
            "Belum ada filter yang dipilih."
          );

        }


        // ---------------------------------------------
        // REQUEST EXPORT
        // ---------------------------------------------

        const response =
          await fetch(
            "/api/filter",
            {

              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({

                sheet:
                  state.sheet,

                header:
                  state.header,

                filters:
                  selectedFilters,

                commentColumnTitle:
                  document.getElementById(
                    "commentColumnTitle"
                  ).value,

                export:
                  true,

                export_mode:
                  exportMode

              })

            }
          );


        if (!response.ok) {

          let message =
            "Gagal membuat file Excel.";

          try {

            const errorData =
              await response.json();

            message =
              errorData.message ||
              errorData.error ||
              message;

          } catch (error) {
            // Response bukan JSON
          }

          throw new Error(
            message
          );

        }


        // ---------------------------------------------
        // AMBIL FILE
        // ---------------------------------------------

        const blob =
          await response.blob();


        // ---------------------------------------------
        // NAMA FILE
        // ---------------------------------------------

        let filename =
          exportMode === "full"
            ? "data_penuh.xlsx"
            : "hasil_filter.xlsx";


        const disposition =
          response.headers.get(
            "Content-Disposition"
          );


        if (disposition) {

          const match =
            disposition.match(
              /filename="?([^"]+)"?/i
            );

          if (
            match &&
            match[1]
          ) {

            filename =
              match[1];

          }

        }


        // ---------------------------------------------
        // DOWNLOAD
        // ---------------------------------------------

        const url =
          window.URL.createObjectURL(
            blob
          );


        const link =
          document.createElement(
            "a"
          );


        link.href =
          url;

        link.download =
          filename;


        document.body.appendChild(
          link
        );

        link.click();

        link.remove();


        window.URL.revokeObjectURL(
          url
        );


        showToast(
          "File Excel berhasil dibuat."
        );


      } catch (error) {

        console.error(
          "[Variety Engine] EXPORT ERROR:",
          error
        );

        showToast(
          error.message ||
          "Gagal membuat file Excel."
        );

      } finally {

        hideLoading();

      }

    }
  );

}








