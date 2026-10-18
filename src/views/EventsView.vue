<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useFirestoreData } from '../services/firestoreData'

const { events, loading, error, loadFirestoreData } = useFirestoreData()
const selectedEvent = ref(null)
const submitted = ref(false)
const attempted = ref(false)
const form = reactive({ name: '', email: '', riders: 1 })
const nameInput = ref(null)
const emailInput = ref(null)
const ridersInput = ref(null)
const searchText = ref('')
const titleFilter = ref('')
const dateFilter = ref('')
const categoryFilter = ref('')
const locationFilter = ref('')
const levelFilter = ref('')
const organiserFilter = ref('')
const sortField = ref('eventDate')
const sortDirection = ref('ascending')
const currentPage = ref(1)

onMounted(loadFirestoreData)
watch(events, (availableEvents) => {
  if (!selectedEvent.value && availableEvents.length) selectedEvent.value = availableEvents[0]
}, { immediate: true })

const categories = computed(() =>
  [...new Set(events.value.map((event) => event.category).filter(Boolean))].sort(),
)
const levels = computed(() =>
  [...new Set(events.value.map((event) => event.level).filter(Boolean))].sort(),
)
const filteredEvents = computed(() => {
  const search = searchText.value.trim().toLowerCase()
  const title = titleFilter.value.trim().toLowerCase()
  const location = locationFilter.value.trim().toLowerCase()
  const organiser = organiserFilter.value.trim().toLowerCase()

  return events.value.filter((event) => {
    const eventTitle = String(event.title || '').toLowerCase()
    const eventLocation = String(event.location || '').toLowerCase()
    const eventOrganiser = String(event.organiser || '').toLowerCase()
    const searchableText = [
      event.title,
      event.eventDate,
      event.time,
      event.category,
      event.location,
      event.level,
      event.organiser,
    ].filter(Boolean).join(' ').toLowerCase()

    return (!search || searchableText.includes(search))
      && (!title || eventTitle.includes(title))
      && (!dateFilter.value || event.eventDate === dateFilter.value)
      && (!categoryFilter.value || event.category === categoryFilter.value)
      && (!location || eventLocation.includes(location))
      && (!levelFilter.value || event.level === levelFilter.value)
      && (!organiser || eventOrganiser.includes(organiser))
  })
})
const sortedEvents = computed(() => [...filteredEvents.value].sort((first, second) => {
  const firstValue = String(first[sortField.value] || '')
  const secondValue = String(second[sortField.value] || '')
  const result = firstValue.localeCompare(secondValue)

  return sortDirection.value === 'ascending' ? result : -result
}))
const totalPages = computed(() => Math.max(1, Math.ceil(sortedEvents.value.length / 10)))
const displayedEvents = computed(() => {
  const start = (currentPage.value - 1) * 10
  return sortedEvents.value.slice(start, start + 10)
})
const firstDisplayedRow = computed(() => (
  filteredEvents.value.length ? (currentPage.value - 1) * 10 + 1 : 0
))
const lastDisplayedRow = computed(() => (
  Math.min(currentPage.value * 10, filteredEvents.value.length)
))
const errors = computed(() => ({
  name: form.name.trim() ? '' : 'Please enter your name.',
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? '' : 'Enter a valid email address.',
  riders: Number.isInteger(form.riders) && form.riders >= 1 && form.riders <= 6 ? '' : 'Choose a whole number from 1 to 6.',
}))

watch(
  [
    searchText,
    titleFilter,
    dateFilter,
    categoryFilter,
    locationFilter,
    levelFilter,
    organiserFilter,
  ],
  () => { currentPage.value = 1 },
)

