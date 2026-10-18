<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isSafeName, loginWithGoogle, registerUser } from '../services/auth'

const router = useRouter()
const attempted = ref(false)
const serverError = ref('')
const submitting = ref(false)
const googleSubmitting = ref(false)
const nameInput = ref(null)
const emailInput = ref(null)
const passwordInput = ref(null)
const confirmPasswordInput = ref(null)
const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })

const errors = computed(() => ({
  name: form.name.trim().length >= 2 && isSafeName(form.name)
    ? ''
    : 'Enter at least 2 characters without angle brackets.',
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? '' : 'Enter a valid email address.',
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(form.password)
    ? ''
    : 'Use at least 8 characters with uppercase, lowercase and a number.',
  confirmPassword: form.confirmPassword === form.password ? '' : 'Passwords must match.',
}))

async function submitRegistration() {
  attempted.value = true
  serverError.value = ''
  if (Object.values(errors.value).some(Boolean)) {
    await nextTick()
    if (errors.value.name) nameInput.value.focus()
    else if (errors.value.email) emailInput.value.focus()
    else if (errors.value.password) passwordInput.value.focus()
    else confirmPasswordInput.value.focus()
    return
  }

  submitting.value = true
  const result = await registerUser(form)
  submitting.value = false

  if (!result.success) {
    serverError.value = result.message
    return
  }

  router.push({ name: 'login', query: { registered: 'true' } })
}

async function submitGoogleRegistration() {
  serverError.value = ''
  googleSubmitting.value = true
  const result = await loginWithGoogle()
  googleSubmitting.value = false

  if (!result.success) {
    serverError.value = result.message
    return
  }

  router.push('/account')
}
</script>

<template>
  <section class="page-banner"><div class="container"><h1>Register</h1><p>Create your Pedal Melbourne account.</p></div></section>
  <section class="section container">
    <form class="form-panel auth-form" novalidate @submit.prevent="submitRegistration">
      <button
        class="button secondary full-width"
        type="button"
        :disabled="submitting || googleSubmitting"
        :aria-describedby="serverError ? 'register-server-error' : undefined"
        @click="submitGoogleRegistration"
      >{{ googleSubmitting ? 'Connecting to Google…' : 'Continue with Google' }}</button>
      <div class="auth-divider"><span>or register with email</span></div>
      <div class="field"><label for="register-name">Name</label><input id="register-name" ref="nameInput" v-model="form.name" type="text" autocomplete="name" maxlength="80" required :aria-invalid="attempted && !!errors.name" aria-describedby="register-name-error" /><p v-if="attempted && errors.name" id="register-name-error" class="error">{{ errors.name }}</p></div>
      <div class="field"><label for="register-email">Email</label><input id="register-email" ref="emailInput" v-model="form.email" type="email" autocomplete="email" maxlength="120" required :aria-invalid="attempted && !!errors.email" aria-describedby="register-email-error" /><p v-if="attempted && errors.email" id="register-email-error" class="error">{{ errors.email }}</p></div>
      <div class="field"><label for="register-password">Password</label><input id="register-password" ref="passwordInput" v-model="form.password" type="password" autocomplete="new-password" maxlength="128" required :aria-invalid="attempted && !!errors.password" aria-describedby="register-password-error" /><p v-if="attempted && errors.password" id="register-password-error" class="error">{{ errors.password }}</p></div>
      <div class="field"><label for="confirm-password">Confirm password</label><input id="confirm-password" ref="confirmPasswordInput" v-model="form.confirmPassword" type="password" autocomplete="new-password" maxlength="128" required :aria-invalid="attempted && !!errors.confirmPassword" aria-describedby="confirm-password-error" /><p v-if="attempted && errors.confirmPassword" id="confirm-password-error" class="error">{{ errors.confirmPassword }}</p></div>
      <p v-if="serverError" id="register-server-error" class="error" role="alert">{{ serverError }}</p>
      <button class="button primary full-width" type="submit" :disabled="submitting || googleSubmitting">{{ submitting ? 'Creating account…' : 'Create account' }}</button>
      <p class="data-note">Your account is managed securely using Firebase Authentication.</p>
    </form>
  </section>
</template>
