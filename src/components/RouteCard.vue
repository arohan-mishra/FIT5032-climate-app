<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../services/auth'
import { useRatings } from '../services/ratings'

const props = defineProps({
  route: { type: Object, required: true },
  allowRating: { type: Boolean, default: false },
})

const pageRoute = useRoute()
const { currentUser } = useAuth()
const { ratings, rateRoute } = useRatings()
const selectedScore = ref('')
const message = ref('')

const routeRatings = computed(() => ratings.value.filter((rating) => rating.routeId === props.route.id))
const averageRating = computed(() => {
  if (!routeRatings.value.length) return null
  const total = routeRatings.value.reduce((sum, rating) => sum + rating.score, 0)
  return (total / routeRatings.value.length).toFixed(1)
})
const userRating = computed(() =>
  routeRatings.value.find((rating) => rating.userId === currentUser.value?.id)?.score ?? '',
)

watch(userRating, (score) => { selectedScore.value = score }, { immediate: true })

function saveRating() {
  message.value = rateRoute(props.route.id, currentUser.value.id, selectedScore.value)
    ? 'Your rating has been saved.'
    : 'Choose a rating from 1 to 5.'
}
</script>

<template>
  <article class="card route-card">
    <div class="card-content">
      <div class="eyebrow-row">
        <span class="tag">{{ route.laneType || 'Cycling route' }}</span>
        <span>{{ Math.round(route.length) }} m</span>
      </div>
      <h3>{{ route.segmentDescription }}</h3>
      <p class="muted">{{ route.region }}</p>
      <p>{{ route.description || 'City of Melbourne cycling route.' }}</p>
      <ul class="facility-list" :aria-label="`Details for ${route.segmentDescription}`">
        <li v-if="route.protection">{{ route.protection }}</li>
        <li v-if="route.surfaceTreatment">{{ route.surfaceTreatment }}</li>
      </ul>
      <div class="rating-summary" aria-live="polite">
        <strong>{{ averageRating ? `${averageRating} / 5` : 'No ratings yet' }}</strong>
        <span v-if="routeRatings.length"> from {{ routeRatings.length }} {{ routeRatings.length === 1 ? 'rating' : 'ratings' }}</span>
      </div>
      <div v-if="allowRating" class="rating-form">
        <template v-if="currentUser">
          <label :for="`rating-${route.id}`">Your rating</label>
          <select :id="`rating-${route.id}`" v-model="selectedScore" @change="message = ''">
            <option value="" disabled>Choose 1–5</option>
            <option v-for="score in 5" :key="score" :value="score">{{ score }}</option>
          </select>
          <button class="button secondary" type="button" @click="saveRating">Save rating</button>
          <p v-if="message" class="rating-message" role="status">{{ message }}</p>
        </template>
        <p v-else><RouterLink :to="{ name: 'login', query: { redirect: pageRoute.fullPath } }">Log in to rate this route</RouterLink></p>
      </div>
    </div>
  </article>
</template>
