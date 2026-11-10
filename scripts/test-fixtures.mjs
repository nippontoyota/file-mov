import { Pool } from "pg";
import { readFileSync } from "node:fs";

// Fixtures exist only for a test run, in separate IDs/branches. Never reset the
// workspace or change the setup administrator to make a test pass.
export async function installFixtures() {
  for (const value of [process.env.DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!value || !["127.0.0.1", "localhost"].includes(new URL(value).hostname)) throw new Error("Fixtures require local services");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = await pool.connect();
  const existingCustomers = new Set((await sql.query('select customer_id from public.customers')).rows.map(r=>r.customer_id));
  const fixtureBranches = ['d1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000002'];
  try {
    const { rows: [lock] } = await sql.query("select pg_try_advisory_lock(1729348) as acquired");
    if (!lock.acquired) throw new Error("Another fixture suite is running; run suites sequentially");
    const { rows: [existing] } = await sql.query("select (select count(*) from public.branches where id=any($1::uuid[]))::int branches,(select count(*) from auth.users where email=any($2::text[]))::int users", [fixtureBranches, ["admin1@example.test","so2@example.test","tl3@example.test","sm4@example.test","bo5@example.test","insurance6@example.test","accounts7@example.test","cashier8@example.test","accessories9@example.test","security10@example.test","so11@example.test","admin12@example.test","so13@example.test"]]);
    if (existing.branches || existing.users) throw new Error("Fixture IDs/emails already exist; refusing to overwrite them");
    await sql.query("begin");
    await sql.query(readFileSync("tests/fixtures/identity.sql", "utf8"));
    await sql.query("commit");
  } catch (error) { await sql.query("rollback"); sql.release(); await pool.end(); throw error; }
  return async () => {
    try {
      await sql.query("begin");
      const { rows } = await sql.query("select u.id from auth.users u where (u.id::text like 'd3000000-%' or (u.email like '%@example.test' and u.email in (select email from public.staff_invitations where branch_id=any($1::uuid[])))) and not exists(select 1 from public.memberships m where m.staff_id=u.id and m.branch_id<>all($1::uuid[]))", [fixtureBranches]);
      const users = rows.map(row => row.id);
      const fixtureCustomers = (await sql.query("select distinct nullif(btrim(v.data->>'customer_code'),'') customer_id from public.booking_versions v join public.bookings b on b.id=v.booking_id where b.branch_id=any($1::uuid[])", [fixtureBranches])).rows.map(r=>r.customer_id).filter(id=>id && !existingCustomers.has(id));
      await sql.query("delete from public.booking_versions where booking_id in (select id from public.bookings where branch_id=any($1::uuid[]))", [fixtureBranches]);
      await sql.query("delete from public.bookings where branch_id=any($1::uuid[])", [fixtureBranches]);
      await sql.query("delete from public.customers c where customer_id=any($1::text[]) and not exists(select 1 from public.bookings b where b.customer_id=c.customer_id) and not exists(select 1 from public.booking_versions v where nullif(btrim(v.data->>'customer_code'),'')=c.customer_id)", [fixtureCustomers]);
      await sql.query("delete from private.command_results where actor_id=any($1::uuid[])", [users]);
      await sql.query("delete from public.audit_events where branch_id=any($1::uuid[])", [fixtureBranches]);
      await sql.query("delete from public.staff_invitations where branch_id=any($1::uuid[])", [fixtureBranches]);
      await sql.query("delete from public.memberships where branch_id=any($1::uuid[])", [fixtureBranches]);
      await sql.query("delete from public.staff where id=any($1::uuid[])", [users]);
      await sql.query("delete from public.teams where branch_id=any($1::uuid[])", [fixtureBranches]);
      await sql.query("delete from public.branches where id=any($1::uuid[])", [fixtureBranches]);
      await sql.query("delete from auth.users where id=any($1::uuid[])", [users]);
      await sql.query("commit");
      console.log("Temporary fixture accounts and records removed.");
    } catch (error) { await sql.query("rollback"); throw error; }
    finally { await sql.query("select pg_advisory_unlock(1729348)"); sql.release(); await pool.end(); }
  };
}
