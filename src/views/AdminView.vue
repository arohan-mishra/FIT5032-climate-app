<script setup>
import { computed, onMounted } from 'vue'
import { getAccountSummary } from '../services/auth'
import { routes } from '../data/routes'
import { events } from '../data/events'
import { useFirestoreRatings } from '../services/firestoreRatings'

const accounts = getAccountSummary()
const { ratings, loading, error, loadRatings } = useFirestoreRatings()

const ratedSegments = computed(() => new Set(
  ratings.value.map((rating) => rating.segmentId),
).size)
const averageRating = computed(() => {
  if (!ratings.value.length) return 'No ratings'

  const total = ratings.value.reduce((sum, rating) => sum + rating.score, 0)
  return `${(total / ratings.value.length).toFixed(1)} / 5`
})

onMounted(loadRatings)
</script>

<template>
  <section class="page-banner"><div class="container"><h1>Admin dashboard</h1><p>This page is available only to administrators.</p></div></section>
  <section class="section container">
    <h2>Application summary</h2>
    <div class="summary-grid">
      <article class="card"><h3>{{ accounts.total }}</h3><p>Total accounts</p></article>
      <article class="card"><h3>{{ accounts.users }}</h3><p>User accounts</p></article>
      <article class="card"><h3>{{ routes.length }}</h3><p>Sample routes</p></article>
      <article class="card"><h3>{{ events.length }}</h3><p>Sample events</p></article>
      <article class="card"><h3>{{ loading ? '…' : ratings.length }}</h3><p>Segment ratings</p></article>
      <article class="card"><h3>{{ loading ? '…' : ratedSegments }}</h3><p>Rated segments</p></article>
      <article class="card"><h3>{{ loading ? '…' : averageRating }}</h3><p>Average rating</p></article>
    </div>
    <p v-if="loading" role="status">Loading rating statistics…</p>
    <div v-else-if="error" class="error" role="alert">
      <p>{{ error }}</p>
      <button class="button secondary" type="button" @click="loadRatings">Try again</button>
    </div>
  </section>
</template>
