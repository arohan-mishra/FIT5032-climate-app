import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { readonly, ref } from 'vue'
import { db, isFirebaseConfigured } from '../firebase/init'

const RATINGS_COLLECTION = 'ratings'
const ratings = ref([])
const loading = ref(false)
const error = ref('')
let loaded = false
let loadingPromise = null

function normaliseSegmentId(segmentId) {
  return String(segmentId ?? '').trim()
}

function validateRating(segmentId, userId, score) {
  const normalisedSegmentId = normaliseSegmentId(segmentId)
  const numericScore = Number(score)

  if (
    !normalisedSegmentId
    || normalisedSegmentId.length > 100
    || normalisedSegmentId.includes('/')
    || typeof userId !== 'string'
    || !userId
    || userId.length > 128
    || !Number.isInteger(numericScore)
    || numericScore < 1
    || numericScore > 5
  ) {
    throw new Error('The rating details are invalid.')
  }

  return { segmentId: normalisedSegmentId, userId, score: numericScore }
}

function requireFirestore() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Ratings are unavailable because Firebase is not configured.')
  }
}

export async function fetchRatings() {
  requireFirestore()

  const snapshot = await getDocs(collection(db, RATINGS_COLLECTION))

  return snapshot.docs.flatMap((ratingDocument) => {
    try {
      const data = ratingDocument.data()
      return [validateRating(data.segmentId, data.userId, data.score)]
    } catch {
      return []
    }
  })
}

export async function saveRating({ segmentId, userId, score }) {
  requireFirestore()

  const rating = validateRating(segmentId, userId, score)
  const ratingId = `${rating.segmentId}_${rating.userId}`

  await setDoc(doc(db, RATINGS_COLLECTION, ratingId), {
    ...rating,
    updatedAt: serverTimestamp(),
  })

  return rating
}

export async function loadRatings() {
  if (loaded) return ratings.value
  if (loadingPromise) return loadingPromise

  loading.value = true
  error.value = ''

  loadingPromise = fetchRatings()
    .then((fetchedRatings) => {
      ratings.value = fetchedRatings
      loaded = true
      return ratings.value
    })
    .catch((loadError) => {
      console.error('Unable to load ratings:', loadError)
      error.value = 'Ratings could not be loaded. Please try again later.'
      return ratings.value
    })
    .finally(() => {
      loading.value = false
      loadingPromise = null
    })

  return loadingPromise
}

export async function rateSegment(segmentId, userId, score) {
  const savedRating = await saveRating({ segmentId, userId, score })
  const existingIndex = ratings.value.findIndex((rating) =>
    rating.segmentId === savedRating.segmentId && rating.userId === savedRating.userId,
  )

  if (existingIndex === -1) ratings.value.push(savedRating)
  else ratings.value[existingIndex] = savedRating

  return savedRating
}

export function useFirestoreRatings() {
  return {
    ratings: readonly(ratings),
    loading: readonly(loading),
    error: readonly(error),
    loadRatings,
    rateSegment,
  }
}
