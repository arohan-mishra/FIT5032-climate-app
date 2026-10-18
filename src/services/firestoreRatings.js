import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/init'

const RATINGS_COLLECTION = 'ratings'

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
