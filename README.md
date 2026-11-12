# LocalLaunch

Booking creation and listing, reconstructed from the supplied starter code.
Local Docker demo with Express, PostgreSQL 15, and an HTML frontend served by Nginx.

## Run

Requires Docker with Compose v2. No external service accounts or keys are needed.

```sh
docker compose up --build -d
```

Open http://localhost:3000. The API is at http://localhost:4000.
The browser calls `/api` on the frontend; Nginx proxies requests to the backend.
Both published ports bind to localhost and PostgreSQL has no published port.

## Verify

```sh
# Database-backed integration tests with a minimum 80% backend line coverage.
docker compose --profile test run --build --rm test-runner

# Exercise the frontend proxy and API flow (requires Node.js 24+).
./tests/run_booking_test.sh
```

The integration tests clean up their records; the smoke script intentionally creates sample records.
Startup waits for PostgreSQL health and initializes the schema before accepting requests.

## Stop

```sh
docker compose down
```

Data persists in the Compose volume. To explicitly delete all demo data, use
`docker compose down --volumes`.

## Scope

This is a single-workspace local demo without authentication or per-user access controls.
Use sample data only. Authentication, authorization, production database configuration,
and deployment hardening are required before making it public or storing personal data.
The database password in Compose is a local development credential only.
Payments, purchases, legal template downloads, and TrustMRR are not implemented.
The template price, where present, is demo catalog data.

## DeepSeek

See `.deepseek/mission.md`. No external APIs or payment keys are required.
