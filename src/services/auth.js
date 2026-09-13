import { readonly, ref } from 'vue'

const USERS_KEY = 'pedal-melbourne-users'
const SESSION_KEY = 'pedal-melbourne-session'
const DEMO_ADMIN_EMAIL = 'admin@pedalmelbourne.test'
const DEMO_ADMIN_PASSWORD = 'Admin123!'
const DEMO_USER_EMAIL = 'user@pedalmelbourne.test'
const DEMO_USER_PASSWORD = 'User123!'

function readStoredValue(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key))
    return value ?? fallback
  } catch {
    return fallback
  }
}

function isValidUser(user) {
  return user
    && typeof user.id === 'string'
    && typeof user.name === 'string'
    && user.name.length <= 80
    && typeof user.email === 'string'
    && user.email.length <= 120
    && ['user', 'admin'].includes(user.role)
    && typeof user.salt === 'string'
    && /^[0-9a-f]{32}$/.test(user.salt)
    && typeof user.passwordHash === 'string'
    && /^[0-9a-f]{64}$/.test(user.passwordHash)
}

function readUsers() {
  const users = readStoredValue(localStorage, USERS_KEY, [])
  return Array.isArray(users) ? users.filter(isValidUser) : []
}

function createSessionUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

function readSession() {
  const session = readStoredValue(sessionStorage, SESSION_KEY, null)
  if (!session || typeof session.id !== 'string') return null

  const matchingUser = readUsers().find((user) => user.id === session.id)
  if (!matchingUser) {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
  return createSessionUser(matchingUser)
}

const currentUser = ref(readSession())

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function isSafeName(name) {
  return !name.includes('<')
    && !name.includes('>')
    && !Array.from(name).some((character) => character.charCodeAt(0) < 32)
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(hash))
}

export async function registerUser({ name, email, password }) {
  const users = readUsers()
  const normalisedName = name.trim()
  const normalisedEmail = email.trim().toLowerCase()

  if (
    normalisedName.length < 2
    || normalisedName.length > 80
    || !isSafeName(normalisedName)
    || normalisedEmail.length > 120
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)
    || password.length < 8
    || password.length > 128
  ) {
    return { success: false, message: 'The account details are invalid.' }
  }

  if (users.some((user) => user.email === normalisedEmail)) {
    return { success: false, message: 'An account with this email already exists.' }
  }

  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
  const user = {
    id: crypto.randomUUID(),
    name: normalisedName,
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
  const users = readUsers()
  const normalisedEmail = email.trim().toLowerCase()
  const user = users.find((item) => item.email === normalisedEmail)

  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
    return { success: false, message: 'Email or password is incorrect.' }
  }

  const sessionUser = createSessionUser(user)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
  currentUser.value = sessionUser
  return { success: true }
}

export function logoutUser() {
  sessionStorage.removeItem(SESSION_KEY)
  currentUser.value = null
}

export async function ensureDemoAccounts() {
  const users = readUsers()
  const demos = [
    { name: 'Demo Admin', email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD, role: 'admin' },
    { name: 'Demo User', email: DEMO_USER_EMAIL, password: DEMO_USER_PASSWORD, role: 'user' },
  ]

  for (const demo of demos) {
    if (users.some((user) => user.email === demo.email)) continue
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
    users.push({
      id: crypto.randomUUID(),
      name: demo.name,
      email: demo.email,
      role: demo.role,
      salt,
      passwordHash: await hashPassword(demo.password, salt),
    })
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getAccountSummary() {
  const users = readUsers()
  return {
    total: users.length,
    users: users.filter((user) => user.role === 'user').length,
    admins: users.filter((user) => user.role === 'admin').length,
  }
}

export function useAuth() {
  return { currentUser: readonly(currentUser), loginUser, logoutUser, registerUser }
}
