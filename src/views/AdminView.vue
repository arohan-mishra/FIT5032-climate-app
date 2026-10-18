<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { fetchAdminDashboard } from '../services/adminDashboard'
import { sendEventUpdate } from '../services/eventRegistrations'
import { useFirestoreData } from '../services/firestoreData'

const { events, loadFirestoreData } = useFirestoreData()
const dashboard = ref(null)
const loading = ref(false)
const error = ref('')
const emailSending = ref(false)
const emailAttempted = ref(false)
const emailError = ref('')
const emailSuccess = ref('')
const emailForm = reactive({ eventId: '', subject: '', body: '' })

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
const emailErrors = computed(() => ({
  eventId: emailForm.eventId ? '' : 'Choose an event.',
  subject: emailForm.subject.trim().length >= 3 && emailForm.subject.trim().length <= 120
    ? ''
    : 'Enter a subject from 3 to 120 characters.',
  body: emailForm.body.trim().length >= 10 && emailForm.body.trim().length <= 5000
    ? ''
    : 'Enter a message from 10 to 5000 characters.',
}))

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

async function sendUpdate() {
  emailAttempted.value = true
  emailError.value = ''
  emailSuccess.value = ''
  if (Object.values(emailErrors.value).some(Boolean)) return

  const selectedEvent = events.value.find((event) => String(event.id) === emailForm.eventId)
  if (!window.confirm(`Send this update to every registered user for ${selectedEvent?.title || 'this event'}?`)) return

  emailSending.value = true
  try {
    const result = await sendEventUpdate({
      eventId: emailForm.eventId,
      subject: emailForm.subject.trim(),
      body: emailForm.body.trim(),
    })
    emailSuccess.value = result.message
    emailForm.subject = ''
    emailForm.body = ''
    emailAttempted.value = false
  } catch (sendError) {
    console.error('Unable to send event update:', sendError)
    emailError.value = sendError.message
  } finally {
    emailSending.value = false
  }
}

onMounted(() => {
  loadDashboard()
  loadFirestoreData()
})
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

      <section class="dashboard-panel" aria-labelledby="event-email-heading">
        <h2 id="event-email-heading">Email registered event users</h2>
        <p>Send a customised update to every user registered for one event. The current calendar file will be attached.</p>
        <form class="bulk-email-form" novalidate @input="emailSuccess = ''" @submit.prevent="sendUpdate">
          <div class="field">
            <label for="email-event">Event</label>
            <select id="email-event" v-model="emailForm.eventId" :aria-invalid="emailAttempted && !!emailErrors.eventId" aria-describedby="email-event-error">
              <option value="">Choose an event</option>
              <option v-for="event in events" :key="event.id" :value="String(event.id)">{{ event.title }} — {{ event.eventDate }}</option>
            </select>
            <p v-if="emailAttempted && emailErrors.eventId" id="email-event-error" class="error">{{ emailErrors.eventId }}</p>
          </div>
          <div class="field">
            <label for="email-subject">Subject</label>
            <input id="email-subject" v-model="emailForm.subject" type="text" maxlength="120" :aria-invalid="emailAttempted && !!emailErrors.subject" aria-describedby="email-subject-error" />
            <p v-if="emailAttempted && emailErrors.subject" id="email-subject-error" class="error">{{ emailErrors.subject }}</p>
          </div>
          <div class="field">
            <label for="email-body">Message</label>
            <textarea id="email-body" v-model="emailForm.body" rows="7" maxlength="5000" :aria-invalid="emailAttempted && !!emailErrors.body" aria-describedby="email-body-help email-body-error"></textarea>
            <p id="email-body-help" class="data-note">Plain text only. {{ emailForm.body.length }} / 5000 characters.</p>
            <p v-if="emailAttempted && emailErrors.body" id="email-body-error" class="error">{{ emailErrors.body }}</p>
          </div>
          <button class="button primary" type="submit" :disabled="emailSending">{{ emailSending ? 'Sending update…' : 'Send event update' }}</button>
          <p v-if="emailError" class="error booking-message" role="alert">{{ emailError }}</p>
          <p v-if="emailSuccess" class="success" role="status">{{ emailSuccess }}</p>
        </form>
      </section>
    </div>
  </section>
</template>
