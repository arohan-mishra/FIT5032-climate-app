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
const roleBreakdown = computed(() => {
  if (!dashboard.value) return []

  const total = dashboard.value.users.total
  return [
    { label: 'Users', count: dashboard.value.users.regular },
    { label: 'Administrators', count: dashboard.value.users.administrators },
  ].map((role) => ({
    ...role,
    percentage: total ? Math.round((role.count / total) * 100) : 0,
  }))
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
  <section class="page-banner">
    <div class="container">
      <h1>Admin dashboard</h1>
      <p>Review users, published content and community ratings.</p>
    </div>
  </section>
  <section class="section container">
    <p v-if="loading" role="status">Loading dashboard statistics…</p>
    <div v-else-if="error" class="error" role="alert">
      <p>{{ error }}</p>
      <button class="button secondary" type="button" @click="loadDashboard">Try again</button>
    </div>
    <div v-else-if="dashboard" class="dashboard-sections">
      <section class="dashboard-panel" aria-labelledby="user-summary-heading">
        <h2 id="user-summary-heading">Users</h2>
        <div class="dashboard-metrics">
          <article class="dashboard-metric"><strong>{{ dashboard.users.total }}</strong><span>Total accounts</span></article>
          <article class="dashboard-metric"><strong>{{ dashboard.users.regular }}</strong><span>User accounts</span></article>
          <article class="dashboard-metric"><strong>{{ dashboard.users.administrators }}</strong><span>Administrators</span></article>
        </div>
        <div class="role-breakdown">
          <h3>Account roles</h3>
          <div v-for="role in roleBreakdown" :key="role.label" class="role-row">
            <div><span>{{ role.label }}</span><strong>{{ role.count }} ({{ role.percentage }}%)</strong></div>
            <progress
              :value="role.count"
              :max="Math.max(dashboard.users.total, 1)"
              :aria-label="`${role.label}: ${role.count} accounts, ${role.percentage}%`"
            >{{ role.percentage }}%</progress>
          </div>
        </div>
      </section>

      <section class="dashboard-panel" aria-labelledby="content-summary-heading">
        <h2 id="content-summary-heading">Published content</h2>
        <div class="dashboard-metrics">
          <article class="dashboard-metric"><strong>{{ dashboard.content.cyclingSegments }}</strong><span>Cycling segments</span></article>
          <article class="dashboard-metric"><strong>{{ dashboard.content.events }}</strong><span>Events</span></article>
        </div>
      </section>

      <section class="dashboard-panel" aria-labelledby="rating-summary-heading">
        <h2 id="rating-summary-heading">Community ratings</h2>
        <div class="dashboard-metrics">
          <article class="dashboard-metric"><strong>{{ dashboard.ratings.total }}</strong><span>Ratings submitted</span></article>
          <article class="dashboard-metric"><strong>{{ dashboard.ratings.ratedSegments }}</strong><span>Rated segments</span></article>
          <article class="dashboard-metric"><strong>{{ averageRating }}</strong><span>Average score</span></article>
        </div>
      </section>
    </div>
  </section>
</template>
