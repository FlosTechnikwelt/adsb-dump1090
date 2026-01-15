//database.js
//Dieses Modul ist für die Initialisierung und Verwaltung der SQLite-Datenbank zuständig.
//Es stellt die Verbindung zur Datenbank her und sorgt dafür, dass die notwendigen Tabellen und Spalten existieren.

const sqlite3 = require("sqlite3").verbose(); //erweiterte Fehlermeldungen #DebugTime
const path = require("path");
const dbPath = path.join(__dirname, "stats.db"); //Pfad zur SQLite-Datenbankdatei.
const config = require("./config.json"); //Lädt die Konfigurationsdatei.
const pre = config.prefixdb || "[DB]: "; //Präfix für Datenbank-Log-Nachrichten.

// Stellt eine Verbindung zur SQLite-Datenbank her.
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(pre, "Error opening database:", err.message);
  } else {
    console.log(pre, "Connected to the SQLite database.");
  }
});

//Initialisiert die Datenbank: Erstellt die 'aircraft_history'-Tabelle und fügt fehlende Spalten hinzu.
const initDb = () => {
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
        return;
      }
      console.log(pre, "Table aircraft_history is ready");

      // Fügt die Spalte 'squawk' hinzu, falls sie noch nicht existiert.
      const addSquawkSql =
        "ALTER TABLE aircraft_history ADD COLUMN squawk TEXT";
      db.run(addSquawkSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(pre, "Error adding 'squawk' column:", err.message);
        } else {
          console.log(pre, '"squawk" column is ready');
        }
      });

      // Fügt die Spalte 'type' hinzu, falls sie noch nicht existiert.
      const addTypeSql = "ALTER TABLE aircraft_history ADD COLUMN type TEXT";
      db.run(addTypeSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(pre, "Error adding 'type' column:", err.message);
        } else {
          console.log(pre, '"type" column is ready');
        }
      });

      // Fügt die Spalte 'manufacturer' hinzu, falls sie noch nicht existiert.
      const addManufacturerSql =
        "ALTER TABLE aircraft_history ADD COLUMN manufacturer TEXT";
      db.run(addManufacturerSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(
            pre,
            "Error adding 'manufacturer' column:",
            err.message,
          );
        } else {
          console.log(pre, '"manufacturer" column is ready');
        }
      });

      // Fügt die Spalte 'photo_url' hinzu, falls sie noch nicht existiert.
      const addPhotoUrlSql =
        "ALTER TABLE aircraft_history ADD COLUMN photo_url TEXT";
      db.run(addPhotoUrlSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(pre, "Error adding 'photo_url' column:", err.message);
        } else {
          console.log(pre, '"photo_url" column is ready');
        }
      });
    });
  });
};

// Exportiert das Datenbankobjekt und die Initialisierungsfunktion zur Verwendung in anderen Modulen.
module.exports = { db, initDb };