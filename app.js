// Globe Setup
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMzI2OGQxYy1jMzVkLTRmNzUtYTI2NC1hYWUzMDNkOWVjZWEiLCJpZCI6NDQzMjY4LCJzdWIiOiJBbmdlbG8yMCIsImlzcyI6Imh0dHBzOi8vYXBpLmNlc2l1bS5jb20iLCJhdWQiOiJBbmdlbG8yMF9kZWZhdWx0IiwiaWF0IjoxNzgxMTkyNTc5fQ.4xGDesdC7H6rTfiqEVFEdzWvsDFGwUHUKqobzMrYB6E";

// Initialize Cesium Viewer with default OpenStreetMap base layer
const viewer = new Cesium.Viewer("cesiumContainer", {
    timeline: false,
    animation: false
});

// State to store loaded layer objects and visibility
const layerState = {
    earthquakes: { ref: null, visible: false },
    weather: { refClouds: null, refPrecip: null, visible: false },
    auroras: { ref: null, visible: false },
    daynight: { ref: null, visible: false }
};

// ==========================================
// 1. EARTHQUAKES LAYER (USGS Live GeoJSON)
// ==========================================
async function toggleEarthquakes(enable) {
    if (enable) {
        if (!layerState.earthquakes.ref) {
            try {
                console.log("Fetching live earthquake data...");
                const dataSource = await Cesium.GeoJsonDataSource.load(
                    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
                );

                // Style the points based on magnitude
                const entities = dataSource.entities.values;
                entities.forEach(entity => {
                    const magnitude = entity.properties.mag ? entity.properties.mag.getValue() : 1.0;
                    
                    // Choose color based on magnitude
                    let color;
                    if (magnitude >= 5.0) {
                        color = Cesium.Color.RED;
                    } else if (magnitude >= 3.0) {
                        color = Cesium.Color.ORANGE;
                    } else {
                        color = Cesium.Color.YELLOW;
                    }

                    // Style as highly visible point
                    entity.point = new Cesium.PointGraphics({
                        pixelSize: Math.max(6, magnitude * 3.5),
                        color: color,
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 1.5,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    });

                    // Set detailed HTML description for popup
                    const place = entity.properties.place ? entity.properties.place.getValue() : "Unknown Location";
                    const time = entity.properties.time ? new Date(entity.properties.time.getValue()).toLocaleString() : "Unknown Time";
                    const url = entity.properties.url ? entity.properties.url.getValue() : "#";
                    
                    entity.description = `
                        <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4; color: #fff; background: rgba(20,20,20,0.8); padding: 8px; border-radius: 4px;">
                            <h3 style="margin: 0 0 8px 0; color: ${color.toCssColorString()}; font-size: 15px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
                                Magnitude ${magnitude.toFixed(1)}
                            </h3>
                            <p style="margin: 4px 0;"><strong>Location:</strong> ${place}</p>
                            <p style="margin: 4px 0;"><strong>Time:</strong> ${time}</p>
                            <p style="margin: 8px 0 0 0;"><a href="${url}" target="_blank" style="color: #58a6ff; text-decoration: none; font-weight: bold;">More info on USGS ↗</a></p>
                        </div>
                    `;
                });

                viewer.dataSources.add(dataSource);
                layerState.earthquakes.ref = dataSource;
            } catch (error) {
                console.error("Error loading earthquake data:", error);
                alert("Failed to load live earthquake data.");
                return;
            }
        }
        layerState.earthquakes.ref.show = true;
    } else {
        if (layerState.earthquakes.ref) {
            layerState.earthquakes.ref.show = false;
        }
    }
    layerState.earthquakes.visible = enable;
}

