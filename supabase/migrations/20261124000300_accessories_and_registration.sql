-- Migration: 20261124000300_accessories_and_registration.sql
-- Accessories Department Workflow (SRC-X01 to SRC-X08, SRC-H10, SRC-H11)
-- RTO Registration Completion (SRC-B06, SRC-H08)

-- 1. Table: accessories_records
create table if not exists public.accessories_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,

  -- Item checklist & stock check (SRC-X01, SRC-X02, SRC-X03)
  items jsonb not null default '[]'::jsonb,
  stock_status text not null default 'pending' check(stock_status in ('pending', 'full_stock', 'partial_stock')),

  -- Accessory Commercial Billing (SRC-X04, SRC-X05)
  bill_number text check(bill_number is null or length(bill_number) between 1 and 64),
  bill_date date,
  parts_amount numeric(12,2) default 0 check(parts_amount is null or parts_amount >= 0),
  labour_amount numeric(12,2) default 0 check(labour_amount is null or labour_amount >= 0),
  total_bill_amount numeric(12,2) default 0 check(total_bill_amount is null or total_bill_amount >= 0),
  bill_document_id uuid references public.booking_documents(id) on delete set null,
  billed_by uuid references public.staff(id),
  billed_at timestamptz,

  -- Profit / Loss & Margin Signature (SRC-X06)
  cost_amount numeric(12,2) default 0 check(cost_amount is null or cost_amount >= 0),
  profit_loss_amount numeric(12,2),
  margin_percentage numeric(5,2),
  margin_signed boolean not null default false,
  margin_signed_by uuid references public.staff(id),
  margin_signed_at timestamptz,

  -- Payment & Handoff Tracking (SRC-X04, SRC-X07, SRC-X08)
  payment_status text not null default 'pending' check(payment_status in ('pending', 'collected', 'foc_scheme')),
  status text not null default 'pending' check(status in ('pending', 'in_progress', 'fitted', 'billed', 'submitted_so', 'forwarded_bo', 'completed')),
  so_collected_at timestamptz,
  so_collected_by uuid references public.staff(id),
  bo_forwarded_at timestamptz,
  bo_forwarded_by uuid references public.staff(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Add RTO Registration & Accessories Completion to bo_preparations
alter table public.bo_preparations
  add column if not exists rto_registration_no text check(rto_registration_no is null or length(rto_registration_no) between 1 and 32),
  add column if not exists rto_registration_date date,
  add column if not exists rto_location text check(rto_location is null or length(rto_location) between 1 and 64),
  add column if not exists hsrp_status text not null default 'pending' check(hsrp_status in ('pending', 'received', 'fitted')),
  add column if not exists rc_status text not null default 'pending' check(rc_status in ('pending', 'generated', 'dispatched', 'received')),
  add column if not exists rto_completed_at timestamptz,
  add column if not exists rto_completed_by uuid references public.staff(id),
  add column if not exists accessories_completed_at timestamptz,
  add column if not exists accessories_completed_by uuid references public.staff(id);

-- 3. Update booking_documents check constraint to include accessories bill and RTO documents
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
    'rto_rc_copy'
  ));

-- 4. Update document locking to support Accessories & RTO documents
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
      where m.staff_id=auth.uid() and m.role='BO' and m.branch_id=b.branch_id and m.active and s.active for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;
    if b.state<>'bo_review' then raise exception 'forbidden' using errcode='42501'; end if;

  elsif p_kind = 'payment_receipt' then
    perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
      where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active
        and (
          (m.role='SO' and m.team_id=b.team_id and b.so_id=auth.uid() and b.state in ('draft', 'allocated'))
          or (m.role in ('Cashier', 'Accessories'))
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
        or (b.state = 'bo_review' and m.role = 'BO' and d.kind in ('form20','disclaimer','vahan_ack','rto_rc_copy'))
        or (d.kind = 'payment_receipt' and (
          (b.state in ('draft', 'allocated') and b.so_id = auth.uid() and m.role = 'SO' and m.team_id = b.team_id)
          or (m.role in ('Cashier', 'Accessories'))
        ))
        or (d.kind = 'insurance_policy' and m.role = 'Insurance' and exists (
          select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.insurance_dispatched_at is not null
        ))
        or (d.kind in ('vehicle_invoice','road_tax_receipt','fastag_document') and m.role = 'Accounts' and exists (
          select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accounts_dispatched_at is not null
        ))
        or (d.kind = 'accessories_bill' and m.role in ('Accessories','Admin') and exists (
          select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accessories_dispatched_at is not null
        ))
      )
  )
$$;

-- 6. Stored Procedures for Accessories & RTO Registration

