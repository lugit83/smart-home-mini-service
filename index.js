// ===============================
// Smart Home Mini Service
// MVG Fahrinfo API
// S2 ab Feldkirchen (b München)
// ROBUSTE VERSION – nichts entfernt, nur erweitert
// ===============================

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- HEALTH ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- S-BAHN (MVG) ----------
app.get("/api/sbahn", async (req, res) => {
  try {
    // Feste MVG-Station-ID für Feldkirchen (b München)
    const STATION_ID = "de:09184:460";

    const departuresUrl =
      `https://www.mvg.de/api/fahrinfo/departure/${STATION_ID}`;

    const response = await axios.get(departuresUrl, {
      headers: {
        "User-Agent": "smart-home-display",
        Accept: "application/json",
      },
      timeout: 10000,
    });

    // ---------- ROBUSTE FORMAT-ERKENNUNG ----------
    const raw = response.data;
    let departures = [];

    if (Array.isArray(raw)) {
      // Variante C: direktes Array
      departures = raw;
    } else if (Array.isArray(raw?.departures)) {
      // Variante A
      departures = raw.departures;
    } else if (Array.isArray(raw?.data?.departures)) {
      // Variante B
      departures = raw.data.departures;
    } else if (Array.isArray(raw?.response?.departures)) {
      // Variante D
      departures = raw.response.departures;
    } else {
      // Unbekanntes Format → wir zeigen ALLES, um es final zu verstehen
      console.error(
        "UNBEKANNTES MVG-ABFAHRTSFORMAT:",
        JSON.stringify(raw).slice(0, 1000)
      );
      return res.status(500).json({
        error: "Unbekanntes MVG-Abfahrtsformat",
        type: typeof raw,
        keys: raw && typeof raw === "object" ? Object.keys(raw) : null,
      });
    }

    // ---------- FILTER: NUR S2 ----------
    const s2Departures = departures
      .filter(
        (d) =>
          d &&
          d.label === "S2" &&
          (d.transportType === "SBAHN" || d.transportType === "TRAIN")
      )
      .slice(0, 3)
      .map((d) => {
        const depTime = d.departureTime
          ? new Date(d.departureTime)
          : null;

        const minutes = depTime
          ? Math.round((depTime - Date.now()) / 60000)
          : null;

        return {
          line: d.label,
          direction: d.destination || d.direction || "unbekannt",
          minutes,
          delay: d.delay || 0,
          rawTime: d.departureTime || null,
        };
      });

    // ---------- RESPONSE ----------
    res.json({
      station: "Feldkirchen (b München)",
      count: s2Departures.length,
      departures: s2Departures,
    });
  } catch (error) {
    console.error("MVG API FEHLER:", error.message);
    res.status(500).json({
      error: "MVG API Fehler",
      details: error.message,
    });
  }
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`Mini-Service läuft auf Port ${PORT}`);
});