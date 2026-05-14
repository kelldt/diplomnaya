import { query, pool } from "../src/db.js";

const schemaSql = `
create table if not exists app_user (
  id bigserial primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists post (
  id bigserial primary key,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists feedback_message (
  id bigserial primary key,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists data_source (
  id bigserial primary key,
  name text not null,
  url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists water_body (
  id bigserial primary key,
  name text not null,
  region text not null,
  kind text not null default 'river',
  lat double precision,
  lon double precision,
  created_at timestamptz not null default now()
);

create table if not exists metric (
  id bigserial primary key,
  code text not null unique,
  title text not null,
  unit text not null,
  created_at timestamptz not null default now()
);

create table if not exists measurement (
  id bigserial primary key,
  water_body_id bigint not null references water_body(id) on delete cascade,
  metric_id bigint not null references metric(id) on delete cascade,
  collected_at date not null,
  value double precision not null,
  source_id bigint references data_source(id) on delete set null,
  method text,
  created_by_user_id bigint references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (water_body_id, metric_id, collected_at)
);

create index if not exists measurement_water_metric_date_idx
  on measurement (water_body_id, metric_id, collected_at desc);
`;

const seedPostsSql = `
insert into post (title, body)
values
  ('Старт', 'В базе есть тестовая запись. Дальше сюда можно добавлять материалы и статистику.'),
  ('Геоэкология', 'Нагрузка → перенос → аккумуляция. Вода — интегратор процессов в бассейне.');
`;

const seedMetricsSql = `
insert into metric (code, title, unit)
values
  ('nitrates', 'Нитраты (NO₃⁻)', 'мг/л'),
  ('nitrites', 'Нитрит-ионы (NO₂⁻)', 'ПДК'),
  ('ammonium', 'Аммоний-ион (NH₄⁺)', 'ПДК'),
  ('ph', 'pH', 'ед.'),
  ('bod5', 'БПК₅', 'мгО₂/л'),
  ('oil', 'Нефтепродукты', 'ПДК'),
  ('copper', 'Медь', 'ПДК'),
  ('zinc', 'Цинк', 'ПДК'),
  ('manganese', 'Марганец', 'ПДК'),
  ('arsenic', 'Мышьяк', 'ПДК')
on conflict (code) do nothing;
`;

const seedWaterBodiesSql = `
insert into water_body (name, region, kind, lat, lon)
values
  ('Урал (участок 1)', 'Оренбургская область • Уральский регион', 'river', 51.767, 55.100),
  ('Сакмара (участок 1)', 'Оренбургская область • Уральский регион', 'river', 51.800, 55.050)
;
`;

async function main() {
  await query(schemaSql);

  await query(
    `alter table app_user add column if not exists is_admin boolean not null default false`
  );

  const existingPosts = await query(`select count(*)::int as n from post`);
  if (existingPosts.rows[0].n === 0) {
    await query(seedPostsSql);
    console.log("[db:init] seeded posts");
  } else {
    console.log("[db:init] posts already exist, skipping seed");
  }

  await query(seedMetricsSql);
  const existingWb = await query(`select count(*)::int as n from water_body`);
  if (existingWb.rows[0].n === 0) {
    await query(seedWaterBodiesSql);
    console.log("[db:init] seeded water bodies");
  }
  console.log("[db:init] ensured monitoring catalog");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[db:init] failed", e);
    process.exit(1);
  })
  .finally(() => pool.end());

