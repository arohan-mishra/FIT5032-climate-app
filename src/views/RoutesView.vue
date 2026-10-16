<script setup>
import { computed, onMounted, ref } from 'vue'
import RouteCard from '../components/RouteCard.vue'
import { useFirestoreData } from '../services/firestoreData'

const { cyclingSegments, loading, error, loadFirestoreData } = useFirestoreData()
onMounted(loadFirestoreData)

const selectedRegion = ref('All')
const searchText = ref('')
const maxDistance = ref(800)

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
