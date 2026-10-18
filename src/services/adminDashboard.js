import { auth } from '../firebase/init'

function isCount(value) {
  return Number.isInteger(value) && value >= 0
}

function validateDashboardData(data) {
  const average = data?.ratings?.average

  if (
    !isCount(data?.users?.total)
    || !isCount(data?.users?.regular)
    || !isCount(data?.users?.administrators)
    || !isCount(data?.content?.events)
    || !isCount(data?.content?.cyclingSegments)
    || !isCount(data?.ratings?.total)
    || !isCount(data?.ratings?.ratedSegments)
    || !(average === null || (typeof average === 'number' && average >= 1 && average <= 5))
  ) {
    throw new Error('The dashboard service returned invalid data.')
  }

  return data
}

export async function fetchAdminDashboard() {
  if (!auth?.currentUser) {
    throw new Error('Log in with an administrator account to view the dashboard.')
  }

  const idToken = await auth.currentUser.getIdToken()
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/getAdminDashboard`
  const response = await fetch(functionUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  let data = {}

  try {
    data = await response.json()
  } catch {
    if (!response.ok) {
      throw new Error(`The dashboard service returned an error (${response.status}).`)
    }
  }

  if (!response.ok) {
    throw new Error(data.message || 'Dashboard statistics could not be loaded.')
  }

  return validateDashboardData(data)
}
