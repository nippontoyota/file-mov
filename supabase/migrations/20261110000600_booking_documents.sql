-- CHG-08: private registered-owner Aadhaar/PAN versions in the booking file.
grant create on schema public,private to filesdigi_commands;
create table private.document_verifier (
  singleton boolean primary key default true check(singleton), secret text not null
);
insert into private.document_verifier values(true,encode(extensions.gen_random_bytes(32),'hex'));
revoke all on private.document_verifier from public,anon,authenticated,service_role;
alter table private.document_verifier owner to filesdigi_commands;

create table public.booking_documents (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings,
  kind text not null check(kind in ('aadhaar','pan')), version integer not null check(version>0),
  owner_snapshot jsonb not null, filename text not null check(length(filename) between 1 and 200),
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg')),
  byte_size integer not null check(byte_size between 1 and 10485760),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check(status in ('pending','ready')),
  uploaded_by uuid not null references public.staff, uploaded_at timestamptz not null default now(),
  finalized_at timestamptz, unique(booking_id,kind,version),
  check((status='ready')=(finalized_at is not null))
);
create index on public.booking_documents(booking_id,status);
alter table public.booking_versions add column document_ids uuid[] not null default '{}';

create function private.registration_subject(p_data jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('name',coalesce(p_data->>'registration_name',''),'address',coalesce(p_data->>'registration_address',''),'pin',coalesce(p_data->>'registration_pin',''))
$$;
create function private.can_edit_booking(p_booking uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.bookings b join public.memberships m on m.branch_id=b.branch_id and m.team_id=b.team_id
 where b.id=p_booking and b.so_id=auth.uid() and b.state='draft' and m.staff_id=auth.uid() and m.role='SO' and m.active)
$$;
create function private.lock_owned_draft(p_booking uuid) returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=p_booking;
 if not found or not private.can_edit_booking(p_booking) then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from public.memberships m join public.staff s on s.id=m.staff_id where m.staff_id=auth.uid() and m.role='SO' and m.branch_id=b.branch_id and m.team_id=b.team_id and m.active and s.active for share of m,s;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 select * into b from public.bookings where id=p_booking for update;
 if b.state<>'draft' then raise exception 'forbidden' using errcode='42501'; end if;
 return b;
end $$;
create function private.can_read_document(p_document uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.booking_documents d where d.id=p_document and private.can_read_booking_id(d.booking_id) and (d.status='ready' or d.uploaded_by=auth.uid()))
$$;
create function private.document_object_read(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.booking_documents d where d.id::text=p_name and private.can_read_document(d.id))
$$;
create function private.document_object_insert(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.booking_documents d where d.id::text=p_name and d.status='pending' and d.uploaded_by=auth.uid() and private.can_edit_booking(d.booking_id))
$$;
-- Scalar metadata check only; command owner gets no unrestricted storage-table access.
create function private.document_object_matches(p_document uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.booking_documents d join storage.objects o on o.bucket_id='booking-documents' and o.name=d.id::text
 where d.id=p_document and (o.metadata->>'size')::bigint=d.byte_size and o.metadata->>'mimetype'=d.mime_type)
$$;
revoke all on function private.document_object_matches(uuid) from public,anon,authenticated,service_role;
grant execute on function private.document_object_matches(uuid) to filesdigi_commands;

create function private.snapshot_document_ids() returns trigger language plpgsql set search_path='' as $$
begin
 new.document_ids := array(select d.id from (select distinct on(kind) id,kind from public.booking_documents where booking_id=new.booking_id and status='ready' order by kind,version desc) d order by d.kind);
 return new;
end $$;
create trigger snapshot_documents before insert on public.booking_versions for each row execute function private.snapshot_document_ids();

create function public.reserve_booking_document(p_operation uuid,p_booking uuid,p_revision integer,p_kind text,p_filename text,p_mime text,p_size integer,p_sha256 text) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.bookings; d uuid; n integer; req jsonb; saved private.command_results;
begin
 if auth.uid() is null or p_operation is null then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
 b := private.lock_owned_draft(p_booking);
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

create function public.finalize_booking_document(p_document uuid,p_revision integer,p_attestation text) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.bookings; d public.booking_documents; signature text; actor_name text;
begin
 select * into d from public.booking_documents where id=p_document;
 if not found or d.uploaded_by<>auth.uid() or auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
 b:=private.lock_owned_draft(d.booking_id);
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
create function public.record_document_download(p_document uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.booking_documents; branch uuid;
begin
 if not private.can_read_document(p_document) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into d from public.booking_documents where id=p_document;
 if d.status<>'ready' then raise exception 'forbidden' using errcode='42501'; end if;
 select branch_id into branch from public.bookings where id=d.booking_id;
 insert into public.audit_events(branch_id,actor_id,action,target_id) values(branch,auth.uid(),'document.downloaded',d.id);
 return d.id;
end $$;

alter table public.booking_documents enable row level security;
create policy document_read on public.booking_documents for select to authenticated using(private.can_read_document(id));
revoke all on public.booking_documents from public,anon,authenticated,service_role;
grant select on public.booking_documents to authenticated;
update storage.buckets set file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg'] where id='booking-documents';
create policy booking_object_insert on storage.objects for insert to authenticated with check(bucket_id='booking-documents' and private.document_object_insert(name));
create policy booking_object_read on storage.objects for select to authenticated using(bucket_id='booking-documents' and storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info']) and private.document_object_read(name));

revoke all on function private.registration_subject(jsonb),private.can_edit_booking(uuid),private.lock_owned_draft(uuid),private.can_read_document(uuid),private.document_object_read(text),private.document_object_insert(text),private.snapshot_document_ids() from public,anon,authenticated,service_role;
grant execute on function private.can_read_document(uuid),private.document_object_read(text),private.document_object_insert(text) to authenticated;
revoke all on function public.reserve_booking_document(uuid,uuid,integer,text,text,text,integer,text),public.finalize_booking_document(uuid,integer,text),public.record_document_download(uuid) from public,anon,authenticated,service_role;
grant execute on function public.reserve_booking_document(uuid,uuid,integer,text,text,text,integer,text),public.finalize_booking_document(uuid,integer,text),public.record_document_download(uuid) to authenticated;
alter table public.booking_documents owner to filesdigi_commands;
alter function private.registration_subject(jsonb) owner to filesdigi_commands;
alter function private.can_edit_booking(uuid) owner to filesdigi_commands;
alter function private.lock_owned_draft(uuid) owner to filesdigi_commands;
alter function private.can_read_document(uuid) owner to filesdigi_commands;
alter function private.document_object_read(text) owner to filesdigi_commands;
alter function private.document_object_insert(text) owner to filesdigi_commands;
alter function private.snapshot_document_ids() owner to filesdigi_commands;
alter function public.reserve_booking_document(uuid,uuid,integer,text,text,text,integer,text) owner to filesdigi_commands;
alter function public.finalize_booking_document(uuid,integer,text) owner to filesdigi_commands;
alter function public.record_document_download(uuid) owner to filesdigi_commands;
revoke create on schema public,private from filesdigi_commands;
