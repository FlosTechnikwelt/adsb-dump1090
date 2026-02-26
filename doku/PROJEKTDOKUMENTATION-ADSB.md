# Projektdokumentation ADS-B Flugzeug-Tracker (adsb-dump1090)

## 1. Einleitung und Ziel des Projekts

Dieses Projekt ist eine Webanwendung zur Erfassung, Anreicherung, Speicherung und Visualisierung von Luftverkehrsdaten auf Basis von ADS-B Signalen. Die Anwendung liest nicht direkt Funkdaten aus einem SDR-Empfaenger, sondern nutzt als Datenquelle eine bereits laufende dump1090-Instanz, die die decodierten Daten als JSON bereitstellt. Daraus entsteht eine klar getrennte Architektur: Signalverarbeitung und Decodierung passieren in dump1090, waehrend dieses Projekt die Daten weiterverarbeitet und fuer Nutzerinnen und Nutzer aufbereitet.

Das zentrale Ziel ist, aus kurzlebigen Echtzeitdaten ein nutzbares Informationssystem zu machen. Rohdaten, die sonst nur fuer wenige Sekunden sichtbar waeren, werden dauerhaft in einer SQLite-Datenbank archiviert. Auf dieser Basis koennen danach Statistiken erstellt, historische Fluege durchsucht und Kartenansichten aufgebaut werden.

Die Anwendung hat drei Hauptfunktionen:

1. Live-Karte mit aktuellen Flugzeugen im Empfangsbereich.
2. Statistikansicht mit aggregierten Kennzahlen, Typ- und Herstellerverteilungen.
3. Flugsuche fuer historische Bewegungen anhand von Flugnummer und Datum.

Damit ist das Projekt sowohl fuer Demo- und Lernzwecke als auch fuer praktische lokale Beobachtung von Luftverkehr geeignet.

## 2. Was ist ADS-B?

ADS-B steht fuer "Automatic Dependent Surveillance - Broadcast". Es handelt sich um ein Ueberwachungsverfahren in der Luftfahrt, bei dem Flugzeuge ihre Position und weitere Flugdaten regelmaessig selbst aussenden.

- Automatic: Die Aussendung erfolgt automatisch, ohne manuelle Eingabe im laufenden Betrieb.
- Dependent: Die Genauigkeit haengt von Bordnavigationssystemen ab (vor allem GNSS/GPS).
- Surveillance: Die Daten dienen der Luftraumueberwachung.
- Broadcast: Die Information wird offen ausgesendet und kann von beliebigen Empfaengern im Empfangsbereich gelesen werden.

Typische Inhalte von ADS-B Meldungen sind:

- ICAO HEX-Adresse (eindeutige Kennung des Luftfahrzeugs)
- Callsign bzw. Flugnummer
- Position (Breite, Laenge)
- Hoehe
- Geschwindigkeit und Kurs
- Squawk bzw. Transpondercode

Fuer zivile Luftfahrt ist ADS-B heute ein zentraler Baustein moderner Surveillance-Systeme. Im Gegensatz zu klassischem Radar kommt ein grosser Teil der Positionsinformation direkt vom Flugzeug selbst.

## 3. Wie funktioniert ADS-B technisch?

In der Praxis empfangen Bodenstationen Signale auf 1090 MHz (Mode S Extended Squitter, oft als 1090ES bezeichnet). Flugzeuge senden in kurzen Intervallen Telegramme, die vom Empfaenger aufgezeichnet und decodiert werden.

Die technische Kette sieht vereinfacht so aus:

1. Das Flugzeug bestimmt seine Position ueber GNSS.
2. Der Transponder erzeugt ADS-B Nachrichten mit Identitaets- und Bewegungsdaten.
3. Die Nachricht wird ueber 1090 MHz ausgesendet.
4. Ein lokaler Empfaenger (z. B. SDR-Dongle plus Antenne) nimmt das Signal auf.
5. Eine Software wie dump1090 decodiert die Bits in strukturierte Datensaetze.
6. Andere Systeme (wie dieses Projekt) konsumieren diese Datensaetze ueber HTTP/JSON.

