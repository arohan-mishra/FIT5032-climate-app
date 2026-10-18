const STORAGE_KEY_PREFIX = 'pedal-melbourne-event-bookings'
const DEFAULT_DURATION_MINUTES = 90

function storageKey(userId) {
  return `${STORAGE_KEY_PREFIX}:${userId}`
}

export function getEventDateRange(event) {
  const dateParts = String(event.eventDate || '').split('-').map(Number)
  const timeParts = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(event.time || ''))

  if (dateParts.length !== 3 || dateParts.some(Number.isNaN) || !timeParts) return null

  const [year, month, day] = dateParts
  const [, hourText, minuteText, periodText] = timeParts
  const period = periodText.toLowerCase()
  const hour = Number(hourText) % 12 + (period === 'pm' ? 12 : 0)
  const minute = Number(minuteText)
  const start = new Date(year, month - 1, day, hour, minute)
  const duration = Number.isInteger(event.durationMinutes)
    ? event.durationMinutes
    : DEFAULT_DURATION_MINUTES
  const end = new Date(start.getTime() + duration * 60 * 1000)

  return Number.isNaN(start.getTime()) ? null : { start, end }
}

export function loadEventBookings(userId) {
  if (!userId) return []

  try {
    const savedBookings = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]')
    if (!Array.isArray(savedBookings)) return []

    return savedBookings.filter((booking) => (
      typeof booking.eventId === 'string'
      && typeof booking.title === 'string'
      && !Number.isNaN(Date.parse(booking.start))
      && !Number.isNaN(Date.parse(booking.end))
    ))
  } catch (error) {
    console.error('Unable to load event bookings:', error)
    return []
  }
}

export function createEventBooking(event, currentBookings, userId) {
  if (!userId) return { success: false, message: 'Log in before registering for an event.' }

  const range = getEventDateRange(event)
  if (!range) return { success: false, message: 'This event has an invalid date or time.' }

  const eventId = String(event.id)
  if (currentBookings.some((booking) => booking.eventId === eventId)) {
    return { success: false, message: 'You have already registered for this event.' }
  }

  const conflictingBooking = currentBookings.find((booking) => (
    range.start < new Date(booking.end) && range.end > new Date(booking.start)
  ))

  if (conflictingBooking) {
    return {
      success: false,
      message: `This event overlaps with your booking for ${conflictingBooking.title}.`,
    }
  }

  const booking = {
    eventId,
    title: String(event.title),
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  }
  const updatedBookings = [...currentBookings, booking]

  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(updatedBookings))
    return { success: true, booking, bookings: updatedBookings }
  } catch (error) {
    console.error('Unable to save event booking:', error)
    return { success: false, message: 'The booking could not be saved on this device.' }
  }
}

export function deleteEventBooking(eventId, currentBookings, userId) {
  if (!userId) return currentBookings

  const updatedBookings = currentBookings.filter((booking) => booking.eventId !== String(eventId))

  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(updatedBookings))
    return updatedBookings
  } catch (error) {
    console.error('Unable to remove event booking:', error)
    return currentBookings
  }
}
