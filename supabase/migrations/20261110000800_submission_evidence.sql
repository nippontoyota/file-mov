-- Preserve the applied CHG-08 gate and actor labels without exposing a staff directory.
grant create on schema private to filesdigi_commands;
alter table public.sales_submissions add column requirements_version integer not null default 1 check(requirements_version=1),
 add column sender_name text, add column receiver_name text;
update public.sales_submissions h set sender_name=s.display_name from public.staff s where s.id=h.sent_by;
update public.sales_submissions h set receiver_name=s.display_name from public.staff s where s.id=h.received_by;
alter table public.sales_submissions alter column sender_name set not null;
create function private.submission_evidence() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then select display_name into new.sender_name from public.staff where id=new.sent_by; end if;
 if new.received_by is not null then select display_name into new.receiver_name from public.staff where id=new.received_by; end if;
 return new;
end $$;
revoke all on function private.submission_evidence() from public,anon,authenticated,service_role;
alter function private.submission_evidence() owner to filesdigi_commands;
create trigger submission_evidence before insert or update on public.sales_submissions for each row execute function private.submission_evidence();
revoke create on schema private from filesdigi_commands;
