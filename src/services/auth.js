import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { readonly, ref } from 'vue'
import { auth, db, isFirebaseConfigured } from '../firebase/init'

const currentUser = ref(null)

async function loadFirebaseUser(firebaseUser) {
  const profileSnapshot = await getDoc(doc(db, 'users', firebaseUser.uid))
  if (!profileSnapshot.exists()) throw new Error('The account profile is missing.')

  const profile = profileSnapshot.data()
  currentUser.value = {
    id: firebaseUser.uid,
    name: profile.name,
    email: firebaseUser.email,
    role: profile.role === 'admin' ? 'admin' : 'user',
  }
}

let authReadyResolved = false
let resolveAuthReady
export const authReady = new Promise((resolve) => { resolveAuthReady = resolve })

if (auth) {
  onAuthStateChanged(auth, async (firebaseUser) => {
    try {
      if (firebaseUser) await loadFirebaseUser(firebaseUser)
      else currentUser.value = null
    } catch (error) {
      console.error('Unable to restore the Firebase session:', error)
      currentUser.value = null
    } finally {
      if (!authReadyResolved) {
        authReadyResolved = true
        resolveAuthReady()
      }
    }
  })
} else {
  authReadyResolved = true
  resolveAuthReady()
}

export function isSafeName(name) {
  return !name.includes('<')
    && !name.includes('>')
    && !Array.from(name).some((character) => character.charCodeAt(0) < 32)
}

export async function registerUser({ name, email, password }) {
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

  if (!isFirebaseConfigured || !auth || !db) {
    return { success: false, message: 'Account registration is currently unavailable.' }
  }

  let credential

  try {
    credential = await createUserWithEmailAndPassword(auth, normalisedEmail, password)
    await setDoc(doc(db, 'users', credential.user.uid), {
      name: normalisedName,
      email: normalisedEmail,
      role: 'user',
      createdAt: serverTimestamp(),
    })
    await signOut(auth)
    return { success: true }
  } catch (error) {
    if (credential?.user) {
      try {
        await deleteUser(credential.user)
      } catch (rollbackError) {
        console.error('Unable to roll back Firebase account:', rollbackError)
      }
    }

    if (error.code === 'auth/email-already-in-use') {
      return { success: false, message: 'An account with this email already exists.' }
    }
    if (error.code === 'auth/weak-password') {
      return { success: false, message: 'The password does not meet the security requirements.' }
    }

    console.error('Firebase registration failed:', error)
    return { success: false, message: 'The account could not be created. Please try again.' }
  }
}

export async function loginUser(email, password) {
  const normalisedEmail = email.trim().toLowerCase()

  if (!isFirebaseConfigured || !auth || !db) {
    return { success: false, message: 'Login is currently unavailable.' }
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, normalisedEmail, password)
    await loadFirebaseUser(credential.user)
    return { success: true }
  } catch (error) {
    if (auth.currentUser) await signOut(auth)

    if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(error.code)) {
      return { success: false, message: 'Email or password is incorrect.' }
    }
    if (error.code === 'auth/too-many-requests') {
      return { success: false, message: 'Too many attempts. Please wait and try again.' }
    }

    console.error('Firebase login failed:', error)
    return { success: false, message: 'Login failed. Please try again.' }
  }
}

export async function logoutUser() {
  if (auth) await signOut(auth)
  currentUser.value = null
}

export function useAuth() {
  return { currentUser: readonly(currentUser), loginUser, logoutUser, registerUser }
}
