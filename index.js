// ===============================
// Smart Home Mini Service
// MVG (inoffizielle) Fahrinfo API
// Ziel: S2 ab Feldkirchen (b München)
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
    // 1️⃣ Station suchen → Feldkirchen
    const searchUrl =
      "https://www.mvg.de/api/fahrinfo/location/queryWeb?q=Feldkirchen";

    const searchResponse = await axios.get(searchUrl, {
      headers: {
        "User-Agent": "smart-home-display",
        Accept: "application/json",
      },
      timeout: 10000,
    });

    const locations = searchResponse.data.locations;

    if (!Array.isArray(locations)) {
      return res.status(500).json({
        error: "Unerwartetes MVG-Suchformat",
      });
    }

    // Feldkirchen (b München) finden
    const station = locations.find(
      (l) =>
        l.type === "STATION" &&
        l.name.includes("Feldkirchen")
    );

    if (!station) {
      return res.status(404).json({
        error: "Station Feldkirchen nicht gefunden",
      });
    }

    const stationId = station.globalId;

    // 2️⃣ Abfahrten holen
    const departuresUrl = `https://www.mvg.de/api/fahrinfo/departure/${stationId}`;

    const depResponse = await axios.get(departuresUrl, {
      headers: {
        "User-Agent": "smart-home-display",
        Accept: "application/json",
      },
      timeout: 10000,
    });

    const departures = depResponse.data.departures;

    if (!Array.isArray(departures)) {
      return res.status(500).json({
        error: "Unerwartetes MVG-Abfahrtsformat",
      });
    }

    // 3️⃣ Nur S2 filtern
    const s2Departures = departures
      .filter(
        (d) =>
          d.label === "S2" &&
          d.transportType === "SBAHN"
      )
      .slice(0, 3)
      .map((d) => {
        const minutes = Math.round(
          (new Date(d.departureTime) - Date.now()) / 60000
        );

        return {
          line: d.label,
          direction: d.destination,
          minutes,
          delay: d.delay || 0,
        };
      });

    res.json({
      station: "Feldkirchen (b München)",
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