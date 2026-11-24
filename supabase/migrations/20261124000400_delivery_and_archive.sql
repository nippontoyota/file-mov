-- Migration: 20261124000400_delivery_and_archive.sql
-- Accounts Financial Closure (SRC-X09)
-- Security Gate Pass & Vehicle Delivery (SRC-X10, SRC-T07, R-15)
-- Physical File Return to Accounts & Final Archive Storage (SRC-A07, SRC-T07, R-15)

-- 1. Table: delivery_records
create table if not exists public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,

  -- Financial Closure by Accounts (SRC-X09)
  financial_closure_at timestamptz,
  financial_closure_by uuid references public.staff(id),
  financial_closure_notes text,

  -- Gate Pass Issuance by Security (SRC-X10, SRC-T07)
  gate_pass_no text check(gate_pass_no is null or length(gate_pass_no) between 1 and 64),
  gate_pass_issued_at timestamptz,
  gate_pass_issued_by uuid references public.staff(id),
  security_officer_name text,
  odometer_reading integer check(odometer_reading is null or odometer_reading >= 0),
  gate_pass_document_id uuid references public.booking_documents(id) on delete set null,

  -- Actual Physical Delivery Handover (R-15, Q-10 - distinct fact from gate pass)
  delivered_at timestamptz,
  delivered_by uuid references public.staff(id),
  recipient_name text,
  recipient_relationship text,
  keys_handed_over boolean not null default false,
  delivery_document_id uuid references public.booking_documents(id) on delete set null,
  delivery_notes text,

  -- Physical File Return to Accounts (SRC-T07)
  security_file_returned_at timestamptz,
  security_file_returned_by uuid references public.staff(id),

  -- Final Archive Storage by Accounts (SRC-A07, R-15)
  archived_at timestamptz,
  archived_by uuid references public.staff(id),
  archive_location text check(archive_location is null or length(archive_location) between 1 and 128),
  archive_physical_audit jsonb not null default '{}'::jsonb,

  -- Workflow lifecycle stage
  status text not null default 'pending' check(status in ('pending', 'financial_closed', 'gate_pass_issued', 'delivered', 'file_returned', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Expand bookings_state_check to permit 'archived'
alter table public.bookings drop constraint if exists bookings_state_check;
alter table public.bookings add constraint bookings_state_check
  check(state in ('draft', 'tl_review', 'sm_review', 'allocated', 'bo_review', 'archived'));

-- 3. Expand booking_documents_kind_check to include gate_pass and delivery_acknowledgment
alter table public.booking_documents drop constraint if exists booking_documents_kind_check;
alter table public.booking_documents add constraint booking_documents_kind_check
  check(kind in (
    'aadhaar',
    'pan',
    'form20',
    'disclaimer',
    'vahan_ack',
    'payment_receipt',
    'insurance_policy',
    'vehicle_invoice',
    'road_tax_receipt',
    'fastag_document',
    'accessories_bill',
    'rto_rc_copy',
    'gate_pass',
    'delivery_acknowledgment'
  ));

-- 4. Update document locking to support Gate Pass & Delivery documents
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

  elsif p_kind in ('form20','disclaimer','vahan_ack','rto_rc_copy') then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.role in ('BO','Admin') and m.branch_id=b.branch_id and m.active and s.active for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;
    if b.state<>'bo_review' then raise exception 'forbidden' using errcode='42501'; end if;

  elsif p_kind = 'payment_receipt' then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active
        and (
          (m.role='SO' and m.team_id=b.team_id and b.so_id=auth.uid() and b.state in ('draft', 'allocated'))
          or (m.role in ('Cashier', 'Accessories', 'Admin'))
        ) for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;

  elsif p_kind = 'insurance_policy' then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and m.role in ('Insurance','Admin') for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.insurance_dispatched_at is not null) then
      raise exception 'insurance_not_dispatched' using errcode='42501';
    end if;
    select * into b from public.bookings where id=p_booking for update;

  elsif p_kind in ('vehicle_invoice','road_tax_receipt','fastag_document') then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and m.role in ('Accounts','Admin') for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accounts_dispatched_at is not null) then
      raise exception 'accounts_not_dispatched' using errcode='42501';
    end if;
    if p_kind = 'vehicle_invoice' then
      if not exists (select 1 from public.insurance_policies ip where ip.booking_id=b.id and ip.status='issued') then
        raise exception 'Rule D-16 violation: Motor insurance policy must be issued before attaching vehicle commercial invoice' using errcode='22023';
      end if;
    end if;
    select * into b from public.bookings where id=p_booking for update;

  elsif p_kind = 'accessories_bill' then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and m.role in ('Accessories','Admin') for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accessories_dispatched_at is not null) then
      raise exception 'accessories_not_dispatched' using errcode='42501';
    end if;
    select * into b from public.bookings where id=p_booking for update;

  elsif p_kind = 'gate_pass' then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and m.role in ('Security','Admin') for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;

  elsif p_kind = 'delivery_acknowledgment' then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and m.role in ('SO','BO','Security','Admin') for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;

  else
    raise exception 'invalid_kind' using errcode='22023';
  end if;
  return b;
