-- CHG-08: first digital file handoff, not an approval or physical transfer.
grant create on schema public,private to filesdigi_commands;
alter table public.bookings drop constraint bookings_state_check;
alter table public.bookings add constraint bookings_state_check check(state in ('draft','tl_review'));
create table public.sales_submissions (
 booking_id uuid primary key references public.bookings,
 file_revision integer not null,
 sent_by uuid not null references public.staff, sent_at timestamptz not null default now(),
 received_by uuid references public.staff, received_at timestamptz,
 foreign key(booking_id,file_revision) references public.booking_versions(booking_id,revision),
 check((received_by is null)=(received_at is null))
);
alter table public.sales_submissions enable row level security;
create policy submission_read on public.sales_submissions for select to authenticated using(private.can_read_booking_id(booking_id));
revoke all on public.sales_submissions from public,anon,authenticated,service_role;
grant select on public.sales_submissions to authenticated;
create function public.send_booking_to_tl(p_operation uuid,p_booking uuid,p_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings; req jsonb; saved private.command_results; actor_name text;
begin
 if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
 req:=jsonb_build_object('command','send_to_tl','booking',p_booking,'revision',p_revision);
 select * into saved from private.command_results where actor_id=auth.uid() and operation_id=p_operation;
 if found then
  if not private.can_read_booking_id(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
  if saved.input<>req then raise exception 'operation_reused' using errcode='22023'; end if;
  return saved.result;
 end if;
 b:=private.lock_owned_draft(p_booking);
 if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;
 if exists(select 1 from unnest(array['customer_code','booking_number','booking_date','enquiry_number','customer_name','communication_address','contact_person','pin','model','suffix_1','colour_1']) k where nullif(btrim(b.data->>k),'') is null) then raise exception 'booking_details_required' using errcode='22023'; end if;
 if exists(select 1 from unnest(array['aadhaar','pan']) k where not exists(select 1 from public.booking_documents d where d.booking_id=b.id and d.kind=k and d.status='ready' and d.owner_snapshot=private.registration_subject(b.data) and d.version=(select max(x.version) from public.booking_documents x where x.booking_id=b.id and x.kind=k and x.status='ready'))) then raise exception 'owner_documents_required' using errcode='22023'; end if;
 -- A send needs an active recipient; the queue remains team-scoped, receipt is attributed.
 perform 1 from public.memberships m join public.staff s on s.id=m.staff_id where m.branch_id=b.branch_id and m.team_id=b.team_id and m.role='TL' and m.active and s.active for share of m,s;
 if not found then raise exception 'team_leader_required' using errcode='22023'; end if;
 update public.bookings set state='tl_review',revision=revision+1,updated_at=now() where id=b.id returning * into b;
 select display_name into actor_name from public.staff where id=auth.uid();
 insert into public.booking_versions(booking_id,revision,data,actor_id,actor_name,form_version) values(b.id,b.revision,b.data,auth.uid(),actor_name,b.form_version);
 insert into public.sales_submissions(booking_id,file_revision,sent_by) values(b.id,b.revision,auth.uid());
 insert into public.audit_events(branch_id,actor_id,action,target_id,revision) values(b.branch_id,auth.uid(),'booking.sent_to_tl',b.id,b.revision);
 insert into private.command_results values(auth.uid(),p_operation,req,b.id);
 return b.id;
end $$;
create function public.receive_sales_file(p_booking uuid,p_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings; handoff public.sales_submissions;
begin
 select * into b from public.bookings where id=p_booking;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.memberships m join public.staff s on s.id=m.staff_id where m.staff_id=auth.uid() and m.branch_id=b.branch_id and m.team_id=b.team_id and m.role='TL' and m.active and s.active for share of m,s;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 select * into b from public.bookings where id=p_booking for update;
 if b.state<>'tl_review' then raise exception 'forbidden' using errcode='42501'; end if;
 if b.revision is distinct from p_revision then raise exception 'stale_revision' using errcode='40001'; end if;
 select * into handoff from public.sales_submissions where booking_id=b.id for update;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if handoff.received_at is not null then return b.id; end if;
 update public.sales_submissions set received_by=auth.uid(),received_at=now() where booking_id=b.id;
 insert into public.audit_events(branch_id,actor_id,action,target_id,revision) values(b.branch_id,auth.uid(),'booking.received_by_tl',b.id,b.revision);
 return b.id;
end $$;
alter table public.sales_submissions owner to filesdigi_commands;
alter function public.send_booking_to_tl(uuid,uuid,integer) owner to filesdigi_commands;
alter function public.receive_sales_file(uuid,integer) owner to filesdigi_commands;
revoke all on function public.send_booking_to_tl(uuid,uuid,integer),public.receive_sales_file(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.send_booking_to_tl(uuid,uuid,integer),public.receive_sales_file(uuid,integer) to authenticated;
revoke create on schema public,private from filesdigi_commands;
