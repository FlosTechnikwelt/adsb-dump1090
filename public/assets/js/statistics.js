// statistics.js
// Dieses Skript ist für das Abrufen und die Darstellung von Flugstatistikdaten zuständig.
// Es verwendet Chart.js, um verschiedene Diagramme zu generieren und die UI mit statistischen Werten zu aktualisieren.

document.addEventListener("DOMContentLoaded", () => {
  let sichtungenDiagramm, topFlugzeugeDiagramm, typDiagramm, herstellerDiagramm;

  // Funktion zum Abrufen der Statistikdaten von der internen API.
  const ladeDaten = async () => {
    try {
      const antwort = await fetch("/api/statistics");
      if (!antwort.ok) {
        // Fehlerbehandlung, wenn der HTTP-Status nicht OK ist.
        throw new Error(`API-HTTP-Fehler! Status: ${antwort.status}`);
      }
      const statistiken = await antwort.json(); // Extrahiert die JSON-Daten.
      aktualisiereOberflaeche(statistiken); // Aktualisiert die Benutzeroberfläche mit den abgerufenen Statistiken.
    } catch (error) {
      // Fehlerbehandlung beim Abrufen der Statistiken.
      console.error("Statistiken konnten nicht geladen werden:", error);
    }
  };

  // Funktion zum Aktualisieren der Benutzeroberfläche mit den empfangenen Statistikdaten.
  const aktualisiereOberflaeche = (statistiken) => {
    // Ermittelt das meistgesehene Flugzeug basierend auf den Flugzeugtypen-Statistiken.
    const haeufigstesFlugzeug =
      statistiken.aircraftTypes?.reduce(
        (max, current) => (current.count > max.count ? current : max),
        statistiken.aircraftTypes[0],
      ) || {};

    // Aktualisiert die Textinhalte der Statistik-Karten.
    document.getElementById("most-seen-aircraft").textContent =
      `${haeufigstesFlugzeug.type}` || "k. A.";
    document.getElementById("unique-aircraft").textContent =
      statistiken.uniqueAircraft || 0;
    document.getElementById("avg-altitude").textContent =
      statistiken.averages && statistiken.averages.avg_altitude
        ? `${Math.round(statistiken.averages.avg_altitude)} ft`
        : "k. A.";
    document.getElementById("avg-speed").textContent =
      statistiken.averages && statistiken.averages.avg_speed
        ? `${Math.round(statistiken.averages.avg_speed)} kts`
        : "k. A.";

    // Erstellt oder aktualisiert das Liniendiagramm für "Sichtungen pro Stunde".
    if (statistiken.sightingsPerHour) {
      const sichtungenKontext = document
        .getElementById("sightings-chart")
        .getContext("2d");
      const beschriftungen = statistiken.sightingsPerHour.map(
        (s) => new Date(s.hour),
      );
      const daten = statistiken.sightingsPerHour.map((s) => s.count);

      if (sichtungenDiagramm) sichtungenDiagramm.destroy(); // Zerstört ein bestehendes Diagramm, um es neu zu zeichnen.
      sichtungenDiagramm = new Chart(sichtungenKontext, {
        type: "line",
        data: {
          labels: beschriftungen,
          datasets: [
            {
              label: "Flugzeug-Sichtungen",
              data: daten,
              borderColor: "#009fdf", // DESY-Farbe
              backgroundColor: "rgba(0, 84, 159, 0.1)",
              fill: true,
              tension: 0.1,
            },
          ],
        },
        options: {
          scales: {
            x: {
              type: "time", // X-Achse als Zeitachse konfigurieren.
              time: {
                unit: "hour",
                tooltipFormat: "dd MMM HH:mm", // Format für Tooltip: TAG Monat Stunde:Minute (z.B. 10 Dez 13:09)
              },
              title: {
                display: true,
                text: "Zeit", // Beschriftung der X-Achse.
              },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Anzahl", // Beschriftung der Y-Achse.
              },
            },
          },
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    }

    // Erstellt oder aktualisiert das Balkendiagramm für die "Top 5 Flugzeuge".
    if (statistiken.topAircraft) {
      const topFlugzeugeKontext = document
        .getElementById("top-aircraft-chart")
        .getContext("2d");
      const beschriftungen = statistiken.topAircraft.map((a) => a.hex);
      const daten = statistiken.topAircraft.map((a) => a.count);

      if (topFlugzeugeDiagramm) topFlugzeugeDiagramm.destroy(); // Zerstört ein bestehendes Diagramm.
      topFlugzeugeDiagramm = new Chart(topFlugzeugeKontext, {
        type: "bar",
        data: {
          labels: beschriftungen,
          datasets: [
            {
              label: "Anzahl Sichtungen",
              data: daten,
              backgroundColor: [
                "rgba(0, 105, 135, 1)", // DESY-Farben
                "rgba(0, 177, 170, 1)", // DESY-Farben
                "rgba(140, 180, 35, 1)", // DESY-Farben
                "rgba(140, 60, 125, 1)", // DESY-Farben
                "rgba(80, 80, 155, 1)", // DESY-Farben
              ],
              borderColor: "#fff",
            },
          ],
        },
        options: {
          indexAxis: "y", // Horizontale Balken.
          scales: {
            x: {
              beginAtZero: true,
            },
          },
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false, // Legende ausblenden.
            },
          },
        },
      });
    }

    // Erstellt oder aktualisiert das Tortendiagramm für "Flugzeugtypen".
    if (statistiken.aircraftTypes) {
      const typKontext = document.getElementById("type-chart").getContext("2d");
      const beschriftungen = statistiken.aircraftTypes.map((t) => t.type);
      const daten = statistiken.aircraftTypes.map((t) => t.count);

      if (typDiagramm) typDiagramm.destroy(); // Zerstört ein bestehendes Diagramm.
      typDiagramm = new Chart(typKontext, {
        type: "doughnut",
        data: {
          labels: beschriftungen,
          datasets: [
            {
              label: "Flugzeugtypen",
              data: daten,
              backgroundColor: [
                "rgba(0, 74, 110, 1)", // DESY-Farben
                "rgba(0, 123, 200, 1)", // DESY-Farben
                "rgba(54, 159, 223, 1)", // DESY-Farben
                "rgba(145, 125, 185, 1)", // DESY-Farben
                "rgba(130, 135, 40, 1)", // DESY-Farben
                "rgba(185, 45, 65, 1)", // DESY-Farben
                "rgba(235, 90, 45, 1)", // DESY-Farben
                "rgba(250, 200, 0, 1)", // DESY-Farben
                "rgba(0, 177, 170, 1)", // DESY-Farben
                "rgba(0, 105, 135, 1)", // DESY-Farben
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right", // Legende rechts positionieren.
            },
          },
        },
      });
    }

    // Erstellt oder aktualisiert das Tortendiagramm für die "Top 5 Hersteller".
    if (statistiken.topManufacturers) {
      const herstellerKontext = document
        .getElementById("manufacturer-chart")
        .getContext("2d");
      const beschriftungen = statistiken.topManufacturers.map(
        (m) => m.manufacturer,
      );
      const daten = statistiken.topManufacturers.map((m) => m.count);

      if (herstellerDiagramm) herstellerDiagramm.destroy(); // Zerstört ein bestehendes Diagramm.
      herstellerDiagramm = new Chart(herstellerKontext, {
        type: "doughnut",
        data: {
          labels: beschriftungen,
          datasets: [
            {
              label: "Top 5 Hersteller",
              data: daten,
              backgroundColor: [
                "rgba(0, 74, 110, 1)", // DESY-Farben
                "rgba(0, 123, 200, 1)", // DESY-Farben
                "rgba(54, 159, 223, 1)", // DESY-Farben
                "rgba(145, 125, 185, 1)", // DESY-Farben
                "rgba(130, 135, 40, 1)", // DESY-Farben
                "rgba(185, 45, 65, 1)", // DESY-Farben
                "rgba(235, 90, 45, 1)", // DESY-Farben
                "rgba(250, 200, 0, 1)", // DESY-Farben
                "rgba(0, 177, 170, 1)", // DESY-Farben
                "rgba(0, 105, 135, 1)", // DESY-Farben
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right", // Legende rechts positionieren.
            },
          },
        },
      });
    }
  };

  // Ruft die Daten beim Laden der Seite einmal ab und aktualisiert sie dann alle 10 Sekunden.
  ladeDaten();
  setInterval(ladeDaten, 10000); // Aktualisiert die Daten alle 10 Sekunden.
});
