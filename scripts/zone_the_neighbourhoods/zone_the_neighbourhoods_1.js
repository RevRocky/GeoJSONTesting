const fs = require('fs');
const turf = require('@turf/turf');
const path = require('path');

/**
 * This script is meant to take a Simplified Zoning file and take away all of the non residential
 * lands including transportation, employment and institutional landuses.  
 * 
 * Residential Lands will be appropriately tagged and have land area and population densities recalculated.
 *
 * Two GeoJSON files are created. One with all residential lands treated as equal. One where neighbourhoods are appropriately split into the different
 * residential zones. 
 * 
 * This does the easy part of sorting the zoned lands that we can into two buckets. An additional script (part II, same folder) is used to figure out what to do 
 * with all outstanding lands.
 * 
 * Lands removed from neighbourhoods will be amalgamated into a couple different buckets 
 */

// Dont Use Global Variables... Kid...
const RESIDENTIAL_ZONES ={
    "Residential": "RESIDENTIAL",
    "Residential (Low Density)": "RESIDENTIAL_LOW_DENSITY",
    "Residential (Mid-to-High Density)": "RESIDENTIAL_MID_HIGH",
    "Mixed Use": "MIXED_USE"
};

const NON_RESIDENTIAL_ZONES = {
    "Open Space": "OPEN_SPACE",
    "Utility and Transportation": "UTILITY_TRANSPORT",
    "Commercial": "COMMERCIAL",
    "Employment": "EMPLOYMENT",
    "Institutional": "INSTITUTIONAL", 
    "Not Categorised": "NOT_CATEGORISED"
};

function main() {

    const neighbourhoodData = JSON.parse(fs.readFileSync(path.join('.', 'data', '140NeighbourhoodsAugmented.geojson')));
    const zoningData = JSON.parse(fs.readFileSync(path.join('.', 'data', 'SimpleZonesV1.geojson')));

    const neighbourhoodsGeo = neighbourhoodData.features;

    let zonesGeo = turf.flatten(zoningData).features;


    // Create a GeoJSON that does not discriminate which type of land we are dealing with. Two big categories. Residential and non residential
    const residentialZoneGeo = zonesGeo.filter((zone => RESIDENTIAL_ZONES[zone.properties.type] !== undefined))
    const nonResidentialZoneGeo = zonesGeo.filter((zone) => NON_RESIDENTIAL_ZONES[zone.properties.type] !== undefined);
    
    let justResidentialGeo = [];
    let justNonResidentialGeo = [];
    let tempGeo;

    /*
    // There is probably a clearer way to write this... Basically, we want to progressively chop off all of the non
    // residential lands from existing neighbourhoods. 
    for (const neighbourhood of neighbourhoodsGeo) {
        let difference = neighbourhood
        tempGeo = null;
        for(const nonResidentialZone of nonResidentialZoneGeo) {
            // Chip away slowly
            try {
                difference = turf.difference(difference, nonResidentialZone)
            }
            catch (err) {
                console.error(`Unable to Take Difference of ${neighbourhood.properties.AREA_NAME} with ${nonResidentialZone.properties.type}. Will continue
                on the presumption that all land is residential`);
            }
            
            difference.properties =  Object.assign({
                LAND_USE: "RESIDENTIAL",
                RESIDENTIAL_LAND_AREA: turf.convertArea(turf.area(difference), "metres", "kilometres")
            }, neighbourhood.properties);
            justResidentialGeo.push(difference);

            // Eeh lets just reuse the temp geo
            tempGeo = turf.difference(neighbourhood, difference);

            if (tempGeo !== null) {
                tempGeo.properties = Object.assign({
                    LAND_USE: "NON_RESIDENTIAL",
                    NON_RESIDENTIAL_LAND_AREA: turf.convertArea(turf.area(tempGeo, "metres", "kilometres"))
                }, neighbourhood.properties);
                justNonResidentialGeo.push(tempGeo);
            }
        }

    }

    // Save those geoJSONs
    fs.writeFileSync(path.join('.', 'data', '140NeighbourhoodsResidentialAreas.geojson'), 
        JSON.stringify(turf.featureCollection(justResidentialGeo)));

    fs.writeFileSync(path.join('.', 'data', '140NeighbourhoodsNonResidentialAreas.geojson'), 
        JSON.stringify(turf.featureCollection(justNonResidentialGeo)));

    */

    // Create a GeoJSONs which discriminate between each type of zoned land within a neighbourhood. 
    let residentialZonesByNeighbourhood = [];
    let nonResidentialZonesByNeighbourhood = [];
    let intersect;

    for (const neighbourhood of neighbourhoodsGeo) {
        for(const residentialZone of residentialZoneGeo) {
            // Intersect with each type of residential zoning
            try {
                intersect = turf.intersect(neighbourhood, residentialZone);

                if (intersect === null) {
                    continue;
                }

                intersect.properties = Object.assign({
                    "LAND_USE": residentialZone.properties.type === "Mixed Use" ? "MIXED_USE" : "RESIDENTIAL",
                    "ZONE_LAND_AREA": turf.convertArea(turf.area(intersect, "metres", "kilometres")),
                    "ZONING": RESIDENTIAL_ZONES[residentialZone.properties.type]
                }, neighbourhood.properties)

                residentialZonesByNeighbourhood.push(intersect);
            }
            catch (err) {
                console.error(`Unable to Intersect ${neighbourhood.properties.AREA_NAME} with ${residentialZone.properties.type}. Will continue
                    on the presumption that there is nooverlap of the two zoning types. `);
            }
        }

        // I should turn this into a bloody function, shouldn't I?
        for (const nonResidentialZone of nonResidentialZoneGeo) {
            // Intersect with each type of non-residential zoning
            try {
                intersect = turf.intersect(neighbourhood, nonResidentialZone);

                if (intersect === null) {
                    continue;
                }

                intersect.properties = Object.assign({
                    "LAND_USE": "NON-RESIDENTIAL",
                    "ZONE_LAND_AREA": turf.convertArea(turf.area(intersect, "metres", "kilometres")),
                    "ZONING": NON_RESIDENTIAL_ZONES[nonResidentialZone.properties.type]
                }, neighbourhood.properties)

                nonResidentialZonesByNeighbourhood.push(intersect);
            }
        
            catch (err) {
                console.error(`Unable to Intersect ${neighbourhood.properties.AREA_NAME} with ${nonResidentialZone.properties.type}. Will continue
                on the presumption that there is nooverlap of the two zoning types. `);
            }
        }
    }


    // Save that GeoJSON
    fs.writeFileSync(path.join('.', 'data', '140NeighbourhoodsResidentialAreasByZone.geojson'), 
        JSON.stringify(turf.featureCollection(residentialZonesByNeighbourhood)));

    fs.writeFileSync(path.join('.', 'data', '140NeighbourhoodsNonResidentialAreasByZone.geojson'), 
        JSON.stringify(turf.featureCollection(nonResidentialZonesByNeighbourhood)));
    
    

}




main();

