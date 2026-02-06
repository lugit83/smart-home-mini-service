// ==========================================
// Smart Home Mini Service
// Server-seitiger MVG fib v2 Client
// Feldkirchen (b München) – S2
// ==========================================

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(express.json());

// ---------- Konfiguration ----------
const STATION_NAME = "Feldkirchen (b München)";
const GLOBAL_ID = "de:09184:2110";

// ---------- Healthcheck ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- S-Bahn Endpoint ----------
app.get("/api/sbahn", async (req, res) => {
  try {
    const url =
      "https://www.mvg.de/api/fib/v2/departure" +
      `?globalId=${GLOBAL_ID}` +
      "&limit=20" +
      "&offsetInMinutes=0" +
      "&transportTypes=SBAHN";

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        // schadet nicht, hilft manchmal
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    const raw = response.data;

    // ---------- Normalisierung ----------
    let departures = [];

    if (Array.isArray(raw)) {
      if (raw[0]?.departures) {
        departures = raw[0].departures;
      } else {
        departures = raw;
      }
    } else if (Array.isArray(raw?.departures)) {
      departures = raw.departures;
    } else if (Array.isArray(raw?.data?.departures)) {
      departures = raw.data.departures;
    }

    if (!Array.isArray(departures)) {
      return res.status(500).json({
        error: "Unbekanntes MVG-Format",
        rawType: typeof raw,
        keys: raw && typeof raw === "object" ? Object.keys(raw) : null,
      });
    }

    // ---------- Filtern ----------
    let erding = [];
    let dachau = [];
    const now = Date.now();

    for (const d of departures) {
      const line = d.line?.label;
      if (line !== "S2") continue;

      const dest = d.destination?.label || "";
      const real = d.realtimeDepartureTime;
      if (!real) continue;

      const minutes = Math.round((real - now) / 60000);
      if (minutes < 0) continue;

      const entry = {
        line: "S2",
        direction: dest,
        minutes,
        delay: 0, // fib v2 liefert delay nicht direkt
      };

      if (dest.includes("Erding") && erding.length < 2) {
        erding.push(entry);
      }

      if (
        (dest.includes("Dachau") ||
          dest.includes("Petershausen")) &&
        dachau.length < 2
      ) {
        dachau.push(entry);
      }

      if (erding.length >= 2 && dachau.length >= 2) {
        break;
      }
    }

    // ---------- Antwort ----------
    res.json({
      station: STATION_NAME,
      departures: [...erding, ...dachau],
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("MVG SERVER FEHLER:", err.message);
    res.status(500).json({
      error: "MVG Server Fehler",
      details: err.message,
    });
  }
});

// ---------- Server Start ----------
app.listen(PORT, () => {
  console.log(`Mini-Service läuft auf Port ${PORT}`);
});