-- 6A. record_accessories_work (SRC-X01, SRC-X02, SRC-X03)
create or replace function public.record_accessories_work(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_items jsonb,
  p_stock_status text
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
      and m.role in ('Accessories','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accessories_dispatched_at is not null) then
    raise exception 'accessories_not_dispatched' using errcode='42501';
  end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  if p_stock_status is null or p_stock_status not in ('full_stock', 'partial_stock') then
    raise exception 'invalid_stock_status' using errcode='22023';
  end if;

  insert into public.accessories_records(
    booking_id, branch_id, items, stock_status, status, updated_at
  ) values (
    b.id, v_branch, coalesce(p_items, '[]'::jsonb), p_stock_status,
    case when p_stock_status = 'full_stock' then 'fitted' else 'in_progress' end, now()
  )
  on conflict (booking_id) do update set
    items=excluded.items,
    stock_status=excluded.stock_status,
    status=case when accessories_records.status in ('billed','submitted_so','forwarded_bo','completed') then accessories_records.status
                when excluded.stock_status = 'full_stock' then 'fitted' else 'in_progress' end,
    updated_at=now();

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'accessories.work_recorded', b.id, b.revision,
    'Accessory preparation updated (Stock status: ' || p_stock_status || ')');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','record_accessories_work','booking',b.id), b.id);

  return b.id;
end $$;



-- 6B. record_accessories_bill (SRC-X05, SRC-X06)
create or replace function public.record_accessories_bill(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_bill_number text,
  p_bill_date date,
  p_parts_amount numeric,
  p_labour_amount numeric,
  p_total_amount numeric,
  p_cost_amount numeric default 0,
  p_document_id uuid default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_branch uuid;
  v_profit numeric(12,2);
  v_margin numeric(5,2);
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
      and m.role in ('Accessories','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  if not exists (select 1 from public.bo_preparations prep where prep.booking_id=b.id and prep.accessories_dispatched_at is not null) then
    raise exception 'accessories_not_dispatched' using errcode='42501';
  end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  if p_bill_number is null or length(btrim(p_bill_number)) = 0 then
    raise exception 'missing_bill_number' using errcode='22023';
  end if;
  if p_bill_date is null then
    raise exception 'missing_bill_date' using errcode='22023';
  end if;
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'invalid_total_amount' using errcode='22023';
  end if;

  if p_document_id is not null then
    perform 1 from public.booking_documents
      where id=p_document_id and booking_id=b.id and kind='accessories_bill' and status in ('ready','finalized');
    if not found then raise exception 'invalid_bill_document' using errcode='22023'; end if;
  end if;

  v_profit := p_total_amount - coalesce(p_cost_amount, 0);
  if p_total_amount > 0 then
    v_margin := round(((p_total_amount - coalesce(p_cost_amount, 0)) / p_total_amount) * 100, 2);
  else
    v_margin := 0;
  end if;

  insert into public.accessories_records(
    booking_id, branch_id,
    bill_number, bill_date, parts_amount, labour_amount, total_bill_amount,
    bill_document_id, billed_by, billed_at,
    cost_amount, profit_loss_amount, margin_percentage,
    payment_status, status, updated_at
  ) values (
    b.id, v_branch,
    btrim(p_bill_number), p_bill_date, coalesce(p_parts_amount, 0), coalesce(p_labour_amount, 0), p_total_amount,
    p_document_id, auth.uid(), now(),
    coalesce(p_cost_amount, 0), v_profit, v_margin,
    'collected', 'billed', now()
  )
  on conflict (booking_id) do update set
    bill_number=excluded.bill_number,
    bill_date=excluded.bill_date,
    parts_amount=excluded.parts_amount,
    labour_amount=excluded.labour_amount,
    total_bill_amount=excluded.total_bill_amount,
    bill_document_id=coalesce(excluded.bill_document_id, accessories_records.bill_document_id),
    billed_by=auth.uid(),
    billed_at=now(),
    cost_amount=excluded.cost_amount,
    profit_loss_amount=excluded.profit_loss_amount,
    margin_percentage=excluded.margin_percentage,
    payment_status='collected',
    status=case when accessories_records.status in ('submitted_so','forwarded_bo','completed') then accessories_records.status else 'billed' end,
    updated_at=now();

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'accessories.bill_recorded', b.id, b.revision,
    'Accessory bill ' || btrim(p_bill_number) || ' recorded for Rs. ' || p_total_amount::text || ' (Margin: ' || v_margin::text || '%)');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','record_accessories_bill','booking',b.id,'bill',btrim(p_bill_number)), b.id);

  return b.id;
end $$;

-- 6C. sign_accessories_margin (SRC-X06)
create or replace function public.sign_accessories_margin(
  p_operation uuid,
  p_booking uuid,
  p_revision integer
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_rec public.accessories_records;
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
      and m.role in ('Accessories','SM','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  select * into v_rec from public.accessories_records where booking_id=b.id;
  if not found or v_rec.bill_number is null then
    raise exception 'bill_not_recorded' using errcode='22023';
  end if;

  update public.accessories_records set
    margin_signed=true,
    margin_signed_by=auth.uid(),
    margin_signed_at=now(),
    updated_at=now()
  where booking_id=b.id;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'accessories.margin_signed', b.id, b.revision,
    'Accessory profit/loss and margin details confirmed and signed prior to delivery');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','sign_accessories_margin','booking',b.id), b.id);

  return b.id;
end $$;

-- 6D. submit_accessories_to_bo (SRC-X07)
create or replace function public.submit_accessories_to_bo(
  p_operation uuid,
  p_booking uuid,
  p_revision integer
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_rec public.accessories_records;
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
      and m.role in ('SO','Admin') and (m.role='Admin' or m.team_id=b.team_id) for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  select * into v_rec from public.accessories_records where booking_id=b.id;
  if not found or v_rec.bill_number is null then
    raise exception 'bill_missing' using errcode='22023';
  end if;
  if not v_rec.margin_signed then
    raise exception 'margin_signature_required' using errcode='22023';
  end if;

  update public.accessories_records set
    status='submitted_so',
    so_collected_at=now(),
    so_collected_by=auth.uid(),
    updated_at=now()
  where booking_id=b.id;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'accessories.submitted_to_bo', b.id, b.revision,
    'SO collected accessory bills and handed over file to Back Office');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','submit_accessories_to_bo','booking',b.id), b.id);

  return b.id;
end $$;

-- 6E. forward_accessories_to_accounts (SRC-X08)
create or replace function public.forward_accessories_to_accounts(
  p_operation uuid,
  p_booking uuid,
  p_revision integer
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  v_rec public.accessories_records;
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
      and m.role in ('BO','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  select * into v_rec from public.accessories_records where booking_id=b.id;
  if not found or v_rec.status not in ('submitted_so', 'billed') then
    raise exception 'invalid_submission_state' using errcode='22023';
  end if;

  update public.accessories_records set
    status='forwarded_bo',
    bo_forwarded_at=now(),
    bo_forwarded_by=auth.uid(),
    updated_at=now()
  where booking_id=b.id;

  update public.bo_preparations set
    accessories_completed_at=now(),
    accessories_completed_by=auth.uid(),
    updated_at=now()
  where booking_id=b.id;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'accessories.forwarded_to_accounts', b.id, b.revision,
    'Back Office forwarded accessory bills to Accounts for final review & closure');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','forward_accessories_to_accounts','booking',b.id), b.id);

  return b.id;
end $$;

-- 6F. record_rto_registration (SRC-B06, SRC-H08)
create or replace function public.record_rto_registration(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_registration_no text,
  p_registration_date date,
  p_location text,
  p_hsrp_status text default 'fitted',
  p_rc_status text default 'generated'
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
      and m.role in ('BO','Admin') for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Road tax must be paid before RTO registration (SRC-H08)
  if not exists (select 1 from public.accounts_records ar where ar.booking_id=b.id and ar.road_tax_receipt_no is not null) then
    raise exception 'road_tax_required_for_rto' using errcode='22023';
  end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision <> p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  if p_registration_no is null or length(btrim(p_registration_no)) = 0 then
    raise exception 'missing_registration_no' using errcode='22023';
  end if;

  update public.bo_preparations set
    rto_registration_no=btrim(p_registration_no),
    rto_registration_date=coalesce(p_registration_date, current_date),
    rto_location=btrim(p_location),
    hsrp_status=coalesce(p_hsrp_status, 'fitted'),
    rc_status=coalesce(p_rc_status, 'generated'),
    rto_completed_at=now(),
    rto_completed_by=auth.uid(),
    updated_at=now()
  where booking_id=b.id;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
  values(v_branch, auth.uid(), 'rto.registration_recorded', b.id, b.revision,
    'Official RTO registration number recorded: ' || btrim(p_registration_no) || ' (HSRP: ' || coalesce(p_hsrp_status,'fitted') || ')');

  insert into private.command_results values(auth.uid(), p_operation, jsonb_build_object('cmd','record_rto_registration','booking',b.id,'reg',btrim(p_registration_no)), b.id);

  return b.id;
end $$;

-- 7. RLS Policies on accessories_records
alter table public.accessories_records enable row level security;
drop policy if exists accessories_records_read on public.accessories_records;

create policy accessories_records_read on public.accessories_records for select to authenticated using(
  exists(
    select 1 from public.memberships m
    join public.bookings b on b.id = accessories_records.booking_id
    where m.branch_id = accessories_records.branch_id
      and m.staff_id = auth.uid()
      and m.active
      and (
        m.role in ('Accessories','BO','SM','Accounts','Cashier','Admin')
        or (m.role in ('SO','TL') and b.team_id = m.team_id)
      )
  )
);

grant select on public.accessories_records to authenticated;
grant execute on function public.record_accessories_work to authenticated;
grant execute on function public.record_accessories_bill to authenticated;
grant execute on function public.sign_accessories_margin to authenticated;
grant execute on function public.submit_accessories_to_bo to authenticated;
grant execute on function public.forward_accessories_to_accounts to authenticated;
grant execute on function public.record_rto_registration to authenticated;

alter table public.accessories_records owner to filesdigi_commands;
