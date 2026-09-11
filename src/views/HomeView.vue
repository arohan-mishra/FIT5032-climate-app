<script setup>
import { routes } from '../data/routes'
import { events } from '../data/events'
import RouteCard from '../components/RouteCard.vue'
import EventCard from '../components/EventCard.vue'
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
    <div class="card-grid">
      <RouteCard v-for="route in routes.slice(0, 3)" :key="route.id" :route="route" />
    </div>
  </section>

  <section class="section section-tint">
    <div class="container">
      <div class="section-heading"><div><h2>Upcoming events</h2></div></div>
      <div class="event-grid">
        <EventCard v-for="event in events" :key="event.id" :event="event" />
      </div>
      <p class="data-note">Events shown are sample data for this demonstration application.</p>
    </div>
  </section>
</template>
