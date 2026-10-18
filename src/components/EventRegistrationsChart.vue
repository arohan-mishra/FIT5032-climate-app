<script setup>
import Chart from 'chart.js/auto'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  events: { type: Array, required: true },
})

const emit = defineEmits(['select-event'])
const canvas = ref(null)
let chart

const displayedEvents = computed(() => (
  props.events.filter((event) => event.registrations > 0).slice(0, 10)
))

function chartData() {
  return {
    labels: displayedEvents.value.map((event) => event.title),
    datasets: [
      {
        label: 'Registered accounts',
        data: displayedEvents.value.map((event) => event.registrations),
        backgroundColor: '#176b52',
      },
      {
        label: 'Total riders',
        data: displayedEvents.value.map((event) => event.riders),
        backgroundColor: '#315b7d',
      },
    ],
  }
}

function createChart() {
  if (!canvas.value || !displayedEvents.value.length) return

  chart?.destroy()
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: chartData(),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      onClick(_event, elements) {
        const selectedIndex = elements[0]?.index
        if (Number.isInteger(selectedIndex)) {
          emit('select-event', displayedEvents.value[selectedIndex].eventId)
        }
      },
      onHover(event, elements) {
        const target = event.native?.target
        if (target instanceof HTMLElement) target.style.cursor = elements.length ? 'pointer' : 'default'
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: 'People' },
        },
        x: {
          ticks: { maxRotation: 45, minRotation: 0 },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            afterBody(items) {
              const selectedEvent = displayedEvents.value[items[0]?.dataIndex]
              return selectedEvent?.eventDate ? `Date: ${selectedEvent.eventDate}` : ''
            },
          },
        },
      },
    },
  })
}

watch(displayedEvents, async () => {
  await nextTick()
  createChart()
})

onMounted(createChart)
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div v-if="displayedEvents.length">
    <p class="data-note">Hover over a bar for details or select one to prepare an email for that event.</p>
    <div class="chart-wrapper">
      <canvas ref="canvas" role="img" aria-label="Bar chart comparing registered accounts and total riders for the ten events with the most registrations"></canvas>
    </div>
    <details class="chart-data">
      <summary>View chart data as a table</summary>
      <div class="table-wrapper">
        <table class="chart-data-table">
          <caption class="sr-only">Event registration chart data</caption>
          <thead><tr><th scope="col">Event</th><th scope="col">Date</th><th scope="col">Accounts</th><th scope="col">Riders</th><th scope="col">Action</th></tr></thead>
          <tbody>
            <tr v-for="event in displayedEvents" :key="event.eventId">
              <th scope="row">{{ event.title }}</th>
              <td>{{ event.eventDate || 'Not specified' }}</td>
              <td>{{ event.registrations }}</td>
              <td>{{ event.riders }}</td>
              <td><button class="text-button" type="button" @click="$emit('select-event', event.eventId)">Prepare email</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
  <p v-else>No event data is available for the chart.</p>
</template>
