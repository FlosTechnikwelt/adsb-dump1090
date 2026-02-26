# ADS-B Flugzeug-Tracker - Komplette Dokumentation (v2)

## 1. Einfuehrung

Diese Dokumentation beschreibt das Projekt **adsb-dump1090** von Anfang bis Ende in einfacher Sprache. Ziel ist, dass auch jemand ohne tiefes Vorwissen schnell versteht:

- Was das System macht
- Wie die Daten verarbeitet werden
- Welche Dateien wichtig sind
- Wie man das Projekt startet
- Wie man typische Fehler findet und behebt

Das Projekt ist ein lokaler Flugzeug-Tracker. Es liest ADS-B Daten aus einer externen Quelle (zum Beispiel dump1090), verarbeitet diese Daten auf einem Node.js Server, speichert sie in einer SQLite Datenbank und zeigt sie im Browser an.

Die Anwendung hat drei Hauptbereiche:

1. Live-Karte
2. Statistiken
3. Flugsuche

Damit ist das Projekt sowohl fuer den Lernzweck als auch fuer den praktischen Betrieb geeignet.

## 2. Was ist ADS-B?

**ADS-B** bedeutet: _Automatic Dependent Surveillance - Broadcast_.

Einfach gesagt: Flugzeuge senden regelmaessig Signale mit Flugdaten. Diese Signale koennen von Empfaengern gelesen werden.

Typische Daten sind:

- HEX-ID des Flugzeugs
- Flugnummer
- Position (Breite, Laenge)
- Hoehe
- Geschwindigkeit
- Kurs
- Squawk

Wichtig: Die Daten sind nicht immer komplett. Manche Felder fehlen je nach Flugzeug, Empfang oder Zeitpunkt.

## 3. Projektziel

Das Projekt hat ein klares Ziel:

- ADS-B Rohdaten abholen
- Daten sinnvoll aufbereiten
- Daten um Zusatzinfos erweitern (Bild, Typ, Hersteller)
- Daten dauerhaft speichern
- Daten im Browser gut sichtbar machen

Zusatznutzen:

- Historische Auswertung moeglich
- Suche nach einem Flug an einem bestimmten Datum
- Einfache Statistik fuer Beobachtung und Analyse

## 4. Technologie-Stack

Das Projekt nutzt bewusst einfache, stabile Bausteine.

### Backend

- Node.js
- Express
- Axios

### Datenbank

- SQLite (`sqlite3`)

### Frontend

- HTML/CSS/JavaScript
- Leaflet (Karte)
- Chart.js (Diagramme)

### Dev-Tools

- nodemon
- prettier

## 5. Projektstruktur

Die wichtigsten Dateien im Projekt:

- `server.js`: Hauptserver, API, Datenfluss
- `database.js`: DB-Verbindung und Tabellen-Initialisierung
- `config.json`: Konfiguration (API URL, Port, Log-Praefixe)
- `public/index.html`: Live-Karte
- `public/statistics.html`: Statistikseite
- `public/search.html`: Flugsuche
- `public/assets/js/script.js`: Live-Kartenlogik
- `public/assets/js/statistics.js`: Statistiklogik
- `public/assets/js/search.js`: Suchlogik
- `presentation.html`: Praesentationsseite
- `DB-problem.md`: Doku zum Datenbankproblem
- `planspotter-problem.md`: Doku zum Bildproblem

## 6. Konfiguration

Die Datei `config.json` steuert den Betrieb.

Aktuelle Felder:

- `apiUrl`: Externe ADS-B Datenquelle
- `port`: Port des Webservers
- `listenon`: Netzwerkadresse zum Lauschen
- `prefixdb`: Log-Praefix Datenbank
- `prefixexpress`: Log-Praefix Server
- `prefixconfig`: Log-Praefix Konfiguration

Beispiel:

```json
{
  "apiUrl": "http://131.169.137.134:8080/data/aircraft.json",
  "port": "3001",
  "listenon": "0.0.0.0",
  "prefixdb": "[DESY-ADSB DATABASE]: ",
  "prefixexpress": "[DESY-ADSB WEBSERVE]: ",
  "prefixconfig": "[DESY-ADSB CONFIG]: "
}
```

Wichtig:

- Ohne `apiUrl` kann `/api/aircraft` nicht arbeiten.
- Wenn `dedupeSeconds` nicht in `config.json` steht, nutzt `server.js` intern 60 Sekunden als Standard.

## 7. Start und Laufzeitverhalten

Beim Start passiert Folgendes:

1. `server.js` liest `config.json`
2. `database.js` stellt sicher, dass der DB-Pfad beschreibbar ist
3. `initDb()` erstellt bei Bedarf die Tabelle `aircraft_history`
4. Erst danach startet Express und lauscht auf Port/Host

