# LocalLaunch

A working local product for independent service businesses: owner accounts, a business page and neighborhood directory, services, weekly availability, customer bookings, and a private owner dashboard.

## Start

Requires Docker with Compose v2.

```sh
docker compose up --build -d
```

- Homepage: http://127.0.0.1:3000
- Sample owner workspace: http://127.0.0.1:3000/demo
- Sample customer booking page: http://127.0.0.1:3000/b/the-sunday-standard

Choose **Get started** to create your own account. Add your business details, a service, and opening hours; publish from Overview or Business page. A published page appears in the directory and can accept bookings. Customers pay the displayed price at the appointment; the app does not collect payments.

Businesses with an existing booking website can add its URL instead of using the built-in scheduler.

The sample workspace is explicitly labeled and uses synthetic customers. Bookings made on the sample business discard submitted personal contact details and retain only a synthetic visitor identity. Other businesses' bookings are private to their signed-in owners.

## Verify

```sh
# Real PostgreSQL integration tests, security regressions, and deterministic time-zone tests.
docker compose --profile test run --build --rm test-runner

# Frontend/proxy smoke checks; requires Node.js 24 or later.
./tests/run_booking_test.sh
```

Tests cover registration/login/logout, session revocation, private owner data, cross-owner access, publishing requirements, input validation, concurrent bookings, cancellation, time-zone offsets, daylight-saving changes, and demo privacy. Backend tests enforce at least 80% line coverage.

The GitHub workflow also runs real Chromium browser tests for owner onboarding, publishing, customer bookings, booking management, stale availability, and responsive layouts.

To run those browser tests yourself against the local stack:

```sh
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

Browser verification steps are recorded in `tests/browser-checklist.md`.

## Local configuration

Compose uses a local PostgreSQL development credential and binds the frontend/API to loopback. PostgreSQL is not published to the host. `PUBLIC_ORIGIN` defaults to `http://127.0.0.1:3000`; configure the exact browser origin when changing the frontend address. Only development also accepts `http://localhost:3000`.

`ENABLE_DEMO=true` seeds the example business when the backend starts. Disable it and restart the backend to disable the public demo dashboard. The old starter tables are retained without exposing the old unscoped booking endpoints.

Data persists in the Compose volume. `docker compose down` stops the stack. Only use `docker compose down --volumes` when you deliberately want to erase all local data.

## Current scope and release work

This is a local product preview, not a hosted production release. Before taking real customer data or charging businesses:

- Provision billing and verified webhook fulfillment; paid placements and subscriptions are not implemented.
- Add email verification, account recovery, and customer notifications.
- Configure HTTPS, production origins, Secure cookies, a production database role, migrations, backups, retention/deletion controls, and monitoring.
- Complete a production authorization review. Current tests verify API-level owner isolation; PostgreSQL RLS and a least-privilege production database role are not configured by this development Compose file.
- Add business time-off/holiday exceptions, booking cancellation by customers, and retention-aware pagination beyond the current 250-booking owner view.
- Configure business-owned photos, custom domains, and production hosting.

The local dashboard reports **booked value**, not collected revenue. Directory visibility is free in this version; there is no fake featured-placement checkout.

## Development

Backend: Express 5, PostgreSQL, Node.js crypto sessions/password hashing, and Luxon for business-local scheduling. Frontend: buildless HTML/CSS/JavaScript served by Nginx with same-origin API proxying. No cloud accounts or external runtime API calls are required for this version.

The DeepSeek mission file is a development brief, not an installed agent runtime. Asset credits are in `ASSETS.md`.
