<script setup>
import { onMounted } from 'vue'
import { useFirestoreData } from '../services/firestoreData'
import RouteCard from '../components/RouteCard.vue'
import EventCard from '../components/EventCard.vue'

const { routes, events, loading, error, loadFirestoreData } = useFirestoreData()
onMounted(loadFirestoreData)
</script>

<template>
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <h1>Pedal Melbourne</h1>
        <p class="hero-copy">
          Find cycling routes and community events around Melbourne.
        </p>
        <div class="button-row">
          <RouterLink class="button primary" to="/routes">Explore routes</RouterLink>
          <RouterLink class="button secondary" to="/events">See events</RouterLink>
        </div>
      </div>
    </div>
  </section>

  <section class="section container">
    <div class="section-heading">
      <div><h2>Popular routes</h2></div>
      <RouterLink class="text-link" to="/routes">View all routes →</RouterLink>
    </div>
    <p v-if="loading" role="status">Loading routes…</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <div v-else class="card-grid">
      <RouteCard v-for="route in routes.slice(0, 3)" :key="route.id" :route="route" />
    </div>
  </section>

  <section class="section section-tint">
    <div class="container">
      <div class="section-heading"><div><h2>Upcoming events</h2></div></div>
      <div v-if="!loading && !error" class="event-grid">
        <EventCard v-for="event in events" :key="event.id" :event="event" :show-action="false" />
      </div>
      <p class="data-note">Route and event information is loaded from Cloud Firestore.</p>
    </div>
  </section>
</template>
