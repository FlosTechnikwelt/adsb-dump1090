document.addEventListener("DOMContentLoaded", () => {
  // Karte (Centerd auf DESY Hamburg)
  const map = L.map("map").setView([53.578, 9.882], 10);
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> <br>DESY Flugzeug Tracker <a href="https://desy.de" target="_blank">desy.de</a>',
      subdomains: "abcd",
      maxZoom: 19,
    },
  ).addTo(map);
  // FLugzeug icon (SVG), im DESY Gelb/Orange
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

  async function updateAircraftData() {
    try {
      // Interne API abrufen
      const response = await fetch("/api/aircraft");
      if (!response.ok) {
        // Wenn der HTTP STATUS nicht OK ist, Fehler ausgeben
        throw new Error(`API HTTP error! Status: ${response.status}`);
      }
      // json Daten Extrahieren
      const data = await response.json();
      const seenAircraft = new Set();

      // Diesen Teil für jeden Eintrag (Flugzeug) ausführen
      data.aircraft.forEach((plane) => {
        if (plane.lat && plane.lon) {
          seenAircraft.add(plane.hex);

          const altitudeInMeters = plane.alt_baro
            ? Math.round(plane.alt_baro * 0.3048)
            : 0;
          const speedInKmh = plane.gs ? Math.round(plane.gs * 1.852) : 0;

          //Popup Fenster inhalt
          const popupContent = `
                        ${plane.photo_url ? `<img src="${plane.photo_url}" alt="Aircraft photo" style="width:100%;height:auto;border-radius:5px;">` : ""}
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
            // Flugzeug Symbol auf der Karte aktualisieren
            aircraftMarkers[plane.hex].setLatLng([plane.lat, plane.lon]);
            aircraftMarkers[plane.hex].setRotationAngle(plane.track || 0);
            aircraftMarkers[plane.hex].setPopupContent(popupContent);
          } else {
            // Neues Flugzeug, Marker erstellen, mit dem ICON
            const marker = L.marker([plane.lat, plane.lon], {
              icon: planeIcon,
              rotationAngle: plane.track || 0,
            }).addTo(map);
            marker.bindPopup(popupContent);
            aircraftMarkers[plane.hex] = marker;
          }
        }
      });

      // Entferne Flugzeuge die nicht mehr in den json Daten sind
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

  updateAircraftData();
  setInterval(updateAircraftData, 1000); // jede Sekunden durchführen
});
