"use strict";
//server.js
//Dies ist der Hauptserver für die ADS-B Flugzeug-Tracker-Anwendung
//Er initialisiert den Express-Server, lädt Konfigurationen, definiert API-Endpunkte
//zum Abrufen, Speichern und Analysieren von Flugzeugdaten und dient statischen Dateien
const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { db, initDb: initialisiereDb } = require("./database"); //Datenbank Modul importieren
const app = express();
const praefixExpress = require("./config.json").prefixexpress || "[WEBSERVE]: ";
const praefixKonfig = require("./config.json").prefixconfig || "[CONFIG]: ";

let konfiguration = {
  apiUrl: "",
};

//Lädt die Konfiguration aus der 'config.json'-Datei
//Wenn die Datei nicht gefunden wird, wird eine Warnung ausgegeben und es wird versucht, lokale Daten zu verwenden
try {
  const roheKonfiguration = fs.readFileSync(
    path.join(__dirname, "config.json"),
  );
  konfiguration = JSON.parse(roheKonfiguration);
  console.log(praefixKonfig, "Konfiguration geladen");
} catch (error) {
  //Fehlerbehandlung
  console.warn(
    praefixKonfig,
    "config.json konnte nicht gelesen werden. Fehlt die Datei?",
  );
}

const speicherIntervallSekundenRoh =
  konfiguration.positionSaveIntervalSeconds ?? konfiguration.dedupeSeconds;
const speicherIntervallSekunden = Number(speicherIntervallSekundenRoh);
const duplikatFensterMs = Number.isFinite(speicherIntervallSekunden)
  ? Math.max(0, speicherIntervallSekunden) * 1000
  : 5 * 1000;
