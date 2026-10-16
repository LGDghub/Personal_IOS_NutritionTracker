begin;
create temporary table shopping_test_ids(a uuid,b uuid);
insert into shopping_test_ids values(gen_random_uuid(),gen_random_uuid());
grant select on shopping_test_ids to authenticated;
insert into auth.users(id,email) select a,a::text||'@example.invalid' from shopping_test_ids union all select b,b::text||'@example.invalid' from shopping_test_ids;
insert into public.nutrition_state(user_id,payload) select id,'{"version":3,"days":{},"weights":{},"shop":{"0":true,"2":true},"shoppingItems":[{"name":"A","price":1.10},{"name":"B","price":2.20},{"name":"C","price":3.30}],"shoppingWeeks":{"2026-10-12":{"0":true,"1":false,"2":true},"2026-10-05":{"0":false,"1":true}},"settings":{"goals":{"kcal":2000,"p":100,"c":200,"f":60,"fi":25,"water":2}},"templates":[],"supplementStock":{}}'::jsonb from(select a id from shopping_test_ids union all select b from shopping_test_ids) t;
insert into public.wfw_connector_access(user_id,client_id,can_write,can_profile_write) select a,'shopping-test',true,true from shopping_test_ids;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','client_id','shopping-test','resource','https://zrtnabwryzbdqzwghxcp.supabase.co/functions/v1/wfw-mcp')::text,true) from shopping_test_ids;
do $$begin
 begin perform public.wfw_update_shopping_list('[]',1);raise exception 'Missing consent accepted';exception when insufficient_privilege then null;end;
 update public.wfw_connector_access set can_shopping_write=true;
 if exists(select 1 from public.wfw_connector_access where can_shopping_write) then raise exception 'OAuth self escalation';end if;
end $$;
reset role;
update public.wfw_connector_access set can_shopping_write=true where user_id=(select a from shopping_test_ids);
set local role authenticated;
do $$declare r jsonb;p jsonb;begin
 r:=public.wfw_update_shopping_list('[{"original_index":2,"name":"C edited","price":3.50},{"original_index":0,"name":"A","price":1.10},{"original_index":null,"name":"D","price":4.25}]',1);
 if (r->>'revision')::int<>2 or (r->>'total')::numeric<>8.85 then raise exception 'List save failed';end if;
 select payload into p from public.nutrition_state where user_id=(select a from shopping_test_ids);
 if p->'shoppingWeeks'->'2026-10-12'<>'{"0":true,"1":true}'::jsonb or p->'shoppingWeeks'->'2026-10-05'<>'{"1":false}'::jsonb or p->'shop'<>'{"0":true,"1":true}'::jsonb then raise exception 'Tick remap failed';end if;
 r:=public.wfw_set_shopping_purchased('2026-10-12','[{"item_index":1,"purchased":false},{"item_index":2,"purchased":true}]',2);
 if r->'purchased'<>'{"0":true,"1":false,"2":true}'::jsonb then raise exception 'Purchase edit failed';end if;
 begin perform public.wfw_update_shopping_list('[]',2);raise exception 'Stale accepted';exception when serialization_failure then null;end;
 begin perform public.wfw_update_shopping_list('[{"original_index":0,"name":"A","price":1},{"original_index":0,"name":"Again","price":2}]',3);raise exception 'Duplicate accepted';exception when others then if sqlerrm='Duplicate accepted' then raise;end if;end;
 begin perform public.wfw_set_shopping_purchased('2026-10-13','[{"item_index":0,"purchased":true}]',3);raise exception 'Non-Monday accepted';exception when others then if sqlerrm='Non-Monday accepted' then raise;end if;end;
 if (select count(*) from public.nutrition_state)<>1 then raise exception 'Cross-account read';end if;
end $$;
reset role;
do $$begin
 if exists(select 1 from public.nutrition_state where user_id=(select b from shopping_test_ids) and revision<>1) then raise exception 'Cross-account write';end if;
 begin update public.nutrition_state set payload=payload-'shoppingFormat' where user_id=(select a from shopping_test_ids);raise exception 'Old client accepted';exception when others then if sqlerrm='Old client accepted' then raise;end if;end;
end $$;
delete from public.wfw_connector_access where user_id=(select a from shopping_test_ids);
set local role authenticated;
do $$begin
 begin perform public.wfw_update_shopping_list('[]',3);raise exception 'Revoked edit accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: shopping consent, ticks after reorder/removal, purchase edits, conflicts, account isolation, old-client protection and revocation' as result;
