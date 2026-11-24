-- Soft deletion for bookings (append-only database compliance)
alter table public.bookings
  add column if not exists deleted_at timestamptz default null,
  add column if not exists deleted_by uuid references public.staff(id) default null,
  add column if not exists deleted_reason text default null;

create index if not exists bookings_active_idx on public.bookings(branch_id, team_id, updated_at desc)
  where deleted_at is null;

create or replace function public.soft_delete_booking(
  p_booking_id uuid,
  p_reason text default 'Removed from active workspace'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  caller_id uuid;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  -- Verify caller has access to the booking
  if not private.can_read_booking_id(p_booking_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- Idempotent check
  if b.deleted_at is not null then
    return jsonb_build_object('success', true, 'booking_id', p_booking_id, 'message', 'Already removed');
  end if;

  -- Mark soft deleted (row is never dropped)
  update public.bookings
  set deleted_at = now(),
      deleted_by = caller_id,
      deleted_reason = coalesce(p_reason, 'Removed from active workspace')
  where id = p_booking_id;

  -- Insert immutable audit record
  insert into public.audit_events (
    branch_id,
    actor_id,
    action,
    target_id,
    revision,
    reason,
    occurred_at
  ) values (
    b.branch_id,
    caller_id,
    'booking_soft_deleted',
    p_booking_id,
    b.revision,
    coalesce(p_reason, 'Removed from active workspace'),
    now()
  );

  return jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'message', 'Booking removed from active application view'
  );
end;
$$;

grant execute on function public.soft_delete_booking(uuid, text) to authenticated;
