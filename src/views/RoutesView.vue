<script setup>
import { computed, onMounted, ref } from 'vue'
import RouteCard from '../components/RouteCard.vue'
import { useAuth } from '../services/auth'
import { useFirestoreData } from '../services/firestoreData'
import { generateCyclingRoute } from '../services/routeGenerator'

const { cyclingSegments, loading, error, loadFirestoreData } = useFirestoreData()
const { currentUser } = useAuth()
onMounted(loadFirestoreData)

const selectedRegion = ref('All')
const searchText = ref('')
const maxDistance = ref(800)
const routeDistance = ref(5000)
const generatedRoute = ref(null)
const startLocation = ref(null)
const generationError = ref('')
const isGenerating = ref(false)

const regions = computed(() =>
  [...new Set(cyclingSegments.value.map((segment) => segment.region))].sort(),
)

const filteredSegments = computed(() => {
  const search = searchText.value.trim().toLowerCase()

  return cyclingSegments.value.filter((segment) => {
    const matchesRegion = selectedRegion.value === 'All' || segment.region === selectedRegion.value
    const searchableText = [
      segment.segmentDescription,
      segment.description,
      segment.laneType,
      segment.protection,
    ].join(' ').toLowerCase()
    const matchesDistance = segment.length <= maxDistance.value

    return matchesRegion && matchesDistance && (!search || searchableText.includes(search))
  })
})

const displayedSegments = computed(() => filteredSegments.value.slice(0, 30))
const generatedSummary = computed(() => {
  const summary = generatedRoute.value?.features?.[0]?.properties?.summary

  if (!summary) return null

  return {
    distance: (summary.distance / 1000).toFixed(1),
    duration: Math.round(summary.duration / 60),
  }
})

async function createRoute() {
  generationError.value = ''
  generatedRoute.value = null
  isGenerating.value = true

  try {
    const result = await generateCyclingRoute(routeDistance.value)
    generatedRoute.value = result.route
    startLocation.value = result.location
  } catch (error) {
    generationError.value = error.message
  } finally {
    isGenerating.value = false
  }
}

function resetFilters() {
  selectedRegion.value = 'All'
  searchText.value = ''
  maxDistance.value = 800
}
</script>

<template>
  <section class="page-banner">
    <div class="container"><h1>Find a route</h1><p>Browse cycling routes from City of Melbourne Open Data.</p></div>
  </section>
  <section class="section container">
    <div class="form-panel route-builder">
      <h2>Generate a cycling route</h2>
      <p>Choose a distance and create a round trip from your current location.</p>
      <p class="data-note">When you continue, your approximate browser location is sent securely to Firebase and OpenRouteService to calculate the route.</p>
      <form v-if="currentUser" class="route-builder-form" @submit.prevent="createRoute">
        <div class="field">
          <label for="route-distance">Route distance</label>
          <select id="route-distance" v-model.number="routeDistance">
            <option :value="2000">2 km</option>
            <option :value="5000">5 km</option>
            <option :value="10000">10 km</option>
            <option :value="15000">15 km</option>
          </select>
        </div>
        <button class="button primary" type="submit" :disabled="isGenerating">
          {{ isGenerating ? 'Finding your location…' : 'Use my location and generate route' }}
        </button>
      </form>
      <p v-else><RouterLink :to="{ name: 'login', query: { redirect: '/routes' } }">Log in to generate a route</RouterLink></p>
      <p v-if="generationError" class="error" role="alert">{{ generationError }}</p>
      <div v-if="generatedSummary" class="generated-route" role="status">
        <h3>Route ready</h3>
        <p><strong>{{ generatedSummary.distance }} km</strong> · Approximately {{ generatedSummary.duration }} minutes</p>
        <p v-if="startLocation" class="data-note">Generated from your current location. The map will be added in the next stage.</p>
      </div>
    </div>

    <h2>Browse City of Melbourne routes</h2>
    <form class="filters" @submit.prevent>
      <div class="field"><label for="region">Region</label><select id="region" v-model="selectedRegion"><option>All</option><option v-for="region in regions" :key="region">{{ region }}</option></select></div>
      <div class="field"><label for="route-search">Search routes</label><input id="route-search" v-model.trim="searchText" type="search" placeholder="Street, lane type or protection" /></div>
      <div class="field range-field"><label for="distance">Maximum distance: <strong>{{ maxDistance }} m</strong></label><input id="distance" v-model.number="maxDistance" type="range" min="50" max="800" step="50" /></div>
      <button class="button secondary" type="button" @click="resetFilters">Reset filters</button>
    </form>
    <p v-if="loading" role="status">Loading routes…</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else class="result-count" aria-live="polite">Showing {{ displayedSegments.length }} of {{ filteredSegments.length }} matching routes</p>
    <div v-if="!loading && !error && displayedSegments.length" class="card-grid">
      <RouteCard v-for="segment in displayedSegments" :key="segment.id" :route="segment" allow-rating />
    </div>
    <div v-else-if="!loading && !error" class="empty-state"><h2>No routes match those filters</h2><p>Try another region, distance or search term.</p><button class="button primary" type="button" @click="resetFilters">Show all routes</button></div>
  </section>
</template>
