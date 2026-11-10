import assert from 'node:assert/strict';
import { randomUUID,createHash,createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
const client=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const pool=new Pool({connectionString:process.env.DATABASE_URL});let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const ok=r=>{assert.ifError(r.error);return r.data;};
async function login(email){const c=client();ok(await c.auth.signInWithPassword({email,password:'Local-demo-only-2026!'}));return c;}
const scope='d4000000-0000-0000-0000-000000000002';
try{
 const so=await login('so2@example.test'),tl=await login('tl3@example.test'),sm=await login('sm4@example.test'),other=await login('so13@example.test'),admin=await login('admin1@example.test'),bo=await login('bo5@example.test');
 const data={customer_code:`DOC-${randomUUID()}`,customer_name:'Synthetic booking person',booking_number:'DOC-TEST',booking_date:'2026-11-10',enquiry_number:'SYN-ENQ',communication_address:'Synthetic address',contact_person:'Synthetic contact',pin:'682001',model:'Innova HyCross',suffix_1:'Synthetic suffix',colour_1:'White',registration_same:'no',registration_name:'Separate synthetic owner',registration_address:'Synthetic owner address',registration_pin:'682002'};
 const save={p_operation:randomUUID(),p_membership:scope,p_data:data,p_confirmed:true};
 const id=ok(await so.rpc('save_booking_draft',save));
 let revision=1;
 const pdf=Buffer.from('%PDF-1.4\n% Synthetic test document only\n%%EOF\n');
 const hash=createHash('sha256').update(pdf).digest('hex');
 const secret=(await pool.query('select secret from private.document_verifier')).rows[0].secret;
 const proof=id=>createHmac('sha256',secret).update(`${id}:${hash}`).digest('hex');
 const reserve=kind=>({p_operation:randomUUID(),p_booking:id,p_revision:revision,p_kind:kind,p_filename:'synthetic.pdf',p_mime:'application/pdf',p_size:pdf.length,p_sha256:hash});
 const send=()=>({p_operation:randomUUID(),p_booking:id,p_revision:revision});
 check((await so.rpc('send_booking_to_tl',send())).error?.code==='22023','Missing documents block send');
 const args=reserve('aadhaar');const aadhaar=ok(await so.rpc('reserve_booking_document',args));
 check(ok(await so.rpc('reserve_booking_document',args))===aadhaar,'Reserve retry deduplicates');
 check((await so.rpc('reserve_booking_document',{...args,p_filename:'changed.pdf'})).error?.code==='22023','Changed retry rejected');
 check((await tl.from('booking_documents').select('id').eq('id',aadhaar)).data.length===0,'Pending upload hidden from TL');
 for(const c of [tl,sm,other,admin,bo,client()])check(Boolean((await c.rpc('reserve_booking_document',{...args,p_operation:randomUUID()})).error),'Non-owner cannot reserve');
 check((await so.rpc('finalize_booking_document',{p_document:aadhaar,p_revision:revision,p_attestation:proof(aadhaar)})).error?.code==='22023','Missing object cannot finalize even with proof');
 ok(await so.storage.from('booking-documents').upload(aadhaar,pdf,{contentType:'application/pdf',upsert:false}));
 check(Boolean((await so.storage.from('booking-documents').upload(aadhaar,pdf,{contentType:'application/pdf',upsert:true})).error),'Object overwrite denied');
 check((await so.rpc('finalize_booking_document',{p_document:aadhaar,p_revision:revision,p_attestation:'forged'})).error?.code==='22023','Direct forged finalize denied');
 check((await so.rpc('finalize_booking_document',{p_document:aadhaar,p_revision:revision+1,p_attestation:proof(aadhaar)})).error?.code==='40001','Stale finalize denied');
 ok(await so.rpc('finalize_booking_document',{p_document:aadhaar,p_revision:revision,p_attestation:proof(aadhaar)}));revision++;
 ok(await so.rpc('finalize_booking_document',{p_document:aadhaar,p_revision:revision-1,p_attestation:proof(aadhaar)}));
 check(ok(await so.from('bookings').select('revision').eq('id',id).single()).revision===revision,'Finalize retry does not create another version');
 check(ok(await so.from('booking_versions').select('document_ids').eq('booking_id',id).eq('revision',revision).single()).document_ids[0]===aadhaar,'File version includes immutable document ID');
 check((await so.rpc('send_booking_to_tl',send())).error?.code==='22023','Only one required document still blocks send');
 for(const c of [so,tl,sm]) {const blob=ok(await c.storage.from('booking-documents').download(aadhaar));check(createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex')===hash,'Scoped file download preserves bytes');}
 for(const c of [other,admin,bo,client()])check(Boolean((await c.storage.from('booking-documents').download(aadhaar)).error),'Unauthorized storage read denied');
 check(Boolean((await so.storage.from('booking-documents').createSignedUrl(aadhaar,60)).error),'Reusable signed URL creation denied');
 check(!ok(await so.storage.from('booking-documents').list()).length,'Bucket listing cannot enumerate documents');
 ok(await tl.rpc('record_document_download',{p_document:aadhaar}));
 check((await pool.query("select count(*)::int n from public.audit_events where target_id=$1 and action='document.downloaded'",[aadhaar])).rows[0].n===1,'Download audit attributed');
 const pan=ok(await so.rpc('reserve_booking_document',reserve('pan')));ok(await so.storage.from('booking-documents').upload(pan,pdf,{contentType:'application/pdf'}));
 // Inject an audit failure directly in PostgreSQL to verify all finalize writes roll back.
 const sql=await pool.connect();try{
  await sql.query('begin');await sql.query("create function private.test_doc_failure() returns trigger language plpgsql as $$begin raise exception 'injected' using errcode='P0001'; end$$");await sql.query('create trigger test_doc_failure before insert on public.audit_events for each row execute function private.test_doc_failure()');
  await sql.query('set local role authenticated');await sql.query("select set_config('request.jwt.claim.sub','d3000000-0000-0000-0000-000000000002',true)");await sql.query('savepoint attempted');
  await assert.rejects(sql.query('select public.finalize_booking_document($1,$2,$3)',[pan,revision,proof(pan)]),e=>e.code==='P0001');checks++;await sql.query('rollback to savepoint attempted');await sql.query('reset role');
  check((await sql.query('select status from public.booking_documents where id=$1',[pan])).rows[0].status==='pending','Failed audit rolls back ready status');
  check((await sql.query('select revision from public.bookings where id=$1',[id])).rows[0].revision===revision,'Failed audit rolls back file revision');
 }finally{await sql.query('rollback');sql.release();}
 ok(await so.rpc('finalize_booking_document',{p_document:pan,p_revision:revision,p_attestation:proof(pan)}));revision++;
 for(const field of ['customer_code','booking_number','booking_date','enquiry_number','customer_name','communication_address','contact_person','pin','model','suffix_1','colour_1']){
  ok(await so.rpc('save_booking_draft',{...save,p_operation:randomUUID(),p_booking:id,p_revision:revision,p_data:{...data,[field]:''}}));revision++;
  check((await so.rpc('send_booking_to_tl',send())).error?.code==='22023',`${field} mandatory before send`);
 }
 ok(await so.rpc('save_booking_draft',{...save,p_operation:randomUUID(),p_booking:id,p_revision:revision,p_data:{...data,registration_name:'Changed owner'}}));revision++;
 check((await so.rpc('send_booking_to_tl',send())).error?.code==='22023','Owner change invalidates attached copies for send');
 ok(await so.rpc('save_booking_draft',{...save,p_operation:randomUUID(),p_booking:id,p_revision:revision}));revision++;
 const pending=ok(await so.rpc('reserve_booking_document',reserve('aadhaar')));
 const m=ok(await admin.from('memberships').select('revision').eq('id',scope).single());
 ok(await admin.rpc('set_membership_active',{p_operation:randomUUID(),p_membership:scope,p_revision:m.revision,p_active:false,p_reason:'Document access test'}));
 check(Boolean((await so.storage.from('booking-documents').download(aadhaar)).error),'Revoked JWT cannot download');
 check(Boolean((await so.storage.from('booking-documents').upload(pending,pdf,{contentType:'application/pdf'})).error),'Revoked JWT cannot upload');
 ok(await admin.rpc('set_membership_active',{p_operation:randomUUID(),p_membership:scope,p_revision:m.revision+1,p_active:true,p_reason:'Restore fixture scope'}));
 for(const c of [tl,sm,other,admin,bo])check((await c.rpc('send_booking_to_tl',send())).error?.code==='42501','Only owning SO can send');
 const command=send();const sent=await Promise.all([so.rpc('send_booking_to_tl',command),so.rpc('send_booking_to_tl',command)]);sent.forEach(ok);revision++;
 check(ok(await so.from('bookings').select('state').eq('id',id).single()).state==='tl_review','File reaches TL review');
 const snapshot=ok(await tl.from('booking_versions').select('data,document_ids').eq('booking_id',id).eq('revision',revision).single());
 check(snapshot.data.registration_name===data.registration_name && snapshot.document_ids.includes(aadhaar) && snapshot.document_ids.includes(pan) && !snapshot.document_ids.includes(pending),'TL receives exact filled data and ready copies, pending excluded');
 check((await pool.query('select count(*)::int n from public.sales_submissions where booking_id=$1',[id])).rows[0].n===1,'Concurrent retry produces one handoff');
 check((await so.rpc('save_booking_draft',{...save,p_operation:randomUUID(),p_booking:id,p_revision:revision})).error?.code==='22023','Submitted file cannot be edited');
 check((await so.rpc('reserve_booking_document',reserve('pan'))).error?.code==='42501','Submitted file cannot accept replacements');
 for(const c of [so,sm,other,admin,bo])check((await c.rpc('receive_sales_file',{p_booking:id,p_revision:revision})).error?.code==='42501','Only assigned TL receives');
 check((await tl.rpc('receive_sales_file',{p_booking:id,p_revision:revision-1})).error?.code==='40001','Stale receipt rejected');
 ok(await tl.rpc('receive_sales_file',{p_booking:id,p_revision:revision}));ok(await tl.rpc('receive_sales_file',{p_booking:id,p_revision:revision}));
 check((await pool.query("select count(*)::int n from public.audit_events where target_id=$1 and action='booking.received_by_tl'",[id])).rows[0].n===1,'Receipt retry recorded once');
 const received=ok(await tl.from('sales_submissions').select('*').eq('booking_id',id).single());
 check(received.requirements_version===1 && received.sender_name==='Demo SO 2' && received.receiver_name==='Demo TL 3','Receipt preserves rule version and actor labels');
 check(ok(await bo.from('bookings').select('id').eq('id',id)).length===0,'TL receipt does not bypass approvals into BO');
 check(Boolean((await so.from('booking_documents').update({status:'ready'}).eq('id',pending)).error),'Direct metadata mutation denied');
 console.log(`Passed ${checks} document, storage, required-field and SO/TL handoff checks.`);
}finally{await pool.end();}
