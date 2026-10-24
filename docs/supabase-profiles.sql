-- SPIRO: profiles table for signed-up accounts.
-- Run once in Supabase → SQL Editor → New query → Run.
-- Log-in itself uses Supabase Auth (auth.users), which already keeps every account
-- and its hashed password. This table only lists the accounts with an email, a role
-- and the sign-up date. It never stores passwords.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

-- Row Level Security: each user can read only their own row; nobody can change roles from the website.
alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Add a profile row automatically whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts that signed up before this script ran.
insert into public.profiles (id, email, created_at)
select id, email, created_at from auth.users
on conflict (id) do nothing;
