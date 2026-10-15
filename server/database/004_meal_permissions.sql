-- OAuth clients may write only through the narrow meal-editing RPC below.
alter policy connector_state_write on public.nutrition_state using((select auth.jwt()->>'client_id') is null) with check((select auth.jwt()->>'client_id') is null);
alter policy connector_state_insert on public.nutrition_state with check((select auth.jwt()->>'client_id') is null);
grant usage on schema wfw_private to authenticated;
create or replace function wfw_private.update_meal(meal_date text,meal jsonb,eaten boolean,save_template boolean,expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();cid text:=auth.jwt()->>'client_id';p jsonb;d jsonb;items jsonb;rev bigint;mid text:=meal->>'id';k text;stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if uid is null or cid is null or auth.jwt()->>'resource' is distinct from 'https://zrtnabwryzbdqzwghxcp.supabase.co/functions/v1/wfw-mcp' or not exists(select 1 from public.wfw_connector_access where user_id=uid and client_id=cid and can_read and can_write) then raise exception 'Meal editing not authorized' using errcode='42501';end if;
 if meal_date !~ '^\d{4}-\d{2}-\d{2}$' or meal_date<'1900-01-01' or meal_date>'2200-12-31' or to_char(meal_date::date,'YYYY-MM-DD')<>meal_date or eaten is null or save_template is null or expected_revision is null then raise exception 'Invalid arguments';end if;
 if jsonb_typeof(meal) is distinct from 'object' or mid is null or mid !~ '^[a-zA-Z0-9_-]{1,80}$' or mid in('__proto__','constructor','prototype') or jsonb_typeof(meal->'name') is distinct from 'string' or length(trim(meal->>'name')) not between 1 and 100 or jsonb_typeof(meal->'foods') is distinct from 'array' or jsonb_array_length(meal->'foods')>100 then raise exception 'Invalid meal';end if;
 if exists(select 1 from jsonb_object_keys(meal) x where x not in('id','name','foods','kcal','p','c','f','fi')) or exists(select 1 from jsonb_array_elements(meal->'foods') x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>1500) then raise exception 'Invalid meal fields';end if;
 foreach k in array array['kcal','p','c','f','fi'] loop if jsonb_typeof(meal->k) is distinct from 'number' or (meal->>k)::numeric<0 or (meal->>k)::numeric>(case when k='kcal' then 20000 else 2000 end) then raise exception 'Invalid macros';end if;end loop;
 if save_template and mid not in('breakfast','lunch','dinner') then raise exception 'Only standard meals can become templates';end if;
 select payload,revision into p,rev from public.nutrition_state where user_id=uid for update;
 if p is null then raise exception 'Sync your tracker first';end if;
 if rev<>expected_revision then raise exception 'Revision conflict' using errcode='40001';end if;
 d:=coalesce(p->'days'->meal_date,jsonb_build_object('meals',p->'templates','completed','{}'::jsonb,'supplements','{}'::jsonb,'water',0,'waterRecorded',false,'goals',p->'settings'->'goals','updatedAt',stamp));
 if exists(select 1 from jsonb_array_elements(d->'meals') x where x->>'id'=mid) then select jsonb_agg(case when x->>'id'=mid then meal else x end order by n) into items from jsonb_array_elements(d->'meals') with ordinality t(x,n);
 else if jsonb_array_length(d->'meals')>=200 then raise exception 'Daily meal limit';end if;items:=(d->'meals')||jsonb_build_array(meal);end if;
 d:=jsonb_set(d,'{meals}',items);d:=jsonb_set(d,array['completed',mid],to_jsonb(eaten));d:=jsonb_set(d,'{updatedAt}',to_jsonb(stamp));p:=jsonb_set(p,array['days',meal_date],d);p:=jsonb_set(p,'{updatedAt}',to_jsonb(stamp));
 if save_template then select jsonb_agg(case when x->>'id'=mid then meal else x end order by n) into items from jsonb_array_elements(p->'templates') with ordinality t(x,n);p:=jsonb_set(p,'{templates}',items);end if;
 update public.nutrition_state set payload=p where user_id=uid returning revision into rev;
 return jsonb_build_object('saved',true,'date',meal_date,'meal',meal,'eaten',eaten,'revision',rev,'updated_at',stamp);
end $$;
revoke all on function wfw_private.update_meal(text,jsonb,boolean,boolean,bigint) from public,anon;
grant execute on function wfw_private.update_meal(text,jsonb,boolean,boolean,bigint) to authenticated;
create or replace function public.wfw_update_meal(meal_date text,meal jsonb,eaten boolean,save_template boolean,expected_revision bigint) returns jsonb language sql set search_path='' as $$select wfw_private.update_meal(meal_date,meal,eaten,save_template,expected_revision)$$;
revoke all on function public.wfw_update_meal(text,jsonb,boolean,boolean,bigint) from public,anon;
grant execute on function public.wfw_update_meal(text,jsonb,boolean,boolean,bigint) to authenticated;
create or replace function public.wfw_preserve_version() returns trigger language plpgsql set search_path='' as $$begin if old.payload->>'version'='3' and new.payload->>'version'<>'3' then raise exception 'Update this app before saving';end if;return new;end $$;
revoke all on function public.wfw_preserve_version() from public,anon,authenticated;
create trigger wfw_preserve_version before update on public.nutrition_state for each row execute function public.wfw_preserve_version();
