# Ausfuehrliche Projektdokumentation

## ADS-B Flugzeug-Tracker auf Basis von dump1090

## 1. Zielsetzung und Projektkontext

Dieses Projekt ist eine vollstaendige Datenpipeline fuer lokale Luftverkehrsbeobachtung. Im Mittelpunkt steht die Verarbeitung von ADS-B Daten, die von einer dump1090 Instanz bereitgestellt werden. Die Anwendung uebernimmt nicht die Funkdecodierung selbst, sondern baut auf einer bestehenden, spezialisierten Empfangs- und Decoderkette auf und transformiert die Daten in ein nutzbares Web-Produkt.

Der wesentliche Mehrwert liegt in drei Punkten:

1. Live-Sichtbarkeit des Luftverkehrs im Browser.
2. Historisierung von ansonsten fluechtigen Echtzeitdaten.
3. Analytische Auswertung und gezielte historische Suche.

Dadurch wird aus einem reinen Signalstrom ein Informationssystem, das auch im Nachhinein nutzbar ist. Ein einzelner Live-Frame von dump1090 ist nur eine Momentaufnahme; die lokale Datenbank in diesem Projekt macht Trends, Wiederholungen, Typverteilungen und konkrete Flugverlaeufe auswertbar.

## 2. ADS-B Grundlagen

ADS-B bedeutet "Automatic Dependent Surveillance - Broadcast" und ist ein modernes Verfahren zur Luftraumueberwachung.

- Automatic: Das Luftfahrzeug sendet die Daten automatisch.
- Dependent: Die Datenqualitaet haengt von bordeigenen Navigationssystemen (GNSS/GPS) ab.
- Surveillance: Die Daten dienen der Verkehrslagebeobachtung.
- Broadcast: Die Meldungen werden offen ausgesendet und koennen von kompatiblen Empfaengern empfangen werden.

Typische ADS-B Inhalte sind:

- ICAO HEX Kennung (eindeutige Luftfahrzeugadresse)
- Callsign bzw. Flugnummer
- Position (lat/lon)
- Hoehe
- Geschwindigkeit
- Kurs
- Squawk/Transpondercode

ADS-B ist heute in grossen Teilen der zivilen Luftfahrt etabliert. Die Position stammt direkt aus der Luftfahrzeugnavigation und wird regelmaessig ausgestrahlt. Dadurch entsteht gegenueber klassischer Radarverfolgung eine sehr dichte, kosteneffiziente Datengrundlage.

## 3. Technischer Hintergrund der Signalstrecke

Die praktische Funkebene laeuft typischerweise ueber 1090 MHz (Mode S Extended Squitter). Ein Flugzeug sendet Telegramme in kurzen Intervallen. Ein Bodenempfaenger erfasst diese Aussendungen, und Decoder-Software wandelt die Rohbits in strukturierte Daten um.

Vereinfachte End-to-End Kette:

1. Flugzeug bestimmt Position und Bewegungswerte.
2. Transponder sendet ADS-B Nachricht auf 1090 MHz.
3. Lokaler Empfaenger (Antenne + SDR) erfasst das Signal.
4. dump1090 decodiert und erzeugt JSON.
5. Dieser Tracker ruft JSON ueber HTTP ab.
6. Daten werden angereichert, gespeichert, visualisiert und statistisch ausgewertet.

Die Trennung der Verantwortlichkeiten ist hier entscheidend. Sie reduziert die Komplexitaet im Tracker-Projekt stark, weil DSP- und Decoderdetails bereits in dump1090 geloest sind.

## 4. Wer ADS-B Daten nutzt

ADS-B Daten werden in unterschiedlichen Rollen verwendet:

1. Flugsicherung und Regulatorik
   Zur Luftraumlage, Routenbeobachtung und Betriebssicherheit.

2. Airlines und Flughafenbetrieb
   Fuer Monitoring, Abfertigungsplanung, Auslastungsanalysen, Operational Intelligence.

3. Forschung und Wissenschaft
   Fuer Verkehrsanalysen, Emissions- und Laermstudien, Modellierung und Data Science.

4. Enthusiasten und Spotter
   Fuer lokale Beobachtung, Fotoplanung und Community-Netzwerke.

