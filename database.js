//database.js
//Dieses Modul ist für die Initialisierung und Verwaltung der SQLite-Datenbank zuständig.
//Es stellt die Verbindung zur Datenbank her und sorgt dafür, dass die notwendigen Tabellen und Spalten existieren.

const sqlite3 = require("sqlite3").verbose(); //erweiterte Fehlermeldungen #DebugTime
const path = require("path");
const dbPath = path.join(__dirname, "stats.db"); //Pfad zur SQLite-Datenbankdatei.
const config = require("./config.json"); //Lädt die Konfigurationsdatei.
const pre = config.prefixdb || "[DB]: "; //Präfix für Datenbank-Log-Nachrichten.

//Stellt eine Verbindung zur SQLite-Datenbank her, bzw. erstellt eine neue Datei wenn noch keine Vrhanden
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(pre, "Error opening database:", err.message);
  } else {
    console.log(pre, "Connected to the SQLite database.");
  }
});

//Initialisiert die Datenbank: Erstellt die 'aircraft_history'-Tabelle und fügt fehlende Spalten hinzu.
const initDb = () => {

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
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
    db.run(createSql, (err) => {
      //Fehler beim erstellen
      if (err) {
        console.error(pre, "Error creating table:", err.message);
        return;
      }
      console.log(pre, "Table aircraft_history is ready");

      //Neue Spalte 'squawk'
      const addSquawkSql =
        "ALTER TABLE aircraft_history ADD COLUMN squawk TEXT";
      db.run(addSquawkSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(pre, "Error adding 'squawk' column:", err.message);
        } else {
          console.log(pre, '"squawk" column is ready');
        }
      });

      //Neue Spalte 'type'
      const addTypeSql = "ALTER TABLE aircraft_history ADD COLUMN type TEXT";
      db.run(addTypeSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(pre, "Error adding 'type' column:", err.message);
        } else {
          console.log(pre, '"type" column is ready');
        }
      });

      //Neue Spalte 'manufacturer'
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

      //Neue Splte 'photo_url'
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

//Exportieren
module.exports = { db, initDb };