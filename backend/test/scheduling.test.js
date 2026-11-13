const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const { availableSlots } = require("../src/scheduling");
const business = { id: 1, timezone: "America/New_York" };
function database({
  open = 540,
  close = 720,
  bookings = [],
  closed = false,
} = {}) {
  return {
    query: async (sql) => ({
      rows: sql.includes("ll_services")
        ? [{ id: 1, duration_minutes: 60 }]
        : sql.includes("ll_hours")
          ? closed
            ? []
            : [{ open_minute: open, close_minute: close }]
          : bookings,
    }),
  };
}
test("opening hours keep local wall time when the UTC offset changes", async () => {
  for (const [date, now, expected] of [
    ["2027-01-18", "2027-01-17T12:00:00Z", "2027-01-18T14:00:00.000Z"],
    ["2027-07-19", "2027-07-18T12:00:00Z", "2027-07-19T13:00:00.000Z"],
  ]) {
    const result = await availableSlots(
      database(),
      business,
      1,
      date,
      DateTime.fromISO(now),
    );
    assert.equal(result.slots[0].start, expected);
  }
});
test("nonexistent daylight-saving wall times are never offered", async () => {
  const result = await availableSlots(
    database({ open: 60, close: 240 }),
    business,
    1,
    "2027-03-14",
    DateTime.fromISO("2027-03-13T12:00:00Z"),
  );
  assert.ok(result.slots.length > 0);
  for (const slot of result.slots) {
    const start = DateTime.fromISO(slot.start).setZone(business.timezone);
    const end = DateTime.fromISO(slot.end).setZone(business.timezone);
    assert.notEqual(start.hour, 2);
    assert.ok(end.hour <= 4);
    assert.equal(end.diff(start, "minutes").minutes, 60);
  }
});
test("overlap blocks a time, adjacent appointments stay available, closed days stay closed", async () => {
  const now = DateTime.fromISO("2027-01-17T12:00:00Z");
  const db = database({
    bookings: [
      { starts_at: "2027-01-18T14:00:00Z", ends_at: "2027-01-18T15:00:00Z" },
    ],
  });
  const result = await availableSlots(db, business, 1, "2027-01-18", now);
  assert.equal(result.slots[0].start, "2027-01-18T15:00:00.000Z");
  assert.deepEqual(
    (
      await availableSlots(
        database({ closed: true }),
        business,
        1,
        "2027-01-18",
        now,
      )
    ).slots,
    [],
  );
  await assert.rejects(availableSlots(db, business, 1, "2027-02-30", now), {
    status: 400,
  });
  await assert.rejects(availableSlots(db, business, 1, "2027-01-01", now), {
    status: 400,
  });
  await assert.rejects(availableSlots(db, business, 1, "2028-01-01", now), {
    status: 400,
  });
});
