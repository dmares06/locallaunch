const root = document.getElementById("app");
const state = {
  user: null,
  dashboard: null,
  booking: {},
  filter: "all",
  search: "",
  category: "",
  revision: 0,
  renderController: null,
};
const cats = [
  "Barber & grooming",
  "Beauty",
  "Home services",
  "Wellness",
  "Fitness",
  "Other",
];
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const symbols = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external: '<path d="M7 17 17 7M7 7h10v10"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
  scissors:
    '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12M8 16 20 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  page: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16m-12 5h8m-8 4h5"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  logout: '<path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  leaf: '<path d="M20 3C7 1 1 9 6 16s16 2 14-13ZM4 21 15 10"/>',
  money: '<path d="M12 3v18m5-14H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  link: '<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
};
const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name] || symbols.leaf}</svg>`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (cents) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
const dateLabel = (date, zone, options = { month: "short", day: "numeric" }) =>
  new Intl.DateTimeFormat("en-US", {
    ...options,
    ...(zone ? { timeZone: zone } : {}),
  }).format(new Date(date));
const todayIn = (zone) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((k) => p.find((v) => v.type === k).value)
    .join("-");
};
const addDays = (date, days) =>
  new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
const logo = () =>
  `<a class="brand" href="/" data-link aria-label="LocalLaunch home"><span class="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 23V9h5v9h10v5zM19 9h7v8h-4v-4h-3z" fill="currentColor"/></svg></span>LocalLaunch<span class="brand-dot">.</span></a>`;
const go = (path) => {
  history.pushState({}, "", path);
  state.filter = "all";
  render();
  window.scrollTo(0, 0);
};
let toastTimer;
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 4500);
}
async function api(path, method = "GET", body) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: method === "GET" ? state.renderController?.signal : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}
function nav() {
  return `<header class="public-nav"><div class="container nav-inner">${logo()}<nav aria-label="Main navigation"><a href="/discover" data-link>Explore the neighborhood</a><a href="/demo" data-link>See how it works</a></nav><div class="nav-actions">${state.user ? `<a href="/dashboard" data-link class="btn btn-dark">My workspace ${icon("arrow", 16)}</a>` : `<a href="/login" data-link class="login-link">Log in</a><a href="/signup" data-link class="btn btn-dark">Get started ${icon("arrow", 16)}</a>`}</div></div></header>`;
}
const footer = () =>
  `<footer class="public-footer container">${logo()}<span>Big things start in your neighborhood.</span><span>Made for the independents.</span></footer>`;
function businessCard(b) {
  return `<a class="business-card" href="/b/${esc(b.slug)}" data-link><div class="business-photo ${b.category === "Barber & grooming" ? "barber-photo" : "abstract-photo"}">${b.category === "Barber & grooming" ? "" : icon("leaf", 72)}${b.is_demo ? '<span class="sample-label">Example business</span>' : ""}<span class="photo-link">${icon("external")}</span></div><div class="business-card-info"><span class="eyebrow">${esc(b.category)}</span><h3>${esc(b.name)}</h3><p>${icon("pin", 15)} ${esc(b.city)}</p></div></a>`;
}
async function home() {
  const businesses = await api("/api/businesses");
  root.innerHTML = `${nav()}<main><section class="container hero"><div class="hero-copy"><div class="eyebrow hero-eyebrow"><span class="tiny-dot"></span> SMALL BUSINESS. BIG POSSIBILITY.</div><h1>Good work deserves<br>a <em>full calendar.</em></h1><p>A beautiful page. Easy bookings. A place in your neighborhood. Everything your independent business needs to welcome its next customer.</p><div class="hero-actions"><a class="btn btn-dark btn-large" href="/signup" data-link>Let’s launch your business ${icon("arrow")}</a><a class="text-link" href="/demo" data-link>Take a look around ${icon("external", 18)}</a></div><div class="hero-note"><span class="mini-avatars"><i>J</i><i>M</i><i>A</i></span><span>For the people behind<br><strong>the businesses we love.</strong></span></div></div><div class="hero-visual"><div class="photo-stamp">INDEPENDENT &<br>IN GOOD COMPANY <span>↗</span></div><img src="/assets/barbershop.jpg" alt="A barber giving a customer a careful trim" fetchpriority="high"><div class="hero-image-label"><span class="label-icon">${icon("scissors", 24)}</span><div><span>MEET YOUR NEXT REGULAR</span><strong>The Sunday Standard</strong><p>Brooklyn, New York</p></div></div><div class="floating-booking"><span class="success-icon">${icon("check", 18)}</span><div><strong>A little easier to get booked.</strong><span>Your page. Your hours. Your way.</span></div></div><div class="orbit">A LITTLE<br>MORE LOCAL<svg viewBox="0 0 30 30"><path d="M15 2v26M2 15h26M6 6l18 18M6 24 24 6" stroke="currentColor" stroke-width="1.5"/></svg></div></div></section><section class="feature-strip"><div class="container feature-grid"><article><span class="feature-number">01</span><div><h3>Your own little corner of the internet.</h3><p>A business page that feels like you, ready to share.</p></div></article><article><span class="feature-number">02</span><div><h3>Less back-and-forth. More bookings.</h3><p>Let customers choose a time that works for you.</p></div></article><article><span class="feature-number">03</span><div><h3>Put your good work on the map.</h3><p>Help your neighbors find their next go-to.</p></div></article></div></section><section class="container neighborhood"><div class="section-heading"><div><span class="eyebrow">A LITTLE CLOSER TO HOME</span><h2>Meet the neighborhood.</h2></div><a class="text-link" href="/discover" data-link>Explore local businesses ${icon("arrow", 18)}</a></div><div class="neighborhood-grid">${businesses.slice(0, 2).map(businessCard).join("")}<article class="your-business-card"><span class="drawn-star">✳</span><span class="eyebrow">THIS COULD BE YOUR SPOT</span><h3>You bring the good work.<br>We’ll bring the welcome mat.</h3><p>From the first click to the next appointment, make it easier to choose you.</p><a class="btn btn-dark" href="/signup" data-link>Create your business page ${icon("arrow", 16)}</a></article></div></section><section class="container closing-cta"><span class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h2>Small business.<br><em>Wide-open possibilities.</em></h2><a class="btn btn-dark btn-large" href="/signup" data-link>Make yourself at home ${icon("arrow", 18)}</a><p>No card needed to get started.</p></section></main>${footer()}`;
}
async function discover() {
  const q = new URLSearchParams({
    search: state.search,
    category: state.category,
  });
  const businesses = await api(`/api/businesses?${q}`);
  root.innerHTML = `${nav()}<main class="container discover"><span class="eyebrow">GOOD PEOPLE. GREAT LOCAL BUSINESSES.</span><h1>Your next go-to<br>is <em>closer than you think.</em></h1><p class="intro">Discover independent businesses and make a little room for local.</p><form id="search-form" class="search-bar"><label class="sr-only" for="search">Search by business, service, or city</label>${icon("search")}<input id="search" name="search" value="${esc(state.search)}" placeholder="A great haircut, a neighborhood, a new favorite…"><button class="btn btn-dark">Find your local</button></form><div class="category-filters">${["", ...cats].map((c) => `<button class="chip ${state.category === c ? "selected" : ""}" data-category="${esc(c)}">${c || "All businesses"}</button>`).join("")}</div><div class="section-heading"><h3>${businesses.length} ${businesses.length === 1 ? "business" : "businesses"} to get to know</h3><span class="muted">Sample listings are labeled</span></div><div class="directory-grid">${businesses.length ? businesses.map(businessCard).join("") : '<div class="empty-state"><h3>A little quiet around here.</h3><p>Try a different search, or be the first business in your neighborhood.</p><a class="btn btn-dark" href="/signup" data-link>Join the neighborhood</a></div>'}</div></main>${footer()}`;
}
function authPage(mode) {
  const signup = mode === "signup";
  root.innerHTML = `${nav()}<main class="auth-layout container"><div class="auth-story"><span class="eyebrow">FOR THE INDEPENDENTS</span><h1>You do the<br>good work.<br><em>We’ll open<br>the door.</em></h1><p>A business that feels like yours. A calendar that works for you. A neighborhood ready to meet you.</p><span class="auth-decoration">✳</span></div><section class="auth-panel"><span class="eyebrow">${signup ? "YOUR NEXT CHAPTER" : "MAKE YOURSELF AT HOME"}</span><h2>${signup ? "Let’s get you launched." : "Welcome back."}</h2><p>${signup ? "Create your account. Your business page comes next." : "Your business is right where you left it."}</p><form id="auth-form" data-mode="${mode}">${signup ? '<label>Your name<input name="name" autocomplete="name" maxlength="100" required placeholder="Alex Morgan"></label>' : ""}<label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@yourbusiness.com"></label><label>Password<input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="${signup ? 12 : 1}" maxlength="128" required placeholder="${signup ? "At least 12 characters" : "Your password"}"></label><p id="form-error" class="form-error" role="alert"></p><button class="btn btn-dark btn-block" type="submit">${signup ? "Create my account" : "Welcome me back"} ${icon("arrow", 18)}</button></form><p class="auth-switch">${signup ? "Already part of the neighborhood?" : "New around here?"} <a href="/${signup ? "login" : "signup"}" data-link>${signup ? "Log in" : "Create an account"}</a></p><p class="small muted">${signup ? "No card needed. Start by making your business page." : "Need a look around first?"} <a href="/demo" data-link>Explore the sample workspace.</a></p></section></main>`;
}
function profileForm(b = {}, onboarding = false) {
  return `<form id="profile-form" class="panel form-panel"><div class="panel-heading"><div><h3>${onboarding ? "Tell the neighborhood about yourself." : "The details that make you, you."}</h3><p>Your business page starts with the basics.</p></div></div><div class="form-grid"><label>Business name<input id="business-name" name="name" value="${esc(b.name)}" placeholder="Your neighborhood favorite" maxlength="100" required></label><label>Your page address<div class="slug-field"><span>/b/</span><input id="business-slug" data-edited="${b.slug ? "true" : ""}" name="slug" value="${esc(b.slug)}" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="60" required placeholder="your-business"></div></label><label>What do you do?<select name="category">${cats.map((c) => `<option ${b.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label><label>City and state<input name="city" value="${esc(b.city)}" maxlength="100" required placeholder="Brooklyn, NY"></label><label class="full-width">A little about your business<textarea name="description" rows="3" maxlength="1500" placeholder="Tell people what makes your good work special.">${esc(b.description)}</textarea></label><label>Business phone<input name="phone" value="${esc(b.phone)}" maxlength="40" type="tel" placeholder="(555) 123-4567"></label><label>Business time zone<select name="timezone">${["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Paris", "Australia/Sydney", "Asia/Tokyo", "Asia/Kolkata", "UTC"].map((z) => `<option ${z === (b.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone) ? "selected" : ""}>${z}</option>`).join("")}</select></label><label class="full-width">Already have a booking page? <span class="optional">Optional</span><input name="booking_url" type="url" value="${esc(b.booking_url)}" maxlength="2000" placeholder="https://your-existing-booking-page.com"><small>Keep what works. We can send customers to your existing booking page.</small></label></div><p id="form-error" class="form-error" role="alert"></p><div class="form-footer"><span>${onboarding ? "You can change these details anytime." : "Changes appear on your published page."}</span><button class="btn btn-dark" type="submit">${onboarding ? "Next: add your services" : "Save business details"} ${icon("arrow", 16)}</button></div></form>`;
}
async function onboarding() {
  if (!state.user) return go("/login");
  const data = await api("/api/owner/dashboard");
  root.innerHTML = `${nav()}<main class="container onboarding"><div class="onboarding-steps"><span class="active">01 Your business</span><span>02 Your services</span><span>03 Your hours</span><span>04 Open for business</span></div><span class="eyebrow">LET’S MAKE IT YOURS</span><h1>A proper hello<br>to your <em>neighborhood.</em></h1>${profileForm(data.business || {}, true)}</main>${footer()}`;
}
function sidebar(active, demo, data) {
  const prefix = demo ? "/demo" : "/dashboard";
  const b = data.business;
  return `<aside class="sidebar">${logo()}<div class="workspace-label">YOUR LITTLE CORNER</div><div class="workspace-switch"><span class="workspace-avatar">${icon("scissors", 22)}</span><div><strong>${esc(b?.name || "Your new business")}</strong><span>${b?.published ? "Open for business" : "Getting ready to launch"}</span></div></div><nav aria-label="Workspace navigation">${[
    ["overview", "grid", "Overview", ""],
    ["bookings", "calendar", "Bookings", "/bookings"],
    ["services", "scissors", "Services", "/services"],
    ["hours", "clock", "Availability", "/hours"],
    ["page", "page", "Business page", "/page"],
  ]
    .map(
      ([key, i, label, path]) =>
        `<a href="${prefix + path}" data-link class="${active === key ? "active" : ""}">${icon(i)}${label}${key === "overview" ? '<span class="nav-active-dot"></span>' : ""}</a>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-bottom"><a class="sidebar-help" href="${prefix}/guide" data-link>${icon("help")} A little guidance</a><div class="sidebar-person"><span class="avatar">${esc(initials(state.user?.name || "Demo Owner"))}</span><div><strong>${esc(state.user?.name || "Demo workspace")}</strong><span>${demo ? "Make yourself at home" : "Business owner"}</span></div>${demo ? "" : `<button class="icon-button" data-action="logout" aria-label="Log out">${icon("logout", 18)}</button>`}</div></div></aside>`;
}
function bookingRows(bookings, business, demo, compact = false) {
  if (!bookings.length)
    return `<div class="empty-state">${icon("calendar", 34)}<h3>A little room for possibility.</h3><p>Your bookings will appear here. Share your page to welcome your first customer.</p></div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Customer</th><th>Service</th><th>Date & time</th><th>Status</th><th class="amount-column">Amount</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>${bookings
    .slice(0, compact ? 5 : 250)
    .map(
      (b, i) =>
        `<tr><td><div class="customer-cell"><span class="avatar avatar-${i % 3}">${esc(initials(b.customer_name))}</span><div><strong>${esc(b.customer_name)}</strong><span>${esc(b.customer_email)}</span></div></div></td><td>${esc(b.service_name)}</td><td><strong class="table-date">${dateLabel(b.starts_at, business.timezone)}</strong><span class="table-time">${dateLabel(b.starts_at, business.timezone, { hour: "numeric", minute: "2-digit" })}</span></td><td><span class="status-badge ${b.status}"><i></i>${esc(b.status)}</span></td><td class="amount-column">${money(b.price_cents)}</td><td><button class="icon-button" aria-label="View booking for ${esc(b.customer_name)}" data-booking="${b.id}">${icon("chevron", 16)}</button></td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}
function overview(data, demo) {
  const b = data.business;
  const future = data.bookings
    .filter(
      (x) => x.status === "confirmed" && new Date(x.starts_at) >= new Date(),
    )
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const customers = data.stats.customer_count;
  const metrics = [
    [
      "calendar",
      data.stats.upcoming_count,
      "Upcoming bookings",
      "A little more to look forward to",
    ],
    [
      "money",
      money(Number(data.stats.upcoming_value)),
      "Booked value",
      "Pay-at-appointment bookings",
    ],
    ["users", customers, "Customers", "Good people, coming back"],
    [
      "scissors",
      data.services.length,
      "Active services",
      "Your good work, on the menu",
    ],
  ];
  const prefix = demo ? "/demo" : "/dashboard";
  let today = todayIn(b?.timezone || "America/New_York");
  const counts = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i);
    return {
      day,
      count: Number(data.week.find((entry) => entry.day === day)?.count || 0),
    };
  });
  const max = Math.max(...counts.map((x) => x.count), 1);
  return `<div class="welcome-heading"><div><span class="eyebrow">${dateLabel(new Date(), b?.timezone, { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}</span><h1>A good day for <em>good business.</em></h1><p>Here’s what’s happening in your little corner of the neighborhood.</p></div><a class="btn btn-dark" href="${b?.published ? "/b/" + esc(b.slug) : prefix + "/page"}" data-link>${icon("plus", 17)} ${demo ? "Try a booking" : "Your booking page"}</a></div>${!b?.published ? `<div class="launch-checklist"><span class="launch-icon">${icon("leaf", 26)}</span><div><strong>Your next chapter is taking shape.</strong><p>${b ? "Add your services and hours, then publish your page." : "Start with a few details about your business."}</p><div class="checklist-items"><a href="${b ? prefix + "/page" : "/onboarding"}" data-link>${icon(b ? "check" : "plus", 14)} Business details</a><a href="${prefix}/services" data-link>${icon(data.services.length ? "check" : "plus", 14)} Your services</a><a href="${prefix}/hours" data-link>${icon(data.hours.length ? "check" : "plus", 14)} Opening hours</a></div></div><button class="btn btn-dark" data-action="publish">Publish your page ${icon("arrow", 16)}</button></div>` : ""}<section class="metrics-grid">${metrics.map(([i, value, label, note]) => `<article class="metric-card"><div class="metric-top"><span>${label}</span>${icon(i, 19)}</div><strong>${value}</strong><p>${note}</p></article>`).join("")}</section><div class="dashboard-middle"><section class="panel week-panel"><div class="panel-heading"><div><h3>Your week, at a glance</h3><p>A little space for every appointment.</p></div><span class="subtle-pill">Next 7 days</span></div><div class="bar-chart">${counts.map(({ day, count }) => `<div class="bar-column"><span class="bar-value">${count || ""}</span><div class="bar-track"><div class="bar ${day === today ? "today-bar" : ""}" style="height:${Math.max((count / max) * 100, 3)}%" title="${count} bookings"></div></div><span class="bar-label">${dateLabel(day + "T12:00:00Z", "UTC", { weekday: "short" })}</span></div>`).join("")}</div><div class="chart-caption"><i></i> Confirmed upcoming bookings · ${esc(b?.timezone || "Your time zone")}</div></section><section class="share-panel"><div class="share-icon">${icon("page", 27)}</div><span class="eyebrow">YOUR DIGITAL WELCOME MAT</span><h3>Good things<br>are worth sharing.</h3><p>Your business page has everything customers need to take the next step.</p><div class="page-address">locallaunch / <strong>${esc(b?.slug || "your-business")}</strong></div><button class="btn btn-light btn-block" data-action="copy-page" ${!b?.published ? "disabled" : ""}>${icon("link", 16)} Copy your page link</button></section></div><section class="panel upcoming-panel"><div class="panel-heading"><div><h3>Coming through your door</h3><p>A few familiar faces. A few new favorites.</p></div><a class="text-link small" href="${prefix}/bookings" data-link>View all bookings ${icon("arrow", 16)}</a></div>${bookingRows(future, b, demo, true)}</section>`;
}
function servicesPanel(data, demo) {
  return `<div class="page-heading"><span class="eyebrow">YOUR GOOD WORK, ON THE MENU</span><h1>A service for <em>every regular.</em></h1><p>Give customers a clear idea of what you do, how long it takes, and what it costs.</p></div><div class="services-layout"><section class="panel"><div class="panel-heading"><h3>Your services <span class="count-badge">${data.services.length}</span></h3></div>${data.services.length ? data.services.map((s) => `<article class="service-list-item"><span class="service-symbol">${icon("scissors", 24)}</span><div><h4>${esc(s.name)}</h4><p>${esc(s.description)}</p><span>${s.duration_minutes} minutes · ${money(s.price_cents)}</span></div>${!demo ? `<button class="icon-button delete-service" data-remove-service="${s.id}" aria-label="Remove ${esc(s.name)}">${icon("close", 17)}</button>` : ""}</article>`).join("") : '<div class="empty-state"><h3>What do you do best?</h3><p>Add your first service to get your page ready.</p></div>'}</section>${demo ? `<section class="panel form-panel"><h3>Your skills deserve a proper introduction.</h3><p>This sample workspace shows how your service menu will look.</p><a class="btn btn-dark" href="/signup" data-link>Make it yours ${icon("arrow", 16)}</a></section>` : `<form id="service-form" class="panel form-panel"><h3>Add a little more good work.</h3><label>Service name<input name="name" required maxlength="100" placeholder="The signature appointment"></label><label>A short description<textarea name="description" maxlength="500" rows="3" placeholder="What can customers look forward to?"></textarea></label><div class="form-grid"><label>Duration (minutes)<input name="duration_minutes" type="number" min="15" max="480" step="1" value="45" required></label><label>Price (USD)<input name="price" type="number" min="0" max="100000" step="0.01" value="45" required></label></div><p id="form-error" class="form-error" role="alert"></p><button class="btn btn-dark btn-block">${icon("plus", 17)} Add service</button></form>`}</div>`;
}
function hoursPanel(data, demo) {
  return `<div class="page-heading"><span class="eyebrow">MAKE ROOM FOR WHAT MATTERS</span><h1>A schedule that <em>works for you.</em></h1><p>Set your usual week. Customers can book available times within these hours.</p></div><form id="hours-form" class="panel hours-panel"><div class="panel-heading"><div><h3>Your regular hours</h3><p>All times are in ${esc(data.business?.timezone || "your business time zone")}.</p></div>${icon("clock", 24)}</div>${days
    .map((day, i) => {
      const h = data.hours.find((h) => h.day === i + 1);
      const time = (n) =>
        `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
      return `<div class="hours-row"><label class="day-toggle"><input type="checkbox" name="enabled-${i + 1}" ${h || (!data.hours.length && i < 5) ? "checked" : ""} ${demo ? "disabled" : ""}><span>${day}</span></label><div class="hours-times"><input aria-label="${day} opening time" type="time" name="open-${i + 1}" value="${h ? time(h.open_minute) : "09:00"}" ${demo ? "disabled" : ""}><span>to</span><input aria-label="${day} closing time" type="time" name="close-${i + 1}" value="${h ? time(h.close_minute) : "17:00"}" ${demo ? "disabled" : ""}></div></div>`;
    })
    .join(
      "",
    )}<p id="form-error" class="form-error" role="alert"></p><div class="form-footer"><span>Bookings can be made up to 90 days ahead.</span>${demo ? '<a class="btn btn-dark" href="/signup" data-link>Set your own hours</a>' : '<button class="btn btn-dark">Save opening hours</button>'}</div></form>`;
}
function bookingsPanel(data, demo) {
  const list = data.bookings.filter(
    (b) => state.filter === "all" || b.status === state.filter,
  );
  return `<div class="page-heading"><span class="eyebrow">A LITTLE MORE TO LOOK FORWARD TO</span><h1>Your calendar, <em>coming to life.</em></h1><p>Keep up with the people choosing your business.</p></div><section class="panel"><div class="bookings-toolbar"><div class="tabs">${["all", "confirmed", "completed", "cancelled"].map((f) => `<button class="${state.filter === f ? "active" : ""}" data-filter="${f}">${f === "all" ? "All bookings" : f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div><span class="muted small">${list.length} ${list.length === 1 ? "booking" : "bookings"}</span></div>${bookingRows(list, data.business, demo)}</section>`;
}
async function dashboardPage(active, demo) {
  if (!demo && !state.user) return go("/login");
  const data = await api(demo ? "/api/demo" : "/api/owner/dashboard");
  state.dashboard = data;
  let content;
  if (active === "services") content = servicesPanel(data, demo);
  else if (active === "hours") content = hoursPanel(data, demo);
  else if (active === "bookings") content = bookingsPanel(data, demo);
  else if (active === "page")
    content = `<div class="page-heading"><span class="eyebrow">YOUR DIGITAL WELCOME MAT</span><h1>A page that <em>feels like you.</em></h1><p>A proper introduction to the neighborhood.</p></div>${demo ? `<section class="panel form-panel"><h3>${esc(data.business.name)}</h3><p>${esc(data.business.description)}</p><a class="btn btn-dark" href="/b/${esc(data.business.slug)}" data-link>See the business page ${icon("external", 16)}</a></section>` : profileForm(data.business || {})}`;
  else if (active === "guide")
    content = `<div class="page-heading"><span class="eyebrow">ONE GOOD STEP AT A TIME</span><h1>A little guidance.<br><em>A lot of possibility.</em></h1></div><section class="panel form-panel guide"><h3>Make yourself at home.</h3><ol><li><strong>Introduce your business.</strong> Add your name, location, and the details people should know.</li><li><strong>Put your services on the menu.</strong> Choose a duration and price for each appointment.</li><li><strong>Set your regular hours.</strong> We show available times in your business’s time zone.</li><li><strong>Open the door.</strong> Publish your page, then share your link with your neighborhood.</li></ol><p>Already have a booking website? Add its link in Business page. Customers can discover you here and book there.</p><p>Prices are paid at the appointment. LocalLaunch does not collect customer payments in this version.</p></section>`;
  else content = overview(data, demo);
  if (active === "page" && !demo && data.business)
    content =
      `<div class="publication-panel"><div><span class="status-badge ${data.business.published ? "confirmed" : "cancelled"}"><i></i>${data.business.published ? "Your page is live" : "Your page is a draft"}</span><p>${data.business.published ? "Your neighborhood can find and book you." : "Publish when your services and hours are ready."}</p></div><button class="btn btn-outline" data-action="toggle-publish">${data.business.published ? "Unpublish page" : "Publish your page"}</button></div>` +
      content;
  const labels = {
    overview: "Overview",
    services: "Services",
    hours: "Availability",
    bookings: "Bookings",
    page: "Business page",
    guide: "Getting started",
  };
  root.innerHTML = `<div class="app-shell">${sidebar(active, demo, data)}<div class="workspace-main"><header class="workspace-top"><span><span class="breadcrumb-muted">Your workspace</span> / ${labels[active] || "Overview"}</span><div>${data.business?.published ? `<a href="/b/${esc(data.business.slug)}" data-link class="text-link small">View business page ${icon("external", 16)}</a>` : ""}<span class="avatar top-avatar">${esc(initials(state.user?.name || "Demo Owner"))}</span>${!demo ? `<button class="icon-button mobile-logout" data-action="logout" aria-label="Log out">${icon("logout", 18)}</button>` : ""}</div></header>${demo ? '<div class="demo-banner"><span><strong>A little look around.</strong> This is an example workspace with sample customers.</span><a href="/signup" data-link>Make it yours ↗</a></div>' : ""}<main class="workspace-content">${content}</main><footer class="workspace-footer"><span>A little more local. A lot more possibility.</span><span>Made for your next chapter ${icon("leaf", 14)}</span></footer></div></div>`;
}
async function businessPage(slug) {
  const {
    business: b,
    services,
    hours,
  } = await api(`/api/businesses/${encodeURIComponent(slug)}`);
  if (state.booking.slug !== slug) state.booking = { slug };
  const book = state.booking;
  const service = services.find((s) => s.id === book.serviceId) || services[0];
  if (service) book.serviceId = service.id;
  book.date = book.date || todayIn(b.timezone);
  let slots = [];
  if (service && !b.booking_url && !book.confirmation) {
    slots = (
      await api(
        `/api/businesses/${encodeURIComponent(slug)}/availability?service_id=${service.id}&date=${book.date}`,
      )
    ).slots;
  }
  let bookingContent;
  if (book.confirmation) {
    const c = book.confirmation;
    bookingContent = `<div class="booking-success"><span>${icon("check", 32)}</span><div class="eyebrow">YOU’RE IN GOOD HANDS</div><h2>See you soon.</h2><p>Your appointment at ${esc(b.name)} is confirmed.</p><div class="confirmation-details"><strong>${esc(c.service_name)}</strong><span>${dateLabel(c.starts_at, b.timezone, { weekday: "long", month: "long", day: "numeric" })}</span><span>${dateLabel(c.starts_at, b.timezone, { hour: "numeric", minute: "2-digit" })} · ${esc(b.timezone)}</span><span>${money(c.price_cents)} · Pay at your appointment</span></div><p class="small muted">Booking reference #${c.id}. Keep these details for your visit.</p><button class="btn btn-outline btn-block" data-action="another-booking">Book another appointment</button></div>`;
  } else if (b.booking_url) {
    bookingContent = `<span class="eyebrow">A GOOD PLACE TO START</span><h2>Make a little time<br>for yourself.</h2><p>This business takes appointments on its own booking website.</p><a class="btn btn-dark btn-block" href="${esc(b.booking_url)}" target="_blank" rel="noopener noreferrer">Continue to booking ${icon("external", 18)}</a>`;
  } else if (!services.length) {
    bookingContent =
      "<h2>A little something is coming.</h2><p>This business is getting its service menu ready. Check back soon.</p>";
  } else if (book.step === "details") {
    bookingContent = `<button class="back-link" data-action="booking-back">← Pick a different time</button><span class="eyebrow">ONE LAST HELLO</span><h2>We’ll save you<br>a spot.</h2><div class="booking-summary"><strong>${esc(service.name)} · ${money(service.price_cents)}</strong><span>${dateLabel(book.startsAt, b.timezone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div><form id="booking-form"><label>Your name<input name="name" autocomplete="name" maxlength="100" required placeholder="Alex Morgan"></label><label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"></label><label>Phone <span class="optional">Optional</span><input name="phone" type="tel" autocomplete="tel" maxlength="40" placeholder="(555) 123-4567"></label><label>A little heads-up <span class="optional">Optional</span><textarea name="notes" maxlength="1000" rows="2" placeholder="Anything you’d like us to know?"></textarea></label><p id="form-error" class="form-error" role="alert"></p><button class="btn btn-dark btn-block">Confirm booking ${icon("arrow", 18)}</button><p class="booking-footnote">${money(service.price_cents)} · Pay at your appointment</p></form>`;
  } else {
    bookingContent = `<span class="eyebrow">A LITTLE TIME, JUST FOR YOU</span><h2>Your next good<br>${b.category === "Barber & grooming" ? "haircut" : "appointment"} starts here.</h2><h4 class="booking-step-label"><span>1</span> What brings you in?</h4><div class="service-options">${services.map((s) => `<button class="service-option ${s.id === service.id ? "selected" : ""}" data-service="${s.id}"><span class="radio-mark"></span><span><strong>${esc(s.name)}</strong><small>${s.duration_minutes} minutes</small></span><strong>${money(s.price_cents)}</strong></button>`).join("")}</div><div class="date-heading"><h4 class="booking-step-label"><span>2</span> Find your moment</h4><label class="date-picker-label">${icon("calendar", 17)}<input aria-label="Appointment date" id="booking-date" type="date" value="${book.date}" min="${todayIn(b.timezone)}" max="${addDays(todayIn(b.timezone), 90)}"></label></div><div class="date-chips">${Array.from(
      { length: 5 },
      (_, i) => addDays(book.date, i),
    )
      .filter((d) => d <= addDays(todayIn(b.timezone), 90))
      .map((d, i) => {
        return `<button class="date-chip ${i === 0 ? "selected" : ""}" data-date="${d}"><span>${dateLabel(d + "T12:00:00Z", "UTC", { weekday: "short" })}</span><strong>${dateLabel(d + "T12:00:00Z", "UTC", { day: "numeric" })}</strong></button>`;
      })
      .join(
        "",
      )}</div><div class="time-slots">${slots.length ? slots.map((s) => `<button class="time-slot ${book.startsAt === s.start ? "selected" : ""}" data-slot="${esc(s.start)}">${dateLabel(s.start, b.timezone, { hour: "numeric", minute: "2-digit" })}</button>`).join("") : '<p class="no-slots">A little full today. Try another day for more available times.</p>'}</div><p class="timezone-note">All times in ${esc(b.timezone.replaceAll("_", " "))}</p><button class="btn btn-dark btn-block" data-action="booking-next" ${!slots.some((s) => s.start === book.startsAt) ? "disabled" : ""}>A good time. Let’s book it. ${icon("arrow", 17)}</button><p class="booking-footnote">No payment needed to reserve your spot.</p>`;
  }
  root.innerHTML = `${nav()}${b.is_demo ? '<div class="public-demo-notice">You’re exploring an example business. Sample bookings only; personal details aren’t saved.</div>' : ""}<main class="container business-layout"><section class="business-story"><a href="/discover" data-link class="back-link">← Back to the neighborhood</a><div class="business-hero ${b.category === "Barber & grooming" ? "barber-photo" : "abstract-photo"}">${b.category === "Barber & grooming" ? "" : icon("leaf", 110)}<span class="business-hero-label">INDEPENDENT. LOCAL. YOURS.</span></div><div class="business-title-row"><div><span class="eyebrow">${esc(b.category)}</span><h1>${esc(b.name)}</h1></div><span class="business-monogram">${esc(initials(b.name))}</span></div><p class="business-location">${icon("pin", 17)} ${esc(b.city)}</p><p class="business-description">${esc(b.description)}</p><div class="business-detail-grid"><div><h4>${icon("clock", 18)} Make yourself at home</h4>${hours.map((h) => `<p><span>${days[h.day - 1]}</span><span>${String(Math.floor(h.open_minute / 60)).padStart(2, "0")}:${String(h.open_minute % 60).padStart(2, "0")} – ${String(Math.floor(h.close_minute / 60)).padStart(2, "0")}:${String(h.close_minute % 60).padStart(2, "0")}</span></p>`).join("") || "<p>Contact the business for opening hours.</p>"}</div><div><h4>${icon("pin", 18)} Find your local</h4><p>${esc(b.city)}</p>${b.phone ? `<p>${esc(b.phone)}</p>` : ""}<span class="local-note">A little more local.<br>A little more you.</span></div></div></section><aside class="booking-panel panel">${bookingContent}</aside></main><div class="powered-by">A local business. A warm welcome. <span>Powered by LocalLaunch.</span></div>${footer()}`;
}
function showBooking(id) {
  const d = state.dashboard,
    b = d.bookings.find((b) => b.id === id);
  if (!b) return;
  document.getElementById("modal-root").innerHTML =
    `<div class="modal-overlay"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="icon-button modal-close" data-action="close-modal" aria-label="Close booking details">${icon("close")}</button><span class="eyebrow">A LITTLE MORE DETAIL</span><h2 id="modal-title">${esc(b.customer_name)}</h2><p>${esc(b.service_name)} · ${money(b.price_cents)}</p><dl><dt>When</dt><dd>${dateLabel(b.starts_at, d.business.timezone, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</dd><dt>Email</dt><dd>${esc(b.customer_email)}</dd><dt>Phone</dt><dd>${esc(b.customer_phone) || "Not provided"}</dd><dt>Notes</dt><dd>${esc(b.notes) || "No notes for this visit."}</dd><dt>Status</dt><dd>${esc(b.status)}</dd></dl>${!location.pathname.startsWith("/demo") && b.status === "confirmed" ? `<div class="modal-actions"><button class="btn btn-dark" data-booking-status="completed" data-id="${id}">Mark completed</button><button class="btn btn-danger" data-booking-status="cancelled" data-id="${id}">Cancel booking</button></div>` : ""}</section></div>`;
  document.querySelector(".modal-close").focus();
}
async function render() {
  const revision = ++state.revision;
  state.renderController?.abort();
  state.renderController = new AbortController();
  document.getElementById("modal-root").innerHTML = "";
  const path = location.pathname.replace(/\/$/, "") || "/";
  document.title = "LocalLaunch — A little more local";
  try {
    if (path === "/") await home();
    else if (path === "/discover") await discover();
    else if (path === "/signup" || path === "/login") authPage(path.slice(1));
    else if (path === "/onboarding") await onboarding();
    else if (/^\/(demo|dashboard)(\/|$)/.test(path)) {
      const [, base, active] = path.split("/");
      await dashboardPage(active || "overview", base === "demo");
    } else if (path.startsWith("/b/"))
      await businessPage(decodeURIComponent(path.slice(3)));
    else throw new Error("This page has wandered a little far from home.");
    if (revision !== state.revision) return;
  } catch (error) {
    if (error.name === "AbortError" || revision !== state.revision) return;
    if (error.status === 401) {
      state.user = null;
      go("/login");
      return;
    }
    root.innerHTML = `${nav()}<main class="container error-page"><span class="eyebrow">A SMALL DETOUR</span><h1>Let’s find your<br><em>way back.</em></h1><p>${esc(error.message)}</p><a href="/" data-link class="btn btn-dark">Back to the neighborhood ${icon("arrow", 18)}</a></main>`;
  }
}
function disableBookingChoices() {
  root
    .querySelectorAll('.time-slot, [data-action="booking-next"]')
    .forEach((button) => {
      button.disabled = true;
    });
}
const handleClick = async (event) => {
  const link = event.target.closest("a[data-link]");
  if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.preventDefault();
    go(link.getAttribute("href"));
    return;
  }
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  try {
    if (button.hasAttribute("data-category")) {
      state.category = button.dataset.category;
      await render();
    } else if (button.dataset.filter) {
      state.filter = button.dataset.filter;
      await render();
    } else if (button.dataset.service) {
      state.booking.serviceId = Number(button.dataset.service);
      state.booking.startsAt = null;
      disableBookingChoices();
      await render();
    } else if (button.dataset.date) {
      state.booking.date = button.dataset.date;
      state.booking.startsAt = null;
      disableBookingChoices();
      await render();
    } else if (button.dataset.slot) {
      state.booking.startsAt = button.dataset.slot;
      document
        .querySelectorAll(".time-slot")
        .forEach((el) => el.classList.toggle("selected", el === button));
      document.querySelector('[data-action="booking-next"]').disabled = false;
    } else if (button.dataset.booking) {
      showBooking(Number(button.dataset.booking));
    } else if (button.dataset.removeService) {
      if (
        !confirm(
          "Remove this service from your booking page? Existing bookings will be kept.",
        )
      )
        return;
      await api(
        "/api/owner/services/" + button.dataset.removeService,
        "DELETE",
      );
      toast("Service removed from your menu.");
      await render();
    } else if (button.dataset.bookingStatus) {
      if (
        button.dataset.bookingStatus === "cancelled" &&
        !confirm("Cancel this appointment and make the time available again?")
      )
        return;
      button.disabled = true;
      await api("/api/owner/bookings/" + button.dataset.id, "PATCH", {
        status: button.dataset.bookingStatus,
      });
      toast("Booking updated.");
      await render();
    } else {
      switch (button.dataset.action) {
        case "logout":
          await api("/api/auth/logout", "POST");
          state.user = null;
          go("/");
          break;
        case "close-modal":
          document.getElementById("modal-root").innerHTML = "";
          break;
        case "booking-next":
          state.booking.step = "details";
          await render();
          break;
        case "booking-back":
          state.booking.step = null;
          await render();
          break;
        case "another-booking":
          state.booking = { slug: state.booking.slug };
          await render();
          break;
        case "copy-page": {
          const url = location.origin + "/b/" + state.dashboard.business.slug;
          try {
            await navigator.clipboard.writeText(url);
            toast("Your business page link is copied.");
          } catch {
            prompt("Copy your business page link:", url);
          }
          break;
        }
        case "toggle-publish":
          await api("/api/owner/publish", "POST", {
            published: !state.dashboard.business.published,
          });
          toast(
            state.dashboard.business.published
              ? "Your page is now a draft."
              : "Your page is live. Welcome to the neighborhood!",
          );
          await render();
          break;
        case "publish":
          if (!state.dashboard.business) {
            go("/onboarding");
            return;
          }
          await api("/api/owner/publish", "POST", { published: true });
          toast("You’re open for business. Welcome to the neighborhood!");
          await render();
          break;
      }
    }
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
};
root.addEventListener("click", handleClick);
document.getElementById("modal-root").addEventListener("click", handleClick);
root.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button[type="submit"],button:not([type])');
  if (button) button.disabled = true;
  const errorEl = form.querySelector("#form-error");
  if (errorEl) errorEl.textContent = "";
  try {
    if (form.id === "auth-form") {
      const result = await api(
        "/api/auth/" + (form.dataset.mode === "signup" ? "register" : "login"),
        "POST",
        values,
      );
      state.user = result.user;
      go(form.dataset.mode === "signup" ? "/onboarding" : "/dashboard");
    } else if (form.id === "profile-form") {
      await api("/api/owner/business", "PUT", values);
      toast("Your business details are saved.");
      go(
        location.pathname === "/onboarding"
          ? "/dashboard/services"
          : "/dashboard/page",
      );
    } else if (form.id === "service-form") {
      await api("/api/owner/services", "POST", {
        ...values,
        duration_minutes: Number(values.duration_minutes),
        price_cents: Math.round(Number(values.price) * 100),
      });
      toast("A little more good work, added to your menu.");
      await render();
    } else if (form.id === "hours-form") {
      const hours = days.map((_, i) => ({
        day: i + 1,
        enabled: values["enabled-" + (i + 1)] === "on",
        open: values["open-" + (i + 1)],
        close: values["close-" + (i + 1)],
      }));
      await api("/api/owner/hours", "PUT", { hours });
      toast("Your regular hours are saved.");
      await render();
    } else if (form.id === "booking-form") {
      state.booking.confirmation = await api(
        "/api/businesses/" + state.booking.slug + "/bookings",
        "POST",
        {
          ...values,
          service_id: state.booking.serviceId,
          starts_at: state.booking.startsAt,
        },
      );
      await render();
    } else if (form.id === "search-form") {
      state.search = values.search;
      await render();
    }
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message;
    else toast(error.message);
    if (error.status === 409 && form.id === "booking-form") {
      state.booking.step = null;
      state.booking.startsAt = null;
      toast(error.message);
      await render();
    }
  } finally {
    if (button) button.disabled = false;
  }
});
root.addEventListener("input", (event) => {
  if (
    event.target.id === "business-name" &&
    !document.getElementById("business-slug").dataset.edited
  )
    document.getElementById("business-slug").value = event.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  if (event.target.id === "business-slug") event.target.dataset.edited = "true";
});
root.addEventListener("change", async (event) => {
  if (
    event.target.id === "booking-date" &&
    event.target.value &&
    event.target.validity.valid
  ) {
    state.booking.date = event.target.value;
    state.booking.startsAt = null;
    disableBookingChoices();
    await render();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape")
    document.getElementById("modal-root").innerHTML = "";
  if (event.key === "Tab" && document.querySelector(".modal-card")) {
    const list = [
      ...document.querySelectorAll(
        ".modal-card button,.modal-card a,.modal-card input",
      ),
    ].filter((el) => !el.disabled);
    const first = list[0],
      last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
window.addEventListener("popstate", render);
(async () => {
  try {
    state.user = (await api("/api/auth/me")).user;
  } catch {}
  await render();
})();
