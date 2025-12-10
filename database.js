const sqlite3 = require("sqlite3").verbose(); //Verbose für erweiterte Fehlermeldungen #DebugTime
const path = require("path");
const dbPath = path.join(__dirname, "stats.db"); //Datenbank Pfad
const config = require("./config.json"); // Config Pfad
const pre = config.prefixdb || "[DB]: ";

//Datenbank "Verbindung" herstellen
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(pre, "Error opening database:", err.message);
  } else {
    console.log(pre, "Connected to the SQLite database.");
  }
});

//DB Initialisieren - Tabelle und Spalten erstellen wenn diese nicht existiert
const initDb = () => {
  //Tabelle erstellen wenn diese nicht existiert
  db.serialize(() => {
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
      //Fehlerbehandlung
      if (err) {
        console.error(pre, "Error creating table:", err.message);
        return;
      }
      console.log(pre, "Table aircraft_history is ready");
      //Neue Spalten hinzufügen wenn diese nicht existieren
      const addSquawkSql =
        "ALTER TABLE aircraft_history ADD COLUMN squawk TEXT";
      db.run(addSquawkSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(pre, "Error squawk column:", err.message);
        } else {
          console.log(pre, '"squawk" is done');
        }
      });
      //Neue Spalte für Verlauf zur DB hinzufügen wenn noch nicht vorhanden
      const addTypeSql = "ALTER TABLE aircraft_history ADD COLUMN type TEXT";
      db.run(addTypeSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(pre, "Error type column:", err.message);
        } else {
          console.log(pre, '"type" is done');
        }
      });
      //Neue Spalte für Hersteller hinzufügen, wenn noch nicht in der DB vorhanden
      const addManufacturerSql =
        "ALTER TABLE aircraft_history ADD COLUMN manufacturer TEXT";
      db.run(addManufacturerSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(pre, "Error manufacturer column:", err.message);
        } else {
          console.log(pre, '"manufacturer" is done');
        }
      });
      //Neue Spalte für die URL zu dem Foto einer sichtung hinzufügen
      const addPhotoUrlSql =
        "ALTER TABLE aircraft_history ADD COLUMN photo_url TEXT";
      db.run(addPhotoUrlSql, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error(pre, "Error photo_url column:", err.message);
        } else {
          console.log(pre, '"photo_url" is done');
        }
      });
    });
  });
};

module.exports = { db, initDb };
