import { readonly, ref } from 'vue'

const USERS_KEY = 'pedal-melbourne-users'
const SESSION_KEY = 'pedal-melbourne-session'

function readStoredValue(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value ?? fallback
  } catch {
    return fallback
  }
}

const currentUser = ref(readStoredValue(SESSION_KEY, null))

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(hash))
}

export async function registerUser({ name, email, password }) {
  const users = readStoredValue(USERS_KEY, [])
  const normalisedEmail = email.trim().toLowerCase()

  if (users.some((user) => user.email === normalisedEmail)) {
    return { success: false, message: 'An account with this email already exists.' }
  }

  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalisedEmail,
    role: 'user',
    salt,
    passwordHash: await hashPassword(password, salt),
  }

  users.push(user)
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  return { success: true }
}

export async function loginUser(email, password) {
  const users = readStoredValue(USERS_KEY, [])
  const normalisedEmail = email.trim().toLowerCase()
  const user = users.find((item) => item.email === normalisedEmail)

  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
    return { success: false, message: 'Email or password is incorrect.' }
  }

  const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
  currentUser.value = sessionUser
  return { success: true }
}

export function logoutUser() {
  sessionStorage.removeItem(SESSION_KEY)
  currentUser.value = null
}

export function useAuth() {
  return { currentUser: readonly(currentUser), loginUser, logoutUser, registerUser }
}
