const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { db, initDb } = require("./database"); //Datenbank Modul importieren
const app = express();
const port = 3001;
const preserve = require("./config.json").prefixexpress || "[WEBSERVE]: ";
const preconfig = require("./config.json").prefixconfig || "[CONFIG]: ";

//DB initialisieren
initDb();

let config = {
  apiUrl: "",
};

//Konfiguration laden aus der config.json
try {
  const rawConfig = fs.readFileSync(path.join(__dirname, "config.json"));
  config = JSON.parse(rawConfig);
  console.log(preconfig, "Configuration loaded");
} catch (error) {
  console.warn(
    preconfig,
    "Could not read config.json, will use local data.json if available.",
  );
}

//Funktion um Flugzeug Daten von dem ADS-B API in die Datenbank zu speichern, für spätere Analyse, Abfragen und Statistiken
const recordAircraftData = async (aircraftList) => {
  for (const plane of aircraftList) {
    if (plane.hex) {
      let aircraftType = plane.t || null;
      let manufacturer = null;
      let photoUrl = null;

      try {
        const photoResponse = await axios.get(
          `https://api.planespotters.net/pub/photos/hex/${plane.hex}`, //API für Fotos eines Flugzeugs anhand der HEX aus den ADS-B Daten
          { timeout: 3000 }, //Setze dden Timeout auf 3 Sekunden
        );
        if (photoResponse.data.photos && photoResponse.data.photos.length > 0) {
          photoUrl = photoResponse.data.photos[0].thumbnail_large.src;
        }
      } catch (error) {
        console.warn(
          preserve,
          `Error fetching photo from planespotters.net for hex ${plane.hex}:`,
          error.message,
        );
      }
      plane.photo_url = photoUrl;

      if (!aircraftType) {
        try {
          const hexdbResponse = await axios.get(
            `https://hexdb.io/api/v1/aircraft/${plane.hex}`, // API für das Abfragen von FLugzeugtyp und Hersteller anhand der HEX
            { timeout: 3000 },
          );
          if (hexdbResponse.data) {
            aircraftType = hexdbResponse.data.Type || aircraftType;
            manufacturer = hexdbResponse.data.Manufacturer || null;
            //Daten auch im Objekt speichern
            plane.t = aircraftType;
            plane.manufacturer = manufacturer;
          }
        } catch (error) {
          console.warn(
            preserve,
            `Error fetching from hexdb.io for hex ${plane.hex}:`,
            error.message,
          );
        }
      }

      //Daten in die Datenbank einfügen (SQL)
      db.run(
        "INSERT INTO aircraft_history (hex, flight, alt_baro, gs, track, lat, lon, squawk, type, manufacturer, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          plane.hex, //MUST HAVE
          plane.flight || null,
          plane.alt_baro || null,
          plane.gs || null,
          plane.track || null,
          plane.lat || null,
          plane.lon || null,
          plane.squawk || null,
          aircraftType,
          manufacturer,
          photoUrl,
        ],
        function (err) {
          if (err) {
            //Fehlerbehandlung beim einfügen von Daten
            console.error(
              preserve,
              `Error inserting data for hex ${plane.hex}:`,
              err.message,
            );
          }
        },
      );
    }
  }
};

//API
//* Flugzeug Daten API Endpoint
app.get("/api/aircraft", async (req, res) => {
  let data;
  if (config.apiUrl) {
    try {
      const response = await axios.get(config.apiUrl, { timeout: 5000 });
      data = response.data;
    } catch (error) {
      console.error(
        preserve,
        `Error fetching from external API (${config.apiUrl}):`,
        error.message,
      );
      return res.status(500).send("Error fetching data from external API.");
    }
  } else {
    try {
      const rawData = fs.readFileSync(
        path.join(__dirname, "data.json"),
        "utf8",
      );
      data = JSON.parse(rawData);
      console.log(preserve, "Serving local data.json");
    } catch (err) {
      console.error(preserve, "Error reading data.json:", err);
      return res.status(500).send("Error reading data file");
    }
  }

  if (data && data.aircraft) {
    await recordAircraftData(data.aircraft);
    res.json(data);
  } else {
    res.json({ aircraft: [] });
  }
});

