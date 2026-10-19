<script setup>
import dayGridPlugin from '@fullcalendar/vue3/daygrid'
import interactionPlugin from '@fullcalendar/vue3/interaction'
import classicThemePlugin from '@fullcalendar/vue3/themes/classic'
import FullCalendar from '@fullcalendar/vue3'
import '@fullcalendar/vue3/skeleton.css'
import '@fullcalendar/vue3/themes/classic/theme.css'
import '@fullcalendar/vue3/themes/classic/palette.css'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import RouteMap from '../components/RouteMap.vue'
import {
  cancelEventRegistration,
  loadMyEventRegistrations,
  registerForEvent,
} from '../services/eventRegistrations'
import { planRideToEvent } from '../services/eventDirections'
import { useAuth } from '../services/auth'
import { useFirestoreData } from '../services/firestoreData'
import { downloadEventRideAsGpx } from '../services/gpxExport'

const { events, loading, error, loadFirestoreData } = useFirestoreData()
const { currentUser } = useAuth()
const selectedEvent = ref(null)
const submitted = ref(false)
const attempted = ref(false)
const bookingError = ref('')
const bookings = ref([])
const bookingsLoading = ref(false)
const bookingSubmitting = ref(false)
const removingBookingId = ref('')
const calendarComponent = ref(null)
const bookingsSection = ref(null)
const selectedBookingId = ref('')
const form = reactive({ riders: 1 })
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
const rideEvent = ref(null)
const rideRoute = ref(null)
const rideStart = ref(null)
const rideDestination = ref(null)
const rideLoading = ref(false)
const rideError = ref('')
const rideExportMessage = ref('')
const ridePlanner = ref(null)

onMounted(() => {
  loadFirestoreData()
})

const categories = computed(() =>
  [...new Set(events.value.map((event) => event.category).filter(Boolean))].sort(),
)
const levels = computed(() =>
  [...new Set(events.value.map((event) => event.level).filter(Boolean))].sort(),
)
const bookedEventIds = computed(() => new Set(bookings.value.map((booking) => booking.eventId)))
const calendarEvents = computed(() => bookings.value.map((booking) => {
  const sourceEvent = events.value.find((event) => String(event.id) === booking.eventId)

  return {
    id: booking.eventId,
    title: booking.title,
    start: booking.start,
    end: booking.end,
    classNames: ['calendar-event-booked'],
    extendedProps: { location: sourceEvent?.location || '' },
  }
}))
const calendarOptions = computed(() => ({
  plugins: [classicThemePlugin, dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  initialDate: bookings.value[0]?.start || events.value[0]?.eventDate,
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: '',
  },
  events: calendarEvents.value,
  height: 'auto',
  dayMaxEvents: true,
  eventClick: handleCalendarEventClick,
  dateClick: handleCalendarDateClick,
  eventDidMount(info) {
    const location = info.event.extendedProps.location
    info.el.title = `${info.event.title}${location ? ` at ${location}` : ''}`
  },
}))
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
  riders: Number.isInteger(form.riders) && form.riders >= 1 && form.riders <= 6 ? '' : 'Choose a whole number from 1 to 6.',
}))
const rideSummary = computed(() => {
  const summary = rideRoute.value?.features?.[0]?.properties?.summary
  if (!summary) return null

  return {
    distance: (summary.distance / 1000).toFixed(1),
    duration: Math.max(1, Math.round(summary.duration / 60)),
  }
})

watch(currentUser, async (user) => {
  bookings.value = []
  selectedBookingId.value = ''
  submitted.value = false
  bookingError.value = ''
  if (!user) return

  bookingsLoading.value = true
  try {
    bookings.value = await loadMyEventRegistrations()
    await nextTick()
    if (bookings.value.length) calendarComponent.value?.getApi().gotoDate(bookings.value[0].start)
  } catch (loadError) {
    console.error('Unable to load event registrations:', loadError)
    bookingError.value = loadError.message
  } finally {
    bookingsLoading.value = false
  }
}, { immediate: true })

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

function handleCalendarEventClick(info) {
  selectedBookingId.value = info.event.id
  bookingsSection.value?.scrollIntoView()
}

