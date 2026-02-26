# Planespotters-Problem: Bild erscheint nur kurz oder verspätet

## Fehlerbild

Im Live-Tracking wurde das Flugzeugbild (Planespotters) nicht stabil angezeigt:

- Das Bild erschien teilweise erst nach mehreren Sekunden/Minuten.
- Wenn es erschien, war es oft nur sehr kurz sichtbar (z. B. ein Refresh-Zyklus).
- Danach verschwand es wieder, obwohl das Flugzeug weiterhin sichtbar war.

## Technische Ursache

Die Ursache lag in der Kombination aus **Dedupe-Logik** und **Antwortaufbau in `/api/aircraft`**:

1. Die API lieferte primär die frischen Daten aus der externen ADS-B Quelle.

- Diese Daten enthalten in der Regel **kein** `photo_url`.

2. Das Enrichment (`recordAircraftData`) holte Bilder von Planespotters.

- Der Bild-URL-Wert wurde nur in dem Moment gesetzt, in dem der externe Bildabruf erfolgreich war.

3. Gleichzeitig war ein Dedupe-Fenster aktiv.

- Für dieselbe HEX-Adresse wurden innerhalb des Fensters keine neuen DB-Schreibvorgänge durchgeführt.
- In diesen Dedupe-Zyklen wurde vorher kein stabiler Merge aus bereits bekannten Metadaten durchgeführt.

4. Effekt im Frontend:

- Ein Zyklus hatte zufällig `photo_url` (Bild sichtbar).
- Der nächste Zyklus enthielt wieder kein `photo_url` (Bild verschwand).

Kurz: Das Bild war nicht dauerhaft an das Flugzeugobjekt gebunden, sondern nur an einzelne Enrichment-Zyklen.

## Ziel der Lösung

- Bekannte Bild-/Typ-/Herstellerdaten sollen bei jeder API-Antwort verfügbar sein.
- Dedupe darf das **Speichern** reduzieren, aber nicht die **Anzeige-Metadaten** verlieren.
- API-Antwort soll schnell bleiben, Enrichment darf im Hintergrund laufen.

## Umgesetzte Lösung

### 1) In-Memory-Metadaten-Cache pro HEX

In `server.js` wurde ein Cache eingeführt:

- `aircraftMetaByHex: Map`
- Schlüssel: `hex`
- Werte: `photo_url`, `type`, `manufacturer`

Neue Hilfsfunktionen:

- `mergeAircraftMeta(hex, meta)`
  - merged neue Metadaten in den Cache, ohne vorhandene Werte unnötig zu löschen.
- `applyAircraftMeta(plane)`
  - ergänzt fehlende Felder im aktuellen Flugzeugobjekt aus dem Cache.

Nutzen:

- Sobald ein Bild einmal bekannt ist, bleibt es für weitere Antworten verfügbar.

### 2) Dedupe-Verhalten korrigiert

In `recordAircraftData()` wurde die Reihenfolge angepasst:

- Vor Dedupe wird `applyAircraftMeta(plane)` ausgeführt.
- Falls Dedupe greift (`continue`), werden `plane.photo_url`, `plane.t`, `plane.manufacturer` trotzdem gesetzt.
- Dadurch verliert das Objekt im Response-Zyklus keine Metadaten mehr.

Nutzen:

- Dedupe reduziert Netz-/DB-Last, aber nicht die Datenqualität im Frontend.

### 3) Planespotters/Hexdb nur bei fehlenden Daten

Enrichment wurde effizienter:

- Planespotters-Aufruf nur, wenn kein `photo_url` bereits vorhanden ist.
- Hexdb-Aufruf nur, wenn Typ fehlt.

Nutzen:

- Weniger unnötige externe Requests.
- Schnellere stabile Antworten bei bekannten Flugzeugen.

### 4) DB-Hydration vor API-Response

Neue Funktion `hydrateAircraftMetaFromDb(aircraftList)`:

- Liest für aktuell sichtbare HEX-Codes Metadaten aus `aircraft_history`.
- merged diese in den Cache.

Ablauf in `/api/aircraft`:

1. ADS-B Daten holen.
2. Metadaten aus DB für diese HEX-Codes laden.
3. `applyAircraftMeta` auf alle Flugzeuge anwenden.
4. Antwort sofort senden (`res.json(data)`).
5. Enrichment + Speichern asynchron im Hintergrund starten.

Nutzen:

- Bereits bekannte Bilder sind direkt beim ersten Antwortzyklus nach Seitenladen vorhanden.
- API-Response blockiert nicht auf externe Bild-/Typ-Requests.

## Warum das Problem jetzt gelöst ist

Vorher war `photo_url` ein "sporadischer" Wert aus einzelnen Enrichment-Requests.
Jetzt ist `photo_url` ein "persistenter" Wert aus:

- In-Memory-Cache
- Datenbank-Hydration
- und anschließendem erneuten Enrichment

Dadurch gilt:

- Ist ein Bild einmal bekannt, bleibt es in Folgeantworten erhalten.
- Die Anzeige im Popup ist stabil und verschwindet nicht mehr durch den nächsten Poll.

## Grenzen / erwartbares Verhalten

- Für eine **komplett neue HEX**, die weder im Cache noch in der DB ist, kann das Bild erst erscheinen, nachdem Planespotters erstmals erfolgreich geantwortet hat.
- Danach bleibt es stabil verfügbar.

## Betroffene Datei

- `server.js`

## Relevante neue/angepasste Bereiche (überblick)

- Metadaten-Cache und Merge/Apply-Funktionen
- DB-Hydration-Funktion
- Anpassung der Dedupe-Logik in `recordAircraftData()`
- `/api/aircraft` auf "Antwort zuerst, Enrichment danach" umgestellt

## Validierung

- `node --check server.js` erfolgreich.
- Logikprüfung: Bei Dedupe-Zyklen bleiben Metadaten am Flugzeugobjekt erhalten.
- Bereits bekannte Bilder können direkt aus DB/Cache in die erste Antwort einfließen.
