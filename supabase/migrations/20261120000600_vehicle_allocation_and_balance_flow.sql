-- Migration: 20261120000600_vehicle_allocation_and_balance_flow.sql
-- Implements:
-- 1. Expanded booking state check to include 'allocated' (vehicle allocated, awaiting full balance payment).
-- 2. Expanded booking_payments payment_type check to include 'balance_payment'.
-- 3. Additional tracking columns on sales_submissions: allocated_at, allocated_by, allocator_name, customer_intimated_at, customer_intimated_by, customer_intimation_notes.
-- 4. allocate_vehicle_sm stored procedure for SM to assign VIN/Chassis and move to 'allocated' status.
-- 5. record_customer_intimation stored procedure for SO to log customer call after allocation.
-- 6. Updated record_booking_payment to support recording balance_payment.
-- 7. handover_to_bo_sm stored procedure for SM to hand over to Back Office once balance payment is verified.
-- 8. Updated approve_booking_sm for backward compatibility.

grant create on schema public, private to filesdigi_commands;

-- 1. State check constraint
alter table public.bookings drop constraint if exists bookings_state_check;
alter table public.bookings add constraint bookings_state_check check(state in ('draft','tl_review','sm_review','allocated','bo_review'));

-- 2. Payment type check constraint
alter table public.booking_payments drop constraint if exists booking_payments_payment_type_check;
alter table public.booking_payments add constraint booking_payments_payment_type_check
  check(payment_type in ('booking_advance', 'balance_payment', 'margin_money', 'accessories'));

-- 3. Columns on sales_submissions
alter table public.sales_submissions
  add column if not exists allocated_at timestamptz,
  add column if not exists allocated_by uuid references public.staff(id),
  add column if not exists allocator_name text,
  add column if not exists customer_intimated_at timestamptz,
  add column if not exists customer_intimated_by uuid references public.staff(id),
  add column if not exists customer_intimation_notes text;

-- 4. Update document locking to allow SO to upload payment slips in 'allocated' state
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
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and (
        (m.role='SO' and m.team_id=b.team_id and b.so_id=auth.uid() and b.state in ('draft', 'allocated'))
        or m.role='Cashier'
      ) for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;
  else
    raise exception 'invalid_kind' using errcode='22023';
  end if;
  return b;
end $$;

-- 5. Update storage insert check
create or replace function private.document_object_insert(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.booking_documents d
    join public.bookings b on b.id = d.booking_id
    join public.memberships m on m.branch_id = b.branch_id and m.staff_id = auth.uid() and m.active
    where d.id::text = p_name and d.status = 'pending' and d.uploaded_by = auth.uid()
      and (
        (b.state in ('draft', 'allocated') and b.so_id = auth.uid() and m.role = 'SO' and m.team_id = b.team_id and d.kind in ('aadhaar','pan','payment_receipt'))
        or (b.state = 'bo_review' and m.role = 'BO' and d.kind in ('form20','disclaimer','vahan_ack'))
        or (m.role = 'Cashier' and d.kind = 'payment_receipt')
      )
  )
$$;

-- 6. Stored procedure: allocate_vehicle_sm
create or replace function public.allocate_vehicle_sm(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_allocation_ref text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  handoff public.sales_submissions;
  req jsonb;
  saved private.command_results;
  actor_name text;
  alloc text;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  alloc := nullif(btrim(p_allocation_ref),'');
  if alloc is null or length(alloc) > 100 then raise exception 'allocation_ref_required' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object('command','allocate_vehicle_sm','booking',p_booking,'revision',p_revision,'allocation',alloc);

  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if not private.can_read_booking_id(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
    if saved.input <> req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.role='SM' and m.active and s.active for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.state <> 'sm_review' then raise exception 'forbidden' using errcode='42501'; end if;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  select * into handoff from public.sales_submissions where booking_id=b.id for update;
  if not found or handoff.tl_approved_at is null then raise exception 'tl_approval_required' using errcode='22023'; end if;

  update public.bookings set state='allocated', revision=revision+1, updated_at=now() where id=b.id returning * into b;

  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id, revision, data, actor_id, actor_name, form_version)
    values(b.id, b.revision, b.data, auth.uid(), actor_name, b.form_version);

  update public.sales_submissions set
    allocation_ref = alloc,
    allocated_at = now(),
    allocated_by = auth.uid(),
    allocator_name = actor_name
  where booking_id = b.id;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'booking.vehicle_allocated', b.id, b.revision, alloc);

  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

