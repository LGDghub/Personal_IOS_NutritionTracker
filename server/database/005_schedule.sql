-- Explicit deny policies document that only the backend service may use these tables.
create policy backend_only on public.wfw_push_subscriptions for all to anon,authenticated using(false) with check(false);
create policy backend_only on public.wfw_notification_events for all to anon,authenticated using(false) with check(false);
select cron.schedule('wfw-personal-reminders','*/5 * * * *',$job$
 select net.http_post(
 url:='https://zrtnabwryzbdqzwghxcp.supabase.co/functions/v1/wfw-push/dispatch',
 headers:=jsonb_build_object('Content-Type','application/json','x-wfw-job-key',(select decrypted_secret from vault.decrypted_secrets where name='wfw_push_job')),
 body:='{}'::jsonb,timeout_milliseconds:=30000
 );
$job$);
