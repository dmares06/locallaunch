const {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
} = require("node:crypto");
const { promisify } = require("node:util");
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const digest = (value) => createHash("sha256").update(value).digest("hex");
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64, options);
  return `${salt}:${key.toString("hex")}`;
}
async function verifyPassword(password, hash) {
  const [salt, stored] = hash.split(":");
  // An unavailable account still performs a full derivation to reduce timing differences.
  const key = await derive(
    password,
    salt || "00000000000000000000000000000000",
    64,
    options,
  );
  const expected = Buffer.from(stored || "", "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}
async function issueSession(db, userId, res) {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "INSERT INTO ll_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [digest(token), userId],
  );
  res.cookie("ll_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 86400000,
    path: "/",
  });
}
function tokenHash(req) {
  const token = (req.get("cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("ll_session="))
    ?.slice(11);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? digest(token) : null;
}
function auth(db) {
  return async (req, res, next) => {
    const token = tokenHash(req);
    if (!token)
      return res.status(401).json({ error: "Please sign in to continue." });
    const { rows } = await db.query(
      "SELECT u.id,u.name,u.email FROM ll_users u JOIN ll_sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [token],
    );
    if (!rows[0])
      return res
        .status(401)
        .json({ error: "Your session has expired. Please sign in again." });
    req.user = rows[0];
    next();
  };
}
async function rateLimit(db, key, limit) {
  const bucket = Math.floor(Date.now() / 900000);
  const { rows } = await db.query(
    `INSERT INTO ll_rate_limits(key,bucket,attempts) VALUES($1,$2,1)
    ON CONFLICT(key) DO UPDATE SET bucket=$2, attempts=CASE WHEN ll_rate_limits.bucket=$2 THEN ll_rate_limits.attempts+1 ELSE 1 END RETURNING attempts`,
    [digest(key), bucket],
  );
  if (rows[0].attempts > limit) {
    const error = new Error(
      "Too many attempts. Please try again in 15 minutes.",
    );
    error.status = 429;
    throw error;
  }
}
module.exports = {
  hashPassword,
  verifyPassword,
  issueSession,
  tokenHash,
  auth,
  rateLimit,
};
