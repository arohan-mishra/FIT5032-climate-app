<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchAdminDashboard } from '../services/adminDashboard'

const dashboard = ref(null)
const loading = ref(false)
const error = ref('')

const averageRating = computed(() => {
  const average = dashboard.value?.ratings.average
  return average === null || average === undefined ? 'No ratings' : `${average.toFixed(1)} / 5`
})

async function loadDashboard() {
  loading.value = true
  error.value = ''

  try {
    dashboard.value = await fetchAdminDashboard()
  } catch (loadError) {
    console.error('Unable to load admin dashboard:', loadError)
    error.value = loadError.message
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <section class="page-banner"><div class="container"><h1>Admin dashboard</h1><p>This page is available only to administrators.</p></div></section>
  <section class="section container">
    <h2>Application summary</h2>
    <p v-if="loading" role="status">Loading dashboard statistics…</p>
    <div v-else-if="error" class="error" role="alert">
      <p>{{ error }}</p>
      <button class="button secondary" type="button" @click="loadDashboard">Try again</button>
    </div>
    <div v-else-if="dashboard" class="summary-grid">
      <article class="card"><h3>{{ dashboard.users.total }}</h3><p>Total accounts</p></article>
      <article class="card"><h3>{{ dashboard.users.regular }}</h3><p>User accounts</p></article>
      <article class="card"><h3>{{ dashboard.users.administrators }}</h3><p>Administrators</p></article>
      <article class="card"><h3>{{ dashboard.content.cyclingSegments }}</h3><p>Cycling segments</p></article>
      <article class="card"><h3>{{ dashboard.content.events }}</h3><p>Events</p></article>
      <article class="card"><h3>{{ dashboard.ratings.total }}</h3><p>Segment ratings</p></article>
      <article class="card"><h3>{{ dashboard.ratings.ratedSegments }}</h3><p>Rated segments</p></article>
      <article class="card"><h3>{{ averageRating }}</h3><p>Average rating</p></article>
    </div>
  </section>
</template>
