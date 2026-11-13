const express = require("express");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { DateTime } = require("luxon");
const {
  hashPassword,
  verifyPassword,
  issueSession,
  tokenHash,
  auth,
  rateLimit,
} = require("./security");
const { availableSlots, fail } = require("./scheduling");
const categories = [
  "Barber & grooming",
  "Beauty",
  "Home services",
  "Wellness",
  "Fitness",
  "Other",
];
const emailValid = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const text = (value, max, required = false) =>
  typeof value === "string" &&
  value.length <= max &&
  (!required || value.trim().length > 0);
const identifier = (value) =>
  /^\d+$/.test(String(value)) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;
const publicColumns =
  "id,name,slug,category,city,description,phone,timezone,booking_url,is_demo";
async function initialize(pool) {
  await pool.query(await readFile(join(__dirname, "schema.sql"), "utf8"));
  if (process.env.ENABLE_DEMO === "true")
    await require("./seed").seedDemo(pool);
}
async function transaction(pool, run) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await run(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
async function ownerBusiness(db, userId, lock = false) {
  return (
    await db.query(
      `SELECT * FROM ll_businesses WHERE owner_id=$1${lock ? " FOR UPDATE" : ""}`,
      [userId],
    )
  ).rows[0];
}
async function dashboard(db, business) {
  if (!business)
    return {
      business: null,
      services: [],
      hours: [],
      bookings: [],
      stats: { upcoming_count: 0, upcoming_value: 0, customer_count: 0 },
      week: [],
    };
  const weekEnd = DateTime.now()
    .setZone(business.timezone)
    .startOf("day")
    .plus({ days: 7 })
    .toISO();
  const [services, hours, bookings, stats, week] = await Promise.all([
    db.query(
      "SELECT * FROM ll_services WHERE business_id=$1 AND active=true ORDER BY id",
      [business.id],
    ),
    db.query("SELECT * FROM ll_hours WHERE business_id=$1 ORDER BY day", [
      business.id,
    ]),
    db.query(
      `SELECT * FROM ll_bookings WHERE business_id=$1
      ORDER BY (starts_at>=now()) DESC, CASE WHEN starts_at>=now() THEN starts_at END ASC,
      CASE WHEN starts_at<now() THEN starts_at END DESC LIMIT 250`,
      [business.id],
    ),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE status='confirmed' AND starts_at>=now())::int AS upcoming_count,
      COALESCE(SUM(price_cents) FILTER (WHERE status='confirmed' AND starts_at>=now()),0) AS upcoming_value,
      COUNT(DISTINCT customer_email)::int AS customer_count FROM ll_bookings WHERE business_id=$1`,
      [business.id],
    ),
    db.query(
      `SELECT to_char(starts_at AT TIME ZONE $2,'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM ll_bookings WHERE business_id=$1 AND status='confirmed' AND starts_at>=now() AND starts_at<$3
      GROUP BY day ORDER BY day`,
      [business.id, business.timezone, weekEnd],
    ),
  ]);
  return {
    business,
    services: services.rows,
    hours: hours.rows,
    bookings: bookings.rows,
    stats: stats.rows[0],
    week: week.rows,
  };
}
function createApp(pool) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Nginx overwrites X-Forwarded-For; backend publishes only to loopback in development.
  app.use((_req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    });
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.use((req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const allowed = new Set([
        process.env.PUBLIC_ORIGIN || "http://127.0.0.1:3000",
      ]);
      if (process.env.NODE_ENV !== "production")
        allowed.add("http://localhost:3000");
      if (
        (req.get("origin") && !allowed.has(req.get("origin"))) ||
        req.get("sec-fetch-site") === "cross-site"
      )
        fail(403, "This request came from an untrusted page.");
    }
    next();
  });
  app.get("/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  });
  app.post("/api/auth/register", async (req, res) => {
    await rateLimit(pool, `register:${req.ip}`, 30);
    const { name, email, password } = req.body || {};
    if (
      !text(name, 100, true) ||
      !emailValid(email) ||
      !text(password, 128, true) ||
      password.length < 12
    )
      fail(
        400,
        "Enter your name, a valid email, and a password with at least 12 characters.",
      );
    const user = await transaction(pool, async (db) => {
      const { rows } = await db.query(
        "INSERT INTO ll_users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email",
        [name.trim(), email.toLowerCase(), await hashPassword(password)],
      );
      await issueSession(db, rows[0].id, res);
      return rows[0];
    });
    res.status(201).json({ user });
  });
  app.post("/api/auth/login", async (req, res) => {
    await rateLimit(pool, `login-ip:${req.ip}`, 100);
    const { email, password } = req.body || {};
    if (!emailValid(email) || !text(password, 128, true))
      fail(400, "Enter your email and password.");
    await rateLimit(pool, `login-email:${email.toLowerCase()}`, 20);
    const user = (
      await pool.query("SELECT * FROM ll_users WHERE email=$1", [
        email.toLowerCase(),
      ])
    ).rows[0];
    const valid = await verifyPassword(password, user?.password_hash || "");
    if (!valid || !user) fail(401, "The email or password is incorrect.");
    await issueSession(pool, user.id, res);
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  });
  app.get("/api/auth/me", auth(pool), (req, res) =>
    res.json({ user: req.user }),
  );
  app.post("/api/auth/logout", async (req, res) => {
    const token = tokenHash(req);
    if (token)
      await pool.query("DELETE FROM ll_sessions WHERE token_hash=$1", [token]);
    res.clearCookie("ll_session", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    res.json({ ok: true });
  });
  app.get("/api/businesses", async (req, res) => {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.slice(0, 100)
        : "";
    const category =
      typeof req.query.category === "string" ? req.query.category : "";
    const { rows } = await pool.query(
      `SELECT ${publicColumns} FROM ll_businesses WHERE published=true
      AND ($1='' OR name ILIKE $2 OR city ILIKE $2 OR category ILIKE $2) AND ($3='' OR category=$3) ORDER BY is_demo DESC,name LIMIT 100`,
      [search, `%${search}%`, category],
    );
    res.json(rows);
  });
  app.get("/api/businesses/:slug", async (req, res) => {
    const business = (
      await pool.query(
        `SELECT ${publicColumns} FROM ll_businesses WHERE slug=$1 AND published=true`,
        [req.params.slug],
      )
    ).rows[0];
    if (!business) fail(404, "This business page is not available.");
    const [services, hours] = await Promise.all([
      pool.query(
        "SELECT * FROM ll_services WHERE business_id=$1 AND active=true ORDER BY id",
        [business.id],
      ),
      pool.query("SELECT * FROM ll_hours WHERE business_id=$1 ORDER BY day", [
        business.id,
      ]),
    ]);
    res.json({ business, services: services.rows, hours: hours.rows });
  });
  app.get("/api/businesses/:slug/availability", async (req, res) => {
    if (!identifier(req.query.service_id)) fail(400, "Choose a service.");
    const business = (
      await pool.query(
        "SELECT * FROM ll_businesses WHERE slug=$1 AND published=true",
        [req.params.slug],
      )
    ).rows[0];
    if (!business) fail(404, "This business page is not available.");
    if (business.booking_url)
      fail(400, "Book using this business’s existing booking page.");
    const { slots } = await availableSlots(
      pool,
      business,
      Number(req.query.service_id),
      req.query.date,
    );
    res.json({ slots, timezone: business.timezone });
  });
  app.post("/api/businesses/:slug/bookings", async (req, res) => {
    await rateLimit(pool, `booking:${req.ip}`, 40);
    const {
      service_id,
      starts_at,
      name,
      email,
      phone = "",
      notes = "",
    } = req.body || {};
    if (
      !identifier(service_id) ||
      !text(starts_at, 50, true) ||
      !text(name, 100, true) ||
      !emailValid(email) ||
      !text(phone, 40) ||
      !text(notes, 1000)
    )
      fail(
        400,
        "Enter your name, a valid email, and a selected appointment time.",
      );
    const booking = await transaction(pool, async (db) => {
      const business = (
        await db.query(
          "SELECT * FROM ll_businesses WHERE slug=$1 AND published=true FOR UPDATE",
          [req.params.slug],
        )
      ).rows[0];
      if (!business) fail(404, "This business page is not available.");
      if (business.booking_url)
        fail(400, "Please use this business’s existing booking page.");
      const start = DateTime.fromISO(starts_at, { setZone: true });
      if (!start.isValid || !/(Z|[+-]\d\d:\d\d)$/.test(starts_at))
        fail(400, "Choose a valid appointment time.");
      const { slots, service } = await availableSlots(
        db,
        business,
        Number(service_id),
        start.setZone(business.timezone).toISODate(),
      );
      const chosen = slots.find(
        (s) => DateTime.fromISO(s.start).toMillis() === start.toMillis(),
      );
      if (!chosen)
        fail(409, "That time is no longer available. Please choose another.");
      const { rows } = await db.query(
        `INSERT INTO ll_bookings(business_id,service_id,service_name,price_cents,customer_name,customer_email,customer_phone,notes,starts_at,ends_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,service_name,price_cents,starts_at,ends_at,status`,
        [
          business.id,
          service.id,
          service.name,
          service.price_cents,
          business.is_demo ? "Demo visitor" : name.trim(),
          business.is_demo ? "visitor@example.com" : email.toLowerCase(),
          business.is_demo ? "" : phone.trim(),
          business.is_demo ? "" : notes.trim(),
          chosen.start,
          chosen.end,
        ],
      );
      return {
        ...rows[0],
        business_name: business.name,
        timezone: business.timezone,
      };
    });
    res.status(201).json(booking);
  });
  app.get("/api/demo", async (_req, res) => {
    if (process.env.ENABLE_DEMO !== "true") fail(404, "Demo is disabled.");
    const business = (
      await pool.query(
        "SELECT * FROM ll_businesses WHERE is_demo=true ORDER BY id LIMIT 1",
      )
    ).rows[0];
    if (!business) fail(404, "Demo is not available.");
    const data = await dashboard(pool, business);
    // Demo customers are synthetic; never read another business to populate this view.
    res.json({ ...data, demo: true });
  });
  app.use("/api/owner", auth(pool));
  app.get("/api/owner/dashboard", async (req, res) =>
    res.json(await dashboard(pool, await ownerBusiness(pool, req.user.id))),
  );
  app.put("/api/owner/business", async (req, res) => {
    const {
      name,
      slug,
      category,
      city,
      description = "",
      phone = "",
      timezone,
      booking_url = "",
    } = req.body || {};
    if (
      !text(name, 100, true) ||
      !text(slug, 60, true) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      !categories.includes(category) ||
      !text(city, 100, true) ||
      !text(description, 1500) ||
      !text(phone, 40) ||
      !text(timezone, 100, true) ||
      !DateTime.now().setZone(timezone).isValid ||
      !text(booking_url, 2000)
    )
      fail(
        400,
        "Check the business name, page address, category, location, and time zone.",
      );
    if (booking_url) {
      let url;
      try {
        url = new URL(booking_url);
      } catch {
        fail(400, "Enter a valid booking website address.");
      }
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        fail(400, "Use an http or https booking address without credentials.");
    }
    const { rows } = await pool.query(
      `INSERT INTO ll_businesses(owner_id,name,slug,category,city,description,phone,timezone,booking_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(owner_id) DO UPDATE SET name=$2,slug=$3,category=$4,city=$5,description=$6,phone=$7,timezone=$8,booking_url=$9 RETURNING *`,
      [
        req.user.id,
        name.trim(),
        slug,
        category,
        city.trim(),
        description.trim(),
        phone.trim(),
        timezone,
        booking_url.trim(),
      ],
    );
    res.json(rows[0]);
  });
  app.post("/api/owner/services", async (req, res) => {
    const business = await ownerBusiness(pool, req.user.id);
    if (!business) fail(400, "Create your business profile first.");
    const {
      name,
      description = "",
      duration_minutes,
      price_cents,
    } = req.body || {};
    if (
      !text(name, 100, true) ||
      !text(description, 500) ||
      !Number.isInteger(duration_minutes) ||
      duration_minutes < 15 ||
      duration_minutes > 480 ||
      !Number.isInteger(price_cents) ||
      price_cents < 0 ||
      price_cents > 10000000
    )
      fail(
        400,
        "Enter a service name, duration (15–480 minutes), and a valid price.",
      );
    const { rows } = await pool.query(
      "INSERT INTO ll_services(business_id,name,description,duration_minutes,price_cents) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [
        business.id,
        name.trim(),
        description.trim(),
        duration_minutes,
        price_cents,
      ],
    );
    res.status(201).json(rows[0]);
  });
  app.delete("/api/owner/services/:id", async (req, res) => {
    if (!identifier(req.params.id)) fail(404, "Service not found.");
    const result = await pool.query(
      "UPDATE ll_services SET active=false WHERE id=$1 AND business_id IN (SELECT id FROM ll_businesses WHERE owner_id=$2) RETURNING id",
      [req.params.id, req.user.id],
    );
    if (!result.rowCount) fail(404, "Service not found.");
    res.json({ ok: true });
  });
  app.put("/api/owner/hours", async (req, res) => {
    const hours = req.body?.hours;
    const minutes = (value) =>
      typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
        ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
        : NaN;
    if (
      !Array.isArray(hours) ||
      hours.length > 7 ||
      new Set(hours.map((h) => h?.day)).size !== hours.length ||
      hours.some(
        (h) =>
          !h ||
          !Number.isInteger(h.day) ||
          h.day < 1 ||
          h.day > 7 ||
          typeof h.enabled !== "boolean" ||
          (h.enabled && !(minutes(h.open) < minutes(h.close))),
      )
    )
      fail(400, "Each open day needs a closing time after its opening time.");
    await transaction(pool, async (db) => {
      const business = await ownerBusiness(db, req.user.id, true);
      if (!business) fail(400, "Create your business profile first.");
      await db.query("DELETE FROM ll_hours WHERE business_id=$1", [
        business.id,
      ]);
      for (const h of hours.filter((h) => h.enabled))
        await db.query(
          "INSERT INTO ll_hours(business_id,day,open_minute,close_minute) VALUES($1,$2,$3,$4)",
          [business.id, h.day, minutes(h.open), minutes(h.close)],
        );
    });
    res.json({ ok: true });
  });
  app.post("/api/owner/publish", async (req, res) => {
    if (typeof req.body?.published !== "boolean")
      fail(400, "Choose whether to publish your page.");
    const business = await ownerBusiness(pool, req.user.id);
    if (!business) fail(400, "Create your business profile first.");
    if (req.body.published && !business.booking_url) {
      const services = await pool.query(
        "SELECT id FROM ll_services WHERE business_id=$1 AND active=true LIMIT 1",
        [business.id],
      );
      const hours = await pool.query(
        "SELECT day FROM ll_hours WHERE business_id=$1 LIMIT 1",
        [business.id],
      );
      if (!services.rowCount || !hours.rowCount)
        fail(400, "Add a service and your opening hours before publishing.");
    }
    await pool.query("UPDATE ll_businesses SET published=$1 WHERE id=$2", [
      req.body.published,
      business.id,
    ]);
    res.json({ published: req.body.published });
  });
  app.patch("/api/owner/bookings/:id", async (req, res) => {
    if (
      !identifier(req.params.id) ||
      !["cancelled", "completed"].includes(req.body?.status)
    )
      fail(400, "Choose a valid booking status.");
    const { rows } = await pool.query(
      `UPDATE ll_bookings SET status=$1 WHERE id=$2 AND business_id IN (SELECT id FROM ll_businesses WHERE owner_id=$3) AND status='confirmed' RETURNING *`,
      [req.body.status, req.params.id, req.user.id],
    );
    if (!rows[0]) fail(404, "Booking not found or already updated.");
    res.json(rows[0]);
  });
  app.use((_req, res) =>
    res.status(404).json({ error: "This page could not be found." }),
  );
  app.use((error, _req, res, _next) => {
    if (error.code === "23505")
      return res.status(409).json({
        error: "That email or business page address is already in use.",
      });
    const status = [400, 401, 403, 404, 409, 413, 429].includes(error.status)
      ? error.status
      : 500;
    res.status(status).json({
      error:
        status === 500
          ? "Something went wrong. Please try again."
          : status === 413
            ? "The request is too large."
            : error.type === "entity.parse.failed"
              ? "The request is not valid JSON."
              : error.message,
    });
  });
  return app;
}
module.exports = { createApp, initialize };