function sortEvents(field) {
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

function formatEventDate(event) {
  if (!event.eventDate) return `${event.day || ''} ${event.month || ''}`.trim()

  return new Date(`${event.eventDate}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function resetFilters() {
  searchText.value = ''
  titleFilter.value = ''
  dateFilter.value = ''
  categoryFilter.value = ''
  locationFilter.value = ''
  levelFilter.value = ''
  organiserFilter.value = ''
  currentPage.value = 1
}

async function selectEvent(event) {
  selectedEvent.value = event
  submitted.value = false
  attempted.value = false
  await nextTick()
  document.querySelector('#registration')?.scrollIntoView()
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
  <section class="page-banner">
    <div class="container"><h1>Events</h1><p>Browse sample community events and register your interest.</p></div>
  </section>
  <section class="section container">
    <h2>Upcoming events</h2>
    <form class="filters" @submit.prevent>
      <div class="field">
        <label for="event-search">Search all columns</label>
        <input id="event-search" v-model.trim="searchText" type="search" placeholder="Search events" />
      </div>
      <button class="button secondary" type="button" @click="resetFilters">Reset filters</button>
    </form>

    <p v-if="loading" role="status">Loading events…</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else class="result-count" aria-live="polite">
      Showing {{ firstDisplayedRow }}–{{ lastDisplayedRow }} of {{ filteredEvents.length }} matching events
    </p>

    <div v-if="!loading && !error && displayedEvents.length" class="table-wrapper">
      <table class="data-table event-table">
        <caption class="sr-only">Upcoming Pedal Melbourne community events</caption>
        <thead>
          <tr>
            <th scope="col" :aria-sort="sortState('title')"><button class="table-sort" type="button" @click="sortEvents('title')">Event{{ sortIndicator('title') }}</button></th>
            <th scope="col" :aria-sort="sortState('eventDate')"><button class="table-sort" type="button" @click="sortEvents('eventDate')">Date{{ sortIndicator('eventDate') }}</button></th>
            <th scope="col" :aria-sort="sortState('category')"><button class="table-sort" type="button" @click="sortEvents('category')">Category{{ sortIndicator('category') }}</button></th>
            <th scope="col" :aria-sort="sortState('location')"><button class="table-sort" type="button" @click="sortEvents('location')">Location{{ sortIndicator('location') }}</button></th>
            <th scope="col" :aria-sort="sortState('level')"><button class="table-sort" type="button" @click="sortEvents('level')">Level{{ sortIndicator('level') }}</button></th>
            <th scope="col" :aria-sort="sortState('organiser')"><button class="table-sort" type="button" @click="sortEvents('organiser')">Organiser{{ sortIndicator('organiser') }}</button></th>
            <th scope="col">Action</th>
          </tr>
          <tr class="column-filters">
            <th><label class="sr-only" for="event-title-filter">Filter event column</label><input id="event-title-filter" v-model.trim="titleFilter" type="search" placeholder="Filter event" /></th>
            <th><label class="sr-only" for="event-date-filter">Filter date column</label><input id="event-date-filter" v-model="dateFilter" type="date" /></th>
            <th><label class="sr-only" for="event-category-filter">Filter category column</label><select id="event-category-filter" v-model="categoryFilter"><option value="">All</option><option v-for="category in categories" :key="category">{{ category }}</option></select></th>
            <th><label class="sr-only" for="event-location-filter">Filter location column</label><input id="event-location-filter" v-model.trim="locationFilter" type="search" placeholder="Filter location" /></th>
            <th><label class="sr-only" for="event-level-filter">Filter level column</label><select id="event-level-filter" v-model="levelFilter"><option value="">All</option><option v-for="level in levels" :key="level">{{ level }}</option></select></th>
            <th><label class="sr-only" for="event-organiser-filter">Filter organiser column</label><input id="event-organiser-filter" v-model.trim="organiserFilter" type="search" placeholder="Filter organiser" /></th>
            <th aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in displayedEvents" :key="event.id">
            <th scope="row">{{ event.title }}</th>
            <td>{{ formatEventDate(event) }}<br /><span class="muted">{{ event.time }}</span></td>
            <td>{{ event.category || 'Not specified' }}</td>
            <td>{{ event.location }}</td>
            <td>{{ event.level }}</td>
            <td>{{ event.organiser || 'Not specified' }}</td>
            <td><button class="text-button" type="button" @click="selectEvent(event)">{{ selectedEvent?.id === event.id ? 'Selected' : 'Register interest' }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav v-if="!loading && !error && filteredEvents.length" class="pagination" aria-label="Event table pages">
      <button class="button secondary" type="button" :disabled="currentPage === 1" @click="currentPage--">Previous</button>
      <span>Page {{ currentPage }} of {{ totalPages }}</span>
      <button class="button secondary" type="button" :disabled="currentPage === totalPages" @click="currentPage++">Next</button>
    </nav>
    <div v-else-if="!loading && !error" class="empty-state">
      <h2>No events match those filters</h2>
      <p>Try another date, category or search term.</p>
      <button class="button primary" type="button" @click="resetFilters">Show all events</button>
    </div>

    <section v-if="selectedEvent" id="registration" class="form-panel event-registration" aria-labelledby="registration-heading">
      <p><strong>Selected event</strong></p>
      <h2 id="registration-heading">{{ selectedEvent.title }}</h2>
      <p class="muted">{{ formatEventDate(selectedEvent) }} · {{ selectedEvent.location }} · {{ selectedEvent.time }}</p>
      <form novalidate @input="submitted = false" @submit.prevent="submitForm">
        <div class="field"><label for="name">Name</label><input id="name" ref="nameInput" v-model="form.name" type="text" autocomplete="name" maxlength="80" :aria-invalid="attempted && !!errors.name" aria-describedby="name-error" /><p v-if="attempted && errors.name" id="name-error" class="error">{{ errors.name }}</p></div>
        <div class="field"><label for="email">Email</label><input id="email" ref="emailInput" v-model="form.email" type="email" autocomplete="email" maxlength="120" :aria-invalid="attempted && !!errors.email" aria-describedby="email-error" /><p v-if="attempted && errors.email" id="email-error" class="error">{{ errors.email }}</p></div>
        <div class="field"><label for="riders">Number of riders</label><input id="riders" ref="ridersInput" v-model.number="form.riders" type="number" min="1" max="6" step="1" :aria-invalid="attempted && !!errors.riders" aria-describedby="riders-error" /><p v-if="attempted && errors.riders" id="riders-error" class="error">{{ errors.riders }}</p></div>
        <button class="button primary full-width" type="submit">Register interest</button>
        <p class="data-note">This form is a demonstration. No registration or email is sent.</p>
        <p v-if="submitted" class="success" role="status">Thanks, {{ form.name.trim() }}. Your demonstration registration for {{ selectedEvent.title }} is valid.</p>
      </form>
    </section>
  </section>
</template>
