import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
const options={auth:{persistSession:false,autoRefreshToken:false}};
const client=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
const pool=new Pool({connectionString:process.env.DATABASE_URL});
let checks=0;
function check(value,label){assert.ok(value,label);checks++;}
async function login(email){const c=client();assert.ifError((await c.auth.signInWithPassword({email,password:'Local-demo-only-2026!'})).error);return c;}
const scope='d4000000-0000-0000-0000-000000000002';
const fields={customer_name:'Synthetic booking customer',booking_number:'SYN-BOOK-01',communication_address:'Synthetic address',model:'Innova HyCross',suffix_1:'Synthetic preference A',suffix_2:'Synthetic preference B',colour_1:'White',colour_2:'Silver',booking_date:'2026-11-10'};
try {
 const so=await login('so2@example.test');const tl=await login('tl3@example.test');const sm=await login('sm4@example.test');const admin=await login('admin1@example.test');
 const otherSo=await login('so11@example.test');const south=await login('so13@example.test');const bo=await login('bo5@example.test');
 const args={p_operation:randomUUID(),p_membership:scope,p_data:fields,p_confirmed:true};
 check((await client().rpc('save_booking_draft',args)).error?.code==='42501','Anonymous create denied');
 const service=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
 check(Boolean((await service.rpc('save_booking_draft',args)).error),'Service role cannot create business drafts');
 check((await admin.rpc('save_booking_draft',args)).error?.code==='42501','Admin cannot impersonate SO');
 check((await so.rpc('save_booking_draft',{...args,p_membership:'d4000000-0000-0000-0000-000000000013'})).error?.code==='42501','SO cannot create for another branch or identity');
 check((await so.rpc('save_booking_draft',{...args,p_confirmed:false})).error?.code==='22023','Enquiry-only work is not silently booked');
 for(const invalid of [{approval:'SM approved'}, {customer_name:123}, {customer_name:'x'.repeat(201)}, {booking_date:'2026-02-30'}, {gst_billing:'maybe'}, {registration_type:'other'}, {registration_name:'Unapproved section'}]) {
  check((await so.rpc('save_booking_draft',{...args,p_data:invalid})).error?.code==='22023','Reject malformed data or fields outside this section');
 }
 const concurrent=await Promise.all([so.rpc('save_booking_draft',args),so.rpc('save_booking_draft',args)]);
 concurrent.forEach(r=>assert.ifError(r.error));const id=concurrent[0].data;
 check(id===concurrent[1].data,'Concurrent create retry deduplicates');
 check((await pool.query('select count(*)::int n from public.booking_versions where booking_id=$1',[id])).rows[0].n===1,'One initial immutable version');
 check((await pool.query('select count(*)::int n from public.audit_events where target_id=$1',[id])).rows[0].n===1,'One atomic creation audit event');
 const own=await so.from('bookings').select('*').eq('id',id).single();assert.ifError(own.error);
 check(own.data.so_id==='d3000000-0000-0000-0000-000000000002' && own.data.state==='draft','Actor and draft state derived by database');
 check(own.data.data.suffix_2===fields.suffix_2 && own.data.data.colour_2===fields.colour_2,'Source preference fields preserved separately');
 for(const [c,label,count] of [[so,'own SO',1],[tl,'own TL',1],[sm,'branch SM',1],[otherSo,'other SO',0],[south,'other branch',0],[admin,'technical admin',0],[bo,'BO before handover',0]]) {
  const r=await c.from('bookings').select('id',{count:'exact'}).eq('id',id);assert.ifError(r.error);check(r.data.length===count && r.count===count,`Scoped reads and counts: ${label}`);
  const v=await c.from('booking_versions').select('revision').eq('booking_id',id);assert.ifError(v.error);check(v.data.length===count,`Scoped history: ${label}`);
 }
 await pool.query("insert into public.memberships(staff_id,branch_id,team_id,role) values('d3000000-0000-0000-0000-000000000011','d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000001','SO')");
 check((await otherSo.from('bookings').select('id').eq('id',id)).data.length===0,'Even another SO in same team cannot read assigned booking');
 const edit={...args,p_operation:randomUUID(),p_booking:id,p_revision:1,p_data:{...fields,special_request:'Synthetic change'}};
 check((await tl.rpc('save_booking_draft',edit)).error?.code==='42501','TL cannot edit an SO draft');
 check((await sm.rpc('save_booking_draft',edit)).error?.code==='42501','SM cannot edit an SO draft');
 check((await otherSo.rpc('save_booking_draft',{...edit,p_membership:'d4000000-0000-0000-0000-000000000011'})).error?.code==='42501','Other SO cannot edit draft through own valid scope');
 assert.ifError((await so.rpc('save_booking_draft',edit)).error);checks++;
 assert.ifError((await so.rpc('save_booking_draft',edit)).error);checks++;
 check((await so.rpc('save_booking_draft',{...edit,p_data:{customer_name:'Changed retry'}})).error?.code==='22023','Changed retry payload rejected');
 check((await so.rpc('save_booking_draft',{...edit,p_operation:randomUUID()})).error?.code==='40001','Stale save rejected');
 const race=await Promise.all([1,2].map(n=>so.rpc('save_booking_draft',{...edit,p_operation:randomUUID(),p_revision:2,p_data:{...fields,special_request:`Race ${n}`}})));
 check(race.filter(r=>!r.error).length===1 && race.filter(r=>r.error?.code==='40001').length===1,'Concurrent saves cannot overwrite same revision');
 const history=await so.from('booking_versions').select('revision,data').eq('booking_id',id).order('revision');assert.ifError(history.error);
 check(history.data.length===3 && history.data[0].data.customer_name===fields.customer_name && !history.data[0].data.special_request,'Prior versions preserved');
 check((await so.from('bookings').update({state:'approved'}).eq('id',id)).error?.code==='42501','No direct approval or state mutation');
 check((await so.from('booking_versions').delete().eq('booking_id',id)).error?.code==='42501','Version deletion denied');
 check((await service.from('bookings').select('id')).error?.code==='42501','No routine service-role reads');
 const sql=await pool.connect();
 try {
  await sql.query('begin');
  await sql.query("create function private.test_booking_failure() returns trigger language plpgsql as $$begin raise exception 'injected' using errcode='P0001'; end$$");
  await sql.query('create trigger test_booking_failure before insert on public.audit_events for each row execute function private.test_booking_failure()');
  await sql.query('set local role authenticated');
  await sql.query("select set_config('request.jwt.claim.sub','d3000000-0000-0000-0000-000000000002',true)");
  await sql.query('savepoint attempted');
  await assert.rejects(sql.query('select public.save_booking_draft($1,$2,$3,true,$4,3)',[randomUUID(),scope,JSON.stringify({customer_name:'Must roll back'}),id]),e=>e.code==='P0001');checks++;
  await sql.query('rollback to savepoint attempted');await sql.query('reset role');
  check((await sql.query('select revision from public.bookings where id=$1',[id])).rows[0].revision===3,'History failure rolls back draft update');
  check((await sql.query('select count(*)::int n from public.booking_versions where booking_id=$1',[id])).rows[0].n===3,'History failure rolls back version insertion');
 }finally{await sql.query('rollback');sql.release();}
 const m=(await admin.from('memberships').select('revision').eq('id',scope).single()).data;
 assert.ifError((await admin.rpc('set_membership_active',{p_operation:randomUUID(),p_membership:scope,p_revision:m.revision,p_active:false,p_reason:'Draft permission test'})).error);
 check((await so.from('bookings').select('id').eq('id',id)).data.length===0,'Existing JWT loses booking reads after scope revocation');
 check((await so.rpc('save_booking_draft',{...edit,p_operation:randomUUID(),p_revision:3})).error?.code==='42501','Existing JWT loses draft writes after revocation');
 assert.ifError((await admin.rpc('set_membership_active',{p_operation:randomUUID(),p_membership:scope,p_revision:m.revision+1,p_active:true,p_reason:'Restore temporary fixture scope'})).error);
 console.log(`Passed ${checks} booking draft scope, validation, version, concurrency and rollback checks.`);
} finally {await pool.end();}
