const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const { start } = require("../src/index");
const { DateTime } = require("luxon");

test("owners can publish a business and manage private, conflict-free bookings", async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const server = await start({ pool, port: 0, host: "127.0.0.1" });
  const base = `http://127.0.0.1:${server.address().port}`;
  const owners = [];
  t.after(async () => {
    for (const id of owners)
      await pool.query("DELETE FROM ll_users WHERE id=$1", [id]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });
  async function request(path, { method = "GET", body, cookie, origin } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const register = async (label) => {
    const credentials = {
      name: label,
      email: `${crypto.randomUUID()}@example.com`,
      password: "Strong-password-123!",
    };
    const result = await request("/api/auth/register", {
      method: "POST",
      body: credentials,
    });
    assert.equal(result.status, 201);
    owners.push(result.data.user.id);
    return { ...result, credentials };
  };
  assert.equal((await request("/health")).status, 200);
  assert.equal((await request("/api/owner/dashboard")).status, 401);
  assert.equal((await request("/api/bookings")).status, 404);
  assert.equal(
    (
      await request("/api/auth/register", {
        method: "POST",
        body: { name: "X", email: "bad", password: "short" },
      })
    ).status,
    400,
  );
  const a = await register("First owner");
  const b = await register("Second owner");
  assert.equal(
    (await request("/api/auth/me", { cookie: a.cookie })).data.user.name,
    "First owner",
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { email: a.credentials.email, password: "incorrect-password" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth/register", {
        method: "POST",
        body: a.credentials,
      })
    ).status,
    409,
  );
  assert.equal(
    (await request("/api/owner/dashboard", { cookie: "ll_session=forged" }))
      .status,
    401,
  );
  assert.equal(
    (
      await request("/api/owner/business", {
        method: "PUT",
        cookie: a.cookie,
        origin: "https://attacker.example",
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/owner/dashboard", { cookie: a.cookie })).data.business,
    null,
  );
  const slug = `test-${crypto.randomUUID()}`;
  const profile = {
    name: "Test Local Studio",
    slug,
    category: "Beauty",
    city: "Boston, MA",
    description: "A friendly neighborhood studio.",
    timezone: "America/New_York",
    phone: "555-0100",
    booking_url: "",
  };
  assert.equal(
    (
      await request("/api/owner/business", {
        method: "PUT",
        cookie: a.cookie,
        body: { ...profile, timezone: "Invalid/Zone" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/owner/business", {
        method: "PUT",
        cookie: a.cookie,
        body: { ...profile, booking_url: "javascript:alert(1)" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/owner/business", {
        method: "PUT",
        cookie: a.cookie,
        body: profile,
      })
    ).status,
    200,
  );
  assert.equal((await request(`/api/businesses/${slug}`)).status, 404);
  assert.equal(
    (
      await request("/api/owner/publish", {
        method: "POST",
        cookie: a.cookie,
        body: { published: true },
      })
    ).status,
    400,
  );
  const created = await request("/api/owner/services", {
    method: "POST",
    cookie: a.cookie,
    body: {
      name: "Studio appointment",
      description: "A great appointment",
      duration_minutes: 60,
      price_cents: 4500,
    },
  });
  assert.equal(created.status, 201);
  const service = created.data;
  assert.equal(
    (
      await request("/api/owner/services", {
        method: "POST",
        cookie: a.cookie,
        body: { name: "Invalid", duration_minutes: -1, price_cents: 0 },
      })
    ).status,
    400,
  );
  const hours = Array.from({ length: 7 }, (_, day) => ({
    day: day + 1,
    open: "09:00",
    close: "17:00",
    enabled: true,
  }));
  assert.equal(
    (
      await request("/api/owner/hours", {
        method: "PUT",
        cookie: a.cookie,
        body: {
          hours: [{ day: 1, open: "17:00", close: "09:00", enabled: true }],
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/owner/hours", {
        method: "PUT",
        cookie: a.cookie,
        body: { hours },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/owner/publish", {
        method: "POST",
        cookie: a.cookie,
        body: { published: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/api/businesses/${slug}`)).data.services[0].id,
    service.id,
  );
  assert.ok(
    (await request("/api/businesses")).data.some((row) => row.slug === slug),
  );
  const date = DateTime.now()
    .setZone(profile.timezone)
    .plus({ days: 2 })
    .toISODate();
  const availability = await request(
    `/api/businesses/${slug}/availability?service_id=${service.id}&date=${date}`,
  );
  assert.equal(availability.status, 200);
  assert.ok(availability.data.slots.length > 0);
  assert.equal(
    (
      await request(
        `/api/businesses/${slug}/availability?service_id=${service.id}&date=bad`,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/api/businesses/${slug}/availability?service_id=9999999&date=${date}`,
      )
    ).status,
    404,
  );
  const payload = {
    service_id: service.id,
    starts_at: availability.data.slots[0].start,
    name: "Sample Customer",
    email: "sample@example.com",
    phone: "555-0199",
    notes: "First visit",
  };
  assert.equal(
    (
      await request(`/api/businesses/${slug}/bookings`, {
        method: "POST",
        body: { ...payload, email: "bad" },
      })
    ).status,
    400,
  );
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      request(`/api/businesses/${slug}/bookings`, {
        method: "POST",
        body: payload,
      }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
  const booking = concurrent.find((r) => r.status === 201).data;
  const dashboard = await request("/api/owner/dashboard", { cookie: a.cookie });
  assert.equal(dashboard.data.stats.upcoming_count, 1);
  assert.equal(Number(dashboard.data.stats.upcoming_value), 4500);
  assert.equal(
    dashboard.data.week.reduce((sum, day) => sum + Number(day.count), 0),
    1,
  );
  assert.ok(
    dashboard.data.bookings.some(
      (row) =>
        row.id === booking.id && row.customer_email === "sample@example.com",
    ),
  );
  assert.equal(
    (await request("/api/owner/dashboard", { cookie: b.cookie })).data.bookings
      .length,
    0,
  );
  assert.equal(
    (
      await request(`/api/owner/bookings/${booking.id}`, {
        method: "PATCH",
        cookie: b.cookie,
        body: { status: "cancelled" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/owner/services/${service.id}`, {
        method: "DELETE",
        cookie: b.cookie,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/owner/bookings/${booking.id}`, {
        method: "PATCH",
        cookie: a.cookie,
        body: { status: "cancelled" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/businesses/${slug}/bookings`, {
        method: "POST",
        body: payload,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request(`/api/owner/services/${service.id}`, {
        method: "DELETE",
        cookie: a.cookie,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/owner/publish", {
        method: "POST",
        cookie: a.cookie,
        body: { published: false },
      })
    ).status,
    200,
  );
  assert.equal((await request(`/api/businesses/${slug}`)).status, 404);
  assert.equal(
    (await request("/api/auth/logout", { method: "POST", cookie: a.cookie }))
      .status,
    200,
  );
  assert.equal(
    (await request("/api/auth/me", { cookie: a.cookie })).status,
    401,
  );
  const login = await request("/api/auth/login", {
    method: "POST",
    body: a.credentials,
  });
  assert.equal(login.status, 200);
});

test("the demo is explicit synthetic data and database errors stay private", async (t) => {
  const { createApp } = require("../src/app");
  const app = createApp({
    query: async () => {
      throw new Error("private SQL detail");
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/health`,
  );
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "Something went wrong. Please try again.",
  });
});

test("demo bookings discard submitted contact details before they can enter the public demo", async (t) => {
  const previous = process.env.ENABLE_DEMO;
  process.env.ENABLE_DEMO = "true";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const server = await start({ pool, port: 0, host: "127.0.0.1" });
  let bookingId;
  t.after(async () => {
    if (bookingId)
      await pool.query("DELETE FROM ll_bookings WHERE id=$1", [bookingId]);
    if (previous === undefined) delete process.env.ENABLE_DEMO;
    else process.env.ENABLE_DEMO = previous;
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const demo = await (await fetch(base + "/api/demo")).json();
  assert.equal(demo.demo, true);
  assert.equal(demo.business.is_demo, true);
  const publicPage = await (
    await fetch(base + "/api/businesses/" + demo.business.slug)
  ).json();
  assert.equal("bookings" in publicPage, false);
  assert.equal("owner_id" in publicPage.business, false);
  let date = DateTime.now().setZone(demo.business.timezone).plus({ days: 3 });
  if (date.weekday === 7) date = date.plus({ days: 1 });
  const service = demo.services[0];
  const available = await (
    await fetch(
      `${base}/api/businesses/${demo.business.slug}/availability?service_id=${service.id}&date=${date.toISODate()}`,
    )
  ).json();
  const response = await fetch(
    `${base}/api/businesses/${demo.business.slug}/bookings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: service.id,
        starts_at: available.slots[0].start,
        name: "Do not retain me",
        email: "do-not-retain@example.com",
        phone: "555-1234",
        notes: "Private test note",
      }),
    },
  );
  assert.equal(response.status, 201);
  bookingId = (await response.json()).id;
  const publicDemo = await (await fetch(base + "/api/demo")).json();
  const serialized = JSON.stringify(publicDemo);
  assert.ok(
    !serialized.includes("do-not-retain") &&
      !serialized.includes("Do not retain me") &&
      !serialized.includes("Private test note"),
  );
  const saved = publicDemo.bookings.find((b) => b.id === bookingId);
  assert.equal(saved.customer_name, "Demo visitor");
  assert.equal(saved.customer_email, "visitor@example.com");
  assert.equal(saved.customer_phone, "");
});
