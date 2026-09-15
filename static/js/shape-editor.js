

let shapeMap = null;
let shapeLayer = null;
let shapeSearchResults = [];
let shapeSearchSelectedLayer = null;
let selectedShapeLayer = null;
let activeGeoJSON = null;
let attributeHighlightActive = false;
let attributeHighlightAttribute = "";
let attributeHighlightColors = {};
let attributeHighlightColorsByAttribute = {};

// =====================================================
// SHAPE CACHE - INDEXED DB
// =====================================================

const SHAPE_DB_NAME =
"variety_engine_shape_cache";

const SHAPE_STORE_NAME =
"shapefile";

function openShapeDB() {

return new Promise(
(resolve, reject) => {

    const request =
    indexedDB.open(
        SHAPE_DB_NAME,
        1
    );

    request.onupgradeneeded =
    function(event) {

        const db =
        event.target.result;

        if (
        !db.objectStoreNames.contains(
            SHAPE_STORE_NAME
        )
        ) {

        db.createObjectStore(
            SHAPE_STORE_NAME
        );

        }

    };

    request.onsuccess =
    function() {

        resolve(
        request.result
        );

    };

    request.onerror =
    function() {

        reject(
        request.error
        );

    };

}
);

}

async function saveShapeCache(data) {

try {

const db =
    await openShapeDB();

return new Promise(
    (resolve, reject) => {

    const transaction =
        db.transaction(
        SHAPE_STORE_NAME,
        "readwrite"
        );

    const store =
        transaction.objectStore(
        SHAPE_STORE_NAME
        );

    store.put(
        data,
        "active"
    );

    transaction.oncomplete =
        function() {

        db.close();

        resolve();

        };

    transaction.onerror =
        function() {

        db.close();

        reject(
            transaction.error
        );

        };

    }
);

} catch (error) {

console.warn(
    "[Shape Editor] Gagal menyimpan cache:",
    error
);

}

}

async function saveHighlightColors() {

try {

const cachedShape =
    await loadShapeCache();

if (!cachedShape) {
    return;
}

cachedShape.attributeHighlightColors =
    attributeHighlightColorsByAttribute;

await saveShapeCache(
    cachedShape
);

} catch (error) {

console.warn(
    "[Shape Editor] Gagal menyimpan warna highlight:",
    error
);

}

}

async function loadShapeCache() {

try {

const db =
    await openShapeDB();

return new Promise(
    (resolve, reject) => {

    const transaction =
        db.transaction(
        SHAPE_STORE_NAME,
        "readonly"
        );

    const store =
        transaction.objectStore(
        SHAPE_STORE_NAME
        );

    const request =
        store.get(
        "active"
        );

    request.onsuccess =
        function() {

        db.close();

        resolve(
            request.result || null
        );

        };

    request.onerror =
        function() {

        db.close();

        reject(
            request.error
        );

        };

    }
);

} catch (error) {

console.warn(
    "[Shape Editor] Gagal membaca cache:",
    error
);

return null;

}

}

/* =====================================================
INITIALIZE MAP
===================================================== */

function initializeShapeMap() {

if (shapeMap) {
return;
}

shapeMap = L.map("shapeMap");

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{
    maxZoom: 22,
    attribution: "&copy; OpenStreetMap contributors"
}
).addTo(shapeMap);

}


/* =====================================================
DISPLAY ATTRIBUTES
===================================================== */

function showAttributes(properties) {

const container =
document.getElementById(
    "shapeAttributes"
);

container.innerHTML = "";

if (!properties) {

container.textContent =
    "Tidak ada data atribut.";

return;

}

const entries =
Object.entries(properties);

if (!entries.length) {

container.textContent =
    "Feature tidak memiliki atribut.";

return;

}


entries.forEach(
([key, value]) => {

    const row =
    document.createElement("div");

    row.className =
    "attribute-row";


    const keyElement =
    document.createElement("span");

    keyElement.className =
    "attribute-key";

    keyElement.textContent =
    key;


    const valueElement =
    document.createElement("span");

    valueElement.className =
    "attribute-value";

    valueElement.textContent =
    value ?? "-";


    row.appendChild(
    keyElement
    );

    row.appendChild(
    valueElement
    );

    container.appendChild(
    row
    );

}
);

}

/* =====================================================
SEARCH POLYGON
===================================================== */

function getFeatureSearchText(feature) {

if (
!feature ||
!feature.properties
) {
return "";
}

return Object.values(
feature.properties
)
.map(function(value) {
    return value == null
    ? ""
    : String(value);
})
.join(" ")
.toLowerCase();

}


function searchPolygons() {

const input =
document.getElementById(
    "shapeSearchInput"
);

const attributeSelect =
document.getElementById(
    "shapeSearchAttribute"
);

const resultsContainer =
document.getElementById(
    "shapeSearchResults"
);

const keyword =
input.value
    .trim()
    .toLowerCase();

const selectedAttribute =
attributeSelect
    ? attributeSelect.value
    : "__all__";


resultsContainer.innerHTML = "";

shapeSearchResults = [];


if (!keyword) {

resultsContainer.style.display =
    "none";

return;

}


if (
!shapeLayer ||
!shapeLayer.getLayers
) {

resultsContainer.innerHTML =
    '<div class="shape-search-empty">' +
    "Shapefile belum tersedia." +
    "</div>";

resultsContainer.style.display =
    "block";

return;

}


shapeLayer.eachLayer(
function(layer) {

    const feature =
    layer.feature;

    const properties =
    feature &&
    feature.properties;


    if (!properties) {
    return;
    }


    let text = "";


    // ================================================
    // SEARCH SEMUA ATRIBUT
    // ================================================

    if (
    selectedAttribute === "__all__"
    ) {

    text =
        Object.values(properties)
        .map(function(value) {

            return value == null
            ? ""
            : String(value);

        })
        .join(" ")
        .toLowerCase();

    }


    // ================================================
    // SEARCH ATRIBUT TERTENTU
    // ================================================

    else {

    const value =
        properties[
        selectedAttribute
        ];

    text =
        value == null
        ? ""
        : String(value).toLowerCase();

    }


    if (
    text.includes(keyword)
    ) {

    shapeSearchResults.push(
        layer
    );

    }

}
);


// ================================================
// TIDAK ADA HASIL
// ================================================

if (
shapeSearchResults.length === 0
) {

resultsContainer.innerHTML =
    '<div class="shape-search-empty">' +
    "Polygon tidak ditemukan." +
    "</div>";

resultsContainer.style.display =
    "block";

return;

}


// ================================================
// HIGHLIGHT SEMUA HASIL
// ================================================

shapeLayer.eachLayer(
function(layer) {

    applySearchHighlight(
    layer,
    shapeSearchResults.includes(
        layer
    )
    );

}
);


// ================================================
// TAMPILKAN HASIL
// ================================================



// ================================================
// ZOOM KE SEMUA HASIL
// ================================================

const resultGroup =
L.featureGroup(
    shapeSearchResults
);

const resultBounds =
resultGroup.getBounds();


if (
resultBounds.isValid()
) {

shapeMap.fitBounds(
    resultBounds,
    {
    padding: [30, 30],
    maxZoom: 18
    }
);

}


resultsContainer.style.display =
"block";


document.getElementById(
"shapeEditorStatus"
).textContent =
shapeSearchResults.length +
" polygon ditemukan.";

}

