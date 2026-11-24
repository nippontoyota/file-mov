-- Migration: 20261124000200_accounts_workflow.sql
-- Accounts Department Workflow (SRC-A01 to SRC-A07, SRC-C01, SRC-H05 to SRC-H09)
-- Invariant D-16: Insurance precedes vehicle commercial invoicing
-- Invariant D-17: Accounts owns FASTag issuance; Cashier handles collection/handover

-- 1. Table: accounts_records
create table if not exists public.accounts_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,

  -- Commercial Vehicle Tax Invoicing (SRC-A03, SRC-A06, Rule D-16)
  invoice_number text check(invoice_number is null or length(invoice_number) between 1 and 64),
  invoice_date date,
  ex_showroom_amount numeric(12,2) check(ex_showroom_amount is null or ex_showroom_amount > 0),
  tcs_amount numeric(12,2) default 0 check(tcs_amount is null or tcs_amount >= 0),
  total_invoice_amount numeric(12,2) check(total_invoice_amount is null or total_invoice_amount > 0),
  invoice_document_id uuid references public.booking_documents(id) on delete set null,
  invoiced_by uuid references public.staff(id),
  invoiced_at timestamptz,

  -- FASTag RFID Processing (SRC-A04, SRC-A06) & Cashier Handover (SRC-C01, SRC-H09)
  fastag_tag_id text check(fastag_tag_id is null or length(fastag_tag_id) between 1 and 64),
  fastag_bank text check(fastag_bank is null or length(fastag_bank) between 1 and 64),
  fastag_security_deposit numeric(12,2) default 200 check(fastag_security_deposit is null or fastag_security_deposit >= 0),
  fastag_wallet_balance numeric(12,2) default 300 check(fastag_wallet_balance is null or fastag_wallet_balance >= 0),
  fastag_issued_by uuid references public.staff(id),
  fastag_issued_at timestamptz,
  fastag_handover_status text not null default 'pending_handover' check(fastag_handover_status in ('pending_handover','handed_over')),
  fastag_handover_by uuid references public.staff(id),
  fastag_handover_at timestamptz,
  fastag_handover_notes text,

  -- Kerala Road Tax & Statutory Statutory Payment (SRC-A05, SRC-A06, SRC-H07)
  road_tax_receipt_no text check(road_tax_receipt_no is null or length(road_tax_receipt_no) between 1 and 64),
  road_tax_amount numeric(12,2) check(road_tax_amount is null or road_tax_amount > 0),
  road_tax_payment_mode text check(road_tax_payment_mode is null or road_tax_payment_mode in ('e_treasury_netbanking','vahan_challan','dd')),
  road_tax_paid_date date,
  road_tax_document_id uuid references public.booking_documents(id) on delete set null,
  road_tax_recorded_by uuid references public.staff(id),
  road_tax_recorded_at timestamptz,

  -- Status tracking
  status text not null default 'pending' check(status in ('pending','invoiced','fastag_ready','road_tax_paid','cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add completion tracking to bo_preparations
alter table public.bo_preparations
  add column if not exists accounts_completed_at timestamptz,
  add column if not exists accounts_completed_by uuid references public.staff(id);

-- 2. Update booking_documents check constraint to include accounts documents
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
    'fastag_document'
  ));

-- 3. Update document locking to support Accounts documents
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
          (m.role='SO' and m.team_id=b.team_id and b.so_id=auth.uid() and b.state in ('draft', 'allocated'))
          or (m.role='Cashier')
        ) for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;

  elsif p_kind = 'insurance_policy' then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and m.role='Insurance' for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.insurance_dispatched_at is not null) then
      raise exception 'insurance_not_dispatched' using errcode='42501';
    end if;
    select * into b from public.bookings where id=p_booking for update;

  elsif p_kind in ('vehicle_invoice','road_tax_receipt','fastag_document') then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and m.role='Accounts' for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accounts_dispatched_at is not null) then
      raise exception 'accounts_not_dispatched' using errcode='42501';
    end if;
    -- Rule D-16: Vehicle invoice requires insurance policy issued
    if p_kind = 'vehicle_invoice' then
      if not exists (select 1 from public.insurance_policies ip where ip.booking_id=b.id and ip.status='issued') then
        raise exception 'Rule D-16 violation: Motor insurance policy must be issued before attaching vehicle commercial invoice' using errcode='22023';
      end if;
    end if;
    select * into b from public.bookings where id=p_booking for update;

  else
    raise exception 'invalid_kind' using errcode='22023';
  end if;
  return b;
