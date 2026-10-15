create schema if not exists wfw_private;
revoke all on schema wfw_private from public,anon,authenticated;
grant usage on schema wfw_private to service_role;
create table public.wfw_connector_access(user_id uuid not null references auth.users(id) on delete cascade,client_id text not null check(length(client_id) between 1 and 200),can_read boolean not null default true,can_write boolean not null default false,primary key(user_id,client_id));
alter table public.wfw_connector_access enable row level security;
grant select,insert,update,delete on public.wfw_connector_access to authenticated;
create policy connector_read on public.wfw_connector_access for select to authenticated using(user_id=(select auth.uid()) and ((select auth.jwt()->>'client_id') is null or client_id=(select auth.jwt()->>'client_id')));
create policy connector_insert on public.wfw_connector_access for insert to authenticated with check(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
create policy connector_update on public.wfw_connector_access for update to authenticated using(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null) with check(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
create policy connector_delete on public.wfw_connector_access for delete to authenticated using(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
create policy connector_state_read on public.nutrition_state as restrictive for select to authenticated using((select auth.jwt()->>'client_id') is null or exists(select 1 from public.wfw_connector_access g where g.user_id=(select auth.uid()) and g.client_id=(select auth.jwt()->>'client_id') and g.can_read));
create policy connector_state_write on public.nutrition_state as restrictive for update to authenticated using((select auth.jwt()->>'client_id') is null or exists(select 1 from public.wfw_connector_access g where g.user_id=(select auth.uid()) and g.client_id=(select auth.jwt()->>'client_id') and g.can_write)) with check((select auth.jwt()->>'client_id') is null or exists(select 1 from public.wfw_connector_access g where g.user_id=(select auth.uid()) and g.client_id=(select auth.jwt()->>'client_id') and g.can_write));
create policy connector_state_insert on public.nutrition_state as restrictive for insert to authenticated with check((select auth.jwt()->>'client_id') is null or exists(select 1 from public.wfw_connector_access g where g.user_id=(select auth.uid()) and g.client_id=(select auth.jwt()->>'client_id') and g.can_write));
create table public.wfw_notification_settings(user_id uuid primary key references auth.users(id) on delete cascade,water_enabled boolean not null default false,stock_enabled boolean not null default false,timezone text not null default 'Europe/London' check(length(timezone)<100),start_hour integer not null default 9 check(start_hour between 0 and 23),end_hour integer not null default 21 check(end_hour between 1 and 24 and end_hour>start_hour),interval_minutes integer not null default 120 check(interval_minutes in(120,180,240)));
alter table public.wfw_notification_settings enable row level security;
grant select,insert,update,delete on public.wfw_notification_settings to authenticated;
create policy own_settings on public.wfw_notification_settings for all to authenticated using(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null) with check(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
create table public.wfw_push_subscriptions(endpoint text primary key check(length(endpoint)<2048),user_id uuid not null references auth.users(id) on delete cascade,subscription jsonb not null,created_at timestamptz not null default now());
create index wfw_push_user_idx on public.wfw_push_subscriptions(user_id);
alter table public.wfw_push_subscriptions enable row level security;
revoke all on public.wfw_push_subscriptions from anon,authenticated;
create table public.wfw_notification_events(user_id uuid not null references auth.users(id) on delete cascade,kind text not null,event_key text not null,created_at timestamptz not null default now(),primary key(user_id,kind,event_key));
alter table public.wfw_notification_events enable row level security;
revoke all on public.wfw_notification_events from anon,authenticated;
grant all on public.wfw_notification_settings,public.wfw_push_subscriptions,public.wfw_notification_events,public.wfw_connector_access to service_role;
grant select on public.wfw_connector_access to supabase_auth_admin;
create policy auth_hook_grants on public.wfw_connector_access for select to supabase_auth_admin using(true);
create or replace function public.wfw_access_token_hook(event jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare claims jsonb:=event->'claims';
begin
 if claims->>'client_id' is not null and exists(select 1 from public.wfw_connector_access where user_id=(event->>'user_id')::uuid and client_id=claims->>'client_id' and can_read) then claims:=jsonb_set(claims,'{resource}','"https://zrtnabwryzbdqzwghxcp.supabase.co/functions/v1/wfw-mcp"'::jsonb);end if;
 return jsonb_set(event,'{claims}',claims);
end $$;
revoke all on function public.wfw_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function public.wfw_access_token_hook(jsonb) to supabase_auth_admin;
create or replace function wfw_private.push_keys(pub text default null,priv text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text;s text;j text;
begin
 perform pg_advisory_xact_lock(178462391);
 select decrypted_secret into p from vault.decrypted_secrets where name='wfw_vapid_public';
 if p is null and pub is not null and priv is not null then perform vault.create_secret(pub,'wfw_vapid_public');perform vault.create_secret(priv,'wfw_vapid_private');end if;
 select decrypted_secret into p from vault.decrypted_secrets where name='wfw_vapid_public';select decrypted_secret into s from vault.decrypted_secrets where name='wfw_vapid_private';select decrypted_secret into j from vault.decrypted_secrets where name='wfw_push_job';
 return jsonb_build_object('publicKey',p,'privateKey',s,'jobKey',j);
end $$;
revoke all on function wfw_private.push_keys(text,text) from public,anon,authenticated;
grant execute on function wfw_private.push_keys(text,text) to service_role;
create or replace function public.wfw_push_keys(pub text default null,priv text default null) returns jsonb language sql set search_path='' as $$select wfw_private.push_keys(pub,priv)$$;
revoke all on function public.wfw_push_keys(text,text) from public,anon,authenticated;
grant execute on function public.wfw_push_keys(text,text) to service_role;
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'wfw_push_job') where not exists(select 1 from vault.secrets where name='wfw_push_job');
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
alter table public.nutrition_state drop constraint nutrition_state_payload_check;
alter table public.nutrition_state add constraint nutrition_state_payload_check check(jsonb_typeof(payload)='object' and payload->>'version' in('2','3') and octet_length(payload::text)<=5000000);
create or replace function public.nutrition_save(expected_revision bigint,next_payload jsonb) returns public.nutrition_state language plpgsql set search_path='' as $$
declare result public.nutrition_state;uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sign in required' using errcode='42501';end if;
 if expected_revision is null or expected_revision<0 or next_payload is null or jsonb_typeof(next_payload) is distinct from 'object' or (next_payload->>'version') is null or next_payload->>'version' not in('2','3') or jsonb_typeof(next_payload->'days') is distinct from 'object' or jsonb_typeof(next_payload->'weights') is distinct from 'object' or jsonb_typeof(next_payload->'settings') is distinct from 'object' then raise exception 'Invalid nutrition state' using errcode='22023';end if;
 if next_payload->>'version'='2' and exists(select 1 from public.nutrition_state where user_id=uid and payload->>'version'='3') then raise exception 'Update this app before saving' using errcode='22023';end if;
 if expected_revision=0 then insert into public.nutrition_state(user_id,payload) values(uid,next_payload) on conflict(user_id) do nothing returning * into result;
 else update public.nutrition_state set payload=next_payload where user_id=uid and revision=expected_revision returning * into result;end if;
 if result.user_id is null then raise exception 'Nutrition sync conflict: fetch latest revision' using errcode='40001';end if;return result;
end $$;