Wichtig ist: ADS-B ist eine Broadcast-Technik ohne klassischen Session-Aufbau. Daher sind die Daten leicht nutzbar, aber auch nicht automatisch authentifiziert. Fuer Visualisierung und lokale Lagebilder ist das ideal, fuer sicherheitskritische Entscheidungen gelten in der Luftfahrt weitere Schutz- und Plausibilitaetsmechanismen.

## 4. Wer nutzt ADS-B?

ADS-B Daten werden von unterschiedlichen Gruppen genutzt, allerdings mit unterschiedlichen Zielen:

1. Flugsicherung und Regulatorik
   Viele Staaten setzen ADS-B in die Ueberwachung des Luftraums ein. Je nach Region ist ADS-B Out fuer viele Luftfahrzeuge verpflichtend.

2. Flughäfen und Betreiber
   Bodenprozesse, Verkehrslast, Ankunfts- und Abfluganalysen koennen mit ADS-B Daten unterstuetzt werden.

3. Airlines und Wartung
   Airlines nutzen Flugbewegungsdaten fuer operative Auswertungen, Performance-Analysen und Monitoring.

4. Forschung und Hochschulen
   Luftverkehrsforschung, Umweltdatenkorrelation, Laermanalysen oder algorithmische Experimente bauen oft auf ADS-B auf.

5. Enthusiasten und Plane Spotter
   Privatpersonen mit SDR-Empfaengern, lokalen Dashboards und Community-Netzwerken verwenden ADS-B fuer Live-Tracking.

6. Softwareprojekte wie dieses
   Das hier vorliegende Projekt ist ein typischer "Data Product"-Ansatz: Daten werden nicht nur angezeigt, sondern archiviert, angereichert und als API bereitgestellt.

## 5. Zusammenhang zwischen ADS-B und dump1090

dump1090 ist in diesem Projekt die Bruecke zwischen Rohfunksignal und Webanwendung. Ohne dump1090 muesste dieses Projekt selbst Signalverarbeitung, Demodulation und ADS-B Decoding implementieren. Das waere deutlich komplexer.

Die konkrete Aufgabenteilung ist:

- dump1090: Empfang und Decodierung der 1090-MHz-Signale, Bereitstellung als JSON.
- dieses Projekt: Abruf der JSON-Daten ueber `apiUrl`, Speicherung in SQLite, Anreicherung (Fotos/Typ/Hersteller), Visualisierung und Suchfunktionen.

In `config.json` ist als Quelle `http://131.169.137.134:8080/data/aircraft.json` eingetragen. Das ist der Endpunkt, den der Express-Server ueber `axios` regelmaessig beim API-Aufruf abfragt.

Das bedeutet auch: Wenn dump1090 keine Daten liefert oder die URL nicht erreichbar ist, kann die Live-Karte keine aktuellen Daten anzeigen. Die historischen Daten in SQLite bleiben aber weiterhin verfuegbar.

## 6. Architektur des Projekts

Die Architektur ist bewusst schlank gehalten und besteht aus vier Schichten:

1. Datenquelle (extern)
   Dump1090 JSON-Endpoint liefert aktuelle Flugzeugdaten (`aircraft` Array).

2. Backend (Node.js + Express)
   `server.js` stellt API-Endpunkte bereit, ruft externe Daten ab, fuehrt Anreicherung aus und schreibt in die Datenbank.

3. Datenhaltung (SQLite)
   `database.js` initialisiert die Datenbankdatei und Tabelle `aircraft_history`.

4. Frontend (statische Dateien)
   `public/` enthaelt HTML/CSS/JS fuer Live-Karte, Statistiken und Suche.

Der Server liefert sowohl APIs (`/api/...`) als auch statische Inhalte (`/`, `/search`, `/statistics.html`) aus.

## 7. Code-Funktionsweise im Detail

### 7.1 `database.js`

`database.js` sorgt fuer die robuste Initialisierung der SQLite-Datenbank:

