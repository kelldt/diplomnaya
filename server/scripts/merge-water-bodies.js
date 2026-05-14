import { query, pool } from "../src/db.js";

async function main() {
  const dups = await query(`
    select name, region, array_agg(id order by id asc) as ids, count(*)::int as n
    from water_body
    group by name, region
    having count(*) > 1
    order by n desc, name asc
  `);

  let merged = 0;
  for (const row of dups.rows) {
    const ids = row.ids || [];
    if (ids.length < 2) continue;
    const keep = ids[0];
    const drop = ids.slice(1);

    await query(
      `
      delete from measurement m_drop
      using measurement m_keep
      where m_drop.water_body_id = any($1::bigint[])
        and m_keep.water_body_id = $2
        and m_drop.metric_id = m_keep.metric_id
        and m_drop.collected_at = m_keep.collected_at
      `,
      [drop, keep]
    );

    await query(
      `update measurement set water_body_id = $1 where water_body_id = any($2::bigint[])`,
      [keep, drop]
    );
    await query(`delete from water_body where id = any($1::bigint[])`, [drop]);
    merged += 1;
    console.log(`[merge-water-bodies] merged "${row.name}" keep=${keep} dropped=${drop.join(",")}`);
  }

  console.log(`[merge-water-bodies] done, groups_merged=${merged}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[merge-water-bodies] failed", e);
    process.exit(1);
  })
  .finally(() => pool.end());

