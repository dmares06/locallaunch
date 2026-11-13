import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
for (const path of ["/", "/demo", "/signup", "/discover"]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes("LocalLaunch"));
}
const listingResponse = await fetch(base + "/api/businesses");
assert.equal(listingResponse.status, 200);
const listing = await listingResponse.json();
assert.ok(listing.some((b) => b.slug === "the-sunday-standard" && b.is_demo));
const privateResponse = await fetch(base + "/api/owner/dashboard");
assert.equal(privateResponse.status, 401);
const legacy = await fetch(base + "/api/bookings");
assert.equal(legacy.status, 404);
const profile = await (
  await fetch(base + "/api/businesses/the-sunday-standard")
).json();
assert.ok(profile.services.length > 0);
assert.equal("bookings" in profile, false);
assert.equal("owner_id" in profile.business, false);
console.log("PASS: app routes, API proxy, sample business, and owner privacy");
