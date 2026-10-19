-- Align feedback: ordinary account sessions only. OAuth tracker connections cannot read feedback.
create table public.align_feedback_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.align_feedback_admins enable row level security;
revoke all on public.align_feedback_admins from anon,authenticated;
grant select on public.align_feedback_admins to authenticated;
create policy feedback_admin_self on public.align_feedback_admins for select to authenticated
 using(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
create table public.align_feedback (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 category text not null check(category in('idea','bug','general')),
 message text not null check(length(btrim(message)) between 5 and 3000),
 app_version text not null check(length(app_version) between 1 and 30),
 created_at timestamptz not null default now(),
 status text not null default 'new' check(status in('new','reviewed'))
);
create index align_feedback_user_created on public.align_feedback(user_id,created_at);
create index align_feedback_created on public.align_feedback(created_at desc,id desc);
alter table public.align_feedback enable row level security;
revoke all on public.align_feedback from anon,authenticated;
grant select on public.align_feedback to authenticated;
grant insert(user_id,category,message,app_version) on public.align_feedback to authenticated;
grant update(status) on public.align_feedback to authenticated;
create policy feedback_submit on public.align_feedback for insert to authenticated
 with check(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
create policy feedback_read on public.align_feedback for select to authenticated
 using((select auth.jwt()->>'client_id') is null and (user_id=(select auth.uid()) or exists(select 1 from public.align_feedback_admins where user_id=(select auth.uid()))));
create policy feedback_review on public.align_feedback for update to authenticated
 using((select auth.jwt()->>'client_id') is null and exists(select 1 from public.align_feedback_admins where user_id=(select auth.uid())))
 with check((select auth.jwt()->>'client_id') is null and exists(select 1 from public.align_feedback_admins where user_id=(select auth.uid())));
-- Invoker trigger reads only the sender's own rows, which the policy permits.
create function public.align_feedback_limit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
 if (select count(*) from public.align_feedback where user_id=new.user_id and created_at>now()-interval '1 day')>=10 then
 raise exception 'Please limit feedback to 10 messages per day. Try again tomorrow.' using errcode='P0001';end if;
 return new;
end $$;
revoke all on function public.align_feedback_limit() from public,anon,authenticated;
create trigger align_feedback_limit before insert on public.align_feedback for each row execute function public.align_feedback_limit();
