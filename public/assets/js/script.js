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
  const flugzeugIconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="#F18F1F">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
    `;

  const flugzeugIcon = L.divIcon({
    html: flugzeugIconSvg,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  let flugzeugMarker = {};

  // Asynchrone Funktion zum Abrufen und Aktualisieren der Flugzeugdaten auf der Karte.
  async function aktualisiereFlugzeugDaten() {
    try {
      // Ruft Flugzeugdaten von der internen API ab.
      const antwort = await fetch("/api/aircraft");
      if (!antwort.ok) {
        // Wenn der HTTP-Status nicht OK ist, wird ein Fehler ausgelöst.
        throw new Error(`API-HTTP-Fehler! Status: ${antwort.status}`);
      }
      // Extrahiert die JSON-Daten aus der Antwort.
      const daten = await antwort.json();
      const sichtbareFlugzeuge = new Set(); // Speichert die HEX-Codes der aktuell sichtbaren Flugzeuge.

      // Iteriert über jedes Flugzeug in den empfangenen Daten.
      daten.aircraft.forEach((flugzeug) => {
        if (flugzeug.lat && flugzeug.lon) {
          sichtbareFlugzeuge.add(flugzeug.hex); // Fügt das Flugzeug zu den gesehenen Flugzeugen hinzu.

          // Berechnet Höhe in Metern und Geschwindigkeit in km/h für die Anzeige.
          const hoeheInMetern = flugzeug.alt_baro
            ? Math.round(flugzeug.alt_baro * 0.3048)
            : 0;
          const geschwindigkeitInKmh = flugzeug.gs ? Math.round(flugzeug.gs * 1.852) : 0;

          // Erstellt den Inhalt für das Popup-Fenster des Markers.
          const popupInhalt = `
                        ${flugzeug.photo_url ? `<img src="${flugzeug.photo_url}" alt="Flugzeugfoto" style="width:100%;height:auto;border-radius:5px;"><p style="font-size: 0.8rem; text-align: right; margin: 0;">Bild: <a href="https://www.planespotters.net/" target="_blank">Planespotters.net</a></p>` : ""}
                        <table class="popup-table">
                            <tr><td>Flug:</td><td>${flugzeug.flight ? flugzeug.flight.trim() : "k. A."}</td></tr>
                            <tr><td>Hoehe:</td><td>${flugzeug.alt_baro ? `<span title="${hoeheInMetern} m">${flugzeug.alt_baro} ft</span>` : "k. A."}</td></tr>
                            <tr><td>Geschwindigkeit:</td><td>${flugzeug.gs ? `<span title="${geschwindigkeitInKmh} km/h">${flugzeug.gs.toFixed(1)} kts</span>` : "k. A."}</td></tr>
                            <tr><td>Typ:</td><td>${flugzeug.t || "k. A."}</td></tr>
                            <tr><td>Hersteller:</td><td>${flugzeug.manufacturer || "k. A."}</td></tr>
                            <tr><td>Squawk:</td><td>${flugzeug.squawk || "k. A."}</td></tr>
                        </table>
                    `;

          if (flugzeugMarker[flugzeug.hex]) {
            // Wenn der Marker für dieses Flugzeug bereits existiert, wird er aktualisiert.
            flugzeugMarker[flugzeug.hex].setLatLng([flugzeug.lat, flugzeug.lon]);
            flugzeugMarker[flugzeug.hex].setRotationAngle(flugzeug.track || 0);
            flugzeugMarker[flugzeug.hex].setPopupContent(popupInhalt);
          } else {
            // Wenn es ein neues Flugzeug ist, wird ein neuer Marker erstellt und zur Karte hinzugefügt.
            const marker = L.marker([flugzeug.lat, flugzeug.lon], {
              icon: flugzeugIcon,
              rotationAngle: flugzeug.track || 0,
            }).addTo(map);
            marker.bindPopup(popupInhalt);
            flugzeugMarker[flugzeug.hex] = marker;
          }
        }
      });

      // Entfernt Flugzeuge von der Karte, die nicht mehr in den aktuellen Daten enthalten sind.
      Object.keys(flugzeugMarker).forEach((hex) => {
        if (!sichtbareFlugzeuge.has(hex)) {
          map.removeLayer(flugzeugMarker[hex]);
          delete flugzeugMarker[hex];
        }
      });
    } catch (error) {
      console.error("Flugzeugdaten konnten nicht geladen werden:", error);
    }
  }

  // Ruft die Daten beim Laden der Seite einmal ab und aktualisiert sie dann jede Sekunde.
  aktualisiereFlugzeugDaten();
  setInterval(aktualisiereFlugzeugDaten, 1000); // Aktualisiert die Daten jede Sekunde.
});
