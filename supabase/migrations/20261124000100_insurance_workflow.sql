-- Migration: 20261124000100_insurance_workflow.sql
-- Implements Insurance desk (SRC-I01 to SRC-I11):
-- 1. Table public.insurance_policies
-- 2. Expand booking_documents constraint to include insurance_policy
-- 3. Document locking and object insert policies for Insurance role
-- 4. Stored procedure record_insurance_policy
-- 5. bo_preparations tracking for insurance completion

grant create on schema public, private to filesdigi_commands;

-- 1. Table: insurance_policies
create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  status text not null default 'pending' check(status in ('pending', 'issued', 'rejected')),
  policy_type text not null default 'comprehensive_1_3' check(policy_type in ('comprehensive_1_3', 'comprehensive_1_1', 'standalone_tp', 'own_damage_only')),
  company_name text,
  policy_number text,
  idv_amount numeric(12,2),
  premium_amount numeric(12,2),
  policy_start_date date,
  policy_end_date date,
  nominee_name text,
  nominee_relation text,
  nominee_age integer,
  hypothecation_bank text,
  add_ons jsonb not null default '[]'::jsonb,
  document_id uuid references public.booking_documents(id) on delete set null,
  issued_by uuid references public.staff(id),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(booking_id)
);

-- Ensure foreign keys on insurance_policies support cascade/set null cleanup
alter table public.insurance_policies drop constraint if exists insurance_policies_document_id_fkey;
alter table public.insurance_policies add constraint insurance_policies_document_id_fkey
  foreign key (document_id) references public.booking_documents(id) on delete set null;

-- Track completion in bo_preparations
alter table public.bo_preparations add column if not exists insurance_completed_at timestamptz;
alter table public.bo_preparations add column if not exists insurance_completed_by uuid references public.staff(id);

-- 2. Document kinds expansion for insurance_policy
alter table public.booking_documents drop constraint if exists booking_documents_kind_check;
alter table public.booking_documents add constraint booking_documents_kind_check
  check(kind in ('aadhaar','pan','form20','disclaimer','vahan_ack','payment_receipt','insurance_policy'));

-- 3. Update document locking to support insurance_policy
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

  else
    raise exception 'invalid_kind' using errcode='22023';
  end if;
  return b;
end $$;

-- 4. Document object insert policy for insurance_policy
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
      )
  )
$$;

-- 5. Stored Procedure: record_insurance_policy
drop function if exists public.record_insurance_policy(uuid,uuid,integer,text,text,text,numeric,numeric,date,date,text,text,integer,text,jsonb,uuid);
drop function if exists public.record_insurance_policy(uuid,uuid,integer,text,text,numeric,numeric,text,date,date,text,text,integer,text,jsonb,uuid);

create or replace function public.record_insurance_policy(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_company_name text,
  p_policy_number text,
  p_idv numeric,
  p_premium numeric,
  p_policy_type text default 'comprehensive_1_3',
  p_start_date date default null,
  p_end_date date default null,
  p_nominee_name text default null,
  p_nominee_relation text default null,
  p_nominee_age integer default null,
  p_hypothecation_bank text default null,
  p_add_ons jsonb default '[]'::jsonb,
  p_document_id uuid default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  prep public.bo_preparations;
  req jsonb;
  saved private.command_results;
  v_company text;
  v_policy_no text;
  v_type text;
  v_idv numeric;
  v_premium numeric;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;

  v_company := nullif(btrim(coalesce(p_company_name, '')), '');
  v_policy_no := nullif(btrim(coalesce(p_policy_number, '')), '');
  v_type := coalesce(nullif(btrim(p_policy_type), ''), 'comprehensive_1_3');
  v_idv := coalesce(p_idv, 0);
  v_premium := coalesce(p_premium, 0);

  if v_company is null then raise exception 'company_name_required' using errcode='22023'; end if;
  if v_policy_no is null then raise exception 'policy_number_required' using errcode='22023'; end if;
  if v_type not in ('comprehensive_1_3', 'comprehensive_1_1', 'standalone_tp', 'own_damage_only') then
    raise exception 'invalid_policy_type' using errcode='22023';
  end if;
  if v_idv <= 0 then raise exception 'idv_amount_positive' using errcode='22023'; end if;
  if v_premium <= 0 then raise exception 'premium_amount_positive' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object(
    'command', 'record_insurance_policy',
    'booking', p_booking,
    'revision', p_revision,
    'company', v_company,
    'policy_number', v_policy_no,
    'type', v_type,
    'idv', v_idv,
    'premium', v_premium
  );

  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if not private.can_read_booking_id(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
    if saved.input <> req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.role='Insurance' and m.active and s.active for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into prep from public.bo_preparations where booking_id=b.id for update;
  if not found or prep.insurance_dispatched_at is null then
    raise exception 'insurance_not_dispatched' using errcode='42501';
  end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  -- Insert or update policy
  insert into public.insurance_policies (
    booking_id, branch_id, status, policy_type, company_name, policy_number,
    idv_amount, premium_amount, policy_start_date, policy_end_date,
    nominee_name, nominee_relation, nominee_age, hypothecation_bank,
    add_ons, document_id, issued_by, issued_at, updated_at
  ) values (
    b.id, b.branch_id, 'issued', v_type,
    v_company, v_policy_no, v_idv, v_premium, p_start_date, p_end_date,
    p_nominee_name, p_nominee_relation, p_nominee_age, p_hypothecation_bank,
    coalesce(p_add_ons, '[]'::jsonb), p_document_id, auth.uid(), now(), now()
  )
  on conflict (booking_id) do update set
    status = 'issued',
    policy_type = excluded.policy_type,
    company_name = excluded.company_name,
    policy_number = excluded.policy_number,
    idv_amount = excluded.idv_amount,
    premium_amount = excluded.premium_amount,
    policy_start_date = excluded.policy_start_date,
    policy_end_date = excluded.policy_end_date,
    nominee_name = excluded.nominee_name,
    nominee_relation = excluded.nominee_relation,
    nominee_age = excluded.nominee_age,
    hypothecation_bank = excluded.hypothecation_bank,
    add_ons = excluded.add_ons,
    document_id = coalesce(excluded.document_id, insurance_policies.document_id),
    issued_by = auth.uid(),
    issued_at = now(),
    updated_at = now();

  -- Mark completed in bo_preparations
  update public.bo_preparations set
    insurance_completed_at = now(),
    insurance_completed_by = auth.uid(),
    updated_at = now()
  where booking_id = b.id;

  update public.bookings set revision = revision + 1, updated_at = now() where id = b.id returning * into b;

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'insurance.policy_issued', b.id, b.revision, v_policy_no || ' (' || v_company || ')');

  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

-- 6. RLS and Grants
alter table public.insurance_policies enable row level security;
drop policy if exists insurance_policies_read on public.insurance_policies;
create policy insurance_policies_read on public.insurance_policies for select to authenticated using(
  private.can_read_booking_id(booking_id)
);

grant select on public.insurance_policies to authenticated;

alter table public.insurance_policies owner to filesdigi_commands;
alter function private.lock_booking_for_document(uuid,text) owner to filesdigi_commands;
alter function private.document_object_insert(text) owner to filesdigi_commands;
alter function public.record_insurance_policy(uuid,uuid,integer,text,text,numeric,numeric,text,date,date,text,text,integer,text,jsonb,uuid) owner to filesdigi_commands;

notify pgrst, 'reload schema';
