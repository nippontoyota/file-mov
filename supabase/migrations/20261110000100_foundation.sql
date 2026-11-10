-- M1 / R-02, R-19, R-22, R-23. Synthetic scope defaults, not Q-03 sign-off.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
do $$ begin
  if not exists(select 1 from pg_roles where rolname = 'filesdigi_commands') then
    create role filesdigi_commands nologin noinherit;
  end if;
end $$;
-- Supabase reasserts auth schema ACLs during bootstrap; inherit its stable API role usage.
-- This is one-way: API roles never inherit the command owner.
grant authenticated to filesdigi_commands with inherit true;
grant filesdigi_commands to postgres;
grant create on schema public, private to filesdigi_commands;
grant usage on schema public, private, auth to filesdigi_commands;
revoke all on auth.users from filesdigi_commands;
grant execute on function auth.uid(), auth.jwt() to filesdigi_commands;

create type public.staff_role as enum ('SO', 'TL', 'SM', 'BO', 'Insurance', 'Accounts', 'Cashier', 'Accessories', 'Security', 'Admin');
create table public.branches (
  id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 1 and 100)
);
create table public.teams (
  id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches,
  name text not null check (length(name) between 1 and 100), unique(id, branch_id)
);
create table public.staff (
  id uuid primary key references auth.users on delete restrict,
  display_name text not null check (length(display_name) between 1 and 100),
  active boolean not null default true
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.staff,
  branch_id uuid not null references public.branches, team_id uuid,
  role public.staff_role not null, active boolean not null default true,
  revision integer not null default 1 check (revision > 0),
  foreign key(team_id, branch_id) references public.teams(id, branch_id),
  check ((role in ('SO', 'TL') and team_id is not null) or (role not in ('SO', 'TL') and team_id is null)),
  unique nulls not distinct (staff_id, branch_id, team_id, role)
);
create index on public.memberships (staff_id, branch_id) where active;
create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches,
  team_id uuid, role public.staff_role not null check (role <> 'Admin'),
  email text not null check (email = lower(email) and length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  display_name text not null check (length(display_name) between 1 and 100),
  invited_by uuid not null references public.staff, created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.staff, accepted_at timestamptz,
  foreign key(team_id, branch_id) references public.teams(id, branch_id),
  check ((role in ('SO', 'TL') and team_id is not null) or (role not in ('SO', 'TL') and team_id is null)),
  check ((accepted_by is null) = (accepted_at is null))
);
create table public.audit_events (
  id bigint generated always as identity primary key, branch_id uuid not null references public.branches,
  actor_id uuid not null references public.staff, action text not null, target_id uuid not null,
  revision integer, reason text, occurred_at timestamptz not null default now()
);
create table private.command_results (
  actor_id uuid not null references public.staff, operation_id uuid not null,
  input jsonb not null, result uuid not null, primary key(actor_id, operation_id)
);

