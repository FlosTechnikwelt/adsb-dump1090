//server.js
//Dies ist der Hauptserver für die ADS-B Flugzeug-Tracker-Anwendung
//Er initialisiert den Express-Server, lädt Konfigurationen, definiert API-Endpunkte
//zum Abrufen, Speichern und Analysieren von Flugzeugdaten und dient statischen Dateien

const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { db, initDb } = require("./database"); //Datenbank Modul importieren
const app = express();
const port = 3001; //Port für Expess
const preserve = require("./config.json").prefixexpress || "[WEBSERVE]: ";
const preconfig = require("./config.json").prefixconfig || "[CONFIG]: ";

//Initialisiert die Datenbank beim Start des Servers
initDb();

let config = {
  apiUrl: "",
};

//Lädt die Konfiguration aus der 'config.json'-Datei
//Wenn die Datei nicht gefunden wird, wird eine Warnung ausgegeben und es wird versucht, lokale Daten zu verwenden
try {
  const rawConfig = fs.readFileSync(path.join(__dirname, "config.json"));
  config = JSON.parse(rawConfig);
  console.log(preconfig, "Configuration loaded");
} catch (error) {
  //Error handling
  console.warn(
    preconfig,
    "Could not read config.json, will use local data.json if available.",
  );
}

