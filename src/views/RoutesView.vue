<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
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
const descriptionFilter = ref('')
const laneTypeFilter = ref('')
const protectionFilter = ref('')
const sortField = ref('segmentDescription')
const sortDirection = ref('ascending')
const currentPage = ref(1)
const selectedSegment = ref(null)
const selectedSegmentSection = ref(null)
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
  const description = descriptionFilter.value.trim().toLowerCase()
  const laneType = laneTypeFilter.value.trim().toLowerCase()
  const protection = protectionFilter.value.trim().toLowerCase()

  return cyclingSegments.value.filter((segment) => {
    const matchesRegion = selectedRegion.value === 'All' || segment.region === selectedRegion.value
    const searchableText = [
      segment.segmentDescription,
      segment.description,
      segment.laneType,
      segment.protection,
    ].filter(Boolean).join(' ').toLowerCase()
    const matchesDescription = !description
      || String(segment.segmentDescription || '').toLowerCase().includes(description)
    const matchesLaneType = !laneType
      || String(segment.laneType || '').toLowerCase().includes(laneType)
    const matchesProtection = !protection
      || String(segment.protection || '').toLowerCase().includes(protection)

    return matchesRegion
      && matchesDescription
      && matchesLaneType
      && matchesProtection
      && (!search || searchableText.includes(search))
  })
})

const sortedSegments = computed(() => [...filteredSegments.value].sort((first, second) => {
  const firstValue = first[sortField.value] ?? ''
  const secondValue = second[sortField.value] ?? ''
  const result = typeof firstValue === 'number'
    ? firstValue - secondValue
    : String(firstValue).localeCompare(String(secondValue))

  return sortDirection.value === 'ascending' ? result : -result
}))
const totalPages = computed(() => Math.max(1, Math.ceil(sortedSegments.value.length / 10)))
const displayedSegments = computed(() => {
  const start = (currentPage.value - 1) * 10
  return sortedSegments.value.slice(start, start + 10)
})
const firstDisplayedRow = computed(() => (
  filteredSegments.value.length ? (currentPage.value - 1) * 10 + 1 : 0
))
const lastDisplayedRow = computed(() => (
  Math.min(currentPage.value * 10, filteredSegments.value.length)
))
const generatedSummaries = computed(() => generatedRoutes.value.map((route) => {
  const summary = route.features?.[0]?.properties?.summary

  return {
    distance: summary ? (summary.distance / 1000).toFixed(1) : 'Unknown',
    duration: summary ? Math.round(summary.duration / 60) : 'Unknown',
  }
}))
const selectedRoute = computed(() => generatedRoutes.value[selectedRouteIndex.value] || null)

watch(
  [searchText, selectedRegion, descriptionFilter, laneTypeFilter, protectionFilter],
  () => { currentPage.value = 1 },
)

function sortSegments(field) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'ascending' ? 'descending' : 'ascending'
  } else {
    sortField.value = field
    sortDirection.value = 'ascending'
  }
}

function sortState(field) {
  return sortField.value === field ? sortDirection.value : 'none'
}

function sortIndicator(field) {
  if (sortField.value !== field) return ''
  return sortDirection.value === 'ascending' ? ' ▲' : ' ▼'
}

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
  descriptionFilter.value = ''
  laneTypeFilter.value = ''
  protectionFilter.value = ''
  currentPage.value = 1
}

async function selectSegment(segment) {
  selectedSegment.value = segment
  await nextTick()
  selectedSegmentSection.value?.scrollIntoView({ block: 'start' })
  selectedSegmentSection.value?.focus({ preventScroll: true })
}
</script>

