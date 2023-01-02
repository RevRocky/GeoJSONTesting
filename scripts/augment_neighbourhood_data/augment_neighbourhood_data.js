const fs = require('fs');
const path = require('path');


const DATA_WE_CARE_ABOUT = {
    "Population, 2016": "POPULATION",
    "Land area in square kilometres": "LAND_AREA",
    "Occupied private dwellings by structural type of dwelling": "RESIDENTIAL_DWELLINGS",
    "Single-detached house": "SINGLE_FAMILY_DWELLINGS",
    "Apartment in a building that has five or more storeys": "MID_HIGH_RISE_APARTMENTS",
    "Other attached dwelling": "OTHER_ATTACHED_DWELLINGS",
    "Semi-detached house": "SEMI_DETACHED_DWELLINGS",
    "Apartment or flat in a duplex": "DUPLEX_UNITS",
    "Row house": "ROW_HOUSES",
    "Apartment in a building that has fewer than five storeys": "LOW_RISE_APARTMENTS",
    "Other single-attached house": "OTHER_SINGLE_ATTACHED_DWELLING"
};


// Take Toronto Neighbourhood Data and inject it into the GeoJSON file. 
function main() {
    // Open files


    let neighbourhoodsGeo = JSON.parse(fs.readFileSync(path.join(".", "data", "140Neighbourhoods.geojson")));
    const [neighbourhoods, ...data] = JSON.parse(fs.readFileSync(path.join(".", "data", "140NeighbourhoodProfiles.json")));
    
    // Doctor our Neighbourhoods Profile
    let neighbourhoodsMap = new Map();

    // Reversing this is easier
    for (let neighbourhood in neighbourhoods) {
        const neighbourhoodNum = neighbourhoods[neighbourhood]
        neighbourhoodsMap.set(neighbourhoodNum, neighbourhood);
    }

    let characteristic, neighbourhoodId;
    for (const category of data) {
        characteristic = category["Characteristic"]
        if (DATA_WE_CARE_ABOUT[characteristic]) {
            for (const neighbourhood of neighbourhoodsGeo.features) {
                neighbourhoodId = String(neighbourhood.properties["AREA_SHORT_CODE"]);
                neighbourhood.properties[DATA_WE_CARE_ABOUT[characteristic]] = Number(category[neighbourhoodsMap.get(neighbourhoodId)].replace(/,/g, ''));
            }
        }
    }

    // The density numbers provided are not actually floating point numbers. Imagine.
    for (const neighbourhood of neighbourhoodsGeo.features) {
        neighbourhood.properties["DENSITY"] = neighbourhood.properties["POPULATION"] / neighbourhood.properties["LAND_AREA"];
    }

    fs.writeFileSync(path.join('.', 'data', '140NeighbourhoodsAugmented.geojson'), JSON.stringify(neighbourhoodsGeo));
    
}

main()