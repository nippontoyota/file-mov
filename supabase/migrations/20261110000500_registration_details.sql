-- CHG-07: explicit registration identity choice; existing v1 snapshots remain intact.
alter table public.bookings drop constraint bookings_form_version_check;
alter table public.bookings add constraint bookings_form_version_check check(form_version in (1,2));
alter table public.booking_versions drop constraint booking_versions_form_version_check;
alter table public.booking_versions add constraint booking_versions_form_version_check check(form_version in (1,2));

create or replace function private.valid_booking_draft(p_data jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item record; value text;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 16000 then return false; end if;
  for item in select * from jsonb_each(p_data) loop
    if item.key <> all(array['customer_code','booking_number','enquiry_number','booking_date','tl_name','gst_billing','registration_type','customer_name','communication_address','contact_person','pin','model','suffix_1','suffix_2','colour_1','colour_2','interior_colour','special_request','registration_same','registration_name','registration_address','registration_pin','registration_model','registration_suffix','registration_colour']) or jsonb_typeof(item.value) <> 'string' then return false; end if;
    value := item.value #>> '{}';
    if length(value) > (case when item.key in ('communication_address','special_request','registration_address') then 2000 else 200 end) then return false; end if;
  end loop;
  if coalesce(p_data->>'gst_billing','') not in ('','yes','no') or coalesce(p_data->>'registration_type','') not in ('','permanent','temporary') then return false; end if;
  if coalesce(p_data->>'booking_date','') <> '' then
    if p_data->>'booking_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
    perform (p_data->>'booking_date')::date;
  end if;
  if coalesce(p_data->>'registration_same','no') not in ('yes','no') then return false; end if;
  if p_data->>'registration_same'='yes' and (coalesce(p_data->>'registration_name','')<>coalesce(p_data->>'customer_name','') or coalesce(p_data->>'registration_address','')<>coalesce(p_data->>'communication_address','') or coalesce(p_data->>'registration_pin','')<>coalesce(p_data->>'pin','') or coalesce(p_data->>'registration_model','')<>coalesce(p_data->>'model','') or coalesce(p_data->>'registration_suffix','')<>coalesce(p_data->>'suffix_1','') or coalesce(p_data->>'registration_colour','')<>coalesce(p_data->>'colour_1','')) then return false; end if;
  return true;
exception when datetime_field_overflow or invalid_datetime_format then return false;
end $$;

create or replace function public.save_booking_draft(p_operation uuid,p_membership uuid,p_data jsonb,p_confirmed boolean,p_booking uuid default null,p_revision integer default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare scope public.memberships; booking public.bookings; saved private.command_results; request jsonb; actor_name text;
begin
  if auth.uid() is null or not private.is_active() then raise exception 'forbidden' using errcode='42501'; end if;
  -- Lock the active SO scope so revocation cannot race a write under that scope.
  select * into scope from public.memberships where id=p_membership and staff_id=auth.uid() and role='SO' and active for share;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  select display_name into actor_name from public.staff where id=auth.uid() and active for share;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if p_operation is null or p_confirmed is distinct from true or not private.valid_booking_draft(p_data) or (p_booking is null and p_revision is not null) or (p_booking is not null and (p_revision is null or p_revision<1)) then
    raise exception 'invalid_input' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_operation::text,0));
  request := jsonb_build_object('command','save_booking_draft','membership',p_membership,'booking',p_booking,'revision',p_revision,'data',p_data,'confirmed',p_confirmed);
  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if saved.input<>request then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;
  if p_booking is null then
    insert into public.bookings(branch_id,team_id,so_id,so_name,data,form_version) values(scope.branch_id,scope.team_id,auth.uid(),actor_name,p_data,2) returning * into booking;
  else
    select * into booking from public.bookings where id=p_booking for update;
    if not found or booking.so_id<>auth.uid() or booking.branch_id<>scope.branch_id or booking.team_id<>scope.team_id then raise exception 'forbidden' using errcode='42501'; end if;
    if booking.revision<>p_revision then raise exception 'stale_revision' using errcode='40001'; end if;
    if booking.state<>'draft' then raise exception 'invalid_transition' using errcode='22023'; end if;
    update public.bookings set data=p_data,form_version=2,revision=revision+1,updated_at=now() where id=booking.id returning * into booking;
  end if;
  insert into public.booking_versions(booking_id,revision,data,actor_id,actor_name,form_version) values(booking.id,booking.revision,booking.data,auth.uid(),actor_name,booking.form_version);
  insert into public.audit_events(branch_id,actor_id,action,target_id,revision) values(scope.branch_id,auth.uid(),case when p_booking is null then 'booking.draft_created' else 'booking.draft_updated' end,booking.id,booking.revision);
  insert into private.command_results values(auth.uid(),p_operation,request,booking.id);
  return booking.id;
end $$;