Das ist wichtig fuer Stabilitaet: Der Server nimmt erst Requests an, wenn die Datenbank wirklich bereit ist.

## 8. Datenbank im Detail

Die Datenbank ist eine Datei (`stats.db` oder alternativer Pfad per `DB_PATH`).

In `database.js` wird vor dem Oeffnen geprueft:

- Gibt es das Verzeichnis?
- Ist das Verzeichnis beschreibbar?
- Gibt es die Datei?
- Ist die Datei beschreibbar?
- Falls noetig: `chmod 664` auf der Datei

Wenn etwas nicht beschreibbar ist, bricht der Start mit klarer Fehlermeldung ab.

### Tabelle

`aircraft_history` enthält:

- `id`
- `hex`
- `flight`
- `alt_baro`
- `gs`
- `track`
- `lat`
- `lon`
- `squawk`
- `type`
- `manufacturer`
- `photo_url`
- `timestamp`

Jede Sichtung ist ein eigener Datensatz.

## 9. Datenfluss im Backend

Der wichtigste Endpunkt ist `GET /api/aircraft`.

Einfacher Ablauf:

1. Server holt Rohdaten von `config.apiUrl`
2. Fuer sichtbare HEX-Codes werden bekannte Metadaten aus DB gelesen
3. Metadaten werden in den In-Memory-Cache zusammengefuehrt
4. Metadaten werden auf aktuelle Flugzeugobjekte angewendet
5. Antwort wird direkt an den Client gesendet
6. Speichern + externe Anreicherung laufen asynchron im Hintergrund

Dieser Ablauf macht das UI schnell und gleichzeitig stabil.

## 10. Caching und Dedupe

Im Server gibt es zwei wichtige Maps:

- `zuletztGespeichertUm`: merkt pro HEX, wann zuletzt gespeichert wurde
- `flugzeugMetaNachHex`: speichert bekannte Metadaten (Bild, Typ, Hersteller)

### Warum das gut ist

- Vermeidet zu viele doppelte DB-Insert in kurzer Zeit
- Verhindert flackernde Metadaten (z. B. Bild verschwindet)
- Spart externe API-Aufrufe

### Dedupe-Regel

Wenn ein Flugzeug innerhalb des Dedupe-Fensters nochmal kommt, wird nicht erneut gespeichert. Aber Metadaten bleiben trotzdem am Objekt, damit das Frontend stabil bleibt.

## 11. Externe Anreicherung

Es gibt zwei Quellen:

### 11.1 Planespotters

- URL: `https://api.planespotters.net/pub/photos/hex/{hex}`
- Zweck: Bild des Flugzeugs
- Timeout im Code: 30000 ms

### 11.2 HexDB

- URL: `https://hexdb.io/api/v1/aircraft/{hex}`
- Zweck: Typ + Hersteller
- Timeout im Code: 3000 ms

Externe Aufrufe passieren nur, wenn Daten fehlen. Fehler werden geloggt, aber der gesamte Prozess laeuft weiter.

## 12. API-Endpunkte

### `GET /api/aircraft`

Holt aktuelle Flugzeuge, merge't Metadaten, antwortet mit JSON, speichert im Hintergrund.

### `GET /api/aircraft/current`

Liefert reduzierte Daten (Flugnummer, Hoehe, Speed).

### `GET /api/statistics`

Liefert gesammelt:

- Anzahl einzigartiger Flugzeuge
- Top-HEX nach Sichtungen
- Durchschnittshoehe und -geschwindigkeit
- Sichtungen pro Stunde
- Typenverteilung
- Top-Hersteller

### `GET /api/flights/search?flight=...&date=...`

Sucht Flugdaten in `aircraft_history` nach Flugnummer und Datum.

Validierung:

- `flight` erforderlich
- `date` erforderlich

Wenn etwas fehlt: HTTP 400.

### Weitere Routen

- `GET /search` -> `public/search.html`
- Statische Assets unter `/public`
- Chart.js und Adapter werden ueber eigene Pfade ausgeliefert
- Catch-all ohne Dateiendung leitet auf `/?error=notfound`

## 13. Frontend: Live-Karte

Dateien:

- `public/index.html`
- `public/assets/js/script.js`

Was passiert:

1. Leaflet Karte wird geladen
2. Alle 1 Sekunde wird `/api/aircraft` abgefragt
3. Marker werden erstellt/aktualisiert/entfernt
4. Popup zeigt Bild + Daten

Popup zeigt z. B.:

- Flugnummer
- Hoehe (ft + Meter im Tooltip)
- Geschwindigkeit (kts + km/h im Tooltip)
- Typ
- Hersteller
- Squawk

## 14. Frontend: Statistik

Dateien:

- `public/statistics.html`
- `public/assets/js/statistics.js`

Was passiert:

