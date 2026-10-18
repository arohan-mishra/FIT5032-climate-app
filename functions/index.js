const { onRequest } = require('firebase-functions/v2/https')
const logger = require('firebase-functions/logger')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { defineSecret } = require('firebase-functions/params')
const axios = require('axios')
const sendGridMail = require('@sendgrid/mail')

initializeApp()

const db = getFirestore()
const adminAuth = getAuth()
const openRouteServiceApiKey = defineSecret('OPENROUTESERVICE_API_KEY')
const sendGridApiKey = defineSecret('SENDGRID_API_KEY')
const sendGridFromEmail = defineSecret('SENDGRID_FROM_EMAIL')
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

function safeText(value, maximumLength) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, maximumLength)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeCalendarText(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('\r', '')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}

function formatCalendarDate(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`
}

function eventDateRange(event) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(event.eventDate || ''))
  const timeMatch = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(event.time || ''))
  const duration = Number.isInteger(event.durationMinutes) ? event.durationMinutes : 90

  if (!dateMatch || !timeMatch || duration < 30 || duration > 240) return null

  const [, yearText, monthText, dayText] = dateMatch
  const [, hourText, minuteText, periodText] = timeMatch
  const hour = Number(hourText) % 12 + (periodText.toLowerCase() === 'pm' ? 12 : 0)
  const minute = Number(minuteText)
  const startDate = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText), hour, minute))
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000)

  if (Number.isNaN(startDate.getTime())) return null

  const localDateTime = (date) => {
    const formatted = formatCalendarDate(date)
    return `${formatted.slice(0, 4)}-${formatted.slice(4, 6)}-${formatted.slice(6, 8)}T${formatted.slice(9, 11)}:${formatted.slice(11, 13)}:00`
  }

  return {
    start: localDateTime(startDate),
    end: localDateTime(endDate),
    calendarStart: formatCalendarDate(startDate),
    calendarEnd: formatCalendarDate(endDate),
  }
}

function createCalendarAttachment(event, userId) {
  const range = eventDateRange(event)
  if (!range) throw new Error('The event has an invalid date or time.')

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pedal Melbourne//Event Registration//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeCalendarText(`${event.id}-${userId}@pedal-melbourne`)}`,
    `DTSTAMP:${formatCalendarDate(new Date())}Z`,
    `DTSTART;TZID=Australia/Melbourne:${range.calendarStart}`,
    `DTEND;TZID=Australia/Melbourne:${range.calendarEnd}`,
    `SUMMARY:${escapeCalendarText(event.title)}`,
    `LOCATION:${escapeCalendarText(event.location)}`,
    `DESCRIPTION:${escapeCalendarText(`Organised by ${event.organiser || 'Pedal Melbourne'}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return {
    content: Buffer.from(calendar).toString('base64'),
    filename: `pedal-melbourne-event-${event.id}.ics`,
    type: 'text/calendar',
    disposition: 'attachment',
  }
}

async function authenticatedAccount(request) {
  const user = await verifyUser(request)
  if (!user) return null

  const profileSnapshot = await db.collection('users').doc(user.uid).get()
  if (!profileSnapshot.exists) return null

  return { user, profile: profileSnapshot.data() }
}

function isAuthenticationError(error) {
  return typeof error.code === 'string' && error.code.startsWith('auth/')
}

function configureSendGrid() {
  sendGridMail.setApiKey(sendGridApiKey.value())
  return { email: sendGridFromEmail.value(), name: 'Pedal Melbourne' }
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

exports.getMyEventRegistrations = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== 'GET') {
    response.status(405).json({ message: 'Use a GET request to load event registrations.' })
    return
  }

  try {
    const account = await authenticatedAccount(request)
    if (!account) {
      response.status(401).json({ message: 'Log in before loading event registrations.' })
      return
    }

    const registrationsSnapshot = await db
      .collection('eventRegistrations')
      .where('userId', '==', account.user.uid)
      .get()
    const registrations = registrationsSnapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((first, second) => first.start.localeCompare(second.start))

    response.status(200).json({ registrations })
  } catch (error) {
    if (isAuthenticationError(error)) {
      response.status(401).json({ message: 'Your login session is invalid.' })
      return
    }
    logger.error('Unable to load event registrations', error)
    response.status(500).json({ message: 'Event registrations could not be loaded.' })
  }
})

