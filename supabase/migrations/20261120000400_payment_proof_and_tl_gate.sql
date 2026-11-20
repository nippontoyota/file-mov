-- Migration: 20261120000400_payment_proof_and_tl_gate.sql
-- Enforces:
-- 1. Cashier can only approve payments after proof document is attached (coalesce(p_proof_document, pay.proof_document_id) is not null).
-- 2. Sales Officer cannot send file to Team Leader (send_booking_to_tl) while any advance payment is unverified.
-- 3. Payment receipt documents can be uploaded by SO (draft) and Cashier (for the branch).

grant create on schema public, private to filesdigi_commands;

-- 1. Document locking: allow SO and Cashier to upload payment_receipt
create or replace function private.lock_booking_for_document(p_booking uuid, p_kind text) returns public.bookings
language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  if p_kind in ('aadhaar','pan') then
    if not private.can_edit_booking(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.role='SO' and m.branch_id=b.branch_id and m.team_id=b.team_id and m.active and s.active for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;
    if b.state<>'draft' then raise exception 'forbidden' using errcode='42501'; end if;

  elsif p_kind in ('form20','disclaimer','vahan_ack') then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.role='BO' and m.branch_id=b.branch_id and m.active and s.active for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;
    if b.state<>'bo_review' then raise exception 'forbidden' using errcode='42501'; end if;

  elsif p_kind = 'payment_receipt' then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active
        and (
          (m.role='SO' and m.team_id=b.team_id and b.so_id=auth.uid() and b.state='draft')
          or (m.role='Cashier')
        ) for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;

  else
    raise exception 'invalid_kind' using errcode='22023';
  end if;
  return b;
end $$;

-- 2. Storage insert policy for payment_receipt
create or replace function private.document_object_insert(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.booking_documents d
    join public.bookings b on b.id = d.booking_id
    join public.memberships m on m.branch_id = b.branch_id and m.staff_id = auth.uid() and m.active
    where d.id::text = p_name and d.status = 'pending' and d.uploaded_by = auth.uid()
      and (
        (b.state = 'draft' and b.so_id = auth.uid() and m.role = 'SO' and m.team_id = b.team_id and d.kind in ('aadhaar','pan'))
        or (b.state = 'bo_review' and m.role = 'BO' and d.kind in ('form20','disclaimer','vahan_ack'))
        or (d.kind = 'payment_receipt' and (
          (b.state = 'draft' and b.so_id = auth.uid() and m.role = 'SO' and m.team_id = b.team_id)
          or (m.role = 'Cashier')
        ))
      )
  )
$$;

-- 3. Stored procedure: verify_booking_payment (strictly requires proof document)
create or replace function public.verify_booking_payment(
  p_operation uuid,
  p_payment_id uuid,
  p_receipt_no text,
  p_proof_document uuid default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  pay public.booking_payments;
  req jsonb;
  saved private.command_results;
  v_receipt text;
  v_proof uuid;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  v_receipt := nullif(btrim(coalesce(p_receipt_no, '')), '');
  if v_receipt is null or length(v_receipt) > 50 then raise exception 'receipt_no_required' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object(
    'command', 'verify_booking_payment',
    'payment_id', p_payment_id,
    'receipt_no', v_receipt,
    'proof_document', p_proof_document
  );

  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if saved.input <> req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;

  select * into pay from public.booking_payments where id=p_payment_id for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Must be Cashier in branch
  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=pay.branch_id and m.role='Cashier' and m.active and s.active for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  if pay.status = 'verified' then return pay.id; end if;

  -- Proof is strictly required before Cashier can verify and issue receipt
  v_proof := coalesce(p_proof_document, pay.proof_document_id);
  if v_proof is null then
    raise exception 'proof_document_required' using errcode='22023';
  end if;

  -- Validate proof document exists, is finalized, and belongs to this booking
  if not exists (
    select 1 from public.booking_documents d
    where d.id = v_proof and d.booking_id = pay.booking_id and d.status = 'ready'
  ) then
    raise exception 'invalid_proof_document' using errcode='22023';
  end if;

  update public.booking_payments set
    status = 'verified',
    receipt_no = v_receipt,
    proof_document_id = v_proof,
    verified_by = auth.uid(),
    verified_at = now(),
    updated_at = now()
  where id = pay.id;

  insert into public.audit_events(branch_id, actor_id, action, target_id, reason)
    values(pay.branch_id, auth.uid(), 'cashier.payment_verified', pay.id, v_receipt);

  insert into private.command_results values(auth.uid(), p_operation, req, pay.id);
  return pay.id;
end $$;

-- 4. Stored procedure: send_booking_to_tl (strictly enforces advance payment verification gate)
create or replace function public.send_booking_to_tl(p_operation uuid,p_booking uuid,p_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings; req jsonb; saved private.command_results; actor_name text;
begin
 if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
 req:=jsonb_build_object('command','send_to_tl','booking',p_booking,'revision',p_revision);
 select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
 if found then
  if not private.can_read_booking_id(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
  if saved.input<>req then raise exception 'operation_reused' using errcode='22023'; end if;
  return saved.result;
 end if;
 b:=private.lock_owned_draft(p_booking);
 if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;
 if exists(select 1 from unnest(array['customer_code','booking_number','booking_date','enquiry_number','customer_name','communication_address','contact_person','pin','model','suffix_1','colour_1']) k where nullif(btrim(b.data->>k),'') is null) then raise exception 'booking_details_required' using errcode='22023'; end if;
 if exists(select 1 from unnest(array['aadhaar','pan']) k where not exists(select 1 from public.booking_documents d where d.booking_id=b.id and d.kind=k and d.status='ready' and d.owner_snapshot=private.registration_subject(b.data) and d.version=(select max(x.version) from public.booking_documents x where x.booking_id=b.id and x.kind=k and x.status='ready'))) then raise exception 'owner_documents_required' using errcode='22023'; end if;

 -- Advance payment verification gate: every payment on this booking must be verified by Cashier with receipt
 if exists(
   select 1 from public.booking_payments
   where booking_id=b.id and status<>'verified'
 ) then
   raise exception 'pending_payment_verification' using errcode='22023';
 end if;

 -- A send needs an active recipient; the queue remains team-scoped, receipt is attributed.
 perform 1 from public.memberships m join public.staff s on s.id=m.staff_id where m.branch_id=b.branch_id and m.team_id=b.team_id and m.role='TL' and m.active and s.active for share of m,s;
 if not found then raise exception 'team_leader_required' using errcode='22023'; end if;
 update public.bookings set state='tl_review',revision=revision+1,updated_at=now() where id=b.id returning * into b;
 select display_name into actor_name from public.staff where id=auth.uid();
 insert into public.booking_versions(booking_id,revision,data,actor_id,actor_name,form_version) values(b.id,b.revision,b.data,auth.uid(),actor_name,b.form_version);
 insert into public.sales_submissions(booking_id,file_revision,sent_by) values(b.id,b.revision,auth.uid());
 insert into public.audit_events(branch_id,actor_id,action,target_id,revision) values(b.branch_id,auth.uid(),'booking.sent_to_tl',b.id,b.revision);
 insert into private.command_results values(auth.uid(),p_operation,req,b.id);
 return b.id;
end $$;

-- 5. Ownership & Permissions
alter function private.lock_booking_for_document(uuid, text) owner to filesdigi_commands;
alter function private.document_object_insert(text) owner to filesdigi_commands;
alter function public.verify_booking_payment(uuid, uuid, text, uuid) owner to filesdigi_commands;
alter function public.send_booking_to_tl(uuid, uuid, integer) owner to filesdigi_commands;

revoke all on function public.verify_booking_payment(uuid, uuid, text, uuid),
  public.send_booking_to_tl(uuid, uuid, integer)
from public, anon, authenticated, service_role;

grant execute on function public.verify_booking_payment(uuid, uuid, text, uuid),
  public.send_booking_to_tl(uuid, uuid, integer)
to authenticated;

revoke create on schema public, private from filesdigi_commands;
