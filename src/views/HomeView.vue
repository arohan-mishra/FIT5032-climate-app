<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useFirestoreData } from '../services/firestoreData'
import RouteCard from '../components/RouteCard.vue'
import EventCard from '../components/EventCard.vue'

const { cyclingSegments, events, loading, error, loadFirestoreData } = useFirestoreData()
const eventsPerPage = 6
const currentEventPage = ref(1)
const totalEventPages = computed(() => Math.max(1, Math.ceil(events.value.length / eventsPerPage)))
const displayedEvents = computed(() => {
  const start = (currentEventPage.value - 1) * eventsPerPage
  return events.value.slice(start, start + eventsPerPage)
})

watch(totalEventPages, (totalPages) => {
  if (currentEventPage.value > totalPages) currentEventPage.value = totalPages
})

onMounted(loadFirestoreData)
</script>

<template>
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <h1>Pedal Melbourne</h1>
        <p class="hero-copy">
          Find cycling segments, generated routes and community events around Melbourne.
        </p>
        <div class="button-row">
          <RouterLink class="button primary" to="/routes">Explore cycling</RouterLink>
          <RouterLink class="button secondary" to="/events">See events</RouterLink>
        </div>
      </div>
    </div>
  </section>

  <section class="section container">
    <div class="section-heading">
      <div><h2>Melbourne cycling segments</h2></div>
      <RouterLink class="text-link" to="/routes">View all segments →</RouterLink>
    </div>
    <p v-if="loading" role="status">Loading segments…</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <div v-else class="card-grid">
      <RouteCard v-for="segment in cyclingSegments.slice(0, 3)" :key="segment.id" :route="segment" />
    </div>
  </section>

  <section class="section section-tint">
    <div class="container">
      <div class="section-heading"><div><h2>Upcoming events</h2></div></div>
      <p v-if="loading" role="status">Loading events…</p>
      <p v-else-if="error" class="error" role="alert">{{ error }}</p>
      <div v-if="!loading && !error" class="event-grid">
        <EventCard v-for="event in displayedEvents" :key="event.id" :event="event" :show-action="false" />
      </div>
      <nav v-if="!loading && !error && totalEventPages > 1" class="pagination" aria-label="Upcoming event pages">
        <button class="button secondary" type="button" :disabled="currentEventPage === 1" @click="currentEventPage--">Previous</button>
        <span aria-live="polite">Page {{ currentEventPage }} of {{ totalEventPages }}</span>
        <button class="button secondary" type="button" :disabled="currentEventPage === totalEventPages" @click="currentEventPage++">Next</button>
      </nav>
    </div>
  </section>
</template>
