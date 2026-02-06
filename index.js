app.get("/api/sbahn", async (req, res) => {
  try {
    const EVA = "8002063";

    const now = new Date();

    // wir probieren: aktuelle Stunde + nächste Stunde
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
          (d) => d?.tl?.[0]?.$?.c === "S2"
        );

        if (s2) {
          return res.json({
            station: "Feldkirchen (b München)",
            line: "S2",
            direction: s2.dir?.[0] || "unbekannt",
            plannedTime: s2.dpTime?.[0] || "??",
          });
        }
      } catch (e) {
        // 404 ignorieren → nächste Stunde probieren
        if (e.response?.status !== 404) {
          throw e;
        }
      }
    }

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