end $$;

-- 4. Document object insert policy
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
          (b.state in ('draft', 'allocated') and b.so_id = auth.uid() and m.role = 'SO' and m.team_id = b.team_id)
          or (m.role = 'Cashier')
        ))
        or (d.kind = 'insurance_policy' and m.role = 'Insurance' and exists (
          select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.insurance_dispatched_at is not null
        ))
        or (d.kind in ('vehicle_invoice','road_tax_receipt','fastag_document') and m.role = 'Accounts' and exists (
          select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accounts_dispatched_at is not null
        ))
      )
  )
$$;

-- 5. Stored Procedures

-- 5A. record_vehicle_invoice (SRC-A03, SRC-A06, Rule D-16)
create or replace function public.record_vehicle_invoice(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_invoice_number text,
  p_invoice_date date,
  p_ex_showroom numeric,
  p_total_amount numeric,
  p_tcs numeric default 0,
  p_document_id uuid default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_rec public.accounts_records;
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

  -- Role check: Accounts or Admin in branch
  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=v_branch and m.active and s.active
      and m.role in ('Accounts','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Lock row and check revision
  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  -- BO Dispatch check
  if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accounts_dispatched_at is not null) then
    raise exception 'accounts_not_dispatched' using errcode='42501';
  end if;

  -- Rule D-16 invariant check: Motor insurance policy must be issued before generating vehicle invoice
  if not exists (select 1 from public.insurance_policies ip where ip.booking_id=b.id and ip.status='issued') then
    raise exception 'Rule D-16 violation: Motor insurance policy must be issued before generating commercial vehicle tax invoice' using errcode='22023';
  end if;

  -- Input validations
  if p_invoice_number is null or length(btrim(p_invoice_number)) = 0 then
    raise exception 'missing_invoice_number' using errcode='22023';
  end if;
  if p_invoice_date is null then
    raise exception 'missing_invoice_date' using errcode='22023';
  end if;
  if p_ex_showroom is null or p_ex_showroom <= 0 then
    raise exception 'invalid_ex_showroom_amount' using errcode='22023';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'invalid_total_invoice_amount' using errcode='22023';
  end if;

  -- If document_id provided, verify it exists and is ready/finalized vehicle_invoice
  if p_document_id is not null then
    perform 1 from public.booking_documents
      where id=p_document_id and booking_id=b.id and kind='vehicle_invoice' and status in ('ready', 'finalized');
    if not found then raise exception 'invalid_invoice_document' using errcode='22023'; end if;
  end if;

  insert into public.accounts_records(
    booking_id, branch_id,
    invoice_number, invoice_date, ex_showroom_amount, tcs_amount, total_invoice_amount,
    invoice_document_id, invoiced_by, invoiced_at, status, updated_at
  ) values (
    b.id, v_branch,
    btrim(p_invoice_number), p_invoice_date, p_ex_showroom, coalesce(p_tcs, 0), p_total_amount,
    p_document_id, auth.uid(), now(), 'invoiced', now()
  )
  on conflict (booking_id) do update set
    invoice_number=excluded.invoice_number,
    invoice_date=excluded.invoice_date,
    ex_showroom_amount=excluded.ex_showroom_amount,
    tcs_amount=excluded.tcs_amount,
    total_invoice_amount=excluded.total_invoice_amount,
    invoice_document_id=coalesce(excluded.invoice_document_id, accounts_records.invoice_document_id),
    invoiced_by=auth.uid(),
    invoiced_at=now(),
    status=case when accounts_records.status='pending' then 'invoiced' else accounts_records.status end,
    updated_at=now();

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(b.branch_id, auth.uid(), 'accounts.invoice_recorded', b.id, b.revision,
    'Commercial vehicle tax invoice ' || btrim(p_invoice_number) || ' recorded for Rs. ' || p_total_amount::text);

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','record_vehicle_invoice','booking',b.id,'invoice',btrim(p_invoice_number)), b.id);

  return b.id;
end $$;

-- 5B. record_fastag_issuance (SRC-A04, SRC-A06)
create or replace function public.record_fastag_issuance(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_fastag_tag_id text,
  p_fastag_bank text,
  p_security_deposit numeric default 200,
  p_wallet_balance numeric default 300
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

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accounts_dispatched_at is not null) then
    raise exception 'accounts_not_dispatched' using errcode='42501';
  end if;

  if p_fastag_tag_id is null or length(btrim(p_fastag_tag_id)) = 0 then
    raise exception 'missing_fastag_id' using errcode='22023';
  end if;
  if p_fastag_bank is null or length(btrim(p_fastag_bank)) = 0 then
    raise exception 'missing_fastag_bank' using errcode='22023';
  end if;

  insert into public.accounts_records(
    booking_id, branch_id,
    fastag_tag_id, fastag_bank, fastag_security_deposit, fastag_wallet_balance,
    fastag_issued_by, fastag_issued_at, fastag_handover_status, status, updated_at
  ) values (
    b.id, v_branch,
    btrim(p_fastag_tag_id), btrim(p_fastag_bank), coalesce(p_security_deposit, 200), coalesce(p_wallet_balance, 300),
    auth.uid(), now(), 'pending_handover', 'fastag_ready', now()
  )
  on conflict (booking_id) do update set
    fastag_tag_id=excluded.fastag_tag_id,
    fastag_bank=excluded.fastag_bank,
    fastag_security_deposit=excluded.fastag_security_deposit,
    fastag_wallet_balance=excluded.fastag_wallet_balance,
    fastag_issued_by=auth.uid(),
    fastag_issued_at=now(),
    status=case when accounts_records.status='pending' then 'fastag_ready' else accounts_records.status end,
    updated_at=now();

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(b.branch_id, auth.uid(), 'accounts.fastag_issued', b.id, b.revision,
    'FASTag issued: ' || btrim(p_fastag_tag_id) || ' (' || btrim(p_fastag_bank) || ')');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','record_fastag_issuance','booking',b.id,'tag',btrim(p_fastag_tag_id)), b.id);

  return b.id;
end $$;

-- 5C. acknowledge_fastag_handover (SRC-C01, SRC-H09)
create or replace function public.acknowledge_fastag_handover(
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
      and m.role in ('Cashier','Accounts','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  if not exists (select 1 from public.accounts_records ar where ar.booking_id=b.id and ar.fastag_tag_id is not null) then
    raise exception 'fastag_not_issued' using errcode='22023';
  end if;

  update public.accounts_records set
    fastag_handover_status='handed_over',
    fastag_handover_by=auth.uid(),
    fastag_handover_at=now(),
    fastag_handover_notes=p_notes,
    updated_at=now()
  where booking_id=b.id;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(b.branch_id, auth.uid(), 'cashier.fastag_handed_over', b.id, b.revision,
    'Cash Counter completed physical FASTag collection/handover');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','acknowledge_fastag_handover','booking',b.id), b.id);

  return b.id;
end $$;

-- 5D. record_road_tax_payment (SRC-A05, SRC-A06, SRC-H07)
create or replace function public.record_road_tax_payment(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_receipt_no text,
  p_amount numeric,
  p_payment_mode text,
  p_paid_date date,
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
      and m.role in ('Accounts','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accounts_dispatched_at is not null) then
    raise exception 'accounts_not_dispatched' using errcode='42501';
  end if;

  if p_receipt_no is null or length(btrim(p_receipt_no)) = 0 then
    raise exception 'missing_receipt_no' using errcode='22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_tax_amount' using errcode='22023';
  end if;
  if p_paid_date is null then
    raise exception 'missing_paid_date' using errcode='22023';
  end if;
  if p_payment_mode is null or p_payment_mode not in ('e_treasury_netbanking','vahan_challan','dd') then
    raise exception 'invalid_payment_mode' using errcode='22023';
  end if;

  if p_document_id is not null then
    perform 1 from public.booking_documents
      where id=p_document_id and booking_id=b.id and kind='road_tax_receipt' and status in ('ready', 'finalized');
    if not found then raise exception 'invalid_tax_document' using errcode='22023'; end if;
  end if;

  insert into public.accounts_records(
    booking_id, branch_id,
    road_tax_receipt_no, road_tax_amount, road_tax_payment_mode, road_tax_paid_date,
    road_tax_document_id, road_tax_recorded_by, road_tax_recorded_at, status, updated_at
  ) values (
    b.id, v_branch,
    btrim(p_receipt_no), p_amount, p_payment_mode, p_paid_date,
    p_document_id, auth.uid(), now(), 'road_tax_paid', now()
  )
  on conflict (booking_id) do update set
    road_tax_receipt_no=excluded.road_tax_receipt_no,
    road_tax_amount=excluded.road_tax_amount,
    road_tax_payment_mode=excluded.road_tax_payment_mode,
    road_tax_paid_date=excluded.road_tax_paid_date,
    road_tax_document_id=coalesce(excluded.road_tax_document_id, accounts_records.road_tax_document_id),
    road_tax_recorded_by=auth.uid(),
    road_tax_recorded_at=now(),
    status=case when accounts_records.status='pending' then 'road_tax_paid' else accounts_records.status end,
    updated_at=now();

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(b.branch_id, auth.uid(), 'accounts.road_tax_recorded', b.id, b.revision,
    'Kerala road tax payment challan ' || btrim(p_receipt_no) || ' recorded for Rs. ' || p_amount::text);

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','record_road_tax_payment','booking',b.id,'receipt',btrim(p_receipt_no)), b.id);

  return b.id;
end $$;

-- 5E. complete_accounts_clearance (SRC-A06, SRC-H06, SRC-T04)
create or replace function public.complete_accounts_clearance(
  p_operation uuid,
  p_booking uuid,
  p_revision integer
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_rec public.accounts_records;
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

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  select * into v_rec from public.accounts_records where booking_id=b.id;
  if not found or v_rec.invoice_number is null then
    raise exception 'invoice_missing' using errcode='22023';
  end if;
  if v_rec.fastag_tag_id is null then
    raise exception 'fastag_missing' using errcode='22023';
  end if;
  if v_rec.road_tax_receipt_no is null then
    raise exception 'road_tax_missing' using errcode='22023';
  end if;

  update public.accounts_records set
    status='cleared',
    updated_at=now()
  where booking_id=b.id;

  update public.bo_preparations set
    accounts_completed_at=now(),
    accounts_completed_by=auth.uid(),
    updated_at=now()
  where booking_id=b.id;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(b.branch_id, auth.uid(), 'accounts.clearance_completed', b.id, b.revision,
    'Accounts clearance completed (Commercial Invoice, FASTag, and Road Tax finalized)');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','complete_accounts_clearance','booking',b.id), b.id);

  return b.id;
end $$;

-- 6. RLS Policies on accounts_records
alter table public.accounts_records enable row level security;
drop policy if exists accounts_records_read on public.accounts_records;

create policy accounts_records_read on public.accounts_records for select to authenticated using(
  exists(
    select 1 from public.memberships m
    join public.bookings b on b.id = accounts_records.booking_id
    where m.branch_id = accounts_records.branch_id
      and m.staff_id = auth.uid()
      and m.active
      and (
        m.role in ('Accounts','Cashier','BO','SM','Admin')
        or (m.role in ('SO','TL') and b.team_id = m.team_id)
      )
  )
);

grant select on public.accounts_records to authenticated;
grant execute on function public.record_vehicle_invoice to authenticated;
grant execute on function public.record_fastag_issuance to authenticated;
grant execute on function public.acknowledge_fastag_handover to authenticated;
grant execute on function public.record_road_tax_payment to authenticated;
grant execute on function public.complete_accounts_clearance to authenticated;

alter table public.accounts_records owner to filesdigi_commands;