5. Interne technische Dashboards
   Fuer Lern-, Demo- oder Monitoringzwecke in Organisationen.

Dieses Projekt gehoert zur letzten Kategorie mit starkem Lehr- und Nutzwert: Es kombiniert Live-Daten, Historie und Auswertung in einer kompakten Architektur.

## 5. Zusammenhang zu dump1090

dump1090 ist in dieser Architektur die Primarquelle. Die Anwendung greift auf eine `aircraft.json`-Quelle zu, in deinem Fall konfiguriert in `config.json`.

Konfigurierter Endpunkt:

- `apiUrl`: `http://131.169.137.134:8080/data/aircraft.json`

Aufgabenteilung:

- dump1090: Empfang und Decodierung von ADS-B.
- Tracker (dieses Projekt): Datenabruf, Caching, Persistenz, Statistiken, Suche, UI.

Wenn die dump1090 Quelle kurzzeitig nicht erreichbar ist, betrifft das die Live-Datenversorgung. Bereits gespeicherte historische Daten bleiben dennoch fuer Statistik und Suche verfuegbar.

## 6. Gesamtarchitektur des Projekts

Die Architektur besteht aus vier klar getrennten Ebenen:

1. Externe Datenquelle
   Dump1090 JSON Feed mit aktuellem Luftlagebild.

2. Backend-Service
   Node.js + Express in `server.js`, inklusive API-Endpunkte und Datenmanagement.

3. Datenhaltung
   SQLite in `stats.db`, initialisiert durch `database.js`.

4. Frontend
   Statische Seiten in `public/` mit Leaflet fuer Karten und Chart.js fuer Diagramme.

Die Kombination ist bewusst pragmatisch: geringer Betriebsaufwand, schnelle Deploybarkeit, trotzdem durchgaengiger Datenfluss von Quelle bis Analyse.

## 7. Detaillierte Analyse: `database.js`

`database.js` uebernimmt Verbindungs- und Dateisystemrobustheit fuer SQLite.

### 7.1 Pfadlogik

- Nutzt `DB_PATH` (Environment) oder `dbPath` aus `config.json`.
- Fallback ist `stats.db` im Projektverzeichnis.

Das ist sinnvoll fuer zwei Betriebsmodi:

- Lokal/Entwicklung: Standarddatei im Repo.
- Produktion/Container: konfigurierter Speicherpfad.

### 7.2 Schreibbarkeitspruefung

Vor dem Oeffnen der Datenbank wird sichergestellt:

1. Zielverzeichnis existiert (`mkdir -p` Verhalten).
2. Verzeichnis ist beschreibbar.
3. Datei existiert, falls noetig anlegen.
4. Datei ist beschreibbar, ansonsten `chmod` Versuch.

Dieser Schritt verhindert klassische Startfehler durch Berechtigungsprobleme.

### 7.3 Tabelleninitialisierung

`initDb()` erstellt die Tabelle `aircraft_history` bei Bedarf.

Schema:

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `hex TEXT NOT NULL`
- `flight TEXT`
- `alt_baro INTEGER`
- `gs REAL`
- `track REAL`
- `lat REAL`
- `lon REAL`
- `squawk TEXT`
- `type TEXT`
- `manufacturer TEXT`
- `photo_url TEXT`
- `timestamp DATETIME DEFAULT CURRENT_TIMESTAMP`

Wichtig: Das Modell ist write-optimized fuer Historisierung. Jede Sichtung ist eine eigenstaendige Zeile.

## 8. Detaillierte Analyse: `server.js`

`server.js` implementiert Konfiguration, Datenabruf, Metadatenanreicherung, Speicherung, Statistik und Routen.

### 8.1 Konfigurationsstart

Beim Start wird `config.json` gelesen. Falls die Datei fehlt oder ungueltig ist, loggt der Server eine Warnung. Ohne `apiUrl` koennen Live-Endpunkte nicht arbeiten.

Wesentliche Konfigurationsfelder:

- `apiUrl`
- `port`
- `listenon`
- Logging-Praefixe (`prefixexpress`, `prefixconfig`, `prefixdb`)

### 8.2 Deduplizierung

Es gibt ein Deduplizierungsfenster pro HEX-Adresse:

- Konfigurierbar ueber `dedupeSeconds`
- Standard 60 Sekunden
- Implementiert ueber Map `zuletztGespeichertUm`

