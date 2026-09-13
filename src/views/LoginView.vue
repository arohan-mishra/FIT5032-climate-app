<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loginUser } from '../services/auth'

const route = useRoute()
const router = useRouter()
const form = reactive({ email: '', password: '' })
const error = ref('')
const submitting = ref(false)

async function submitLogin() {
  error.value = ''
  if (!form.email.trim() || !form.password) {
    error.value = 'Enter your email and password.'
    return
  }

  submitting.value = true
  const result = await loginUser(form.email, form.password)
  submitting.value = false

  if (!result.success) {
    error.value = result.message
    return
  }

  const redirect = typeof route.query.redirect === 'string'
    && route.query.redirect.startsWith('/')
    && !route.query.redirect.startsWith('//')
    ? route.query.redirect
    : '/account'
  router.push(redirect)
}
</script>

<template>
  <section class="page-banner"><div class="container"><h1>Login</h1><p>Access your demonstration account.</p></div></section>
  <section class="section container">
    <form class="form-panel auth-form" novalidate @submit.prevent="submitLogin">
      <p v-if="route.query.registered === 'true'" class="success" role="status">Account created. You can now log in.</p>
      <div class="data-note">
        <p><strong>Demo user:</strong><br />user@pedalmelbourne.test<br />User123!</p>
        <p><strong>Demo administrator:</strong><br />admin@pedalmelbourne.test<br />Admin123!</p>
      </div>
      <div class="field"><label for="login-email">Email</label><input id="login-email" v-model="form.email" type="email" autocomplete="email" maxlength="120" /></div>
      <div class="field"><label for="login-password">Password</label><input id="login-password" v-model="form.password" type="password" autocomplete="current-password" maxlength="128" /></div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="button primary full-width" type="submit" :disabled="submitting">{{ submitting ? 'Logging in…' : 'Login' }}</button>
    </form>
  </section>
</template>