end $$;

-- 5. Document object insert policy
create or replace function private.document_object_insert(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.booking_documents d
    join public.bookings b on b.id = d.booking_id
    join public.memberships m on m.branch_id = b.branch_id and m.staff_id = auth.uid() and m.active
    where d.id::text = p_name and d.status = 'pending' and d.uploaded_by = auth.uid()
      and (
        (b.state = 'draft' and b.so_id = auth.uid() and m.role = 'SO' and m.team_id = b.team_id and d.kind in ('aadhaar','pan'))
        or (b.state = 'bo_review' and m.role in ('BO','Admin') and d.kind in ('form20','disclaimer','vahan_ack','rto_rc_copy'))
        or (d.kind = 'payment_receipt' and (
          (b.state in ('draft', 'allocated') and b.so_id = auth.uid() and m.role = 'SO' and m.team_id = b.team_id)
          or (m.role in ('Cashier', 'Accessories', 'Admin'))
        ))
        or (d.kind = 'insurance_policy' and m.role in ('Insurance','Admin') and exists (
          select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.insurance_dispatched_at is not null
        ))
        or (d.kind in ('vehicle_invoice','road_tax_receipt','fastag_document') and m.role in ('Accounts','Admin') and exists (
          select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accounts_dispatched_at is not null
        ))
        or (d.kind = 'accessories_bill' and m.role in ('Accessories','Admin') and exists (
          select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accessories_dispatched_at is not null
        ))
        or (d.kind = 'gate_pass' and m.role in ('Security','Admin'))
        or (d.kind = 'delivery_acknowledgment' and m.role in ('SO','BO','Security','Admin'))
      )
  )
$$;

-- 6. Stored Procedures

-- 6A. record_financial_closure (SRC-X09)
create or replace function public.record_financial_closure(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_branch uuid;
begin
  if p_operation is null then raise exception 'missing_operation' using errcode='22023'; end if;
  if exists (select 1 from private.command_results where actor_id=auth.uid() and operation_id=p_operation) then
    select result into b.id from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
    return b.id;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  v_branch := b.branch_id;

  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=v_branch and m.active and s.active
      and m.role in ('Accounts','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Prerequisite: Accounts clearance must be completed
  if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accounts_completed_at is not null) then
    raise exception 'accounts_clearance_required' using errcode='22023';
  end if;

  -- Prerequisite: If accessories record exists, it must have margin signed
  if exists (select 1 from public.accessories_records ar where ar.booking_id=b.id and ar.bill_number is not null and not ar.margin_signed) then
    raise exception 'accessories_margin_sign_required' using errcode='22023';
  end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  insert into public.delivery_records(
    booking_id, branch_id, financial_closure_at, financial_closure_by, financial_closure_notes, status, updated_at
  ) values (
    b.id, v_branch, now(), auth.uid(), btrim(p_notes), 'financial_closed', now()
  )
  on conflict (booking_id) do update set
    financial_closure_at=now(),
    financial_closure_by=auth.uid(),
    financial_closure_notes=coalesce(btrim(p_notes), delivery_records.financial_closure_notes),
    status=case when delivery_records.status in ('gate_pass_issued','delivered','file_returned','archived') then delivery_records.status else 'financial_closed' end,
    updated_at=now();

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'accounts.financial_closure', b.id, b.revision,
    'Accounts verified all commercial invoices, accessory bills, and customer payments; file cleared for showroom delivery release');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','record_financial_closure','booking',b.id), b.id);

  return b.id;
