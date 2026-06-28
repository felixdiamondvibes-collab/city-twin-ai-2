/* =========================================================
   CITY TWIN — Phase 1 prototype
   Live data sources (no API key required):
   - Weather + air quality: Open-Meteo (https://open-meteo.com)
   - Earthquakes: USGS (https://earthquake.usgs.gov)
   ========================================================= */

const REFRESH_MS = 5 * 60 * 1000; // refresh live data every 5 minutes

let map, cityMarker, quakeLayer;
let currentCity = { name: "Cairo", lat: 30.0444, lon: 31.2357 };

/* ---------- map setup ---------- */
function initMap() {
  map = L.map("map", {
    zoomControl: true,
    attributionControl: true
  }).setView([currentCity.lat, currentCity.lon], 10);

  // Dark basemap tiles (CARTO dark, free for light usage)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(map);

  cityMarker = L.circleMarker([currentCity.lat, currentCity.lon], {
    radius: 9,
    color: "#F5A623",
    weight: 2,
    fillColor: "#F5A623",
    fillOpacity: 0.25
  }).addTo(map);

  quakeLayer = L.layerGroup().addTo(map);
}

function moveMapToCity(city) {
  map.setView([city.lat, city.lon], 10, { animate: true });
  cityMarker.setLatLng([city.lat, city.lon]);
  document.getElementById("mapCityName").textContent = city.name.toUpperCase();
  document.getElementById("mapCoords").textContent =
    `${Math.abs(city.lat).toFixed(4)}°${city.lat >= 0 ? "N" : "S"}, ${Math.abs(city.lon).toFixed(4)}°${city.lon >= 0 ? "E" : "W"}`;
}

/* ---------- status pill ---------- */
function setStatus(state) {
  const dot = document.querySelector(".status-dot");
  const text = document.getElementById("statusText");
  dot.classList.remove("live", "error");
  if (state === "live") {
    dot.classList.add("live");
    text.textContent = "LIVE";
  } else if (state === "error") {
    dot.classList.add("error");
    text.textContent = "SIGNAL LOST";
  } else {
    text.textContent = "SYNCING";
  }
}

/* ---------- pulse timestamps ---------- */
function stampPulse(key) {
  const el = document.querySelector(`[data-pulse="${key}"]`);
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ---------- weather (Open-Meteo) ---------- */
async function fetchWeather(city) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather fetch failed");
  const data = await res.json();
  const c = data.current;

  document.getElementById("tempVal").textContent = Math.round(c.temperature_2m);
  document.getElementById("feelsLikeVal").textContent = `${Math.round(c.apparent_temperature)}°`;
  document.getElementById("humidityVal").textContent = `${Math.round(c.relative_humidity_2m)}%`;
  document.getElementById("windVal").textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  document.getElementById("weatherDesc").textContent = weatherCodeToText(c.weather_code);

  stampPulse("weather");
  return { temp: c.temperature_2m, weatherCode: c.weather_code };
}

function weatherCodeToText(code) {
  const map = {
    0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "icy fog", 51: "light drizzle", 53: "drizzle", 55: "dense drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow",
    75: "heavy snow", 80: "light showers", 81: "showers", 82: "violent showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "severe thunderstorm with hail"
  };
  return map[code] ?? "conditions unknown";
}

/* ---------- air quality (Open-Meteo air quality API) ---------- */
async function fetchAirQuality(city) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("air quality fetch failed");
  const data = await res.json();
  const c = data.current;

  const aqi = Math.round(c.us_aqi ?? 0);
  document.getElementById("aqiBadge").textContent = aqi || "––";
  document.getElementById("aqiLevel").textContent = aqiToLevel(aqi);
  document.getElementById("pm25Val").textContent = c.pm2_5?.toFixed(1) ?? "––";
  document.getElementById("pm10Val").textContent = c.pm10?.toFixed(1) ?? "––";
  document.getElementById("o3Val").textContent = c.ozone?.toFixed(0) ?? "––";
  document.getElementById("no2Val").textContent = c.nitrogen_dioxide?.toFixed(0) ?? "––";

  const badge = document.getElementById("aqiBadge");
  badge.style.color = aqiToColor(aqi);
  badge.style.borderColor = aqiToColor(aqi);

  stampPulse("air");
  return { aqi };
}

function aqiToLevel(aqi) {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "unhealthy for sensitive groups";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very unhealthy";
  return "hazardous";
}

function aqiToColor(aqi) {
  if (aqi <= 50) return "#5FD068";
  if (aqi <= 100) return "#F5A623";
  if (aqi <= 150) return "#E8830F";
  return "#E5484D";
}

