<script setup>
import { useAuth } from '../services/auth'

const { currentUser } = useAuth()
</script>

<template>
  <section class="page-banner"><div class="container"><h1>My account</h1><p>View the account used for this demonstration session.</p></div></section>
  <section class="section container">
    <div class="form-panel auth-form">
      <h2>Account details</h2>
      <dl class="details-list">
        <dt>Name</dt><dd>{{ currentUser.name }}</dd>
        <dt>Email</dt><dd>{{ currentUser.email }}</dd>
        <dt>Role</dt><dd>{{ currentUser.role }}</dd>
      </dl>
    </div>
  </section>
</template>