end $$;

-- 6B. issue_gate_pass (SRC-X10, SRC-T07, R-15)
create or replace function public.issue_gate_pass(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_gate_pass_no text,
  p_officer_name text,
  p_odometer integer,
  p_document_id uuid default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_branch uuid;
begin
  if p_operation is null then raise exception 'missing_operation' using errcode='22023'; end if;
  if exists (select 1 from private.command_results where actor_id=auth.uid() and operation_id=p_operation) then
    select result into b.id from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
    return b.id;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  v_branch := b.branch_id;

  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=v_branch and m.active and s.active
      and m.role in ('Security','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Prerequisite: Financial closure required before Security releases vehicle
  if not exists (select 1 from public.delivery_records dr where dr.booking_id=b.id and dr.financial_closure_at is not null) then
    raise exception 'financial_closure_required_for_gate_pass' using errcode='22023';
  end if;

  if p_gate_pass_no is null or length(btrim(p_gate_pass_no)) = 0 then
    raise exception 'missing_gate_pass_no' using errcode='22023';
  end if;

  if p_document_id is not null then
    perform 1 from public.booking_documents
      where id=p_document_id and booking_id=b.id and kind='gate_pass' and status in ('ready','finalized');
    if not found then raise exception 'invalid_gate_pass_document' using errcode='22023'; end if;
  end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  update public.delivery_records set
    gate_pass_no=btrim(p_gate_pass_no),
    gate_pass_issued_at=now(),
    gate_pass_issued_by=auth.uid(),
    security_officer_name=btrim(p_officer_name),
    odometer_reading=coalesce(p_odometer, 15),
    gate_pass_document_id=coalesce(p_document_id, delivery_records.gate_pass_document_id),
    status=case when delivery_records.status in ('delivered','file_returned','archived') then delivery_records.status else 'gate_pass_issued' end,
    updated_at=now()
  where booking_id=b.id;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'security.gate_pass_issued', b.id, b.revision,
    'Showroom security gate pass #' || btrim(p_gate_pass_no) || ' issued for vehicle release (Odometer: ' || coalesce(p_odometer, 15)::text || ' km)');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','issue_gate_pass','booking',b.id,'pass',btrim(p_gate_pass_no)), b.id);

  return b.id;
end $$;

-- 6C. record_vehicle_delivery (R-15, Q-10 - actual handover to customer)
create or replace function public.record_vehicle_delivery(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_recipient_name text,
  p_relationship text default 'Self',
  p_keys_handed_over boolean default true,
  p_notes text default null,
  p_document_id uuid default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_branch uuid;
begin
  if p_operation is null then raise exception 'missing_operation' using errcode='22023'; end if;
  if exists (select 1 from private.command_results where actor_id=auth.uid() and operation_id=p_operation) then
    select result into b.id from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
    return b.id;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  v_branch := b.branch_id;

  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=v_branch and m.active and s.active
      and m.role in ('SO','BO','Security','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Gate pass must precede actual showroom delivery release
  if not exists (select 1 from public.delivery_records dr where dr.booking_id=b.id and dr.gate_pass_issued_at is not null) then
    raise exception 'gate_pass_required_before_delivery' using errcode='22023';
  end if;

  if p_recipient_name is null or length(btrim(p_recipient_name)) = 0 then
    raise exception 'missing_recipient_name' using errcode='22023';
  end if;

  if p_document_id is not null then
    perform 1 from public.booking_documents
      where id=p_document_id and booking_id=b.id and kind='delivery_acknowledgment' and status in ('ready','finalized');
    if not found then raise exception 'invalid_delivery_document' using errcode='22023'; end if;
  end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  update public.delivery_records set
    delivered_at=now(),
    delivered_by=auth.uid(),
    recipient_name=btrim(p_recipient_name),
    recipient_relationship=coalesce(btrim(p_relationship), 'Self'),
    keys_handed_over=coalesce(p_keys_handed_over, true),
    delivery_document_id=coalesce(p_document_id, delivery_records.delivery_document_id),
    delivery_notes=btrim(p_notes),
    status=case when delivery_records.status in ('file_returned','archived') then delivery_records.status else 'delivered' end,
    updated_at=now()
  where booking_id=b.id;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'delivery.vehicle_delivered', b.id, b.revision,
    'Vehicle handed over to customer (' || btrim(p_recipient_name) || '); keys and delivery kit presented');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','record_vehicle_delivery','booking',b.id,'recipient',btrim(p_recipient_name)), b.id);

  return b.id;
end $$;

-- 6D. return_file_to_accounts (SRC-T07: Security returns physical customer file back to Accounts)
create or replace function public.return_file_to_accounts(
  p_operation uuid,
  p_booking uuid,
  p_revision integer
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_branch uuid;
begin
  if p_operation is null then raise exception 'missing_operation' using errcode='22023'; end if;
  if exists (select 1 from private.command_results where actor_id=auth.uid() and operation_id=p_operation) then
    select result into b.id from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
    return b.id;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  v_branch := b.branch_id;

  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=v_branch and m.active and s.active
      and m.role in ('Security','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  if not exists (select 1 from public.delivery_records dr where dr.booking_id=b.id and dr.gate_pass_issued_at is not null) then
    raise exception 'gate_pass_not_issued' using errcode='22023';
  end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  update public.delivery_records set
    security_file_returned_at=now(),
    security_file_returned_by=auth.uid(),
    status=case when delivery_records.status = 'archived' then 'archived' else 'file_returned' end,
    updated_at=now()
  where booking_id=b.id;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'security.file_returned_to_accounts', b.id, b.revision,
    'Physical customer file returned by Security back to Accounts for final audit & record archiving');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','return_file_to_accounts','booking',b.id), b.id);

  return b.id;
end $$;

-- 6E. record_final_archive (SRC-A07, R-15: Accounts audits physical originals and archives file)
create or replace function public.record_final_archive(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_location text,
  p_physical_audit jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_branch uuid;
begin
  if p_operation is null then raise exception 'missing_operation' using errcode='22023'; end if;
  if exists (select 1 from private.command_results where actor_id=auth.uid() and operation_id=p_operation) then
    select result into b.id from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
    return b.id;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  v_branch := b.branch_id;

  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=v_branch and m.active and s.active
      and m.role in ('Accounts','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Prerequisite: Security must have returned the file back to Accounts
  if not exists (select 1 from public.delivery_records dr where dr.booking_id=b.id and dr.security_file_returned_at is not null) then
    raise exception 'file_must_be_returned_from_security_first' using errcode='22023';
  end if;

  if p_location is null or length(btrim(p_location)) = 0 then
    raise exception 'missing_archive_location' using errcode='22023';
  end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  update public.delivery_records set
    archived_at=now(),
    archived_by=auth.uid(),
    archive_location=btrim(p_location),
    archive_physical_audit=coalesce(p_physical_audit, '{}'::jsonb),
    status='archived',
    updated_at=now()
  where booking_id=b.id;

  -- Booking reaches full lifecycle completion ('archived')
  update public.bookings set
    state='archived',
    revision=revision+1,
    updated_at=now()
  where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'accounts.file_archived', b.id, b.revision,
    'Customer file audit verified; physical folder archived at location: ' || btrim(p_location));

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','record_final_archive','booking',b.id,'loc',btrim(p_location)), b.id);

  return b.id;
end $$;

-- 7. Scope and Read Permissions: Include Admin and Security after sales review
create or replace function private.can_read_booking_id(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.bookings b
    where b.id=p_booking and (
      private.can_read_booking(b.branch_id,b.team_id,b.so_id)
      or (
        b.state not in ('draft','tl_review','sm_review') and exists(
          select 1 from public.memberships m where m.staff_id=auth.uid() and m.active and m.branch_id=b.branch_id and (
            m.role in ('Admin','BO')
            or (m.role='Insurance' and exists(select 1 from public.bo_preparations p where p.booking_id=b.id and p.insurance_dispatched_at is not null))
            or (m.role in ('Accounts','Cashier') and exists(select 1 from public.bo_preparations p where p.booking_id=b.id and p.accounts_dispatched_at is not null))
            or (m.role='Accessories' and exists(select 1 from public.bo_preparations p where p.booking_id=b.id and p.accessories_dispatched_at is not null))
            or (m.role='Security' and (
              exists(select 1 from public.delivery_records d where d.booking_id=b.id and d.financial_closure_at is not null)
              or b.state in ('bo_review', 'archived')
            ))
          )
        )
      )
    )
  )
$$;

-- 8. RLS on accessories_records and delivery_records
drop policy if exists accessories_records_read on public.accessories_records;
create policy accessories_records_read on public.accessories_records for select to authenticated using(
  exists(
    select 1 from public.memberships m
    where m.branch_id = accessories_records.branch_id
      and m.staff_id = auth.uid()
      and m.active
      and (
        m.role in ('Accessories','BO','SM','Accounts','Cashier','Admin','Security')
        or exists (select 1 from public.bookings b where b.id = accessories_records.booking_id and b.team_id = m.team_id)
      )
  )
);

alter table public.delivery_records enable row level security;
drop policy if exists delivery_records_read on public.delivery_records;

create policy delivery_records_read on public.delivery_records for select to authenticated using(
  exists(
    select 1 from public.memberships m
    where m.branch_id = delivery_records.branch_id
      and m.staff_id = auth.uid()
      and m.active
      and (
        m.role in ('Security','Accounts','Cashier','BO','SM','Admin','Accessories')
        or exists (select 1 from public.bookings b where b.id = delivery_records.booking_id and b.team_id = m.team_id)
      )
  )
);

grant select on public.delivery_records to authenticated;
grant execute on function public.record_financial_closure to authenticated;
grant execute on function public.issue_gate_pass to authenticated;
grant execute on function public.record_vehicle_delivery to authenticated;
grant execute on function public.return_file_to_accounts to authenticated;
grant execute on function public.record_final_archive to authenticated;

-- 9. Public Gate Pass Verification (Zero-Login phone camera scan)
create or replace function public.verify_public_gate_pass(p_booking_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  dr public.delivery_records;
  bp public.bo_preparations;
  sub public.sales_submissions;
begin
  select * into dr from public.delivery_records where booking_id=p_booking_id;
  if not found or dr.gate_pass_issued_at is null then
    return jsonb_build_object('valid', false, 'reason', 'gate_pass_not_found');
  end if;

  select * into b from public.bookings where id=p_booking_id;
  select * into bp from public.bo_preparations where booking_id=p_booking_id;
  select * into sub from public.sales_submissions where booking_id=p_booking_id;

  return jsonb_build_object(
    'valid', true,
    'gate_pass_no', dr.gate_pass_no,
    'gate_pass_issued_at', dr.gate_pass_issued_at,
    'security_officer_name', dr.security_officer_name,
    'odometer_reading', dr.odometer_reading,
    'financial_closure_at', dr.financial_closure_at,
    'delivered_at', dr.delivered_at,
    'recipient_name', dr.recipient_name,
    'keys_handed_over', dr.keys_handed_over,
    'status', dr.status,
    'customer_name', b.data->>'customer_name',
    'booking_number', b.data->>'booking_number',
    'model', b.data->>'model',
    'variant', b.data->>'suffix_1',
    'colour', b.data->>'colour_1',
    'chassis_number', sub.allocation_ref,
    'registration_no', coalesce(bp.rto_registration_no, 'Temporary / In-Process')
  );
end $$;

grant execute on function public.verify_public_gate_pass to anon, authenticated;

alter table public.delivery_records owner to filesdigi_commands;