-- These helpers never accept an actor from the caller.
-- Auth owns/RLS-protects auth.users. Keep one scalar, no-argument identity read
-- under the migration owner; the command role gets no direct Auth-table access.
create function private.confirmed_email() returns text language sql stable security definer set search_path = '' as $$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null
$$;
create function private.is_active() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.staff s where s.id = auth.uid() and s.active)
$$;
create function private.has_branch(p_branch uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists(select 1 from public.memberships m where m.staff_id = auth.uid() and m.branch_id = p_branch and m.active)
$$;
create function private.is_admin(p_branch uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists(select 1 from public.memberships m where m.staff_id = auth.uid() and m.branch_id = p_branch and m.role = 'Admin' and m.active)
$$;
create function private.can_view_staff(p_staff uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active() and (p_staff = auth.uid() or exists(
    select 1 from public.memberships m where m.staff_id = p_staff and private.is_admin(m.branch_id)))
$$;
create function private.can_view_team(p_team uuid, p_branch uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists(select 1 from public.memberships m
    where m.staff_id = auth.uid() and m.active and m.branch_id = p_branch
    and (m.team_id = p_team or m.role in ('SM', 'Admin')))
$$;

alter table public.branches enable row level security;
alter table public.teams enable row level security;
alter table public.staff enable row level security;
alter table public.memberships enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.audit_events enable row level security;
alter table private.command_results enable row level security;
create policy branch_read on public.branches for select to authenticated using (private.has_branch(id));
create policy team_read on public.teams for select to authenticated using (private.can_view_team(id, branch_id));
create policy staff_read on public.staff for select to authenticated using (private.can_view_staff(id));
create policy membership_read on public.memberships for select to authenticated using (
  private.is_active() and ((staff_id = auth.uid() and active) or private.is_admin(branch_id)));
create policy invitation_read on public.staff_invitations for select to authenticated using (private.is_admin(branch_id));
create policy audit_read on public.audit_events for select to authenticated using (private.is_admin(branch_id));

create function public.create_staff_invitation(
  p_operation uuid, p_branch uuid, p_role public.staff_role, p_email text, p_name text, p_team uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_input jsonb; v_saved private.command_results;
begin
  if not private.is_admin(p_branch) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_operation is null or p_role = 'Admin' or p_role is null or p_email is null or p_name is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  -- Lock the actor's operation key before checking the recorded outcome, including concurrent retries.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || p_operation::text, 0));
  v_input := jsonb_build_object('command', 'invite', 'branch', p_branch, 'team', p_team, 'role', p_role, 'email', lower(trim(p_email)), 'name', trim(p_name));
  select * into v_saved from private.command_results where actor_id = auth.uid() and operation_id = p_operation;
  if found then
    if v_saved.input <> v_input then raise exception 'operation_reused' using errcode = '22023'; end if;
    return v_saved.result;
  end if;
  insert into public.staff_invitations(branch_id, team_id, role, email, display_name, invited_by)
    values (p_branch, p_team, p_role, lower(trim(p_email)), trim(p_name), auth.uid()) returning id into v_id;
  insert into public.audit_events(branch_id, actor_id, action, target_id) values(p_branch, auth.uid(), 'staff.invited', v_id);
  insert into private.command_results values(auth.uid(), p_operation, v_input, v_id);
  return v_id;
end $$;

create function public.accept_staff_invitation(p_invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_inv public.staff_invitations; v_email text; v_id uuid;
begin
  v_email := private.confirmed_email();
  if v_email is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_inv from public.staff_invitations where id = p_invitation for update;
  if not found or v_inv.email <> v_email then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists(select 1 from public.staff where id = auth.uid() and not active) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_inv.accepted_by = auth.uid() then return v_inv.id; end if;
  if v_inv.accepted_by is not null or v_inv.expires_at <= now() or not exists(
    select 1 from public.memberships m join public.staff s on s.id = m.staff_id
    where m.staff_id = v_inv.invited_by and s.active and m.active and m.role = 'Admin' and m.branch_id = v_inv.branch_id
  ) then raise exception 'invitation_unavailable' using errcode = '42501'; end if;
  insert into public.staff(id, display_name) values(auth.uid(), v_inv.display_name) on conflict(id) do nothing;
  -- Existing assignments, including revoked ones, cannot be silently reactivated by an invitation.
  insert into public.memberships(staff_id, branch_id, team_id, role)
    values(auth.uid(), v_inv.branch_id, v_inv.team_id, v_inv.role) returning id into v_id;
  update public.staff_invitations set accepted_by = auth.uid(), accepted_at = now() where id = v_inv.id;
  insert into public.audit_events(branch_id, actor_id, action, target_id, revision)
    values(v_inv.branch_id, auth.uid(), 'staff.invitation_accepted', v_id, 1);
  return v_inv.id;
end $$;

create function public.set_membership_active(p_operation uuid, p_membership uuid, p_revision integer, p_active boolean, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_m public.memberships; v_saved private.command_results; v_input jsonb;
begin
  if auth.uid() is null or not private.is_active() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_operation is null or p_active is null or p_revision is null or p_reason is null or length(trim(p_reason)) not between 1 and 500 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || p_operation::text, 0));
  select * into v_m from public.memberships where id = p_membership for update;
  if not found or not private.is_admin(v_m.branch_id) or v_m.staff_id = auth.uid() or v_m.role = 'Admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_input := jsonb_build_object('command', 'membership', 'id', p_membership, 'revision', p_revision, 'active', p_active, 'reason', trim(p_reason));
  select * into v_saved from private.command_results where actor_id = auth.uid() and operation_id = p_operation;
  if found then
    if v_saved.input <> v_input then raise exception 'operation_reused' using errcode = '22023'; end if;
    return v_saved.result;
  end if;
  if v_m.revision <> p_revision then raise exception 'stale_revision' using errcode = '40001'; end if;
  if v_m.active = p_active then raise exception 'invalid_transition' using errcode = '22023'; end if;
  update public.memberships set active = p_active, revision = revision + 1 where id = v_m.id;
  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(v_m.branch_id, auth.uid(), case when p_active then 'membership.activated' else 'membership.deactivated' end, v_m.id, v_m.revision + 1, trim(p_reason));
  insert into private.command_results values(auth.uid(), p_operation, v_input, v_m.id);
  return v_m.id;
end $$;

-- Deny routine table mutations and hidden bookkeeping reads, including service-role business writes.
revoke all on public.branches, public.teams, public.staff, public.memberships, public.staff_invitations, public.audit_events from public, anon, authenticated, service_role;
grant select on public.branches, public.teams, public.staff, public.memberships, public.staff_invitations, public.audit_events to authenticated;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.confirmed_email() to filesdigi_commands;
grant execute on function private.is_active(), private.has_branch(uuid), private.is_admin(uuid), private.can_view_staff(uuid), private.can_view_team(uuid, uuid) to authenticated;
revoke all on function public.create_staff_invitation(uuid,uuid,public.staff_role,text,text,uuid), public.accept_staff_invitation(uuid), public.set_membership_active(uuid,uuid,integer,boolean,text) from public, anon, authenticated, service_role;
grant execute on function public.create_staff_invitation(uuid,uuid,public.staff_role,text,text,uuid), public.accept_staff_invitation(uuid), public.set_membership_active(uuid,uuid,integer,boolean,text) to authenticated;

-- Limited non-login owner; no membership in this role is granted to API roles.
alter table public.branches owner to filesdigi_commands;
alter table public.teams owner to filesdigi_commands;
alter table public.staff owner to filesdigi_commands;
alter table public.memberships owner to filesdigi_commands;
alter table public.staff_invitations owner to filesdigi_commands;
alter table public.audit_events owner to filesdigi_commands;
alter table private.command_results owner to filesdigi_commands;
alter function private.is_active() owner to filesdigi_commands;
alter function private.has_branch(uuid) owner to filesdigi_commands;
alter function private.is_admin(uuid) owner to filesdigi_commands;
alter function private.can_view_staff(uuid) owner to filesdigi_commands;
alter function private.can_view_team(uuid,uuid) owner to filesdigi_commands;
alter function public.create_staff_invitation(uuid,uuid,public.staff_role,text,text,uuid) owner to filesdigi_commands;
alter function public.accept_staff_invitation(uuid) owner to filesdigi_commands;
alter function public.set_membership_active(uuid,uuid,integer,boolean,text) owner to filesdigi_commands;
revoke create on schema public, private from filesdigi_commands;

-- No upload/read policies until Q-02/Q-03 define document permissions. Private, fail closed.
insert into storage.buckets(id, name, public) values('booking-documents', 'booking-documents', false);
