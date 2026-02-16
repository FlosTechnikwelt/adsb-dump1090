# ADS-B Flugzeug-Tracker (adsb-dump1090) - Dokumentation

## Zweck und Ziel
Dieses Projekt sammelt Daten von Flugzeugen, die mit ADS-B senden. Die Daten werden mit extra Infos angereichert, in einer SQLite-Datenbank gespeichert und dann per API an ein Web-Frontend geliefert. Ziel ist ein einfacher, lokaler Flight-Tracker mit Live-Ansicht, Statistiken und Flugsuche. Es ist gut fuer Schule, Lernen und kleine Tests.

Das Projekt zeigt, wie man aus Rohdaten eine nutzbare Anwendung baut. Man kann sehen, wie Daten aus dem Luftverkehr ueber einen Server laufen, wie sie gespeichert werden und wie sie am Ende als Karte oder als Diagramm angezeigt werden. Es ist also nicht nur Technik fuer Flugzeuge, sondern auch ein Beispiel fuer Datenverarbeitung und Visualisierung.

## Was ist ADS-B?
ADS-B heisst "Automatic Dependent Surveillance - Broadcast". Flugzeuge schicken dabei automatisch Daten ueber ihre Position und ihren Flugzustand.

- Automatic: Es passiert von allein.
- Dependent: Die Daten kommen z. B. von GPS und Sensoren.
- Surveillance: Es dient der Ueberwachung im Luftverkehr.
- Broadcast: Die Daten werden offen ausgesendet.

Typische ADS-B-Felder sind: ICAO-HEX (eine eindeutige Flugzeug-ID), Position (Lat/Lon), Hoehe, Geschwindigkeit, Kurs, Squawk und Flugnummer. Das sind echte technische Daten, aber sie sind nicht fuer sicherheitskritische Entscheidungen von Laien gedacht. Fuer unser Projekt reichen die Daten aber, um Flugzeuge auf einer Karte zu zeigen und einfache Auswertungen zu machen.

ADS-B ist wichtig, weil es Flugzeuge sichtbarer macht. Auch wenn Radar ausfaellt, koennen viele Daten noch durch ADS-B empfangen werden. Trotzdem gibt es Grenzen, weil ADS-B ein Broadcast ist und nicht alles verschluesselt wird. Deshalb muss man die Daten mit Vorsicht nutzen.

## Wie funktioniert ADS-B (einfach erklaert)
- Ein Transponder bekommt Daten aus GPS und Bord-Systemen.
- Das Flugzeug sendet die Daten regelmaessig, meistens auf 1090 MHz (in den USA manchmal 978 MHz).
- Empfaenger am Boden oder andere Flugzeuge koennen das empfangen.
- ADS-B Out = senden, ADS-B In = empfangen und anzeigen.

In der Praxis sieht es so aus: Ein Flugzeug sendet alle paar Sekunden kleine Datenpakete. Wer einen passenden Empfaenger hat (z. B. mit einem SDR-Stick und dump1090), kann diese Pakete lesen. Daraus kann man dann Position und Bewegung berechnen. Genau diese Idee nutzt das Projekt.

## Wer nutzt ADS-B?
- Flugsicherung (ATC) fuer die Ueberwachung im Luftraum.
- Airlines und Betreiber fuer die Flotte.
- Flughaefen fuer Anflug und Bodenverkehr.
- Forschung, Ausbildung und Hobby-Community.

Fuer Profis ist ADS-B ein wichtiges Werkzeug, aber auch fuer Hobby-Nutzer ist es spannend. Viele Leute bauen sich Empfangsstationen und teilen die Daten. Das Projekt hier kann als kleines eigenes System dienen, das die Daten lokal speichert und auswertet.

## Architekturuebersicht
Das Backend (Node.js/Express) nimmt ADS-B Daten, reichert sie an, speichert sie in SQLite und stellt sie per REST-API bereit. Das Frontend zeigt die Daten als Karte und als Statistiken.

Datenfluss (kurz):
1. Client ruft `/api/aircraft` auf.
2. Der Server holt Daten aus `config.apiUrl`.
3. `recordAircraftData()` reichert die Daten an und speichert sie.
4. Das Frontend zeigt Live-Map und Statistiken.

Man kann sich den Server wie einen Uebersetzer vorstellen: Er nimmt Rohdaten, macht sie sauber, fuegt Infos hinzu und gibt sie so aus, dass die Webseite sie einfach benutzen kann.

## Projektstruktur (wichtige Dateien)
- `server.js` - Server, API-Endpunkte, Datenverarbeitung.
- `database.js` - SQLite-Initialisierung und DB-Zugriff.
- `config.json` - Konfiguration (API-URL, Port, Log-Prefixe).
- `public/` - Frontend (HTML, CSS, JS).
- `stats.db` - SQLite-Datenbank mit Sichtungen.

Dazu kommen weitere Dateien wie `python-script.py`, die zeigen, wie man die API auch fuer andere Ausgaben nutzen kann (z. B. ein ePaper-Display). Das zeigt, dass die API vielseitig ist und nicht nur fuer die Webseite.

