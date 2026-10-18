<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../services/auth'
import { useFirestoreRatings } from '../services/firestoreRatings'

const props = defineProps({
  route: { type: Object, required: true },
  allowRating: { type: Boolean, default: false },
})

const pageRoute = useRoute()
const { currentUser } = useAuth()
const {
  ratings,
  loading: ratingsLoading,
  error: ratingsError,
  loadRatings,
  rateSegment,
} = useFirestoreRatings()
const selectedScore = ref('')
const message = ref('')
const isSaving = ref(false)

const routeRatings = computed(() => ratings.value.filter(
  (rating) => rating.segmentId === String(props.route.id),
))
const averageRating = computed(() => {
  if (!routeRatings.value.length) return null
  const total = routeRatings.value.reduce((sum, rating) => sum + rating.score, 0)
  return (total / routeRatings.value.length).toFixed(1)
})
const userRating = computed(() =>
  routeRatings.value.find((rating) => rating.userId === currentUser.value?.id)?.score ?? '',
)

watch(
  [userRating, () => props.route.id],
  ([score]) => {
    selectedScore.value = score
    message.value = ''
  },
  { immediate: true },
)

onMounted(loadRatings)

async function saveUserRating() {
  const numericScore = Number(selectedScore.value)

  if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
    message.value = 'Choose a rating from 1 to 5.'
    return
  }

  isSaving.value = true
  message.value = ''

  try {
    await rateSegment(props.route.id, currentUser.value.id, numericScore)
    message.value = 'Your rating has been saved.'
  } catch (error) {
    console.error('Unable to save rating:', error)
    message.value = 'Your rating could not be saved. Please try again.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <article class="card route-card">
    <div class="card-content">
      <div class="eyebrow-row">
        <span class="tag">{{ route.laneType || 'Cycling segment' }}</span>
        <span>{{ Math.round(route.length) }} m</span>
      </div>
      <h3>{{ route.segmentDescription }}</h3>
      <p class="muted">{{ route.region }}</p>
      <p>{{ route.description || 'City of Melbourne cycling segment.' }}</p>
      <ul class="facility-list" :aria-label="`Details for ${route.segmentDescription}`">
        <li v-if="route.protection">{{ route.protection }}</li>
        <li v-if="route.surfaceTreatment">{{ route.surfaceTreatment }}</li>
      </ul>
      <div class="rating-summary" aria-live="polite">
        <strong v-if="ratingsLoading">Loading ratings…</strong>
        <strong v-else-if="ratingsError">Ratings unavailable</strong>
        <template v-else>
          <strong>{{ averageRating ? `${averageRating} / 5` : 'No ratings yet' }}</strong>
          <span v-if="routeRatings.length"> from {{ routeRatings.length }} {{ routeRatings.length === 1 ? 'rating' : 'ratings' }}</span>
        </template>
      </div>
      <div v-if="allowRating" class="rating-form">
        <template v-if="currentUser">
          <label :for="`rating-${route.id}`">Your rating</label>
          <select :id="`rating-${route.id}`" v-model="selectedScore" :disabled="isSaving" @change="message = ''">
            <option value="" disabled>Choose 1–5</option>
            <option v-for="score in 5" :key="score" :value="score">{{ score }}</option>
          </select>
          <button class="button secondary" type="button" :disabled="isSaving" @click="saveUserRating">
            {{ isSaving ? 'Saving…' : 'Save rating' }}
          </button>
          <p v-if="message" class="rating-message" role="status">{{ message }}</p>
        </template>
        <p v-else><RouterLink :to="{ name: 'login', query: { redirect: pageRoute.fullPath } }">Log in to rate this segment</RouterLink></p>
      </div>
    </div>
  </article>
</template>
