document.addEventListener("DOMContentLoaded", () => {
  let sightingsChart, topAircraftChart, typeChart, manufacturerChart;

  //Statistiken Daten abrufen von internen API
  const fetchData = async () => {
    try {
      const response = await fetch("/api/statistics");
      if (!response.ok) {
        //Oh no error
        throw new Error(`API HTTP-error! Status: ${response.status}`);
      }
      const stats = await response.json();
      updateUI(stats);
    } catch (error) {
      //No No no error, bad error.
      console.error("Could not fetch statistics:", error);
    }
  };

  const updateUI = (stats) => {
    //Statistiken aktualisieren
    document.getElementById("total-sightings").textContent =
      stats.totalSightings || 0;
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

    // Sichtungen pro Stunde Diagramm
    if (stats.sightingsPerHour) {
      const sightingsCtx = document
        .getElementById("sightings-chart")
        .getContext("2d");
      const labels = stats.sightingsPerHour.map((s) => new Date(s.hour));
      const data = stats.sightingsPerHour.map((s) => s.count);

      if (sightingsChart) sightingsChart.destroy();
      sightingsChart = new Chart(sightingsCtx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Flugzeug-Sichtungen",
              data: data,
              borderColor: "#009fdf", // Alles DESY Farben (PR.DESY.de)
              backgroundColor: "rgba(0, 84, 159, 0.1)",
              fill: true,
              tension: 0.1,
            },
          ],
        },
        options: {
          scales: {
            x: {
              type: "time",
              time: {
                unit: "hour",
                tooltipFormat: "dd MMM HH:mm", //Format: TAG Monat Stunde:Minute (z.b. 10 Dez 13:09)
              },
              title: {
                display: true,
                text: "Zeit", //Beschriftung der X-Achse
              },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Anzahl", //Beschriftung der Y-Achse
              },
            },
          },
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    }

    // top 5 Aircraft Chart
    if (stats.topAircraft) {
      const topAircraftCtx = document
        .getElementById("top-aircraft-chart")
        .getContext("2d");
      const labels = stats.topAircraft.map((a) => a.hex);
      const data = stats.topAircraft.map((a) => a.count);

      if (topAircraftChart) topAircraftChart.destroy();
      topAircraftChart = new Chart(topAircraftCtx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Anzahl Sichtungen",
              data: data,
              backgroundColor: [
                "rgba(0, 105, 135, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(0, 177, 170, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(140, 180, 35, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(140, 60, 125, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(80, 80, 155, 1)", // Alles DESY Farben (PR.DESY.de)
              ],
              borderColor: "#fff",
            },
          ],
        },
        options: {
          indexAxis: "y",
          scales: {
            x: {
              beginAtZero: true,
            },
          },
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
        },
      });
    }

    // Flugzeugtypenn Diagramm (Tortendiagramm)
    if (stats.aircraftTypes) {
      const typeCtx = document.getElementById("type-chart").getContext("2d");
      const labels = stats.aircraftTypes.map((t) => t.type);
      const data = stats.aircraftTypes.map((t) => t.count);

      if (typeChart) typeChart.destroy();
      typeChart = new Chart(typeCtx, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Flugzeugtypen",
              data: data,
              backgroundColor: [
                "rgba(0, 74, 110, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(0, 123, 200, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(54, 159, 223, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(145, 125, 185, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(130, 135, 40, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(185, 45, 65, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(235, 90, 45, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(250, 200, 0, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(0, 177, 170, 1)", // Alles DESY Farben (PR.DESY.de)
                "rgba(0, 105, 135, 1)", // Alles DESY Farben (PR.DESY.de)
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
            },
          },
        },
      });
    }

    // top 5 Hersteller Diagramm (Tortendiagramm)
    if (stats.topManufacturers) {
      const manufacturerCtx = document
        .getElementById("manufacturer-chart")
        .getContext("2d");
      const labels = stats.topManufacturers.map((m) => m.manufacturer);
      const data = stats.topManufacturers.map((m) => m.count);

      if (manufacturerChart) manufacturerChart.destroy();
      manufacturerChart = new Chart(manufacturerCtx, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Top 5 Hersteller",
              data: data,
              backgroundColor: [
                "rgba(0, 74, 110, 1)",
                "rgba(0, 123, 200, 1)",
                "rgba(54, 159, 223, 1)",
                "rgba(145, 125, 185, 1)",
                "rgba(130, 135, 40, 1)",
                "rgba(185, 45, 65, 1)",
                "rgba(235, 90, 45, 1)",
                "rgba(250, 200, 0, 1)",
                "rgba(0, 177, 170, 1)",
                "rgba(0, 105, 135, 1)",
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
            },
          },
        },
      });
    }
  };

  fetchData();
  setInterval(fetchData, 10000); // alle 10 sekunden aktualisieren
});