const zuletztGespeichertUm = new Map();
const flugzeugMetaNachHex = new Map();
const dbAlle = (sqlAnweisung, parameter = []) =>
  new Promise((resolve, reject) => {
    db.all(sqlAnweisung, parameter, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

const fuehreFlugzeugMetaZusammen = (hex, meta) => {
  if (!hex) {
    return;
  }

  const existing = flugzeugMetaNachHex.get(hex) || {};
  const next = { ...existing };

  if (meta.photo_url) {
    next.photo_url = meta.photo_url;
  }
  if (meta.type) {
    next.type = meta.type;
  }
  if (meta.manufacturer) {
    next.manufacturer = meta.manufacturer;
  }

  if (Object.keys(next).length > 0) {
    flugzeugMetaNachHex.set(hex, next);
  }
};

const wendeFlugzeugMetaAn = (flugzeug) => {
  if (!flugzeug || !flugzeug.hex) {
    return;
  }

  const cached = flugzeugMetaNachHex.get(flugzeug.hex);
  if (!cached) {
    return;
  }

  if (!flugzeug.photo_url && cached.photo_url) {
    flugzeug.photo_url = cached.photo_url;
  }
  if (!flugzeug.t && cached.type) {
    flugzeug.t = cached.type;
  }
  if (!flugzeug.manufacturer && cached.manufacturer) {
    flugzeug.manufacturer = cached.manufacturer;
  }
};

const ladeFlugzeugMetaAusDb = async (flugzeugListe) => {
  const hexes = [
    ...new Set(
      flugzeugListe
        .map((flugzeug) => flugzeug.hex)
        .filter((hex) => typeof hex === "string" && hex.length > 0),
    ),
  ];

  if (hexes.length === 0) {
    return;
  }

  const placeholders = hexes.map(() => "?").join(", ");
  const rows = await dbAlle(
    `
      SELECT hex, type, manufacturer, photo_url
      FROM aircraft_history
      WHERE hex IN (${placeholders})
      ORDER BY timestamp DESC
    `,
    hexes,
  );

  for (const row of rows) {
    fuehreFlugzeugMetaZusammen(row.hex, {
      photo_url: row.photo_url,
      type: row.type,
      manufacturer: row.manufacturer,
    });
  }
};

//Funktion zum Speichern von Flugzeugdaten in der Datenbank und Anreicherung mit externen Informationen
//Diese Daten werden später für Analysen, Abfragen und Statistiken verwendet
const speichereFlugzeugDaten = async (flugzeugListe) => {
  for (const flugzeug of flugzeugListe) {
    if (flugzeug.hex) {
      wendeFlugzeugMetaAn(flugzeug);
      const zwischengespeicherteMeta =
        flugzeugMetaNachHex.get(flugzeug.hex) || {};

      const zuletztGesehen = zuletztGespeichertUm.get(flugzeug.hex);
      const jetzt = Date.now();
      let flugzeugTyp = flugzeug.t || zwischengespeicherteMeta.type || null;
      let hersteller =
        flugzeug.manufacturer || zwischengespeicherteMeta.manufacturer || null;
      let fotoUrl =
        flugzeug.photo_url || zwischengespeicherteMeta.photo_url || null;

      if (zuletztGesehen && jetzt - zuletztGesehen < duplikatFensterMs) {
        flugzeug.t = flugzeugTyp;
        flugzeug.manufacturer = hersteller;
        flugzeug.photo_url = fotoUrl;
        continue;
      }
      zuletztGespeichertUm.set(flugzeug.hex, jetzt);

      //Versucht, ein Flugzeugfoto von planespotters.net abzurufen
      if (!fotoUrl) {
        try {
          const fotoAntwort = await axios.get(
            `https://api.planespotters.net/pub/photos/hex/${flugzeug.hex}`, //API für Fotos eines Flugzeugs anhand der HEX aus den ADS-B Daten
            { timeout: 30000 }, //Setzt den Timeout auf 3 Sekunden
          );
          if (fotoAntwort.data.photos && fotoAntwort.data.photos.length > 0) {
            fotoUrl = fotoAntwort.data.photos[0].thumbnail_large.src;
          }
        } catch (error) {
          //Fehlerbehandlung
          console.warn(
            praefixExpress,
            `Fehler beim Laden des Fotos von planespotters.net fuer HEX ${flugzeug.hex}:`,
            error.message,
          );
        }
      }
      flugzeug.photo_url = fotoUrl;

      //Wenn der Flugzeugtyp noch nicht bekannt ist, versucht die Funktion, diesen und den Hersteller von hexdb.io abzurufen
      if (!flugzeugTyp) {
        try {
          const hexdbAntwort = await axios.get(
            `https://hexdb.io/api/v1/aircraft/${flugzeug.hex}`, //API für das Abfragen von Flugzeugtyp und Hersteller anhand der HEX
            { timeout: 3000 },
          );
          if (hexdbAntwort.data) {
            flugzeugTyp = hexdbAntwort.data.Type || flugzeugTyp;
            hersteller = hexdbAntwort.data.Manufacturer || hersteller;
            //Daten auch im Objekt speichern
            flugzeug.t = flugzeugTyp;
            flugzeug.manufacturer = hersteller;
          }
        } catch (error) {
          //Fehlerbehandlung
          console.warn(
            praefixExpress,
            `Fehler beim Abruf von hexdb.io für HEX ${flugzeug.hex}:`,
            error.message,
          );
        }
      }

      flugzeug.t = flugzeugTyp;
      flugzeug.manufacturer = hersteller;
      fuehreFlugzeugMetaZusammen(flugzeug.hex, {
        photo_url: fotoUrl,
        type: flugzeugTyp,
        manufacturer: hersteller,
      });

      //Fügt die angereicherten Flugzeugdaten in die Datenbank ein
      db.run(
        "INSERT INTO aircraft_history (hex, flight, alt_baro, gs, track, lat, lon, squawk, type, manufacturer, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          flugzeug.hex, //Muss vorhanden sein
          flugzeug.flight || null, //Optionale angabe
          flugzeug.alt_baro || null, //Optionale angabe
          flugzeug.gs || null, //Optionale angabe
          flugzeug.track || null, //Optionale angabe
          flugzeug.lat || null, //Optionale angabe
          flugzeug.lon || null, //Optionale angabe
          flugzeug.squawk || null, //Optionale angabe
          flugzeugTyp, //Optionale angabe
          hersteller, //Optionale angabe
          fotoUrl, //Optionale angabe
          //Ziel?
          //Herkunft?
          //Dauer?
          //Strecke?
          //Airline?
          //Alter des Flugzeugs?
          //Typ des Flugzeugs (z.B. Passagier, Fracht, Privat)?
        ],
        function (err) {
          if (err) {
            //Fehlerbehandlung
            console.error(
              praefixExpress,
              `Fehler beim Speichern der Daten fuer HEX ${flugzeug.hex}:`,
              err.message,
            );
          }
        },
      );
    }
  }
};

//API-Endpunkt zum Abrufen von Flugzeugdaten
//Ruft Daten von der konfigurierten externen API ab
//Die abgerufenen Daten werden in der Datenbank gespeichert und an den Client gesendet
app.get("/api/aircraft", async (req, res) => {
  let data;
  if (!konfiguration.apiUrl) {
    return res.status(500).send("Keine externe API konfiguriert.");
  }
  try {
    const antwort = await axios.get(konfiguration.apiUrl, { timeout: 5000 });
    data = antwort.data;
  } catch (error) {
    //Fehlerbehandlung
    console.error(
      praefixExpress,
      `Fehler beim Abruf der externen API (${konfiguration.apiUrl}):`,
      error.message,
    );
    return res
      .status(500)
      .send("Fehler beim Abrufen der Daten von der externen API.");
  }

  if (data && data.aircraft) {
    try {
      await ladeFlugzeugMetaAusDb(data.aircraft);
    } catch (error) {
      console.warn(
        praefixExpress,
        "Flugzeug-Metadaten konnten nicht aus der DB geladen werden:",
        error.message,
      );
    }

    data.aircraft.forEach(wendeFlugzeugMetaAn);
    res.json(data);

    speichereFlugzeugDaten(data.aircraft).catch((error) => {
      console.error(
        praefixExpress,
        "Fehler bei Anreicherung/Speicherung von Flugzeugdaten:",
        error.message,
      );
    });
  } else {
    res.json({ aircraft: [] });
  }
});

//**
// /api/aircraft/current
//  */
//API-Endpunkt zum Abrufen der aktuell sichtbaren Flugzeuge mit reduzierten Daten
//Gibt nur Flugnummer, Höhe und Geschwindigkeit zurück
app.get("/api/aircraft/current", async (req, res) => {
  let data;
  if (!konfiguration.apiUrl) {
    return res.status(500).send("Keine externe API konfiguriert.");
  }
  try {
    const antwort = await axios.get(konfiguration.apiUrl, { timeout: 5000 });
    data = antwort.data;
  } catch (error) {
    console.error(
      praefixExpress,
      `Fehler beim Abruf der externen API (${konfiguration.apiUrl}):`,
      error.message,
    );
    return res
      .status(500)
      .send("Fehler beim Abrufen der Daten von der externen API.");
  }

  if (data && data.aircraft) {
    const vereinfachteFlugzeuge = data.aircraft.map((flugzeug) => ({
      flight: flugzeug.flight || "k. A.",
      altitude: flugzeug.alt_baro,
      speed: flugzeug.gs,
    }));
    res.json(vereinfachteFlugzeuge);
  } else {
    res.json([]);
  }
});

//API-Endpunkt zum Abrufen von Flugstatistikdaten
//Führt mehrere Datenbankabfragen parallel aus, um verschiedene Statistiken zu sammeln
//und gibt diese als JSON-Antwort zurück
app.get("/api/statistics", (req, res) => {
  const statistik = {};
  const abfragen = [
    //Gesamtzahl der einzigartigen Flugzeuge
    new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(DISTINCT hex) as count FROM aircraft_history",
        (err, row) => {
          //Fehlerbehandlung
          if (err) reject(err);
          statistik.uniqueAircraft = row.count;
          resolve();
        },
      );
    }),
    //Die 5 meistgesehenen Flugzeuge (nach HEX-Code)
    new Promise((resolve, reject) => {
      db.all(
        "SELECT hex, COUNT(hex) as count FROM aircraft_history GROUP BY hex ORDER BY count DESC LIMIT 5",
        (err, rows) => {
          //Fehlerbehandlung
          if (err) reject(err);
          statistik.topAircraft = rows;
          resolve();
        },
      );
    }),

    //Durchschnittswerte von Höhe und Geschwindigkeit
    new Promise((resolve, reject) => {
      db.get(
        "SELECT AVG(alt_baro) as avg_altitude, AVG(gs) as avg_speed FROM aircraft_history WHERE alt_baro > 0 AND gs > 0",
        (err, row) => {
          //Fehlerbehandlung
          if (err) reject(err);
          statistik.averages = row;
          resolve();
        },
      );
    }),

    //Sichtungen pro Stunde
    new Promise((resolve, reject) => {
      db.all(
        "SELECT strftime('%Y-%m-%d %H:00:00', timestamp) as hour, COUNT(*) as count FROM aircraft_history GROUP BY hour ORDER BY hour",
        (err, rows) => {
          //Fehlerbehandlung
          if (err) reject(err);
          statistik.sightingsPerHour = rows;
          resolve();
        },
      );
    }),

    //Alle Flugzeugtypen mit Anzahl der Sichtungen
    new Promise((resolve, reject) => {
      db.all(
        "SELECT type, COUNT(*) as count FROM aircraft_history WHERE type IS NOT NULL GROUP BY type ORDER BY count DESC",
        (err, rows) => {
          //Fehlerbehandlung
          if (err) reject(err);
          statistik.aircraftTypes = rows;
          resolve();
        },
      );
    }),

    //Top 5 Hersteller mit den meisten Sichtungen
    new Promise((resolve, reject) => {
      db.all(
        "SELECT manufacturer, COUNT(*) as count FROM aircraft_history WHERE manufacturer IS NOT NULL GROUP BY manufacturer ORDER BY count DESC LIMIT 5",
        (err, rows) => {
          //Fehlerbehandlung
          if (err) reject(err);
          statistik.topManufacturers = rows;
          resolve();
        },
      );
    }),
  ];

  Promise.all(abfragen)
    .then(() => res.json(statistik))
    .catch((err) => {
      //Fehlerbehandlung
      console.error(praefixExpress, "Fehler beim Abrufen der Statistik:", err);
      res.status(500).send("Fehler beim Abfragen der Statistikdatenbank.");
    });
});

