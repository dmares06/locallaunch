const { DateTime } = require("luxon");
async function seedDemo(pool) {
  const user = (
    await pool.query(
      "INSERT INTO ll_users(name,email,password_hash) VALUES('Demo owner','demo@locallaunch.invalid','disabled') ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING id",
    )
  ).rows[0];
  const business = (
    await pool.query(
      `INSERT INTO ll_businesses(owner_id,name,slug,category,city,description,phone,timezone,published,is_demo)
    VALUES($1,'The Sunday Standard','the-sunday-standard','Barber & grooming','Brooklyn, NY','Good cuts. Good company. A neighborhood barbershop for the way you want to look and feel. Come as you are; leave a little sharper.','(718) 555-0142','America/New_York',true,true)
    ON CONFLICT(owner_id) DO UPDATE SET is_demo=true RETURNING *`,
      [user.id],
    )
  ).rows[0];
  if (
    !(
      await pool.query(
        "SELECT id FROM ll_services WHERE business_id=$1 LIMIT 1",
        [business.id],
      )
    ).rowCount
  ) {
    for (const [name, duration, price, description] of [
      [
        "The Standard Cut",
        45,
        4500,
        "A thoughtful cut, a clean finish, and a little time for yourself.",
      ],
      [
        "Cut & Beard",
        60,
        6500,
        "Your usual, elevated. A full cut and tailored beard shaping.",
      ],
      [
        "The Quick Refresh",
        30,
        3000,
        "A tidy-up around the edges. Back to your day, looking your best.",
      ],
    ])
      await pool.query(
        "INSERT INTO ll_services(business_id,name,duration_minutes,price_cents,description) VALUES($1,$2,$3,$4,$5)",
        [business.id, name, duration, price, description],
      );
  }
  for (let day = 1; day <= 6; day++)
    await pool.query(
      "INSERT INTO ll_hours(business_id,day,open_minute,close_minute) VALUES($1,$2,540,1080) ON CONFLICT DO NOTHING",
      [business.id, day],
    );
  if (
    !(
      await pool.query(
        "SELECT id FROM ll_bookings WHERE business_id=$1 LIMIT 1",
        [business.id],
      )
    ).rowCount
  ) {
    const services = (
      await pool.query(
        "SELECT * FROM ll_services WHERE business_id=$1 ORDER BY id",
        [business.id],
      )
    ).rows;
    let date = DateTime.now()
      .setZone(business.timezone)
      .plus({ days: 1 })
      .startOf("day");
    if (date.weekday === 7) date = date.plus({ days: 1 });
    for (const [i, name] of [
      "Alex Morgan",
      "Jordan Lee",
      "Taylor Brooks",
      "Sam Rivera",
    ].entries()) {
      const service = services[i % services.length],
        start = date.set({ hour: 9 + i * 2 });
      await pool.query(
        `INSERT INTO ll_bookings(business_id,service_id,service_name,price_cents,customer_name,customer_email,starts_at,ends_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          business.id,
          service.id,
          service.name,
          service.price_cents,
          name,
          `sample-${i}@example.com`,
          start.toISO(),
          start.plus({ minutes: service.duration_minutes }).toISO(),
        ],
      );
    }
  }
}
module.exports = { seedDemo };
