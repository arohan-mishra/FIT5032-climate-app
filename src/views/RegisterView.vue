<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isSafeName, registerUser } from '../services/auth'

const router = useRouter()
const attempted = ref(false)
const serverError = ref('')
const submitting = ref(false)
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
  if (Object.values(errors.value).some(Boolean)) return

  submitting.value = true
  const result = await registerUser(form)
  submitting.value = false

  if (!result.success) {
    serverError.value = result.message
    return
  }

  router.push({ name: 'login', query: { registered: 'true' } })
}
</script>

<template>
  <section class="page-banner"><div class="container"><h1>Register</h1><p>Create a demonstration Pedal Melbourne account.</p></div></section>
  <section class="section container">
    <form class="form-panel auth-form" novalidate @submit.prevent="submitRegistration">
      <div class="field"><label for="register-name">Name</label><input id="register-name" v-model="form.name" type="text" autocomplete="name" maxlength="80" :aria-invalid="attempted && !!errors.name" /><p v-if="attempted && errors.name" class="error">{{ errors.name }}</p></div>
      <div class="field"><label for="register-email">Email</label><input id="register-email" v-model="form.email" type="email" autocomplete="email" maxlength="120" :aria-invalid="attempted && !!errors.email" /><p v-if="attempted && errors.email" class="error">{{ errors.email }}</p></div>
      <div class="field"><label for="register-password">Password</label><input id="register-password" v-model="form.password" type="password" autocomplete="new-password" maxlength="128" :aria-invalid="attempted && !!errors.password" /><p v-if="attempted && errors.password" class="error">{{ errors.password }}</p></div>
      <div class="field"><label for="confirm-password">Confirm password</label><input id="confirm-password" v-model="form.confirmPassword" type="password" autocomplete="new-password" maxlength="128" :aria-invalid="attempted && !!errors.confirmPassword" /><p v-if="attempted && errors.confirmPassword" class="error">{{ errors.confirmPassword }}</p></div>
      <p v-if="serverError" class="error" role="alert">{{ serverError }}</p>
      <button class="button primary full-width" type="submit" :disabled="submitting">{{ submitting ? 'Creating account…' : 'Create account' }}</button>
      <p class="data-note">This is a client-side demonstration account stored in this browser.</p>
    </form>
  </section>
</template>
