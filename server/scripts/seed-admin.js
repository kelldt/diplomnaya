import bcrypt from "bcryptjs";
import { query, pool } from "../src/db.js";

const email = String(process.env.ADMIN_EMAIL || "admin@geoeco.local").toLowerCase().trim();
const password = String(process.env.ADMIN_PASSWORD || "AdminGeoEco2026!");
const name = String(process.env.ADMIN_NAME || "Администратор").trim() || "Администратор";

if (password.length < 6) {
  console.error("[seed-admin] ADMIN_PASSWORD must be at least 6 characters");
  process.exit(1);
}

async function main() {
  await query(
    `alter table app_user add column if not exists is_admin boolean not null default false`
  );

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `
    insert into app_user (name, email, password_hash, is_admin)
    values ($1, $2, $3, true)
    on conflict (email) do update set
      name = excluded.name,
      password_hash = excluded.password_hash,
      is_admin = true
    returning id, email
    `,
    [name, email, passwordHash]
  );

  const u = rows[0];
  console.log("[seed-admin] ok", { id: u.id, email: u.email });
  console.log(
    "[seed-admin] Вход: email =",
    email,
    "| задайте свой пароль через ADMIN_PASSWORD при повторном запуске"
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[seed-admin] failed", e);
    process.exit(1);
  })
  .finally(() => pool.end());