function applySearchHighlight(layer, matched) {
if (!layer) return;

if (matched) {
layer.setStyle({
    weight: 8
});

layer.bringToFront();

} else {
layer.setStyle({
    weight: 2
});
}
}

function randomPolygon() {

if (
!shapeLayer ||
!shapeLayer.getLayers
) {

return;

}

const layers =
shapeLayer.getLayers();

if (!layers.length) {

return;

}

const randomIndex =
Math.floor(
    Math.random() * layers.length
);

const layer =
layers[randomIndex];


// Highlight polygon

shapeLayer.eachLayer(
function(item) {

    item.setStyle({

    weight: 2,

    fillOpacity: 0.15

    });

}
);


layer.setStyle({

color: "#f59e0b",

weight: 4,

fillColor: "#f59e0b",

fillOpacity: 0.65

});


// Zoom

if (
layer.getBounds &&
layer.getBounds().isValid()
) {

shapeMap.fitBounds(
    layer.getBounds(),
    {
    padding: [30, 30],
    maxZoom: 18
    }
);

}


// Tampilkan atribut

showAttributes(
layer.feature.properties
);


document.getElementById(
"shapeEditorStatus"
).textContent =
"1 polygon dipilih secara acak.";

}    

function randomAttribute() {

if (
!shapeLayer ||
!shapeLayer.getLayers
) {

return;

}

const attributeSelect =
document.getElementById(
    "shapeSearchAttribute"
);

const attribute =
attributeSelect
    ? attributeSelect.value
    : "__all__";


if (
attribute === "__all__"
) {

document.getElementById(
    "shapeEditorStatus"
).textContent =
    "Pilih atribut terlebih dahulu.";

return;

}


const values =
new Set();


shapeLayer.eachLayer(
function(layer) {

    const properties =
    layer.feature &&
    layer.feature.properties;

    if (!properties) {
    return;
    }

    const value =
    properties[attribute];

    if (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
    ) {

    values.add(
        String(value)
    );

    }

}
);


const valueList =
Array.from(values);


if (!valueList.length) {

return;

}


const randomValue =
valueList[
    Math.floor(
    Math.random() *
    valueList.length
    )
];


const matchedLayers = [];


// ================================================
// HIGHLIGHT SEMUA POLYGON DENGAN NILAI TERPILIH
// ================================================

shapeLayer.eachLayer(
function(layer) {

    const properties =
    layer.feature &&
    layer.feature.properties;

    const value =
    properties
        ? properties[attribute]
        : null;


    if (
    value !== null &&
    value !== undefined &&
    String(value) === randomValue
    ) {

    matchedLayers.push(
        layer
    );

    layer.setStyle({

        color: "#f59e0b",

        weight: 4,

        fillColor: "#f59e0b",

        fillOpacity: 0.65

    });

    } else {

    layer.setStyle({

        weight: 2,

        fillOpacity: 0.15

    });

    }

}
);


// ================================================
// ZOOM KE HASIL
// ================================================

const resultGroup =
L.featureGroup(
    matchedLayers
);

const bounds =
resultGroup.getBounds();


if (
bounds.isValid()
) {

shapeMap.fitBounds(
    bounds,
    {
    padding: [30, 30],
    maxZoom: 18
    }
);

}


document.getElementById(
"shapeEditorStatus"
).textContent =
"Random " +
attribute +
": " +
randomValue +
" (" +
matchedLayers.length +
" polygon).";

}    

function selectSearchResult(layer) {

if (!layer) {
return;
}


// -------------------------------------------------
// Hapus highlight pencarian sebelumnya
// -------------------------------------------------

if (
shapeSearchSelectedLayer &&
shapeSearchSelectedLayer !== layer
) {

shapeSearchSelectedLayer.setStyle({
    weight: 2,
    fillOpacity: 0.35
});

}


shapeSearchSelectedLayer =
layer;


// -------------------------------------------------
// Highlight polygon
// -------------------------------------------------

layer.setStyle({
weight: 4,
fillOpacity: 0.65
});


// -------------------------------------------------
// Zoom ke polygon
// -------------------------------------------------

if (
layer.getBounds &&
layer.getBounds().isValid()
) {

shapeMap.fitBounds(
    layer.getBounds(),
    {
    padding: [30, 30],
    maxZoom: 18
    }
);

} else if (
layer.getLatLng
) {

shapeMap.setView(
    layer.getLatLng(),
    18
);

}


// -------------------------------------------------
// Tampilkan atribut
// -------------------------------------------------

showAttributes(
layer.feature.properties
);


// -------------------------------------------------
// Tutup hasil pencarian
// -------------------------------------------------

document.getElementById(
"shapeSearchResults"
).style.display =
"none";


// -------------------------------------------------
// Kosongkan input
// -------------------------------------------------

document.getElementById(
"shapeSearchInput"
).value = "";


// -------------------------------------------------
// Status editor
// -------------------------------------------------

document.getElementById(
"shapeEditorStatus"
).textContent =
"Polygon ditemukan dan dipilih.";
}

/* =====================================================
DISPLAY GEOJSON
===================================================== */

