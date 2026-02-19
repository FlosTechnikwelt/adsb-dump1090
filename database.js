//database.js
//Dieses Modul ist für die Initialisierung und Verwaltung der SQLite-Datenbank zuständig.
//Es stellt die Verbindung zur Datenbank her und sorgt dafür, dass die notwendigen Tabellen und Spalten existieren.

const sqlite3 = require("sqlite3").verbose(); //erweiterte Fehlermeldungen #DebugTime
const path = require("path");
const fs = require("fs");
const konfiguration = require("./config.json"); //Lädt die Konfigurationsdatei.
const praefixDb = konfiguration.prefixdb || "[DB]: "; //Präfix für Datenbank-Log-Nachrichten.
const konfigurierterDbPfad = process.env.DB_PATH || konfiguration.dbPath;
const dbPfad = konfigurierterDbPfad
  ? path.resolve(konfigurierterDbPfad)
  : path.join(__dirname, "stats.db"); //Pfad zur SQLite-Datenbankdatei.

const stelleBeschreibbareDbSicher = () => {
  const dbVerzeichnis = path.dirname(dbPfad);
  fs.mkdirSync(dbVerzeichnis, { recursive: true });

  try {
    fs.accessSync(dbVerzeichnis, fs.constants.W_OK);
  } catch (err) {
    throw new Error(
      `Datenbank-Verzeichnis ist nicht beschreibbar (${dbVerzeichnis}): ${err.message}`,
    );
  }

  if (!fs.existsSync(dbPfad)) {
    fs.closeSync(fs.openSync(dbPfad, "a"));
  }

  try {
    fs.accessSync(dbPfad, fs.constants.W_OK);
  } catch (_err) {
    try {
      fs.chmodSync(dbPfad, 0o664);
      fs.accessSync(dbPfad, fs.constants.W_OK);
    } catch (chmodFehler) {
      throw new Error(
        `Datenbank-Datei ist nicht beschreibbar (${dbPfad}). Pruefe Besitzer/Rechte: ${chmodFehler.message}`,
      );
    }
  }
};

stelleBeschreibbareDbSicher();

// Stellt eine Verbindung zur SQLite-Datenbank her.
const db = new sqlite3.Database(dbPfad, (err) => {
  if (err) {
    console.error(praefixDb, "Fehler beim Oeffnen der Datenbank:", err.message);
  } else {
    console.log(praefixDb, `Mit SQLite-Datenbank verbunden: ${dbPfad}.`);
  }
});

//Initialisiert die Datenbank: Erstellt die 'aircraft_history'-Tabelle und signalisiert erst danach "ready".
const initDb = () => {
  return new Promise((resolve, reject) => {
    // Führt Datenbankoperationen seriell aus, um Race Conditions zu vermeiden.
    db.serialize(() => {
      //SQL-Befehl zum Erstellen der 'aircraft_history'-Tabelle, falls sie noch nicht existiert.
      const createSql = `
              CREATE TABLE IF NOT EXISTS aircraft_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  hex TEXT NOT NULL,
                  flight TEXT,
                  alt_baro INTEGER,
                  gs REAL,
                  track REAL,
                  lat REAL,
                  lon REAL,
                  squawk TEXT,
                  type TEXT,
                  manufacturer TEXT,
                  photo_url TEXT,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
              )
          `;
      db.run(createSql, (err) => {
        // Fehlerbehandlung beim Erstellen der Tabelle.
        if (err) {
          console.error(praefixDb, "Fehler beim Erstellen der Tabelle:", err.message);
          reject(err);
          return;
        }
        console.log(praefixDb, "Tabelle aircraft_history ist bereit");
        resolve();
      });
    });
  });
};

// Exportiert das Datenbankobjekt und die Initialisierungsfunktion zur Verwendung in anderen Modulen.
module.exports = { db, initDb };