- Liest Konfiguration und optional `DB_PATH` aus Environment.
- Erzeugt Verzeichnis und Datei, falls nicht vorhanden.
- Prueft Schreibrechte und versucht bei Bedarf `chmod`.
- Oeffnet SQLite-Verbindung.
- Erstellt mit `CREATE TABLE IF NOT EXISTS` die Tabelle `aircraft_history`.

Die Tabelle enthaelt:

- `id` (Autoincrement PK)
- `hex` (nicht null)
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
- `timestamp` (Default `CURRENT_TIMESTAMP`)

Exportiert werden `db` (aktive Verbindung) und `initDb()` (Promise-basierte Initialisierung).

### 7.2 `server.js`

`server.js` ist das Herzstueck der Anwendung.

Beim Start:

1. Konfiguration aus `config.json` laden.
2. Deduplizierungsfenster ermitteln (`dedupeSeconds`, Standard 60 Sekunden).
3. Hilfsstrukturen aufbauen:
   - `zuletztGespeichertUm` (Map fuer Dedupe pro HEX)
   - `flugzeugMetaNachHex` (Cache fuer Typ/Hersteller/Foto)
4. Datenbank initialisieren (`await initDb()`)
5. Express-Server starten.

Wesentliche interne Funktionen:

- `dbAlle(...)`: Promise-Wrapper um `db.all`.
- `fuehreFlugzeugMetaZusammen(...)`: kombiniert neue und vorhandene Metadaten im Cache.
- `wendeFlugzeugMetaAn(...)`: uebernimmt gecachte Meta in ein aktuelles Flugzeugobjekt.
- `ladeFlugzeugMetaAusDb(...)`: liest zuletzt bekannte Meta zu aktuellen HEX-Codes aus SQLite.
- `speichereFlugzeugDaten(...)`: Dedupe, externe Anreicherung, Insert in DB.

Diese Trennung macht den Code besser wartbar: Caching, DB-Lesen und DB-Schreiben sind logisch aufgeteilt.

### 7.3 API-Endpunkte

`GET /api/aircraft`

- Holt Live-Daten ueber `axios` von `apiUrl`.
- Laedt Metadaten fuer sichtbare HEX-Codes aus DB.
- Wendet Metadaten auf Antwortdaten an.
- Antwortet sofort mit JSON an den Client.
- Startet danach asynchron das Speichern/Anreichern in der DB.

Der wichtige Designpunkt hier: Die API-Antwort an den Browser wartet nicht auf jede externe Metaanfrage. Das verbessert die Reaktionszeit.

`GET /api/aircraft/current`

- Holt ebenfalls `apiUrl`.
- Liefert nur reduzierte Felder (`flight`, `altitude`, `speed`).
- Eignet sich fuer kompakte UIs oder Widgets.

`GET /api/statistics`

- Fuehrt mehrere SQL-Abfragen parallel mit `Promise.all` aus.
- Liefert u. a.:
  - Anzahl einzigartiger HEX-Codes
  - Top 5 Flugzeuge nach Sichtungen
  - Durchschnittshoehe und -geschwindigkeit
  - Sichtungen pro Stunde
  - Verteilung von Flugzeugtypen
  - Top 5 Hersteller

`GET /api/flights/search?flight=...&date=YYYY-MM-DD`

- Validiert Pflichtparameter `flight` und `date`.
- Sucht in SQLite per `trim(flight)=?` und `date(timestamp)=?`.
- Gibt Treffer chronologisch sortiert zurueck.

### 7.4 Statische Auslieferung

- `express.static(public)` liefert HTML/CSS/JS.
- Chart.js und Date-Adapter werden gezielt aus `node_modules` unter `/scripts/...` bereitgestellt.
- Route `/search` liefert `search.html`.
- Fallback fuer unbekannte Routen redirectet auf `/?error=notfound`.

## 8. Datenablaeufe end-to-end

### 8.1 Live-Datenfluss

