const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

let aircraftData = [];
let lastUpdate = new Date();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


function startADSBProcess() {
    const adsbProcess = spawn('dump1090', ['--net', '--json-dir', '/run/dump1090-fa']);
    
    //Simuation
    //const adsbProcess = spawn('python3', [path.join(__dirname, 'adsb_simulator.py')]);

    adsbProcess.stdout.on('data', (data) => {

        const lines = data.toString().split('\n');
        
        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const newAircraft = JSON.parse(line);
                    
                    const index = aircraftData.findIndex(a => a.hex === newAircraft.hex);
                    
                    if (index !== -1) {
                        aircraftData[index] = newAircraft;
                    } else {
                        aircraftData.push(newAircraft);
                    }
                    
                    lastUpdate = new Date();
                    
                } catch (e) {
                    console.error("Fehler beim Parsen der JSON-Zeile:", e.message);
                }
            }
        });
    });

    adsbProcess.stderr.on('data', (data) => {
        console.error(`ADSB-Prozess Fehler: ${data}`);
    });

    adsbProcess.on('close', (code) => {
        console.log(`ADSB-Prozess beendet mit Code ${code}`);
        // Optional: Neustart des Prozesses
        // setTimeout(startADSBProcess, 5000);
    });
    
    console.log("ADSB-Datenstrom-Prozess gestartet.");
}

startADSBProcess();

app.get('/', (req, res) => {
    // Sortiere die Daten für die Anzeige (optional)
    const sortedAircrafts = aircraftData.sort((a, b) => b.altitude - a.altitude);
    console.log(lastUpdate.toLocaleTimeString())
    res.render('index', {
        pageTitle: 'ADSB Live Tracker (Pipe/Socket)', // <-- pageTitle wird hier übergeben
        aircrafts: sortedAircrafts,
        lastUpdate: lastUpdate.toLocaleTimeString() // <-- lastUpdate wird hier übergeben
    });
});


app.get('/api/aircraft', (req, res) => {
    res.render('index', {
        pageTitle: 'ADSB Live Tracker (Pipe/Socket)',
        aircrafts: sortedAircrafts,
        lastUpdate: lastUpdate.toLocaleTimeString()
    });
});

app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});