//database.js
//Dieses Modul ist für die Initialisierung und Verwaltung der SQLite-Datenbank zuständig.
//Es stellt die Verbindung zur Datenbank her und sorgt dafür, dass die notwendigen Tabellen und Spalten existieren.

const sqlite3 = require("sqlite3").verbose(); //erweiterte Fehlermeldungen #DebugTime
const path = require("path");
const fs = require("fs");
const config = require("./config.json"); //Lädt die Konfigurationsdatei.
const pre = config.prefixdb || "[DB]: "; //Präfix für Datenbank-Log-Nachrichten.
const configuredDbPath = process.env.DB_PATH || config.dbPath;
const dbPath = configuredDbPath
  ? path.resolve(configuredDbPath)
  : path.join(__dirname, "stats.db"); //Pfad zur SQLite-Datenbankdatei.

const ensureDbWritable = () => {
  const dbDir = path.dirname(dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  try {
    fs.accessSync(dbDir, fs.constants.W_OK);
  } catch (err) {
    throw new Error(
      `Database directory is not writable (${dbDir}): ${err.message}`,
    );
  }

  if (!fs.existsSync(dbPath)) {
    fs.closeSync(fs.openSync(dbPath, "a"));
  }

  try {
    fs.accessSync(dbPath, fs.constants.W_OK);
  } catch (_err) {
    try {
      fs.chmodSync(dbPath, 0o664);
      fs.accessSync(dbPath, fs.constants.W_OK);
    } catch (chmodErr) {
      throw new Error(
        `Database file is not writable (${dbPath}). Check owner/permissions: ${chmodErr.message}`,
      );
    }
  }
};

ensureDbWritable();

// Stellt eine Verbindung zur SQLite-Datenbank her.
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(pre, "Error opening database:", err.message);
  } else {
    console.log(pre, `Connected to the SQLite database at ${dbPath}.`);
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
          console.error(pre, "Error creating table:", err.message);
          reject(err);
          return;
        }
        console.log(pre, "Table aircraft_history is ready");
        resolve();
      });
    });
  });
};

// Exportiert das Datenbankobjekt und die Initialisierungsfunktion zur Verwendung in anderen Modulen.
module.exports = { db, initDb };
