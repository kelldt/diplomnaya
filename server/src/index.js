import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { query } from "./db.js";
import {
  registerUser,
  requireAdmin,
  requireAuth,
  signToken,
  verifyLogin,
} from "./auth.js";
import { gigachatChat } from "./gigachat.js";
import { linearRegression, zScoreAnomalies } from "./ml.js";

const app = express();

console.log(
  `[ai] gigachat credentials: ${
    config?.gigachat?.credentials ? "loaded" : "missing"
  }, verifySsl: ${config?.gigachat?.verifySsl !== false}`
);

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const cfg = config?.corsOrigin;
  if (!cfg) return true;
  if (cfg === "*") return true;

  if (Array.isArray(cfg)) {
    return cfg.includes(origin);
  }

  if (typeof cfg === "string") {
    if (cfg === origin) return true;
  }

  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch {}

  return false;
}

app.use(
  cors({
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: false
  })
);
app.use(express.json({ limit: "1mb" }));

function resolveStaticRoot() {
  const srcDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [];
  if (process.env.STATIC_ROOT) {
    candidates.push(path.resolve(process.env.STATIC_ROOT));
  }
  candidates.push(path.resolve(srcDir, "..", ".."));
  candidates.push(path.resolve(process.cwd(), ".."));
  candidates.push(path.resolve(process.cwd()));

  const seen = new Set();
  for (const dir of candidates) {
    const norm = path.normalize(dir);
    if (seen.has(norm)) continue;
    seen.add(norm);
    const indexPath = path.join(norm, "index.html");
    try {
      if (fs.existsSync(indexPath)) {
        console.log(`[static] root=${norm}`);
        return norm;
      }
    } catch {}
  }

  const fallback = path.resolve(srcDir, "..", "..");
  console.error(
    `[static] index.html not found — check Render "Root Directory" is EMPTY and the repo contains index.html + src/. Using fallback: ${fallback}`
  );
  return fallback;
}

const staticRoot = resolveStaticRoot();
app.use(express.static(staticRoot));

app.get("/", (_req, res) => {
  res.type("html").send(`
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GeoEco Water API</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;line-height:1.5}
      code{background:#f3f3f3;padding:2px 6px;border-radius:6px}
      ul{padding-left:18px}
    </style>
  </head>
  <body>
    <h2>Сервер запущен</h2>
    <p>API:</p>
    <ul>
      <li><code>GET /api/health</code></li>
      <li><code>GET /api/meta</code></li>
      <li><code>POST /api/auth/register</code></li>
      <li><code>POST /api/auth/login</code></li>
      <li><code>GET /api/auth/me</code></li>
      <li><code>GET /api/auth/dashboard</code></li>
      <li><code>GET /api/admin/overview</code> (admin)</li>
      <li><code>GET /api/admin/feedback</code> (admin)</li>
      <li><code>DELETE /api/admin/feedback/:id</code> (admin)</li>
      <li><code>GET /api/admin/users</code> (admin)</li>
      <li><code>GET /api/admin/monitoring-recent</code> (admin)</li>
      <li><code>GET /api/admin/data-sources</code> (admin)</li>
      <li><code>PATCH /api/admin/data-sources/:id</code> (admin)</li>
      <li><code>GET /api/posts</code></li>
      <li><code>POST /api/feedback</code></li>
      <li><code>GET /api/monitoring/series</code></li>
      <li><code>POST /api/monitoring/import</code> (auth)</li>
      <li><code>GET /api/analytics</code></li>
      <li><code>POST /api/ai/chat</code></li>
    </ul>
    <p>Статика: можно открыть <code>/index.html</code>, <code>/about.html</code> и т.д.</p>
  </body>
</html>
  `.trim());
});

app.get("/api/health", async (_req, res) => {
  const r = await query("select 1 as ok");
  res.json({ ok: true, db: r.rows[0].ok });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "PASSWORD_TOO_SHORT" });
  }

  try {
    const user = await registerUser({ name: String(name), email, password });
    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (e) {
    if (String(e?.message || "").includes("app_user_email_key")) {
      return res.status(409).json({ error: "EMAIL_TAKEN" });
    }
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }
  const user = await verifyLogin({ email, password });
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  const token = signToken(user);
  return res.json({ token, user });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const userId = req.user?.sub;
  const { rows } = await query(
    `select id, name, email, is_admin, created_at from app_user where id = $1`,
    [userId]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json({ user });
});

