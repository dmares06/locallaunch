const { DateTime } = require("luxon");
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
async function availableSlots(
  db,
  business,
  serviceId,
  date,
  now = DateTime.now(),
) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    fail(400, "Choose a valid date.");
  const day = DateTime.fromISO(date, { zone: business.timezone });
  const today = now.setZone(business.timezone).startOf("day");
  if (!day.isValid || day < today || day > today.plus({ days: 90 }))
    fail(400, "Choose a date within the next 90 days.");
  const service = (
    await db.query(
      "SELECT * FROM ll_services WHERE id=$1 AND business_id=$2 AND active=true",
      [serviceId, business.id],
    )
  ).rows[0];
  if (!service) fail(404, "This service is no longer available.");
  const hours = (
    await db.query("SELECT * FROM ll_hours WHERE business_id=$1 AND day=$2", [
      business.id,
      day.weekday,
    ])
  ).rows[0];
  if (!hours) return { slots: [], service };
  const bookings = (
    await db.query(
      "SELECT starts_at,ends_at FROM ll_bookings WHERE business_id=$1 AND status IN ('confirmed','completed') AND starts_at<$3 AND ends_at>$2",
      [business.id, day.toISO(), day.plus({ days: 1 }).toISO()],
    )
  ).rows;
  const slots = [];
  // Construct wall-clock times so DST transitions do not shift the business's opening hours.
  for (
    let minute = hours.open_minute;
    minute + service.duration_minutes <= hours.close_minute;
    minute += 15
  ) {
    const start = day.set({
      hour: Math.floor(minute / 60),
      minute: minute % 60,
    });
    const end = start.plus({ minutes: service.duration_minutes });
    const close = day.set({
      hour: Math.floor(hours.close_minute / 60) % 24,
      minute: hours.close_minute % 60,
    });
    if (start.hour !== Math.floor(minute / 60) || start <= now || end > close)
      continue;
    if (
      !bookings.some(
        (b) =>
          start.toMillis() < new Date(b.ends_at).getTime() &&
          end.toMillis() > new Date(b.starts_at).getTime(),
      )
    ) {
      slots.push({ start: start.toUTC().toISO(), end: end.toUTC().toISO() });
    }
  }
  return { slots, service };
}
module.exports = { availableSlots, fail };
