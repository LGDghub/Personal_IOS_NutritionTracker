create table public.nutrition_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'version' = '2' and octet_length(payload::text) <= 5000000),
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now()
);
alter table public.nutrition_state enable row level security;
revoke all on public.nutrition_state from anon, authenticated;
grant select, insert, update on public.nutrition_state to authenticated;
create policy nutrition_select_own on public.nutrition_state for select to authenticated using ((select auth.uid()) = user_id);
create policy nutrition_insert_own on public.nutrition_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy nutrition_update_own on public.nutrition_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create function public.nutrition_stamp() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if TG_OP = 'UPDATE' then new.revision := old.revision + 1; else new.revision := 1; end if;
 new.updated_at := clock_timestamp();
 return new;
end $$;
revoke all on function public.nutrition_stamp() from public, anon, authenticated;
create trigger nutrition_stamp_before_write before insert or update on public.nutrition_state for each row execute function public.nutrition_stamp();

create function public.nutrition_save(expected_revision bigint, next_payload jsonb)
returns public.nutrition_state language plpgsql security invoker set search_path = '' as $$
declare result public.nutrition_state; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'Sign in required' using errcode = '42501'; end if;
 if expected_revision is null or expected_revision < 0 or next_payload is null
 or jsonb_typeof(next_payload) is distinct from 'object'
 or next_payload->>'version' is distinct from '2'
 or jsonb_typeof(next_payload->'days') is distinct from 'object'
 or jsonb_typeof(next_payload->'weights') is distinct from 'object'
 or jsonb_typeof(next_payload->'settings') is distinct from 'object'
 then raise exception 'Invalid nutrition state' using errcode = '22023'; end if;
 if expected_revision = 0 then
   insert into public.nutrition_state(user_id,payload) values(uid,next_payload)
   on conflict (user_id) do nothing returning * into result;
 else
   update public.nutrition_state set payload = next_payload
   where user_id = uid and revision = expected_revision returning * into result;
 end if;
 if result.user_id is null then raise exception 'Nutrition sync conflict: fetch latest revision' using errcode = '40001'; end if;
 return result;
end $$;
revoke all on function public.nutrition_save(bigint,jsonb) from public, anon;
grant execute on function public.nutrition_save(bigint,jsonb) to authenticated;
comment on table public.nutrition_state is 'Nutrition OS v2 owner-private snapshots. ChatGPT may read with the connected Supabase management plugin when requested. updated_at is last successful upload.';