Nutzen:

- Reduziert redundante Datenpunkte bei hoher Polling-Frequenz.
- Schont Datenbankgroesse und I/O.

### 8.3 Metadaten-Cache

Map `flugzeugMetaNachHex` speichert bekannte Werte:

- `photo_url`
- `type`
- `manufacturer`

Dadurch muessen externe Metadienste nicht bei jedem Frame neu abgefragt werden. Das senkt Latenz, Last und Ausfallwirkung externer Services.

### 8.4 Metadaten aus der DB laden

`ladeFlugzeugMetaAusDb(flugzeugListe)`:

1. Sammelt aktuelle HEX-Codes aus der Live-Liste.
2. Fragt `aircraft_history` nach vorhandenen Metaeintraegen.
3. Uebernimmt gefundene Daten in den In-Memory Cache.

Das ist eine clevere Bruecke zwischen persistenter Historie und Live-Darstellung.

### 8.5 Datenanreicherung und Persistenz

`speichereFlugzeugDaten()` ist die zentrale Pipeline:

1. Fuer jedes Flugzeug: Cache anwenden.
2. Dedupe pruefen.
3. Optional Fotoabruf bei planespotters.net.
4. Optional Typ/Hersteller bei hexdb.io.
5. Cache aktualisieren.
6. Insert in SQLite.

External Calls:

- Photo API: `https://api.planespotters.net/pub/photos/hex/{hex}`
- Type API: `https://hexdb.io/api/v1/aircraft/{hex}`

Time-outs:

- planespotters: 30000 ms
- hexdb: 3000 ms

Fehlerbehandlung:

- Externe Fehler werden geloggt, blockieren aber nicht den Gesamtprozess.
- Bei fehlenden Werten werden Felder als `null` gespeichert.

## 9. API-Endpunkte und Semantik

### 9.1 `GET /api/aircraft`

Zweck:

- Liefert aktuelle Luftfahrzeugdaten fuer die Live-Karte.

Ablauf:

1. Externen Feed via `axios` abrufen.
2. Metadaten aus DB nachladen.
3. Metadaten auf aktuelle Objekte anwenden.
4. Sofortige JSON-Antwort an den Client.
5. Asynchrone Persistenz starten.

Designvorteil:

- Frontend bekommt schnelle Antwort.
- Persistenz laeuft entkoppelt im Hintergrund.

### 9.2 `GET /api/aircraft/current`

Liefert reduzierte Felder (`flight`, `altitude`, `speed`).
Nutzbar fuer sparsame UI-Widgets.

### 9.3 `GET /api/statistics`

Parallelisierte SQL-Queries mit `Promise.all` erzeugen:

- `uniqueAircraft`: Count Distinct HEX
- `topAircraft`: Top 5 HEX nach Sichtungen
- `averages`: Durchschnittshoehe/-speed
- `sightingsPerHour`: Bucket pro Stunde
- `aircraftTypes`: Typverteilung
- `topManufacturers`: Hersteller Top 5

### 9.4 `GET /api/flights/search`

Queryparameter:

- `flight` (Pflicht)
- `date` (Pflicht, `YYYY-MM-DD`)

SQL:

- Exakte Callsign-Pruefung via `trim(flight)`
- Datumsfilter via `date(timestamp)`
- Sortierung chronologisch

Output:

- Alle passenden Messpunkte fuer Kartenroute und Tabellenansicht.

## 10. Frontendstruktur und Interaktion

### 10.1 `public/index.html` + `script.js`

Live-Karte:

- Leaflet Map mit CARTO Light Basemap.
- Marker pro HEX mit Rotation nach Track.
- Popup mit Bild, Callsign, Hoehe, Speed, Typ, Hersteller, Squawk.
- Pollingintervall: 1 Sekunde.

Marker-Lifecycle:

1. Neue HEX => Marker erstellen.
2. Bestehende HEX => Position/Rotation/Popup aktualisieren.
3. Nicht mehr sichtbar => Marker entfernen.

### 10.2 `public/statistics.html` + `statistics.js`

Statistikseite:

- Pollingintervall: 10 Sekunden.
- KPI-Karten fuer Kernkennzahlen.
- 4 Diagrammtypen via Chart.js.
- Vor jedem Redraw: altes Chart `destroy()`.

