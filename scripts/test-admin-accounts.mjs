import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const api = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const branch = "d1000000-0000-0000-0000-000000000001";
const otherBranch = "d1000000-0000-0000-0000-000000000002";
async function login(email) { const c = api(); assert.ifError((await c.auth.signInWithPassword({ email, password: "Local-demo-only-2026!" })).error); return c; }
async function request(admin, email) {
  const r = await admin.rpc("create_staff_invitation", { p_operation: randomUUID(), p_branch: branch, p_role: "BO", p_email: email, p_name: "Account fixture" });
  assert.ifError(r.error); return r.data;
}
try {
  const admin = await login("admin1@example.test");
  const so = await login("so2@example.test");
  const south = await login("admin12@example.test");
  const email = `account-${randomUUID()}@example.test`;
  const invite = await request(admin, email);
  const params = { p_invitation: invite };
  check(Boolean((await admin.rpc("complete_staff_account", params)).error), "No assignment without prepared Auth identity");
  const created = await auth.auth.admin.createUser({ email, password: "Ab4X9q", email_confirm: true, app_metadata: { filesdigi_invitation: invite } });
  assert.ifError(created.error);
  check(Boolean((await so.rpc("complete_staff_account", params)).error), "Non-admin denied");
  check(Boolean((await south.rpc("complete_staff_account", params)).error), "Other branch admin denied");
  check(Boolean((await api().rpc("complete_staff_account", params)).error), "Anonymous denied");
  check(Boolean((await auth.rpc("complete_staff_account", params)).error), "Service role cannot grant application access");
  const concurrent = await Promise.all([admin.rpc("complete_staff_account", params), admin.rpc("complete_staff_account", params)]);
  concurrent.forEach(r => assert.ifError(r.error));
  check(concurrent[0].data === concurrent[1].data, "Concurrent completion retries share one account");
  const userId = created.data.user.id;
  const m = (await pool.query("select id,revision from public.memberships where staff_id=$1", [userId])).rows;
  check(m.length === 1, "Exactly one membership created");
  check((await pool.query("select count(*)::int n from public.audit_events where target_id=$1 and action='staff.account_created'", [m[0].id])).rows[0].n === 1, "Exactly one attributed completion event");
  check(!(await api().auth.signInWithPassword({ email, password: "Ab4X9q" })).error, "Admin preset six-character password signs in");
  assert.ifError((await admin.rpc("set_membership_active", { p_operation: randomUUID(), p_membership: m[0].id, p_revision: m[0].revision, p_active: false, p_reason: "End account fixture" })).error);
  assert.ifError((await admin.rpc("complete_staff_account", params)).error);
  check(!(await pool.query("select active from public.memberships where id=$1", [m[0].id])).rows[0].active, "Completion retries never reactivate revoked scope");

  const unrelated = await request(admin, "so2@example.test");
  check(Boolean((await admin.rpc("complete_staff_account", { p_invitation: unrelated })).error), "Existing identities cannot be claimed by matching email alone");
  const op = randomUUID();
  const teamArgs = { p_operation: op, p_branch: branch, p_name: `Test team ${op}` };
  check(Boolean((await so.rpc("create_staff_team", teamArgs)).error), "Non-admin team creation denied");
  check(Boolean((await admin.rpc("create_staff_team", { ...teamArgs, p_branch: otherBranch })).error), "Team creation outside branch denied");
  const first = await admin.rpc("create_staff_team", teamArgs); assert.ifError(first.error);
  const again = await admin.rpc("create_staff_team", teamArgs); assert.ifError(again.error);
  check(first.data === again.data, "Team retry deduplicated");
  check(Boolean((await admin.rpc("create_staff_team", { ...teamArgs, p_name: "Changed" })).error), "Changed team retry rejected");
  check(Boolean((await admin.rpc("create_staff_team", { ...teamArgs, p_operation: randomUUID() })).error), "Duplicate team rejected");

  const failEmail = `rollback-${randomUUID()}@example.test`;
  const failInvite = await request(admin, failEmail);
  const failUser = await auth.auth.admin.createUser({ email: failEmail, password: "Ab4X9q", email_confirm: true, app_metadata: { filesdigi_invitation: failInvite } });
  assert.ifError(failUser.error);
  const sql = await pool.connect();
  try {
    await sql.query("begin");
    await sql.query("create function private.test_account_failure() returns trigger language plpgsql as $$begin raise exception 'injected' using errcode='P0001'; end$$");
    await sql.query("create trigger test_account_failure before insert on public.audit_events for each row execute function private.test_account_failure()");
    await sql.query("set local role authenticated");
    await sql.query("select set_config('request.jwt.claim.sub','d3000000-0000-0000-0000-000000000001',true)");
    await sql.query("savepoint attempt");
    await assert.rejects(sql.query("select public.complete_staff_account($1)", [failInvite]), e => e.code === "P0001"); checks++;
    await sql.query("rollback to savepoint attempt");
    await sql.query("reset role");
    check((await sql.query("select count(*)::int n from public.staff where id=$1", [failUser.data.user.id])).rows[0].n === 0, "Audit failure rolls back profile and membership");
    check((await sql.query("select accepted_at from public.staff_invitations where id=$1", [failInvite])).rows[0].accepted_at === null, "Audit failure leaves account request pending");
    await sql.query("rollback");
    await sql.query("begin; set local role authenticated; savepoint private_read");
    await assert.rejects(sql.query("select private.provisioned_identity($1)", [failInvite]), e => e.code === "42501"); checks++;
    await sql.query("rollback");
  } finally { await sql.query("rollback"); sql.release(); }
  const recorded = (await pool.query("select input::text from private.command_results where actor_id='d3000000-0000-0000-0000-000000000001'")).rows;
  check(recorded.every(row => !row.input.includes("Ab4X9q")), "Command history contains no passwords");
  console.log(`Passed ${checks} admin account/team permission, retry, rollback and credential checks.`);
} finally { await pool.end(); }
