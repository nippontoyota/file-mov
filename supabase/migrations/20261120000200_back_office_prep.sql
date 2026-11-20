-- CHG-10 / M3 Phase 2: Back Office preparation, PDI, VAHAN staging, Form 20/disclaimer ink signatures, and departmental dispatches.
-- R-08 / SRC-B01 to SRC-B05: BO coordinates preparation, statutory tracking, and dispatches to Insurance, Accounts, and Accessories.
grant create on schema public, private to filesdigi_commands;

-- 1. Table: bo_preparations
create table if not exists public.bo_preparations (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  branch_id uuid not null references public.branches(id),

  -- PDI verification
  pdi_status text not null default 'pending' check(pdi_status in ('pending','passed','rework','failed')),
  pdi_completed_by uuid references public.staff(id),
  pdi_completed_at timestamptz,
  pdi_inspector_name text,
  pdi_notes text,

  -- VAHAN Staging
  vahan_app_no text check(vahan_app_no is null or length(vahan_app_no) between 1 and 64),
  vahan_entered_by uuid references public.staff(id),
  vahan_entered_at timestamptz,

  -- Statutory documents ink signature tracking
  form20_signed boolean not null default false,
  disclaimer_signed boolean not null default false,
  documents_completed_by uuid references public.staff(id),
  documents_completed_at timestamptz,

  -- Departmental dispatches
  insurance_dispatched_at timestamptz,
  insurance_dispatched_by uuid references public.staff(id),

  accounts_dispatched_at timestamptz,
  accounts_dispatched_by uuid references public.staff(id),

  accessories_dispatched_at timestamptz,
  accessories_dispatched_by uuid references public.staff(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Initialize rows for existing bookings in bo_review
insert into public.bo_preparations(booking_id, branch_id)
select id, branch_id from public.bookings where state in ('bo_review')
on conflict (booking_id) do nothing;

-- 2. Document kinds expansion
alter table public.booking_documents drop constraint if exists booking_documents_kind_check;
alter table public.booking_documents add constraint booking_documents_kind_check
  check(kind in ('aadhaar','pan','form20','disclaimer','vahan_ack'));

-- 3. Document locking and insertion for SO drafts & BO bo_review
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
  else
    raise exception 'invalid_kind' using errcode='22023';
  end if;
  return b;
end $$;

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
      )
  )
$$;

create or replace function public.reserve_booking_document(p_operation uuid,p_booking uuid,p_revision integer,p_kind text,p_filename text,p_mime text,p_size integer,p_sha256 text) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.bookings; d uuid; n integer; req jsonb; saved private.command_results;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  b := private.lock_booking_for_document(p_booking, p_kind);
  req:=jsonb_build_object('command','reserve_document','booking',p_booking,'revision',p_revision,'kind',p_kind,'filename',p_filename,'mime',p_mime,'size',p_size,'sha256',p_sha256);
  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if saved.input<>req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;
  if p_revision is distinct from b.revision then raise exception 'stale_revision' using errcode='40001'; end if;
  if nullif(btrim(b.data->>'registration_name'),'') is null then raise exception 'registered_owner_required' using errcode='22023'; end if;
  select coalesce(max(version),0)+1 into n from public.booking_documents where booking_id=b.id and kind=p_kind;
  insert into public.booking_documents(booking_id,kind,version,owner_snapshot,filename,mime_type,byte_size,sha256,uploaded_by)
  values(b.id,p_kind,n,private.registration_subject(b.data),p_filename,p_mime,p_size,p_sha256,auth.uid()) returning id into d;
  insert into public.audit_events(branch_id,actor_id,action,target_id,revision) values(b.branch_id,auth.uid(),'document.reserved',d,b.revision);
  insert into private.command_results values(auth.uid(),p_operation,req,d);
  return d;
end $$;

create or replace function public.finalize_booking_document(p_document uuid,p_revision integer,p_attestation text) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.bookings; d public.booking_documents; signature text; actor_name text;
begin
  select * into d from public.booking_documents where id=p_document;
  if not found or d.uploaded_by<>auth.uid() or auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  b := private.lock_booking_for_document(d.booking_id, d.kind);
  select * into d from public.booking_documents where id=p_document for update;
  if d.status='ready' then return d.id; end if;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;
  select encode(extensions.hmac(d.id::text||':'||d.sha256,secret,'sha256'),'hex') into signature from private.document_verifier where singleton;
  if p_attestation is distinct from signature or not private.document_object_matches(d.id) or d.owner_snapshot<>private.registration_subject(b.data) then raise exception 'invalid_document' using errcode='22023'; end if;
  update public.booking_documents set status='ready',finalized_at=now() where id=d.id;
  update public.bookings set revision=revision+1,updated_at=now() where id=b.id returning * into b;
  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id,revision,data,actor_id,actor_name,form_version) values(b.id,b.revision,b.data,auth.uid(),actor_name,b.form_version);
  insert into public.audit_events(branch_id,actor_id,action,target_id,revision) values(b.branch_id,auth.uid(),'document.attached',d.id,b.revision);
  return d.id;