function displayGeoJSON(geojson) {

// =================================================
// VALIDASI GEOJSON
// =================================================

if (
!geojson ||
!Array.isArray(geojson.features) ||
geojson.features.length === 0
) {

throw new Error(
    "GeoJSON tidak memiliki feature."
);

}

activeGeoJSON = geojson;

// =================================================
// TAMPILKAN WORKSPACE TERLEBIH DAHULU
// =================================================

document
.getElementById(
    "shapeWorkspace"
)
.style.display = "grid";


// =================================================
// BARU INITIALIZE LEAFLET
// =================================================

initializeShapeMap();


// =================================================
// HAPUS LAYER LAMA
// =================================================

if (shapeLayer) {

shapeMap.removeLayer(
    shapeLayer
);

}


// =================================================
// RENDER GEOJSON
// =================================================

shapeLayer =
L.geoJSON(
    geojson,
    {

    style: {

        weight: 2,

        fillOpacity: 0.35

    },

    onEachFeature:
        function(
        feature,
        layer
        ) {

        layer.on(
            "click",
            function() {

            selectedShapeLayer = layer;

            showAttributes(
                feature.properties
            );

            document.getElementById(
                "shapeEditorStatus"
            ).textContent =
                "Polygon dipilih.";

            }
        );

        }

    }
).addTo(shapeMap);

populateHighlightAttributes();
populateSearchAttributes();
populateMatchShpKeys();

// =================================================
// FIT MAP
// =================================================

const bounds =
shapeLayer.getBounds();


if (bounds.isValid()) {

shapeMap.fitBounds(
    bounds,
    {
    padding: [20, 20]
    }
);

}


// =================================================
// PAKSA LEAFLET MEMBACA UKURAN CONTAINER
// =================================================

setTimeout(
function() {

    if (shapeMap) {

    shapeMap.invalidateSize(
        true
    );

    }

},
100
);

}

/* =====================================================
ATTRIBUTE HIGHLIGHT
===================================================== */

function populateHighlightAttributes() {

const select =
document.getElementById(
    "highlightAttributeSelect"
);

if (!select || !shapeLayer) {
return;
}

select.innerHTML =
'<option value="">Pilih atribut...</option>';

const attributes = new Set();

shapeLayer.eachLayer(
function(layer) {

    const properties =
    layer.feature &&
    layer.feature.properties;

    if (!properties) {
    return;
    }

    Object.keys(properties).forEach(
    function(key) {

        attributes.add(key);

    }
    );

}
);

Array.from(attributes)
.sort()
.forEach(
    function(attribute) {

    const option =
        document.createElement(
        "option"
        );

    option.value =
        attribute;

    option.textContent =
        attribute;

    select.appendChild(
        option
    );

    }
);

}

function populateMatchShpKeys() {

    const select =
        document.getElementById(
            "matchShpKey"
        );

    if (!select || !shapeLayer) {
        return;
    }

    select.innerHTML =
        '<option value="">Pilih atribut SHP</option>';

    const attributes = new Set();

    shapeLayer.eachLayer(
        function(layer) {

            const properties =
                layer.feature &&
                layer.feature.properties;

            if (!properties) {
                return;
            }

            Object.keys(properties).forEach(
                function(key) {

                    attributes.add(key);

                }
            );

        }
    );

    Array.from(attributes)
        .sort()
        .forEach(
            function(attribute) {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    attribute;

                option.textContent =
                    attribute;

                select.appendChild(
                    option
                );

            }
        );
}

function populateSearchAttributes() {

const select =
document.getElementById(
    "shapeSearchAttribute"
);

if (!select || !shapeLayer) {
return;
}

select.innerHTML =
'<option value="__all__">Semua Atribut</option>';

const attributes = new Set();

shapeLayer.eachLayer(
function(layer) {

    const properties =
    layer.feature &&
    layer.feature.properties;

    if (!properties) {
    return;
    }

    Object.keys(properties).forEach(
    function(key) {

        attributes.add(key);

    }
    );

}
);

Array.from(attributes)
.sort()
.forEach(
    function(attribute) {

    const option =
        document.createElement(
        "option"
        );

    option.value =
        attribute;

    option.textContent =
        attribute;

    select.appendChild(
        option
    );

    }
);

}    

function populateSearchValues(
attribute,
keyword = ""
) {

const container =
document.getElementById(
    "shapeSearchValues"
);

if (!container || !shapeLayer) {
return;
}

container.innerHTML = "";

if (!attribute) {

container.style.display =
    "none";

return;

}

const values =
new Set();


shapeLayer.eachLayer(
function(layer) {

    const properties =
    layer.feature &&
    layer.feature.properties;

    if (!properties) {
    return;
    }

    if (attribute === "__all__") {

        Object.values(properties).forEach(
        function(value) {

            if (
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
            ) {

            values.add(
                String(value)
            );

            }

        }
        );

    } else {

        const value =
        properties[attribute];

        if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
        ) {

        values.add(
            String(value)
        );

        }

    }

}
);

Array.from(values)
.filter(function(value) {

    if (!keyword) {
    return true;
    }

    return value
    .toLowerCase()
    .includes(
        keyword.toLowerCase()
    );

})

.sort()
.slice(0, 15)
.forEach(
    function(value) {

    const item =
        document.createElement(
        "div"
        );

    item.className =
        "shape-search-value";

    item.textContent =
        value;


    item.addEventListener(
        "click",
        function() {

        const input =
            document.getElementById(
            "shapeSearchInput"
            );

        input.value =
            value;

        container.style.display =
            "none";

        }
    );


    container.appendChild(
        item
    );

    }
);


if (container.children.length) {

container.style.display =
    "block";

}

}    