Vorteil:

- Stabiler Redraw ohne Canvas-Ueberlagerung oder Memory-Wachstum.

### 10.3 `public/search.html` + `search.js`

Suche:

- Formular mit Flugnummer + Datum.
- Treffer als Polyline + Start/End-Marker.
- Punktliste als Tabelle (Zeit, Hoehe, Geschwindigkeit, Kurs).

Ohne Positionsdaten wird auf Defaultkarte zentriert.

## 11. Datenfluss im Betrieb (Runtime View)

### 11.1 Live-Betrieb

1. Browser ruft `/api/aircraft` auf.
2. Server holt dump1090 Daten.
3. Server liefert JSON an Client.
4. Client aktualisiert Karte.
5. Server persistiert im Hintergrund.

### 11.2 Historisierung

1. Sichtung kommt vom Feed.
2. Dedupe entscheidet ueber Schreiben.
3. Metadaten werden ggf. angereichert.
4. Zeile wird in `aircraft_history` geschrieben.

### 11.3 Analyse

1. Statistikseite ruft Aggregatendpunkt.
2. SQL gruppiert und mittelt.
3. Charts visualisieren Ergebnisse.

### 11.4 Historische Rekonstruktion

1. User sucht Callsign + Datum.
2. Backend liefert Zeitreihe.
3. Frontend zeichnet Flugverlauf.

## 12. Datenbank und Abfragen im Detail

Genutzte DB:

- SQLite (`stats.db`)

Gruende:

- Minimaler Betriebsaufwand
- Lokale Robustheit
- Kein separater DB-Dienst

Wichtige Querytypen:

1. Distinct-Count (`COUNT(DISTINCT hex)`)
2. Ranking (`GROUP BY ... ORDER BY count DESC LIMIT ...`)
3. Durchschnitt (`AVG(...)`)
4. Zeitaggregation (`strftime('%Y-%m-%d %H:00:00', timestamp)`)
5. Filter by flight/date fuer Suchfunktion

Performance-Hinweis:

Bei wachsender Datenmenge profitieren insbesondere diese Spalten von Indizes:

- `hex`
- `timestamp`
- `flight`

## 13. Verwendete Packages und deren Rolle

### 13.1 Produktionsabhaengigkeiten

1. `express`
   Webserver, API-Routing, statische Auslieferung.

2. `axios`
   HTTP-Client fuer externe Datenquellen und Metadienste.

3. `sqlite3`
   SQLite Treiber fuer Read/Write/Schema.

4. `chart.js`
   Diagrammengine im Frontend.

5. `chartjs-adapter-date-fns`
   Zeitachsenintegration fuer Chart.js.

6. `date-fns`
   Datumsutilities fuer den Chart-Adapter.

### 13.2 Dev-Abhaengigkeiten

1. `nodemon`
   Entwicklungsbetrieb mit Auto-Restart.

2. `prettier`
   Einheitliche Codeformatierung.

### 13.3 CDN-Bibliotheken

1. Bootstrap
   Layout und responsive Komponenten.

2. Leaflet
   Interaktive Kartenansicht.

3. Leaflet Rotated Marker Plugin
   Ausrichtung der Flugzeugmarker anhand Kurs.

## 14. Konfiguration und Deployment-Aspekte

Datei `config.json` steuert Laufzeitparameter.

Aktuelle Kernwerte:

- `apiUrl`: externe Feedquelle
- `port`: `3001`
- `listenon`: `0.0.0.0`

Bedeutung:

- App ist netzwerkweit auf dem Host erreichbar, nicht nur localhost.
- Fuer produktive Umgebungen sollten Zugriffsgrenzen (Firewall/Proxy) gesetzt werden.

Sinnvolle Erweiterungen:

1. Zus. Konfig fuer Pollingfrequenz.
2. Schalter fuer externe Enrichment-Services.
3. API Key Support fuer ratelimitierte Anbieter.
4. Retention-Dauer als Konfigparameter.

## 15. Robustheit, Fehlerverhalten und Betrieb

### 15.1 Positiv

