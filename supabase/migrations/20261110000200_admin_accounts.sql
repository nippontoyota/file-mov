-- CHG-02: admin-set initial credentials. Auth creation stays server-only;
-- scope, membership and history are committed under the initiating admin JWT.
grant create on schema public to filesdigi_commands;
create function private.provisioned_identity(p_invitation uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u join public.staff_invitations i
    on lower(u.email) = i.email
  where i.id = p_invitation and u.email_confirmed_at is not null
    and u.raw_app_meta_data ->> 'filesdigi_invitation' = p_invitation::text
$$;
revoke all on function private.provisioned_identity(uuid) from public, anon, authenticated, service_role;
grant execute on function private.provisioned_identity(uuid) to filesdigi_commands;

create function public.complete_staff_account(p_invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_inv public.staff_invitations; v_user uuid; v_membership uuid;
begin
  select * into v_inv from public.staff_invitations where id = p_invitation for update;
  if not found or not private.is_admin(v_inv.branch_id) or v_inv.invited_by <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_inv.accepted_by is not null then return v_inv.accepted_by; end if;
  if v_inv.expires_at <= now() then raise exception 'invitation_unavailable' using errcode = '42501'; end if;
  v_user := private.provisioned_identity(v_inv.id);
  if v_user is null then raise exception 'account_not_prepared' using errcode = '22023'; end if;
  -- Only the identity created for this request may be enrolled. Never adopt an
  -- existing staff account or reactivate a revoked assignment through this path.
  if exists(select 1 from public.staff where id = v_user) then
    raise exception 'account_already_assigned' using errcode = '22023';
  end if;
  insert into public.staff(id, display_name) values(v_user, v_inv.display_name);
  insert into public.memberships(staff_id, branch_id, team_id, role)
    values(v_user, v_inv.branch_id, v_inv.team_id, v_inv.role) returning id into v_membership;
  update public.staff_invitations set accepted_by = v_user, accepted_at = now() where id = v_inv.id;
  insert into public.audit_events(branch_id, actor_id, action, target_id, revision)
    values(v_inv.branch_id, auth.uid(), 'staff.account_created', v_membership, 1);
  return v_user;
end $$;
alter function public.complete_staff_account(uuid) owner to filesdigi_commands;
revoke all on function public.complete_staff_account(uuid) from public, anon, authenticated, service_role;
grant execute on function public.complete_staff_account(uuid) to authenticated;

create unique index teams_branch_name_unique on public.teams(branch_id, lower(name));
create function public.create_staff_team(p_operation uuid, p_branch uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_input jsonb; v_saved private.command_results;
begin
  if not private.is_admin(p_branch) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_operation is null or p_name is null or length(trim(p_name)) not between 1 and 100 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || p_operation::text, 0));
  v_input := jsonb_build_object('command','team','branch',p_branch,'name',trim(p_name));
  select * into v_saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if v_saved.input <> v_input then raise exception 'operation_reused' using errcode = '22023'; end if;
    return v_saved.result;
  end if;
  insert into public.teams(branch_id,name) values(p_branch,trim(p_name)) returning id into v_id;
  insert into public.audit_events(branch_id,actor_id,action,target_id) values(p_branch,auth.uid(),'staff.team_created',v_id);
  insert into private.command_results values(auth.uid(),p_operation,v_input,v_id);
  return v_id;
end $$;
alter function public.create_staff_team(uuid,uuid,text) owner to filesdigi_commands;
revoke all on function public.create_staff_team(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.create_staff_team(uuid,uuid,text) to authenticated;

revoke create on schema public from filesdigi_commands;
