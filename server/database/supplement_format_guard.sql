-- Protect custom names and IDs from clients that do not understand them.
create or replace function public.wfw_preserve_version() returns trigger language plpgsql set search_path='' as $$begin
 if old.payload->>'version'='3' and new.payload->>'version' is distinct from '3' then raise exception 'Update this app before saving';end if;
 if old.payload->>'shoppingFormat'='1' and new.payload->>'shoppingFormat' is distinct from '1' then raise exception 'Update this app for shopping list support before saving';end if;
 if old.payload ? 'supplementItems' and jsonb_typeof(new.payload->'supplementItems') is distinct from 'array' then raise exception 'Update this app for custom supplement support before saving';end if;
 return new;end $$;
