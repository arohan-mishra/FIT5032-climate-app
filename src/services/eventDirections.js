import { auth } from '../firebase/init'
import { getCurrentLocation } from './routeGenerator'

function isCoordinate(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function validLocation(location) {
  return location
    && isCoordinate(location.latitude, -90, 90)
    && isCoordinate(location.longitude, -180, 180)
}

function validRoute(route) {
  const feature = route?.features?.[0]
  return route?.type === 'FeatureCollection'
    && feature?.type === 'Feature'
    && ['LineString', 'MultiLineString'].includes(feature.geometry?.type)
    && typeof feature.properties?.summary?.distance === 'number'
    && typeof feature.properties?.summary?.duration === 'number'
}

export async function planRideToEvent(eventId) {
  if (!auth?.currentUser) throw new Error('Log in before planning a ride to an event.')

  const start = await getCurrentLocation()
  const idToken = await auth.currentUser.getIdToken()
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/getEventDirections`
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ eventId: String(eventId), ...start }),
  })
  let data = {}

  try {
    data = await response.json()
  } catch {
    if (!response.ok) throw new Error(`The event route service returned an error (${response.status}).`)
  }

  if (!response.ok) throw new Error(data.message || 'A route to this event could not be generated.')
  if (!validRoute(data.route) || !validLocation(data.start) || !validLocation(data.destination)) {
    throw new Error('The event route service returned invalid route data.')
  }

  return data
}
