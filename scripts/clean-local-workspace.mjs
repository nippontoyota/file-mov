// One-time, user-authorized retirement of the original demo workspace.
// Refuses a hosted database, any non-demo identity, or stored document objects.
import { Pool } from "pg";
import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
const url = new URL(process.env.DATABASE_URL || "");
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Local workspace only");
const pool = new Pool({ connectionString: url.href });
const sql = await pool.connect();
try {
  const { rows: [check] } = await sql.query("select (select count(*) from auth.users where email not like '%@example.test')::int unexpected,(select count(*) from storage.objects)::int objects");
  if (check.unexpected || check.objects) throw new Error("Non-demo identities or stored objects present; cleanup refused");
  const admin = (await sql.query("select id from auth.users where email='admin1@example.test'")).rows[0];
  if (!admin) throw new Error("Expected bootstrap administrator is missing");
  if (!process.env.PG_DUMP_PATH) throw new Error("Set PG_DUMP_PATH to the local pg_dump executable");
  mkdirSync(".local/backups", { recursive: true, mode: 0o700 });
  const backup = `.local/backups/before-demo-cleanup-${Date.now()}.dump`;
  execFileSync(process.env.PG_DUMP_PATH, ["--format=custom", `--file=${backup}`], { env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port, PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1) }, stdio: ["ignore", "ignore", "pipe"] });
  chmodSync(backup, 0o600);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const password = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  await sql.query("begin");
  await sql.query("lock table public.staff,public.memberships,public.staff_invitations,public.branches,public.teams,public.audit_events,private.command_results in access exclusive mode");
  await sql.query("delete from private.command_results; delete from public.audit_events; delete from public.staff_invitations; delete from public.memberships; delete from public.teams; delete from public.staff; delete from public.branches");
  await sql.query("delete from auth.users where id<>$1", [admin.id]);
  await sql.query("delete from auth.sessions where user_id=$1", [admin.id]);
  await sql.query("delete from auth.refresh_tokens where user_id=$1", [admin.id]);
  await sql.query("delete from auth.audit_log_entries");
  await sql.query("update auth.users set email='admin@filesdigi.local',encrypted_password=extensions.crypt($1,extensions.gen_salt('bf')),raw_user_meta_data='{}',email_confirmed_at=now(),updated_at=now() where id=$2", [password, admin.id]);
  await sql.query("update auth.identities set identity_data=jsonb_build_object('sub',$1::text,'email','admin@filesdigi.local','email_verified',true),updated_at=now() where user_id=$1", [admin.id]);
  await sql.query("insert into public.staff(id,display_name) values($1,'Workspace Administrator')", [admin.id]);
  await sql.query(readFileSync("supabase/seed.sql", "utf8"));
  await sql.query("insert into public.memberships(staff_id,branch_id,role) select $1,id,'Admin' from public.branches", [admin.id]);
  // Record the new credential before commit; never print it into application logs.
  writeFileSync(".local/admin-login.txt", `Email: admin@filesdigi.local\nPassword: ${password}\nLocal setup administrator only.\n`, { mode: 0o600 });
  await sql.query("commit");
  console.log(`Demo records removed; 20 catalog locations and one setup administrator retained. Backup: ${backup}. Login saved in .local/admin-login.txt.`);
} catch (error) { await sql.query("rollback"); throw error; }
finally { sql.release(); await pool.end(); }
