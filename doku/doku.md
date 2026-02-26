# Projektdokumentation: ADS-B Flugzeug-Tracker

## Ziel des Projekts

Dieses Projekt sammelt ADS-B-Flugzeugdaten, reichert sie mit Zusatzinformationen an und speichert sie in einer SQLite-Datenbank. Die Daten werden per API bereitgestellt und in einem einfachen Web-Frontend (Live-Karte, Statistiken, Flugsuche) visualisiert. Der Fokus liegt auf transparenter Datenhaltung und einer leicht nachvollziehbaren Pipeline von der Datenquelle bis zur Anzeige.

## Was ist ADS-B?

ADS-B steht für "Automatic Dependent Surveillance - Broadcast". Flugzeuge senden dabei regelmässig Positions- und Statusdaten (z. B. Position, Höhe, Geschwindigkeit, Kurs, Flugnummer, ICAO-HEX) als Funksignal aus. "Dependent" bedeutet, dass die Position aus bordeigenen Systemen wie GNSS stammt. "Broadcast" heisst, dass die Daten ungerichtet ausgesendet werden und von Bodenstationen oder anderen Flugzeugen empfangen werden können.

## Wo wird ADS-B eingesetzt?

- Zivile Luftfahrt und Flugsicherung (Situationsbild, Verkehrsüberwachung)
- Flughäfen und Ground Operations
- Allgemeine Luftfahrt, Luftsport
- Forschung, Bildung und Hobby-Tracking

## Wer nutzt ADS-B?

- Flugsicherungsorganisationen und Behörden
- Fluglinien und Betreiber
- Flughafengesellschaften
- Forschungsprojekte, Universitäten
- Enthusiasten und Spotter-Communities

## Wie funktioniert ADS-B (vereinfacht)?

1. Das Flugzeug bestimmt seine Position per GNSS (oft GPS).
2. Es sendet regelmässig ADS-B-Nachrichten auf 1090 MHz (bzw. UAT in den USA).
3. Empfänger (z. B. dump1090) dekodieren die Signale und stellen die Daten als JSON bereit.
4. Dieses Projekt liest die Daten, reichert sie an, speichert sie und visualisiert sie im Web-Frontend.

## Code-überblick und Ablauf

### Backend (Node.js/Express)

- `server.js` ist der zentrale Express-Server
- `database.js` verwaltet die SQLite-Datenbank
- `config.json` enthält die Konfiguration

**Datenfluss **(Ablauf):

1. Beim Start ruft `initDb()` die Initialisierung der SQLite-Tabelle auf.
2. `GET /api/aircraft` holt aktuelle ADS-B-Daten aus `config.apiUrl`
3. `recordAircraftData()` reichert jedes Flugzeug an (Foto, Typ, Hersteller) und schreibt es in die DB.
4. Weitere Endpoints liefern Statistiken oder Suchergebnisse für das Frontend

### Datenbank-Speicherung

- Datei: `stats.db`
- Tabelle: `aircraft_history`
- Schema:
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `hex` TEXT NOT NULL
  - `flight` TEXT
  - `alt_baro` INTEGER
  - `gs` REAL
  - `track` REAL
  - `lat` REAL
  - `lon` REAL
  - `squawk` TEXT
  - `type` TEXT
  - `manufacturer` TEXT
  - `photo_url` TEXT
  - `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP

Jeder Aufruf von `/api/aircraft` fügt neue Zeilen hinzu. Es gibt keine deduplizierende Logik; damit kann die DB bei häufigen Aufrufen schnell wachsen.

## Externe Datenanreicherung

### planespotters.net

- Zweck: Flugzeugfotos per HEX-Code (ICAO24) abrufen
- Endpoint im Code: `https://api.planespotters.net/pub/photos/hex/{hex}`
- Ergebnis: `photo_url` wird gesetzt, wenn ein Foto gefunden wird

### hexdb.io

- Zweck: Flugzeugtyp und Hersteller per HEX-Code nachschlagen
- Endpoint im Code: `https://hexdb.io/api/v1/aircraft/{hex}`
- Ergebnis: `type` und `manufacturer` werden gesetzt, wenn vorhanden

Beide API-Quellen sind optional, falls es zu Fehlern oder Timeouts führt werden die Felder zu `null` gesetzt, und nicht weiterbeachtet.

## Funktionen und Endpoints (Backend)

### Funktionen in `server.js`

- `recordAircraftData(aircraftList)`
  - Iteriert über die Flugzeuge, ruft externe APIs für Foto/Typ/Hersteller ab und schreibt den Datensatz in die DB.

### API-Endpunkte in `server.js`

- `GET /api/aircraft`
  - Holt ADS-B-Daten aus der Quelle und speichert sie in der Datenbank
  - Antwort: Originaldaten (z. B. `data.aircraft`)

- `GET /api/statistics`
  - Führt mehrere DB-Abfragen aus und liefert Statistiken als JSON:
    - eindeutige Flugzeuge
    - Top 5 HEX-Codes
    - Durchschnittshöhe und -geschwindigkeit
    - Sichtungen pro Stunde
    - Flugzeugtypen und Top-Hersteller

- `GET /api/flights/search?flight=XXX&date=YYYY-MM-DD`
  - Sucht Datensätze mit der exakten Flugnummer und dem Datum.
  - Antwort: Liste von Messpunkten für die Flugroute (auf einer Karte)

