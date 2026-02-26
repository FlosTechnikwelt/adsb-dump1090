# Datenbankmodul (database.js)

## Zweck

`database.js` initialisiert und verwaltet die SQLite-Datenbank des Projekts. Es stellt die Verbindung her, legt die Tabelle fuer die Flugzeug-Historie an und exportiert das Datenbankobjekt fuer andere Module.

## Hauptaufgaben

- Aufbau der SQLite-Verbindung zu `stats.db`
- Erstellung der Tabelle `aircraft_history`, falls sie noch nicht existiert
- Bereitstellung von `db` und `initDb()` fuer den Server

## Wichtige Bestandteile

### Datenbankverbindung

- Pfad: `stats.db` im Projektverzeichnis
- Modul: `sqlite3` (verbose fuer erweiterte Fehlermeldungen)
- Log-Praefix aus `config.json` (`prefixdb`, Standard `[DB]: `)

### Initialisierung

Die Funktion `initDb()` fuehrt die Tabellenanlage aus:

- `CREATE TABLE IF NOT EXISTS aircraft_history (..., timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`
- Spalten: `hex`, `flight`, `alt_baro`, `gs`, `track`, `lat`, `lon`, `squawk`, `type`, `manufacturer`, `photo_url`

## Exportierte API

- `db`: SQLite-Instanz, wird im Server fuer Inserts und Abfragen genutzt
- `initDb()`: wird beim Serverstart aufgerufen, um die Tabelle sicherzustellen

## Rolle im Projekt

`database.js` ist das zentrale Modul fuer die Datenspeicherung. Alle Schreibvorgaenge (z. B. in `recordAircraftData()`) und alle Analyse-Abfragen greifen auf das hier exportierte `db` zu.
