<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import EventCard from '../components/EventCard.vue'
import { events } from '../data/events'

const selectedEvent = ref(events[0])
const submitted = ref(false)
const attempted = ref(false)
const form = reactive({ name: '', email: '', riders: 1 })
const nameInput = ref(null)
const emailInput = ref(null)
const ridersInput = ref(null)

const errors = computed(() => ({
  name: form.name.trim() ? '' : 'Please enter your name.',
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? '' : 'Enter a valid email address.',
  riders: Number.isInteger(form.riders) && form.riders >= 1 && form.riders <= 6 ? '' : 'Choose a whole number from 1 to 6.',
}))

function selectEvent(event) {
  selectedEvent.value = event
  submitted.value = false
  document.querySelector('#registration')?.scrollIntoView({ behavior: 'smooth' })
}

async function submitForm() {
  attempted.value = true
  submitted.value = !Object.values(errors.value).some(Boolean)

  if (!submitted.value) {
    await nextTick()
    if (errors.value.name) nameInput.value.focus()
    else if (errors.value.email) emailInput.value.focus()
    else ridersInput.value.focus()
  }
}
</script>

<template>
  <section class="page-banner"><div class="container"><h1>Events</h1><p>Browse sample community events and register your interest.</p></div></section>
  <section class="section container two-column">
    <div>
      <h2>Upcoming demo events</h2>
      <div class="event-list"><EventCard v-for="event in events" :key="event.id" :event="event" :selected="selectedEvent.id === event.id" @select="selectEvent" /></div>
    </div>
    <div id="registration" class="form-panel">
      <p><strong>Selected event</strong></p><h2>{{ selectedEvent.title }}</h2><p class="muted">{{ selectedEvent.location }} · {{ selectedEvent.time }}</p>
      <form novalidate @input="submitted = false" @submit.prevent="submitForm">
        <div class="field"><label for="name">Name</label><input id="name" ref="nameInput" v-model="form.name" type="text" autocomplete="name" :aria-invalid="attempted && !!errors.name" aria-describedby="name-error" /><p v-if="attempted && errors.name" id="name-error" class="error">{{ errors.name }}</p></div>
        <div class="field"><label for="email">Email</label><input id="email" ref="emailInput" v-model="form.email" type="email" autocomplete="email" :aria-invalid="attempted && !!errors.email" aria-describedby="email-error" /><p v-if="attempted && errors.email" id="email-error" class="error">{{ errors.email }}</p></div>
        <div class="field"><label for="riders">Number of riders</label><input id="riders" ref="ridersInput" v-model.number="form.riders" type="number" min="1" max="6" step="1" :aria-invalid="attempted && !!errors.riders" aria-describedby="riders-error" /><p v-if="attempted && errors.riders" id="riders-error" class="error">{{ errors.riders }}</p></div>
        <button class="button primary full-width" type="submit">Register interest</button>
        <p class="data-note">This form is a demonstration. No registration or email is sent.</p>
        <p v-if="submitted" class="success" role="status">Thanks, {{ form.name.trim() }}. Your demonstration registration for {{ selectedEvent.title }} is valid.</p>
      </form>
    </div>
  </section>
</template>
