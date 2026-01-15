// script.js
// Dieses Skript verwaltet die interaktive Live-Karte auf der Hauptseite.
// Es initialisiert die Karte, ruft Flugzeugdaten ab und aktualisiert die Marker auf der Karte.

document.addEventListener("DOMContentLoaded", () => {
  // Initialisiert die Leaflet-Karte, zentriert auf DESY Hamburg.
  const map = L.map("map").setView([53.578, 9.882], 10);
  // Fügt eine Kachel-Ebene von CartoDB hinzu.
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> <br>DESY Flugzeug Tracker <a href="https://desy.de" target="_blank">www.desy.de</a>',
      subdomains: "abcd",
      maxZoom: 19,
    },
  ).addTo(map);
  // Definiert ein benutzerdefiniertes SVG-Icon für Flugzeuge in DESY-Gelb/Orange.
  const planeIconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="#F18F1F">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
    `;

  const planeIcon = L.divIcon({
    html: planeIconSvg,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  let aircraftMarkers = {};

  // Asynchrone Funktion zum Abrufen und Aktualisieren der Flugzeugdaten auf der Karte.
  async function updateAircraftData() {
    try {
      // Ruft Flugzeugdaten von der internen API ab.
      const response = await fetch("/api/aircraft");
      if (!response.ok) {
        // Wenn der HTTP-Status nicht OK ist, wird ein Fehler ausgelöst.
        throw new Error(`API HTTP error! Status: ${response.status}`);
      }
      // Extrahiert die JSON-Daten aus der Antwort.
      const data = await response.json();
      const seenAircraft = new Set(); // Speichert die HEX-Codes der aktuell sichtbaren Flugzeuge.

      // Iteriert über jedes Flugzeug in den empfangenen Daten.
      data.aircraft.forEach((plane) => {
        if (plane.lat && plane.lon) {
          seenAircraft.add(plane.hex); // Fügt das Flugzeug zu den gesehenen Flugzeugen hinzu.

          // Berechnet Höhe in Metern und Geschwindigkeit in km/h für die Anzeige.
          const altitudeInMeters = plane.alt_baro
            ? Math.round(plane.alt_baro * 0.3048)
            : 0;
          const speedInKmh = plane.gs ? Math.round(plane.gs * 1.852) : 0;

          // Erstellt den Inhalt für das Popup-Fenster des Markers.
          const popupContent = `
                        ${plane.photo_url ? `<img src="${plane.photo_url}" alt="Aircraft photo" style="width:100%;height:auto;border-radius:5px;"><p style="font-size: 0.8rem; text-align: right; margin: 0;">Bild: <a href="https://www.planespotters.net/" target="_blank">Planespotters.net</a></p>` : ""}
                        <table class="popup-table">
                            <tr><td>Flug:</td><td>${plane.flight ? plane.flight.trim() : "N/A"}</td></tr>
                            <tr><td>Höhe:</td><td>${plane.alt_baro ? `<span title="${altitudeInMeters} m">${plane.alt_baro} ft</span>` : "N/A"}</td></tr>
                            <tr><td>Geschwindigkeit:</td><td>${plane.gs ? `<span title="${speedInKmh} km/h">${plane.gs.toFixed(1)} kts</span>` : "N/A"}</td></tr>
                            <tr><td>Typ:</td><td>${plane.t || "N/A"}</td></tr>
                            <tr><td>Hersteller:</td><td>${plane.manufacturer || "N/A"}</td></tr>
                            <tr><td>Squawk:</td><td>${plane.squawk || "N/A"}</td></tr>
                        </table>
                    `;

          if (aircraftMarkers[plane.hex]) {
            // Wenn der Marker für dieses Flugzeug bereits existiert, wird er aktualisiert.
            aircraftMarkers[plane.hex].setLatLng([plane.lat, plane.lon]);
            aircraftMarkers[plane.hex].setRotationAngle(plane.track || 0);
            aircraftMarkers[plane.hex].setPopupContent(popupContent);
          } else {
            // Wenn es ein neues Flugzeug ist, wird ein neuer Marker erstellt und zur Karte hinzugefügt.
            const marker = L.marker([plane.lat, plane.lon], {
              icon: planeIcon,
              rotationAngle: plane.track || 0,
            }).addTo(map);
            marker.bindPopup(popupContent);
            aircraftMarkers[plane.hex] = marker;
          }
        }
      });

      // Entfernt Flugzeuge von der Karte, die nicht mehr in den aktuellen Daten enthalten sind.
      Object.keys(aircraftMarkers).forEach((hex) => {
        if (!seenAircraft.has(hex)) {
          map.removeLayer(aircraftMarkers[hex]);
          delete aircraftMarkers[hex];
        }
      });
    } catch (error) {
      console.error("Could not fetch aircraft data:", error);
    }
  }

  // Ruft die Daten beim Laden der Seite einmal ab und aktualisiert sie dann jede Sekunde.
  updateAircraftData();
  setInterval(updateAircraftData, 1000); // Aktualisiert die Daten jede Sekunde.
});