## Konfiguration
`config.json` regelt die Datenquelle und den Server.

Beispiel:
```json
{
  "apiUrl": "http://localhost:8080/adsb.json",
  "listenon": "0.0.0.0",
  "port": 3001,
  "dedupeSeconds": 60,
  "prefixexpress": "[WEBSERVE]: ",
  "prefixconfig": "[CONFIG]: ",
  "prefixdb": "[DB]: "
}
```

Hinweise:
- `apiUrl` ist verpflichtend, da keine lokale Datei mehr genutzt wird.
- `dedupeSeconds` reduziert doppelte Eintraege pro HEX.
- Fuer echte Nutzung lieber Umgebungsvariablen verwenden.

Die Konfiguration ist bewusst simpel. Man kann damit schnell testen, ob man die Daten aus einer echten Quelle bekommt oder aus einer lokalen Datei. Fuer den Unterricht oder Demo-Zwecke reicht das sehr gut.

## Datenverarbeitung und Anreicherung
Die Funktion `recordAircraftData()` in `server.js`:
- Geht durch alle Flugzeuge in `data.aircraft`.
- Verhindert zu viele Duplikate in kurzer Zeit (Dedupe-Zeitfenster).
- Holt Fotos von planespotters.net.
- Holt Typ und Hersteller von hexdb.io.
- Speichert alles in `aircraft_history`.

Diese Anreicherung macht die Anzeige besser, z. B. mit Foto, Typ und Hersteller. Wenn eine API nicht antwortet, wird das nur geloggt und der Rest laeuft weiter. Dadurch bleibt der Server stabil.

Ein wichtiger Punkt ist, dass die Datenbank nicht nur Live-Daten speichert, sondern auch eine Historie. So kann man spaeter Statistiken berechnen, zum Beispiel wie viele Flugzeuge in einer Stunde gesehen wurden.

## Datenbank
SQLite-Datei: `stats.db`

Tabelle: `aircraft_history`
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

Jede Sichtung wird als einzelne Zeile gespeichert. Wenn man sehr oft abfragt, waechst die Datenbank schnell. Man kann spaeter Archive bauen oder alte Daten loeschen, damit die Datei nicht zu gross wird.

## API-Endpunkte
- `GET /api/aircraft` - Holt Live-Daten, reichert an, speichert.
- `GET /api/aircraft/current` - Liefert nur Flugnummer, Hoehe, Geschwindigkeit.
- `GET /api/statistics` - Liefert Statistiken (Anzahl, Top-Flugzeuge, Durchschnittswerte).
- `GET /api/flights/search?flight=XXX&date=YYYY-MM-DD` - Sucht Flug nach Datum.

Die API ist so aufgebaut, dass das Frontend einfache JSON-Daten bekommt. Das macht es leicht, die Daten in JavaScript zu verarbeiten. Man kann die API aber auch mit anderen Tools nutzen, zum Beispiel mit Python oder Postman.

## Frontend
- `public/index.html`: Live-Karte mit aktuellen Flugzeugen (Leaflet).
- `public/statistics.html`: Diagramme mit Chart.js.
- `public/search.html`: Flugsuche mit Route.

Das Frontend ist einfach, aber klar: Karte fuer Live, Diagramme fuer Statistik, Suche fuer Details. Leaflet zeigt die Karte, Chart.js macht die Balken- oder Linien-Diagramme. Dadurch wirkt die Anwendung viel professioneller, obwohl sie technisch relativ klein ist.

## Betrieb und Hinweise
- Externe Requests haben Timeouts (z. B. 3s/5s).
- Datenbank waechst bei jedem `GET /api/aircraft`.
- Duplikate werden reduziert, aber nicht komplett verhindert.
- ADS-B Daten koennen manchmal fehlen oder zeitverzoegert sein.

Man sollte auch beachten, dass nicht jedes Flugzeug die Daten gleich schickt. Manche Daten sind unvollstaendig oder leer. Das ist normal. Deshalb arbeitet der Code viel mit optionalen Feldern und faellt auf `null` oder `N/A` zurueck.

## Lokaler Start
1. Abhaengigkeiten installieren:
```bash
npm install
```
2. Server starten:
```bash
node server.js
```
3. Optional im Dev-Modus:
```bash
npx nodemon server.js
```

Wenn der Server laeuft, kann man im Browser `http://localhost:3001` aufrufen und die Karte sehen. Fuer die API kann man `http://localhost:3001/api/aircraft` testen.

## Erweiterungsmoeglichkeiten
- Caching und Backoff fuer externe APIs.
- Rate-Limiting und bessere Input-Validierung.
- Regelmaessige Jobs fuer Datenerfassung.
- Umstieg auf Postgres bei grossem Datenvolumen.
- Export als CSV oder GeoJSON.

Man kann auch ein kleines Dashboard bauen oder die Daten auf einem ePaper-Display anzeigen (siehe `python-script.py`). Das zeigt, wie flexibel die API ist.