function populateHighlightColors(attribute) {

const container =
document.getElementById(
    "attributeHighlightColors"
);

if (!container || !shapeLayer) {
return;
}

container.innerHTML = "";

const values = new Set();

shapeLayer.eachLayer(
function(layer) {

    const properties =
    layer.feature &&
    layer.feature.properties;

    const value =
    properties
        ? properties[attribute]
        : null;

    const displayValue =
    value === null ||
    value === undefined ||
    String(value).trim() === ""
        ? "(Kosong)"
        : String(value);

    values.add(displayValue);

}
);

Array.from(values)
.sort()
.forEach(
    function(value) {

    const row =
        document.createElement("div");

    row.className =
        "attribute-highlight-color-row";


    const picker =
        document.createElement("input");

    picker.type =
        "color";

    picker.className =
        "attribute-highlight-color-picker";


    const color =
        getAttributeHighlightColor(value);


    picker.value =
        color;


    picker.dataset.value =
        value;

    picker.addEventListener(
        "change",
        function() {

        if (
            !attributeHighlightColorsByAttribute[
            attribute
            ]
        ) {

            attributeHighlightColorsByAttribute[
            attribute
            ] = {};

        }

        attributeHighlightColorsByAttribute[
            attribute
        ][value] =
            this.value;

        attributeHighlightColors =
            attributeHighlightColorsByAttribute[
            attribute
            ];

        saveHighlightColors();

        }
    );

    const label =
        document.createElement("span");

    label.className =
        "attribute-highlight-color-name";

    label.textContent =
        value;


    row.appendChild(
        picker
    );

    row.appendChild(
        label
    );

    container.appendChild(
        row
    );

    }
);

}

function getAttributeHighlightColor(
value,
index
) {

const palette = [
"#2563eb",
"#16a34a",
"#dc2626",
"#ca8a04",
"#9333ea",
"#0891b2",
"#ea580c",
"#db2777",
"#4f46e5",
"#65a30d",
"#0f766e",
"#c026d3",
"#b45309",
"#475569"
];

const key =
String(value);

if (
!attributeHighlightColors[key]
) {

attributeHighlightColors[key] =
    palette[
    Object.keys(
        attributeHighlightColors
    ).length %
    palette.length
    ];

}

return attributeHighlightColors[key];

}

function applyAttributeHighlight() {

if (!shapeLayer) {
return;
}

const select =
document.getElementById(
    "highlightAttributeSelect"
);

const attribute =
select.value;

if (!attribute) {
return;
}

attributeHighlightActive = true;

attributeHighlightAttribute =
attribute;

shapeLayer.eachLayer(
function(layer) {

    const properties =
    layer.feature &&
    layer.feature.properties;

    const value =
    properties
        ? properties[attribute]
        : null;

    const displayValue =
    value === null ||
    value === undefined ||
    String(value).trim() === ""
        ? "(Kosong)"
        : String(value);


    const color =
    attributeHighlightColors[displayValue] ||
    getAttributeHighlightColor(
        displayValue
    );


    layer.setStyle({

    color: color,

    weight: 2,

    fillColor: color,

    fillOpacity: 0.55

    });

}
);


buildAttributeHighlightLegend(
attribute
);

// =====================================================
// ZOOM KE WILAYAH DENGAN POLYGON TERBANYAK
// =====================================================

const attributeGroups = {};

shapeLayer.eachLayer(
function(layer) {

    const properties =
    layer.feature &&
    layer.feature.properties;

    const value =
    properties
        ? properties[attribute]
        : null;

    const displayValue =
    value === null ||
    value === undefined ||
    String(value).trim() === ""
        ? "(Kosong)"
        : String(value);

    if (!attributeGroups[displayValue]) {
    attributeGroups[displayValue] = [];
    }

    attributeGroups[displayValue].push(
    layer
    );

}
);

let largestGroup = [];
let largestValue = "";

Object.keys(attributeGroups)
.forEach(
    function(value) {

    if (
        attributeGroups[value].length >
        largestGroup.length
    ) {

        largestGroup =
        attributeGroups[value];

        largestValue =
        value;

    }

    }
);

if (largestGroup.length) {

const group =
    L.featureGroup(
    largestGroup
    );

const bounds =
    group.getBounds();

if (bounds.isValid()) {

    shapeMap.fitBounds(
    bounds,
    {
        padding: [40, 40],
        maxZoom: 16
    }
    );

}

}

document.getElementById(
"shapeEditorStatus"
).textContent =
"Atribut \"" +
largestValue +
"\" memiliki " +
largestGroup.length +
" polygon dan ditampilkan sebagai wilayah utama.";

}


function buildAttributeHighlightLegend(attribute) {

const legend =
document.getElementById(
    "attributeHighlightLegend"
);

if (!legend) {
return;
}

legend.innerHTML = "";

}

function editAttributes() {

if (!selectedShapeLayer) {

document.getElementById(
    "shapeEditorStatus"
).textContent =
    "Pilih polygon terlebih dahulu.";

return;

}

const properties =
selectedShapeLayer.feature &&
selectedShapeLayer.feature.properties;

if (!properties) {

return;

}

const container =
document.getElementById(
    "shapeAttributes"
);

container.innerHTML = "";


Object.entries(properties)
.forEach(
    function([key, value]) {

    const row =
        document.createElement("div");

    row.className =
        "attribute-row";


    const keyElement =
        document.createElement("span");

    keyElement.className =
        "attribute-key";

    keyElement.textContent =
        key;


    const input =
        document.createElement("input");

    input.type =
        "text";

    input.className =
        "attribute-edit-input";

    input.value =
        value ?? "";

    input.dataset.key =
        key;


    row.appendChild(
        keyElement
    );

    row.appendChild(
        input
    );

    container.appendChild(
        row
    );

    }
);

const actionContainer =
document.createElement("div");

actionContainer.style.display =
"flex";

actionContainer.style.gap =
"8px";

actionContainer.style.marginTop =
"12px";


const saveButton =
document.createElement("button");

saveButton.type =
"button";

saveButton.className =
"shape-editor-button success";

saveButton.textContent =
"Simpan";

saveButton.addEventListener(
"click",
saveAttributes
);


const cancelButton =
document.createElement("button");

cancelButton.type =
"button";

cancelButton.className =
"shape-editor-button secondary";

cancelButton.textContent =
"Batal";

cancelButton.addEventListener(
"click",
cancelAttributes
);


actionContainer.appendChild(
saveButton
);

actionContainer.appendChild(
cancelButton
);

container.appendChild(
actionContainer
);


document.getElementById(
"shapeEditorStatus"
).textContent =
"Mode edit atribut aktif.";

}

