let map;
let mapMarker;
let forecastChart = null;
let globalForecastData = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("geo-btn").addEventListener("click", requestUserLocation);
    document.getElementById("search-btn").addEventListener("click", searchCity);
    document.getElementById("city-input").addEventListener("keypress", (e) => { if (e.key === "Enter") searchCity(); });
    document.getElementById("toggle-chart-btn").addEventListener("click", toggleChartContainer);
    document.getElementById("theme-slider").addEventListener("change", toggleThemeState);
    
    document.getElementById("close-chart").addEventListener("click", closeChart);
    document.getElementById("chart-overlay").addEventListener("click", closeChart);

    document.getElementById("precipitation-card").addEventListener("click", showPrecipitation);
    document.getElementById("aqi-card").addEventListener("click", showAQIInfo);
    document.getElementById("humidity-card").addEventListener("click", showHumidity);
    document.getElementById("wind-speed-card").addEventListener("click", showWindInfo);
    document.getElementById("wind-dir-card")
        .addEventListener("click", showWindDirection);
    
    document.getElementById("feels-like-card")
        .addEventListener("click", showFeelsLikeInfo);

    document.getElementById("close-info").addEventListener("click", closeInfoPopup);
    document.getElementById("info-popup").addEventListener("click", closeInfoPopup);

    setupAutocomplete();

    requestUserLocation();
});

function requestUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => { loadDashboardData(position.coords.latitude, position.coords.longitude); },
            () => { console.warn("Browser geo-prompt bypassed. Awaiting query input track."); }
        );
    }
}

async function searchCity() {
    const query = document.getElementById("city-input").value.trim();
    if (!query) return;
    try {
        const response = await fetch(`/search/${encodeURIComponent(query)}`);
        const data = await response.json();
        if (response.ok) { loadDashboardData(data.lat, data.lon); }
        else { alert(`Location query error: ${data.error}`); }
    } catch (err) { alert("Could not contact local Flask web server backend."); }
}

async function loadDashboardData(lat, lon) {
    document.getElementById("city-input").value = "";
    try {
        const weatherRes = await fetch(`/weather/${lat}/${lon}`);
        const weatherData = await weatherRes.json();

        if (!weatherRes.ok) {
            alert(`Weather Payload Error: ${weatherData.error}`);
            return;
        }

        const forecastRes = await fetch(`/forecast/${lat}/${lon}`);
        const forecastData = await forecastRes.json();
        globalForecastData = forecastData;

        if (!forecastRes.ok) {
            alert(`Forecast Payload Error: ${forecastData.error}`);
            return;
        }

       
        document.getElementById("prompt-card").classList.add("hidden");
        document.getElementById("main-dashboard").classList.remove("hidden");

        
        updateWeatherDOM(weatherData);
        updateMapInstance(lat, lon, weatherData.city);
        generateTrendChart(forecastData);

    } catch (error) {
        console.error("Critical interface engine error:", error);
    }
}

function updateWeatherDOM(data) {
    document.getElementById("location-name").innerText = `📍 ${data.city}`;
    document.getElementById("weather-desc").innerText = data.description;
    document.getElementById("current-temp").innerText = `${data.temp}°C`;
    document.getElementById("humidity-val").innerText = `${data.humidity}%`;
    document.getElementById("wind-speed-val").innerText = `${data.wind_speed} km/h`;

    document.getElementById("precipitation-val").innerHTML =
        data.precipitation > 0
            ? `🌧️ ${data.precipitation.toFixed(2)} mm<br><small style="color: var(--text-sub); font-size: 0.75rem;">Rain detected</small>`
            : `0.00 mm<br><small style="color: var(--text-sub); font-size: 0.75rem;">☀️ No rain</small>`;

    const directions = ['N ⬇️', 'NNE ↙️', 'NE ↙️', 'ENE ↙️', 'E ⬅️', 'ESE ↖️', 'SE ↖️', 'SSE ↖️', 'S ⬆️', 'SSW ↗️', 'SW ↗️', 'WSW ↗️', 'W ➡️', 'WNW ↘️', 'NW ↘️', 'NNW ↘️'];
    const headingIndex = Math.round(((data.wind_deg % 360) / 22.5)) % 16;
    document.getElementById("wind-dir-val").innerText = directions[headingIndex];

    document.getElementById("weather-icon").src =
    `https://openweathermap.org/img/wn/${data.icon}@2x.png`;

    document.getElementById("feels-like-val").innerText = `${data.feels_like}°C`;
    
    document.getElementById("aqi-val").innerText = getAQILabel(data.aqi);

    generateWeatherMessage(data);

    setDynamicBackground(data);

    window.currentAQIRaw = data.aqi_value;
    
    window.currentWindDeg = data.wind_deg;
}


