// T-02/T-19/T-22/T-23 foundation: real local PostgreSQL, Auth, REST and Storage.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const dbUrl = process.env.DATABASE_URL;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
for (const url of [dbUrl, apiUrl]) {
  if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Tests only run on local synthetic environments");
}
const pool = new Pool({ connectionString: dbUrl });
const id = n => `d3000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const member = n => `d4000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const branch = n => `d1000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const api = () => createClient(apiUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const adminAuth = createClient(apiUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
async function actor(client, who, role = "authenticated") {
  await client.query(`set local role ${role}`);
  await client.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)", [who || "", JSON.stringify({ sub: who, role })]);
}
async function denied(client, sql, params = [], code = "42501") {
  await client.query("savepoint denied");
  await assert.rejects(client.query(sql, params), e => e.code === code);
  await client.query("rollback to savepoint denied"); checks++;
}
async function login(email) {
  const client = api();
  const result = await client.auth.signInWithPassword({ email, password: "Local-demo-only-2026!" });
  assert.ifError(result.error); return client;
}
const sql = await pool.connect();
try {
  await sql.query("begin");
  // Normalize only within this rolled-back test transaction, so this suite is repeatable.
  await sql.query("truncate private.command_results, public.audit_events");
  await sql.query("update public.memberships set active=true, revision=1 where staff_id::text like 'd3000000-%'");
  await actor(sql, id(2));
  check((await sql.query("select * from public.branches")).rows.length === 1, "SO sees one branch");
  check((await sql.query("select * from public.teams")).rows.length === 1, "SO sees only assigned team");
  check((await sql.query("select * from public.staff")).rows.length === 1, "SO cannot list coworkers");
  check((await sql.query("select count(*)::int n from public.memberships")).rows[0].n === 1, "Counts respect RLS");
  check((await sql.query("select * from public.memberships m join public.branches b on b.id=m.branch_id")).rows.length === 1, "Joins respect RLS");
  await denied(sql, "update public.memberships set role='Admin' where staff_id=$1", [id(2)]);
  await denied(sql, "select * from private.command_results");
  await denied(sql, "select public.set_membership_active($1,$2,1,false,'attack')", [randomUUID(), member(3)]);
  await denied(sql, "select public.create_staff_invitation($1,$2,'SM','attack@example.test','Attack',null)", [randomUUID(), branch(1)]);
  await actor(sql, null, "anon");
  await denied(sql, "select * from public.branches");
  await denied(sql, "select public.accept_staff_invitation($1)", [randomUUID()]);
  await actor(sql, id(1));
  const visible = (await sql.query("select branch_id from public.memberships")).rows;
  check(visible.length >= 11 && visible.every(m => m.branch_id === branch(1)), "Branch admin cannot see other branch");
  await denied(sql, "select public.set_membership_active($1,$2,1,false,'cross branch')", [randomUUID(), member(13)]);
  await denied(sql, "select public.set_membership_active($1,$2,1,false,'self')", [randomUUID(), member(1)]);
  await denied(sql, "select public.create_staff_invitation($1,$2,'Admin','elevate@example.test','Elevate',null)", [randomUUID(), branch(1)], "22023");
  await denied(sql, "select public.create_staff_invitation($1,$2,'SO','mismatch@example.test','Mismatch',$3)", [randomUUID(), branch(1), "d2000000-0000-0000-0000-000000000003"], "23503");
  const operation = randomUUID();
  await sql.query("select public.set_membership_active($1,$2,1,false,'test deactivation')", [operation, member(2)]);
  await sql.query("select public.set_membership_active($1,$2,1,false,'test deactivation')", [operation, member(2)]);
  check((await sql.query("select count(*)::int n from public.audit_events where target_id=$1", [member(2)])).rows[0].n === 1, "Retry records one event");
  await denied(sql, "select public.set_membership_active($1,$2,1,true,'changed payload')", [operation, member(2)], "22023");
  await denied(sql, "select public.set_membership_active($1,$2,1,true,'stale')", [randomUUID(), member(2)], "40001");
  await denied(sql, "delete from public.audit_events");
  await denied(sql, "update public.audit_events set action='forged'");
  await actor(sql, id(2));
  check((await sql.query("select * from public.branches")).rows.length === 0, "Existing identity loses branch access after revocation");
  check((await sql.query("select * from public.teams")).rows.length === 0, "Revoked membership loses team access");
  await sql.query("reset role");
  await sql.query("update public.staff set active=false where id=$1", [id(2)]);
  await actor(sql, id(2));
  check((await sql.query("select * from public.staff")).rows.length === 0, "Inactive profile has no reads");
  await sql.query("rollback");

  // Inject a failure after the state write; the command must leave no state/history/result.
  await sql.query("begin");
  await sql.query("truncate private.command_results, public.audit_events");
  await sql.query("update public.memberships set active=true, revision=1 where staff_id::text like 'd3000000-%'");
  await sql.query("create function private.test_fail() returns trigger language plpgsql as $$begin raise exception 'injected' using errcode='P0001'; end$$");
  await sql.query("create trigger test_fail before insert on public.audit_events for each row execute function private.test_fail()");
  await actor(sql, id(1));
  await denied(sql, "select public.set_membership_active($1,$2,1,false,'injected')", [randomUUID(), member(2)], "P0001");
  check((await sql.query("select active,revision from public.memberships where id=$1", [member(2)])).rows[0].revision === 1, "Failure rolls back state");
  await sql.query("reset role");
  check((await sql.query("select count(*)::int n from private.command_results")).rows[0].n === 0, "Failure rolls back operation result");
  await sql.query("rollback");

  // Race identical operation IDs through separate real transactions.
  const op = randomUUID();
  const connections = await Promise.all([pool.connect(), pool.connect()]);
  const inviteSql = "select public.create_staff_invitation($1,$2,'Security',$3,'Concurrent synthetic',null) id";
  const args = [op, branch(1), `race-${op}@example.test`];
  const results = await Promise.all(connections.map(async c => {
    try { await c.query("begin"); await actor(c, id(1)); const result = await c.query(inviteSql, args); await c.query("commit"); return result.rows[0].id; }
    catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
  }));
  check(results[0] === results[1], "Concurrent retries return the same result");
  check((await pool.query("select count(*)::int n from public.audit_events where target_id=$1", [results[0]])).rows[0].n === 1, "Concurrent retries create one audit event");

  // Real HTTP/JWT checks, not substitutes for PostgreSQL permission tests above.
  const [so, south, admin, security] = await Promise.all([login("so2@example.test"), login("so13@example.test"), login("admin1@example.test"), login("security10@example.test")]);
  const anon = api();
  const signup = await anon.auth.signUp({ email: `signup-${randomUUID()}@example.test`, password: "Public-signup-must-fail!" });
  check(Boolean(signup.error), "Public signup disabled");
  check((await so.from("branches").select("name")).data?.[0]?.name === "Demo North", "North HTTP scope");
  check((await south.from("branches").select("name")).data?.[0]?.name === "Demo South", "South HTTP scope");
  check((await security.from("staff_invitations").select("*")).data?.length === 0, "Security cannot access invitation details");
  check(Boolean((await so.rpc("set_membership_active", { p_operation: randomUUID(), p_membership: member(3), p_revision: 1, p_active: false, p_reason: "attack" })).error), "Hostile direct RPC rejected");
  check(Boolean((await so.from("memberships").update({ role: "Admin" }).eq("staff_id", id(2))).error), "HTTP self-escalation rejected");
  const key = `${randomUUID()}/synthetic.txt`;
  assert.ifError((await adminAuth.storage.from("booking-documents").upload(key, "synthetic storage fixture", { contentType: "text/plain" })).error);
  try {
    for (const client of [anon, so, admin, security]) {
      check(Boolean((await client.storage.from("booking-documents").download(key)).error), "Unauthorized object download rejected");
      check(Boolean((await client.storage.from("booking-documents").upload(`${randomUUID()}.txt`, "denied")).error), "Unreserved upload rejected");
      check(Boolean((await client.storage.from("booking-documents").createSignedUrl(key, 60)).error), "Unauthorized signed URL rejected");
      check(Boolean((await client.storage.from("booking-documents").update(key, "forged")).error), "Overwrite rejected");
      await client.storage.from("booking-documents").remove([key]);
      check(!(await adminAuth.storage.from("booking-documents").download(key)).error, "Unauthorized delete leaves original intact");
      const listed = await client.storage.from("booking-documents").list();
      check(Boolean(listed.error) || listed.data?.length === 0, "Object listing does not leak names");
    }
  } finally { await adminAuth.storage.from("booking-documents").remove([key]); }

  // Revocation applies to an already-issued JWT; restore via a new audited command.
  const before = await admin.from("memberships").select("revision").eq("id", member(2)).single();
  assert.ifError(before.error);
  assert.ifError((await admin.rpc("set_membership_active", { p_operation: randomUUID(), p_membership: member(2), p_revision: before.data.revision, p_active: false, p_reason: "Synthetic HTTP revocation test" })).error);
  try {
    check((await so.from("branches").select("id")).data?.length === 0, "Old JWT loses access immediately");
  } finally {
    assert.ifError((await admin.rpc("set_membership_active", { p_operation: randomUUID(), p_membership: member(2), p_revision: before.data.revision + 1, p_active: true, p_reason: "Restore synthetic assignment" })).error);
  }
  // Two different reviewers race the same revision: one change, one stale rejection.
  const concurrentRevision = (await admin.from("memberships").select("revision").eq("id", member(10)).single()).data.revision;
  const races = await Promise.all([0, 1].map(() => admin.rpc("set_membership_active", {
    p_operation: randomUUID(), p_membership: member(10), p_revision: concurrentRevision,
    p_active: false, p_reason: "Synthetic competing updates",
  })));
  try {
    check(races.filter(r => !r.error).length === 1 && races.filter(r => r.error?.code === "40001").length === 1, "Competing revisions yield one success and one stale failure");
  } finally {
    assert.ifError((await admin.rpc("set_membership_active", { p_operation: randomUUID(), p_membership: member(10), p_revision: concurrentRevision + 1, p_active: true, p_reason: "Restore synthetic assignment" })).error);
  }

  const email = `invited-${randomUUID()}@example.test`;
  const invitation = await admin.rpc("create_staff_invitation", { p_operation: randomUUID(), p_branch: branch(1), p_role: "BO", p_email: email, p_name: "Synthetic invitee" });
  assert.ifError(invitation.error);
  check(Boolean((await south.rpc("accept_staff_invitation", { p_invitation: invitation.data })).error), "Another identity cannot accept the invitation");
  const link = await adminAuth.auth.admin.generateLink({ type: "invite", email });
  assert.ifError(link.error);
  const invitee = api();
  assert.ifError((await invitee.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "invite" })).error);
  check((await invitee.from("branches").select("id")).data?.length === 0, "Confirmed Auth identity alone has no staff scope");
  assert.ifError((await invitee.rpc("accept_staff_invitation", { p_invitation: invitation.data })).error);
  assert.ifError((await invitee.rpc("accept_staff_invitation", { p_invitation: invitation.data })).error);
  check((await invitee.from("memberships").select("id")).data?.length === 1, "Accepting twice creates exactly one assignment");
  check((await invitee.from("branches").select("name")).data?.[0]?.name === "Demo North", "Accepted invite receives only approved branch");
  assert.ifError((await invitee.auth.updateUser({ password: "Synthetic-new-password-2026!" })).error);
  const signedIn = await api().auth.signInWithPassword({ email, password: "Synthetic-new-password-2026!" });
  assert.ifError(signedIn.error);
  const recovery = await adminAuth.auth.admin.generateLink({ type: "recovery", email });
  assert.ifError(recovery.error);
  const recovered = api();
  assert.ifError((await recovered.auth.verifyOtp({ type: "recovery", token_hash: recovery.data.properties.hashed_token })).error);
  assert.ifError((await recovered.auth.updateUser({ password: "Synthetic-reset-password-2026!" })).error);
  check(Boolean((await api().auth.signInWithPassword({ email, password: "Synthetic-reset-password-2026!" })).data.user), "Recovered identity can sign in with new password");
  console.log(`Passed ${checks} local database/Auth/REST/Storage foundation checks.`);
} finally {
  await sql.query("rollback"); sql.release(); await pool.end();
}