<template>
  <section class="page-banner">
    <div class="container"><h1>Find a route</h1><p>Browse cycling segments from City of Melbourne Open Data.</p></div>
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
        <div class="route-options" role="group" aria-label="Generated route options">
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

    <h2>Browse City of Melbourne segments</h2>
    <form class="filters" @submit.prevent>
      <div class="field"><label for="segment-search">Search all columns</label><input id="segment-search" v-model.trim="searchText" type="search" placeholder="Search cycling segments" /></div>
      <button class="button secondary" type="button" @click="resetFilters">Reset filters</button>
    </form>
    <p v-if="loading" role="status">Loading cycling segments…</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else class="result-count" aria-live="polite">
      Showing {{ firstDisplayedRow }}–{{ lastDisplayedRow }} of {{ filteredSegments.length }} matching segments
    </p>
    <div v-if="!loading && !error && displayedSegments.length" class="table-wrapper">
      <table class="data-table">
        <caption class="sr-only">City of Melbourne cycling infrastructure segments</caption>
        <thead>
          <tr>
            <th scope="col" :aria-sort="sortState('segmentDescription')"><button class="table-sort" type="button" @click="sortSegments('segmentDescription')">Segment{{ sortIndicator('segmentDescription') }}</button></th>
            <th scope="col" :aria-sort="sortState('region')"><button class="table-sort" type="button" @click="sortSegments('region')">Region{{ sortIndicator('region') }}</button></th>
            <th scope="col" :aria-sort="sortState('laneType')"><button class="table-sort" type="button" @click="sortSegments('laneType')">Lane type{{ sortIndicator('laneType') }}</button></th>
            <th scope="col" :aria-sort="sortState('protection')"><button class="table-sort" type="button" @click="sortSegments('protection')">Protection{{ sortIndicator('protection') }}</button></th>
            <th scope="col" :aria-sort="sortState('length')"><button class="table-sort" type="button" @click="sortSegments('length')">Length{{ sortIndicator('length') }}</button></th>
            <th scope="col">Action</th>
          </tr>
          <tr class="column-filters">
            <th><label class="sr-only" for="description-filter">Filter segment column</label><input id="description-filter" v-model.trim="descriptionFilter" type="search" placeholder="Filter segment" /></th>
            <th><label class="sr-only" for="region-filter">Filter region column</label><select id="region-filter" v-model="selectedRegion"><option>All</option><option v-for="region in regions" :key="region">{{ region }}</option></select></th>
            <th><label class="sr-only" for="lane-filter">Filter lane type column</label><input id="lane-filter" v-model.trim="laneTypeFilter" type="search" placeholder="Filter lane type" /></th>
            <th><label class="sr-only" for="protection-filter">Filter protection column</label><input id="protection-filter" v-model.trim="protectionFilter" type="search" placeholder="Filter protection" /></th>
            <th aria-hidden="true"></th>
            <th aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="segment in displayedSegments" :key="segment.id">
            <th scope="row">{{ segment.segmentDescription }}</th>
            <td>{{ segment.region }}</td>
            <td>{{ segment.laneType || 'Not specified' }}</td>
            <td>{{ segment.protection || 'Not specified' }}</td>
            <td>{{ Math.round(segment.length) }} m</td>
            <td><button class="text-button" type="button" @click="selectSegment(segment)">View and rate</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <nav v-if="!loading && !error && filteredSegments.length" class="pagination" aria-label="Cycling segment table pages">
      <button class="button secondary" type="button" :disabled="currentPage === 1" @click="currentPage--">Previous</button>
      <span>Page {{ currentPage }} of {{ totalPages }}</span>
      <button class="button secondary" type="button" :disabled="currentPage === totalPages" @click="currentPage++">Next</button>
    </nav>
    <div v-else-if="!loading && !error" class="empty-state"><h2>No segments match those filters</h2><p>Try another region or search term.</p><button class="button primary" type="button" @click="resetFilters">Show all segments</button></div>

    <section v-if="selectedSegment" ref="selectedSegmentSection" class="selected-segment" aria-labelledby="selected-segment-heading" tabindex="-1">
      <h2 id="selected-segment-heading">Selected segment</h2>
      <RouteCard :route="selectedSegment" allow-rating />
    </section>
  </section>
</template>