function getAQILabel(aqi) {
    switch (aqi) {
        case 1: return "🟢 Good";
        case 2: return "🟡 Fair";
        case 3: return "🟠 Moderate";
        case 4: return "🔴 Poor";
        case 5: return "🟣 Hazardous";
        default: return "Unknown";
    } 
}

function generateWeatherMessage(data) {
    const temp = data.temp;
    const condition = data.condition.toLowerCase();
    const precipitation = data.precipitation;

    let message = "";

    if (data.aqi >= 4) {
        message = "😷 Air quality is poor, avoid going outside";
    } else if (condition.includes("rain") || precipitation > 0) {
        message = "☔ Carry an umbrella today";
    } else if (condition.includes("cloud")) {
        message = "☁️ Cloudy skies, might feel calm";
    } else if (temp >= 35) {
        message = "🔥 Stay hydrated, it's very hot";
    } else if (temp <= 15) {
        message = "🧥 It's quite chilly outside";
    } else if (condition.includes("clear")) {
        message = "🌤️ Perfect weather to go outside";
    } else {
        message = "🌈 Weather looks stable today";
    }

        document.getElementById("weather-message").innerText = message;
}

function setDynamicBackground(data) {
    const condition = data.condition.toLowerCase();

    document.body.classList.remove("sunny", "cloudy", "rainy", "night", "thunderstorm");

    if (condition.includes("thunder")) {
        document.body.classList.add("thunderstorm");

    } else if (condition.includes("rain") || condition.includes("drizzle")) {
        document.body.classList.add("rainy");

    } else if (condition.includes("cloud")) {
        document.body.classList.add("cloudy");

    } else if (condition.includes("clear")) {
        document.body.classList.add("sunny");

    } else {
        document.body.classList.add("night");
    }
}

function updateMapInstance(lat, lon, cityName) {
    if (typeof L === 'undefined') return;
    
    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([lat, lon], 12);
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const tileUrl = isDark
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        L.tileLayer(tileUrl, {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        mapMarker = L.marker([lat, lon]).addTo(map).bindPopup(cityName).openPopup();

        // 👇 Add this block
        map.on('click', function(e) {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;
            loadDashboardData(lat, lon);
        });

    } else {
        map.setView([lat, lon], 12);
        mapMarker.setLatLng([lat, lon]).setPopupContent(cityName).openPopup();
    }
    
    map.invalidateSize(); 
    setTimeout(() => { 
        map.invalidateSize(); 
    }, 200); 
}


function generateTrendChart(forecastData) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    
    const colorGradient = ctx.createLinearGradient(0, 0, 0, 260);
    colorGradient.addColorStop(0, 'rgba(167, 139, 250, 0.45)'); 
    colorGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.15)');
    colorGradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

    if (forecastChart) forecastChart.destroy();

    forecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: forecastData.map(d => d.day),
            datasets: [{
                data: forecastData.map(d => d.temp),
                borderColor: '#a78bfa',
                borderWidth: 4,
                tension: 0.45, // High organic curvature smooth setting
                fill: true,
                backgroundColor: colorGradient,
                pointBackgroundColor: '#60a5fa',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1200, easing: 'easeOutBack' },
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { family: 'Poppins', weight: '600' } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Poppins', weight: '600' } } }
            }
        }
    });
}


