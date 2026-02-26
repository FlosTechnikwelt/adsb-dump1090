# DB-Problem: `SQLITE_READONLY: attempt to write a readonly database`

## Problem

Nach einem Neustart trat beim Schreiben in SQLite der Fehler auf:

- `SQLITE_READONLY: attempt to write a readonly database`

Das bedeutet, dass der Prozess die Datenbankdatei oder das Verzeichnis der Datenbank nicht mit Schreibrechten verwenden konnte.

## Ursache

Es gab zwei relevante Ursachen im Code/Startablauf:

1. Server-Start konnte vor abgeschlossener DB-Initialisierung passieren.

- Die Datenbank wurde asynchron initialisiert.
- Der Webserver startete sofort.
- Beim ersten Start (wenn DB/Tabelle noch erstellt werden muss) konnten Schreibzugriffe zu früh kommen.

2. Keine harte Prüfung auf Schreibrechte am DB-Pfad.

- Wenn Datei/Ordner nach Neustart mit anderen Rechten/Ownern vorlagen, kam der Fehler erst beim Insert.
- Die Fehlermeldung war dadurch spät und nicht eindeutig genug.

## Änderungen

### 1) Initialisierung auf "ready before listen" umgestellt

- `database.js`: `initDb()` gibt jetzt ein `Promise` zurück und resolved erst nach erfolgreichem `CREATE TABLE`.
- `server.js`: Server startet erst nach `await initDb()`.
- Bei fehlgeschlagener Initialisierung wird der Prozess sauber beendet.

Effekt:

- Keine Race Condition mehr zwischen erstem Insert und Tabellenerstellung.

### 2) Schreibrechte-Prüfung für DB-Datei/Verzeichnis ergänzt

- `database.js`: Neue Funktion `ensureDbWritable()` vor dem Öffnen der DB.
- Prüft Schreibrechte des DB-Verzeichnisses.
- Erstellt die DB-Datei, falls sie nicht existiert.
- Prüft Schreibrechte der DB-Datei.
- Versucht bei Bedarf `chmod 664` auf der DB-Datei.
- Bei weiterhin fehlenden Rechten: klare Fehlermeldung mit Pfad.

Effekt:

- Probleme mit Rechten werden direkt beim Start sichtbar.
- Der Fehler ist schneller und genauer diagnostizierbar.

### 3) DB-Pfad konfigurierbar gemacht

- `database.js`: DB-Pfad kann jetzt über
  - `DB_PATH` (Environment Variable) oder
  - `config.dbPath`
    gesetzt werden.
- Fallback bleibt `stats.db` im Projektordner.

Effekt:

- DB kann in ein garantiert beschreibbares Verzeichnis gelegt werden (z. B. für Service-Start nach Reboot).

### 4) Zusätzlich gefixter Datenfehler

- `server.js`: Tippfehler korrigiert: `plane.alt_bar` -> `plane.alt_baro`.

Effekt:

- Höhenwerte werden korrekt in `alt_baro` gespeichert.

## Verifizierungen

- Syntax geprüft:
  - `node --check server.js`
  - `node --check database.js`
- Test-Insert geprüft:
  - Initialisierung + Insert liefen erfolgreich.

## Hinweise für Betrieb

- Server nicht gemischt mit/ohne `sudo` starten.
- Falls Rechte bereits falsch sind, einmalig korrigieren:

```bash
sudo chown -R $(whoami):staff /Users/florian/Documents/GitHub/adsb-dump1090
chmod 664 /Users/florian/Documents/GitHub/adsb-dump1090/stats.db
```

- Alternativ DB auf sicheren Pfad legen:

```bash
DB_PATH=/tmp/adsb/stats.db npm start
```

## Betroffene Dateien

- `database.js`
- `server.js`