// ==========================================
// 2. CLOUDS & PRECIPITATION LAYER
// ==========================================
async function toggleWeather(enable) {
    if (enable) {
        // 2a. Clouds (EUMETSAT WMS)
        if (!layerState.weather.refClouds) {
            try {
                const cloudProvider = new Cesium.WebMapServiceImageryProvider({
                    url: "https://view.eumetsat.int/geoserver/wms",
                    layers: "mumi:wideareacoverage_rgb_airmass",
                    parameters: {
                        transparent: "true",
                        format: "image/png",
                        version: "1.3.0"
                    },
                    hasAlphaChannel: true,
                    credit: "© EUMETSAT Weather Data"
                });
                layerState.weather.refClouds = viewer.imageryLayers.addImageryProvider(cloudProvider);
                layerState.weather.refClouds.alpha = 0.5; // Transparent cloud blend
            } catch (error) {
                console.error("Error initializing EUMETSAT cloud layer:", error);
            }
        }

        // 2b. Precipitation Radar (RainViewer live radar)
        if (!layerState.weather.refPrecip) {
            try {
                console.log("Fetching live RainViewer precipitation maps...");
                const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
                const data = await response.json();
                const host = data.host;
                const radarTimes = data.radar.past;
                
                if (radarTimes && radarTimes.length > 0) {
                    const latestTime = radarTimes[radarTimes.length - 1].time;
                    const precipProvider = new Cesium.UrlTemplateImageryProvider({
                        url: `${host}/v2/radar/${latestTime}/256/{z}/{x}/{y}/2/1_1.png`,
                        minimumLevel: 0,
                        maximumLevel: 10,
                        credit: "RainViewer Precipitation Data"
                    });
                    layerState.weather.refPrecip = viewer.imageryLayers.addImageryProvider(precipProvider);
                    layerState.weather.refPrecip.alpha = 0.8;
                }
            } catch (error) {
                console.error("Error initializing RainViewer precipitation layer:", error);
            }
        }

        // Show layers
        if (layerState.weather.refClouds) layerState.weather.refClouds.show = true;
        if (layerState.weather.refPrecip) layerState.weather.refPrecip.show = true;
    } else {
        // Hide layers
        if (layerState.weather.refClouds) layerState.weather.refClouds.show = false;
        if (layerState.weather.refPrecip) layerState.weather.refPrecip.show = false;
    }
    layerState.weather.visible = enable;
}



// ==========================================
// 3. AURORAS LAYER (NOAA Ovation 3D)
// ==========================================
async function toggleAuroras(enable) {
    if (enable) {
        if (!layerState.auroras.ref) {
            try {
                console.log("Fetching live NOAA Ovation aurora forecast...");

                const response = await fetch(
                    "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"
                );

                if (!response.ok) {
                    throw new Error("HTTP error " + response.status);
                }

                const data = await response.json();
                const coordinates = data.coordinates || data;

                const pointCollection = new Cesium.PointPrimitiveCollection();

                for (let i = 0; i < coordinates.length; i += 3) {
                    const c = coordinates[i];
                    if (!c) continue;

                    const lonRaw = c[0];
                    const lat = c[1];
                    const prob = c[2];

                    if (prob > 5) {
                        let lon = lonRaw;
                        if (lon > 180) lon -= 360;

                        // altitude variation = aurora curtain depth
                        const baseHeight = 100000;
                        const heightJitter = (prob / 100) * 90000;

                        const position = Cesium.Cartesian3.fromDegrees(
                            lon,
                            lat,
                            baseHeight + Math.random() * heightJitter
                        );

                        // smoother intensity curve
                        const t = prob / 100;

                        // green → cyan → purple shift at high energy
                        const hue =
                            0.33
                            - (t * 0.08)
                            + (t > 0.6 ? (t - 0.6) * 0.7 : 0);

                        // better glow falloff
                        const alpha = Math.min(0.95, 0.12 + t * 0.88);

                        // softer aurora blobs instead of harsh dots
                        const size = 6 + Math.pow(prob, 1.25) * 0.28;

                        pointCollection.add({
                            position: position,
                            color: Cesium.Color.fromHsl(hue, 1.0, 0.55, alpha),
                            pixelSize: size
                        });
                    }
                }

                viewer.scene.primitives.add(pointCollection);
                layerState.auroras.ref = pointCollection;

            } catch (error) {
                console.error("Aurora load failed:", error);
            }
        }

        layerState.auroras.ref.show = true;

    } else {
        if (layerState.auroras.ref) {
            layerState.auroras.ref.show = false;
        }
    }

    layerState.auroras.visible = enable;
}


// ==========================================
// 4. DAY/NIGHT LAYER
// ==========================================
function toggleDayNight(enable) {
    viewer.scene.globe.enableLighting = enable;
    viewer.scene.globe.dynamicAtmosphereLighting = enable;
    
    if (enable) {
        if (!layerState.daynight.ref) {
            try {
                console.log("Loading NASA GIBS Black Marble night lights...");
                const nightLightsProvider = new Cesium.UrlTemplateImageryProvider({
                    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
                    maximumLevel: 8,
                    credit: "NASA GIBS"
                });
                const layer = viewer.imageryLayers.addImageryProvider(nightLightsProvider);
                layer.dayAlpha = 0.0;
                layer.nightAlpha = 1.0;
                layer.brightness = 2; // Boost brightness so they remain visible when zoomed out
                layer.contrast = 1.8;   // Boost contrast to make the city lights pop vividly
                layerState.daynight.ref = layer;
            } catch (error) {
                console.error("Error loading night lights layer:", error);
            }
        }
        if (layerState.daynight.ref) {
            layerState.daynight.ref.show = true;
        }
    } else {
        if (layerState.daynight.ref) {
            layerState.daynight.ref.show = false;
        }
    }
    
    layerState.daynight.visible = enable;
}

