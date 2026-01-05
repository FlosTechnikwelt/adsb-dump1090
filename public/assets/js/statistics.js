// statistics.js
// Dieses Skript ist für das Abrufen und die Darstellung von Flugstatistikdaten zuständig.
// Es verwendet Chart.js, um verschiedene Diagramme zu generieren und die UI mit statistischen Werten zu aktualisieren.

document.addEventListener("DOMContentLoaded", () => {
  let sightingsChart, topAircraftChart, typeChart, manufacturerChart;

  // Funktion zum Abrufen der Statistikdaten von der internen API.
  const fetchData = async () => {
    try {
      const response = await fetch("/api/statistics");
      if (!response.ok) {
        // Fehlerbehandlung, wenn der HTTP-Status nicht OK ist.
        throw new Error(`API HTTP-error! Status: ${response.status}`);
      }
      const stats = await response.json(); // Extrahiert die JSON-Daten.
      updateUI(stats); // Aktualisiert die Benutzeroberfläche mit den abgerufenen Statistiken.
    } catch (error) {
      // Fehlerbehandlung beim Abrufen der Statistiken.
      console.error("Could not fetch statistics:", error);
    }
  };

  // Funktion zum Aktualisieren der Benutzeroberfläche mit den empfangenen Statistikdaten.
  const updateUI = (stats) => {
    // Ermittelt das meistgesehene Flugzeug basierend auf den Flugzeugtypen-Statistiken.
    const mostSeenAircraft =
      stats.aircraftTypes?.reduce(
        (max, current) => (current.count > max.count ? current : max),
        stats.aircraftTypes[0],
      ) || {};

    // Aktualisiert die Textinhalte der Statistik-Karten.
    document.getElementById("most-seen-aircraft").textContent =
      `${mostSeenAircraft.type}` || "N/A";
    document.getElementById("unique-aircraft").textContent =
      stats.uniqueAircraft || 0;
    document.getElementById("avg-altitude").textContent =
      stats.averages && stats.averages.avg_altitude
        ? `${Math.round(stats.averages.avg_altitude)} ft`
        : "N/A";
    document.getElementById("avg-speed").textContent =
      stats.averages && stats.averages.avg_speed
        ? `${Math.round(stats.averages.avg_speed)} kts`
        : "N/A";

    // Erstellt oder aktualisiert das Liniendiagramm für "Sichtungen pro Stunde".
    if (stats.sightingsPerHour) {
      const sightingsCtx = document
        .getElementById("sightings-chart")
        .getContext("2d");
      const labels = stats.sightingsPerHour.map((s) => new Date(s.hour));
      const data = stats.sightingsPerHour.map((s) => s.count);

      if (sightingsChart) sightingsChart.destroy(); // Zerstört ein bestehendes Diagramm, um es neu zu zeichnen.
      sightingsChart = new Chart(sightingsCtx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Flugzeug-Sichtungen",
              data: data,
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
    if (stats.topAircraft) {
      const topAircraftCtx = document
        .getElementById("top-aircraft-chart")
        .getContext("2d");
      const labels = stats.topAircraft.map((a) => a.hex);
      const data = stats.topAircraft.map((a) => a.count);

      if (topAircraftChart) topAircraftChart.destroy(); // Zerstört ein bestehendes Diagramm.
      topAircraftChart = new Chart(topAircraftCtx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Anzahl Sichtungen",
              data: data,
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
    if (stats.aircraftTypes) {
      const typeCtx = document.getElementById("type-chart").getContext("2d");
      const labels = stats.aircraftTypes.map((t) => t.type);
      const data = stats.aircraftTypes.map((t) => t.count);

      if (typeChart) typeChart.destroy(); // Zerstört ein bestehendes Diagramm.
      typeChart = new Chart(typeCtx, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Flugzeugtypen",
              data: data,
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
    if (stats.topManufacturers) {
      const manufacturerCtx = document
        .getElementById("manufacturer-chart")
        .getContext("2d");
      const labels = stats.topManufacturers.map((m) => m.manufacturer);
      const data = stats.topManufacturers.map((m) => m.count);

      if (manufacturerChart) manufacturerChart.destroy(); // Zerstört ein bestehendes Diagramm.
      manufacturerChart = new Chart(manufacturerCtx, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Top 5 Hersteller",
              data: data,
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
  fetchData();
  setInterval(fetchData, 10000); // Aktualisiert die Daten alle 10 Sekunden.
});
