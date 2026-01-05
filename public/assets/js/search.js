// search.js
// Dieses Skript verwaltet die Flugsuche-Funktionalität auf der Suchseite.
// Es verarbeitet Benutzereingaben, sendet Suchanfragen an den Server und zeigt die Ergebnisse auf einer Karte und in einer Tabelle an.

document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("search-form");
  const flightNumberInput = document.getElementById("flight-number");
  const flightDateInput = document.getElementById("flight-date");
  const resultsContainer = document.getElementById("results-container");
  const noResultsAlert = document.getElementById("no-results");
  const resultsHeading = document.getElementById("results-heading");
  const flightDetailsContainer = document.getElementById("flight-details");
  flightDateInput.valueAsDate = new Date(); // Setzt das Standarddatum auf das heutige Datum.

  // Initialisiert die Leaflet-Karte für die Anzeige der Suchergebnisse.
  const map = L.map("map");
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  ).addTo(map);

  let flightPathPolyline = null; // Speichert die Polylinie des Flugpfads.
  let startMarker = null; // Speichert den Startmarker des Flugpfads.
  let endMarker = null; // Speichert den Endmarker des Flugpfads.

  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const flightNumber = flightNumberInput.value;
    const flightDate = flightDateInput.value;

    resultsContainer.classList.add("d-none");
    noResultsAlert.classList.add("d-none");
    flightDetailsContainer.innerHTML = "";
    if (flightPathPolyline) map.removeLayer(flightPathPolyline);
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);

    try {
      const response = await fetch(
        `/api/flights/search?flight=${encodeURIComponent(flightNumber)}&date=${flightDate}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const flightData = await response.json();

      if (flightData.length > 0) {
        displayResults(flightData, flightNumber, flightDate);
      } else {
        noResultsAlert.classList.remove("d-none");
      }
    } catch (error) {
      console.error("Error flight search:", error);
      noResultsAlert.textContent =
        "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.";
      noResultsAlert.classList.remove("d-none");
    }
  });

  function displayResults(data, flightNumber, flightDate) {
    resultsHeading.textContent = `Ergebnisse für Flug ${flightNumber.toUpperCase()} am ${new Date(flightDate).toLocaleDateString("de-DE")}`;
    resultsContainer.classList.remove("d-none");

    //Karte
    const latLngs = data
      .filter((d) => d.lat && d.lon)
      .map((d) => [d.lat, d.lon]);

    if (latLngs.length > 0) {
      flightPathPolyline = L.polyline(latLngs, { color: "#00549F" }).addTo(map);
      map.fitBounds(flightPathPolyline.getBounds().pad(0.1));

      //start and end markers
      startMarker = L.marker(latLngs[0]).addTo(map).bindPopup("Start");
      endMarker = L.marker(latLngs[latLngs.length - 1])
        .addTo(map)
        .bindPopup("Ende");
    } else {
      map.setView([53.578, 9.882], 10);
    }

    const table = document.createElement("table");
    table.className = "table table-striped table-sm";
    table.innerHTML = `
            <thead>
                <tr>
                    <th>Zeit</th>
                    <th>Höhe</th>
                    <th>Geschw.</th>
                    <th>Kurs</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;
    const tbody = table.querySelector("tbody");
    data.forEach((point) => {
      const row = tbody.insertRow();
      row.innerHTML = `
                <td>${new Date(point.timestamp).toLocaleTimeString("de-DE")}</td>
                <td>${point.alt_baro ? `${point.alt_baro} ft` : "N/A"}</td>
                <td>${point.gs ? `${point.gs} kts` : "N/A"}</td>
                <td>${point.track ? `${point.track}°` : "N/A"}</td>
            `;
    });
    flightDetailsContainer.appendChild(table);
  }
});
