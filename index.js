// ===============================
// Smart Home Mini Service
// MVG Fahrinfo API
// S2 ab Feldkirchen (b München)
// BULLETPROOF EDITION
// ===============================

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CONFIG ----------
const STATION_ID = "de:09184:460";
const LINE = "S2";
const MAX_RESULTS = 3;
const CACHE_TTL_MS = 30_000; // 30 Sekunden

// ---------- SIMPLE CACHE ----------
let cache = {
  timestamp: 0,
  data: null,
};

// ---------- AXIOS INSTANCE ----------
const mvgApi = axios.create({
  baseURL: "https://www.mvg.de/api/fahrinfo",
  timeout: 8000,
  headers: {
    "User-Agent": "smart-home-display",
    Accept: "application/json",
  },
  validateStatus: (status) => status >= 200 && status < 500,
});

// ---------- HEALTH ----------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    cacheAgeSeconds: Math.floor(
      (Date.now() - cache.timestamp) / 1000
    ),
  });
});

// ---------- S-BAHN ----------
app.get("/api/sbahn", async (req, res) => {
  try {
    // ---------- CACHE ----------
    if (
      cache.data &&
      Date.now() - cache.timestamp < CACHE_TTL_MS
    ) {
      return res.json({
        ...cache.data,
        cached: true,
      });
    }

    // ---------- API CALL ----------
    const response = await mvgApi.get(
      `/departure/${STATION_ID}`
    );

    if (response.status !== 200) {
      throw new Error(
        `MVG HTTP ${response.status}`
      );
    }

    const departuresRaw = response.data?.departures;

    if (!Array.isArray(departuresRaw)) {
      throw new Error(
        "MVG response.departures ist kein Array"
      );
    }

    // ---------- FILTER & NORMALIZE ----------
    const now = Date.now();

    const departures = departuresRaw
      .filter((d) => {
        return (
          d &&
          d.label === LINE &&
          d.transportType === "SBAHN"
        );
      })
      .map((d) => {
        const time =
          d.departureTime ||
          d.realtimeDepartureTime ||
          d.plannedDepartureTime;

        if (!time) return null;

        const minutes = Math.max(
          0,
          Math.round(
            (new Date(time).getTime() - now) /
              60000
          )
        );

        return {
          line: d.label,
          direction: d.destination || "Unbekannt",
          minutes,
          delay: Number.isFinite(d.delay)
            ? d.delay
            : 0,
          cancelled: Boolean(d.cancelled),
          platform: d.platform || null,
        };
      })
      .filter(Boolean)
      .slice(0, MAX_RESULTS);

    const result = {
      station: "Feldkirchen (b München)",
      line: LINE,
      timestamp: new Date().toISOString(),
      departures,
    };

    // ---------- CACHE SAVE ----------
    cache = {
      timestamp: Date.now(),
      data: result,
    };

    res.json({
      ...result,
      cached: false,
    });
  } catch (error) {
    console.error(
      "MVG API FEHLER:",
      error.message
    );

    // ---------- FALLBACK ----------
    if (cache.data) {
      return res.status(200).json({
        ...cache.data,
        cached: true,
        warning:
          "MVG API nicht erreichbar – Cache genutzt",
      });
    }

    res.status(503).json({
      error: "MVG API nicht erreichbar",
      message: error.message,
    });
  }
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(
    `Mini-Service läuft auf Port ${PORT}`
  );
});