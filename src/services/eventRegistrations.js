import { auth } from '../firebase/init'

function functionUrl(functionName) {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  return `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`
}

async function authenticatedRequest(functionName, options = {}) {
  if (!auth?.currentUser) throw new Error('Log in before managing event registrations.')

  const idToken = await auth.currentUser.getIdToken()
  const response = await fetch(functionUrl(functionName), {
    ...options,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  let data = {}

  try {
    data = await response.json()
  } catch {
    if (!response.ok) throw new Error(`The event service returned an error (${response.status}).`)
  }

  if (!response.ok) throw new Error(data.message || 'The event request could not be completed.')
  return data
}

function normaliseRegistration(registration) {
  if (
    typeof registration?.eventId !== 'string'
    || typeof registration?.eventTitle !== 'string'
    || Number.isNaN(Date.parse(registration?.start))
    || Number.isNaN(Date.parse(registration?.end))
  ) {
    throw new Error('The event service returned invalid registration data.')
  }

  return {
    eventId: registration.eventId,
    title: registration.eventTitle,
    start: registration.start,
    end: registration.end,
  }
}

export async function loadMyEventRegistrations() {
  const data = await authenticatedRequest('getMyEventRegistrations')
  if (!Array.isArray(data.registrations)) {
    throw new Error('The event service returned invalid registration data.')
  }
  return data.registrations.map(normaliseRegistration)
}

export async function registerForEvent(eventId, riders) {
  const data = await authenticatedRequest('registerForEvent', {
    method: 'POST',
    body: JSON.stringify({ eventId: String(eventId), riders }),
  })

  return {
    message: data.message,
    booking: normaliseRegistration(data.registration),
  }
}

export async function cancelEventRegistration(eventId) {
  const data = await authenticatedRequest('cancelEventRegistration', {
    method: 'POST',
    body: JSON.stringify({ eventId: String(eventId) }),
  })
  return data.message
}

export async function sendEventUpdate({ eventId, subject, body }) {
  const data = await authenticatedRequest('sendEventUpdate', {
    method: 'POST',
    body: JSON.stringify({ eventId: String(eventId), subject, body }),
  })

  if (!Number.isInteger(data.sentCount) || data.sentCount < 1) {
    throw new Error('The email service returned an invalid recipient count.')
  }
  return data
}