end $$;

-- 4. Scope and Read Permissions
create or replace function private.can_read_booking_id(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.bookings b
    where b.id=p_booking and (
      private.can_read_booking(b.branch_id,b.team_id,b.so_id)
      or (
        b.state not in ('draft','tl_review','sm_review') and exists(
          select 1 from public.memberships m where m.staff_id=auth.uid() and m.active and m.branch_id=b.branch_id and (
            m.role='BO'
            or (m.role='Insurance' and exists(select 1 from public.bo_preparations p where p.booking_id=b.id and p.insurance_dispatched_at is not null))
            or (m.role in ('Accounts','Cashier') and exists(select 1 from public.bo_preparations p where p.booking_id=b.id and p.accounts_dispatched_at is not null))
            or (m.role='Accessories' and exists(select 1 from public.bo_preparations p where p.booking_id=b.id and p.accessories_dispatched_at is not null))
          )
        )
      )
    )
  )
$$;

drop policy if exists booking_read on public.bookings;
create policy booking_read on public.bookings for select to authenticated using(
  private.can_read_booking_id(id)
);

alter table public.bo_preparations enable row level security;
drop policy if exists bo_preparations_read on public.bo_preparations;
create policy bo_preparations_read on public.bo_preparations for select to authenticated using(
  private.can_read_booking_id(booking_id)
);
grant select on public.bo_preparations to authenticated;

-- 5. Stored Procedures: PDI, VAHAN & Statutory, Departmental Dispatches
create or replace function public.record_bo_pdi(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_status text,
  p_inspector text,
  p_notes text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  req jsonb;
  saved private.command_results;
  actor_name text;
  v_status text;
  v_inspector text;
  v_notes text;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  v_status := btrim(lower(coalesce(p_status, '')));
  if v_status not in ('passed', 'rework', 'failed') then
    raise exception 'invalid_pdi_status' using errcode='22023';
  end if;
  v_inspector := nullif(btrim(coalesce(p_inspector, '')), '');
  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object(
    'command', 'record_bo_pdi',
    'booking', p_booking,
    'revision', p_revision,
    'status', v_status,
    'inspector', v_inspector,
    'notes', v_notes
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
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.role='BO' and m.active and s.active for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.state <> 'bo_review' then raise exception 'forbidden' using errcode='42501'; end if;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.bo_preparations(booking_id, branch_id, pdi_status, pdi_completed_by, pdi_completed_at, pdi_inspector_name, pdi_notes, updated_at)
    values(b.id, b.branch_id, v_status, auth.uid(), now(), v_inspector, v_notes, now())
  on conflict (booking_id) do update set
    pdi_status=excluded.pdi_status,
    pdi_completed_by=excluded.pdi_completed_by,
    pdi_completed_at=excluded.pdi_completed_at,
    pdi_inspector_name=excluded.pdi_inspector_name,
    pdi_notes=excluded.pdi_notes,
    updated_at=now();

  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id, revision, data, actor_id, actor_name, form_version)
    values(b.id, b.revision, b.data, auth.uid(), actor_name, b.form_version);

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'bo.pdi_recorded', b.id, b.revision, v_status);

  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

create or replace function public.record_bo_vahan_and_statutory(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_vahan_app_no text,
  p_form20_signed boolean,
  p_disclaimer_signed boolean
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  req jsonb;
  saved private.command_results;
  actor_name text;
  v_vahan text;
  v_f20 boolean;
  v_disc boolean;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  v_vahan := nullif(btrim(coalesce(p_vahan_app_no, '')), '');
  v_f20 := coalesce(p_form20_signed, false);
  v_disc := coalesce(p_disclaimer_signed, false);

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object(
    'command', 'record_bo_vahan_and_statutory',
    'booking', p_booking,
    'revision', p_revision,
    'vahan_app_no', v_vahan,
    'form20_signed', v_f20,
    'disclaimer_signed', v_disc
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
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.role='BO' and m.active and s.active for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.state <> 'bo_review' then raise exception 'forbidden' using errcode='42501'; end if;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  insert into public.bo_preparations(
    booking_id, branch_id, vahan_app_no, vahan_entered_by, vahan_entered_at,
    form20_signed, disclaimer_signed, documents_completed_by, documents_completed_at, updated_at
  ) values (
    b.id, b.branch_id, v_vahan, auth.uid(), now(),
    v_f20, v_disc, auth.uid(), now(), now()
  )
  on conflict (booking_id) do update set
    vahan_app_no=coalesce(excluded.vahan_app_no, bo_preparations.vahan_app_no),
    vahan_entered_by=case when excluded.vahan_app_no is not null then excluded.vahan_entered_by else bo_preparations.vahan_entered_by end,
    vahan_entered_at=case when excluded.vahan_app_no is not null then excluded.vahan_entered_at else bo_preparations.vahan_entered_at end,
    form20_signed=excluded.form20_signed,
    disclaimer_signed=excluded.disclaimer_signed,
    documents_completed_by=auth.uid(),
    documents_completed_at=now(),
    updated_at=now();

  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id, revision, data, actor_id, actor_name, form_version)
    values(b.id, b.revision, b.data, auth.uid(), actor_name, b.form_version);

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'bo.vahan_and_statutory_recorded', b.id, b.revision, coalesce(v_vahan, ''));

  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