### Weitere Endpunkte

- `GET /search`
  - Liefert die Suchseite (`public/search.html`) für die Flugsuche.

- `GET /scripts/chart.js`
  - Statischer Pfad für Chart.js aus `node_modules`.

- `GET /scripts/chartjs-adapter-date-fns`
  - Statischer Pfad für den Date-FNS-Adapter von Chart.js.

- Statische Dateien unter `/`
  - `express.static(public)` liefert alle Assets und HTML-Dateien aus `public/`.

- Catch-all für nicht gefundene Pfade (ohne Dateiendung)
  - Jede Route ohne Dateiendung wird auf `/` (Startseite) umgeleitet.

## Frontend-Funktionen

### `public/assets/js/script.js`

- `updateAircraftData()`
  - Ruft `/api/aircraft` ab, aktualisiert Marker auf der Live-Karte und entfernt nicht mehr sichtbare Flugzeuge.

### `public/assets/js/statistics.js`

- `fetchData()`
  - Ruft `/api/statistics` ab und startet das Rendering der Charts.
- `updateUI(stats)`
  - Fügt Statistikwerte in die UI ein und zeichnet/aktualisiert Chart.js-Diagramme.

### `public/assets/js/search.js`

- `displayResults(data, flightNumber, flightDate)`
  - Zeichnet die Flugroute und erzeugt eine Tabelle mit Messpunkten.

## Besonderheiten

- Externe API-Calls haben Timeouts (ca. 3-5 Sek.), um den weiteren Ablauf nicht zu blockieren
- Das Frontend arbeitet rein nur Clientseitig (Leaflet + Chart.js)

## Dependencies

- axios (1.13.2)
  - HTTP-Client für API-Anfragen an Planespotter.net & HexDB.io
  - Dokumentation: https://axios-http.com/docs/api_intro
- chart.js (4.5.1)
  - Darstellung von Statistiken und Zeitreihen in Diagrammen
  - Dokumentation: https://www.chartjs.org/docs/latest/getting-started/
- date-fns (4.1.0)
  - JavaScript-Bibliothek zur Verarbeitung und Formatierung von Datum & Zeit
  - Dokumentation: https://date-fns.org
- chartjs-adapter-date-fns (3.0.0)
  - Datums-/Zeit-Adapter für Chart.js auf Basis von date-fns
  - Dokumentation: https://www.npmjs.com/package/chartjs-adapter-date-fns
- express (5.1.0)
  - Webserver-Framework für Routing, Middleware und API-Endpunkte
  - Dokumentation: https://expressjs.com/en/5x/api.html
- sqlite3 (5.1.7)
  - Leichte, dateibasierte SQL-Datenbank für lokale Datenspeicherung
  - Dokumentation: https://www.npmjs.com/package/sqlite3

### DEV-Dependencies

- nodemon (3.1.11)
  - Startet den Server bei Dateiänderungen automatisch neu und erleichtert die Entwicklung.
  - Dokumentation: https://www.npmjs.com/package/nodemon
- prettier (3.7.4)
  - Formatiert Code einheitlich während der Entwicklung.
  - Dokumentation: https://www.npmjs.com/package/prettier

## Ideen für die Zukunft

- `install.sh`: Entwickeln eines Bash-Basierten Skriptes zum automatischen installation von NodeJS, FlightAware, der Anwendung und dem Service-Worker.
- `update.sh`: Automatiertes Updaten aller benötigten Ressourcen, um die Anwendung Aktuell und Sicher zu halten. In verbindung mit einem CRON-Job
- `deinstall.sh`: Entfernen aller datein und Packeten die durch `install.sh` installiert worden sind.

## Glossar

- **ADS-B**  
  _Automatic Dependent Surveillance–Broadcast_: Ein Überwachungsverfahren in der Luftfahrt, bei dem Flugzeuge ihre Position, Höhe, Geschwindigkeit und Identität automatisch per Funk aussenden. Die Daten stammen in der Regel aus dem bordeigenen GPS und können von Bodenstationen sowie anderen Luftfahrzeugen empfangen werden.
- **Squawk**  
  Ein vierstelliger Oktalcode, der vom Transponder eines Flugzeugs gesendet wird. Er dient der Identifikation und Kommunikation mit der Flugsicherung (z. B. 7000 für VFR, 7700 für Notfall).
- **Dump1090**  
  Ein Open-Source-Programm zum Empfangen, Dekodieren und Anzeigen von Mode-S- und ADS-B-Signalen auf 1090 MHz, häufig in Kombination mit einem SDR-Empfänger.
- **Leaflet**  
  Eine leichtgewichtige JavaScript-Bibliothek zur Darstellung interaktiver Karten im Web. Sie wird verwendet, um Flugzeugpositionen auf der Karte anzuzeigen.
- **hex**  
  Die 24-Bit-ICAO-Adresse eines Flugzeugs, immer hexadezimal dargestellt. Sie ist weltweit eindeutig und dient als feste Identifikationsnummer des Luftfahrzeugs in Mode-S- und ADS-B-Systemen.

## Hinweis zu Dump1090

Als Datenquelle wird ein lokaler dump1090-JSON-Endpunkt genutzt werden. DIese Anwednung verarbeitet die dort bereitgestellten Flugzeuglisten und speichert sie für Statistik und Suche. In diesem Fall wird als Treiber für Dump1090, der von FlightAwate genutzt.