//Funktion zum Speichern von Flugzeugdaten in der Datenbank und Anreicherung mit externen Informationen
//Diese Daten werden später für Analysen, Abfragen und Statistiken verwendet
const recordAircraftData = async (aircraftList) => {
  for (const plane of aircraftList) {
    if (plane.hex) {
      let aircraftType = plane.t || null;
      let manufacturer = null;
      let photoUrl = null;

      //Versucht, ein Flugzeugfoto von planespotters.net abzurufen
      try {
        const photoResponse = await axios.get(
          `https://api.planespotters.net/pub/photos/hex/${plane.hex}`, //API für Fotos eines Flugzeugs anhand der HEX aus den ADS-B Daten
          { timeout: 3000 }, //Setzt den Timeout auf 3 Sekunden
          `https://api.planespotters.net/pub/photos/hex/${plane.hex}`, //API für Fotos eines Flugzeugs anhand der HEX aus den ADS-B Daten
          { timeout: 3000 }, //Setzt den Timeout auf 3 Sekunden
        );
        if (photoResponse.data.photos && photoResponse.data.photos.length > 0) {
          photoUrl = photoResponse.data.photos[0].thumbnail_large.src;
        }
      } catch (error) {
        //Error handling
        console.warn(
          preserve,
          `Error fetching photo from planespotters.net for hex ${plane.hex}:`,
          error.message,
        );
      }
      plane.photo_url = photoUrl;

      //Wenn der Flugzeugtyp noch nicht bekannt ist, versucht die Funktion, diesen und den Hersteller von hexdb.io abzurufen
      if (!aircraftType) {
        try {
          const hexdbResponse = await axios.get(
            `https://hexdb.io/api/v1/aircraft/${plane.hex}`, //API für das Abfragen von Flugzeugtyp und Hersteller anhand der HEX
            `https://hexdb.io/api/v1/aircraft/${plane.hex}`, //API für das Abfragen von Flugzeugtyp und Hersteller anhand der HEX
            { timeout: 3000 },
          );
          if (hexdbResponse.data) {
            aircraftType = hexdbResponse.data.Type || aircraftType;
            manufacturer = hexdbResponse.data.Manufacturer || null;
            //Daten auch im Objekt speichern
            //Daten auch im Objekt speichern
            plane.t = aircraftType;
            plane.manufacturer = manufacturer;
          }
        } catch (error) {
          //Error handling
          console.warn(
            preserve,
            `Error fetching from hexdb.io for hex ${plane.hex}:`,
            error.message,
          );
        }
      }

      //Fügt die angereicherten Flugzeugdaten in die Datenbank ein
      db.run(
        "INSERT INTO aircraft_history (hex, flight, alt_baro, gs, track, lat, lon, squawk, type, manufacturer, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          plane.hex, //Muss vorhanden sein
          plane.flight || null, //Optional
          plane.alt_bar || null, //Optional
          plane.gs || null, //Optional
          plane.track || null, //Optional
          plane.lat || null, //Optional
          plane.lon || null, //Optional
          plane.squawk || null, //Optional
          aircraftType, //Optional
          manufacturer, //Optional
          photoUrl, //Optional
        ],
        function (err) {
          if (err) {
            //Error handling
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

//API-Endpunkt zum Abrufen von Flugzeugdaten
//Ruft Daten von der konfigurierten externen API ab oder verwendet eine lokale 'data.json'
//Die abgerufenen Daten werden in der Datenbank gespeichert und an den Client gesendet
app.get("/api/aircraft", async (req, res) => {
  let data;
  if (config.apiUrl) {
    try {
      const response = await axios.get(config.apiUrl, { timeout: 5000 });
      data = response.data;
    } catch (error) {
      //Error handling
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
      //Error handling
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

//API-Endpunkt zum Abrufen von Flugstatistikdaten
//Führt mehrere Datenbankabfragen parallel aus, um verschiedene Statistiken zu sammeln
//und gibt diese als JSON-Antwort zurück
app.get("/api/statistics", (req, res) => {
  const stats = {};
  const queries = [
    //Gesamtzahl der einzigartigen Flugzeuge
    //Gesamtzahl der einzigartigen Flugzeuge
    new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(DISTINCT hex) as count FROM aircraft_history",
        (err, row) => {
          //Error handling
          if (err) reject(err);
          stats.uniqueAircraft = row.count;
          resolve();
        },
      );
    }),
    //Die 5 meistgesehenen Flugzeuge (nach HEX-Code)
    //Die 5 meistgesehenen Flugzeuge (nach HEX-Code)
    new Promise((resolve, reject) => {
      db.all(
        "SELECT hex, COUNT(hex) as count FROM aircraft_history GROUP BY hex ORDER BY count DESC LIMIT 5",
        (err, rows) => {
          //Error handling
          if (err) reject(err);
          stats.topAircraft = rows;
          resolve();
        },
      );
    }),

    //Durchschnittswerte von Höhe und Geschwindigkeit
    //Durchschnittswerte von Höhe und Geschwindigkeit
    new Promise((resolve, reject) => {
      db.get(
        "SELECT AVG(alt_baro) as avg_altitude, AVG(gs) as avg_speed FROM aircraft_history WHERE alt_baro > 0 AND gs > 0",
        (err, row) => {
          //Error handling
          if (err) reject(err);
          stats.averages = row;
          resolve();
        },
      );
    }),

    //Sichtungen pro Stunde
    //Sichtungen pro Stunde
    new Promise((resolve, reject) => {
      db.all(
        "SELECT strftime('%Y-%m-%d %H:00:00', timestamp) as hour, COUNT(*) as count FROM aircraft_history GROUP BY hour ORDER BY hour",
        (err, rows) => {
          //Error handling
          if (err) reject(err);
          stats.sightingsPerHour = rows;
          resolve();
        },
      );
    }),

    //Alle Flugzeugtypen mit Anzahl der Sichtungen
    //Alle Flugzeugtypen mit Anzahl der Sichtungen
    new Promise((resolve, reject) => {
      db.all(
        "SELECT type, COUNT(*) as count FROM aircraft_history WHERE type IS NOT NULL GROUP BY type ORDER BY count DESC",
        (err, rows) => {
          //Error handling
          if (err) reject(err);
          stats.aircraftTypes = rows;
          resolve();
        },
      );
    }),

    //Die Top 5 Hersteller mit den meisten Sichtungen
    //Die Top 5 Hersteller mit den meisten Sichtungen
    new Promise((resolve, reject) => {
      db.all(
        "SELECT manufacturer, COUNT(*) as count FROM aircraft_history WHERE manufacturer IS NOT NULL GROUP BY manufacturer ORDER BY count DESC LIMIT 5",
        (err, rows) => {
          //Error handling
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
      //Error handling
      console.error(preserve, "Error querying statistics:", err);
      res.status(500).send("Error querying database for statistics.");
    });
});

//API-Endpunkt für die Flugsuche
//Sucht in der Datenbank nach Flügen basierend auf Flugnummer und Datum
app.get("/api/flights/search", (req, res) => {
  //Extrahiert Flugnummer und Datum aus den Query-Parametern
  const { flight, date } = req.query;

  //Validierung der Eingaben: Wenn eine fehlt, wird ein 400 Bad Request zurückgegeben
  if (!flight || !date) {
    return res.status(400).send("Flight number and date are required.");
  }

  //Entfernt Leerzeichen von der Flugnummer
  const trimmedFlight = flight.trim();

  //Datenbank abfrage zum suchen von Flügen
  const sql = `
        SELECT * FROM aircraft_history
        WHERE trim(flight) = ? AND date(timestamp) = ?
        ORDER BY timestamp ASC
    `;

  db.all(sql, [trimmedFlight, date], (err, rows) => {
    //Error handling
    if (err) {
      console.error(preserve, "Error searching flights:", err);
      return res.status(500).send("Error searching database.");
    }
    //Gibt die Ergebnisse als JSON zurück, auch wenn keine gefunden wurden (leeres Array).
    //Gibt die Ergebnisse als JSON zurück, auch wenn keine gefunden wurden (leeres Array).
    res.json(rows);
  });
});

//Stellt statische Dateien aus dem 'public'-Verzeichnis bereit (Frontend).
//Stellt statische Dateien aus dem 'public'-Verzeichnis bereit (Frontend).
app.use(express.static(path.join(__dirname, "public")));
//Stellt Chart.js und den Adapter für Datum/Zeit-Unterstützung bereit.
//Stellt Chart.js und den Adapter für Datum/Zeit-Unterstützung bereit.
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

//Routen für HTML-Seiten.
//Routen für HTML-Seiten.
app.get("/search", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "search.html"));
});

//Leitet alle nicht gefundenen Routen auf die Startseite um (z.B. bei 404-Fehlern).
//Leitet alle nicht gefundenen Routen auf die Startseite um (z.B. bei 404-Fehlern).
app.get(/^[^.]*$/, (req, res) => {
  //res.sendFile(path.join(__dirname, 'public', 'index.html')); //Auskommentiert, da eine Weiterleitung verwendet wird.
  //res.sendFile(path.join(__dirname, 'public', 'index.html')); //Auskommentiert, da eine Weiterleitung verwendet wird.
  res.redirect("/?error=notfound");
});

//Startet den Webserver und lauscht auf dem konfigurierten Port.
//Startet den Webserver und lauscht auf dem konfigurierten Port.
app.listen(port, () => {
  console.log(preserve, `Server listening at http://localhost:${port}`);
  if (config.apiUrl) {
    console.log(preserve, `Proxying API requests to: ${config.apiUrl}`);
    console.log(preserve, "⌯✈︎ ⌯✈︎ ⌯✈︎ ⌯✈︎ Ready for take off! ⌯✈︎ ⌯✈︎ ⌯✈︎ ⌯✈︎");
  } else {
    console.log(
      preserve,
      "No apiUrl configured. /api/aircraft will return 500. Set 'apiUrl' in config.json.",
    );
  }
});
