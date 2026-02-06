// ===============================
// Smart Home Mini Service
// SERVER → MVG fib v2 (ROBUST)
// S2 Feldkirchen (b München)
// ===============================

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------- CONFIG ----------
const STATION_NAME = "Feldkirchen (b München)";
const GLOBAL_ID = "de:09184:2110";

// ---------- HEALTH ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- S-BAHN ----------
app.get("/api/sbahn", async (req, res) => {
  try {
    const url =
      "https://www.mvg.de/api/fib/v2/departure" +
      `?globalId=${GLOBAL_ID}` +
      "&limit=20" +
      "&offsetInMinutes=0" +
      "&transportTypes=SBAHN";

    const response = await axios.get(url, { timeout: 10000 });

    // ---------- ROBUSTES FORMAT ----------
    const raw = response.data;
    const departures =
      raw?.departures ||
      raw?.data?.departures;

    if (!Array.isArray(departures)) {
      return res.status(500).json({
        error: "Unerwartetes MVG-Format",
        keys: Object.keys(raw || {}),
      });
    }

    let erding = [];
    let dachau = [];
    const now = Date.now();

    for (const d of departures) {
      if (d.label !== "S2") continue;

      const dest = d.destination || "";
      const real = d.realDepartureTime;
      if (!real) continue;

      const minutes = Math.round((real - now) / 60000);
      if (minutes < 0) continue;

      const entry = {
        line: "S2",
        direction: dest,
        minutes,
        delay: 0,
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

      if (erding.length >= 2 && dachau.length >= 2) break;
    }

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

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`Mini-Service läuft auf Port ${PORT}`);
});