1. Browser auf `index.html` startet `public/assets/js/script.js`.
2. `script.js` ruft jede Sekunde `/api/aircraft` auf.
3. Backend fragt externe dump1090-Quelle an.
4. Backend gibt Antwort an Browser zurueck.
5. Frontend aktualisiert Marker auf der Leaflet-Karte.
6. Nicht mehr sichtbare HEX-Marker werden entfernt.

Das Ergebnis ist ein quasi-realtime Lagebild.

### 8.2 Persistenz- und Anreicherungsfluss

Parallel zur API-Antwort laeuft im Backend:

1. Pro Flugzeug Dedupe-Pruefung (HEX + Zeitfenster).
2. Falls noetig Foto von planespotters.net (`photo_url`).
3. Falls Typ fehlt, Anfrage an hexdb.io (`type`, `manufacturer`).
4. Updaten des In-Memory-Metacaches.
5. `INSERT` in `aircraft_history`.

Wichtig: Es gibt aktuell kein Upsert auf "gleicher Zustand". Das ist bewusst historisch orientiert, fuehrt aber zu stetigem Datenwachstum.

### 8.3 Statistikfluss

1. Statistikseite ruft alle 10 Sekunden `/api/statistics` auf.
2. Backend aggregiert SQL-Daten.
3. Frontend zeichnet Charts mit Chart.js neu.

### 8.4 Suchfluss

1. Nutzer gibt Flugnummer und Datum ein.
2. Frontend ruft `/api/flights/search`.
3. Backend liefert chronologische Punkte.
4. Frontend baut Polyline plus Start-/Endmarker in Leaflet.
5. Parallel zeigt Tabelle Zeit, Hoehe, Geschwindigkeit, Kurs.

## 9. Frontend-Funktionsweise

### 9.1 Live-Karte (`script.js`)

- Leaflet-Karte auf DESY Hamburg zentriert.
- CartoDB Light Tiles als Hintergrund.
- Benutzerdefiniertes SVG-Flugzeugicon in DESY-Farben.
- Marker-Rotation ueber `leaflet-rotatedmarker` anhand `track`.
- Popup mit:
  - Bild (falls vorhanden)
  - Flugnummer
  - Hoehe (ft + m als Tooltip)
  - Geschwindigkeit (kts + km/h als Tooltip)
  - Typ, Hersteller, Squawk

Das Frontend fuehrt keine komplexe Businesslogik aus, sondern stellt API-Daten performant dar.

### 9.2 Statistikseite (`statistics.js`)

- Holt JSON-Statistiken.
- Fuellt KPI-Karten (unique aircraft, average altitude/speed, haeufigster Typ).
- Erstellt vier Diagrammtypen:
  - Linie (Sichtungen pro Stunde)
  - Balken (Top 5 HEX)
  - Doughnut (Flugzeugtypen)
  - Doughnut (Top Hersteller)

Bestehende Diagramme werden vor Neuzeichnung mit `.destroy()` aufgeloest, um Renderingfehler und Speicherlecks zu vermeiden.

### 9.3 Suchseite (`search.js`)

- Formular mit Datum (Default: heute) und Flugnummer.
- API-Aufruf mit URL-encodierter Flugnummer.
- Ergebnisdarstellung:
  - Karte mit Flugspur
  - Start- und Endmarker
  - Tabelle aller Messpunkte

Damit ist die Seite gut fuer einfache historische Rekonstruktion geeignet.

## 10. Welche Datenbank wird genutzt?

Genutzt wird eine lokale SQLite-Datenbank (`sqlite3` Package), standardmaessig als Datei `stats.db` im Projektverzeichnis.

Vorteile fuer dieses Projekt:

- Kein separater DB-Server noetig.
- Einfacher Betrieb lokal oder auf kleinem Server.
- Gute Eignung fuer kleine bis mittlere Datenmengen.
- Schneller Start fuer Prototyping und interne Tools.

Trade-offs:

- Schreiblast und Parallelitaet sind begrenzter als bei Postgres/MySQL.
- Ohne Archivierung waechst die Datei stetig.
- Fuer sehr hohe Abrufraten sollte spaeter ueber Indizes, Retention oder DB-Wechsel nachgedacht werden.

