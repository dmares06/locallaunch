# LocalLaunch development mission

Improve the LocalLaunch product in this repository while preserving its real end-to-end booking flow.

- Keep owner accounts and sessions, business profiles, services, availability, publishing, directory discovery, and private booking management working together.
- Run the database-backed integration tests and frontend proxy smoke check in README.md.
- Keep every owner operation scoped to the verified session identity. Public pages must never return customer contact records.
- Keep sample businesses explicitly labeled. Never retain submitted personal details on the public sample workspace.
- Preserve transaction-based booking conflict protection and business-local time-zone handling.
- No external service keys or live payments are needed for local development.
- Request approval before enabling payment keys, changing production resources, or pushing outside the authorized repository scope.
- Produce a git-style patch at `/workspace/artifacts/locallaunch.patch` when requested and report actual validation evidence.