/* ---------- earthquakes (USGS) ---------- */
async function fetchEarthquakes(city) {
  // last 7 days, within ~300km, magnitude 2.5+
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${city.lat}&longitude=${city.lon}&maxradiuskm=300&minmagnitude=2.5&starttime=${sevenDaysAgo()}&orderby=time`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("quake fetch failed");
  const data = await res.json();
  const features = data.features.slice(0, 6);

  const list = document.getElementById("quakeList");
  const summary = document.getElementById("quakeSummary");
  list.innerHTML = "";
  quakeLayer.clearLayers();

  if (features.length === 0) {
    summary.textContent = "no notable seismic activity within 300km in the last 7 days";
  } else {
    summary.textContent = `${features.length} event${features.length > 1 ? "s" : ""} detected within 300km (last 7 days)`;
    features.forEach(f => {
      const mag = f.properties.mag;
      const place = f.properties.place;
      const time = new Date(f.properties.time);
      const [lon, lat] = f.geometry.coordinates;

      const li = document.createElement("li");
      li.className = "quake-item";
      li.innerHTML = `
        <span class="quake-mag ${mag < 4 ? "minor" : ""}">${mag.toFixed(1)}</span>
        <span class="quake-place">${place}</span>
        <span class="quake-time">${time.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
      `;
      list.appendChild(li);

      L.circleMarker([lat, lon], {
        radius: Math.max(4, mag * 2),
        color: mag < 4 ? "#8B92A0" : "#E5484D",
        weight: 1.5,
        fillColor: mag < 4 ? "#8B92A0" : "#E5484D",
        fillOpacity: 0.3
      }).bindPopup(`<strong>M${mag.toFixed(1)}</strong><br>${place}<br>${time.toLocaleString()}`)
        .addTo(quakeLayer);
    });
  }

  stampPulse("quake");
  return { count: features.length, maxMag: features.length ? Math.max(...features.map(f => f.properties.mag)) : 0 };
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

/* ---------- city health score (simple weighted formula, not ML) ---------- */
function computeHealthScore({ aqi, quakeCount, maxMag }) {
  // Start at 100, subtract penalties. This is a transparent heuristic for v1 —
  // swap in a real model later once you have historical data to calibrate against.
  let score = 100;

  if (aqi !== undefined) {
    if (aqi > 300) score -= 45;
    else if (aqi > 200) score -= 35;
    else if (aqi > 150) score -= 25;
    else if (aqi > 100) score -= 12;
    else if (aqi > 50) score -= 5;
  }

  if (quakeCount > 0) {
    score -= Math.min(20, quakeCount * 2);
    if (maxMag >= 5) score -= 15;
    else if (maxMag >= 4) score -= 6;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function renderScore(score) {
  const ring = document.getElementById("scoreRing");
  const num = document.getElementById("scoreNum");
  const status = document.getElementById("scoreStatus");
  const circumference = 264;
  const offset = circumference - (score / 100) * circumference;

  ring.style.strokeDashoffset = offset;
  num.textContent = score;

  let color, label;
  if (score >= 80) { color = "#5FD068"; label = "STABLE"; }
  else if (score >= 60) { color = "#F5A623"; label = "WATCH"; }
  else if (score >= 40) { color = "#E8830F"; label = "ELEVATED RISK"; }
  else { color = "#E5484D"; label = "HIGH RISK"; }

  ring.style.stroke = color;
  status.style.color = color;
  status.textContent = label;

  stampPulse("score");
}

/* ---------- master refresh ---------- */
async function refreshAll(city) {
  setStatus("syncing");
  try {
    const [weather, air, quake] = await Promise.all([
      fetchWeather(city),
      fetchAirQuality(city),
      fetchEarthquakes(city)
    ]);

    const score = computeHealthScore({ aqi: air.aqi, quakeCount: quake.count, maxMag: quake.maxMag });
    renderScore(score);

    setStatus("live");
  } catch (err) {
    console.error("City Twin refresh error:", err);
    setStatus("error");
  }
}

/* ---------- clock ---------- */
function tickClock() {
  document.getElementById("clockReadout").textContent = new Date().toLocaleTimeString();
}

/* ---------- city switcher ---------- */
function initCitySelect() {
  const select = document.getElementById("citySelect");
  select.addEventListener("change", () => {
    const opt = select.options[select.selectedIndex];
    currentCity = {
      name: opt.textContent.split(",")[0],
      lat: parseFloat(opt.dataset.lat),
      lon: parseFloat(opt.dataset.lon)
    };
    moveMapToCity(currentCity);
    refreshAll(currentCity);
  });
}

/* ---------- boot ---------- */
window.addEventListener("DOMContentLoaded", () => {
  initMap();
  initCitySelect();
  refreshAll(currentCity);

  tickClock();
  setInterval(tickClock, 1000);
  setInterval(() => refreshAll(currentCity), REFRESH_MS);
});