//* Flug Suche API Endpoint
app.get("/api/statistics", (req, res) => {
  const stats = {};
  const queries = [
    //Gesamte anzahl der einzigartigen Flugzeuge
    new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(DISTINCT hex) as count FROM aircraft_history",
        (err, row) => {
          if (err) reject(err);
          stats.uniqueAircraft = row.count;
          resolve();
        },
      );
    }),
    //5 Meist gesehene Flugzeuge (Nach Modell, zb. B737-800)
    new Promise((resolve, reject) => {
      db.all(
        "SELECT hex, COUNT(hex) as count FROM aircraft_history GROUP BY hex ORDER BY count DESC LIMIT 5",
        (err, rows) => {
          if (err) reject(err);
          stats.topAircraft = rows;
          resolve();
        },
      );
    }),

    //Durchschnittswerte von Höhe und Geschwindigkeit
    new Promise((resolve, reject) => {
      db.get(
        "SELECT AVG(alt_baro) as avg_altitude, AVG(gs) as avg_speed FROM aircraft_history WHERE alt_baro > 0 AND gs > 0",
        (err, row) => {
          if (err) reject(err);
          stats.averages = row;
          resolve();
        },
      );
    }),

    //Sichtunggen pro Stunde
    new Promise((resolve, reject) => {
      db.all(
        "SELECT strftime('%Y-%m-%d %H:00:00', timestamp) as hour, COUNT(*) as count FROM aircraft_history GROUP BY hour ORDER BY hour",
        (err, rows) => {
          if (err) reject(err);
          stats.sightingsPerHour = rows;
          resolve();
        },
      );
    }),

    //Ausfzeichnen alle Flugzeugtypen mit anzahl der sichtungen
    new Promise((resolve, reject) => {
      db.all(
        "SELECT type, COUNT(*) as count FROM aircraft_history WHERE type IS NOT NULL GROUP BY type ORDER BY count DESC",
        (err, rows) => {
          if (err) reject(err);
          stats.aircraftTypes = rows;
          resolve();
        },
      );
    }),

    //die top 5 Hersteller mit den meisten sichtungen (Airbus, Boeing, etc)
    new Promise((resolve, reject) => {
      db.all(
        "SELECT manufacturer, COUNT(*) as count FROM aircraft_history WHERE manufacturer IS NOT NULL GROUP BY manufacturer ORDER BY count DESC LIMIT 5",
        (err, rows) => {
          if (err) reject(err);
          stats.topManufacturers = rows;
          resolve();
        },
      );
    }),
  ];

  Promise.all(queries)
    .then(() => res.json(stats))
    .catch((err) => {
      console.error(preserve, "Error querying statistics:", err);
      res.status(500).send("Error querying database for statistics.");
    });
});

//* Flug Suche API Endpoint
app.get("/api/flights/search", (req, res) => {
  //Extrahiere Flugnummer und Datum aus den Query Parametern
  const { flight, date } = req.query;

  // Validierung der Eingaben, wenn eine fehlt, 400 zurückgeben
  if (!flight || !date) {
    return res.status(400).send("Flight number and date are required.");
  }

  //Trimme Leerzeichen von der Flugnummer
  const trimmedFlight = flight.trim();

  //SQL Abfrage um die Flugdaten zu finden
  const sql = `
        SELECT * FROM aircraft_history
        WHERE trim(flight) = ? AND date(timestamp) = ?
        ORDER BY timestamp ASC
    `;

  db.all(sql, [trimmedFlight, date], (err, rows) => {
    //Fehlerbehandlung
    if (err) {
      console.error(preserve, "Error searching flights:", err);
      return res.status(500).send("Error searching database.");
    }
    //Ergebnisse als JSON zurückgeben, auch wenn keine gefunden wurden (leeres Array)
    res.json(rows);
  });
});

//Static Files (Frontend)
app.use(express.static(path.join(__dirname, "public")));
//Chart.js und Adapter für Datum/Zeit Unterstützung
app.use(
  "/scripts/chart.js",
  express.static(
    path.join(__dirname, "node_modules/chart.js/dist/chart.umd.js"),
  ),
);
app.use(
  "/scripts/chartjs-adapter-date-fns",
  express.static(
    path.join(
      __dirname,
      "node_modules/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.js",
    ),
  ),
);

//Routen für HTML Seiten
app.get("/search", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "search.html"));
});

// Keine 404, immer auf die Startseite weiterleiten (ggf. Toast mit Fehler anzeigen)
app.get(/^[^.]*$/, (req, res) => {
  //res.sendFile(path.join(__dirname, 'public', 'index.html'));
  res.redirect("/?error=notfound");
});

// Webserver starten
app.listen(port, () => {
  console.log(preserve, `Server listening at http://localhost:${port}`);
  if (config.apiUrl) {
    console.log(preserve, `Proxying API requests to: ${config.apiUrl}`);
    console.log(preserve, "⌯✈︎ ⌯✈︎ ⌯✈︎ ⌯✈︎ Ready for take off! ⌯✈︎ ⌯✈︎ ⌯✈︎ ⌯✈︎");
  } else {
    console.log(
      preserve,
      "Using local data.json. Edit config.json to point to a real API.",
    );
  }
});
