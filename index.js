// ===============================
// Smart Home Mini Service
// ESP32 → Server Gateway
// S-Bahn Daten-Cache
// BASIS: letzter Stand
// ERWEITERT: POST /api/sbahn/update
// ===============================

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- JSON BODY PARSER ----------
app.use(express.json());

// ---------- IN-MEMORY CACHE ----------
let sbahnCache = {
  station: "Feldkirchen (b München)",
  updatedAt: null,
  departures: [],
};

// ---------- HEALTH ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- ESP → SERVER UPDATE ----------
app.post("/api/sbahn/update", (req, res) => {
  try {
    const payload = req.body;

    if (
      !payload ||
      !payload.station ||
      !Array.isArray(payload.departures)
    ) {
      return res.status(400).json({
        error: "Ungültiges Payload",
      });
    }

    sbahnCache = {
      station: payload.station,
      departures: payload.departures,
      updatedAt: new Date().toISOString(),
    };

    console.log("S-BAHN UPDATE VOM ESP:", sbahnCache);

    res.json({
      status: "ok",
      received: sbahnCache.departures.length,
    });
  } catch (error) {
    console.error("UPDATE FEHLER:", error.message);
    res.status(500).json({
      error: "Update fehlgeschlagen",
    });
  }
});

// ---------- CLIENT → SERVER READ ----------
app.get("/api/sbahn", (req, res) => {
  res.json({
    ...sbahnCache,
    ageSeconds: sbahnCache.updatedAt
      ? Math.round(
          (Date.now() - new Date(sbahnCache.updatedAt)) / 1000
        )
      : null,
  });
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`Mini-Service läuft auf Port ${PORT}`);
});
