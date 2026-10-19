<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  route: { type: Object, required: true },
  location: { type: Object, required: true },
  destination: { type: Object, default: null },
  destinationLabel: { type: String, default: 'the event destination' },
})

const mapElement = ref(null)
let map
let routeLayer
let locationMarker
let destinationMarker

function drawRoute() {
  if (!map) return

  if (routeLayer) routeLayer.remove()
  if (locationMarker) locationMarker.remove()
  if (destinationMarker) destinationMarker.remove()

  routeLayer = L.geoJSON(props.route, {
    style: {
      color: '#176b52',
      opacity: 0.9,
      weight: 5,
    },
  }).addTo(map)

  locationMarker = L.circleMarker(
    [props.location.latitude, props.location.longitude],
    {
      color: '#ffffff',
      fillColor: '#176b52',
      fillOpacity: 1,
      radius: 8,
      weight: 3,
    },
  ).bindPopup('Your starting location').addTo(map)

  if (props.destination) {
    destinationMarker = L.circleMarker(
      [props.destination.latitude, props.destination.longitude],
      {
        color: '#ffffff',
        fillColor: '#315b7d',
        fillOpacity: 1,
        radius: 8,
        weight: 3,
      },
    ).bindPopup('Event destination').addTo(map)
  }

  const bounds = routeLayer.getBounds()
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] })
}

onMounted(() => {
  map = L.map(mapElement.value).setView(
    [props.location.latitude, props.location.longitude],
    13,
  )

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)

  drawRoute()
})

watch(
  () => [props.route, props.location, props.destination],
  drawRoute,
)

onBeforeUnmount(() => {
  if (map) map.remove()
})
</script>

<template>
  <div class="route-map-wrapper">
    <p id="route-map-description" class="data-note">
      Interactive map showing the generated cycling route from your starting location<span v-if="destination"> to {{ destinationLabel }}</span>.
    </p>
    <div
      ref="mapElement"
      class="route-map"
      role="region"
      :aria-label="destination ? `Cycling route map to ${destinationLabel}` : 'Generated cycling route map'"
      aria-describedby="route-map-description"
    ></div>
  </div>
</template>
