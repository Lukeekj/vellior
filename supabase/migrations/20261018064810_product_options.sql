-- VELLIOR: product choice groups for colors, sizes, models, etc.
-- Inventory remains product-level (shared total) until variant-specific stock is implemented.
alter table public.products
  add column if not exists options jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.products add constraint products_options_is_array
    check (jsonb_typeof(options) = 'array');
exception when duplicate_object then null;
end $$;

comment on column public.products.options is
  'Admin-configured choice groups, e.g. [{"name":"COR","values":["CRISTAL","NIQUEL"]}]. Stock is the shared product total.';
