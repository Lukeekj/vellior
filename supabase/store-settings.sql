-- VELLIOR: global storefront preferences. Safe to re-run.
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;

drop policy if exists store_settings_public_read on public.store_settings;
create policy store_settings_public_read
  on public.store_settings for select using (true);

drop policy if exists store_settings_admin_write on public.store_settings;
create policy store_settings_admin_write
  on public.store_settings for all to authenticated
  using (public.has_role('admin'::public.app_role))
  with check (public.has_role('admin'::public.app_role));

grant select on public.store_settings to anon, authenticated;
grant insert, update, delete on public.store_settings to authenticated;

insert into public.store_settings(key, value)
values ('show_demo_products', 'true'::jsonb)
on conflict (key) do nothing;