1. Alle 10 Sekunden wird `/api/statistics` abgefragt
2. Kennzahlen werden in Cards angezeigt
3. Diagramme werden neu aufgebaut

Diagrammtypen:

- Linie: Sichtungen pro Stunde
- Balken: Top 5 Flugzeuge
- Doughnut: Flugzeugtypen
- Doughnut: Top 5 Hersteller

## 15. Frontend: Flugsuche

Dateien:

- `public/search.html`
- `public/assets/js/search.js`

Was passiert:

1. User gibt Flugnummer + Datum ein
2. Request an `/api/flights/search`
3. Treffer werden als Route auf Karte gezeigt
4. Tabelle zeigt Zeit, Hoehe, Geschwindigkeit, Kurs

Wenn keine Daten gefunden werden, wird ein klarer Hinweis angezeigt.

## 16. Betrieb, Start und Entwicklung

### Installation

```bash
npm install
```

### Start (Produktion/normal)

```bash
npm start
```

### Start (Entwicklung)

```bash
npm run start:dev
```

### Formatierung

```bash
npm run format
npm run format:check
```

Standardzugriff lokal:

- `http://localhost:3001/`

## 17. Typische Fehler und Loesungen

### 17.1 `SQLITE_READONLY: attempt to write a readonly database`

**Symptom:** Speichern in DB geht nicht.

**Ursachen:**

- Rechte am Verzeichnis/Datei falsch
- Besitzerproblem (zum Beispiel gemischt mit/ohne sudo gestartet)

**Loesung im Projekt:**

- Schreibrechte werden beim Start geprueft (`stelleBeschreibbareDbSicher`)
- Server startet erst nach erfolgreicher `initDb()`
- DB-Pfad kann ueber `DB_PATH` gesetzt werden

### 17.2 Bild erscheint nur kurz oder spaet

**Symptom:** `photo_url` verschwindet zwischen Poll-Zyklen.

**Ursache:** Rohdaten enthalten oft kein Bild, Dedupe verhindert neue Inserts.

**Loesung im Projekt:**

- Metadaten-Cache pro HEX
- DB-Hydration vor API-Response
- Metadaten-Merge auch in Dedupe-Zyklen

### 17.3 Externe API langsam oder down

**Symptom:** Teilweise fehlende Metadaten.

**Loesung:**

- Timeouts aktiv
- Warnungen im Log
- Antwort bleibt trotzdem nutzbar

## 18. Performance und Grenzen

### Was schon gut ist

- Schnellere API-Antwort durch asynchrones Speichern
- Dedupe spart DB-Schreiblast
- Metadaten-Cache reduziert externe Requests

### Grenzen

- SQLite ist einfach, aber bei sehr grossen Datenmengen begrenzt
- Viele externe API-Aufrufe koennen Latenz erzeugen
- DB waechst stetig, wenn viel abgefragt wird

## 19. Sicherheit und Datenschutz

Dieses Projekt verarbeitet technische Flugbewegungsdaten. Trotzdem sind ein paar Regeln wichtig:

- Eingaben immer validieren (teilweise bereits vorhanden)
- Rate-Limiting ergaenzen
- Keine sensiblen Keys in Git speichern
- Logs regelmaessig pruefen

Hinweis: Die Weboberflaeche zeigt externe Bilder an (Planespotters), dadurch entstehen externe Requests.

## 20. Empfehlungen fuer die naechsten Schritte

1. Rate-Limiting fuer API-Endpunkte einbauen
2. Retention-Strategie fuer alte DB-Daten definieren
3. Backoff/Retry fuer externe APIs verbessern
4. Tests fuer Kernfunktionen schreiben
5. Optional bei Wachstum: Umstieg auf Postgres

## 21. Kurze Anleitung fuer neue Entwickler

Wenn du neu in das Projekt kommst:

1. Repo klonen
2. `npm install`
3. `config.json` pruefen (`apiUrl` muss erreichbar sein)
4. `npm start`
5. Im Browser oeffnen:

- `/` fuer Live-Karte
- `/statistics.html` fuer Statistiken
- `/search` fuer Flugsuche

Wenn etwas nicht geht:

- Server-Logs ansehen
- API-URL direkt im Browser testen
- DB-Rechte pruefen

## 22. Glossar

- **ADS-B:** Funkverfahren, bei dem Flugzeuge Daten aussenden
- **HEX:** Eindeutige ICAO-Adresse eines Flugzeugs
- **Dedupe:** Verhindert zu viele doppelte Speicherungen
- **Hydration:** Daten aus DB in aktuelle Objekte nachladen
- **Enrichment:** Zusatzinfos wie Bild/Typ/Hersteller ergaenzen
- **SQLite:** Einfache dateibasierte SQL-Datenbank
- **Leaflet:** JS-Bibliothek fuer Karten
- **Chart.js:** JS-Bibliothek fuer Diagramme

