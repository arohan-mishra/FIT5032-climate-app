<script setup>
import { computed, onMounted, ref } from 'vue'
import RouteCard from '../components/RouteCard.vue'
import RouteMap from '../components/RouteMap.vue'
import { useAuth } from '../services/auth'
import { useFirestoreData } from '../services/firestoreData'
import { downloadRouteAsGpx } from '../services/gpxExport'
import { generateCyclingRoute } from '../services/routeGenerator'

const { cyclingSegments, loading, error, loadFirestoreData } = useFirestoreData()
const { currentUser } = useAuth()
onMounted(loadFirestoreData)

const selectedRegion = ref('All')
const searchText = ref('')
const routeDistance = ref(5)
const generatedRoutes = ref([])
const selectedRouteIndex = ref(0)
const startLocation = ref(null)
const generationError = ref('')
const exportMessage = ref('')
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
    return matchesRegion && (!search || searchableText.includes(search))
  })
})

const displayedSegments = computed(() => filteredSegments.value.slice(0, 30))
const generatedSummaries = computed(() => generatedRoutes.value.map((route) => {
  const summary = route.features?.[0]?.properties?.summary

  return {
    distance: summary ? (summary.distance / 1000).toFixed(1) : 'Unknown',
    duration: summary ? Math.round(summary.duration / 60) : 'Unknown',
  }
}))
const selectedRoute = computed(() => generatedRoutes.value[selectedRouteIndex.value] || null)

async function createRoute() {
  generationError.value = ''
  exportMessage.value = ''
  generatedRoutes.value = []
  selectedRouteIndex.value = 0
  isGenerating.value = true

  try {
    const result = await generateCyclingRoute(routeDistance.value * 1000)
    generatedRoutes.value = result.routes
    startLocation.value = result.location
  } catch (error) {
    generationError.value = error.message
  } finally {
    isGenerating.value = false
  }
}

function selectRoute(index) {
  selectedRouteIndex.value = index
  exportMessage.value = ''
}

function exportSelectedRoute() {
  exportMessage.value = ''

  try {
    downloadRouteAsGpx(selectedRoute.value, selectedRouteIndex.value + 1)
    exportMessage.value = `Route ${selectedRouteIndex.value + 1} GPX download started.`
  } catch (error) {
    exportMessage.value = error.message
  }
}

function resetFilters() {
  selectedRegion.value = 'All'
  searchText.value = ''
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
        <div class="field range-field">
          <label for="route-distance">Route distance: <strong>{{ routeDistance }} km</strong></label>
          <input id="route-distance" v-model.number="routeDistance" type="range" min="2" max="15" step="1" />
        </div>
        <button class="button primary" type="submit" :disabled="isGenerating">
          {{ isGenerating ? 'Generating three routes…' : 'Use my location and generate 3 routes' }}
        </button>
      </form>
      <p v-else><RouterLink :to="{ name: 'login', query: { redirect: '/routes' } }">Log in to generate a route</RouterLink></p>
      <p v-if="generationError" class="error" role="alert">{{ generationError }}</p>
      <div v-if="generatedSummaries.length" class="generated-route">
        <h3 role="status">Three routes are ready</h3>
        <div class="route-options" aria-label="Generated route options">
          <button
            v-for="(summary, index) in generatedSummaries"
            :key="index"
            class="button"
            :class="{ primary: selectedRouteIndex === index }"
            type="button"
            :aria-pressed="selectedRouteIndex === index"
            @click="selectRoute(index)"
          >
            Route {{ index + 1 }}: {{ summary.distance }} km, {{ summary.duration }} min
          </button>
        </div>
        <RouteMap v-if="startLocation && selectedRoute" :route="selectedRoute" :location="startLocation" />
        <div class="export-action">
          <button class="button secondary" type="button" @click="exportSelectedRoute">
            Export Route {{ selectedRouteIndex + 1 }} as GPX
          </button>
          <p v-if="exportMessage" role="status">{{ exportMessage }}</p>
        </div>
      </div>
    </div>

    <h2>Browse City of Melbourne routes</h2>
    <form class="filters" @submit.prevent>
      <div class="field"><label for="region">Region</label><select id="region" v-model="selectedRegion"><option>All</option><option v-for="region in regions" :key="region">{{ region }}</option></select></div>
      <div class="field"><label for="route-search">Search routes</label><input id="route-search" v-model.trim="searchText" type="search" placeholder="Street, lane type or protection" /></div>
      <button class="button secondary" type="button" @click="resetFilters">Reset filters</button>
    </form>
    <p v-if="loading" role="status">Loading routes…</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else class="result-count" aria-live="polite">Showing {{ displayedSegments.length }} of {{ filteredSegments.length }} matching routes</p>
    <div v-if="!loading && !error && displayedSegments.length" class="card-grid">
      <RouteCard v-for="segment in displayedSegments" :key="segment.id" :route="segment" allow-rating />
    </div>
    <div v-else-if="!loading && !error" class="empty-state"><h2>No routes match those filters</h2><p>Try another region or search term.</p><button class="button primary" type="button" @click="resetFilters">Show all routes</button></div>
  </section>
</template>
