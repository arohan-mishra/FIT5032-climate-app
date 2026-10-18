const { onRequest } = require('firebase-functions/v2/https')
const logger = require('firebase-functions/logger')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { defineSecret } = require('firebase-functions/params')
const axios = require('axios')

initializeApp()

const db = getFirestore()
const adminAuth = getAuth()
const openRouteServiceApiKey = defineSecret('OPENROUTESERVICE_API_KEY')
const MELBOURNE_DATA_URL =
  'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/bicycle-routes-including-informal-on-road-and-off-road-routes/records'
const OPENROUTESERVICE_URL =
  'https://api.heigit.org/openrouteservice/v2/directions/cycling-regular/geojson'
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

async function verifyUser(request) {
  const authorization = request.headers.authorization || ''

  if (!authorization.startsWith('Bearer ')) return null

  const idToken = authorization.substring(7)
  return adminAuth.verifyIdToken(idToken)
}

exports.apiStatus = onRequest({ cors: true }, (request, response) => {
  logger.info('API status checked')

  response.status(200).json({
    message: 'Pedal Melbourne API is running',
  })
})

exports.getAdminDashboard = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== 'GET') {
    response.status(405).json({ message: 'Use a GET request to load dashboard statistics.' })
    return
  }

  try {
    const user = await verifyUser(request)

    if (!user) {
      response.status(401).json({ message: 'Log in before loading the admin dashboard.' })
      return
    }

    const profile = await db.collection('users').doc(user.uid).get()

    if (!profile.exists || profile.data().role !== 'admin') {
      response.status(403).json({ message: 'Administrator access is required.' })
      return
    }

    const users = db.collection('users')
    const [
      totalUsersSnapshot,
      regularUsersSnapshot,
      administratorsSnapshot,
      eventsSnapshot,
      segmentsSnapshot,
      ratingsSnapshot,
    ] = await Promise.all([
      users.count().get(),
      users.where('role', '==', 'user').count().get(),
      users.where('role', '==', 'admin').count().get(),
      db.collection('events').count().get(),
      db.collection('cyclingSegments').count().get(),
      db.collection('ratings').select('score', 'segmentId').get(),
    ])

    const ratingScores = ratingsSnapshot.docs
      .map((document) => Number(document.data().score))
      .filter((score) => Number.isInteger(score) && score >= 1 && score <= 5)
    const ratingTotal = ratingScores.reduce((total, score) => total + score, 0)
    const ratedSegments = new Set(
      ratingsSnapshot.docs.map((document) => document.data().segmentId).filter(Boolean),
    )

    response.status(200).json({
      users: {
        total: totalUsersSnapshot.data().count,
        regular: regularUsersSnapshot.data().count,
        administrators: administratorsSnapshot.data().count,
      },
      content: {
        events: eventsSnapshot.data().count,
        cyclingSegments: segmentsSnapshot.data().count,
      },
      ratings: {
        total: ratingScores.length,
        ratedSegments: ratedSegments.size,
        average: ratingScores.length ? ratingTotal / ratingScores.length : null,
      },
    })
  } catch (error) {
    if (error.code?.startsWith('auth/')) {
      response.status(401).json({ message: 'Your login session is invalid.' })
      return
    }

    logger.error('Unable to load admin dashboard statistics', error)
    response.status(500).json({
      message: 'Dashboard statistics could not be loaded.',
    })
  }
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

exports.getCyclingRoute = onRequest(
  { cors: true, secrets: [openRouteServiceApiKey], timeoutSeconds: 120 },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ message: 'Use a POST request to generate a route.' })
      return
    }

    try {
      const user = await verifyUser(request)

      if (!user) {
        response.status(401).json({ message: 'Log in before generating a route.' })
        return
      }

      const latitude = Number(request.body?.latitude)
      const longitude = Number(request.body?.longitude)
      const distance = Number(request.body?.distance)

      if (
        !Number.isFinite(latitude)
        || latitude < -90
        || latitude > 90
        || !Number.isFinite(longitude)
        || longitude < -180
        || longitude > 180
        || !Number.isInteger(distance)
        || distance < 1000
        || distance > 20000
      ) {
        response.status(400).json({
          message: 'Provide valid coordinates and a distance from 1000 to 20000 metres.',
        })
        return
      }

      const routes = []

      for (const seed of [1, 2, 3]) {
        const routeResponse = await axios.post(
          OPENROUTESERVICE_URL,
          {
            coordinates: [[longitude, latitude]],
            options: {
              round_trip: {
                length: distance,
                points: 5,
                seed,
              },
            },
          },
          {
            headers: {
              Authorization: openRouteServiceApiKey.value(),
              Accept: 'application/geo+json',
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        )
        routes.push(routeResponse.data)
      }

      logger.info('Cycling routes generated', {
        userId: user.uid,
        requestedDistance: distance,
        routeCount: routes.length,
      })
      response.status(200).json({ routes })
    } catch (error) {
      if (error.code?.startsWith('auth/')) {
        response.status(401).json({ message: 'Your login session is invalid.' })
        return
      }

      logger.error('Unable to generate cycling route', {
        status: error.response?.status,
        code: error.code,
        message: error.message,
        serviceMessage: error.response?.data?.error?.message,
      })

      if (error.code === 'ECONNABORTED') {
        response.status(504).json({
          message: 'OpenRouteService took too long to generate the routes. Please try again.',
        })
        return
      }

      if ([401, 403].includes(error.response?.status)) {
        response.status(502).json({
          message: 'OpenRouteService rejected the API key or its daily quota has been reached.',
        })
        return
      }

      if (error.response?.status === 429) {
        response.status(429).json({
          message: 'The OpenRouteService request limit has been reached. Please wait and try again.',
        })
        return
      }

      response.status(502).json({
        message: 'The cycling route could not be generated. Please try again.',
      })
    }
  },
)
