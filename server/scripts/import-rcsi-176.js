import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, pool } from "../src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCsvSemicolon(text) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const strip = (v) => {
    const s = String(v ?? "").trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      return s.slice(1, -1).replaceAll('""', '"').trim();
    }
    return s;
  };

  const header = lines[0].split(";").map((s) => strip(s));
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const cols = row.split(";");
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = strip(cols[j]);
    out.push(obj);
  }
  return out;
}

function norm(s) {
  return String(s || "").trim();
}

function toNumber(s) {
  const v = Number(String(s || "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

function indicatorToMetricCode(ind) {
  const s = norm(ind).toLowerCase();
  if (!s) return null;
  if (s.includes("нитрат")) return "nitrates";
  if (s.includes("нитрит")) return "nitrites";
  if (s.includes("аммоний")) return "ammonium";
  if (s.includes("бпк5") || s.includes("бпк 5") || s.includes("bod")) return "bod5";
  if (s.includes("водородный показатель") || s === "ph" || s.includes("(ph)"))
    return "ph";
  if (s.includes("нефть") || s.includes("нефтепродукт")) return "oil";
  if (s === "медь") return "copper";
  if (s === "цинк") return "zinc";
  if (s === "марганец") return "manganese";
  if (s === "мышьяк") return "arsenic";
  return null;
}

async function ensureSource({ name, url }) {
  const nm = norm(name).slice(0, 180);
  const u = url ? norm(url).slice(0, 600) : null;
  const { rows } = await query(
    `insert into data_source (name, url) values ($1, $2) returning id`,
    [nm, u]
  );
  return rows[0].id;
}

async function ensureWaterBody({ name, region, kind = "river" }) {
  const nm = norm(name).slice(0, 180);
  const reg = norm(region).slice(0, 180) || "Оренбургская область • Уральский регион";
  const existing = await query(
    `select id from water_body where name = $1 and region = $2 order by id asc limit 1`,
    [nm, reg]
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const { rows } = await query(
    `insert into water_body (name, region, kind) values ($1, $2, $3) returning id`,
    [nm, reg, kind]
  );
  return rows[0].id;
}

async function getMetricId(code) {
  const { rows } = await query(`select id from metric where code = $1`, [code]);
  return rows[0]?.id ?? null;
}

async function upsertMeasurement({
  waterBodyId,
  metricId,
  collectedAt,
  value,
  sourceId,
  method,
}) {
  await query(
    `
    insert into measurement (water_body_id, metric_id, collected_at, value, source_id, method)
    values ($1, $2, $3::date, $4, $5, $6)
    on conflict (water_body_id, metric_id, collected_at)
    do update set value = excluded.value, source_id = excluded.source_id, method = excluded.method
    `,
    [waterBodyId, metricId, collectedAt, value, sourceId, method || null]
  );
}

async function main() {
  const dataDir = path.resolve(__dirname, "..", "data", "rcsi-176");
  const extremePath = path.join(dataDir, "extreme_pollution.csv");
  const highPath = path.join(dataDir, "high_pollution.csv");

  if (!fs.existsSync(extremePath) || !fs.existsSync(highPath)) {
    throw new Error(
      `Missing CSV files. Put dataset files into ${dataDir} (extreme_pollution.csv, high_pollution.csv).`
    );
  }

  const sourceId = await ensureSource({
    name:
      "ИНИД/RCSI: «Загрязнение поверхностных вод в России: ежемесячные данные о высоком и экстремально высоком загрязнении (2008–2021)»",
    url: "https://data.rcsi.science/data-catalog/datasets/176/",
  });

  const region = "Оренбургская область • Уральский регион";
  const wbId = await ensureWaterBody({
    name: "р. Урал (сводка Росгидромет: high/extreme pollution, 2008–2021)",
    region,
    kind: "river",
  });

  const textExtreme = fs.readFileSync(extremePath, "utf8");
  const rowsExtreme = parseCsvSemicolon(textExtreme);

  const allowedIndicators = new Set([
    "nitrates",
    "nitrites",
    "ammonium",
    "ph",
    "bod5",
    "oil",
    "copper",
    "zinc",
    "manganese",
    "arsenic",
  ]);
  const metricIds = {};
  for (const code of allowedIndicators) {
    metricIds[code] = await getMetricId(code);
    if (!metricIds[code]) throw new Error(`Metric ${code} is not in DB. Run db:init.`);
  }

  let inserted = 0;
  let skipped = 0;

  for (const r of rowsExtreme) {
    const subject = norm(r.subject);
    if (subject !== "Оренбургская область") continue;

    const metricCode = indicatorToMetricCode(r.indicator);
    if (!metricCode || !allowedIndicators.has(metricCode)) continue;

    const collectedAt = norm(r.period).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(collectedAt)) {
      skipped += 1;
      continue;
    }

    const v = toNumber(r.value_max) ?? toNumber(r.value_min);
    if (v == null) {
      skipped += 1;
      continue;
    }

    const unit = norm(r.unit);
    const unitLower = unit.toLowerCase();
    if (metricCode === "ph" && unitLower !== "ph") continue;
    if (metricCode !== "ph" && unitLower !== "мг/л" && unitLower !== "пдк") continue;

    await upsertMeasurement({
      waterBodyId: wbId,
      metricId: metricIds[metricCode],
      collectedAt,
      value: v,
      sourceId,
      method: `RCSI/Росгидромет monthly extreme pollution; unit=${unit}`,
    });
    inserted += 1;
  }

  console.log(`[import-rcsi-176] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[import-rcsi-176] failed", e);
    process.exit(1);
  })
  .finally(() => pool.end());

