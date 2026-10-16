<script setup>
import { getAccountSummary } from '../services/auth'
import { routes } from '../data/routes'
import { events } from '../data/events'
import { useRatings } from '../services/ratings'

const accounts = getAccountSummary()
const { ratings } = useRatings()
</script>

<template>
  <section class="page-banner"><div class="container"><h1>Admin dashboard</h1><p>This page is available only to administrators.</p></div></section>
  <section class="section container">
    <h2>Application summary</h2>
    <div class="summary-grid">
      <article class="card"><h3>{{ accounts.total }}</h3><p>Total accounts</p></article>
      <article class="card"><h3>{{ accounts.users }}</h3><p>User accounts</p></article>
      <article class="card"><h3>{{ routes.length }}</h3><p>Sample routes</p></article>
      <article class="card"><h3>{{ events.length }}</h3><p>Sample events</p></article>
      <article class="card"><h3>{{ ratings.length }}</h3><p>Route ratings</p></article>
    </div>
  </section>
</template>