exports.registerForEvent = onRequest(
  { cors: true, secrets: [sendGridApiKey, sendGridFromEmail], timeoutSeconds: 60 },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ message: 'Use a POST request to register for an event.' })
      return
    }

    let registrationReference

    try {
      const account = await authenticatedAccount(request)
      if (!account) {
        response.status(401).json({ message: 'Log in before registering for an event.' })
        return
      }

      const eventId = safeText(request.body?.eventId, 100)
      const riders = Number(request.body?.riders)

      if (!eventId || eventId.includes('/') || !Number.isInteger(riders) || riders < 1 || riders > 6) {
        response.status(400).json({ message: 'Choose a valid event and a rider count from 1 to 6.' })
        return
      }

      const [eventSnapshot, currentRegistrations] = await Promise.all([
        db.collection('events').doc(eventId).get(),
        db.collection('eventRegistrations').where('userId', '==', account.user.uid).get(),
      ])

      if (!eventSnapshot.exists) {
        response.status(404).json({ message: 'The selected event could not be found.' })
        return
      }

      const event = { id: eventSnapshot.id, ...eventSnapshot.data() }
      const range = eventDateRange(event)
      if (!range) {
        response.status(422).json({ message: 'The selected event has an invalid date or time.' })
        return
      }

      const conflictingRegistration = currentRegistrations.docs
        .map((document) => document.data())
        .find((registration) => range.start < registration.end && range.end > registration.start)

      if (conflictingRegistration) {
        response.status(409).json({
          message: `This event overlaps with your registration for ${conflictingRegistration.eventTitle}.`,
        })
        return
      }

      const email = safeText(account.user.email || account.profile.email, 120).toLowerCase()
      const name = safeText(account.profile.name, 80)
      if (!email || !name) {
        response.status(422).json({ message: 'Your account profile is missing a name or email address.' })
        return
      }

      const registration = {
        eventId,
        eventTitle: safeText(event.title, 160),
        eventLocation: safeText(event.location, 160),
        userId: account.user.uid,
        name,
        email,
        riders,
        start: range.start,
        end: range.end,
        registeredAt: FieldValue.serverTimestamp(),
      }

      registrationReference = db.collection('eventRegistrations').doc(`${eventId}_${account.user.uid}`)
      await registrationReference.create(registration)

      const from = configureSendGrid()
      const attachment = createCalendarAttachment(event, account.user.uid)
      await sendGridMail.send({
        to: email,
        from,
        subject: safeText(`Registration confirmed: ${event.title}`, 140),
        text: `Hello ${name},\n\nYour registration for ${event.title} is confirmed.\nDate: ${event.eventDate}\nTime: ${event.time}\nLocation: ${event.location}\nRiders: ${riders}\n\nThe attached calendar file can be opened in your calendar application.`,
        html: `<p>Hello ${escapeHtml(name)},</p><p>Your registration for <strong>${escapeHtml(event.title)}</strong> is confirmed.</p><ul><li>Date: ${escapeHtml(event.eventDate)}</li><li>Time: ${escapeHtml(event.time)}</li><li>Location: ${escapeHtml(event.location)}</li><li>Riders: ${riders}</li></ul><p>The attached calendar file can be opened in your calendar application.</p>`,
        attachments: [attachment],
      })

      logger.info('Event registration confirmation sent', {
        eventId,
        userId: account.user.uid,
        riders,
      })
      response.status(201).json({
        message: 'Registration confirmed. Check your email for the calendar attachment.',
        registration: { id: registrationReference.id, ...registration, registeredAt: null },
      })
    } catch (error) {
      if (isAuthenticationError(error)) {
        response.status(401).json({ message: 'Your login session is invalid.' })
        return
      }
      if (error.code === 6 || error.code === 'already-exists') {
        response.status(409).json({ message: 'You have already registered for this event.' })
        return
      }

      if (registrationReference) {
        try {
          await registrationReference.delete()
        } catch (rollbackError) {
          logger.error('Unable to roll back failed event registration', rollbackError)
        }
      }

      logger.error('Unable to register for event', error)
      response.status(500).json({
        message: 'The registration email could not be sent. Your booking was not saved.',
      })
    }
  },
)