function handleCalendarDateClick(info) {
  dateFilter.value = info.dateStr
  currentPage.value = 1
  document.querySelector('#event-table')?.scrollIntoView()
}

function isEventBooked(event) {
  return bookedEventIds.value.has(String(event.id))
}

async function selectEvent(event) {
  selectedEvent.value = event
  submitted.value = false
  attempted.value = false
  bookingError.value = ''
  await nextTick()
  document.querySelector('#registration')?.scrollIntoView()
}

async function planEventRide(event) {
  rideEvent.value = event
  rideRoute.value = null
  rideStart.value = null
  rideDestination.value = null
  rideError.value = ''
  rideExportMessage.value = ''
  await nextTick()
  ridePlanner.value?.scrollIntoView({ block: 'start' })
  ridePlanner.value?.focus({ preventScroll: true })

  if (!currentUser.value) {
    rideError.value = 'Log in before planning a ride to an event.'
    return
  }

  rideLoading.value = true
  try {
    const result = await planRideToEvent(event.id)
    rideRoute.value = result.route
    rideStart.value = result.start
    rideDestination.value = result.destination
  } catch (planningError) {
    console.error('Unable to plan ride to event:', planningError)
    rideError.value = planningError.message
  } finally {
    rideLoading.value = false
  }
}

function exportEventRide() {
  rideExportMessage.value = ''
  try {
    downloadEventRideAsGpx(rideRoute.value, rideEvent.value.title)
    rideExportMessage.value = 'Ride GPX download started.'
  } catch (exportError) {
    rideExportMessage.value = exportError.message
  }
}

async function submitForm() {
  attempted.value = true
  submitted.value = false
  bookingError.value = ''

  if (!currentUser.value) {
    bookingError.value = 'Log in before registering for an event.'
    return
  }

  if (Object.values(errors.value).some(Boolean)) {
    await nextTick()
    ridersInput.value.focus()
    return
  }

  bookingSubmitting.value = true
  try {
    const result = await registerForEvent(selectedEvent.value.id, form.riders)
    bookings.value = [...bookings.value, result.booking]
      .sort((first, second) => first.start.localeCompare(second.start))
    submitted.value = true
    await nextTick()
    calendarComponent.value?.getApi().gotoDate(result.booking.start)
  } catch (registrationError) {
    console.error('Unable to register for event:', registrationError)
    bookingError.value = registrationError.message
  } finally {
    bookingSubmitting.value = false
  }
}

async function removeBooking(eventId) {
  bookingError.value = ''
  removingBookingId.value = String(eventId)

  try {
    await cancelEventRegistration(eventId)
    bookings.value = bookings.value.filter((booking) => booking.eventId !== String(eventId))
    if (selectedBookingId.value === String(eventId)) selectedBookingId.value = ''
    submitted.value = false
  } catch (removalError) {
    console.error('Unable to remove event registration:', removalError)
    bookingError.value = removalError.message
  } finally {
    removingBookingId.value = ''
  }
}
</script>

