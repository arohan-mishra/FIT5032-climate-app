<script setup>
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useAuth } from './services/auth'

const menuOpen = ref(false)
const { currentUser, logoutUser } = useAuth()

function logout() {
  logoutUser()
  menuOpen.value = false
}
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="site-header">
    <div class="container nav-wrap">
      <RouterLink class="brand" to="/" @click="menuOpen = false">
        <span class="brand-mark" aria-hidden="true">◉</span>
        <span>Pedal <strong>Melbourne</strong></span>
      </RouterLink>

      <button
        class="menu-button"
        type="button"
        :aria-expanded="menuOpen"
        aria-controls="main-navigation"
        @click="menuOpen = !menuOpen"
      >
        <span class="sr-only">Toggle navigation</span>
        <span aria-hidden="true">☰</span>
      </button>

      <nav id="main-navigation" :class="['main-nav', { open: menuOpen }]" aria-label="Main navigation">
        <RouterLink to="/" @click="menuOpen = false">Home</RouterLink>
        <RouterLink to="/routes" @click="menuOpen = false">Find a route</RouterLink>
        <RouterLink to="/events" @click="menuOpen = false">Events</RouterLink>
        <template v-if="currentUser">
          <RouterLink to="/account" @click="menuOpen = false">My account</RouterLink>
          <RouterLink v-if="currentUser.role === 'admin'" to="/admin" @click="menuOpen = false">Admin</RouterLink>
          <button class="text-button" type="button" @click="logout">Logout</button>
        </template>
        <template v-else>
          <RouterLink to="/login" @click="menuOpen = false">Login</RouterLink>
          <RouterLink to="/register" @click="menuOpen = false">Register</RouterLink>
        </template>
      </nav>
    </div>
  </header>

  <main id="main-content">
    <RouterView />
  </main>

  <footer class="site-footer">
    <div class="container footer-content">
      <p><strong>Pedal Melbourne</strong><br />Helping more people feel confident on two wheels.</p>
      <p>FIT5032 demonstration application</p>
    </div>
  </footer>
</template>
