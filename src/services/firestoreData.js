import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { readonly, ref } from 'vue'
import { db, isFirebaseConfigured } from '../firebase/init'

const routes = ref([])
const events = ref([])
const cyclingSegments = ref([])
const loading = ref(false)
const error = ref('')
let loaded = false

async function readCollection(name, orderField) {
  const collectionQuery = query(collection(db, name), orderBy(orderField))
  const snapshot = await getDocs(collectionQuery)
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
}

export async function loadFirestoreData() {
  if (loaded || loading.value) return

  if (!isFirebaseConfigured) {
    error.value = 'Firebase is not configured. Add the Firebase values to your .env file.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const [routeData, eventData, segmentData] = await Promise.all([
      readCollection('routes', 'name'),
      readCollection('events', 'sortOrder'),
      readCollection('cyclingSegments', 'region'),
    ])
    routes.value = routeData
    events.value = eventData
    cyclingSegments.value = segmentData
    loaded = true
  } catch (loadError) {
    console.error('Unable to load Firestore data:', loadError)
    error.value = 'The route and event data could not be loaded. Please try again later.'
  } finally {
    loading.value = false
  }
}

export function useFirestoreData() {
  return {
    routes: readonly(routes),
    events: readonly(events),
    cyclingSegments: readonly(cyclingSegments),
    loading: readonly(loading),
    error: readonly(error),
    loadFirestoreData,
  }
}