<template>
  <section class="page-banner">
    <div class="container"><h1>Events</h1><p>Browse sample community events and register your interest.</p></div>
  </section>
  <section class="section container">
    <section class="calendar-panel" aria-labelledby="calendar-heading">
      <div class="section-heading">
        <div>
          <h2 id="calendar-heading">My event calendar</h2>
          <p>Your registered events appear here. Select a date to filter the available events.</p>
        </div>
      </div>
      <p v-if="loading" role="status">Loading calendar…</p>
      <p v-else-if="error" class="error" role="alert">{{ error }}</p>
      <FullCalendar v-else ref="calendarComponent" :options="calendarOptions" />
      <p v-if="bookingsLoading" class="calendar-empty" role="status">Loading your registrations…</p>
      <p v-else-if="!loading && !error && currentUser && !bookings.length" class="calendar-empty" role="status">You have no event registrations yet.</p>
      <p v-else-if="!loading && !error && !currentUser" class="calendar-empty">Log in to view your event registrations.</p>
      <p v-else-if="bookings.length" class="data-note"><span class="calendar-legend" aria-hidden="true"></span> Green events are registered and saved to your account.</p>
      <p v-if="bookingError" class="error booking-message" role="alert">{{ bookingError }}</p>
    </section>

    <section v-if="bookings.length" ref="bookingsSection" class="booking-list" aria-labelledby="bookings-heading">
      <h2 id="bookings-heading">My saved bookings</h2>
      <ul>
        <li v-for="booking in bookings" :key="booking.eventId" :class="{ 'selected-booking': selectedBookingId === booking.eventId }">
          <span>{{ booking.title }} · {{ new Date(booking.start).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) }}</span>
          <button class="text-button" type="button" :disabled="removingBookingId === booking.eventId" @click="removeBooking(booking.eventId)">{{ removingBookingId === booking.eventId ? 'Removing…' : 'Remove' }}</button>
        </li>
      </ul>
    </section>

    <div id="event-table"></div>
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
            <td>
              <div class="table-actions">
                <button class="text-button" type="button" :disabled="isEventBooked(event)" @click="selectEvent(event)">{{ isEventBooked(event) ? 'Booked' : selectedEvent?.id === event.id ? 'Selected' : 'Register' }}</button>
                <button class="text-button" type="button" :disabled="rideLoading" @click="planEventRide(event)">{{ rideLoading && rideEvent?.id === event.id ? 'Planning…' : 'Plan ride' }}</button>
              </div>
            </td>
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

    <section v-if="rideEvent" ref="ridePlanner" class="form-panel event-ride-planner" aria-labelledby="ride-planner-heading" tabindex="-1">
      <p><strong>Ride planner</strong></p>
      <h2 id="ride-planner-heading">Cycle to {{ rideEvent.title }}</h2>
      <p class="muted">{{ rideEvent.location }} · {{ formatEventDate(rideEvent) }} at {{ rideEvent.time }}</p>
      <p v-if="rideLoading" role="status">Using your location to calculate a cycling route…</p>
      <p v-if="rideError" class="error" role="alert">{{ rideError }}</p>
      <div v-if="rideRoute && rideSummary && rideStart && rideDestination">
        <dl class="ride-summary" aria-label="Planned ride summary">
          <div><dt>Distance</dt><dd>{{ rideSummary.distance }} km</dd></div>
          <div><dt>Estimated cycling time</dt><dd>{{ rideSummary.duration }} minutes</dd></div>
          <div><dt>Destination</dt><dd>{{ rideDestination.location }}</dd></div>
        </dl>
        <RouteMap
          :route="rideRoute"
          :location="rideStart"
          :destination="rideDestination"
          :destination-label="rideDestination.label"
        />
        <div class="export-action">
          <button class="button secondary" type="button" @click="exportEventRide">Export ride as GPX</button>
          <p v-if="rideExportMessage" role="status">{{ rideExportMessage }}</p>
        </div>
      </div>
    </section>

    <section v-if="selectedEvent" id="registration" class="form-panel event-registration" aria-labelledby="registration-heading">
      <p><strong>Selected event</strong></p>
      <h2 id="registration-heading">{{ selectedEvent.title }}</h2>
      <p class="muted">{{ formatEventDate(selectedEvent) }} · {{ selectedEvent.location }} · {{ selectedEvent.time }}</p>
      <form v-if="currentUser" novalidate @input="submitted = false" @submit.prevent="submitForm">
        <dl class="registration-account">
          <dt>Name</dt><dd>{{ currentUser.name }}</dd>
          <dt>Email</dt><dd>{{ currentUser.email }}</dd>
        </dl>
        <div class="field"><label for="riders">Number of riders</label><input id="riders" ref="ridersInput" v-model.number="form.riders" type="number" min="1" max="6" step="1" :aria-invalid="attempted && !!errors.riders" aria-describedby="riders-error" /><p v-if="attempted && errors.riders" id="riders-error" class="error">{{ errors.riders }}</p></div>
        <button class="button primary full-width" type="submit" :disabled="bookingSubmitting">{{ bookingSubmitting ? 'Sending confirmation…' : 'Register and email confirmation' }}</button>
        <p v-if="submitted" class="success" role="status">Thanks, {{ currentUser.name }}. Your registration was saved and the confirmation email was sent.</p>
      </form>
      <div v-else class="login-required">
        <p>You must log in before registering for this event.</p>
        <RouterLink class="button primary" to="/login">Log in</RouterLink>
      </div>
    </section>
  </section>
</template>
