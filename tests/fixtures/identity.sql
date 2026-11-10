-- Local synthetic identities only. Password: Local-demo-only-2026!
insert into public.branches(id, name) values
('d1000000-0000-0000-0000-000000000001', 'Demo North'),
('d1000000-0000-0000-0000-000000000002', 'Demo South');
insert into public.teams(id, branch_id, name) values
('d2000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Sales A'),
('d2000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000001','Sales B'),
('d2000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000002','Sales C');
do $$
declare v_role text; v_id uuid; v_n integer := 0;
begin
  foreach v_role in array array['Admin','SO','TL','SM','BO','Insurance','Accounts','Cashier','Accessories','Security','SO','Admin','SO'] loop
    v_n := v_n + 1;
    v_id := ('d3000000-0000-0000-0000-' || lpad(v_n::text, 12, '0'))::uuid;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    values('00000000-0000-0000-0000-000000000000',v_id,'authenticated','authenticated',lower(v_role)||v_n||'@example.test',extensions.crypt('Local-demo-only-2026!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values(gen_random_uuid(),v_id,v_id::text,jsonb_build_object('sub',v_id,'email',lower(v_role)||v_n||'@example.test'),'email',now(),now(),now());
    insert into public.staff(id,display_name) values(v_id,'Demo '||v_role||' '||v_n);
    insert into public.memberships(id,staff_id,branch_id,team_id,role)
    values(('d4000000-0000-0000-0000-'||lpad(v_n::text,12,'0'))::uuid,v_id,
      case when v_n >= 12 then 'd1000000-0000-0000-0000-000000000002'::uuid else 'd1000000-0000-0000-0000-000000000001'::uuid end,
      case when v_role in ('SO','TL') then
        case when v_n >= 12 then 'd2000000-0000-0000-0000-000000000003'::uuid when v_n = 11 then 'd2000000-0000-0000-0000-000000000002'::uuid else 'd2000000-0000-0000-0000-000000000001'::uuid end
        else null end,v_role::public.staff_role);
  end loop;
end $$;
