// ===============================
// Smart Home Mini Service
// SERVER → MVG fib v2
// S2 Feldkirchen (b München)
// ===============================

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- JSON ----------
app.use(express.json());

// ---------- CONFIG ----------
const STATION_NAME = "Feldkirchen (b München)";
const GLOBAL_ID = "de:09184:2110";

// ---------- HEALTH ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- S-BAHN (SERVER → MVG) ----------
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
    });

    const departures = response.data?.departures;
    if (!Array.isArray(departures)) {
      return res.status(500).json({
        error: "Unerwartetes MVG-Format",
      });
    }

    let erding = [];
    let dachau = [];

    const now = Date.now();

    for (const d of departures) {
      if (d.label !== "S2") continue;

      const destination = d.destination || "";
      const realTime = d.realDepartureTime;
      if (!realTime) continue;

      const minutes = Math.round((realTime - now) / 60000);
      if (minutes < 0) continue;

      const entry = {
        line: "S2",
        direction: destination,
        minutes,
        delay: 0, // fib v2 → Delay später berechenbar
      };

      if (
        destination.includes("Erding") &&
        erding.length < 2
      ) {
        erding.push(entry);
      }

      if (
        (destination.includes("Dachau") ||
          destination.includes("Petershausen")) &&
        dachau.length < 2
      ) {
        dachau.push(entry);
      }

      if (erding.length >= 2 && dachau.length >= 2) {
        break;
      }
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