exports.cancelEventRegistration = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Use a POST request to cancel an event registration.' })
    return
  }

  try {
    const account = await authenticatedAccount(request)
    if (!account) {
      response.status(401).json({ message: 'Log in before cancelling an event registration.' })
      return
    }

    const eventId = safeText(request.body?.eventId, 100)
    if (!eventId || eventId.includes('/')) {
      response.status(400).json({ message: 'Choose a valid event registration.' })
      return
    }

    await db.collection('eventRegistrations').doc(`${eventId}_${account.user.uid}`).delete()
    response.status(200).json({ message: 'Event registration removed.' })
  } catch (error) {
    if (isAuthenticationError(error)) {
      response.status(401).json({ message: 'Your login session is invalid.' })
      return
    }
    logger.error('Unable to cancel event registration', error)
    response.status(500).json({ message: 'The event registration could not be removed.' })
  }
})

exports.sendEventUpdate = onRequest(
  { cors: true, secrets: [sendGridApiKey, sendGridFromEmail], timeoutSeconds: 120 },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ message: 'Use a POST request to send an event update.' })
      return
    }

    try {
      const account = await authenticatedAccount(request)
      if (!account) {
        response.status(401).json({ message: 'Log in before sending an event update.' })
        return
      }
      if (account.profile.role !== 'admin') {
        response.status(403).json({ message: 'Administrator access is required.' })
        return
      }

      const eventId = safeText(request.body?.eventId, 100)
      const subject = safeText(request.body?.subject, 120)
      const body = String(request.body?.body || '').trim()

      if (!eventId || eventId.includes('/') || subject.length < 3 || body.length < 10 || body.length > 5000) {
        response.status(400).json({
          message: 'Choose an event and provide a subject and message from 10 to 5000 characters.',
        })
        return
      }

      const [eventSnapshot, registrationsSnapshot] = await Promise.all([
        db.collection('events').doc(eventId).get(),
        db.collection('eventRegistrations').where('eventId', '==', eventId).get(),
      ])

      if (!eventSnapshot.exists) {
        response.status(404).json({ message: 'The selected event could not be found.' })
        return
      }
      if (registrationsSnapshot.empty) {
        response.status(400).json({ message: 'No users are registered for this event.' })
        return
      }
      if (registrationsSnapshot.size > 500) {
        response.status(400).json({ message: 'This update is limited to 500 recipients at a time.' })
        return
      }

      const event = { id: eventSnapshot.id, ...eventSnapshot.data() }
      const from = configureSendGrid()
      const attachment = createCalendarAttachment(event, 'event-update')
      const safeBodyHtml = escapeHtml(body).replaceAll('\n', '<br>')
      const messages = registrationsSnapshot.docs.map((document) => {
        const registration = document.data()
        return {
          to: registration.email,
          from,
          subject,
          text: `${body}\n\nEvent: ${event.title}\nDate: ${event.eventDate}\nTime: ${event.time}\nLocation: ${event.location}`,
          html: `<p>${safeBodyHtml}</p><hr><p><strong>${escapeHtml(event.title)}</strong><br>${escapeHtml(event.eventDate)} at ${escapeHtml(event.time)}<br>${escapeHtml(event.location)}</p>`,
          attachments: [attachment],
        }
      })

      await sendGridMail.send(messages)
      logger.info('Bulk event update sent', {
        eventId,
        administratorId: account.user.uid,
        recipientCount: messages.length,
      })
      response.status(200).json({
        message: `Event update sent to ${messages.length} registered ${messages.length === 1 ? 'user' : 'users'}.`,
        sentCount: messages.length,
      })
    } catch (error) {
      if (isAuthenticationError(error)) {
        response.status(401).json({ message: 'Your login session is invalid.' })
        return
      }
      logger.error('Unable to send bulk event update', error)
      response.status(500).json({ message: 'The event update email could not be sent.' })
    }
  },
)
