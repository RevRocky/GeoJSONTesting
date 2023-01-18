const fs = require('fs');
const turf = require('@turf/turf');
const path = require('path');

/**
 * This script looks at all of the unzoned lands located in the file "UnzonedNonGreenSpace" and assigns each tract of land to a zone based upon the nearest 
 * lands that we have successfully zoned. We will then figure out which neighbourhood each plot belongs to and assign the correct metadata to the plot. This data
 * will then be saved before being homogenised with the rest of the neighbourhood dataset and saved separately
 */

const NEAREST_POINTS_TO_CONSIDER = 3;   // Completely Arbitrary. Might fiddle around with this to see if we can get better results should there be any obvious outliers. 


// Dont Use Global Variables... Kid...
const RESIDENTIAL_ZONES = new Set([
    "RESIDENTIAL",
    "RESIDENTIAL_LOW_DENSITY",
    "RESIDENTIAL_MID_HIGH",
    "MIXED_USE"
]);

const  NON_RESIDENTIAL_ZONES = new Set([
    "OPEN_SPACE",
    "UTILITY_TRANSPORT",
    "COMMERCIAL",
    "EMPLOYMENT",
    "INSTITUTIONAL", 
    "NOT_CATEGORISED"
]);

// Tiebreaker for assinging a zone when we have a tie breaker.
// Lower value means the tie will be broken in favour of that zone. 
const TIEBREAKER = {
    "RESIDENTIAL": 3,
    "RESIDENTIAL_LOW_DENSITY": 0,
    "RESIDENTIAL_MID_HIGH": 5,
    "MIXED_USE": 4,
    "UTILITY_TRANSPORT": 8,
    "COMMERCIAL": 1,
    "EMPLOYMENT": 2,
    "INSTITUTIONAL": 6,
    "NOT_CATEGORISED": 7,
}


function main() {

    const residentialAreas = JSON.parse(fs.readFileSync(path.join('.', 'data', '140NeighbourhoodsResidentialAreasByZone.geojson')));
    const nonResidentialAreas = JSON.parse(fs.readFileSync(path.join('.', 'data', '140NeighbourhoodsNonResidentialAreasByZone.geojson')));

    const allAreas =[...residentialAreas.features, ...nonResidentialAreas.features];

    // Turf makes comparing centre points easy... perhaps we can just look at what is the nearest centrepoint and assume it's that (knowing it cannot be OPEN_SPACE)
    const centrePoints = allAreas.map(feature => turf.centerOfMass(feature));

    const unzonedAreas = JSON.parse(fs.readFileSync(path.join('.', 'data', 'UnzonedNonOpenSpace.geojson'))).features;

    for (const unzonedArea of unzonedAreas) {
        const centrePoint = turf.centerOfMass(unzonedArea);
        console.log(`Matching Area with centrepoint: ${turf.getCoord(centrePoint)}`)

        const nearestPoints = nearestNpoints(centrePoint, centrePoints, NEAREST_POINTS_TO_CONSIDER);    // Three is

        // Basically using those indices to get at the "closest areas"
        const nearestAreas = nearestPoints.map(point => allAreas[point.index]);

        const zoneScores = {}

        // Assumption: We weight each closest point equally... Since we have a rather high density of 
        // areas: this should be okay enough for our purposes. 
        for (const area of nearestAreas) {
            let areaZoning = area.properties.ZONING
            // We know we don't have open space... so we don't need to count it..
            if (areaZoning !== "OPEN_SPACE") {
                if (zoneScores[areaZoning]) {
                    zoneScores[areaZoning] += 1;
                }
                else {
                    zoneScores[areaZoning] = 1
                }
            }
        }

        let highScore;
        for (const zone in zoneScores) {
            // No High score... set it.
            if (!highScore) {
                highScore = {
                    "zone": zone,       // I'm not enamoured with writing it this way...Especially as I can see this being reused in some way later on...
                    "score": zoneScores[zone]
                }
            }
            else if (zoneScores[zone] > highScore.zone) { // Higher Score trumps lower score
                highScore = {
                    "zone": zone,      
                    "score": zoneScores[zone]               
                }
            }
            else if (zoneScores[zone] === highScore.score) {
                // Go to the arbitrary tiebreaker. REMEMBER: LOWER IS BETTER
                if (TIEBREAKER[zone] < TIEBREAKER[highScore.zone]) {
                    highScore = {
                        "zone": zone,      
                        "score": zoneScores[zone]               
                    };
                }
            }
            // Implicit Else: Don't update the high score
        }

        // This can happen if all of them are OPEN_SPACE
        if (!highScore) {
            highScore = {
                zone: "RESIDENTIAL_LOW_DENSITY",
                score: "DEFAULT"
            }
        }

        // We now can classify our land.
        unzonedArea.properties.ZONING = highScore.zone;
        unzonedArea.properties.LAND_USE = RESIDENTIAL_ZONES.has(highScore.zone) ? "RESIDENTIAL" : "NON-RESIDENTIAL";
        unzonedArea.properties.ZONE_LAND_AREA = turf.convertArea(turf.area(unzonedArea), "metres", "kilometres");

        console.log(`\tAssigned to zone: ${highScore.zone}`);
        console.log(`\tScore ${highScore.score}`);
    }

    const newlyZonedAreas = turf.featureCollection(unzonedAreas);

    fs.writeFileSync(path.join('.', 'data', 'AlgorithmicallyZonedAreas.geojson'), 
        JSON.stringify(newlyZonedAreas));


}

/**
 * Compares a supplied point with a collection of points to find the n nearest neighbours and returns an array containing the indices of the 
 * n nearest points ranked in order from closest to furthest. 
 * 
 * @param {import('@turf/helpers').Point} referencePoint The point we want to find the nearest neighbours of
 * @param {Array<import('@turf/helpers').Point>} pointCollection A collection of points that we will be comparing our referencePoint to
 * @param {number} n The amount of closest neighbours we want to track. Defaults to 1
 * 
 * @returns {Array<object>} An array (size n) of the n closest points within the pointCollection to the referencePoint. This array is sorted so 
 * that the first position is the closest point, and n is the n-th closest point.  Both the index of the point and the distance of the referencePoint 
 * will be in an object with the following description.
 * 
 * {
 *      "index": <number>,
 *      "distance": <number>
 * }
 */
function nearestNpoints(referencePoint, pointCollection, n = 1) {
    if (n < 1 || isNaN(n)) {
        throw new Error("The parameter 'n' must be a number at least 1 or greater")
    }
    


    nearestPoints = [];
    for (let i = 0; i < pointCollection.length; i++) {
        nearestPoints.push({
            index: i,
            distance: turf.distance(referencePoint, pointCollection[i])
        });
    }

    nearestPoints.sort((pointA, pointB) => pointA.distance - pointB.distance);

    return n <= pointCollection.length ? nearestPoints.slice(0, n) : nearestPoints;
}

main();