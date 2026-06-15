//Globe Setup
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMzI2OGQxYy1jMzVkLTRmNzUtYTI2NC1hYWUzMDNkOWVjZWEiLCJpZCI6NDQzMjY4LCJzdWIiOiJBbmdlbG8yMCIsImlzcyI6Imh0dHBzOi8vYXBpLmNlc2l1bS5jb20iLCJhdWQiOiJBbmdlbG8yMF9kZWZhdWx0IiwiaWF0IjoxNzgxMTkyNTc5fQ.4xGDesdC7H6rTfiqEVFEdzWvsDFGwUHUKqobzMrYB6E";

// Sets default map style
const viewer = new Cesium.Viewer("cesiumContainer", {
    imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 })
});





// ================================== Layer Toggles ==================================
const LAYERS = [
  {
    id: "ir",
    label: "Infrared",
    desc: "Infrared color map",
    icon: "cloud",
    hasOpacity: false,
    init: async (viewer) => {
      return await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
      // assigned to viewer.terrainProvider, not imageryLayers
    },
  },

  //======================== Country Borders =========================





  
  {
    id: "buildings",
    label: "OSM buildings",
    desc: "3D building footprints",
    icon: "ti-building",
    hasOpacity: true,
    init: async (viewer) => {
      return await Cesium.createOsmBuildingsAsync();
      // returns a Cesium3DTileset
    },
  },
  {
    id: "labels",
    label: "Place labels",
    desc: "Cities, countries, roads",
    icon: "ti-typography",
    hasOpacity: true,
    init: async (viewer) => {
      return viewer.imageryLayers.addImageryProvider(
        await Cesium.IonImageryProvider.fromAssetId(3812)
      );
    },
  },
  // Add your own:
  // { id: "geojson", label: "GeoJSON overlay", ... init: async (v) => v.dataSources.add(await Cesium.GeoJsonDataSource.load("./data.geojson")) }
];

// ─── State ────────────────────────────────────────────────────────────────────
const layerState = {}; // { [id]: { ref, visible, opacity } }

// ─── Panel builder ───────────────────────────────────────────────────────────
function buildLayerPanel(viewer) {
  const panel = document.createElement("div");
  panel.id = "layer-panel";
  panel.innerHTML = `
    <div class="lp-header">
      <span>⬡ Map layers</span>
      <button id="lp-close">✕</button>
    </div>
    <div id="lp-rows"></div>
  `;

  // Minimal styles (inline so no extra CSS file needed)
  Object.assign(panel.style, {
    position: "absolute", top: "80px", left: "16px", width: "280px",
    background: "rgba(30,30,30,0.92)", color: "#fff",
    borderRadius: "8px", padding: "12px", zIndex: 999,
    fontFamily: "sans-serif", fontSize: "13px",
    backdropFilter: "blur(8px)",
  });

  document.getElementById("cesiumContainer").appendChild(panel);
  document.getElementById("lp-close").onclick = () => panel.remove();

  LAYERS.forEach(layer => addLayerRow(viewer, layer));
}

async function addLayerRow(viewer, layer) {
  // If state doesn't exist yet, initialize it (fallback)
  if (!layerState[layer.id]) {
    layerState[layer.id] = { ref: null, visible: !!layer.defaultOn, opacity: 1 };
  }

  const state = layerState[layer.id];
  const isChecked = state.visible;

  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1)";
  row.innerHTML = `
    <span style="flex:1">${layer.label}<br><small style="opacity:.6">${layer.desc}</small></span>
    ${layer.hasOpacity ? `<input type="range" min="0" max="1" step="0.05" value="${state.opacity}" style="width:52px" data-opacity="${layer.id}">` : ""}
    <label style="position:relative;width:36px;height:20px;flex-shrink:0">
      <input type="checkbox" data-toggle="${layer.id}" ${isChecked ? "checked" : ""} style="opacity:0;width:0;height:0">
      <span data-track="${layer.id}" style="position:absolute;inset:0;background:${isChecked ? "#378ADD" : "#555"};border-radius:20px;cursor:pointer;transition:background .2s">
        <span data-thumb="${layer.id}" style="position:absolute;width:14px;height:14px;left:3px;top:3px;background:#fff;border-radius:50%;transition:transform .2s;${isChecked ? "transform:translateX(16px)" : ""}"></span>
      </span>
    </label>
  `;

  // Toggle handler
  row.querySelector(`[data-toggle="${layer.id}"]`).addEventListener("change", async (e) => {
    const on = e.target.checked;
    const track = row.querySelector(`[data-track="${layer.id}"]`);
    const thumb = row.querySelector(`[data-thumb="${layer.id}"]`);
    track.style.background = on ? "#378ADD" : "#555";
    thumb.style.transform = on ? "translateX(16px)" : "";

    if (on && !state.ref) {
      // Lazy-init: load the layer only when first enabled
      state.ref = await layer.init(viewer);
      if (layer.id === "terrain") viewer.terrainProvider = state.ref;
      else if (state.ref instanceof Cesium.Cesium3DTileset) viewer.scene.primitives.add(state.ref);
    }

    state.visible = on;
    applyVisibility(layer.id, viewer);
  });

  // Opacity handler
  const opSlider = row.querySelector(`[data-opacity="${layer.id}"]`);
  if (opSlider) {
    opSlider.addEventListener("input", (e) => {
      state.opacity = parseFloat(e.target.value);
      applyOpacity(layer.id);
    });
  }

  document.getElementById("lp-rows").appendChild(row);
}

