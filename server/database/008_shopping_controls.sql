alter table public.wfw_connector_access add column if not exists can_shopping_write boolean not null default false;

create or replace function wfw_private.authorize_shopping_edit() returns uuid language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); cid text:=auth.jwt()->>'client_id';
begin
 if uid is null or cid is null or auth.jwt()->>'resource' is distinct from 'https://zrtnabwryzbdqzwghxcp.supabase.co/functions/v1/wfw-mcp'
 or not exists(select 1 from public.wfw_connector_access where user_id=uid and client_id=cid and can_read and can_shopping_write)
 then raise exception 'Shopping editing not authorized' using errcode='42501'; end if;
 return uid;
end $$;
revoke all on function wfw_private.authorize_shopping_edit() from public,anon;
grant execute on function wfw_private.authorize_shopping_edit() to authenticated;

create or replace function wfw_private.update_shopping_list(items jsonb,expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; p jsonb; rev bigint; item jsonb; idx integer; used integer[]:='{}'; original integer; new_items jsonb:='[]'; wk record; ticks jsonb; weeks jsonb:='{}'; legacy jsonb:='{}'; stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 uid:=wfw_private.authorize_shopping_edit();
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>200 or expected_revision is null or expected_revision<1 then raise exception 'Invalid shopping list'; end if;
 select payload,revision into p,rev from public.nutrition_state where user_id=uid for update;
 if p is null then raise exception 'Sync your tracker first'; end if;
 if rev<>expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item) is distinct from 'object' or not (item ? 'original_index') or jsonb_typeof(item->'name') is distinct from 'string' or length(trim(item->>'name')) not between 1 and 200
  or jsonb_typeof(item->'price') is distinct from 'number' or (item->>'price')::numeric<0 or (item->>'price')::numeric>10000 or round((item->>'price')::numeric,2)<>(item->>'price')::numeric
  or exists(select 1 from jsonb_object_keys(item) k where k not in ('original_index','name','price')) then raise exception 'Invalid shopping item'; end if;
  if item->'original_index'<>'null'::jsonb then
   if jsonb_typeof(item->'original_index') is distinct from 'number' or (item->>'original_index') !~ '^[0-9]+$' then raise exception 'Invalid original index'; end if;
   original:=(item->>'original_index')::integer;
   if original<0 or original>=jsonb_array_length(p->'shoppingItems') or original=any(used) then raise exception 'Invalid or repeated original index'; end if;
   used:=array_append(used,original);
  end if;
  new_items:=new_items||jsonb_build_array(jsonb_build_object('name',trim(item->>'name'),'price',(item->>'price')::numeric));
 end loop;
 -- Preserve each surviving item's ticks in every week, including reordered lists.
 for wk in select key,value from jsonb_each(coalesce(p->'shoppingWeeks','{}'::jsonb)) loop
  ticks:='{}'; idx:=0;
  for item in select value from jsonb_array_elements(items) loop
   if item->'original_index'<>'null'::jsonb and wk.value ? (item->>'original_index') then ticks:=jsonb_set(ticks,array[idx::text],wk.value->(item->>'original_index')); end if;
   idx:=idx+1;
  end loop;
  weeks:=jsonb_set(weeks,array[wk.key],ticks);
 end loop;
 idx:=0;
 for item in select value from jsonb_array_elements(items) loop
  if item->'original_index'<>'null'::jsonb and coalesce(p->'shop','{}'::jsonb) ? (item->>'original_index') then legacy:=jsonb_set(legacy,array[idx::text],p->'shop'->(item->>'original_index')); end if;
  idx:=idx+1;
 end loop;
 p:=jsonb_set(p,'{shoppingItems}',new_items);p:=jsonb_set(p,'{shoppingWeeks}',weeks);p:=jsonb_set(p,'{shop}',legacy);
 p:=jsonb_set(p,'{shoppingFormat}','1');p:=jsonb_set(p,'{updatedAt}',to_jsonb(stamp));
 update public.nutrition_state set payload=p where user_id=uid returning revision into rev;
 return jsonb_build_object('saved',true,'revision',rev,'items',new_items,'currency','GBP','total',coalesce((select sum((value->>'price')::numeric) from jsonb_array_elements(new_items)),0));
