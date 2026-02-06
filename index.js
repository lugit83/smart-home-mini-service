// ===== Imports =====
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { parseStringPromise } = require("xml2js");

// ===== App Setup =====
const app = express();
const PORT = process.env.PORT || 3000;

// ===== Debug ENV =====
console.log("ENV CHECK:");
console.log("DB_CLIENT_ID:", process.env.DB_CLIENT_ID);
console.log(
  "DB_CLIENT_SECRET vorhanden:",
  Boolean(process.env.DB_CLIENT_SECRET)
);

// ===== Health Check =====
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===== S-Bahn API =====
app.get("/api/sbahn", async (req, res) => {
  try {
    const EVA = "8002063"; // Feldkirchen (b München)
    const now = new Date();

    // aktuelle + nächste Stunde probieren
    for (let offset = 0; offset <= 1; offset++) {
      const d = new Date(now.getTime() + offset * 60 * 60 * 1000);

      const date =
        d.getFullYear().toString() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");

      const hour = String(d.getHours()).padStart(2, "0");

      const url = `https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1/plan/${EVA}/${date}/${hour}`;
      console.log("DB REQUEST URL:", url);

      try {
        const response = await axios.get(url, {
          headers: {
            "DB-Client-Id": process.env.DB_CLIENT_ID,
            "DB-Client-Secret": process.env.DB_CLIENT_SECRET,
            Accept: "application/xml",
          },
          timeout: 10000,
        });

        const parsed = await parseStringPromise(response.data);
        const departures = parsed?.timetable?.dp || [];

        const s2 = departures.find(
          (dep) => dep?.tl?.[0]?.$?.c === "S2"
        );

        if (s2) {
          return res.json({
            station: "Feldkirchen (b München)",
            line: "S2",
            direction: s2.dir?.[0] || "unbekannt",
            plannedTime: s2.dpTime?.[0] || "??",
          });
        }
      } catch (err) {
        // 404 = keine Daten für diese Stunde → weiter
        if (err.response?.status !== 404) {
          throw err;
        }
      }
    }

    // keine S2 gefunden
    res.json({
      station: "Feldkirchen (b München)",
      message: "Keine S2 in nächster Zeit gefunden",
    });
  } catch (error) {
    console.error("DB API FEHLER:", error.message);
    res.status(500).json({
      error: "DB API Fehler",
      details: error.message,
    });
  }
});

// ===== Server Start =====
app.listen(PORT, () => {
  console.log(`Mini-Service läuft auf Port ${PORT}`);
});