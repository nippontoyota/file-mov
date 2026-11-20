-- CHG-11: Cashier payments counter, booking advance verification, and 4 payment modes.
-- D-17: Cashier handles collection evidence, verification, and receipt issuance.
grant create on schema public, private to filesdigi_commands;

-- 1. Expand booking_documents kind check to include 'payment_receipt'
alter table public.booking_documents drop constraint if exists booking_documents_kind_check;
alter table public.booking_documents add constraint booking_documents_kind_check
  check(kind in ('aadhaar','pan','form20','disclaimer','vahan_ack','payment_receipt'));

-- 2. Update document locking to allow SO (in draft) and Cashier (for payment_receipt)
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
        (m.role='SO' and m.team_id=b.team_id and b.so_id=auth.uid() and b.state='draft')
        or m.role='Cashier'
      ) for share of m,s;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
    select * into b from public.bookings where id=p_booking for update;
  else
    raise exception 'invalid_kind' using errcode='22023';
  end if;
  return b;
end $$;

-- 3. Update storage insert check for payment_receipt
create or replace function private.document_object_insert(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.booking_documents d
    join public.bookings b on b.id = d.booking_id
    join public.memberships m on m.branch_id = b.branch_id and m.staff_id = auth.uid() and m.active
    where d.id::text = p_name and d.status = 'pending' and d.uploaded_by = auth.uid()
      and (
        (b.state = 'draft' and b.so_id = auth.uid() and m.role = 'SO' and m.team_id = b.team_id and d.kind in ('aadhaar','pan','payment_receipt'))
        or (b.state = 'bo_review' and m.role = 'BO' and d.kind in ('form20','disclaimer','vahan_ack'))
        or (m.role = 'Cashier' and d.kind = 'payment_receipt')
      )
  )
$$;

-- 4. Table: public.booking_payments
create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  payment_type text not null default 'booking_advance' check(payment_type in ('booking_advance', 'accessories', 'margin_money')),
  amount numeric(12,2) not null check(amount > 0),
  payment_method text not null check(payment_method in ('card', 'upi', 'cheque', 'cash')),
  reference_no text not null check(length(reference_no) between 1 and 100),
  proof_document_id uuid references public.booking_documents(id),
  status text not null default 'pending_verification' check(status in ('pending_verification', 'verified', 'rejected')),
  receipt_no text check(receipt_no is null or length(receipt_no) between 1 and 50),
  verified_by uuid references public.staff(id),
  verified_at timestamptz,
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_payments_branch_status on public.booking_payments(branch_id, status);
create index if not exists booking_payments_booking_idx on public.booking_payments(booking_id);

-- 5. Scope & RLS for booking_payments
alter table public.booking_payments enable row level security;

create or replace function private.can_read_payment(p_branch uuid, p_booking uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.memberships m
    where m.staff_id=auth.uid() and m.active and m.branch_id=p_branch and (
      m.role='Cashier' or private.can_read_booking_id(p_booking)
    )
  )
$$;

drop policy if exists payment_read on public.booking_payments;
create policy payment_read on public.booking_payments for select to authenticated using(
  private.can_read_payment(branch_id, booking_id)
);
grant select on public.booking_payments to authenticated;

-- 6. Stored procedure: record_booking_payment
create or replace function public.record_booking_payment(
  p_operation uuid,
  p_booking uuid,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_proof_document uuid default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  req jsonb;
  saved private.command_results;
  v_method text;
  v_ref text;
  v_id uuid;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount' using errcode='22023'; end if;
  v_method := btrim(lower(coalesce(p_method, '')));
  if v_method not in ('card', 'upi', 'cheque', 'cash') then raise exception 'invalid_payment_method' using errcode='22023'; end if;
  v_ref := nullif(btrim(coalesce(p_reference, '')), '');
  if v_ref is null or length(v_ref) > 100 then raise exception 'invalid_reference' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object(
    'command', 'record_booking_payment',
    'booking', p_booking,
    'amount', p_amount,
    'method', v_method,
    'reference', v_ref,
    'proof_document', p_proof_document
  );

  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if saved.input <> req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Must be SO in draft or Cashier in branch
  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.active and s.active and (
      (m.role='SO' and m.team_id=b.team_id and b.so_id=auth.uid() and b.state='draft')
      or m.role='Cashier'
    ) for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  insert into public.booking_payments(
    booking_id, branch_id, payment_type, amount, payment_method, reference_no, proof_document_id, created_by
  ) values (
    b.id, b.branch_id, 'booking_advance', p_amount, v_method, v_ref, p_proof_document, auth.uid()
  ) returning id into v_id;

  insert into public.audit_events(branch_id, actor_id, action, target_id, reason)
    values(b.branch_id, auth.uid(), 'cashier.payment_recorded', v_id, v_method || ':' || p_amount::text);

  insert into private.command_results values(auth.uid(), p_operation, req, v_id);
  return v_id;
end $$;

-- 7. Stored procedure: verify_booking_payment
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

  update public.booking_payments set
    status = 'verified',
    receipt_no = v_receipt,
    proof_document_id = coalesce(p_proof_document, pay.proof_document_id),
    verified_by = auth.uid(),
    verified_at = now(),
    updated_at = now()
  where id = pay.id;

  insert into public.audit_events(branch_id, actor_id, action, target_id, reason)
    values(pay.branch_id, auth.uid(), 'cashier.payment_verified', pay.id, v_receipt);

  insert into private.command_results values(auth.uid(), p_operation, req, pay.id);
  return pay.id;
end $$;

-- 8. Ownership & Permissions
alter table public.booking_payments owner to filesdigi_commands;
alter function private.can_read_payment(uuid, uuid) owner to filesdigi_commands;
alter function public.record_booking_payment(uuid, uuid, numeric, text, text, uuid) owner to filesdigi_commands;
alter function public.verify_booking_payment(uuid, uuid, text, uuid) owner to filesdigi_commands;

revoke all on function public.record_booking_payment(uuid, uuid, numeric, text, text, uuid),
  public.verify_booking_payment(uuid, uuid, text, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.record_booking_payment(uuid, uuid, numeric, text, text, uuid),
  public.verify_booking_payment(uuid, uuid, text, uuid)
to authenticated;

revoke create on schema public, private from filesdigi_commands;
