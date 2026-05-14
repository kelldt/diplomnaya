import { query, pool } from "../src/db.js";

async function main() {
  const wb = await query(`select id, name from water_body order by id`);
  const m = await query(`select id, code, title from metric order by id`);
  const counts = await query(`
    select w.id as water_body_id, w.name as water_body, met.code, count(*)::int as n
    from measurement meas
    join water_body w on w.id = meas.water_body_id
    join metric met on met.id = meas.metric_id
    group by w.id, w.name, met.code
    order by n desc
  `);
  console.log(JSON.stringify({ waterBodies: wb.rows, metrics: m.rows.length, counts: counts.rows }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());

