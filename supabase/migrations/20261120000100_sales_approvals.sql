-- CHG-09 / M2 Phase 1: Team Leader approval, Sales Manager approval, and allocation.
-- D-14: TL approves first, then SM; both are required before BO receives approved work.
grant create on schema public, private to filesdigi_commands;

alter table public.bookings drop constraint bookings_state_check;
alter table public.bookings add constraint bookings_state_check check(state in ('draft','tl_review','sm_review','bo_review'));

alter table public.sales_submissions
  add column if not exists tl_approved_by uuid references public.staff,
  add column if not exists tl_approved_at timestamptz,
  add column if not exists tl_approver_name text,
  add column if not exists sm_approved_by uuid references public.staff,
  add column if not exists sm_approved_at timestamptz,
  add column if not exists sm_approver_name text,
  add column if not exists allocation_ref text check(allocation_ref is null or length(allocation_ref) between 1 and 100);

create or replace function private.submission_evidence() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='INSERT' then select display_name into new.sender_name from public.staff where id=new.sent_by; end if;
  if new.received_by is not null and (TG_OP='INSERT' or old.received_by is distinct from new.received_by) then
    select display_name into new.receiver_name from public.staff where id=new.received_by;
  end if;
  if new.tl_approved_by is not null and (TG_OP='INSERT' or old.tl_approved_by is distinct from new.tl_approved_by) then
    select display_name into new.tl_approver_name from public.staff where id=new.tl_approved_by;
  end if;
  if new.sm_approved_by is not null and (TG_OP='INSERT' or old.sm_approved_by is distinct from new.sm_approved_by) then
    select display_name into new.sm_approver_name from public.staff where id=new.sm_approved_by;
  end if;
  return new;
end $$;

create or replace function public.approve_booking_tl(p_operation uuid, p_booking uuid, p_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.bookings; handoff public.sales_submissions; req jsonb; saved private.command_results; actor_name text;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object('command','approve_tl','booking',p_booking,'revision',p_revision);
  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if not private.can_read_booking_id(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
    if saved.input <> req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;
  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.team_id=b.team_id and m.role='TL' and m.active and s.active for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select * into b from public.bookings where id=p_booking for update;
  if b.state <> 'tl_review' then raise exception 'forbidden' using errcode='42501'; end if;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;
  select * into handoff from public.sales_submissions where booking_id=b.id for update;
  if not found or handoff.received_at is null then raise exception 'receipt_required' using errcode='22023'; end if;
  if handoff.tl_approved_at is not null then return b.id; end if;
  update public.bookings set state='sm_review', revision=revision+1, updated_at=now() where id=b.id returning * into b;
  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id, revision, data, actor_id, actor_name, form_version)
    values(b.id, b.revision, b.data, auth.uid(), actor_name, b.form_version);
  update public.sales_submissions set tl_approved_by=auth.uid(), tl_approved_at=now() where booking_id=b.id;
  insert into public.audit_events(branch_id, actor_id, action, target_id, revision)
    values(b.branch_id, auth.uid(), 'booking.approved_by_tl', b.id, b.revision);
  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

create or replace function public.approve_booking_sm(p_operation uuid, p_booking uuid, p_revision integer, p_allocation_ref text) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.bookings; handoff public.sales_submissions; req jsonb; saved private.command_results; actor_name text; alloc text;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  alloc := nullif(btrim(p_allocation_ref),'');
  if alloc is null or length(alloc) > 100 then raise exception 'allocation_ref_required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object('command','approve_sm','booking',p_booking,'revision',p_revision,'allocation',alloc);
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
  if handoff.sm_approved_at is not null then return b.id; end if;
  update public.bookings set state='bo_review', revision=revision+1, updated_at=now() where id=b.id returning * into b;
  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id, revision, data, actor_id, actor_name, form_version)
    values(b.id, b.revision, b.data, auth.uid(), actor_name, b.form_version);
  update public.sales_submissions set sm_approved_by=auth.uid(), sm_approved_at=now(), allocation_ref=alloc where booking_id=b.id;
  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'booking.approved_by_sm', b.id, b.revision, alloc);
  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

create or replace function private.can_read_booking(p_branch uuid,p_team uuid,p_so uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists(select 1 from public.memberships m
    where m.staff_id=auth.uid() and m.active and m.branch_id=p_branch and
      ((m.role='SO' and p_so=auth.uid() and m.team_id=p_team)
        or (m.role='TL' and m.team_id=p_team) or m.role='SM'))
$$;

create or replace function private.can_read_booking_id(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.bookings b
    where b.id=p_booking and (
      private.can_read_booking(b.branch_id,b.team_id,b.so_id)
      or (b.state='bo_review' and exists(select 1 from public.memberships m where m.staff_id=auth.uid() and m.active and m.branch_id=b.branch_id and m.role='BO'))
    )
  )
$$;

drop policy if exists booking_read on public.bookings;
create policy booking_read on public.bookings for select to authenticated using(
  private.can_read_booking(branch_id,team_id,so_id)
  or (state='bo_review' and exists(select 1 from public.memberships m where m.staff_id=auth.uid() and m.active and m.branch_id=bookings.branch_id and m.role='BO'))
);

drop policy if exists version_read on public.booking_versions;
create policy version_read on public.booking_versions for select to authenticated using(
  private.can_read_booking_id(booking_id)
);

alter function public.approve_booking_tl(uuid,uuid,integer) owner to filesdigi_commands;
alter function public.approve_booking_sm(uuid,uuid,integer,text) owner to filesdigi_commands;
revoke all on function public.approve_booking_tl(uuid,uuid,integer),public.approve_booking_sm(uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.approve_booking_tl(uuid,uuid,integer),public.approve_booking_sm(uuid,uuid,integer,text) to authenticated;
revoke create on schema public, private from filesdigi_commands;
