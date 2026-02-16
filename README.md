<!-- README for ADS-B Flugzeug-Tracker (adsb-dump1090) -->
# ADS‑B Flugzeug‑Tracker (adsb-dump1090)

## Projektübersicht

- **Zweck:** Sammlung, Anreicherung und Speicherung von ADS‑B Flugzeugdaten; Bereitstellung von API‑Endpoints für Statistiken und Flugsuche; einfaches Web‑Frontend zur Anzeige.
- **Technologien:** Node.js, Express, SQLite (`sqlite3`), Axios, Chart.js (Frontend).

## Projektstruktur (wichtige Dateien)

- **`server.js`**: Haupt-Express-Server, API‑Endpoints, Datenverarbeitung und statische Bereitstellung.
- **`database.js`**: Initialisierung und Verwaltung der SQLite‑Datenbank; exportiert `db` und `initDb`.
- **`config.json`**: Konfiguration (z. B. `apiUrl`, Log‑Prefixes).
- **`public/`**: Frontend, enthält HTML, CSS und JavaScript (u. a. `index.html`, `search.html`, `statistics.html`, `assets/js/*.js`).

## Kurzbeschreibung des Ablaufs

1. Serverstart führt `initDb()` aus (`database.js`) — erzeugt Tabelle `aircraft_history`, fügt fehlende Spalten per `ALTER TABLE` hinzu.
2. `GET /api/aircraft` holt Flugzeugdaten von der konfigurierten externen API (`config.apiUrl`).
3. `recordAircraftData()` reichert jeden Flugzeugdatensatz an (Fotos/Typ/Hersteller) und speichert ihn in der Datenbank.
4. Weitere Endpoints liefern Statistiken (`/api/statistics`) und Suche nach Flügen (`/api/flights/search`).
5. Statische Dateien in `public/` werden per `express.static()` ausgeliefert; Chart.js wird aus `node_modules` bereitgestellt.

## Datenquelle und Anreicherung

- **Hauptquelle:** konfigurierbar über `config.json` → `apiUrl` (z. B. Dump1090 JSON).
- **Anreicherungen (in `recordAircraftData`)**:
  - Foto: `https://api.planespotters.net/pub/photos/hex/{hex}` (3s Timeout). Falls vorhanden, `photo_url` gesetzt.
  - Typ & Hersteller: `https://hexdb.io/api/v1/aircraft/{hex}` (3s Timeout). Falls vorhanden, `type` und `manufacturer` gesetzt.
- Fehler/Timeouts bei externen Quellen werden geloggt; Verarbeitung fährt für andere Einträge fort.

## Speicherung (Datenbank)

