<script setup>
import { computed, ref } from 'vue'
import RouteCard from '../components/RouteCard.vue'
import { routes } from '../data/routes'

const difficulty = ref('All')
const maxDistance = ref(50)

const filteredRoutes = computed(() =>
  routes.filter((route) => {
    const matchesDifficulty = difficulty.value === 'All' || route.difficulty === difficulty.value
    return matchesDifficulty && route.distance <= maxDistance.value
  }),
)

function resetFilters() {
  difficulty.value = 'All'
  maxDistance.value = 50
}
</script>

<template>
  <section class="page-banner">
    <div class="container"><h1>Find a route</h1><p>Filter the sample routes by difficulty and distance.</p></div>
  </section>
  <section class="section container">
    <form class="filters" @submit.prevent>
      <div class="field"><label for="difficulty">Difficulty</label><select id="difficulty" v-model="difficulty"><option>All</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
      <div class="field range-field"><label for="distance">Maximum distance: <strong>{{ maxDistance }} km</strong></label><input id="distance" v-model.number="maxDistance" type="range" min="10" max="50" step="5" /></div>
      <button class="button secondary" type="button" @click="resetFilters">Reset filters</button>
    </form>
    <p class="result-count" aria-live="polite">Showing {{ filteredRoutes.length }} of {{ routes.length }} routes</p>
    <div v-if="filteredRoutes.length" class="card-grid">
      <RouteCard v-for="route in filteredRoutes" :key="route.id" :route="route" />
    </div>
    <div v-else class="empty-state"><h2>No routes match those filters</h2><p>Try a longer distance or a different difficulty.</p><button class="button primary" type="button" @click="resetFilters">Show all routes</button></div>
  </section>
</template>
