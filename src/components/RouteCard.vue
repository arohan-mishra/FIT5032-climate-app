<script setup>
defineProps({
  route: { type: Object, required: true },
})
</script>

<template>
  <article class="card route-card">
    <div class="card-content">
      <div class="eyebrow-row">
        <span class="tag">{{ route.difficulty }}</span>
        <span>{{ route.distance }} km</span>
      </div>
      <h3>{{ route.name }}</h3>
      <p class="muted">{{ route.area }} · About {{ route.duration }} minutes</p>
      <p>{{ route.description }}</p>
      <ul class="facility-list" :aria-label="`Facilities on ${route.name}`">
        <li v-for="facility in route.facilities" :key="facility">{{ facility }}</li>
      </ul>
    </div>
  </article>
</template>