async function saveAttributes() {

if (!selectedShapeLayer) {
return;
}

const properties =
selectedShapeLayer.feature &&
selectedShapeLayer.feature.properties;

if (!properties) {
return;
}

const inputs =
document.querySelectorAll(
    "#shapeAttributes .attribute-edit-input"
);

inputs.forEach(
function(input) {

    const key =
    input.dataset.key;

    properties[key] =
    input.value;

}
);


// =====================================================
// SIMPAN GEOJSON KE INDEXED DB
// =====================================================

try {

const cachedShape =
    await loadShapeCache();

if (cachedShape) {

    cachedShape.geojson =
    activeGeoJSON;

    await saveShapeCache(
    cachedShape
    );

}


// Tampilkan kembali sebagai teks

showAttributes(
    properties
);


document.getElementById(
    "shapeEditorStatus"
).textContent =
    "Perubahan atribut berhasil disimpan.";

} catch (error) {

console.error(
    "[Shape Editor] Gagal menyimpan atribut:",
    error
);

document.getElementById(
    "shapeEditorStatus"
).textContent =
    "Gagal menyimpan perubahan atribut.";

}

}

function cancelAttributes() {

if (!selectedShapeLayer) {
return;
}

showAttributes(
selectedShapeLayer.feature.properties
);

document.getElementById(
"shapeEditorStatus"
).textContent =
"Perubahan atribut dibatalkan.";

}

function resetAttributeHighlight() {

attributeHighlightActive =
false;

attributeHighlightAttribute =
"";

attributeHighlightColors =
{};


if (shapeLayer) {

shapeLayer.eachLayer(
    function(layer) {

    layer.setStyle({

        color: "#3388ff",

        weight: 2,

        fillColor: "#3388ff",

        fillOpacity: 0.35

    });

    }
);

}


const legend =
document.getElementById(
    "attributeHighlightLegend"
);

if (legend) {
legend.innerHTML = "";
}


const select =
document.getElementById(
    "highlightAttributeSelect"
);

if (select) {
select.value = "";
}

}


document
.getElementById(
"highlightAttributeButton"
)
.addEventListener(
"click",
function() {

    const panel =
    document.getElementById(
        "attributeHighlightPanel"
    );

    if (
    panel.style.display === "none"
    ) {

    populateHighlightAttributes();

    document.getElementById(
        "attributeHighlightColors"
    ).innerHTML = "";

    panel.style.display =
        "block";

    } else {

    panel.style.display =
        "none";

    }

}
);

document
.getElementById(
"editPolygonButton"
)
.addEventListener(
"click",
editAttributes
);

document
.getElementById(
"highlightAttributeSelect"
)
.addEventListener(
"change",
function() {

    const attribute =
    this.value;

    if (!attribute) {

    document.getElementById(
        "attributeHighlightColors"
    ).innerHTML = "";

    return;

    }

    attributeHighlightColors =
    attributeHighlightColorsByAttribute[
        attribute
    ] || {};

    
    populateHighlightColors(
    attribute
    );

}
);

document
.getElementById(
"applyHighlightButton"
)
.addEventListener(
"click",
applyAttributeHighlight
);

document
.getElementById(
"shapeSearchAttribute"
)
.addEventListener(
"change",
function() {

    populateSearchValues(
    this.value
    );

}
);

document
.getElementById(
"shapeSearchInput"
)
.addEventListener(
"focus",
function() {

    const attribute =
    document.getElementById(
        "shapeSearchAttribute"
    ).value;

    populateSearchValues(
    attribute
    );

}
);      

document
.getElementById(
"shapeSearchInput"
)
.addEventListener(
"input",
function() {

    const attribute =
    document.getElementById(
        "shapeSearchAttribute"
    ).value;

    if (!attribute) {

    document.getElementById(
        "shapeSearchValues"
    ).style.display =
        "none";

    return;

    }

    populateSearchValues(
    attribute,
    this.value.trim()
    );

}
);

document.addEventListener(
"click",
function(event) {

const search =
    document.querySelector(
    ".shape-search"
    );

const values =
    document.getElementById(
    "shapeSearchValues"
    );

if (
    search &&
    values &&
    !search.contains(event.target)
) {

    values.style.display =
    "none";

}

}
);

document
.getElementById(
"resetHighlightButton"
)
.addEventListener(
"click",
resetAttributeHighlight
);

/* =====================================================
LOAD SHAPEFILE YANG SUDAH TERSIMPAN
===================================================== */

async function loadExistingShapefile() {

const status =
document.getElementById(
    "shapeStatus"
);

try {

const response =
    await fetch(
    "/api/shapefile/data"
    );


// Belum ada SHP
if (response.status === 404) {

    status.textContent =
    "Belum ada Shapefile yang dimuat.";

    return;

}


const result =
    await response.json();


if (
    !response.ok ||
    !result.success
) {

    throw new Error(
    result.message ||
    "Gagal memuat Shapefile."
    );

}


// -------------------------------------------------
// Informasi SHP
// -------------------------------------------------

document.getElementById(
    "shapeFilename"
).textContent =
    result.filename;


document.getElementById(
    "shapeFeatureCount"
).textContent =
    result.feature_count;


document.getElementById(
    "shapeColumnCount"
).textContent =
    result.columns.length;


document.getElementById(
    "shapeInfo"
).style.display =
    "grid";


status.textContent =
    "Shapefile berhasil dimuat dari penyimpanan.";


// -------------------------------------------------
// Tampilkan kembali peta
// -------------------------------------------------

displayGeoJSON(
    result.geojson
);


} catch (error) {

console.error(
    error
);

status.textContent =
    "Error: " +
    error.message;

}

}

/* =====================================================
UPLOAD SHAPEFILE
===================================================== */

async function uploadShapefile() {

const input =
document.getElementById(
    "shapeFile"
);

const status =
document.getElementById(
    "shapeStatus"
);


if (!input.files.length) {

status.textContent =
    "Silakan pilih file ZIP atau RAR Shapefile.";

return;

}


const file =
input.files[0];


status.textContent =
"Sedang membaca Shapefile...";


const formData =
new FormData();

formData.append(
"file",
file
);


try {

const response =
    await fetch(
    "/api/shapefile/upload",
    {
        method: "POST",
        body: formData
    }
    );


const result =
    await response.json();


if (!response.ok ||
    !result.success) {

    throw new Error(
    result.message ||
    "Gagal membaca Shapefile."
    );

}


document.getElementById(
    "shapeFilename"
).textContent =
    result.filename;


document.getElementById(
    "shapeFeatureCount"
).textContent =
    result.feature_count;


document.getElementById(
    "shapeColumnCount"
).textContent =
    result.columns.length;


document.getElementById(
    "shapeInfo"
).style.display =
    "grid";


status.textContent =
    "Shapefile berhasil dimuat.";


displayGeoJSON(
    result.geojson
);

await saveShapeCache({
    filename:
    result.filename,

    feature_count:
    result.feature_count,

    columns:
    result.columns,

    geojson:
    result.geojson
});


} catch (error) {

console.error(error);

status.textContent =
    "Error: " +
    error.message;

}

}


