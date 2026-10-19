function createTrackPoint(coordinate) {
  const [longitude, latitude, elevation] = coordinate

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return ''

  const elevationElement = Number.isFinite(elevation) ? `<ele>${elevation}</ele>` : ''
  return `<trkpt lat="${latitude}" lon="${longitude}">${elevationElement}</trkpt>`
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function createGpx(route, routeName) {
  const geometry = route?.features?.[0]?.geometry

  if (!geometry || !['LineString', 'MultiLineString'].includes(geometry.type)) {
    throw new Error('This route does not contain coordinates that can be exported.')
  }

  const lines = geometry.type === 'LineString'
    ? [geometry.coordinates]
    : geometry.coordinates
  const trackSegments = lines
    .map((line) => `<trkseg>${line.map(createTrackPoint).join('')}</trkseg>`)
    .join('')

  if (!trackSegments.includes('<trkpt')) {
    throw new Error('This route does not contain valid coordinates.')
  }

  const safeRouteName = escapeXml(routeName)

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pedal Melbourne" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${safeRouteName}</name></metadata>
  <trk><name>${safeRouteName}</name>${trackSegments}</trk>
</gpx>`
}

function downloadGpx(route, routeName, filename) {
  const gpx = createGpx(route, routeName)
  const file = new Blob([gpx], { type: 'application/gpx+xml' })
  const downloadUrl = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = downloadUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(downloadUrl)
}

export function downloadRouteAsGpx(route, routeNumber) {
  downloadGpx(
    route,
    `Pedal Melbourne Route ${routeNumber}`,
    `pedal-melbourne-route-${routeNumber}.gpx`,
  )
}

export function downloadEventRideAsGpx(route, eventTitle) {
  const safeFilename = String(eventTitle || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'event'

  downloadGpx(
    route,
    `Ride to ${eventTitle || 'event'}`,
    `ride-to-${safeFilename}.gpx`,
  )
}