app.get("/api/auth/dashboard", requireAuth, async (req, res) => {
  const userId = req.user?.sub;
  const userRes = await query(
    `select id, name, email, is_admin, created_at from app_user where id = $1`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });

  const postsRes = await query(`select count(*)::int as c from post`);

  const created = user.created_at ? new Date(user.created_at) : new Date();
  const accountAgeDays = Math.max(
    0,
    Math.floor((Date.now() - created.getTime()) / 86400000)
  );

  res.json({
    user,
    stats: {
      postsInFeed: postsRes.rows[0]?.c ?? 0,
      accountAgeDays,
    },
  });
});

app.get("/api/admin/overview", requireAdmin, async (_req, res) => {
  const [
    users,
    feedback,
    measurements,
    waterBodies,
    metrics,
    sources,
  ] = await Promise.all([
    query(`select count(*)::int as n from app_user`),
    query(`select count(*)::int as n from feedback_message`),
    query(`select count(*)::int as n from measurement`),
    query(`select count(*)::int as n from water_body`),
    query(`select count(*)::int as n from metric`),
    query(`select count(*)::int as n from data_source`),
  ]);

  res.json({
    ok: true,
    counts: {
      users: users.rows[0]?.n ?? 0,
      feedback: feedback.rows[0]?.n ?? 0,
      measurements: measurements.rows[0]?.n ?? 0,
      waterBodies: waterBodies.rows[0]?.n ?? 0,
      metrics: metrics.rows[0]?.n ?? 0,
      dataSources: sources.rows[0]?.n ?? 0,
    },
  });
});

app.get("/api/admin/feedback", requireAdmin, async (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
  const { rows } = await query(
    `
    select id, name, email, message, created_at
    from feedback_message
    order by created_at desc
    limit $1
    `,
    [limit]
  );
  res.json({ items: rows });
});

app.delete("/api/admin/feedback/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }
  const r = await query(`delete from feedback_message where id = $1 returning id`, [id]);
  if (!r.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ ok: true });
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const limit = Math.max(1, Math.min(300, Number(req.query.limit || 100)));
  const { rows } = await query(
    `
    select id, name, email, is_admin, created_at
    from app_user
    order by created_at desc
    limit $1
    `,
    [limit]
  );
  res.json({ items: rows });
});

app.get("/api/admin/monitoring-recent", requireAdmin, async (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 80)));
  const { rows } = await query(
    `
    select
      m.id,
      m.collected_at::text as collected_at,
      m.value,
      wb.name as water_body,
      wb.id as water_body_id,
      met.code as metric_code,
      met.title as metric_title,
      met.unit as metric_unit,
      ds.name as source_name,
      m.method
    from measurement m
    join water_body wb on wb.id = m.water_body_id
    join metric met on met.id = m.metric_id
    left join data_source ds on ds.id = m.source_id
    order by m.collected_at desc, m.id desc
    limit $1
    `,
    [limit]
  );
  res.json({ items: rows });
});

app.get("/api/admin/data-sources", requireAdmin, async (_req, res) => {
  const { rows } = await query(
    `
    select
      ds.id,
      ds.name,
      ds.url,
      ds.notes,
      ds.created_at,
      count(m.id)::int as measurement_count
    from data_source ds
    left join measurement m on m.source_id = ds.id
    group by ds.id
    order by ds.id desc
    limit 200
    `
  );
  res.json({ items: rows });
});

app.patch("/api/admin/data-sources/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }
  if (!req.body || !Object.prototype.hasOwnProperty.call(req.body, "notes")) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }
  const notesRaw = String((req.body || {}).notes ?? "").trim();
  const notes = notesRaw.length ? notesRaw.slice(0, 2000) : null;
  const r = await query(
    `update data_source set notes = $2 where id = $1 returning id, name, url, notes, created_at`,
    [id, notes]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ item: r.rows[0] });
});

app.get("/api/posts", async (_req, res) => {
  const { rows } = await query(
    `select id, title, body, created_at from post order by created_at desc limit 20`
  );
  res.json({ items: rows });
});

