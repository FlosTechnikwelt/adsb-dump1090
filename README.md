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
    Erstellen Sie eine Datei `config.json` im Hauptverzeichnis des Projekts. Diese Datei wird verwendet, um die URL Ihrer ADS-B-API zu konfigurieren. Wenn keine `apiUrl` angegeben ist, versucht die Anwendung, Daten aus einer lokalen `data.json` zu lesen (hauptsächlich für Entwicklungszwecke).

    Beispiel für `config.json`:

    ```json
    {
      "apiUrl": "http://localhost:8080/data.json",
      "prefixexpress": "[WEBSERVE]: ",
      "prefixconfig": "[CONFIG]: ",
      "prefixdb": "[DB]: "
    }
    ```

    Ersetzen Sie `"http://localhost:8080/data.json"` durch die tatsächliche URL Ihres ADS-B-Datenfeeds (z.B. von dump1090).

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