- Defensives Verhalten bei API-Ausfaellen.
- Keine harten Abhaengigkeiten auf Enrichment-APIs fuer Grundfunktion.
- Trennung von Antwortzeit und Hintergrundspeicherung.
- DB Init vor Serverstart vermeidet Laufzeitfehler nach außen.

### 15.2 Risiken

- Hohe Pollingrate kann bei grossen Luftlagen Last erzeugen.
- Externe Services koennen langsam oder instabil sein.
- Ohne Datenaufbewahrungsstrategie waechst DB stetig.

### 15.3 Technische Gegenmassnahmen

1. Indizes und regelmaessiges Vacuum.
2. Batch-Inserts statt Einzel-Insert.
3. Retry mit Backoff fuer externe APIs.
4. Hintergrundjob fuer Archivierung/Loeschung alter Daten.
5. Monitoring von Antwortzeiten und Fehlerquoten.

## 16. Sicherheit und Datenschutz

Das Projekt arbeitet mit oeffentlichen Luftfahrtdaten, dennoch sind Sicherheitsaspekte relevant:

1. Keine offenen Admin-Endpunkte exponieren.
2. Eingaben validieren (insb. Suchparameter).
3. Reverse Proxy mit TLS in produktiver Umgebung.
4. Ratelimit fuer API-Endpunkte.
5. Zugriffsprotokollierung fuer Betriebsanalyse.

Datenschutzseitig sind ADS-B Daten je nach Jurisdiktion unterschiedlich bewertet; fuer institutionellen Betrieb sollten interne Compliance-Vorgaben beachtet werden.

## 17. Erweiterungspotenzial

Konkrete naechste Entwicklungsschritte:

1. DB-Indizes und Query-Optimierung.
2. Exportfunktionen (CSV/JSON) fuer Suchergebnisse.
3. Heatmaps und geographische Verdichtungsanalysen.
4. Flugtyp-Klassifikation (Passenger, Cargo, GA, Business).
5. Alerting (z. B. Squawk-Filter, Hoehenbereiche).
6. Testsuite (Unit + Integration fuer Endpunkte).
7. Optionaler Umstieg auf Postgres bei hoher Last.

## 18. Fazit

Dieses ADS-B Projekt ist technisch sauber strukturiert und bildet den kompletten Weg von Live-Daten zu nutzbarer Auswertung ab. dump1090 liefert die decodierte Luftlage, der Node.js Service verarbeitet sie weiter, SQLite konserviert die Historie, und das Frontend macht die Ergebnisse intuitiv sichtbar.

Die Implementierung ist praxistauglich, weil sie mit wenig Infrastruktur auskommt und trotzdem funktional breit aufgestellt ist. Besonders stark ist die Kombination aus Live-Karte, Historisierung und Statistik. Damit eignet sich die Anwendung fuer Demo, Lehre, Monitoring und explorative Datenanalyse.

Mit gezielten Verbesserungen in Persistenzstrategie, Performance und Testabdeckung kann das System ohne grundlegenden Architekturwechsel weiter skaliert werden.

## 19. Anhang: Dateiliste der Kernkomponenten

- `server.js`: API, Datenabruf, Anreicherung, Persistenz
- `database.js`: DB-Pfadpruefung, SQLite Init
- `config.json`: Laufzeitparameter
- `public/index.html`: Live-Kartenansicht
- `public/statistics.html`: Statistikdashboard
- `public/search.html`: Flugsuche
- `public/assets/js/script.js`: Live-Markerlogik
- `public/assets/js/statistics.js`: Chartlogik
- `public/assets/js/search.js`: Suchworkflow und Routendarstellung
- `stats.db`: persistente Datenspeicherung

## 20. Anhang: Datenfelder mit Bedeutung

- `hex`: ICAO HEX Kennung
- `flight`: Callsign/Flugnummer
- `alt_baro`: barometrische Hoehe (ft)
- `gs`: Ground Speed (kts)
- `track`: Kurs (Grad)
- `lat`/`lon`: geographische Position
- `squawk`: Transpondercode
- `type`: Luftfahrzeugtyp
- `manufacturer`: Hersteller
- `photo_url`: URL eines Flugzeugbildes
- `timestamp`: Zeitpunkt der Speicherung

Diese Felder bilden zusammen die Grundlage fuer Live-Anzeige, Historie, Auswertung und Suche.
