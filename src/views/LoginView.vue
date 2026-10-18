<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loginUser, loginWithGoogle } from '../services/auth'

const route = useRoute()
const router = useRouter()
const form = reactive({ email: '', password: '' })
const error = ref('')
const submitting = ref(false)
const googleSubmitting = ref(false)

function continueAfterLogin() {
  const redirect = typeof route.query.redirect === 'string'
    && route.query.redirect.startsWith('/')
    && !route.query.redirect.startsWith('//')
    ? route.query.redirect
    : '/account'
  router.push(redirect)
}

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

  continueAfterLogin()
}

async function submitGoogleLogin() {
  error.value = ''
  googleSubmitting.value = true
  const result = await loginWithGoogle()
  googleSubmitting.value = false

  if (!result.success) {
    error.value = result.message
    return
  }

  continueAfterLogin()
}
</script>

<template>
  <section class="page-banner"><div class="container"><h1>Login</h1><p>Access your Pedal Melbourne account.</p></div></section>
  <section class="section container">
    <form class="form-panel auth-form" novalidate @submit.prevent="submitLogin">
      <p v-if="route.query.registered === 'true'" class="success" role="status">Account created. You can now log in.</p>
      <button
        class="button secondary full-width"
        type="button"
        :disabled="submitting || googleSubmitting"
        :aria-describedby="error ? 'login-error' : undefined"
        @click="submitGoogleLogin"
      >{{ googleSubmitting ? 'Connecting to Google…' : 'Continue with Google' }}</button>
      <div class="auth-divider"><span>or use email</span></div>
      <div class="field"><label for="login-email">Email</label><input id="login-email" v-model="form.email" type="email" autocomplete="email" maxlength="120" required :aria-invalid="!!error" aria-describedby="login-error" /></div>
      <div class="field"><label for="login-password">Password</label><input id="login-password" v-model="form.password" type="password" autocomplete="current-password" maxlength="128" required :aria-invalid="!!error" aria-describedby="login-error" /></div>
      <p v-if="error" id="login-error" class="error" role="alert">{{ error }}</p>
      <button class="button primary full-width" type="submit" :disabled="submitting || googleSubmitting">{{ submitting ? 'Logging in…' : 'Login' }}</button>
    </form>
  </section>
</template>
