// ===============================
// Smart Home Mini Service
// MVG Fahrinfo API
// S2 ab Feldkirchen (b München)
// STABIL: ohne Stationssuche
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
    // Feldkirchen (b München) – feste MVG Station-ID
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

    const departures = response.data?.departures;

    if (!Array.isArray(departures)) {
      return res.status(500).json({
        error: "Unerwartetes MVG-Abfahrtsformat",
      });
    }

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