-- 7. Stored procedure: record_customer_intimation
create or replace function public.record_customer_intimation(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_notes text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  req jsonb;
  saved private.command_results;
  v_notes text;
  actor_name text;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  v_notes := nullif(btrim(coalesce(p_notes,'')),'');
  if v_notes is null or length(v_notes) > 1000 then raise exception 'notes_required' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object('command','record_customer_intimation','booking',p_booking,'revision',p_revision,'notes',v_notes);

  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if not private.can_read_booking_id(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
    if saved.input <> req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Must be assigned SO or TL/SM
  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and (
      (m.role='SO' and b.so_id=auth.uid() and m.team_id=b.team_id)
      or (m.role='TL' and m.team_id=b.team_id)
      or m.role='SM'
    ) for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.state <> 'allocated' then raise exception 'invalid_state' using errcode='22023'; end if;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id, revision, data, actor_id, actor_name, form_version)
    values(b.id, b.revision, b.data, auth.uid(), actor_name, b.form_version);

  update public.sales_submissions set
    customer_intimated_at = now(),
    customer_intimated_by = auth.uid(),
    customer_intimation_notes = v_notes
  where booking_id = b.id;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'booking.customer_intimated', b.id, b.revision, v_notes);

  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

-- 8. Stored procedure: record_booking_payment (updated to support balance_payment)
drop function if exists public.record_booking_payment(uuid, uuid, numeric, text, text, uuid);