function applyVisibility(id, viewer) {
  const { ref, visible } = layerState[id];
  if (!ref) return;
  if (ref instanceof Cesium.ImageryLayer) ref.show = visible;
  else if (ref instanceof Cesium.Cesium3DTileset) ref.show = visible;
  else if (ref instanceof Cesium.DataSource) ref.show = visible;
}

function applyOpacity(id) {
  const { ref, opacity } = layerState[id];
  if (!ref) return;
  if (ref instanceof Cesium.ImageryLayer) ref.alpha = opacity;
  else if (ref instanceof Cesium.Cesium3DTileset) ref.style = new Cesium.Cesium3DTileStyle({ color: `color('white', ${opacity})` });
}

// ─── Toggle button ───────────────────────────────────────────────────────────
function addLayerToggleButton(viewer) {
  const btn = document.createElement("button");
  btn.textContent = "⬡ Layers";
  Object.assign(btn.style, {
    position: "absolute", top: "40px", left: "16px",
    background: "rgba(30,30,30,0.88)", color: "#fff",
    border: "none", borderRadius: "6px", padding: "6px 12px",
    cursor: "pointer", zIndex: 999, fontSize: "13px",
  });
  btn.onclick = () => {
    const existing = document.getElementById("layer-panel");
    existing ? existing.remove() : buildLayerPanel(viewer);
  };
  document.getElementById("cesiumContainer").appendChild(btn);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initializeLayers(viewer) {
  for (const layer of LAYERS) {
    const isDefault = !!layer.defaultOn;
    layerState[layer.id] = { ref: null, visible: isDefault, opacity: 1 };

    if (isDefault) {
      try {
        layerState[layer.id].ref = await layer.init(viewer);
        if (layer.id === "terrain") {
          viewer.terrainProvider = layerState[layer.id].ref;
        } else if (layerState[layer.id].ref instanceof Cesium.Cesium3DTileset) {
          viewer.scene.primitives.add(layerState[layer.id].ref);
        }
        applyVisibility(layer.id, viewer);
      } catch (error) {
        console.error(`Failed to initialize default layer ${layer.id}:`, error);
      }
    }
  }
}

// Start initialization
initializeLayers(viewer);
addLayerToggleButton(viewer);


// ========================== Cloud Layer =============================

// Clear default layers
viewer.imageryLayers.removeAll();

// 1. Base Layer (OpenStreetMap provides standard mapping underneath)
viewer.imageryLayers.addImageryProvider(
  new Cesium.OpenStreetMapImageryProvider({
    url: "https://tile.openstreetmap.org/",
    credit: "OpenStreetMap contributors"
  })
);

// 2. Real-time Global Cloud Layer from EUMETSAT (OGC WMS)
// This layer merges multiple geostationary satellites into a seamless global image.
const eumetsatCloudLayer = new Cesium.WebMapServiceImageryProvider({
  url: "https://view.eumetsat.int/geoserver/wms", 
  layers: "mumi:wideareacoverage_rgb_airmass", // defines what data is pulled from api
  parameters: {
    transparent: "true",
    format: "image/png",
    version: "1.3.0"
  },

  hasAlphaChannel: true,

  credit: "© EUMETSAT Weather Data"
});

eumetsatCloudLayer.alpha = 0.5;

// Add the gap-free layer to your viewer
viewer.imageryLayers.addImageryProvider(eumetsatCloudLayer);



// ============================ Aurora Layer ===============================



// // --- Fetch data ---
// const url =
// "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";

// fetch(url)
//     .then(response => response.json())
//     .then(data => {

//         let coords = data.coordinates;

//         // --- Convert to structured array ---
//         let df = coords.map(c => ({
//             lon: c[0],
//             lat: c[1],
//             prob: c[2]
//         }));

//         // --- DOWNSAMPLE (performance fix) ---
//         df = df.filter((_, i) => i % 2 === 0);

//         // --- Filter low probability noise ---
//         df = df.filter(p => p.prob > 20);

//         // --- Render to Cesium ---
//         df.forEach(p => {

//             viewer.entities.add({
//                 position: Cesium.Cartesian3.fromDegrees(
//                     p.lon,
//                     p.lat
//                 ),

//                 point: {
//                     pixelSize: 2,
//                     color: Cesium.Color.fromHsl(
//                         0.33,  // green hue
//                         1.0,
//                         0.5,
//                         0.8
//                     ),
//                     opacity: 0.8
//                 }
//             });

//         });

//     });