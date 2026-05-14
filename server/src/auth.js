import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { query } from "./db.js";

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      admin: !!user.is_admin,
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

export async function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  const userId = payload?.sub;
  const { rows } = await query(`select id, is_admin from app_user where id = $1`, [userId]);
  const row = rows[0];
  if (!row) return res.status(401).json({ error: "UNAUTHORIZED" });
  if (!row.is_admin) return res.status(403).json({ error: "FORBIDDEN" });

  req.user = payload;
  return next();
}

export async function registerUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `
    insert into app_user (name, email, password_hash)
    values ($1, $2, $3)
    returning id, name, email, is_admin, created_at
    `,
    [name, email.toLowerCase(), passwordHash]
  );
  return rows[0];
}

export async function verifyLogin({ email, password }) {
  const { rows } = await query(
    `select id, name, email, password_hash, is_admin from app_user where email = $1`,
    [email.toLowerCase()]
  );
  const user = rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, name: user.name, email: user.email, is_admin: !!user.is_admin };
}