## 23. Zusammenfassung

Der ADS-B Flugzeug-Tracker ist ein gut strukturiertes Full-Stack-Projekt mit klarer Pipeline:

- Rohdaten rein
- Metadaten ergaenzen
- Historie speichern
- Live + Statistik + Suche im Browser darstellen

Die wichtigsten Betriebsprobleme (DB-Rechte und instabile Bilder) wurden technisch sinnvoll geloest. Das System ist damit fuer lokale Nutzung stabil und gut nachvollziehbar.

Wenn du diese Dokumentation als Basis nutzt, kannst du neue Features deutlich schneller und sicherer entwickeln.

## 24. Beispielantworten der API

Damit man die API schneller versteht, sind hier vereinfachte Beispiele.

### Beispiel: `GET /api/aircraft`

```json
{
  "aircraft": [
    {
      "hex": "3c6644",
      "flight": "DLH2LC",
      "lat": 53.61,
      "lon": 9.95,
      "alt_baro": 32000,
      "gs": 460.2,
      "track": 92.5,
      "squawk": "7000",
      "t": "A320",
      "manufacturer": "Airbus",
      "photo_url": "https://..."
    }
  ]
}
```

### Beispiel: `GET /api/statistics`

```json
{
  "uniqueAircraft": 712,
  "topAircraft": [{ "hex": "3c6644", "count": 94 }],
  "averages": {
    "avg_altitude": 24410.2,
    "avg_speed": 371.8
  },
  "sightingsPerHour": [{ "hour": "2026-02-19 11:00:00", "count": 153 }],
  "aircraftTypes": [{ "type": "A320", "count": 201 }],
  "topManufacturers": [{ "manufacturer": "Airbus", "count": 350 }]
}
```

### Beispiel: `GET /api/flights/search`

Aufruf:

```bash
GET /api/flights/search?flight=DLH2LC&date=2026-02-19
```

Antwort:

```json
[
  {
    "timestamp": "2026-02-19 10:14:21",
    "alt_baro": 11800,
    "gs": 228.4,
    "track": 71.2,
    "lat": 53.49,
    "lon": 9.87
  }
]
```

## 25. Betrieb in der Praxis (einfacher Leitfaden)

Wenn das Projekt laenger laufen soll (zum Beispiel auf einem kleinen Server), hilft ein klarer Betriebsablauf.

### Täglicher Kurzcheck

1. Laeuft der Prozess?
2. Ist `/api/aircraft` erreichbar?
3. Wachsen neue Datensaetze in der DB?
4. Zeigt die Karte aktuelle Marker?

### Woechentlicher Check

1. Logdateien auf Fehler pruefen
2. Groesse von `stats.db` ansehen
3. API-Latenz pruefen (fuehlt sich die Karte langsam an?)
4. Stichprobe in Suche und Statistik machen

### Wenn es langsam wird

- Dedupe-Fenster leicht erhoehen
- Polling im Frontend ggf. etwas langsamer setzen
- Alte Daten archivieren oder loeschen
- Perspektivisch auf Postgres wechseln

## 26. Backup und Wiederherstellung

SQLite ist praktisch, weil alles in einer Datei liegt. Das macht Backups einfach.

### Was gesichert werden sollte

- `stats.db`
- `config.json`
- Projektdateien (mindestens `server.js`, `database.js`, `public/`)

### Einfaches Backup-Beispiel

```bash
cp stats.db backups/stats-$(date +%F).db
```

### Restore-Beispiel

```bash
cp backups/stats-2026-02-19.db stats.db
```

Hinweis: Backup und Restore nur machen, wenn kein aktiver Schreibzugriff stattfindet, damit die Datei konsistent bleibt.

## 27. FAQ (haeufige Fragen)

### Warum sehe ich manche Flugzeuge ohne Bild?

Nicht jedes Flugzeug hat ein Bild bei Planespotters. Dann bleibt `photo_url` leer.

### Warum steht bei Flugnummer manchmal \"k. A.\"?

Die Quelle liefert nicht immer eine Flugnummer. Das ist normal.

### Warum ist die Hoehe manchmal leer?

Einige Datensaetze enthalten in diesem Moment keine Hoehe oder keine gueltigen Werte.

### Warum wird die Datenbank schnell gross?

Weil bei laufendem Betrieb viele Sichtungen gespeichert werden. Historie braucht Platz.

### Kann ich das Projekt offline testen?

Ja, wenn `apiUrl` auf eine lokale Quelle zeigt, zum Beispiel einen lokalen dump1090-Endpunkt.

### Kann ich die Daten exportieren?

Ja, ueber SQL-Abfragen oder einen zusaetzlichen Export-Endpunkt (CSV/JSON), den man leicht nachruesten kann.
