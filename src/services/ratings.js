import { readonly, ref } from 'vue'

const RATINGS_KEY = 'pedal-melbourne-ratings'
const sampleRatings = [
  { routeId: 1, userId: 'sample-rider-1', score: 4 },
  { routeId: 1, userId: 'sample-rider-2', score: 5 },
  { routeId: 2, userId: 'sample-rider-1', score: 5 },
  { routeId: 2, userId: 'sample-rider-3', score: 4 },
  { routeId: 3, userId: 'sample-rider-2', score: 4 },
  { routeId: 4, userId: 'sample-rider-3', score: 3 },
]

function readRatings() {
  try {
    const stored = JSON.parse(localStorage.getItem(RATINGS_KEY))
    return Array.isArray(stored) ? stored : sampleRatings
  } catch {
    return sampleRatings
  }
}

const ratings = ref(readRatings())

if (!localStorage.getItem(RATINGS_KEY)) {
  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings.value))
}

function rateRoute(routeId, userId, score) {
  const numericScore = Number(score)
  if (!userId || !Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
    return false
  }

  const existingIndex = ratings.value.findIndex(
    (rating) => rating.routeId === routeId && rating.userId === userId,
  )
  const newRating = { routeId, userId, score: numericScore }

  if (existingIndex === -1) ratings.value.push(newRating)
  else ratings.value[existingIndex] = newRating

  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings.value))
  return true
}

export function useRatings() {
  return { ratings: readonly(ratings), rateRoute }
}
