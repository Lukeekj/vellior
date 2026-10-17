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

