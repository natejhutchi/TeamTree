-- TeamTownTree Supabase schema
-- Run this in Supabase SQL editor after creating the project.

create extension if not exists citext;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  brand jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email citext not null,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  role text not null default 'rep' check (role in ('admin', 'rep')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, email),
  unique(company_id, user_id)
);

create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  data jsonb not null,
  is_company_default boolean not null default false,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

create index if not exists company_members_user_id_idx on public.company_members(user_id);
create index if not exists company_members_email_idx on public.company_members(email);
create index if not exists trees_company_id_idx on public.trees(company_id);
create index if not exists trees_archived_at_idx on public.trees(archived_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_touch_updated_at on public.companies;
create trigger companies_touch_updated_at
before update on public.companies
for each row execute function public.touch_updated_at();

drop trigger if exists company_members_touch_updated_at on public.company_members;
create trigger company_members_touch_updated_at
before update on public.company_members
for each row execute function public.touch_updated_at();

drop trigger if exists trees_touch_updated_at on public.trees;
create trigger trees_touch_updated_at
before update on public.trees
for each row execute function public.touch_updated_at();

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

create or replace function public.can_edit_company_trees(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.role in ('admin', 'rep')
  );
$$;

create or replace function public.claim_company_membership()
returns table (
  company_id uuid,
  company_name text,
  company_slug text,
  display_name text,
  member_role text,
  company_brand jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email citext;
begin
  select email::citext into user_email
  from auth.users
  where id = auth.uid();

  if user_email is null then
    return;
  end if;

  update public.company_members cm
  set user_id = auth.uid()
  where cm.email = user_email
    and cm.status = 'active'
    and (cm.user_id is null or cm.user_id = auth.uid());

  return query
  select c.id, c.name, c.slug, cm.display_name, cm.role, c.brand
  from public.company_members cm
  join public.companies c on c.id = cm.company_id
  where cm.user_id = auth.uid()
    and cm.status = 'active'
  order by cm.created_at asc
  limit 1;
end;
$$;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.trees enable row level security;

drop policy if exists companies_select_members on public.companies;
create policy companies_select_members
  on public.companies
  for select
  using (public.is_company_member(id));

drop policy if exists company_members_select_self_company on public.company_members;
create policy company_members_select_self_company
  on public.company_members
  for select
  using (public.is_company_member(company_id));

drop policy if exists trees_select_company_members on public.trees;
create policy trees_select_company_members
  on public.trees
  for select
  using (public.is_company_member(company_id));

drop policy if exists trees_insert_company_editors on public.trees;
create policy trees_insert_company_editors
  on public.trees
  for insert
  with check (public.can_edit_company_trees(company_id));

drop policy if exists trees_update_company_editors on public.trees;
create policy trees_update_company_editors
  on public.trees
  for update
  using (public.can_edit_company_trees(company_id))
  with check (public.can_edit_company_trees(company_id));

drop policy if exists trees_delete_company_admins on public.trees;
create policy trees_delete_company_admins
  on public.trees
  for delete
  using (
    exists (
      select 1
      from public.company_members cm
      where cm.company_id = trees.company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role = 'admin'
    )
  );

-- Example seed. Edit before running, or run manually later.
-- insert into public.companies (name, slug, brand)
-- values ('TeamTown', 'teamtown', '{"productName":"TeamTownTree","logoText":"TeamTownTree","metaphor":"tree"}'::jsonb)
-- on conflict (slug) do nothing;
--
-- insert into public.company_members (company_id, email, display_name, role)
-- select id, 'rep@example.com', 'Rep Name', 'admin'
-- from public.companies
-- where slug = 'teamtown'
-- on conflict do nothing;


