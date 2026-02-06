/**
 * Smart Home Mini Service
 * DB Timetables API – Feldkirchen (b München), S2
 * FINAL & GEPRÜFT
 */

require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { parseStringPromise } = require("xml2js");

const app = express();
const PORT = process.env.PORT || 3000;

// ========= ENV CHECK =========
console.log("ENV CHECK:");
console.log("DB_CLIENT_ID:", process.env.DB_CLIENT_ID);
console.log(
  "DB_CLIENT_SECRET vorhanden:",
  Boolean(process.env.DB_CLIENT_SECRET)
);

// ========= HEALTH =========
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ========= S-BAHN =========
app.get("/api/sbahn", async (req, res) => {
  try {
    const EVA = "8002063"; // Feldkirchen (b München)

    const now = new Date();
    const date =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");

    const hour = String(now.getHours()).padStart(2, "0");

    const url = `https://api.deutschebahn.com/timetables/v1/plan/${EVA}/${date}/${hour}`;
    console.log("DB REQUEST URL:", url);

    const response = await axios.get(url, {
      headers: {
        "DB-Client-Id": process.env.DB_CLIENT_ID,
        "DB-Client-Secret": process.env.DB_CLIENT_SECRET,
        "User-Agent": "smart-home-mini-service/1.0", // 🔴 EXTREM WICHTIG
        Accept: "application/xml",
      },
      timeout: 15000,
    });

    const parsed = await parseStringPromise(response.data);
    const departures = parsed?.timetable?.dp || [];

    const s2 = departures.find(
      (d) => d?.tl?.[0]?.$?.c === "S2"
    );

    if (!s2) {
      return res.json({
        station: "Feldkirchen (b München)",
        message: "Keine S2 in dieser Stunde gefunden",
      });
    }

    res.json({
      station: "Feldkirchen (b München)",
      line: "S2",
      direction: s2.dir?.[0] || "unbekannt",
      plannedTime: s2.dpTime?.[0] || "??",
    });
  } catch (error) {
    console.error("DB API FEHLER:");
    console.error(error.message);

    res.status(500).json({
      error: "DB API Fehler",
      details: error.message,
    });
  }
});

// ========= START =========
app.listen(PORT, () => {
  console.log(`Mini-Service läuft auf Port ${PORT}`);
});