// ==========================================
// 5. COUNTRY BORDERS LAYER
// ==========================================



// ==========================================
// CONTROL PANEL UI INITIALIZATION
// ==========================================
function setupUI() {
    // Create modern container
    const panel = document.createElement("div");
    panel.id = "layerPanel";
    panel.className = "control-panel";
    panel.innerHTML = `
        <div class="panel-header">
            <h2>Earth layers</h2>
        </div>
        <div class="panel-body">
            <!-- Earthquakes Layer -->
            <div class="control-row">
                <label class="switch">
                    <input type="checkbox" id="chkEarthquakes">
                    <span class="slider round"></span>
                </label>
                <div class="layer-info">
                    <span class="layer-title">Live Earthquakes</span>
                    <span class="layer-desc">Past 24hr seismic events (USGS)</span>
                </div>
            </div>
            <div class="legend" id="eqLegend" style="display:none;">
                <span class="legend-item"><span class="dot green"></span> Mag < 3.0</span>
                <span class="legend-item"><span class="dot orange"></span> Mag 3.0 - 5.0</span>
                <span class="legend-item"><span class="dot red"></span> Mag > 5.0</span>
            </div>

            <hr class="divider">

            <!-- Clouds & Precipitation Layer -->
            <div class="control-row">
                <label class="switch">
                    <input type="checkbox" id="chkWeather">
                    <span class="slider round"></span>
                </label>
                <div class="layer-info">
                    <span class="layer-title">Infrared Clouds & Temperature</span>
                    <span class="layer-desc">EUMETSAT clouds & RainViewer radar</span>
                </div>
            </div>
            <div class="slider-row" id="weatherOpacityRow" style="display:none;">
                <span>Opacity:</span>
                <input type="range" id="weatherOpacity" min="0" max="1" step="0.05" value="0.6">
            </div>

            <hr class="divider">

            <!-- Auroras Layer -->
            <div class="control-row">
                <label class="switch">
                    <input type="checkbox" id="chkAuroras">
                    <span class="slider round"></span>
                </label>
                <div class="layer-info">
                    <span class="layer-title">Auroras (3D)</span>
                    <span class="layer-desc">NOAA Ovation forecast (100km alt)</span>
                </div>
            </div>
            <div class="legend" id="auroraLegend" style="display:none;">
                <span class="legend-item"><span class="dot aurora-green"></span> Standard Aurora</span>
                <span class="legend-item"><span class="dot aurora-purple"></span> Intense Aurora</span>
            </div>

            <hr class="divider">

            <!-- Day/Night Layer -->
            <div class="control-row">
                <label class="switch">
                    <input type="checkbox" id="chkDayNight">
                    <span class="slider round"></span>
                </label>
                <div class="layer-info">
                    <span class="layer-title">Day/Night Cycle</span>
                    <span class="layer-desc">Real-time solar shading & atmosphere</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Event Listeners
    document.getElementById("chkEarthquakes").addEventListener("change", async (e) => {
        const active = e.target.checked;
        document.getElementById("eqLegend").style.display = active ? "flex" : "none";
        await toggleEarthquakes(active);
    });

    document.getElementById("chkWeather").addEventListener("change", async (e) => {
        const active = e.target.checked;
        document.getElementById("weatherOpacityRow").style.display = active ? "flex" : "none";
        await toggleWeather(active);
    });

    document.getElementById("weatherOpacity").addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        if (layerState.weather.refClouds) layerState.weather.refClouds.alpha = val * 0.8;
        if (layerState.weather.refPrecip) layerState.weather.refPrecip.alpha = val;
    });

    document.getElementById("chkAuroras").addEventListener("change", async (e) => {
        const active = e.target.checked;
        document.getElementById("auroraLegend").style.display = active ? "flex" : "none";
        await toggleAuroras(active);
    });

    document.getElementById("chkDayNight").addEventListener("change", (e) => {
        const active = e.target.checked;
        toggleDayNight(active);
    });
}

// Initialize UI Panel
setupUI();