create or replace function public.dispatch_bo_department(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_target_dept text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  prep public.bo_preparations;
  req jsonb;
  saved private.command_results;
  actor_name text;
  v_dept text;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  v_dept := btrim(lower(coalesce(p_target_dept, '')));
  if v_dept not in ('insurance', 'accounts', 'accessories') then
    raise exception 'invalid_target_department' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object(
    'command', 'dispatch_bo_department',
    'booking', p_booking,
    'revision', p_revision,
    'target_dept', v_dept
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
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.role='BO' and m.active and s.active for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.state <> 'bo_review' then raise exception 'forbidden' using errcode='42501'; end if;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  insert into public.bo_preparations(booking_id, branch_id)
    values(b.id, b.branch_id)
  on conflict (booking_id) do nothing;

  select * into prep from public.bo_preparations where booking_id=b.id for update;

  if v_dept = 'insurance' then
    if prep.insurance_dispatched_at is not null then return b.id; end if;
    update public.bo_preparations set insurance_dispatched_at=now(), insurance_dispatched_by=auth.uid(), updated_at=now() where booking_id=b.id;
  elsif v_dept = 'accounts' then
    if prep.accounts_dispatched_at is not null then return b.id; end if;
    update public.bo_preparations set accounts_dispatched_at=now(), accounts_dispatched_by=auth.uid(), updated_at=now() where booking_id=b.id;
  elsif v_dept = 'accessories' then
    if prep.accessories_dispatched_at is not null then return b.id; end if;
    update public.bo_preparations set accessories_dispatched_at=now(), accessories_dispatched_by=auth.uid(), updated_at=now() where booking_id=b.id;
  end if;

  update public.bookings set revision=revision+1, updated_at=now() where id=b.id returning * into b;

  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id, revision, data, actor_id, actor_name, form_version)
    values(b.id, b.revision, b.data, auth.uid(), actor_name, b.form_version);

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'bo.dispatched_' || v_dept, b.id, b.revision, v_dept);

  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

-- Update approve_booking_sm to auto-initialize bo_preparations row on handoff to BO
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
  insert into public.bo_preparations(booking_id, branch_id) values(b.id, b.branch_id) on conflict (booking_id) do nothing;
  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'booking.approved_by_sm', b.id, b.revision, alloc);
  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

-- Ownership & Privileges
alter table public.bo_preparations owner to filesdigi_commands;
alter function private.lock_booking_for_document(uuid,text) owner to filesdigi_commands;
alter function private.document_object_insert(text) owner to filesdigi_commands;
alter function public.reserve_booking_document(uuid,uuid,integer,text,text,text,integer,text) owner to filesdigi_commands;
alter function public.finalize_booking_document(uuid,integer,text) owner to filesdigi_commands;
alter function public.record_bo_pdi(uuid,uuid,integer,text,text,text) owner to filesdigi_commands;
alter function public.record_bo_vahan_and_statutory(uuid,uuid,integer,text,boolean,boolean) owner to filesdigi_commands;
alter function public.dispatch_bo_department(uuid,uuid,integer,text) owner to filesdigi_commands;
alter function public.approve_booking_sm(uuid,uuid,integer,text) owner to filesdigi_commands;

revoke all on function public.record_bo_pdi(uuid,uuid,integer,text,text,text),
  public.record_bo_vahan_and_statutory(uuid,uuid,integer,text,boolean,boolean),
  public.dispatch_bo_department(uuid,uuid,integer,text)
from public,anon,authenticated,service_role;

grant execute on function public.record_bo_pdi(uuid,uuid,integer,text,text,text),
  public.record_bo_vahan_and_statutory(uuid,uuid,integer,text,boolean,boolean),
  public.dispatch_bo_department(uuid,uuid,integer,text)
to authenticated;

revoke create on schema public, private from filesdigi_commands;