/* =====================================================
EVENT
===================================================== */

document
.getElementById(
"uploadShapeButton"
)
.addEventListener(
"click",
uploadShapefile
);


document
    .getElementById("matchExcelSheet")
    ?.addEventListener(
        "change",
        loadMatchExcelHeaders
    );

document
    .getElementById("matchExcelHeader")
    ?.addEventListener(
        "change",
        loadMatchExcelKeys
    );

document
.getElementById(
"shapeSearchButton"
)
.addEventListener(
"click",
searchPolygons
);


document
.getElementById(
"shapeSearchInput"
)
.addEventListener(
"keydown",
function(event) {

    if (
    event.key === "Enter"
    ) {

    searchPolygons();

    }

}
);  

/* =====================================================
RESTORE SAAT HALAMAN DIBUKA
===================================================== */

// =====================================================
// RESTORE SHAPE EDITOR
// =====================================================

let shapeRestoreRunning = false;

async function restoreShapeEditor() {

// Hindari restore dua kali
if (shapeRestoreRunning) {
    return;
}

shapeRestoreRunning = true;

try {

    const cachedShape =
    await loadShapeCache();


    // =================================================
    // CACHE BROWSER
    // =================================================

    if (cachedShape) {

    try {

        console.log(
        "[Shape Editor] Restore dari IndexedDB..."
        );

        attributeHighlightColorsByAttribute =
        cachedShape.attributeHighlightColors || {};

        attributeHighlightColors = {};


        if (
        !cachedShape.geojson ||
        !Array.isArray(
            cachedShape.geojson.features
        ) ||
        cachedShape.geojson.features.length === 0
        ) {

        throw new Error(
            "Cache GeoJSON kosong atau tidak valid."
        );

        }


        document.getElementById(
        "shapeFilename"
        ).textContent =
        cachedShape.filename || "-";


        document.getElementById(
        "shapeFeatureCount"
        ).textContent =
        cachedShape.feature_count || 0;


        document.getElementById(
        "shapeColumnCount"
        ).textContent =
        cachedShape.columns
            ? cachedShape.columns.length
            : 0;


        document.getElementById(
        "shapeInfo"
        ).style.display =
        "grid";


        document.getElementById(
        "shapeStatus"
        ).textContent =
        "Shapefile dimuat dari cache browser.";


        // ---------------------------------------------
        // Render
        // ---------------------------------------------

        displayGeoJSON(
        cachedShape.geojson
        );


        // ---------------------------------------------
        // Pastikan ukuran map benar setelah halaman
        // kembali aktif
        // ---------------------------------------------

        setTimeout(
        function() {

            if (shapeMap) {

            shapeMap.invalidateSize(
                true
            );

            }

        },
        200
        );


        return;

    } catch (error) {

        console.warn(
        "[Shape Editor] Cache gagal dirender:",
        error
        );

    }

    }


    // =================================================
    // FALLBACK SERVER
    // =================================================

    console.log(
    "[Shape Editor] Menggunakan SHP dari server..."
    );

    await loadExistingShapefile();


} catch (error) {

    console.error(
    "[Shape Editor] Restore error:",
    error
    );

} finally {

    shapeRestoreRunning = false;

}

}

document
.getElementById(
"shapeRandomButton"
)
.addEventListener(
"click",
function() {

    const menu =
    document.getElementById(
        "shapeRandomMenu"
    );

    menu.style.display =
    menu.style.display === "block"
        ? "none"
        : "block";

}
);


document
.getElementById(
"randomPolygonButton"
)
.addEventListener(
"click",
function() {

    document.getElementById(
    "shapeRandomMenu"
    ).style.display =
    "none";

    randomPolygon();

}
);


document
.getElementById(
"randomAttributeButton"
)
.addEventListener(
"click",
function() {

    document.getElementById(
    "shapeRandomMenu"
    ).style.display =
    "none";

    randomAttribute();

}
);

/* =====================================================
EXPORT MODAL
===================================================== */

function openExportModal() {

const modal =
    document.getElementById(
    "shapeExportModal"
    );

if (!modal) {
    return;
}


// Pastikan ada data
if (
    !activeGeoJSON ||
    !Array.isArray(
    activeGeoJSON.features
    ) ||
    !activeGeoJSON.features.length
) {

    document.getElementById(
    "shapeEditorStatus"
    ).textContent =
    "Tidak ada data yang dapat diekspor.";

    return;

}


// Jumlah polygon
document.getElementById(
    "shapeExportFeatureCount"
).textContent =
    activeGeoJSON.features.length;


// Ambil seluruh nama atribut
const attributes =
    new Set();


activeGeoJSON.features.forEach(
    function(feature) {

    if (
        feature &&
        feature.properties
    ) {

        Object.keys(
        feature.properties
        ).forEach(
        function(key) {

            attributes.add(key);

        }
        );

    }

    }
);


document.getElementById(
    "shapeExportColumnCount"
).textContent =
    attributes.size;


modal.style.display =
    "flex";

}


function closeExportModal() {

const modal =
    document.getElementById(
    "shapeExportModal"
    );

if (!modal) {
    return;
}

modal.style.display =
    "none";

}

function updateExportFormat() {

const format =
    document.querySelector(
    'input[name="shapeExportFormat"]:checked'
    );

const description =
    document.getElementById(
    "shapeExportFormatDescription"
    );

const filename =
    document.getElementById(
    "shapeExportFilename"
    );

if (!format) {
    return;
}


if (format.value === "shp") {

    description.textContent =
    "SHP akan berisi geometry dan seluruh atribut " +
    "yang sudah tersimpan.";

    filename.value =
    "variety_engine_export";

}


if (format.value === "excel") {

    description.textContent =
    "Excel akan berisi seluruh data atribut " +
    "dari polygon yang sudah tersimpan.";

    filename.value =
    "variety_engine_export";

}

}


