import simpleZones from './data/SimpleZones.json' assert { type: "jSON "};

const TORONTO_COORDINATES = [43.6529, -79.3849];
const DEFAULT_ZOOM = 12;
const simpleZonesObject = JSON.parse(simpleZones);

console.log('here');

function buildMap() {
    let map = L.map('map').setView(TORONTO_COORDINATES, DEFAULT_ZOOM);

    // Create our Map
    
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    
    // Add ourpolygons
    
    L.geoJSON(simpleZonesObject).addTo(map);

    // Make pretty
}

buildMap()


