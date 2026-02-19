// search.js
// Dieses Skript verwaltet die Flugsuche-Funktionalität auf der Suchseite.
// Es verarbeitet Benutzereingaben, sendet Suchanfragen an den Server und zeigt die Ergebnisse auf einer Karte und in einer Tabelle an.

document.addEventListener("DOMContentLoaded", () => {
  const suchFormular = document.getElementById("search-form");
  const flugnummerEingabe = document.getElementById("flight-number");
  const flugdatumEingabe = document.getElementById("flight-date");
  const ergebnisContainer = document.getElementById("results-container");
  const keineErgebnisseHinweis = document.getElementById("no-results");
  const ergebnisUeberschrift = document.getElementById("results-heading");
  const flugDetailsContainer = document.getElementById("flight-details");
  flugdatumEingabe.valueAsDate = new Date(); // Setzt das Standarddatum auf das heutige Datum.

  // Initialisiert die Leaflet-Karte für die Anzeige der Suchergebnisse.
  const map = L.map("map");
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  ).addTo(map);

  let flugpfadLinie = null; // Speichert die Polylinie des Flugpfads.
  let startMarker = null; // Speichert den Startmarker des Flugpfads.
  let endMarker = null; // Speichert den Endmarker des Flugpfads.

  suchFormular.addEventListener("submit", async (e) => {
    e.preventDefault();
    const flugnummer = flugnummerEingabe.value;
    const flugdatum = flugdatumEingabe.value;

    ergebnisContainer.classList.add("d-none");
    keineErgebnisseHinweis.classList.add("d-none");
    flugDetailsContainer.innerHTML = "";
    if (flugpfadLinie) map.removeLayer(flugpfadLinie);
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);

    try {
      const antwort = await fetch(
        `/api/flights/search?flight=${encodeURIComponent(flugnummer)}&date=${flugdatum}`,
      );
      if (!antwort.ok) {
        throw new Error(`HTTP-Fehler! Status: ${antwort.status}`);
      }
      const flugdaten = await antwort.json();

      if (flugdaten.length > 0) {
        zeigeErgebnisseAn(flugdaten, flugnummer, flugdatum);
      } else {
        keineErgebnisseHinweis.classList.remove("d-none");
      }
    } catch (error) {
      console.error("Fehler bei der Flugsuche:", error);
      keineErgebnisseHinweis.textContent =
        "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.";
      keineErgebnisseHinweis.classList.remove("d-none");
    }
  });

  function zeigeErgebnisseAn(daten, flugnummer, flugdatum) {
    ergebnisUeberschrift.textContent = `Ergebnisse fuer Flug ${flugnummer.toUpperCase()} am ${new Date(flugdatum).toLocaleDateString("de-DE")}`;
    ergebnisContainer.classList.remove("d-none");

    //Karte
    const latLngs = daten
      .filter((d) => d.lat && d.lon)
      .map((d) => [d.lat, d.lon]);

    if (latLngs.length > 0) {
      flugpfadLinie = L.polyline(latLngs, { color: "#00549F" }).addTo(map);
      map.fitBounds(flugpfadLinie.getBounds().pad(0.1));

      //start and end markers
      startMarker = L.marker(latLngs[0]).addTo(map).bindPopup("Start");
      endMarker = L.marker(latLngs[latLngs.length - 1])
        .addTo(map)
        .bindPopup("Ende");
    } else {
      map.setView([53.578, 9.882], 10);
    }

    const tabelle = document.createElement("table");
    tabelle.className = "table table-striped table-sm";
    tabelle.innerHTML = `
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
    const tabellenInhalt = tabelle.querySelector("tbody");
    daten.forEach((punkt) => {
      const zeile = tabellenInhalt.insertRow();
      zeile.innerHTML = `
                <td>${new Date(punkt.timestamp).toLocaleTimeString("de-DE")}</td>
                <td>${punkt.alt_baro ? `${punkt.alt_baro} ft` : "k. A."}</td>
                <td>${punkt.gs ? `${punkt.gs} kts` : "k. A."}</td>
                <td>${punkt.track ? `${punkt.track}°` : "k. A."}</td>
            `;
    });
    flugDetailsContainer.appendChild(tabelle);
  }
});