function toggleChartContainer() {
    const chart = document.getElementById("chart-section");
    const overlay = document.getElementById("chart-overlay");

    chart.classList.add("active");
    overlay.classList.add("active");

    // smooth scroll lock (optional but pro)
    document.body.style.overflow = "hidden";
}

function toggleThemeState() {
    const html = document.documentElement;
    const txt = document.getElementById("theme-text");

    
    const isCurrentlyLight = html.getAttribute("data-theme") === "light";
    const newTheme = isCurrentlyLight ? "dark" : "light";

    html.setAttribute("data-theme", newTheme);

    
    txt.innerText = newTheme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";

    // Update map tiles
    if (map) {
        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });

        const tileUrl = newTheme === "dark"
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        L.tileLayer(tileUrl).addTo(map);
    }
}

function closeChart() {
    const chart = document.getElementById("chart-section");
    const overlay = document.getElementById("chart-overlay");

    chart.classList.remove("active");
    overlay.classList.remove("active");

    document.body.style.overflow = "auto";
}

function openInfoPopup(title, content) {
    document.getElementById("info-title").innerText = title;
    document.getElementById("info-body").innerHTML = content;

    document.getElementById("info-popup").classList.add("active");
    document.getElementById("info-content").classList.add("active");
}

function closeInfoPopup(e) {
    if (e && e.target.id !== "info-popup" && e.target.id !== "close-info") return;

    document.getElementById("info-popup").classList.remove("active");
    document.getElementById("info-content").classList.remove("active");
}

