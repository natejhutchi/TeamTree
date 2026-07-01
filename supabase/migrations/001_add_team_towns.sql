-- Add Team Town workspace layer and keep company_members as the membership table.
-- Run this after the original schema if trees currently point directly to companies.

create extension if not exists citext;

create table if not exists public.team_towns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  slug text not null,
  brand jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, slug)
);

create index if not exists team_towns_company_id_idx
  on public.team_towns(company_id);

alter table public.team_towns enable row level security;

drop trigger if exists team_towns_touch_updated_at on public.team_towns;
create trigger team_towns_touch_updated_at
before update on public.team_towns
for each row execute function public.touch_updated_at();

-- Every existing company gets one default Team Town.
insert into public.team_towns (company_id, name, slug, brand)
select c.id, c.name || ' Town', c.slug, c.brand
from public.companies c
where not exists (
  select 1
  from public.team_towns tt
  where tt.company_id = c.id
);

-- Move trees from company-owned to team-town-owned without losing existing rows.
alter table public.trees
  add column if not exists team_town_id uuid references public.team_towns(id) on delete cascade;

update public.trees t
set team_town_id = tt.id
from public.team_towns tt
where t.team_town_id is null
  and t.company_id = tt.company_id;

alter table public.trees
  alter column team_town_id set not null;

create index if not exists trees_team_town_id_idx
  on public.trees(team_town_id);

-- Replace old company-level uniqueness with town-level uniqueness.
alter table public.trees
  drop constraint if exists trees_company_id_name_key;

alter table public.trees
  add constraint trees_team_town_id_name_key unique(team_town_id, name);

-- Keep company_id temporarily for compatibility during rollout, but enforce consistency.
create or replace function public.tree_company_matches_team_town()
returns trigger
language plpgsql
as $$
declare
  town_company_id uuid;
begin
  select company_id into town_company_id
  from public.team_towns
  where id = new.team_town_id;

  if town_company_id is null then
    raise exception 'team_town_not_found';
  end if;

  if new.company_id is null then
    new.company_id = town_company_id;
  elsif new.company_id <> town_company_id then
    raise exception 'tree_company_id_must_match_team_town_company_id';
  end if;

  return new;
end;
$$;

drop trigger if exists trees_company_matches_team_town on public.trees;
create trigger trees_company_matches_team_town
before insert or update of company_id, team_town_id on public.trees
for each row execute function public.tree_company_matches_team_town();

-- Membership helpers stay centered on company_members.
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

create or replace function public.is_team_town_member(target_team_town_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_towns tt
    where tt.id = target_team_town_id
      and public.is_company_member(tt.company_id)
  );
$$;

create or replace function public.can_edit_team_town_trees(target_team_town_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_towns tt
    where tt.id = target_team_town_id
      and public.can_edit_company_trees(tt.company_id)
  );
$$;

-- Return the user's company plus their first Team Town for app bootstrap.
drop function if exists public.claim_company_membership();
create function public.claim_company_membership()
returns table (
  company_id uuid,
  company_name text,
  company_slug text,
  team_town_id uuid,
  team_town_name text,
  team_town_slug text,
  display_name text,
  member_role text,
  company_brand jsonb,
  team_town_brand jsonb
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
  select
    c.id,
    c.name,
    c.slug,
    tt.id,
    tt.name,
    tt.slug,
    cm.display_name,
    cm.role,
    c.brand,
    tt.brand
  from public.company_members cm
  join public.companies c on c.id = cm.company_id
  join public.team_towns tt on tt.company_id = c.id
  where cm.user_id = auth.uid()
    and cm.status = 'active'
  order by cm.created_at asc, tt.created_at asc
  limit 1;
end;
$$;

-- RLS policies.
drop policy if exists team_towns_select_members on public.team_towns;
create policy team_towns_select_members
  on public.team_towns
  for select
  using (public.is_company_member(company_id));

drop policy if exists team_towns_insert_company_admins on public.team_towns;
create policy team_towns_insert_company_admins
  on public.team_towns
  for insert
  with check (
    exists (
      select 1
      from public.company_members cm
      where cm.company_id = team_towns.company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role = 'admin'
    )
  );

drop policy if exists team_towns_update_company_admins on public.team_towns;
create policy team_towns_update_company_admins
  on public.team_towns
  for update
  using (
    exists (
      select 1
      from public.company_members cm
      where cm.company_id = team_towns.company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.company_members cm
      where cm.company_id = team_towns.company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role = 'admin'
    )
  );

drop policy if exists trees_select_company_members on public.trees;
drop policy if exists trees_select_team_town_members on public.trees;
create policy trees_select_team_town_members
  on public.trees
  for select
  using (public.is_team_town_member(team_town_id));

drop policy if exists trees_insert_company_editors on public.trees;
drop policy if exists trees_insert_team_town_editors on public.trees;
create policy trees_insert_team_town_editors
  on public.trees
  for insert
  with check (public.can_edit_team_town_trees(team_town_id));

drop policy if exists trees_update_company_editors on public.trees;
drop policy if exists trees_update_team_town_editors on public.trees;
create policy trees_update_team_town_editors
  on public.trees
  for update
  using (public.can_edit_team_town_trees(team_town_id))
  with check (public.can_edit_team_town_trees(team_town_id));

drop policy if exists trees_delete_company_admins on public.trees;
drop policy if exists trees_delete_company_admins_via_team_town on public.trees;
create policy trees_delete_company_admins_via_team_town
  on public.trees
  for delete
  using (
    exists (
      select 1
      from public.team_towns tt
      join public.company_members cm on cm.company_id = tt.company_id
      where tt.id = trees.team_town_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role = 'admin'
    )
  );

grant select, insert, update on public.team_towns to authenticated;
grant select, insert, update, delete on public.trees to authenticated;



