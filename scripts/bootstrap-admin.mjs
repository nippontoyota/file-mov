import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
for (const url of [process.env.DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
  if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Local setup only");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = await pool.connect();
let userId;
try {
  await sql.query("begin");
  await sql.query("lock table public.staff in access exclusive mode");
  if ((await sql.query("select count(*)::int n from public.staff")).rows[0].n) throw new Error("Staff already exist; bootstrap never replaces an account");
  if (!(await sql.query("select count(*)::int n from public.branches")).rows[0].n) throw new Error("Load the branch catalog first");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const password = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  const { data, error } = await auth.auth.admin.createUser({ email: "admin@filesdigi.local", password, email_confirm: true });
  if (error) throw new Error("Setup login could not be created; existing identities are never overwritten");
  userId = data.user.id;
  await sql.query("insert into public.staff(id,display_name) values($1,'Workspace Administrator')", [userId]);
  await sql.query("insert into public.memberships(staff_id,branch_id,role) select $1,id,'Admin' from public.branches", [userId]);
  mkdirSync(".local", { recursive: true, mode: 0o700 });
  writeFileSync(".local/admin-login.txt", `Email: admin@filesdigi.local\nPassword: ${password}\nLocal setup administrator only.\n`, { mode: 0o600 });
  await sql.query("commit");
  console.log("Local administrator created. Credentials are in .local/admin-login.txt.");
} catch (error) { await sql.query("rollback"); if (userId) await auth.auth.admin.deleteUser(userId); throw error; }
finally { sql.release(); await pool.end(); }