async function exportShapeData() {

const progressInterval = setInterval(
    updateExportProgress,
    100
);

updateExportProgress();  

console.log("=== EXPORT DEBUG: MULAI ===");

console.log(
    "1. activeGeoJSON:",
    activeGeoJSON
);

if (
    !activeGeoJSON ||
    !Array.isArray(activeGeoJSON.features) ||
    !activeGeoJSON.features.length
) {
    console.error(
    "2. ERROR: activeGeoJSON tidak memiliki features."
    );

    document.getElementById(
    "shapeEditorStatus"
    ).textContent =
    "Tidak ada data yang dapat diekspor.";

    return;
}

console.log(
    "2. Jumlah feature:",
    activeGeoJSON.features.length
);

const format = document.querySelector(
    'input[name="shapeExportFormat"]:checked'
);

console.log(
    "3. Format yang dipilih:",
    format
);

if (!format) {

    console.error(
    "3. ERROR: format export tidak ditemukan."
    );

    return;
}

console.log(
    "4. Nilai format:",
    format.value
);

if (format.value === "shp") {

    console.log(
    "5. Format SHP terdeteksi."
    );

    try {

    console.log(
        "6. Akan mengirim request ke /api/export-shp"
    );

    const response = await fetch(
        "/api/export-shp",
        {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            geojson: activeGeoJSON
        })
        }
    );

    console.log(
        "7. Response diterima:",
        response
    );

    console.log(
        "8. HTTP status:",
        response.status
    );

    const blob = await response.blob();

    console.log(
        "9. File diterima:",
        blob.type,
        blob.size,
        "bytes"
    );

    if (!response.ok) {
        throw new Error(
        "Server gagal membuat file."
        );
    }

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "variety_engine_export.zip";

    document.body.appendChild(link);

    link.click();

    link.remove();

    window.URL.revokeObjectURL(url);

    console.log(
        "10. Download SHP berhasil dipicu."
    );

    clearInterval(progressInterval);

    document.getElementById(
        "shapeEditorStatus"
    ).textContent =
        "File SHP berhasil diekspor.";

    closeExportModal();


    console.log(
        "11. EXPORT BERHASIL"
    );

    document.getElementById(
        "shapeEditorStatus"
    ).textContent =
        "Data SHP berhasil dikirim ke server.";

    closeExportModal();

    } catch (error) {

    console.error(
        "12. EXPORT ERROR:",
        error
    );

    document.getElementById(
        "shapeEditorStatus"
    ).textContent =
        "Gagal export SHP: " +
        error.message;
    }

} else if (format.value === "excel") {

    console.log(
    "5. Format Excel terdeteksi."
    );

    try {

    console.log(
        "6. Akan mengirim request ke /api/export-excel"
    );

    const response = await fetch(
        "/api/export-excel",
        {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            geojson: activeGeoJSON
        })
        }
    );

    console.log(
        "7. Response Excel diterima:",
        response
    );

    console.log(
        "8. HTTP status:",
        response.status
    );

    if (!response.ok) {
        throw new Error(
        "Server gagal membuat file Excel."
        );
    }

    const blob = await response.blob();

    console.log(
        "9. File Excel diterima:",
        blob.type,
        blob.size,
        "bytes"
    );

    const url = window.URL.createObjectURL(
        blob
    );

    const link = document.createElement(
        "a"
    );

    link.href = url;

    link.download =
        "variety_engine_export.xlsx";

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    window.URL.revokeObjectURL(
        url
    );

    console.log(
        "10. Download Excel berhasil dipicu."
    );

    clearInterval(progressInterval);

    document.getElementById(
        "shapeEditorStatus"
    ).textContent =
        "File Excel berhasil diekspor.";

    closeExportModal();

    } catch (error) {

    console.error(
        "12. EXPORT EXCEL ERROR:",
        error
    );

    document.getElementById(
        "shapeEditorStatus"
    ).textContent =
        "Gagal export Excel: " +
        error.message;
    }

}

console.log("=== EXPORT DEBUG: SELESAI ===");
}

async function updateExportProgress() {

try {

    const response = await fetch(
    "/api/export-progress"
    );

    const data = await response.json();

    if (!data.success) {
    return;
    }

    const percent = Math.max(
    0,
    Math.min(100, data.percent || 0)
    );

    const progressBar =
    document.getElementById(
        "shapeExportProgressBar"
    );

    const progressPercent =
    document.getElementById(
        "shapeExportProgressPercent"
    );

    const progressText =
    document.getElementById(
        "shapeExportProgressText"
    );

    if (progressBar) {
    progressBar.style.width =
        percent + "%";
    }

    if (progressPercent) {
    progressPercent.textContent =
        percent + "%";
    }

    if (progressText) {

    progressText.textContent =
        `${Number(data.current || 0).toLocaleString("id-ID")} / ` +
        `${Number(data.total || 0).toLocaleString("id-ID")} polygon`;
    }

    console.log(
    "[EXPORT PROGRESS]",
    percent + "%",
    data.current,
    "/",
    data.total,
    data.message
    );

} catch (error) {

    console.error(
    "[EXPORT PROGRESS ERROR]",
    error
    );
}
}      


document
.querySelectorAll(
    'input[name="shapeExportFormat"]'
)
.forEach(
    function(input) {

    input.addEventListener(
        "change",
        updateExportFormat
    );

    }
);      

document
.getElementById(
    "shapeExportCloseButton"
)
.addEventListener(
    "click",
    closeExportModal
);


document
.getElementById(
    "shapeExportCancelButton"
)
.addEventListener(
    "click",
    closeExportModal
);


document
.getElementById(
    "shapeExportModal"
)
.addEventListener(
    "click",
    function(event) {

    if (
        event.target === this
    ) {

        closeExportModal();

    }

    }
);

// =====================================================
// INITIAL LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        restoreShapeEditor();

        loadMatchExcelSheets();

        document
            .getElementById("matchExcelFile")
            ?.addEventListener(
                "change",
                uploadMatchExcel
            );

    }
);

// =====================================================
// KEMBALI KE SHAPE EDITOR
// =====================================================

