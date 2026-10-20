-- Align shopping v2. The existing account-scoped authorization and revision lock remain in place.
create or replace function wfw_private.update_shopping_list(items jsonb, expected_revision bigint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid; p jsonb; rev bigint; item jsonb; idx integer; used integer[]:='{}'; original integer;
 new_items jsonb:='[]'; wk record; ticks jsonb; weeks jsonb:='{}'; legacy jsonb:='{}';
 qty integer; pack_size numeric; unit_price numeric; unit_name text;
 stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 uid:=wfw_private.authorize_shopping_edit();
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>200 or expected_revision is null or expected_revision<1 then raise exception 'Invalid shopping list'; end if;
 select payload,revision into p,rev from public.nutrition_state where user_id=uid for update;
 if p is null then raise exception 'Sync your tracker first'; end if;
 if rev<>expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item) is distinct from 'object' or not (item ? 'original_index') or jsonb_typeof(item->'name') is distinct from 'string' or length(trim(item->>'name')) not between 1 and 200
   or jsonb_typeof(item->'price') is distinct from 'number' or (item->>'price')::numeric<0 or (item->>'price')::numeric>10000 or round((item->>'price')::numeric,2)<>(item->>'price')::numeric
   or jsonb_typeof(item->'quantity') is distinct from 'number' or (item->>'quantity') !~ '^[0-9]+$'
   or jsonb_typeof(item->'size') is distinct from 'number' or (item->>'size')::numeric<0 or (item->>'size')::numeric>100000 or round((item->>'size')::numeric,3)<>(item->>'size')::numeric
   or jsonb_typeof(item->'unit') is distinct from 'string' or item->>'unit' not in ('mg','g','kg','oz','lb','ml','cl','L','fl oz','cup','pint','gallon','piece','pack')
   or exists(select 1 from jsonb_object_keys(item) k where k not in ('original_index','name','quantity','size','unit','price')) then raise exception 'Invalid shopping item'; end if;
  qty:=(item->>'quantity')::integer; pack_size:=(item->>'size')::numeric; unit_price:=(item->>'price')::numeric; unit_name:=item->>'unit';
  if qty not between 1 and 1000 or qty*unit_price>1000000 then raise exception 'Invalid shopping quantity or total'; end if;
  if item->'original_index'<>'null'::jsonb then
   if jsonb_typeof(item->'original_index') is distinct from 'number' or (item->>'original_index') !~ '^[0-9]+$' then raise exception 'Invalid original index'; end if;
   original:=(item->>'original_index')::integer;
   if original<0 or original>=jsonb_array_length(p->'shoppingItems') or original=any(used) then raise exception 'Invalid or repeated original index'; end if;
   used:=array_append(used,original);
  end if;
  new_items:=new_items||jsonb_build_array(jsonb_build_object('name',trim(item->>'name'),'quantity',qty,'size',pack_size,'unit',unit_name,'price',unit_price));
 end loop;
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
 p:=jsonb_set(p,'{shoppingFormat}','2');p:=jsonb_set(p,'{updatedAt}',to_jsonb(stamp));
 update public.nutrition_state set payload=p where user_id=uid returning revision into rev;
 return jsonb_build_object('saved',true,'revision',rev,'items',new_items,'currency','GBP','subtotal',coalesce((select sum((value->>'quantity')::numeric*(value->>'price')::numeric) from jsonb_array_elements(new_items)),0));
end $function$;

create function wfw_private.set_shopping_discount(week_start text, new_discount jsonb, expected_revision bigint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid; p jsonb; rev bigint; discounts jsonb; value numeric;
 stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 uid:=wfw_private.authorize_shopping_edit();
 if week_start is null or week_start !~ '^\d{4}-\d{2}-\d{2}$' or week_start<'1900-01-01' or week_start>'2200-12-31'
  or to_char(week_start::date,'YYYY-MM-DD')<>week_start or extract(isodow from week_start::date)<>1 or expected_revision is null or expected_revision<1 then raise exception 'Invalid shopping week'; end if;
 if new_discount is not null then
  if jsonb_typeof(new_discount) is distinct from 'object' or new_discount->>'type' not in ('percent','amount') or jsonb_typeof(new_discount->'value') is distinct from 'number'
   or exists(select 1 from jsonb_object_keys(new_discount) k where k not in ('type','value')) then raise exception 'Invalid discount'; end if;
  value:=(new_discount->>'value')::numeric;
  if value<0 or round(value,2)<>value or (new_discount->>'type'='percent' and value>100) or (new_discount->>'type'='amount' and value>10000) then raise exception 'Invalid discount value'; end if;
 end if;
 select payload,revision into p,rev from public.nutrition_state where user_id=uid for update;
 if p is null then raise exception 'Sync your tracker first'; end if;
 if rev<>expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 discounts:=coalesce(p->'shoppingDiscounts','{}'::jsonb);
 if new_discount is null then discounts:=discounts-week_start; else discounts:=jsonb_set(discounts,array[week_start],new_discount); end if;
 p:=jsonb_set(p,'{shoppingDiscounts}',discounts);p:=jsonb_set(p,'{updatedAt}',to_jsonb(stamp));
 update public.nutrition_state set payload=p where user_id=uid returning revision into rev;
 return jsonb_build_object('saved',true,'revision',rev,'week_start',week_start,'discount',new_discount);
end $function$;

create function public.wfw_set_shopping_discount(week_start text, new_discount jsonb, expected_revision bigint)
returns jsonb language sql set search_path to '' as $function$select wfw_private.set_shopping_discount(week_start,new_discount,expected_revision)$function$;
revoke all on function public.wfw_set_shopping_discount(text,jsonb,bigint) from public,anon;
grant execute on function public.wfw_set_shopping_discount(text,jsonb,bigint) to authenticated;

-- Permit v1 -> v2 upgrades and block an older client from later downgrading v2.
create or replace function public.wfw_preserve_version() returns trigger language plpgsql set search_path='' as $function$
begin
 if old.payload->>'version'='3' and new.payload->>'version' is distinct from '3' then raise exception 'Update this app before saving';end if;
 if old.payload->>'shoppingFormat' in ('1','2') and coalesce(new.payload->>'shoppingFormat','') not in ('1','2') then raise exception 'Update this app for shopping list support before saving';end if;
 if old.payload->>'shoppingFormat'='2' and new.payload->>'shoppingFormat' is distinct from '2' then raise exception 'Update this app for shopping prices and discounts before saving';end if;
 if old.payload ? 'supplementItems' and jsonb_typeof(new.payload->'supplementItems') is distinct from 'array' then raise exception 'Update this app for custom supplement support before saving';end if;
 return new;
end $function$;

-- Keep the shopping format at v2 when a purchase tick changes.
create or replace function wfw_private.set_shopping_purchased(week_start text, changes jsonb, expected_revision bigint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid; p jsonb; rev bigint; item jsonb; idx integer; used integer[]:='{}'; ticks jsonb;
 stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
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
 p:=jsonb_set(p,'{shoppingFormat}',to_jsonb(case when p->>'shoppingFormat'='2' then 2 else 1 end));p:=jsonb_set(p,'{updatedAt}',to_jsonb(stamp));
 update public.nutrition_state set payload=p where user_id=uid returning revision into rev;
 return jsonb_build_object('saved',true,'revision',rev,'week_start',week_start,'purchased',ticks);
end $function$;
