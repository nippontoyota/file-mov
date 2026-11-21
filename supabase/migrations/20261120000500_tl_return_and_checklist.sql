-- Migration: 20261120000500_tl_return_and_checklist.sql
-- Implements:
-- 1. return_booking_tl stored procedure for Team Leaders to return files for rework with mandatory reason.
-- 2. Audit event logging for 'booking.returned_by_tl'.

grant create on schema public, private to filesdigi_commands;

create or replace function public.return_booking_tl(
  p_operation uuid,
  p_booking uuid,
  p_revision integer,
  p_reason text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  b public.bookings;
  handoff public.sales_submissions;
  req jsonb;
  saved private.command_results;
  v_reason text;
  actor_name text;
begin
  if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null or length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'reason_required' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  req := jsonb_build_object('command','return_tl','booking',p_booking,'revision',p_revision,'reason',v_reason);

  select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
  if found then
    if not private.can_read_booking_id(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
    if saved.input <> req then raise exception 'operation_reused' using errcode='22023'; end if;
    return saved.result;
  end if;

  select * into b from public.bookings where id=p_booking;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Must be active TL in booking's branch and team
  perform 1 from public.memberships m join public.staff s on s.id=m.staff_id
    where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.team_id=b.team_id and m.role='TL' and m.active and s.active for share of m,s;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  select * into b from public.bookings where id=p_booking for update;
  if b.state <> 'tl_review' then raise exception 'forbidden' using errcode='42501'; end if;
  if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;

  select * into handoff from public.sales_submissions where booking_id=b.id for update;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  -- Revert booking state back to draft so SO can edit and correct
  update public.bookings set
    state = 'draft',
    revision = revision + 1,
    updated_at = now()
  where id = b.id returning * into b;

  -- Clean up active submission so SO can resubmit anew
  delete from public.sales_submissions where booking_id = b.id;

  select display_name into actor_name from public.staff where id=auth.uid();
  insert into public.booking_versions(booking_id, revision, data, actor_id, actor_name, form_version)
    values(b.id, b.revision, b.data, auth.uid(), actor_name, b.form_version);

  insert into public.audit_events(branch_id, actor_id, action, target_id, revision, reason)
    values(b.branch_id, auth.uid(), 'booking.returned_by_tl', b.id, b.revision, v_reason);

  insert into private.command_results values(auth.uid(), p_operation, req, b.id);
  return b.id;
end $$;

alter function public.return_booking_tl(uuid, uuid, integer, text) owner to filesdigi_commands;

revoke all on function public.return_booking_tl(uuid, uuid, integer, text)
from public, anon, authenticated, service_role;

grant execute on function public.return_booking_tl(uuid, uuid, integer, text)
to authenticated;

revoke create on schema public, private from filesdigi_commands;
