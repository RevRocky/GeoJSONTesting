const fs = require('fs');
const turf = require('turf');
const turfHelpers = require('@turf/helpers');
const path = require('path');

const ZONE_KEY = {
    "R": "Residential",
    "RD": "Residential Detached",
    "RS": "Residential Semi",
    "RT": "Residential Townhouse",
    "RM": "Residential Multiple Dwelling",
    "RA": "Residential Apartment",
    "RAC": "Residential Apartment Commercial",
    "O": "Open Space",
    "ON": "Open Space Natural",
    "OR": "Open Space Recreation",
    "OG": "Golf",
    "OM": "Marina",
    "OC": "Cemetery",
    "UT": "Utility + Transportation",
    "CL": "Commercial Local",
    "CR": "Commercial Residential",
    "CRE": "Commercial Residential Employment",
    "EL": "Employment Light Industrial",
    "E": "Employment Industrial",
    "EH": "Employment Industrial",
    "EO": "Employment Industrial Office",
    "I": "Institutional General",
    "IH": "Hospital",
    "IE": "Educational",
    "IS": "School",
    "IPW": "House of God"
};

const SIMPLE_ZONES_FILE = path.join('data', 'SimpleZonesV1.geojson');

const COLOURS = {
    "DARK_YELLOW": "#ffa500",
    "LIGHT_YELLOW": "#fff68f",
    "YELLOW": "#fff00",
    "BLUE": "#0000ff",
    "GREEN": "#008000",
    "GREY": "#c0d6e4",
    "RED": "#cc0000",
    "PINK": "#ff1493",
    "WHITE": "#ffffff"
};

// Dont Use Global Variables... Kid...
const SIMPLE_ZONES = {
    "Residential(General)": null,
    "Residential (Low Density)": null,
    "Residential (Mid-to-High Density)": null,
    "Mixed Use": null,
    "Open Space": null,
    "Utility and Transportation": null,
    "Commercial": null,
    "Employment": null,
    "Institutional": null,
    "Not Categorised": null
};


function main() {

    let simpleZones;
    
    try {
        // This is just to save time, lol. It takes, 20 minutes to do the simplification each time. It's nuts. 
        simpleZones = JSON.parse(fs.readFileSync(SIMPLE_ZONES_FILE), 'utf-8');
    } 
    catch (err) {
        simpleZones = simplifyZones();
    }
}


function simplifyZones() {
    const sourceZones = JSON.parse(fs.readFileSync(path.join("data", "Zoning Area.geojson"))).features;



    // This should reduce everything down.
    let i = sourceZones.length;
    for (const feature of sourceZones) {
        console.log(`Features Remaining: ${i--}`);
        switch (feature.properties["ZN_ZONE"]) {
            case "R":
            case "RS":
               addToSimplifiedZone(feature, "Residential")
            break;
            case "RD":
            case "RT":
                addToSimplifiedZone(feature, "Residential (Low Density)")
            break;
            case "RA":
            case "RM":
                addToSimplifiedZone(feature, "Residential (Mid-to-High Density)");
            break;
            case "RAC":
            case "CR":
            case "CRE":
                addToSimplifiedZone(feature, "Mixed Use");
            break;
            case "O":
            case "ON":
            case "OR":
            case "OG":
            case "OM":
            case "OC":
                addToSimplifiedZone(feature, "Open Space");
            break;
            case "UT":
                addToSimplifiedZone(feature, "Utility and Transportation");
            break;
            case "CL":
                addToSimplifiedZone(feature, "Commercial");
            break;
            case "EL":
            case "E":
            case "EH":
            case "EO":
                addToSimplifiedZone(feature, "Employment");
            break;
            case "I":
            case "IH":
            case "IE":
            case "IS":
            case "IPW":
                addToSimplifiedZone(feature, "Institutional");
            break
            default:
                addToSimplifiedZone(feature, "Not Categorised");
            break
        }
    }

    delete sourceZones;

    // A Sanity Check
    // This is lazy midnight code that I would never put in anything else
    const featureArray = [];
    for (const zone in SIMPLE_ZONES) {
        if (SIMPLE_ZONES[zone] != null) {
            const area = turf.area(SIMPLE_ZONES[zone]);
            console.log(`The total area of ${zone} zoned land in Toronto is: ${turfHelpers.convertArea(area, "metres", "kilometres")} sq. km. (${turfHelpers.convertArea(area, "metres", "hectares")} ha.)`)
            
            // Adding Some Metadata
            SIMPLE_ZONES[zone].properties.type = zone
            featureArray.push(SIMPLE_ZONES[zone])
        }
    }

    // Recast to a Feature Collection (this probably could have been done above...)si

    let simpleZones = turf.featureCollection(featureArray);
    fs.writeFileSync(SIMPLE_ZONES_FILE, JSON.stringify(simpleZones));

    return simpleZones;
}

/**
 * 
 * @param {Feature<Polygon | MultiPolygon>} feature The polygon of the zone that we are adding to the multi-zone of the polygon
 * @param {string} zone The 
 */
function addToSimplifiedZone(feature, zone) {
    if (SIMPLE_ZONES[zone] == null) {
        SIMPLE_ZONES[zone] = feature;
    }
    else {
        SIMPLE_ZONES[zone] = turf.union(SIMPLE_ZONES[zone], feature);
    }
}

main()