<script setup>
import { useAuth } from '../services/auth'

const { currentUser } = useAuth()
</script>

<template>
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
