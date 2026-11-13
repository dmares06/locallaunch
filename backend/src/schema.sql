CREATE TABLE IF NOT EXISTS ll_users (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ll_sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES ll_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS ll_businesses (
  id SERIAL PRIMARY KEY, owner_id INTEGER NOT NULL UNIQUE REFERENCES ll_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, category TEXT NOT NULL, city TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', timezone TEXT NOT NULL,
  booking_url TEXT NOT NULL DEFAULT '', published BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ll_services (
  id SERIAL PRIMARY KEY, business_id INTEGER NOT NULL REFERENCES ll_businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 15 AND 480),
  price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 0 AND 10000000), active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS ll_hours (
  business_id INTEGER NOT NULL REFERENCES ll_businesses(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 7), open_minute INTEGER NOT NULL, close_minute INTEGER NOT NULL,
  PRIMARY KEY(business_id,day), CHECK(open_minute >= 0 AND close_minute <= 1440 AND open_minute < close_minute)
);
CREATE TABLE IF NOT EXISTS ll_bookings (
  id SERIAL PRIMARY KEY, business_id INTEGER NOT NULL REFERENCES ll_businesses(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES ll_services(id), service_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS ll_booking_business_time ON ll_bookings(business_id,starts_at);
CREATE TABLE IF NOT EXISTS ll_rate_limits (key TEXT PRIMARY KEY, bucket BIGINT NOT NULL, attempts INTEGER NOT NULL);
