-- Public location names verified against https://www.nippontoyota.co.in/contact on 2026-11-10.
-- Catalog only: no dummy identities or invented teams. Scope assignments are explicit.
insert into public.branches(id, name) values
('b1000000-0000-0000-0000-000000000001', 'Kalamassery (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000002', 'Nettoor (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000003', 'Thiruvananthapuram (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000004', 'Thiruvananthapuram (Service Centre)'),
('b1000000-0000-0000-0000-000000000005', 'Thiruvananthapuram (Showroom)'),
('b1000000-0000-0000-0000-000000000006', 'Thiruvananthapuram (Service & Body & Paint)'),
('b1000000-0000-0000-0000-000000000007', 'Thrissur (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000008', 'Nadathara (Service Centre)'),
('b1000000-0000-0000-0000-000000000009', 'Arthat (Service Centre)'),
('b1000000-0000-0000-0000-000000000010', 'Kottayam (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000011', 'Kottayam (Service Centre)'),
('b1000000-0000-0000-0000-000000000012', 'Kottayam (Showroom)'),
('b1000000-0000-0000-0000-000000000013', 'Kollam (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000014', 'Kollam (Service Centre)'),
('b1000000-0000-0000-0000-000000000015', 'Thiruvalla (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000016', 'Irinjalkuda (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000017', 'Muvattupuzha (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000018', 'Kayamkullam (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000019', 'Pathanamthitta (Showroom & Service Centre)'),
('b1000000-0000-0000-0000-000000000020', 'Ernakulam (Service Centre)')
on conflict (id) do update set name=excluded.name;