create or replace function public.record_booking_payment(
  p_operation uuid,
  p_booking uuid,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_proof_document uuid default null,
  p_payment_type text default 'booking_advance'
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  req jsonb;
  saved private.command_results;
  v_method text;
  v_ref text;
  v_type text;
  v_id uuid;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount' using errcode='22023'; end if;

  v_method := lower(btrim(coalesce(p_method, '')));
  if v_method not in ('card', 'upi', 'cheque', 'cash') then raise exception 'invalid_payment_method' using errcode='22023'; end if;

  v_ref := nullif(btrim(coalesce(p_reference, '')), '');
  if v_ref is null or length(v_ref) > 100 then raise exception 'invalid_reference' using errcode='22023'; end if;

  v_type := lower(btrim(coalesce(p_payment_type, 'booking_advance')));
  if v_type not in ('booking_advance', 'balance_payment', 'margin_money', 'accessories') then
    raise exception 'invalid_payment_type' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object(
    'command', 'record_booking_payment',
    'booking', p_booking,
    'amount', p_amount,
    'method', v_method,
    'reference', v_ref,
    'proof_document', p_proof_document,
    'payment_type', v_type
  );

  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if saved.input <> req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Verify permissions based on payment type and state:
  -- booking_advance: SO when draft, or Cashier
  -- balance_payment: SO when allocated, or Cashier
  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and (
      (m.role='SO' and b.so_id=auth.uid() and m.team_id=b.team_id and (
        (v_type = 'booking_advance' and b.state = 'draft') or
        (v_type = 'balance_payment' and b.state in ('allocated', 'sm_review'))
      ))
      or m.role='Cashier'
    ) for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Validate proof document if provided
  if p_proof_document is not null then
    perform 1 from public.booking_documents
      where id=p_proof_document and booking_id=b.id and status='ready' and kind='payment_receipt';
    if not found then raise exception 'invalid_proof_document' using errcode='22023'; end if;
  end if;

  insert into public.booking_payments(
    booking_id,
    branch_id,
    payment_type,
    amount,
    payment_method,
    reference_no,
    proof_document_id,
    created_by
  ) values (
    b.id,
    b.branch_id,
    v_type,
    p_amount,
    v_method,
    v_ref,
    p_proof_document,
    auth.uid()
  ) returning id into v_id;

  insert into public.audit_events(branch_id, actor_id, action, target_id, reason)
    values(b.branch_id, auth.uid(), 'cashier.payment_recorded', v_id, v_method || ':' || p_amount::text);

  insert into private.command_results values(auth.uid(), p_operation, req, v_id);
  return v_id;
end $$;

-- 9. Stored procedure: handover_to_bo_sm
create or replace function public.handover_to_bo_sm(
  p_operation uuid,
  p_booking uuid,
  p_revision integer
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  handoff public.sales_submissions;
  req jsonb;
  saved private.command_results;
  actor_name text;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object('command','handover_to_bo_sm','booking',p_booking,'revision',p_revision);

  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if not private.can_read_booking_id(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
    if saved.input <> req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.role='SM' and m.active and s.active for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.state not in ('allocated', 'sm_review') then raise exception 'forbidden' using errcode='42501'; end if;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  select * into handoff from public.sales_submissions where booking_id=b.id for update;
  if not found or handoff.allocation_ref is null then raise exception 'allocation_ref_required' using errcode='22023'; end if;

  -- Ensure balance payment is verified
  perform 1 from public.booking_payments
    where booking_id = b.id and payment_type in ('balance_payment', 'margin_money') and status = 'verified';
  if not found then
    raise exception 'balance_payment_required' using errcode='22023';
  end if;

  update public.bookings set state='bo_review', revision=revision+1, updated_at=now() where id=b.id returning * into b;

  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id, revision, data, actor_id, actor_name, form_version)
    values(b.id, b.revision, b.data, auth.uid(), actor_name, b.form_version);

  update public.sales_submissions set
    sm_approved_by=auth.uid(),
    sm_approved_at=now(),
    sm_approver_name=actor_name
  where booking_id=b.id;

  -- Auto-initialize bo_preparations if not already existing
  insert into public.bo_preparations(booking_id, branch_id)
    values(b.id, b.branch_id)
    on conflict(booking_id) do nothing;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'booking.approved_by_sm', b.id, b.revision, handoff.allocation_ref);

  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

-- 10. Update approve_booking_sm for backward compatibility
create or replace function public.approve_booking_sm(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_allocation_ref text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  alloc text;
  has_balance boolean;
begin
  alloc := nullif(btrim(p_allocation_ref),'');
  if alloc is null or length(alloc) > 100 then raise exception 'allocation_ref_required' using errcode='22023'; end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Check if balance payment is already verified (e.g. In automated test scripts)
  select exists(
    select 1 from public.booking_payments
    where booking_id = b.id and payment_type in ('balance_payment', 'margin_money') and status = 'verified'
  ) into has_balance;

  if has_balance then
    -- Record allocation and immediately transition to bo_review
    perform public.allocate_vehicle_sm(p_operation, p_booking, p_revision, alloc);
    select revision into p_revision from public.bookings where id=p_booking;
    return public.handover_to_bo_sm(gen_random_uuid(), p_booking, p_revision);
  else
    -- Allocate vehicle and transition to 'allocated' (awaiting customer balance payment)
    return public.allocate_vehicle_sm(p_operation, p_booking, p_revision, alloc);
  end if;
end $$;

-- Permissions
alter function public.allocate_vehicle_sm(uuid, uuid, integer, text) owner to filesdigi_commands;
alter function public.record_customer_intimation(uuid, uuid, integer, text) owner to filesdigi_commands;
alter function public.record_booking_payment(uuid, uuid, numeric, text, text, uuid, text) owner to filesdigi_commands;
alter function public.handover_to_bo_sm(uuid, uuid, integer) owner to filesdigi_commands;

revoke all on function public.allocate_vehicle_sm(uuid, uuid, integer, text),
  public.record_customer_intimation(uuid, uuid, integer, text),
  public.record_booking_payment(uuid, uuid, numeric, text, text, uuid, text),
  public.handover_to_bo_sm(uuid, uuid, integer)
from public, anon, authenticated, service_role;

grant execute on function public.allocate_vehicle_sm(uuid, uuid, integer, text),
  public.record_customer_intimation(uuid, uuid, integer, text),
  public.record_booking_payment(uuid, uuid, numeric, text, text, uuid, text),
  public.handover_to_bo_sm(uuid, uuid, integer)
to authenticated;

revoke create on schema public, private from filesdigi_commands;