## 11. Welche Packages werden genutzt?

Aus `package.json` ergeben sich folgende Kernabhaengigkeiten:

1. `express`
   HTTP-Server, Routing, statische Dateien, API-Endpunkte.

2. `axios`
   HTTP-Client fuer externe API-Aufrufe (dump1090, planespotters, hexdb).

3. `sqlite3`
   Treiber fuer SQLite-Verbindung und SQL-Operationen.

4. `chart.js`
   Visualisierung von Statistikdaten in der Weboberflaeche.

5. `chartjs-adapter-date-fns`
   Zeitachsen-Adapter fuer Chart.js.

6. `date-fns`
   Datumshilfen fuer Adapter/Frontend.

Dev-Dependencies:

- `nodemon`: Entwicklungsserver mit Auto-Restart.
- `prettier`: Formatierung des Quellcodes.

Zusatzbibliotheken via CDN im Frontend:

- Bootstrap 5.3.2 (Layout/UI)
- Leaflet 1.9.4 (Karten)
- Leaflet Rotated Marker Plugin (Ausrichtung der Flugzeugsymbole)

## 12. Qualitaetsmerkmale, Grenzen und Verbesserungen

### 12.1 Bereits gut geloest

- Saubere Trennung von DB-Modul und Servermodul.
- Sinnvolle Nutzung von Caches (`Map`) fuer Metadaten.
- Deduplizierung per Zeitfenster reduziert unnoetige Inserts.
- Fehler bei externen APIs werden geloggt und blockieren den Gesamtfluss nicht.
- Frontend ist klar in drei Seiten mit separater Logik getrennt.

### 12.2 Aktuelle Grenzen

- Keine Authentifizierung/Autorisierung (lokales Tool, aber oeffentliche Exponierung waere riskant).
- Externe APIs koennen langsam sein oder Limits haben.
- Keine Retention-Policy fuer alte Datensaetze.
- Keine dedizierten DB-Indizes fuer Suchabfragen (`flight`, `timestamp`).
- Keine automatisierten Tests im Repository.

### 12.3 Sinnvolle naechste Schritte

1. SQL-Indizes einfuehren (`hex`, `flight`, `timestamp`) fuer bessere Such- und Statistikperformance.
2. Retention-Konzept (z. B. nur letzte N Monate) oder Archivtabellen.
3. Optionale Queue/Bulk-Inserts fuer hoehere Last.
4. Rate-Limit und Circuit-Breaker fuer externe Metadaten-APIs.
5. Testabdeckung fuer API-Endpunkte und DB-Queries.
6. Optional Migration auf Postgres bei stark wachsendem Datenvolumen.

## 13. Zusammenfassung

Das Projekt zeigt eine praxisnahe und gut nachvollziehbare ADS-B Datenpipeline: Von der durch dump1090 gelieferten Echtzeitquelle ueber Anreicherung und Persistenz bis hin zur Visualisierung im Browser. ADS-B liefert dabei den inhaltlichen Kern (Positions- und Bewegungsdaten), dump1090 uebernimmt die Decodierung aus dem Funksignal, und die vorliegende Anwendung macht aus diesen Daten ein nutzbares Informationssystem mit historischem Mehrwert.

Technisch ist die Loesung bewusst pragmatisch: Node.js/Express fuer API und Auslieferung, SQLite fuer einfache lokale Speicherung, und ein leichtgewichtiges Frontend mit Leaflet und Chart.js fuer Karte und Analytik. Gerade fuer Forschung, Ausbildung, interne Demonstrationen oder lokale Beobachtung ist diese Kombination sehr geeignet, weil sie schnell lauffaehig ist und wenig Infrastruktur benoetigt.

Durch die vorhandene Struktur laesst sich das System stufenweise weiterentwickeln. Mit Indizes, Datenaufbewahrung, Tests und optionaler Skalierung der Datenhaltung kann aus dem aktuellen Stand ohne Architekturbruch ein stabiler, laengerfristig betreibbarer Flugdatenservice werden.
