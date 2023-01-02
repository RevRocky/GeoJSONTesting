const fs = require('fs');
const turf = require('@turf/turf');
const path = require('path');
const yargs = require(`yargs`)
    .usage(`Usage $0 --source_geo=[file] --filter_geo=[file] --out=[file]`)
    .alias('s', "source_geo")
    .alias('f', "filter-geo")
    .alias('o', 'out')
    .demandOption(['s', 'f', 'o'])
    .argv

function main() {
    const sourceFile = yargs.s;
    const filterFile = yargs.f;
    const outFile = yargs.o
    let source, filter;
    try {
        source = JSON.parse(fs.readFileSync(sourceFile), 'utf-8');
    }
    catch (err) {
        console.error(`Unable to open the source geography file at ${sourceFile}. Check you've entered the correct file\nExiting...`);
        process.exit(1);
    }

    try {
        filter = JSON.parse(fs.readFileSync(filterFile), 'utf-8');
    }
    catch (err) {
        console.error(`Unable to open the filter geography file at ${filterFile}. Check you've entered the correct file\nExiting...`);
        process.exit(1);
    }

    // Writing it this way to allow for some code reuse later
    const outGeography = filterGeography(source, filter);

    // Check that directory of outfile exists
    const outDir = path.dirname(outFile);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, {recursive: true});
    }

    fs.writeFileSync(outFile, JSON.stringify(outGeography));
}

/**
 * Filters the features in the FeatureCollection "source" through the filter Feature "filter". Returning a FeatureCollection with only thosse features
 * located entirely within the filter's geography
 * @param {import('@turf/helpers').FeatureCollection} source 
 * @param {import('@turf/helpers').Feature} filter 
 * 
 * @returns {import('@turf/helpers').FeatureCollection} A reduced feature collection with only those geographies within the filter In the case that there is MultiPolygon
 * in the sourceGeography: ALL sub polygons must be included within the filter grogr
 */
function filterGeography(sourceGeo, filterGeo) {
    // Sanity Check for Types
    if (sourceGeo.type !== "FeatureCollection") {
        throw Error("The source geography is not of type \"FeatureCollection\".");
    }
    else if (filterGeo.type !==  "Feature") {
        throw Error("The filter geography is not of type \"Feature\".");
    }

    let features = sourceGeo.features;
    let filteredGeography = features.filter((feature) => {
        if (feature.geometry.type === "MultiPolygon") {
            const polygonSet = separateMultiPolygon(feature);
            
            // I opt not use turf.featureReduce here because we want to fail fast
            let isMultipolygonContained = true;
            let i = 0;

            // Aww yes. A do-while.
            do {
                isMultipolygonContained &&= turf.booleanIntersects(filterGeo, polygonSet.features[i]);
            }
            while (isMultipolygonContained && ++i < polygonSet.features.length);

            return isMultipolygonContained;
        }
        else {
            return turf.booleanIntersects(filterGeo, feature);
        }
        
    });

    return turf.featureCollection(filteredGeography);
}


/**
 * Reduces a MultiPolygon to a FeatureCollection containing just polygons
 * @param {import('@turf/helpers').MultiPolygon} multiPolygon A multi polygon we wish to reduce to a collection of polygons
 * @returns {import('@turf/helpers').FeatureCollection} 
 */
function separateMultiPolygon(multiPolygon) {
    if (multiPolygon.geometry.type !== "MultiPolygon") {
        throw Error("The source geography is not of type \"MultiPolygon\".");
    }

    let polygons = [];
    for (const coordSet of turf.getCoords(multiPolygon)) {
        polygons.push(turf.polygon(coordSet, multiPolygon.properties));
    }

    return turf.featureCollection(polygons)
}


main();