app.get("/api/meta", async (_req, res) => {
  const region = "Оренбургская область • Уральский регион";
  const last = await query(`select max(collected_at)::text as d from measurement`);
  const updatedAt = last.rows?.[0]?.d || null;
  const sourcesRes = await query(`select id, name, url from data_source order by id desc limit 20`);
  const wbRes = await query(
    `select id, name, region, kind from water_body order by id asc limit 50`
  );
  const metricsRes = await query(
    `select m.code, m.title, m.unit from metric m order by m.id asc limit 50`
  );

  const countsRes = await query(`
    select meas.water_body_id::text as water_body_id, m.code, count(*)::int as n
    from measurement meas
    join metric m on m.id = meas.metric_id
    group by meas.water_body_id, m.code
    order by n desc
  `);

  const bestRow = countsRes.rows.find((r) => (r.n ?? 0) >= 3) || null;

  const availability = {};
  for (const r of countsRes.rows) {
    const wbId = String(r.water_body_id);
    if (!availability[wbId]) availability[wbId] = {};
    availability[wbId][r.code] = r.n;
  }

  res.json({
    ok: true,
    region,
    updatedAt,
    sources: sourcesRes.rows,
    waterBodies: wbRes.rows,
    metrics: metricsRes.rows,
    availability,
    bestSeries: bestRow
      ? { waterBodyId: bestRow.water_body_id, metricCode: bestRow.code, points: bestRow.n }
      : null
  });
});

app.get("/api/monitoring/series", async (req, res) => {
  const waterBodyId = Number(req.query.waterBodyId);
  const metricCode = String(req.query.metricCode || "").trim();
  if (!Number.isFinite(waterBodyId) || waterBodyId <= 0 || !metricCode) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }
  const mRes = await query(`select id, code, title, unit from metric where code = $1`, [
    metricCode
  ]);
  const metric = mRes.rows[0];
  if (!metric) return res.status(404).json({ error: "METRIC_NOT_FOUND" });

  const wbRes = await query(`select id, name, region, kind from water_body where id = $1`, [
    waterBodyId
  ]);
  const waterBody = wbRes.rows[0];
  if (!waterBody) return res.status(404).json({ error: "WATER_BODY_NOT_FOUND" });

  const rowsRes = await query(
    `
    select collected_at::text as t, value as v
    from measurement
    where water_body_id = $1 and metric_id = $2
    order by collected_at asc
    limit 5000
    `,
    [waterBodyId, metric.id]
  );
  return res.json({ waterBody, metric, items: rowsRes.rows });
});

app.get("/api/analytics", async (req, res) => {
  const waterBodyId = Number(req.query.waterBodyId);
  const metricCode = String(req.query.metricCode || "").trim();
  const horizon = Math.max(1, Math.min(12, Number(req.query.horizon || 1)));
  if (!Number.isFinite(waterBodyId) || waterBodyId <= 0 || !metricCode) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }
  const seriesRes = await query(
    `
    select meas.collected_at::text as t, meas.value as v
    from measurement meas
    join metric m on m.id = meas.metric_id
    where meas.water_body_id = $1 and m.code = $2
    order by meas.collected_at asc
    limit 5000
    `,
    [waterBodyId, metricCode]
  );
  const items = seriesRes.rows.map((r) => ({ t: r.t, v: Number(r.v) }));
  if (items.length < 3) return res.status(400).json({ error: "NOT_ENOUGH_DATA" });

  const xs = items.map((_, i) => i);
  const ys = items.map((p) => p.v);
  const { a, b, r2 } = linearRegression(xs, ys);

  const forecasts = [];
  for (let h = 1; h <= horizon; h++) {
    const x = xs.length - 1 + h;
    forecasts.push({ step: h, v: a * x + b });
  }

  const anomalies = zScoreAnomalies(ys, 2).map((x) => ({
    i: x.i,
    t: items[x.i]?.t,
    z: x.z
  }));

  const slopeDir = a > 0.02 ? "растущий" : a < -0.02 ? "снижающийся" : "стабильный";

  return res.json({
    ok: true,
    method: {
      trend: "linear_regression",
      anomaly: "z_score"
    },
    trend: { a, b, r2, slopeDir },
    forecast: { horizon, items: forecasts },
    anomalies
  });
});

