const { onRequest } = require('firebase-functions/v2/https')
const logger = require('firebase-functions/logger')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const axios = require('axios')

initializeApp()

const db = getFirestore()
const MELBOURNE_DATA_URL =
  'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/bicycle-routes-including-informal-on-road-and-off-road-routes/records'
const REGIONS_TO_IMPORT = [
  { name: 'Carlton', limit: 15 },
  { name: 'Docklands', limit: 15 },
  { name: 'East Melbourne', limit: 15 },
  { name: 'Kensington', limit: 15 },
  { name: 'Melbourne CBD', limit: 20 },
  { name: 'Melbourne Remainder', limit: 15 },
  { name: 'North Melbourne', limit: 15 },
  { name: 'Parkville', limit: 15 },
  { name: 'Port Melbourne', limit: 15 },
  { name: 'South Yarra', limit: 15 },
  { name: 'Southbank', limit: 15 },
  { name: 'West Melbourne Industrial', limit: 15 },
  { name: 'West Melbourne Residential', limit: 15 },
]

function findCoordinates(value, coordinates = []) {
  if (!Array.isArray(value)) return coordinates

  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    coordinates.push(value)
    return coordinates
  }

  value.forEach((item) => findCoordinates(item, coordinates))
  return coordinates
}

function findCentre(geometry) {
  const coordinates = findCoordinates(geometry?.coordinates)

  if (coordinates.length === 0) return null

  const totals = coordinates.reduce(
    (sum, coordinate) => ({
      longitude: sum.longitude + coordinate[0],
      latitude: sum.latitude + coordinate[1],
    }),
    { longitude: 0, latitude: 0 },
  )

  return {
    latitude: totals.latitude / coordinates.length,
    longitude: totals.longitude / coordinates.length,
  }
}

function prepareSegment(record) {
  return {
    sourceId: String(record.objectid),
    segmentDescription: record.segmentdescription || 'Unnamed cycling segment',
    description: record.description || '',
    laneType: record.lanetype || '',
    protection: record.protection || '',
    surfaceTreatment: record.surfacetreatment || '',
    length: Number(record.length) || 0,
    region: record.clueregion || '',
    active: record.active === 'Yes',
    geometry: JSON.stringify(record.json_geometry),
    centre: findCentre(record.json_geometry),
    source: 'City of Melbourne Open Data',
    sourceUrl:
      'https://data.melbourne.vic.gov.au/explore/dataset/bicycle-routes-including-informal-on-road-and-off-road-routes/',
    importedAt: FieldValue.serverTimestamp(),
  }
}

exports.apiStatus = onRequest({ cors: true }, (request, response) => {
  logger.info('API status checked')

  response.status(200).json({
    message: 'Pedal Melbourne API is running',
  })
})

exports.importCyclingSegments = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Use a POST request to import segments.' })
    return
  }

  try {
    const apiRequests = REGIONS_TO_IMPORT.map((region) =>
      axios.get(MELBOURNE_DATA_URL, {
        params: {
          limit: region.limit,
          select:
            'objectid,segmentdescription,description,lanetype,protection,surfacetreatment,length,clueregion,active,json_geometry',
          where: `active="Yes" and clueregion="${region.name}"`,
        },
        timeout: 15000,
      }),
    )

    const apiResponses = await Promise.all(apiRequests)
    const records = apiResponses.flatMap(
      (apiResponse) => apiResponse.data.results || [],
    )

    const existingSegments = await db.collection('cyclingSegments').get()
    const deleteBatch = db.batch()

    existingSegments.docs.forEach((document) => {
      deleteBatch.delete(document.ref)
    })

    await deleteBatch.commit()

    const batch = db.batch()

    records.forEach((record) => {
      const documentReference = db
        .collection('cyclingSegments')
        .doc(String(record.objectid))

      batch.set(documentReference, prepareSegment(record))
    })

    await batch.commit()

    logger.info('Cycling segments imported', { count: records.length })
    response.status(200).json({
      message: 'Cycling segments imported successfully',
      importedCount: records.length,
      regions: REGIONS_TO_IMPORT.map((region, index) => ({
        name: region.name,
        importedCount: apiResponses[index].data.results?.length || 0,
      })),
    })
  } catch (error) {
    logger.error('Unable to import cycling segments', error)
    response.status(500).json({
      message: 'Cycling segments could not be imported.',
    })
  }
})