end $$;
revoke all on function wfw_private.update_shopping_list(jsonb,bigint) from public,anon;
grant execute on function wfw_private.update_shopping_list(jsonb,bigint) to authenticated;
create or replace function public.wfw_update_shopping_list(items jsonb,expected_revision bigint) returns jsonb language sql set search_path='' as $$select wfw_private.update_shopping_list(items,expected_revision)$$;
revoke all on function public.wfw_update_shopping_list(jsonb,bigint) from public,anon;
grant execute on function public.wfw_update_shopping_list(jsonb,bigint) to authenticated;

create or replace function wfw_private.set_shopping_purchased(week_start text,changes jsonb,expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; p jsonb; rev bigint; item jsonb; idx integer; used integer[]:='{}'; ticks jsonb; stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 uid:=wfw_private.authorize_shopping_edit();
 if week_start is null or week_start !~ '^\d{4}-\d{2}-\d{2}$' or week_start<'1900-01-01' or week_start>'2200-12-31' or to_char(week_start::date,'YYYY-MM-DD')<>week_start or extract(isodow from week_start::date)<>1
 or jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) not between 1 and 200 or expected_revision is null or expected_revision<1 then raise exception 'Invalid shopping week or changes'; end if;
 select payload,revision into p,rev from public.nutrition_state where user_id=uid for update;
 if p is null then raise exception 'Sync your tracker first'; end if;
 if rev<>expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 ticks:=coalesce(p->'shoppingWeeks'->week_start,'{}');
 for item in select value from jsonb_array_elements(changes) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'item_index') is distinct from 'number' or (item->>'item_index') !~ '^[0-9]+$' or jsonb_typeof(item->'purchased') is distinct from 'boolean'
  or exists(select 1 from jsonb_object_keys(item) k where k not in ('item_index','purchased')) then raise exception 'Invalid purchase change'; end if;
  idx:=(item->>'item_index')::integer;
  if idx<0 or idx>=jsonb_array_length(p->'shoppingItems') or idx=any(used) then raise exception 'Invalid or repeated item index'; end if;
  used:=array_append(used,idx);ticks:=jsonb_set(ticks,array[idx::text],item->'purchased');
 end loop;
 p:=jsonb_set(p,'{shoppingWeeks}',coalesce(p->'shoppingWeeks','{}'));p:=jsonb_set(p,array['shoppingWeeks',week_start],ticks);
 p:=jsonb_set(p,'{shoppingFormat}','1');p:=jsonb_set(p,'{updatedAt}',to_jsonb(stamp));
 update public.nutrition_state set payload=p where user_id=uid returning revision into rev;
 return jsonb_build_object('saved',true,'revision',rev,'week_start',week_start,'purchased',ticks);
end $$;
revoke all on function wfw_private.set_shopping_purchased(text,jsonb,bigint) from public,anon;
grant execute on function wfw_private.set_shopping_purchased(text,jsonb,bigint) to authenticated;
create or replace function public.wfw_set_shopping_purchased(week_start text,changes jsonb,expected_revision bigint) returns jsonb language sql set search_path='' as $$select wfw_private.set_shopping_purchased(week_start,changes,expected_revision)$$;
revoke all on function public.wfw_set_shopping_purchased(text,jsonb,bigint) from public,anon;
grant execute on function public.wfw_set_shopping_purchased(text,jsonb,bigint) to authenticated;

-- Older clients must not silently drop the flexible-list format after a sync.
create or replace function public.wfw_preserve_version() returns trigger language plpgsql set search_path='' as $$begin
 if old.payload->>'version'='3' and new.payload->>'version' is distinct from '3' then raise exception 'Update this app before saving';end if;
 if old.payload->>'shoppingFormat'='1' and new.payload->>'shoppingFormat' is distinct from '1' then raise exception 'Update this app for shopping list support before saving';end if;
 return new;end $$;
