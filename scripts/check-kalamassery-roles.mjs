// User-requested persistent local role acceptance check. These accounts remain in the DB.
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';

for (const value of [process.env.DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
  if (!value || !['127.0.0.1', 'localhost'].includes(new URL(value).hostname)) throw new Error('Local test workspace only');
}
const branch = 'b1000000-0000-0000-0000-000000000001';
const otherBranch = 'b1000000-0000-0000-0000-000000000002';
const roles = ['Admin', 'SO', 'TL', 'SM', 'BO', 'Insurance', 'Accounts', 'Cashier', 'Accessories', 'Security'];
const roleNames = { Admin: 'Administrator', SO: 'Sales Officer', TL: 'Team Leader', SM: 'Sales Manager', BO: 'Back Office', Insurance: 'Insurance', Accounts: 'Accounts', Cashier: 'Cashier', Accessories: 'Accessories', Security: 'Security' };
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const credentialsPath = '.local/kalamassery-test-accounts.json';
mkdirSync('.local/kalamassery-role-check', { recursive: true, mode: 0o700 });
const saved = existsSync(credentialsPath) ? JSON.parse(readFileSync(credentialsPath, 'utf8')) : { teamOperation: randomUUID(), accounts: {} };
function saveCredentials() {
  writeFileSync(credentialsPath, JSON.stringify(saved, null, 2), { mode: 0o600 });
  chmodSync(credentialsPath, 0o600);
}
for (const role of roles) {
  if (!saved.accounts[role]) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    saved.accounts[role] = { name: `test<${role}, Kalamassery>`, email: `test.${role.toLowerCase()}.kalamassery@example.test`, password: Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''), operation: randomUUID() };
  }
}
saveCredentials();
async function login(account) {
  const c = client();
  const result = await c.auth.signInWithPassword({ email: account.email, password: account.password });
  if (result.error) throw new Error(`Test login failed for ${account.name || 'setup administrator'}`);
  return c;
}
async function ensureAuth(account, invitation) {
  let user = (await pool.query("select id, raw_app_meta_data from auth.users where email=$1", [account.email])).rows[0];
  if (user) {
    assert.equal(user.raw_app_meta_data.filesdigi_test_suite, 'kalamassery-roles', 'Existing unrelated account must not be adopted');
    if (invitation) assert.equal(user.raw_app_meta_data.filesdigi_invitation, invitation);
  } else {
    const result = await auth.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true,
      app_metadata: { filesdigi_test_suite: 'kalamassery-roles', ...(invitation ? { filesdigi_invitation: invitation } : {}) } });
    assert.ifError(result.error);
    user = result.data.user;
  }
  account.id = user.id;
  saveCredentials();
  return user.id;
}
const results = { date: new Date().toISOString(), branch: 'Kalamassery (Showroom & Service Centre)', roles: [], checks: [], workflow: [] };
async function check(role, name, task) {
  try { await task(); results.checks.push({ role, name, status: 'passed' }); }
  catch (error) { results.checks.push({ role, name, status: 'failed', detail: error.message.slice(0, 700) }); }
}
let browser;
try {
  const scope = (await pool.query('select name from public.branches where id=$1', [branch])).rows[0];
  assert.match(scope?.name || '', /^Kalamassery/);
  const ownerText = readFileSync('.local/admin-login.txt', 'utf8');
  const owner = await login({ email: ownerText.match(/Email: (.+)/)[1], password: ownerText.match(/Password: (.+)/)[1] });
  const { data: { user: ownerUser } } = await owner.auth.getUser();
  // Admin creation uses the existing controlled setup boundary, not a new UI privilege grant.
  const adminId = await ensureAuth(saved.accounts.Admin);
  const sql = await pool.connect();
  try {
    await sql.query('begin');
    const permitted = await sql.query("select 1 from public.memberships m join public.staff s on s.id=m.staff_id where m.staff_id=$1 and m.branch_id=$2 and m.role='Admin' and m.active and s.active for share of m,s", [ownerUser.id, branch]);
    assert.equal(permitted.rowCount > 0, true);
    const existing = await sql.query('select id from public.staff where id=$1', [adminId]);
    if (!existing.rowCount) {
      await sql.query('insert into public.staff(id,display_name) values($1,$2)', [adminId, saved.accounts.Admin.name]);
      const membership = await sql.query("insert into public.memberships(staff_id,branch_id,role) values($1,$2,'Admin') returning id", [adminId, branch]);
      await sql.query("insert into public.audit_events(branch_id,actor_id,action,target_id,revision,reason) values($1,$2,'staff.test_admin_provisioned',$3,1,'User-requested persistent Kalamassery role test setup')", [branch, ownerUser.id, membership.rows[0].id]);
    }
    await sql.query('commit');
  } catch (error) { await sql.query('rollback'); throw error; }
  finally { sql.release(); }
  const admin = await login(saved.accounts.Admin);
  const team = await admin.rpc('create_staff_team', { p_operation: saved.teamOperation, p_branch: branch, p_name: 'test<Kalamassery team>' });
  assert.ifError(team.error);
  saved.team = team.data;
  saveCredentials();
  for (const role of roles.filter(r => r !== 'Admin')) {
    const account = saved.accounts[role];
    const request = await admin.rpc('create_staff_invitation', { p_operation: account.operation, p_branch: branch, p_team: ['SO','TL'].includes(role) ? saved.team : undefined, p_role: role, p_email: account.email, p_name: account.name });
    assert.ifError(request.error);
    await ensureAuth(account, request.data);
    const completed = await admin.rpc('complete_staff_account', { p_invitation: request.data });
    assert.ifError(completed.error);
    assert.equal(completed.data, account.id);
  }
  const loginText = roles.map(role => {
    const a = saved.accounts[role];
    return `${a.name}\nEmail: ${a.email}\nPassword: ${a.password}\n`;
  }).join('\n');
  writeFileSync('.local/kalamassery-test-logins.txt', `Persistent local test accounts. Branch: ${results.branch}\n\n${loginText}`, { mode: 0o600 });
  chmodSync('.local/kalamassery-test-logins.txt', 0o600);
  console.log('10 persistent test accounts are ready in Kalamassery. Credentials saved privately.');
  browser = await chromium.launch();
  for (const role of roles) {
    const account = saved.accounts[role];
    const c = await login(account);
    const observed = { role, displayName: account.name, email: account.email, userId: account.id, visibleTools: [] };
    results.roles.push(observed);
    await check(role, 'Exactly one active membership in Kalamassery', async () => {
      const m = await c.from('memberships').select('id,branch_id,team_id,role,active').eq('staff_id', account.id);
      assert.ifError(m.error); assert.equal(m.data.length, 1); assert.equal(m.data[0].branch_id, branch); assert.equal(m.data[0].role, role); assert.equal(m.data[0].active, true);
      assert.equal(m.data[0].team_id, ['SO','TL'].includes(role) ? saved.team : null);
    });
    await check(role, 'Other branch metadata is hidden by RLS', async () => {
      const own = await c.from('branches').select('id'); assert.ifError(own.error); assert.deepEqual(own.data.map(b => b.id), [branch]);
      const other = await c.from('branches').select('id').eq('id', otherBranch); assert.ifError(other.error); assert.equal(other.data.length, 0);
    });
    await check(role, 'Direct role escalation is denied', async () => {
      const attempted = await c.from('memberships').update({ role: 'Admin' }).eq('staff_id', account.id);
      assert.equal(attempted.error?.code, '42501');
    });
    await check(role, 'Team command rejects unauthorized scope', async () => {
      const attempted = await c.rpc('create_staff_team', { p_operation: randomUUID(), p_branch: role === 'Admin' ? otherBranch : branch, p_name: 'Unauthorized role-test team' });
      assert.equal(attempted.error?.code, '42501');
    });
    await check(role, 'Document upload remains denied before workflow implementation', async () => {
      const path = `kalamassery-role-test/${randomUUID()}.txt`;
      const attempted = await c.storage.from('booking-documents').upload(path, Buffer.from('Synthetic role check'), { contentType: 'text/plain', upsert: false });
      if (!attempted.error) { await auth.storage.from('booking-documents').remove([path]); throw new Error('Unexpected document write permission'); }
      assert.match(String(attempted.error.message), /row.level security|not authorized|permission|unauthorized/i);
    });
    for (const [device, width, height] of [['desktop',1440,900], ['phone',390,844]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      await check(role, `${device}: login, own role, navigation, access and logout`, async () => {
        await page.goto('http://127.0.0.1:3000/login');
        await page.getByLabel('Email', { exact: true }).fill(account.email);
        await page.getByLabel('Password', { exact: true }).fill(account.password);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await page.getByRole('heading', { name: `Welcome, ${account.name}.`, exact: true }).waitFor();
        const region = page.getByRole('region', { name: 'My assignments', exact: true });
        assert.equal(await region.getByRole('heading', { name: roleNames[role], exact: true }).count(), 1);
        assert.equal(await region.getByText(results.branch, { exact: true }).count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (device === 'phone') await page.getByRole('button', { name: 'Open navigation' }).click();
        const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
        const disabled = await nav.locator('[aria-disabled=true]').allTextContents();
        observed.visibleTools = disabled.map(text => text.trim());
        assert.equal(disabled.length > 0, true);
        assert.equal(await nav.getByRole('link', { name: 'Staff access', exact: true }).count(), role === 'Admin' ? 1 : 0);
        await nav.getByRole('link', { name: /My assignments/ }).click();
        await page.waitForURL('**/workspace#assignments');
        assert.equal(await page.getByRole('dialog').isVisible(), false);
        await page.screenshot({ path: `.local/kalamassery-role-check/${role.toLowerCase()}-${device}.png`, fullPage: true });
        await page.goto('http://127.0.0.1:3000/staff');
        if (role === 'Admin') {
          await page.getByRole('heading', { name: 'Staff access', exact: true }).waitFor();
          assert.equal(await page.getByRole('combobox', { name: 'Branch', exact: true }).inputValue(), results.branch);
          assert.equal(await page.locator('#staff-assignments details').filter({ hasText: 'test<' }).count(), 10);
        } else { await page.waitForURL('**/workspace'); }
        if (device === 'phone') await page.getByRole('button', { name: 'Open navigation' }).click();
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        await page.waitForURL('**/login');
        await page.goto('http://127.0.0.1:3000/workspace');
        await page.waitForURL('**/login');
      });
      await context.close();
    }
    console.log(`${role}: checks recorded.`);
  }
  // Revoke and restore only the user's designated dummy SO; keep the same active JWT.
  const so = await login(saved.accounts.SO);
  const m = (await admin.from('memberships').select('id,revision').eq('staff_id', saved.accounts.SO.id).single()).data;
  let deactivated = false;
  try {
    await check('SO', 'Revocation rejects an already signed-in session', async () => {
      const r = await admin.rpc('set_membership_active', { p_operation: randomUUID(), p_membership: m.id, p_revision: m.revision, p_active: false, p_reason: 'Persistent Kalamassery role test: verify revoked access' });
      assert.ifError(r.error); deactivated = true;
      const reads = await so.from('branches').select('id'); assert.ifError(reads.error); assert.equal(reads.data.length, 0);
    });
  } finally {
    if (deactivated) {
      const r = await admin.rpc('set_membership_active', { p_operation: randomUUID(), p_membership: m.id, p_revision: m.revision + 1, p_active: true, p_reason: 'Persistent Kalamassery role test complete: retain active test account' });
      assert.ifError(r.error);
    }
  }
  const tables = (await pool.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r => r.tablename);
  results.databaseTables = tables;
  for (const [flow, requirement] of [
    ['SO booking file and document preparation', 'Booking, document versions, signatures and original-custody records'],
    ['SO to TL review', 'Submission command and team review inbox'],
    ['TL to SM review', 'Sequential approval commands and immutable review history'],
    ['SM-approved file to BO receipt', 'Approved-file handoff and explicit BO acknowledgment'],
    ['BO to Insurance and return before invoicing', 'Insurance work and policy evidence'],
    ['BO to Accounts, Cashier and registration', 'Invoice, tax, FASTag and receipt tracking'],
    ['Accessories partial work and SO to BO to Accounts bills', 'Pending items, bills, required signatures and financial closure'],
    ['Accounts to Security to Accounts archive', 'Gate pass, delivery, original return and archive receipt'],
  ]) {
    const draftAvailable = flow === 'SO booking file and document preparation' && tables.includes('bookings') && tables.includes('booking_versions');
    const documentsAvailable=draftAvailable && tables.includes('booking_documents');
    const submissionAvailable=flow==='SO to TL review' && tables.includes('sales_submissions');
    results.workflow.push({ flow, status: draftAvailable || submissionAvailable ? 'partially_implemented' : 'not_implemented',
      missing: submissionAvailable ? 'TL approval, signatures and return/rework' : documentsAvailable ? 'Signatures and physical-original custody' : draftAvailable ? 'Document versions, signatures, original custody and submission gates' : requirement,
      evidence: submissionAvailable ? 'Submission schema exists; dedicated document/browser suites exercise send and receipt. This role checker does not execute that journey.' : documentsAvailable ? 'Draft and document schemas exist; dedicated tests exercise their gates. Later departmental handoffs remain unavailable.' : draftAvailable ? 'Saved booking drafts and immutable save history are available.' : 'No command or enabled screen for this operational stage.' });
  }
  results.retained = (await pool.query("select s.display_name,m.role,m.active,b.name branch from public.staff s join public.memberships m on m.staff_id=s.id join public.branches b on b.id=m.branch_id where s.id=any($1::uuid[]) order by m.role", [roles.map(r=>saved.accounts[r].id)])).rows;
  assert.equal(results.retained.length, 10);
  assert.equal(results.retained.every(r=>r.active && r.branch===results.branch), true);
  results.audit = (await pool.query("select action,count(*)::int count from public.audit_events where actor_id=any($1::uuid[]) or target_id in (select id from public.memberships where staff_id=any($1::uuid[])) group by action order by action", [roles.map(r=>saved.accounts[r].id)])).rows;
  results.summary = { passed: results.checks.filter(r=>r.status==='passed').length, failed: results.checks.filter(r=>r.status==='failed').length, workflowNotImplemented: results.workflow.filter(r=>r.status==='not_implemented').length, workflowPartial: results.workflow.filter(r=>r.status==='partially_implemented').length, retainedAccounts: results.retained.length };
  console.log(JSON.stringify(results.summary));
  if (results.summary.failed) process.exitCode = 1;
} finally {
  writeFileSync('.local/kalamassery-role-check/results.json', JSON.stringify(results, null, 2), { mode: 0o600 });
  await browser?.close();
  await pool.end();
}
