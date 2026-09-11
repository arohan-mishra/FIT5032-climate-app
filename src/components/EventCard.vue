<script setup>
defineProps({
  event: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

defineEmits(['select'])
</script>

<template>
  <article class="event-card">
    <div class="date-tile" aria-hidden="true">
      <strong>{{ event.day }}</strong>
      <span>{{ event.month }}</span>
    </div>
    <div>
      <span class="tag">{{ event.level }}</span>
      <h3>{{ event.title }}</h3>
      <p class="muted">{{ event.location }} · {{ event.time }}</p>
      <button class="text-button" type="button" @click="$emit('select', event)">
        {{ selected ? 'Selected' : 'Register interest' }}
      </button>
    </div>
  </article>
</template>
