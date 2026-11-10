-- CHG-06: Customer ID identifies a customer globally, not a single booking.
grant create on schema public,private to filesdigi_commands;
create table public.customers (
  customer_id text primary key check(length(customer_id) between 1 and 200 and customer_id=btrim(customer_id))
);
alter table public.bookings add column customer_id text references public.customers(customer_id);
insert into public.customers(customer_id)
  select distinct btrim(data->>'customer_code') from public.bookings where nullif(btrim(data->>'customer_code'),'') is not null;
update public.bookings set customer_id=nullif(btrim(data->>'customer_code'),'');
alter table public.bookings add constraint booking_customer_matches_snapshot
  check(customer_id is not distinct from nullif(btrim(data->>'customer_code'),''));
create index bookings_customer_id on public.bookings(customer_id);

-- Runs inside the existing authorized save transaction, including its audit/version rollback.
-- Only the identifier is shared; customer details remain scoped booking snapshots.
create function private.link_booking_customer() returns trigger
language plpgsql set search_path='' as $$
begin
  new.customer_id := nullif(btrim(new.data->>'customer_code'),'');
  if new.customer_id is not null then
    insert into public.customers(customer_id) values(new.customer_id) on conflict(customer_id) do nothing;
  end if;
  return new;
end $$;
create trigger booking_customer_link before insert or update of data,customer_id on public.bookings
  for each row execute function private.link_booking_customer();
alter table public.customers enable row level security;
create policy customer_read on public.customers for select to authenticated using(
  exists(select 1 from public.bookings b where b.customer_id=customers.customer_id)
);
revoke all on public.customers from public,anon,authenticated,service_role;
grant select on public.customers to authenticated;
revoke all on function private.link_booking_customer() from public,anon,authenticated,service_role;
alter table public.customers owner to filesdigi_commands;
alter function private.link_booking_customer() owner to filesdigi_commands;
revoke create on schema public,private from filesdigi_commands;
