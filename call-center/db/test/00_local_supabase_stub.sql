-- LOCAL SANDBOX ONLY. Mimics the bits of Supabase the call-center SQL relies on
-- (auth.users, auth.uid(), roles anon/authenticated). Never run on Supabase.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Three test users (in a Supabase test project, create them in Authentication instead).
insert into auth.users (id, email) values
  (gen_random_uuid(), 'agent@cc.test'),
  (gen_random_uuid(), 'supervisor@cc.test'),
  (gen_random_uuid(), 'outsider@cc.test')
on conflict do nothing;