function renderPrecipChart() {
    const canvas = document.getElementById("precipChart");
    if (!canvas || !globalForecastData) return;

    const ctx = canvas.getContext("2d");

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const tickColor = isDark ? "#94a3b8" : "#475569";
    const gridColor = isDark ? "rgba(148,163,184,0.1)" : "rgba(71,85,105,0.15)";

    const rainGradient = ctx.createLinearGradient(0, 0, 0, 260);
    rainGradient.addColorStop(0, 'rgba(56, 138, 221, 0.45)');
    rainGradient.addColorStop(0.5, 'rgba(56, 138, 221, 0.15)');
    rainGradient.addColorStop(1, 'rgba(56, 138, 221, 0.0)');

    const labels = globalForecastData.map(item => item.day);
    const precipData = globalForecastData.map(item => item.precipitation ?? 0);

    new Chart(ctx, {
        type: "line",  // 👈 changed from "bar"
        data: {
            labels: labels,
            datasets: [{
                label: "Rainfall (mm)",
                data: precipData,
                borderColor: "#378ADD",
                borderWidth: 3,
                tension: 0.45,
                fill: true,
                backgroundColor: rainGradient,
                pointBackgroundColor: "#378ADD",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1200, easing: 'easeOutBack' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? "#0f172a" : "#1e293b",
                    titleColor: "#f8fafc",
                    bodyColor: "#94a3b8",
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y.toFixed(2)} mm`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: {
                        font: { family: "Poppins", size: 12 },
                        color: tickColor,
                        callback: v => v + " mm"
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: "Poppins", size: 12, weight: "500" },
                        color: tickColor
                    }
                }
            }
        }
    });
}

function showPrecipitation() {
    if (!globalForecastData) {
        alert("Forecast data not loaded yet");
        return;
    }

    const totalRain = globalForecastData.reduce((sum, d) => sum + (d.precipitation ?? 0), 0);

    if (totalRain === 0) {
        openInfoPopup(
            "🌧️ Precipitation Forecast",
            `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:340px; text-align:center; gap:12px;">
                <span style="font-size:3.5rem; line-height:1;">☀️</span>
                <h3 style="font-size:1.1rem; font-weight:600; margin:0;">No Rain Expected</h3>
                <p style="font-size:0.85rem; opacity:0.6; margin:0;">The 5-day forecast shows no precipitation for this location.</p>
            </div>`
        );
        return;
    }

    openInfoPopup(
        "🌧️ Precipitation Forecast",
        `<div class="chart-wrapper">
            <canvas id="precipChart"></canvas>
        </div>`
    );

    setTimeout(renderPrecipChart, 100);
}

function showAQIInfo() {
    const aqiNum = getCurrentAQINumber();

    // Get the raw numeric AQI value if available (from your weather data)
    // You can store it globally when you receive weather data, e.g. window.currentAQIRaw = data.aqi_value;
    const rawAQI = window.currentAQIRaw || aqiNum;

    openInfoPopup("🌬️ Air Quality Index", `
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;gap:10px;padding-top:4px;">

        <svg width="100%" viewBox="0 0 360 210">
          <!--
            cx=180, cy=175, r=120
            Angles (SVG coords): 180°→144°→108°→72°→36°→0°
            Point formula: x = 180 + 120*cos(deg*π/180), y = 175 - 120*sin(deg*π/180)
            180°: (60, 175)
            144°: (82.92, 104.47)
            108°: (142.92, 60.87)
             72°: (217.08, 60.87)
             36°: (277.08, 104.47)
              0°: (300, 175)
          -->
          <path fill="none" stroke="#22c55e" stroke-width="24" stroke-linecap="butt"
                d="M 60,175 A 120,120 0 0,1 82.92,104.47"/>
          <path fill="none" stroke="#eab308" stroke-width="24" stroke-linecap="butt"
                d="M 82.92,104.47 A 120,120 0 0,1 142.92,60.87"/>
          <path fill="none" stroke="#f97316" stroke-width="24" stroke-linecap="butt"
                d="M 142.92,60.87 A 120,120 0 0,1 217.08,60.87"/>
          <path fill="none" stroke="#ef4444" stroke-width="24" stroke-linecap="butt"
                d="M 217.08,60.87 A 120,120 0 0,1 277.08,104.47"/>
          <path fill="none" stroke="#a855f7" stroke-width="24" stroke-linecap="butt"
                d="M 277.08,104.47 A 120,120 0 0,1 300,175"/>

          <!-- Band separator ticks (inner r=108, outer r=132) -->
          <g stroke="white" stroke-width="2.5" opacity="0.9">
            <line x1="92.6"  y1="111.5" x2="73.1"  y2="97.4"/>
            <line x1="146.6" y1="72.3"  x2="139.2" y2="49.5"/>
            <line x1="213.4" y1="72.3"  x2="220.8" y2="49.5"/>
            <line x1="267.4" y1="111.5" x2="286.9" y2="97.4"/>
          </g>

          <!-- Labels at band midpoints, r=150 -->
          <text x="34"  y="133" text-anchor="middle" font-family="Poppins,sans-serif" font-size="10" font-weight="700" fill="#22c55e">Good</text>
          <text x="90"  y="50"  text-anchor="middle" font-family="Poppins,sans-serif" font-size="10" font-weight="700" fill="#eab308">Fair</text>
          <text x="180" y="22"  text-anchor="middle" font-family="Poppins,sans-serif" font-size="10" font-weight="700" fill="#f97316">Moderate</text>
          <text x="270" y="50"  text-anchor="middle" font-family="Poppins,sans-serif" font-size="10" font-weight="700" fill="#ef4444">Poor</text>
          <text x="334" y="133" text-anchor="middle" font-family="Poppins,sans-serif" font-size="10" font-weight="700" fill="#a855f7">Hazardous</text>

          <!-- Needle -->
          <g id="aqi-needle" transform="rotate(-90,180,175)" data-deg="-90">
            <line x1="180" y1="175" x2="180" y2="83" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
            <polygon points="180,78 175.5,90 184.5,90" fill="white"/>
          </g>

          <!-- Hub -->
          <circle cx="180" cy="175" r="11" fill="#1e293b" stroke="white" stroke-width="2.5"/>
          <circle cx="180" cy="175" r="4.5" fill="white"/>
        </svg>

        <!-- Exact AQI value -->
        <div id="aqi-exact-display" style="font-size:1.6rem;font-weight:700;color:var(--text-main);">--</div>
        <div id="aqi-status-label" style="font-size:0.95rem;font-weight:600;margin-top:-6px;"></div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:4px;">
          <span style="font-size:11px;font-weight:600;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;">1 Good</span>
          <span style="font-size:11px;font-weight:600;background:#fef9c3;color:#854d0e;padding:3px 10px;border-radius:20px;">2 Fair</span>
          <span style="font-size:11px;font-weight:600;background:#ffedd5;color:#9a3412;padding:3px 10px;border-radius:20px;">3 Moderate</span>
          <span style="font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:20px;">4 Poor</span>
          <span style="font-size:11px;font-weight:600;background:#f3e8ff;color:#6b21a8;padding:3px 10px;border-radius:20px;">5 Hazardous</span>
        </div>
      </div>
    `);

    setTimeout(() => animateAQINeedle(aqiNum, rawAQI), 100);
}


function getCurrentAQINumber() {
    const label = document.getElementById("aqi-val").innerText;
    if (label.includes("Good")) return 1;
    if (label.includes("Fair")) return 2;
    if (label.includes("Moderate")) return 3;
    if (label.includes("Poor") && !label.includes("Very")) return 4;
    if (label.includes("Very") || label.includes("Hazardous")) return 5;
    return 1;
}

function animateAQINeedle(aqi, rawValue) {
    const degreeMap = { 1: -80, 2: -45, 3: 0, 4: 45, 5: 80 };
    const colorMap = {
        1: { color: "#22c55e", label: "🟢 Good" },
        2: { color: "#eab308", label: "🟡 Fair" },
        3: { color: "#f97316", label: "🟠 Moderate" },
        4: { color: "#ef4444", label: "🔴 Poor" },
        5: { color: "#a855f7", label: "🟣 Hazardous" }
    };

    const targetDeg = degreeMap[aqi] ?? 0;
    const { color, label } = colorMap[aqi] ?? colorMap[1];
    const needle = document.getElementById("aqi-needle");
    const exactDisplay = document.getElementById("aqi-exact-display");
    const statusLabel = document.getElementById("aqi-status-label");
    if (!needle) return;

    const from = -90;
    const duration = 700;
    let start = null;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function frame(ts) {
        if (!start) start = ts;
        const t = Math.min((ts - start) / duration, 1);
        const current = from + (targetDeg - from) * easeOut(t);
        needle.setAttribute("transform", `rotate(${current},180,175)`);
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    
    const display = rawValue != null ? rawValue : aqi;
    exactDisplay.innerHTML = `<span style="color:${color}">${display}</span>`;
    statusLabel.textContent = label;
    statusLabel.style.color = color;
}

function showHumidity() {
    const humidityText = document.getElementById("humidity-val").innerText;
    const humidity = parseInt(humidityText);

    const info = getHumidityInfo(humidity);

    openInfoPopup(
        "💧 Humidity Analysis",
        `
        <div style="
            display:flex;
            flex-direction:column;
            align-items:center;
            gap:18px;
            width:100%;
        ">

            <!-- Circular Gauge -->
            <div style="
                width:180px;
                height:180px;
                border-radius:50%;
                background:
                    conic-gradient(
                        #38bdf8 ${humidity * 3.6}deg,
                        rgba(255,255,255,0.08) 0deg
                    );
                display:flex;
                align-items:center;
                justify-content:center;
                position:relative;
            ">

                <div style="
                    width:135px;
                    height:135px;
                    border-radius:50%;
                    background:var(--glass-bg);
                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    justify-content:center;
                    border:1px solid var(--glass-border);
                ">
                    <div style="
                        font-size:2rem;
                        font-weight:700;
                        color:#38bdf8;
                    ">
                        ${humidity}%
                    </div>

                    <div style="
                        font-size:0.85rem;
                        opacity:0.8;
                    ">
                        Humidity
                    </div>
                </div>
            </div>

            <!-- Comfort Label -->
            <div style="
                font-size:1.1rem;
                font-weight:600;
                color:${info.color};
            ">
                ${info.label}
            </div>

            <!-- Description -->
            <p style="
                text-align:center;
                color:var(--text-sub);
                font-size:0.9rem;
                line-height:1.6;
                max-width:420px;
            ">
                ${info.desc}
            </p>

            <!-- Extra Indicators -->
            <div style="
                display:flex;
                gap:10px;
                flex-wrap:wrap;
                justify-content:center;
            ">

                <span style="
                    padding:6px 12px;
                    border-radius:20px;
                    background:rgba(56,189,248,0.15);
                    color:#38bdf8;
                    font-size:12px;
                    font-weight:600;
                ">
                    Dew Comfort
                </span>

                <span style="
                    padding:6px 12px;
                    border-radius:20px;
                    background:rgba(255,255,255,0.08);
                    color:var(--text-main);
                    font-size:12px;
                    font-weight:600;
                ">
                    Indoor Air
                </span>

            </div>

        </div>
        `
    );
}

function getHumidityInfo(humidity) {

    if (humidity < 30) {
        return {
            label: "🟤 Dry Air",
            color: "#f59e0b",
            desc: "Low humidity may cause dry skin, throat irritation, and dehydration."
        };
    }

    if (humidity < 60) {
        return {
            label: "🟢 Comfortable",
            color: "#22c55e",
            desc: "Humidity levels are comfortable and ideal for most people."
        };
    }

    if (humidity < 75) {
        return {
            label: "🟠 Humid",
            color: "#f97316",
            desc: "The air may feel warmer and slightly sticky outdoors."
        };
    }

    return {
        label: "🔴 Very Humid",
        color: "#ef4444",
        desc: "High humidity can feel uncomfortable and make breathing harder."
    };
}

function showWindInfo() {
    const speedText = document.getElementById("wind-speed-val").innerText;
    const speed = parseFloat(speedText);

    const level = getWindLevel(speed);

    openInfoPopup(
        "💨 Wind Analysis",
        `
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;">

            <!-- Speed Display -->
            <div style="font-size:2.2rem;font-weight:700;color:var(--text-main);">
                ${speed} km/h
            </div>

            <!-- Visual Bar -->
            <div style="width:100%;max-width:400px;height:10px;border-radius:10px;background:rgba(255,255,255,0.1);overflow:hidden;">
                <div style="
                    width:${Math.min(speed * 2, 100)}%;
                    height:100%;
                    background:linear-gradient(90deg,#38bdf8,#6366f1,#a78bfa);
                    transition:0.5s;">
                </div>
            </div>

            <!-- Label -->
            <div style="font-size:1rem;font-weight:600;color:${level.color}">
                ${level.label}
            </div>

            <!-- Info -->
            <p style="font-size:0.85rem;color:var(--text-sub);text-align:center;max-width:420px;">
                ${level.desc}
            </p>

        </div>
        `
    );
}

function getWindLevel(speed) {
    if (speed < 10) {
        return {
            label: "🟢 Calm",
            color: "#22c55e",
            desc: "Very light wind. Comfortable outdoor conditions."
        };
    } else if (speed < 20) {
        return {
            label: "🟡 Breezy",
            color: "#eab308",
            desc: "Pleasant breeze. Slight movement in trees."
        };
    } else if (speed < 35) {
        return {
            label: "🟠 Windy",
            color: "#f97316",
            desc: "Noticeable wind. May affect outdoor activities."
        };
    } else {
        return {
            label: "🔴 Strong Wind",
            color: "#ef4444",
            desc: "High winds. Be cautious outside."
        };
    }
}

function showWindDirection() {
    const dirText = document.getElementById("wind-dir-val").innerText;
    const deg = window.currentWindDeg ?? 0;

    openInfoPopup("🧭 Wind Direction", `
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;">
            
            <!-- Directional Compass -->
            <div style="
                position: relative;
                width: 220px;
                height: 220px;
                border-radius: 50%;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--glass-border);
                display: flex;
                align-items: center;
                justify-content: center;
            ">

                <!-- N S E W -->
                <span style="position:absolute;top:10px;">N</span>
                <span style="position:absolute;bottom:10px;">S</span>
                <span style="position:absolute;left:10px;">W</span>
                <span style="position:absolute;right:10px;">E</span>

                <!-- ✅ FIXED CENTER ARROW -->
                <div id="wind-arrow" style="
                    position: absolute;
                    width: 4px;
                    height: 90px;
                    background: white;

                    top: 50%;
                    left: 50%;

                    transform-origin: 50% 100%;
                    transform: translate(-50%, -100%) rotate(0deg);

                    border-radius: 4px;
                ">

                    <!-- arrow head -->
                    <div style="
                        position: absolute;
                        top: -6px;
                        left: 50%;
                        transform: translateX(-50%);
                        border-left: 6px solid transparent;
                        border-right: 6px solid transparent;
                        border-bottom: 10px solid white;
                    "></div>

                </div>

            </div>

            <!-- Direction label -->
            <div style="font-size:1.2rem;font-weight:600;">
                ${dirText}
            </div>

            <!-- Degree -->
            <div style="font-size:0.9rem;color:var(--text-sub);">
                ${deg}°
            </div>

            <!-- Explanation -->
            <p style="font-size:0.85rem;color:var(--text-sub);text-align:center;">
                ${getWindMeaning(deg)}
            </p>

        </div>
    `);

    setTimeout(() => animateWindArrow(deg), 100);
}

function animateWindArrow(deg) {
    const arrow = document.getElementById("wind-arrow");
    if (!arrow) return;

    let start = 0;
    const duration = 600;
    let startTime = null;

    function animate(time) {
        if (!startTime) startTime = time;
        const progress = Math.min((time - startTime) / duration, 1);

        const current = start + (deg - start) * (1 - Math.pow(1 - progress, 3));
        arrow.style.transform = `translate(-50%, -100%) rotate(${current}deg)`;
        if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}

function getWindMeaning(deg) {
    if (deg >= 337 || deg < 22) return "Wind coming from the North";
    if (deg < 67) return "Wind coming from the North-East";
    if (deg < 112) return "Wind coming from the East";
    if (deg < 157) return "Wind coming from the South-East";
    if (deg < 202) return "Wind coming from the South";
    if (deg < 247) return "Wind coming from the South-West";
    if (deg < 292) return "Wind coming from the West";
    return "Wind coming from the North-West";
}

function showFeelsLikeInfo() {

    const feelsLikeText =
        document.getElementById("feels-like-val").innerText;

    const actualTempText =
        document.getElementById("current-temp").innerText;

    const feelsLike = parseInt(feelsLikeText);
    const actualTemp = parseInt(actualTempText);

    const info = getFeelsLikeInfo(feelsLike);

    const difference = feelsLike - actualTemp;

    openInfoPopup(
        "🌡️ Thermal Comfort Analysis",
        `
        <div style="
            display:flex;
            flex-direction:column;
            align-items:center;
            gap:18px;
            width:100%;
        ">

            <!-- Main Temperature -->
            <div style="
                font-size:3rem;
                font-weight:700;
                color:${info.color};
                line-height:1;
            ">
                ${feelsLike}°C
            </div>

            <!-- Status -->
            <div style="
                font-size:1.1rem;
                font-weight:600;
                color:${info.color};
            ">
                ${info.label}
            </div>

            <!-- Thermometer Bar -->
            <div style="
                width:100%;
                max-width:420px;
                height:12px;
                border-radius:20px;
                background:rgba(255,255,255,0.08);
                overflow:hidden;
            ">
                <div style="
                    width:${Math.min((feelsLike / 50) * 100, 100)}%;
                    height:100%;
                    background:
                        linear-gradient(
                            90deg,
                            #38bdf8,
                            #facc15,
                            #f97316,
                            #ef4444
                        );
                    transition:0.5s;
                "></div>
            </div>

            <!-- Comparison -->
            <div style="
                display:flex;
                gap:20px;
                flex-wrap:wrap;
                justify-content:center;
            ">

                <div style="
                    padding:12px 18px;
                    border-radius:16px;
                    background:rgba(255,255,255,0.05);
                    text-align:center;
                ">
                    <small style="opacity:0.7;">Actual</small>
                    <div style="font-size:1.3rem;font-weight:600;">
                        ${actualTemp}°C
                    </div>
                </div>

                <div style="
                    padding:12px 18px;
                    border-radius:16px;
                    background:rgba(255,255,255,0.05);
                    text-align:center;
                ">
                    <small style="opacity:0.7;">Feels Like</small>
                    <div style="
                        font-size:1.3rem;
                        font-weight:600;
                        color:${info.color};
                    ">
                        ${feelsLike}°C
                    </div>
                </div>

            </div>

            <!-- Delta -->
            <div style="
                font-size:0.95rem;
                font-weight:600;
                color:var(--text-sub);
            ">
                ${
                    difference > 0
                    ? `Feels ${difference}°C hotter than actual`
                    : difference < 0
                    ? `Feels ${Math.abs(difference)}°C colder than actual`
                    : `Feels identical to actual temperature`
                }
            </div>

            <!-- Description -->
            <p style="
                text-align:center;
                color:var(--text-sub);
                line-height:1.6;
                max-width:420px;
                font-size:0.9rem;
            ">
                ${info.desc}
            </p>

            <!-- Recommendations -->
            <div style="
                display:flex;
                gap:10px;
                flex-wrap:wrap;
                justify-content:center;
            ">

                <span style="
                    padding:6px 12px;
                    border-radius:20px;
                    background:rgba(255,255,255,0.08);
                    font-size:12px;
                    font-weight:600;
                ">
                    ${info.tip1}
                </span>

                <span style="
                    padding:6px 12px;
                    border-radius:20px;
                    background:rgba(255,255,255,0.08);
                    font-size:12px;
                    font-weight:600;
                ">
                    ${info.tip2}
                </span>

            </div>

        </div>
        `
    );
}

function getFeelsLikeInfo(temp) {

    if (temp <= 10) {
        return {
            label: "🔵 Cold",
            color: "#38bdf8",
            desc: "Cold conditions may require warm clothing outdoors.",
            tip1: "🧥 Wear Layers",
            tip2: "☕ Stay Warm"
        };
    }

    if (temp <= 24) {
        return {
            label: "🟢 Comfortable",
            color: "#22c55e",
            desc: "Ideal outdoor conditions for most activities.",
            tip1: "🌤️ Great Weather",
            tip2: "🚶 Comfortable Outside"
        };
    }

    if (temp <= 32) {
        return {
            label: "🟠 Warm",
            color: "#f97316",
            desc: "Warm conditions may feel slightly uncomfortable during long exposure.",
            tip1: "💧 Hydrate",
            tip2: "🧢 Light Clothing"
        };
    }

    return {
        label: "🔴 Hot",
        color: "#ef4444",
        desc: "High heat index detected. Avoid prolonged sun exposure.",
        tip1: "🥤 Drink Water",
        tip2: "☀️ Avoid Direct Sun"
    };
}

function setupAutocomplete() {
    const input = document.getElementById("city-input");
    const suggestionsBox = document.getElementById("suggestions-box");

    input.addEventListener("input", async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            suggestionsBox.style.display = "none";
            return;
        }

        try {
            const res = await fetch(`/autocomplete/${query}`);
            const cities = await res.json();
            suggestionsBox.innerHTML = "";

            cities.slice(0, 6).forEach(city => {
                const div = document.createElement("div");
                div.classList.add("suggestion-item");
                div.innerText = city;
                div.onclick = () => {
                    input.value = city;
                    suggestionsBox.style.display = "none";
                    searchCity();
                };
                suggestionsBox.appendChild(div);
            });

            
            const rect = input.getBoundingClientRect();
            suggestionsBox.style.top = (rect.bottom + window.scrollY + 6) + "px";
            suggestionsBox.style.left = rect.left + "px";
            suggestionsBox.style.width = rect.width + "px";
            suggestionsBox.style.display = "block";

        } catch (err) {
            console.error("Autocomplete error:", err);
        }
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-bar") && e.target.id !== "city-input") {
            suggestionsBox.style.display = "none";
        }
    });
}
