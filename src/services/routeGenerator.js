import { auth } from '../firebase/init'

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported by this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location permission was denied. Enable it and try again.'))
          return
        }

        reject(new Error('Your location could not be found. Please try again.'))
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}

export async function generateCyclingRoute(distance) {
  if (!auth?.currentUser) {
    throw new Error('Log in before generating a route.')
  }

  const location = await getCurrentLocation()
  const idToken = await auth.currentUser.getIdToken()
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/getCyclingRoute`
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...location, distance }),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'The route could not be generated.')
  }

  return { route: data, location }
}
