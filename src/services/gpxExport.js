function createTrackPoint(coordinate) {
  const [longitude, latitude, elevation] = coordinate

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return ''

  const elevationElement = Number.isFinite(elevation) ? `<ele>${elevation}</ele>` : ''
  return `<trkpt lat="${latitude}" lon="${longitude}">${elevationElement}</trkpt>`
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

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pedal Melbourne" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${routeName}</name></metadata>
  <trk><name>${routeName}</name>${trackSegments}</trk>
</gpx>`
}

export function downloadRouteAsGpx(route, routeNumber) {
  const routeName = `Pedal Melbourne Route ${routeNumber}`
  const gpx = createGpx(route, routeName)
  const file = new Blob([gpx], { type: 'application/gpx+xml' })
  const downloadUrl = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = downloadUrl
  link.download = `pedal-melbourne-route-${routeNumber}.gpx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(downloadUrl)
}