- **Datei:** `stats.db` (SQLite, im Projektverzeichnis).
- **Tabelle:** `aircraft_history`

  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `hex` TEXT NOT NULL
  - `flight` TEXT
  - `alt_baro` INTEGER
  - `gs` REAL
  - `track` REAL
  - `lat` REAL
  - `lon` REAL
  - `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `squawk` TEXT
  - `type` TEXT
  - `manufacturer` TEXT
  - `photo_url` TEXT

## Wichtige SQL‑Abfragen

- Einzigartige Flugzeuge: `SELECT COUNT(DISTINCT hex) as count FROM aircraft_history`
- Top 5 Flugzeuge: `SELECT hex, COUNT(hex) as count FROM aircraft_history GROUP BY hex ORDER BY count DESC LIMIT 5`
- Durchschnitts‑Höhe und -Geschwindigkeit: `SELECT AVG(alt_baro) as avg_altitude, AVG(gs) as avg_speed FROM aircraft_history WHERE alt_baro > 0 AND gs > 0`
- Sichtungen pro Stunde: `SELECT strftime('%Y-%m-%d %H:00:00', timestamp) as hour, COUNT(*) as count FROM aircraft_history GROUP BY hour ORDER BY hour`
- Flugzeugtypen und Hersteller: Gruppierungen mit `COUNT(*)` und `ORDER BY count DESC`.

## API Endpoints

- `GET /api/aircraft`
  - Holt aktuelle Flugzeuginformationen (externes API), reichert an, speichert in DB, antwortet mit JSON.
- `GET /api/statistics`
  - Antwort: JSON mit: `uniqueAircraft`, `topAircraft`, `averages`, `sightingsPerHour`, `aircraftTypes`, `topManufacturers`.
- `GET /api/flights/search?flight=XXX&date=YYYY-MM-DD`
  - Validierung: `flight` und `date` erforderlich. Sucht nach `trim(flight) = ? AND date(timestamp) = ?`.

## Frontend

- Die statischen Seiten in `public/` verwenden die API zur Darstellung (z. B. Charts mit Chart.js).
- Chart.js und `chartjs-adapter-date-fns` werden serverseitig aus `node_modules` verfügbar gemacht.

## Konfiguration

- `config.json` (Beispiele):
  - `apiUrl`: URL zur externen Datenquelle (z. B. Dump1090 JSON).
  - `prefixexpress`, `prefixdb`, `prefixconfig`: String‑Prefixes für Logs.
- Hinweis: Für Produktion sensible Einstellungen besser per Umgebungsvariablen verwalten.

## Installation & Ausführung

1. Abhängigkeiten installieren:

```bash
npm install
```

2. Server starten:

```bash
node server.js
```

3. Im Entwicklungsmodus mit `nodemon`:

```bash
npx nodemon server.js
```

4. Standard‑Port: `3001`.

## Wartung & Erweiterungsvorschläge

- Robustheit:
  - API‑Keys, Rate‑Limits und Backoff/Retry‑Strategien für externe Dienste implementieren.
- Skalierung:
  - Bei großem Datenaufkommen Migration zu Postgres oder regelmäßiges Archivieren von Daten erwägen.
- Sicherheit:
  - Eingaben validieren, Rate‑Limiting, sensible Daten in `.env`/Umgebungsvariablen.
- Verbesserung der Speicherung:
  - Duplikaterkennung oder Upsert‑Logik, falls mehrfach gleiche Messungen gespeichert werden.
- Tests:
  - Unit‑Tests für DB‑Funktionen und API‑Handler ergänzen.

## Bekannte Besonderheiten / Hinweise

- `ALTER TABLE ADD COLUMN` wird beim Start ausgeführt; Fehler wegen bereits existierender Spalten werden abgefangen.
- `GET /api/aircraft` speichert bei jedem Aufruf neue Zeilen — die Datenbank wächst mit häufiger Nutzung.
- Externe Anfragen haben feste Timeouts (3s/5s). Fehlende Antworten führen zu `null`‑Feldern, nicht zu einem Crash.

## Nächste Schritte (Empfehlungen)

- Optional: Diese README in Git committen.
- Optional: Kleine CLI oder Cron‑Job hinzufügen, der `GET /api/aircraft` regelmäßig triggert.

---

Wenn du möchtest, committe ich die Datei `README.md` in dein Repo oder passe die README an (z. B. zusätzliche Beispiele, Diagramme oder API‑Antwort‑Samples).
# DESY Flugzeug-Tracker

Dies ist ein Webanwendung zur Verfolgung und Analyse von Flugzeugdaten, die von einem ADS-B-Empfänger (z.B. dump1090) stammen. Die Anwendung visualisiert Flugbewegungen auf einer Live-Karte, bietet detaillierte Statistiken und ermöglicht die Suche nach vergangenen Flügen.

## Funktionen

- **Live-Karte**: Zeigt Flugzeuge in Echtzeit auf einer interaktiven Karte an. Die Daten werden kontinuierlich aktualisiert und um Informationen wie Flugzeugfotos, Typ und Hersteller ergänzt.
- **Statistiken**: Bietet eine Übersicht über gesammelte Flugdaten, einschließlich:
  - Anzahl einzigartiger Flugzeuge
  - Durchschnittliche Höhe und Geschwindigkeit
  - Sichtungen pro Stunde
  - Top-Flugzeugtypen und -Hersteller
- **Flugsuche**: Ermöglicht die Suche nach spezifischen Flügen anhand der Flugnummer und des Datums. Die Ergebnisse werden auf einer Karte als Flugroute und in einer Tabelle mit detaillierten Datenpunkten dargestellt.

## Technologien

- **Backend**: Node.js mit Express.js
- **Datenbank**: SQLite (gespeichert in `stats.db`)
- **Datenanreicherung**: Externe APIs (planespotters.net, hexdb.io)
- **Frontend**: HTML, CSS (Bootstrap), JavaScript
- **Kartenvisualisierung**: Leaflet.js
- **Diagramme**: Chart.js
- **Paketverwaltung**: npm

## Installation und Einrichtung

Um das Projekt lokal auszuführen, folgen Sie diesen Schritten:

1.  **Repository klonen**:

    ```bash
    git clone https://github.com/FlorianLinde/adsb-dump1090.git
    cd adsb-dump1090
    ```

2.  **Abhängigkeiten installieren**:

    ```bash
    npm install
    ```

3.  **Konfiguration (`config.json`)**:
    Erstellen Sie eine Datei `config.json` im Hauptverzeichnis des Projekts. Diese Datei wird verwendet, um die URL Ihrer ADS-B-API zu konfigurieren.

    Beispiel für `config.json`:

    ```json
    {
      "apiUrl": "http://localhost:8080/adsb.json",
      "prefixexpress": "[WEBSERVE]: ",
      "prefixconfig": "[CONFIG]: ",
      "prefixdb": "[DB]: "
    }
    ```

    Ersetzen Sie `"http://localhost:8080/adsb.json"` durch die tatsächliche URL Ihres ADS-B-Datenfeeds (z.B. von dump1090).

4.  **Datenbank initialisieren**:
    Die Datenbank (`stats.db`) und die notwendigen Tabellen werden automatisch beim ersten Start des Servers initialisiert.

## Projekt starten

Um den Server zu starten, führen Sie den folgenden Befehl aus:

```bash
npm start
```

Der Server wird standardmäßig auf `http://localhost:3001` gestartet.

Für die Entwicklung können Sie `nodemon` verwenden, um den Server bei Dateiänderungen automatisch neu zu starten:

```bash
npm run dev
```

## Zugriff auf die Anwendung

Nach dem Start des Servers können Sie die Anwendung in Ihrem Webbrowser unter den folgenden Adressen aufrufen:

- **Live-Karte**: `http://localhost:3001/`
- **Statistiken**: `http://localhost:3001/statistics.html`
- **Flugsuche**: `http://localhost:3001/search`

**Autor**: Florian Linde (DESY IT)