//API-Endpunkt für die Flugsuche
//Sucht in der Datenbank nach Flügen basierend auf Flugnummer und Datum
app.get("/api/flights/search", (req, res) => {
  //Extrahiert Flugnummer und Datum aus den Query-Parametern
  const { flight, date } = req.query;

  //Validierung der Eingaben: Wenn eine fehlt, wird ein 400 Bad Request zurückgegeben
  if (!flight || !date) {
    return res.status(400).send("Flugnummer und Datum sind erforderlich.");
  }

  //Entfernt Leerzeichen von der Flugnummer
  const bereinigterFlug = flight.trim();

  //Datenbank abfrage zum suchen von Flügen
  const sqlAnweisung = `
        SELECT * FROM aircraft_history
        WHERE trim(flight) = ? AND date(timestamp) = ?
        ORDER BY timestamp ASC
    `;

  db.all(sqlAnweisung, [bereinigterFlug, date], (err, rows) => {
    //Fehlerbehandlung
    if (err) {
      console.error(praefixExpress, "Fehler bei der Flugsuche:", err);
      return res.status(500).send("Fehler bei der Datenbanksuche.");
    }
    //Gibt die Ergebnisse als JSON zurück auch wenn keine gefunden wurden (also ein leeres Array).
    res.json(rows);
  });
});

