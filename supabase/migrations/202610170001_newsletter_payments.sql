-- VELLIOR newsletter consent, campaigns and integration secret allowlist.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email)) and length(email) <= 254),
  status text not null default 'active' check (status in ('active','unsubscribed')),
  consent_at timestamptz not null default now(),
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;
drop policy if exists newsletter_admin_read on public.newsletter_subscribers;
create policy newsletter_admin_read on public.newsletter_subscribers for select to authenticated using (public.has_role('admin'::public.app_role));

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (length(trim(subject)) between 3 and 160),
  body text not null check (length(body) between 1 and 20000),
  image_url text,
  status text not null default 'draft' check (status in ('draft','sending','sent','failed')),
  recipient_count integer,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.newsletter_campaigns enable row level security;
revoke all on public.newsletter_campaigns from anon, authenticated;
grant select, insert, update on public.newsletter_campaigns to authenticated;
drop policy if exists newsletter_campaign_admin on public.newsletter_campaigns;
create policy newsletter_campaign_admin on public.newsletter_campaigns for all to authenticated using (public.has_role('admin'::public.app_role)) with check (public.has_role('admin'::public.app_role));

create table if not exists public.newsletter_events (
  id uuid primary key default gen_random_uuid(), campaign_id uuid references public.newsletter_campaigns(id) on delete set null,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  event text not null check (event in ('welcome_sent','campaign_sent','send_failed','unsubscribed')),
  created_at timestamptz not null default now()
);
alter table public.newsletter_events enable row level security;
revoke all on public.newsletter_events from anon, authenticated;
grant select on public.newsletter_events to authenticated;
drop policy if exists newsletter_events_admin on public.newsletter_events;
create policy newsletter_events_admin on public.newsletter_events for select to authenticated using (public.has_role('admin'::public.app_role));

create or replace function public.set_vellior_secret(p_name text, p_value text)
returns void language plpgsql security definer set search_path = '' as $$
declare existing_id uuid;
begin
  if auth.uid() is null or not public.has_role('admin'::public.app_role) then raise exception 'forbidden'; end if;
  if p_name not in ('vellior_resend_api_key','vellior_resend_from_email','vellior_mp_access_token','vellior_mp_webhook_secret')
    or length(trim(coalesce(p_value,''))) < 8 or length(p_value) > 2048 then raise exception 'invalid secret'; end if;
  select id into existing_id from vault.secrets where name=p_name limit 1;
  if existing_id is null then perform vault.create_secret(p_value,p_name,'VELLIOR private integration credential');
  else perform vault.update_secret(existing_id,p_value,p_name,'VELLIOR private integration credential'); end if;
end; $$;
revoke all on function public.set_vellior_secret(text,text) from public, anon;
grant execute on function public.set_vellior_secret(text,text) to authenticated;

create or replace function public.get_vellior_secret(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'forbidden'; end if;
  if p_name not in ('vellior_resend_api_key','vellior_resend_from_email','vellior_mp_access_token','vellior_mp_webhook_secret') then raise exception 'invalid secret'; end if;
  select decrypted_secret into result from vault.decrypted_secrets where name=p_name limit 1;
  return result;
end; $$;
revoke all on function public.get_vellior_secret(text) from public, anon, authenticated;
grant execute on function public.get_vellior_secret(text) to service_role;

create or replace function public.newsletter_unsubscribe(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  update public.newsletter_subscribers set status='unsubscribed' where unsubscribe_token=p_token and status='active';
  get diagnostics changed = row_count;
  if changed > 0 then insert into public.newsletter_events(subscriber_id,event) select id,'unsubscribed' from public.newsletter_subscribers where unsubscribe_token=p_token; end if;
  return changed > 0;
end; $$;
revoke all on function public.newsletter_unsubscribe(uuid) from public, anon, authenticated;
grant execute on function public.newsletter_unsubscribe(uuid) to service_role;

create index if not exists newsletter_subscribers_status_idx on public.newsletter_subscribers(status,created_at);
create index if not exists newsletter_campaigns_created_idx on public.newsletter_campaigns(created_at desc);

create table if not exists public.newsletter_rate_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.newsletter_rate_limits enable row level security;
revoke all on public.newsletter_rate_limits from public, anon, authenticated;
create or replace function public.newsletter_rate_limit(p_ip text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h text; current_count integer; started timestamptz;
begin
  h := encode(digest(coalesce(p_ip,'unknown') || current_date::text, 'sha256'),'hex');
  insert into public.newsletter_rate_limits(ip_hash,window_started_at,attempts) values(h,now(),1)
  on conflict(ip_hash) do update set attempts=case when newsletter_rate_limits.window_started_at < now()-interval '15 minutes' then 1 else newsletter_rate_limits.attempts+1 end,
    window_started_at=case when newsletter_rate_limits.window_started_at < now()-interval '15 minutes' then now() else newsletter_rate_limits.window_started_at end
  returning attempts,window_started_at into current_count,started;
  return current_count <= 5;
end; $$;
revoke all on function public.newsletter_rate_limit(text) from public, anon, authenticated;
grant execute on function public.newsletter_rate_limit(text) to service_role;

