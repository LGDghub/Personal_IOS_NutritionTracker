-- OAuth connections can update only the signed-in user's targets and Monday weigh-ins.
create or replace function wfw_private.authorize_profile_edit() returns uuid language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); cid text:=auth.jwt()->>'client_id';
begin
 if uid is null or cid is null or auth.jwt()->>'resource' is distinct from 'https://zrtnabwryzbdqzwghxcp.supabase.co/functions/v1/wfw-mcp'
 or not exists(select 1 from public.wfw_connector_access where user_id=uid and client_id=cid and can_read and can_write)
 then raise exception 'Tracker editing not authorized' using errcode='42501'; end if;
 return uid;
end $$;
revoke all on function wfw_private.authorize_profile_edit() from public,anon;
grant execute on function wfw_private.authorize_profile_edit() to authenticated;

create or replace function wfw_private.update_goals(new_goals jsonb,effective_date text,expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; p jsonb; rev bigint; k text; stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 uid:=wfw_private.authorize_profile_edit();
 if effective_date is null or effective_date !~ '^\d{4}-\d{2}-\d{2}$' or effective_date<'1900-01-01' or effective_date>'2200-12-31'
 or to_char(effective_date::date,'YYYY-MM-DD')<>effective_date
 or effective_date::date not between current_date-1 and current_date+1
 or expected_revision is null or expected_revision<1
 or jsonb_typeof(new_goals) is distinct from 'object'
 or (select count(*) from jsonb_object_keys(new_goals))<>6
 or exists(select 1 from jsonb_object_keys(new_goals) x where x not in ('kcal','p','c','f','fi','water'))
 then raise exception 'Invalid target request'; end if;
 foreach k in array array['kcal','p','c','f','fi','water'] loop
  if jsonb_typeof(new_goals->k) is distinct from 'number'
  or (new_goals->>k)::numeric < (case when k='kcal' then 1 when k='water' then 0.25 else 0 end)
  or (new_goals->>k)::numeric > (case when k='kcal' then 20000 when k='water' then 10 else 2000 end)
  then raise exception 'Invalid target %',k; end if;
 end loop;
 select payload,revision into p,rev from public.nutrition_state where user_id=uid for update;
 if p is null then raise exception 'Sync your tracker first'; end if;
 if rev<>expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 p:=jsonb_set(p,'{settings,goals}',new_goals);
 if p->'days' ? effective_date then p:=jsonb_set(p,array['days',effective_date,'goals'],new_goals); end if;
 p:=jsonb_set(p,'{updatedAt}',to_jsonb(stamp));
 update public.nutrition_state set payload=p where user_id=uid returning revision into rev;
 return jsonb_build_object('saved',true,'goals',new_goals,'effective_date',effective_date,'revision',rev);
end $$;
revoke all on function wfw_private.update_goals(jsonb,text,bigint) from public,anon;
grant execute on function wfw_private.update_goals(jsonb,text,bigint) to authenticated;
create or replace function public.wfw_update_goals(new_goals jsonb,effective_date text,expected_revision bigint)
returns jsonb language sql set search_path='' as $$select wfw_private.update_goals(new_goals,effective_date,expected_revision)$$;
revoke all on function public.wfw_update_goals(jsonb,text,bigint) from public,anon;
grant execute on function public.wfw_update_goals(jsonb,text,bigint) to authenticated;

create or replace function wfw_private.record_weight(weigh_date text,weight_kg numeric,expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; p jsonb; rev bigint; stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 uid:=wfw_private.authorize_profile_edit();
 if weigh_date is null or weigh_date !~ '^\d{4}-\d{2}-\d{2}$' or weigh_date<'1900-01-01' or weigh_date>'2200-12-31'
 or to_char(weigh_date::date,'YYYY-MM-DD')<>weigh_date or extract(isodow from weigh_date::date)<>1
 or weigh_date::date>current_date+1 or weight_kg is null or weight_kg<30 or weight_kg>250
 or expected_revision is null or expected_revision<1 then raise exception 'Invalid Monday weigh-in'; end if;
 select payload,revision into p,rev from public.nutrition_state where user_id=uid for update;
 if p is null then raise exception 'Sync your tracker first'; end if;
 if rev<>expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 p:=jsonb_set(p,array['weights',weigh_date],to_jsonb(weight_kg));
 p:=jsonb_set(p,'{updatedAt}',to_jsonb(stamp));
 update public.nutrition_state set payload=p where user_id=uid returning revision into rev;
 return jsonb_build_object('saved',true,'date',weigh_date,'weight_kg',weight_kg,'revision',rev);
end $$;
revoke all on function wfw_private.record_weight(text,numeric,bigint) from public,anon;
grant execute on function wfw_private.record_weight(text,numeric,bigint) to authenticated;
create or replace function public.wfw_record_weight(weigh_date text,weight_kg numeric,expected_revision bigint)
returns jsonb language sql set search_path='' as $$select wfw_private.record_weight(weigh_date,weight_kg,expected_revision)$$;
revoke all on function public.wfw_record_weight(text,numeric,bigint) from public,anon;
grant execute on function public.wfw_record_weight(text,numeric,bigint) to authenticated;