app.post("/api/monitoring/import", requireAuth, async (req, res) => {
  const userId = req.user?.sub;
  const { waterBodyId, metricCode, sourceName, sourceUrl, method, rows } = req.body || {};
  const wbId = Number(waterBodyId);
  const code = String(metricCode || "").trim();
  const srcName = String(sourceName || "").trim().slice(0, 180);
  const srcUrl = sourceUrl ? String(sourceUrl).trim().slice(0, 600) : "";
  const meth = method ? String(method).trim().slice(0, 180) : "";

  if (!Number.isFinite(wbId) || wbId <= 0 || !code || !srcName || !Array.isArray(rows)) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }

  const wbRes = await query(`select id from water_body where id = $1`, [wbId]);
  if (!wbRes.rows[0]) return res.status(404).json({ error: "WATER_BODY_NOT_FOUND" });

  const mRes = await query(`select id from metric where code = $1`, [code]);
  const metric = mRes.rows[0];
  if (!metric) return res.status(404).json({ error: "METRIC_NOT_FOUND" });

  let sourceId = null;
  const srcIns = await query(
    `
    insert into data_source (name, url)
    values ($1, $2)
    returning id
    `,
    [srcName, srcUrl || null]
  ).catch(() => null);
  if (srcIns?.rows?.[0]?.id) sourceId = srcIns.rows[0].id;

  let inserted = 0;
  for (const r of rows.slice(0, 5000)) {
    const t = String(r?.collectedAt || r?.t || "").trim();
    const v = Number(r?.value ?? r?.v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) continue;
    if (!Number.isFinite(v)) continue;
    try {
      await query(
        `
        insert into measurement (water_body_id, metric_id, collected_at, value, source_id, method, created_by_user_id)
        values ($1, $2, $3::date, $4, $5, $6, $7)
        on conflict (water_body_id, metric_id, collected_at)
        do update set value = excluded.value, source_id = excluded.source_id, method = excluded.method
        `,
        [wbId, metric.id, t, v, sourceId, meth || null, userId || null]
      );
      inserted += 1;
    } catch {}
  }

  return res.status(201).json({ ok: true, inserted });
});

app.post("/api/feedback", async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }
  const nm = String(name).trim().slice(0, 120);
  const em = String(email).trim().toLowerCase().slice(0, 180);
  const msg = String(message).trim().slice(0, 4000);
  if (!nm || !em || !msg) return res.status(400).json({ error: "BAD_REQUEST" });

  try {
    await query(
      `insert into feedback_message (name, email, message) values ($1, $2, $3)`,
      [nm, em, msg]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("[feedback] failed", e);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  const { message, messages, pagePath } = req.body || {};

  const hasMessages = Array.isArray(messages) && messages.length > 0;
  const hasSingle =
    typeof message === "string" && String(message).trim().length > 0;

  if (!hasMessages && !hasSingle) {
    return res.status(400).json({ error: "BAD_REQUEST" });
  }

  try {
    const r = await gigachatChat({
      message: hasSingle ? String(message) : "",
      messages: hasMessages ? messages : undefined,
      pagePath: typeof pagePath === "string" ? pagePath : undefined,
    });
    return res.json({ content: r.content });
  } catch (e) {
    if (e?.code === "GIGACHAT_NOT_CONFIGURED") {
      return res.status(503).json({ error: "AI_NOT_CONFIGURED" });
    }
    console.error("[ai] gigachat error", e);
    return res.status(502).json({ error: "AI_UPSTREAM_ERROR" });
  }
});

const basePort = Number(config.port || 3001);

function listenWithFallback(startPort, maxTries = 10) {
  let port = startPort;
  let tries = 0;

  const server = app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });

  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE" && tries < maxTries) {
      tries += 1;
      port += 1;
      console.log(`[server] port ${port - 1} busy, trying ${port}...`);
      server.close(() => listenWithFallback(port, maxTries - tries));
      return;
    }
    console.error("[server] failed to start", err);
    process.exit(1);
  });
}

listenWithFallback(basePort);