window.addEventListener(
"pageshow",
async function(event) {

    console.log(
    "[Shape Editor] pageshow:",
    event.persisted
    );


    // =================================================
    // JIKA HALAMAN DIKEMBALIKAN DARI BFCACHE
    // =================================================

    if (event.persisted) {

    try {

        const cachedShape =
        await loadShapeCache();


        if (
        cachedShape &&
        cachedShape.geojson &&
        Array.isArray(
            cachedShape.geojson.features
        )
        ) {

        console.log(
            "[Shape Editor] Memulihkan tampilan map setelah kembali ke halaman..."
        );


        // ---------------------------------------------
        // Pastikan workspace terlihat
        // ---------------------------------------------

        document.getElementById(
            "shapeWorkspace"
        ).style.display = "grid";


        // ---------------------------------------------
        // Pastikan map tersedia
        // ---------------------------------------------

        initializeShapeMap();


        // ---------------------------------------------
        // Beri waktu browser mengembalikan layout
        // ---------------------------------------------

        setTimeout(
            function() {

            try {

                shapeMap.invalidateSize(
                true
                );


                // -----------------------------------------
                // Render kembali layer dari cache
                // -----------------------------------------

                displayGeoJSON(
                cachedShape.geojson
                );


                setTimeout(
                function() {

                    if (shapeMap) {

                    shapeMap.invalidateSize(
                        true
                    );

                    }

                },
                200
                );


            } catch (error) {

                console.error(
                "[Shape Editor] Gagal render ulang setelah kembali:",
                error
                );

            }

            },
            150
        );

        }

    } catch (error) {

        console.error(
        "[Shape Editor] Gagal restore setelah kembali:",
        error
        );

    }

    }

}
);

async function uploadMatchExcel() {
    const fileInput = document.getElementById("matchExcelFile");
    const status = document.getElementById("matchExcelStatus");

    if (!fileInput || !fileInput.files.length) {
        if (status) status.textContent = "Pilih file Excel terlebih dahulu.";
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        if (status) status.textContent = "Mengupload Excel...";

        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                result.error ||
                "Gagal upload Excel."
            );
        }

        if (status) {
            status.textContent = "Excel berhasil diupload.";
        }

        await loadMatchExcelSheets();

    } catch (error) {
        console.error("[Match Excel] Gagal upload:", error);

        if (status) {
            status.textContent = "Gagal upload: " + error.message;
        }
    }
}

async function loadMatchExcelSheets() {

    const select =
        document.getElementById("matchExcelSheet");

    const status =
        document.getElementById("matchExcelStatus");

    if (!select) {
        return;
    }

    try {

        select.innerHTML =
            '<option value="">Memuat sheet...</option>';

        const response =
            await fetch("/api/sheets");

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Gagal mengambil daftar sheet."
            );
        }

        select.innerHTML =
            '<option value="">Pilih Sheet</option>';

        result.sheets.forEach(function(sheet) {

            const option =
                document.createElement("option");

            option.value = sheet;
            option.textContent = sheet;

            select.appendChild(option);

        });

        if (status) {
            status.textContent =
                result.sheets.length +
                " sheet tersedia.";
        }

    } catch (error) {

        console.error(
            "[Match Excel] Gagal mengambil sheet:",
            error
        );

        select.innerHTML =
            '<option value="">Gagal memuat</option>';

        if (status) {
            status.textContent =
                "Gagal memuat sheet: " +
                error.message;
        }

    }

}

async function loadMatchExcelHeaders() {

    const sheetSelect =
        document.getElementById("matchExcelSheet");

    const headerSelect =
        document.getElementById("matchExcelHeader");

    const status =
        document.getElementById("matchExcelStatus");

    if (!sheetSelect || !headerSelect) {
        return;
    }

    const sheet =
        sheetSelect.value;

    if (!sheet) {

        headerSelect.innerHTML =
            '<option value="">Pilih Header</option>';

        return;
    }

    try {

        headerSelect.innerHTML =
            '<option value="">Memuat header...</option>';

        const response =
            await fetch(
                "/api/headers?sheet=" +
                encodeURIComponent(sheet)
            );

        const result =
            await response.json();

        console.log(
            "[Match Excel] HASIL HEADER:",
            result
        );

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Gagal mengambil header."
            );
        }

        headerSelect.innerHTML =
            '<option value="">Pilih Header</option>';

        result.candidates.forEach(function(header) {

            const option =
                document.createElement("option");

            option.value =
                header.row_number;

            option.textContent =
                "Baris " + header.row_number;

            headerSelect.appendChild(option);

        });

        if (status) {
            status.textContent =
                result.candidates.length +          
                " kandidat header ditemukan.";
        }

    } catch (error) {

        console.error(
            "[Match Excel] Gagal mengambil header:",
            error
        );

        headerSelect.innerHTML =
            '<option value="">Gagal memuat</option>';

        if (status) {
            status.textContent =
                "Gagal memuat header: " +
                error.message;
        }

    }

}

async function loadMatchExcelKeys() {

    const sheetSelect =
        document.getElementById("matchExcelSheet");

    const headerSelect =
        document.getElementById("matchExcelHeader");

    const keySelect =
        document.getElementById("matchExcelKey");

    const status =
        document.getElementById("matchExcelStatus");

    if (
        !sheetSelect ||
        !headerSelect ||
        !keySelect
    ) {
        return;
    }

    const sheet =
        sheetSelect.value;

    const header =
        headerSelect.value;

    if (!sheet || !header) {

        keySelect.innerHTML =
            '<option value="">Pilih atribut Excel</option>';

        return;
    }

    try {

        keySelect.innerHTML =
            '<option value="">Memuat atribut...</option>';

        const response =
            await fetch(
                "/api/preview?sheet=" +
                encodeURIComponent(sheet) +
                "&header=" +
                encodeURIComponent(header) +
                "&limit=1"
            );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                result.message ||
                "Gagal mengambil atribut Excel."
            );
        }

        keySelect.innerHTML =
            '<option value="">Pilih atribut Excel</option>';

        result.columns.forEach(
            function(column) {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    column;

                option.textContent =
                    column;

                keySelect.appendChild(
                    option
                );

            }
        );

        if (status) {
            status.textContent =
                result.columns.length +
                " atribut Excel tersedia.";
        }

    } catch (error) {

        console.error(
            "[Match Excel] Gagal mengambil atribut Excel:",
            error
        );

        keySelect.innerHTML =
            '<option value="">Gagal memuat</option>';

        if (status) {
            status.textContent =
                "Gagal memuat atribut Excel: " +
                error.message;
        }

    }
}
