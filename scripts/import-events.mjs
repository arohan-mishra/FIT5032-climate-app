import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

const eventsFile = new URL('../MOCK_EVENT_DATA.json', import.meta.url)
const events = JSON.parse(await readFile(eventsFile, 'utf8'))
const DEFAULT_EVENT_DURATION_MINUTES = 90
const EVENT_LOCATION_COORDINATES = {
  'Alexandra Gardens': { latitude: -37.8205, longitude: 144.9729 },
  'Birrarung Marr': { latitude: -37.8185, longitude: 144.9747 },
  'Carlton Community Centre': { latitude: -37.7981, longitude: 144.9716 },
  'Docklands Library': { latitude: -37.8148, longitude: 144.9418 },
  'Docklands Park': { latitude: -37.8162, longitude: 144.9468 },
  'Fawkner Park': { latitude: -37.8414, longitude: 144.9832 },
  'Federation Square': { latitude: -37.8180, longitude: 144.9691 },
  'Flagstaff Gardens': { latitude: -37.8117, longitude: 144.9545 },
  'Kensington Community Centre': { latitude: -37.7932, longitude: 144.9255 },
  'Library at the Dock': { latitude: -37.8148, longitude: 144.9418 },
  'Melbourne Town Hall': { latitude: -37.8151, longitude: 144.9666 },
  'Princes Park': { latitude: -37.7814, longitude: 144.9500 },
  'Queen Victoria Market': { latitude: -37.8076, longitude: 144.9568 },
  'Southbank Promenade': { latitude: -37.8200, longitude: 144.9640 },
}
const requiredTextFields = [
  'title',
  'category',
  'eventDate',
  'time',
  'location',
  'level',
  'organiser',
  'day',
  'month',
]

function timeInMinutes(time) {
  const match = /^(\d{1,2}):(\d{2}) (am|pm)$/.exec(time)
  if (!match) return Number.MAX_SAFE_INTEGER

  const [, hours, minutes, period] = match
  const hour = Number(hours) % 12 + (period === 'pm' ? 12 : 0)
  return hour * 60 + Number(minutes)
}

function eventDuration(event) {
  return event.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES
}

function validateEvents(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('MOCK_EVENT_DATA.json must contain a non-empty array.')
  }

  const ids = new Set()

  for (const event of records) {
    if (!Number.isInteger(event.id) || event.id < 1 || ids.has(event.id)) {
      throw new Error(`Event IDs must be unique positive integers. Check ID ${event.id}.`)
    }
    ids.add(event.id)

    if (requiredTextFields.some((field) => typeof event[field] !== 'string' || !event[field].trim())) {
      throw new Error(`Event ${event.id} has a missing or invalid text field.`)
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.eventDate)) {
      throw new Error(`Event ${event.id} must use YYYY-MM-DD for eventDate.`)
    }

    if (timeInMinutes(event.time) === Number.MAX_SAFE_INTEGER) {
      throw new Error(`Event ${event.id} has an invalid time.`)
    }

    if (
      !Number.isInteger(eventDuration(event))
      || eventDuration(event) < 30
      || eventDuration(event) > 240
    ) {
      throw new Error(`Event ${event.id} must have a duration from 30 to 240 minutes.`)
    }

    if (!EVENT_LOCATION_COORDINATES[event.location]) {
      throw new Error(`Event ${event.id} has no coordinates for ${event.location}.`)
    }
  }
}

validateEvents(events)

const sortedEvents = [...events].sort((first, second) =>
  first.eventDate.localeCompare(second.eventDate)
    || timeInMinutes(first.time) - timeInMinutes(second.time),
)

if (process.argv.includes('--check')) {
  console.log(`Validated ${sortedEvents.length} events. No Firestore data was changed.`)
  process.exit(0)
}

const projectId = process.env.FIREBASE_PROJECT_ID
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

if (!projectId) {
  throw new Error('Set FIREBASE_PROJECT_ID before importing events.')
}

const credential = serviceAccountPath
  ? cert(JSON.parse(await readFile(serviceAccountPath, 'utf8')))
  : applicationDefault()

initializeApp({ credential, projectId })

const db = getFirestore()
const batch = db.batch()

for (const [index, event] of sortedEvents.entries()) {
  batch.set(db.collection('events').doc(String(event.id)), {
    ...event,
    ...EVENT_LOCATION_COORDINATES[event.location],
    durationMinutes: eventDuration(event),
    sortOrder: index + 1,
  })
}

await batch.commit()
console.log(`Imported ${sortedEvents.length} events into Firestore in chronological order.`)
