import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { events } from '../src/data/events.js'
import { routes } from '../src/data/routes.js'

const projectId = process.env.FIREBASE_PROJECT_ID
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

if (!projectId) {
  throw new Error('Set FIREBASE_PROJECT_ID before running the seed script.')
}

const credential = serviceAccountPath
  ? cert(JSON.parse(await readFile(serviceAccountPath, 'utf8')))
  : applicationDefault()

initializeApp({ credential, projectId })

const db = getFirestore()
const batch = db.batch()

for (const route of routes) {
  batch.set(db.collection('routes').doc(String(route.id)), route)
}

for (const [index, event] of events.entries()) {
  batch.set(db.collection('events').doc(String(event.id)), {
    ...event,
    sortOrder: index + 1,
  })
}

await batch.commit()
console.log(`Seeded ${routes.length} routes and ${events.length} events into Firestore.`)