//Stellt statische Dateien aus dem 'public'-Verzeichnis bereit.
app.use(express.static(path.join(__dirname, "public")));
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
app.get("/search", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "search.html"));
});

//Leitet alle nicht gefundenen Routen auf die Startseite um (z.B. bei 404-Fehlern).
app.get(/^[^.]*$/, (req, res) => {
  //res.sendFile(path.join(__dirname, 'public', 'index.html')); //Auskommentiert, da eine Weiterleitung verwendet wird.
  res.redirect("/?error=notfound");
});

//Startet den Webserver und lauscht auf dem konfigurierten Port.
const starteServer = async () => {
  try {
    // Initialisiert die Datenbank vor dem Start des Webservers.
    await initialisiereDb();
  } catch (error) {
    console.error(
      praefixExpress,
      "Datenbank-Initialisierung fehlgeschlagen:",
      error.message,
    );
    process.exit(1);
  }

  app.listen(konfiguration.port, konfiguration.listenon, () => {
    console.log(
      praefixExpress,
      `Server lauscht auf ${konfiguration.listenon}:${konfiguration.port}`,
    );
    console.log(praefixExpress, "DESY-ADSB Flight Tracker wurde gestartet.");
    console.log(
      praefixExpress,
      `Positionsdaten werden alle ${duplikatFensterMs / 1000} Sekunden pro HEX gespeichert.`,
    );
    if (konfiguration.apiUrl) {
      console.log(
        praefixExpress,
        `API-Anfragen werden weitergeleitet an: ${konfiguration.apiUrl}`,
      );
      console.log(praefixExpress, "⌯✈︎ ⌯✈︎ ⌯✈︎ ⌯✈︎ Bereit zum Start! ⌯✈︎ ⌯✈︎ ⌯✈︎ ⌯✈︎");
    } else {
      console.error(praefixExpress, "Keine apiUrl konfiguriert");
    }
  });
};

starteServer();
