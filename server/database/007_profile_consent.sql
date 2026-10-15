-- Existing meal-edit approvals do not authorize changes to goals or weight.
alter table public.wfw_connector_access add column if not exists can_profile_write boolean not null default false;
create or replace function wfw_private.authorize_profile_edit() returns uuid language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); cid text:=auth.jwt()->>'client_id';
begin
 if uid is null or cid is null or auth.jwt()->>'resource' is distinct from 'https://zrtnabwryzbdqzwghxcp.supabase.co/functions/v1/wfw-mcp'
 or not exists(select 1 from public.wfw_connector_access where user_id=uid and client_id=cid and can_read and can_profile_write)
 then raise exception 'Profile editing not authorized' using errcode='42501'; end if;
 return uid;
end $$;
