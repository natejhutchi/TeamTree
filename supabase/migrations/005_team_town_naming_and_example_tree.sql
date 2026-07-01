-- Rename company/team_town vocabulary to team/town and ensure every town gets an Example tree.
-- Run after 004_default_tree_file.sql.

create extension if not exists citext;

do $$
begin
  if to_regclass('public.companies') is not null and to_regclass('public.teams') is null then
    alter table public.companies rename to teams;
  end if;

  if to_regclass('public.company_members') is not null and to_regclass('public.team_members') is null then
    alter table public.company_members rename to team_members;
  end if;

  if to_regclass('public.team_towns') is not null and to_regclass('public.towns') is null then
    alter table public.team_towns rename to towns;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_members' and column_name = 'company_id') then
    alter table public.team_members rename column company_id to team_id;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'towns' and column_name = 'company_id') then
    alter table public.towns rename column company_id to team_id;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trees' and column_name = 'company_id') then
    alter table public.trees rename column company_id to team_id;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trees' and column_name = 'team_town_id') then
    alter table public.trees rename column team_town_id to town_id;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trees' and column_name = 'is_company_default') then
    alter table public.trees rename column is_company_default to is_default;
  end if;
end;
$$;

-- Retire old helper names before recreating the new vocabulary.
drop function if exists public.claim_company_membership() cascade;
drop function if exists public.is_company_member(uuid) cascade;
drop function if exists public.is_company_admin(uuid) cascade;
drop function if exists public.can_edit_company_trees(uuid) cascade;
drop function if exists public.is_team_town_member(uuid) cascade;
drop function if exists public.can_edit_team_town_trees(uuid) cascade;
drop function if exists public.can_mutate_tree(uuid, uuid, boolean) cascade;
drop function if exists public.tree_company_matches_team_town() cascade;
drop function if exists public.set_tree_audit_fields() cascade;

create or replace function public.default_tree_data(default_source text default 'tree-file:teamtown-default')
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'version', 1,
    'source', default_source,
    'notes', '[]'::jsonb,
    'hiddenAnnouncementIndexes', '[]'::jsonb,
    'customBlocks', '[]'::jsonb,
    'deletedBlockIds', '[]'::jsonb,
    'blockPositions', '{}'::jsonb,
    'absoluteBlockIds', '[]'::jsonb,
    'customOptionsByBlock', '{}'::jsonb,
    'blockOverrides', '{}'::jsonb
  );
$$;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and tm.role = 'admin'
  );
$$;

create or replace function public.is_town_member(target_town_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.towns t
    where t.id = target_town_id
      and public.is_team_member(t.team_id)
  );
$$;

create or replace function public.can_mutate_tree(
  target_town_id uuid,
  target_created_by uuid,
  target_is_default boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.towns t
    where t.id = target_town_id
      and (
        public.is_team_admin(t.team_id)
        or (
          public.is_team_member(t.team_id)
          and target_created_by = auth.uid()
          and target_is_default = false
        )
      )
  );
$$;

create or replace function public.tree_team_matches_town()
returns trigger
language plpgsql
as $$
declare
  town_team_id uuid;
begin
  select team_id into town_team_id
  from public.towns
  where id = new.town_id;

  if town_team_id is null then
    raise exception 'town_not_found';
  end if;

  if new.team_id is null then
    new.team_id = town_team_id;
  elsif new.team_id <> town_team_id then
    raise exception 'tree_team_id_must_match_town_team_id';
  end if;

  return new;
end;
$$;

drop trigger if exists trees_company_matches_team_town on public.trees;
drop trigger if exists trees_team_matches_town on public.trees;
create trigger trees_team_matches_town
before insert or update of team_id, town_id on public.trees
for each row execute function public.tree_team_matches_town();

create or replace function public.set_tree_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by = auth.uid();
    end if;
    new.updated_by = auth.uid();
    return new;
  end if;

  if not public.is_team_admin(new.team_id) then
    if old.created_by is distinct from new.created_by then
      raise exception 'tree_owner_cannot_be_changed';
    end if;

    if old.is_default is distinct from new.is_default then
      raise exception 'default_tree_flag_cannot_be_changed';
    end if;

    if old.team_id is distinct from new.team_id or old.town_id is distinct from new.town_id then
      raise exception 'tree_workspace_cannot_be_changed';
    end if;
  end if;

  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trees_set_audit_fields on public.trees;
create trigger trees_set_audit_fields
before insert or update on public.trees
for each row execute function public.set_tree_audit_fields();

create or replace function public.claim_team_membership()
returns table (
  team_id uuid,
  team_name text,
  team_slug text,
  town_id uuid,
  town_name text,
  town_slug text,
  display_name text,
  member_role text,
  team_brand jsonb,
  town_brand jsonb
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

  update public.team_members tm
  set user_id = auth.uid()
  where tm.email = user_email
    and tm.status = 'active'
    and (tm.user_id is null or tm.user_id = auth.uid());

  return query
  select
    teams.id,
    teams.name,
    teams.slug,
    towns.id,
    towns.name,
    towns.slug,
    tm.display_name,
    tm.role,
    teams.brand,
    towns.brand
  from public.team_members tm
  join public.teams teams on teams.id = tm.team_id
  join public.towns towns on towns.team_id = teams.id
  where tm.user_id = auth.uid()
    and tm.status = 'active'
  order by tm.created_at asc, towns.created_at asc
  limit 1;
end;
$$;

create or replace function public.create_default_tree_for_town(target_town_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team_id uuid;
  default_tree_id uuid;
begin
  select team_id into target_team_id
  from public.towns
  where id = target_town_id;

  if target_team_id is null then
    raise exception 'town_not_found';
  end if;

  select id into default_tree_id
  from public.trees
  where town_id = target_town_id
    and is_default = true
    and archived_at is null
  limit 1;

  if default_tree_id is not null then
    return default_tree_id;
  end if;

  insert into public.trees (team_id, town_id, name, data, is_default)
  values (
    target_team_id,
    target_town_id,
    'Example',
    public.default_tree_data('tree-file:teamtown-default'),
    true
  )
  on conflict (town_id, name) do update
  set
    data = excluded.data,
    is_default = true,
    archived_at = null,
    updated_at = now()
  returning id into default_tree_id;

  return default_tree_id;
end;
$$;

create or replace function public.ensure_town_default_tree()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_default_tree_for_town(new.id);
  return new;
end;
$$;

drop trigger if exists towns_create_default_tree on public.towns;
create trigger towns_create_default_tree
after insert on public.towns
for each row execute function public.ensure_town_default_tree();

-- Rename the old TeamTown default tree to the generic Example label when possible.
update public.trees tr
set name = 'Example'
where tr.is_default = true
  and tr.name in ('TeamTown Starter Tree', 'TeamTown Default')
  and not exists (
    select 1
    from public.trees existing
    where existing.town_id = tr.town_id
      and existing.name = 'Example'
      and existing.id <> tr.id
  );

-- Backfill any town that does not yet have a default Example tree.
select public.create_default_tree_for_town(id)
from public.towns
where not exists (
  select 1
  from public.trees
  where trees.town_id = towns.id
    and trees.is_default = true
    and trees.archived_at is null
);

with ranked_defaults as (
  select
    id,
    row_number() over (partition by town_id order by updated_at desc, created_at desc) as default_rank
  from public.trees
  where is_default = true
    and archived_at is null
)
update public.trees tr
set is_default = false
from ranked_defaults rd
where tr.id = rd.id
  and rd.default_rank > 1;

drop index if exists public.trees_one_default_per_team_town_idx;
create unique index if not exists trees_one_default_per_town_idx
  on public.trees(town_id)
  where is_default = true and archived_at is null;

-- RLS policies using new vocabulary.
drop policy if exists companies_select_members on public.teams;
drop policy if exists teams_select_members on public.teams;
create policy teams_select_members
  on public.teams
  for select
  using (public.is_team_member(id));

drop policy if exists company_members_select_self_company on public.team_members;
drop policy if exists company_members_insert_company_admins on public.team_members;
drop policy if exists company_members_update_company_admins on public.team_members;
drop policy if exists company_members_delete_company_admins on public.team_members;
drop policy if exists team_members_select_self_team on public.team_members;
drop policy if exists team_members_insert_team_admins on public.team_members;
drop policy if exists team_members_update_team_admins on public.team_members;
drop policy if exists team_members_delete_team_admins on public.team_members;

create policy team_members_select_self_team
  on public.team_members
  for select
  using (public.is_team_member(team_id));

create policy team_members_insert_team_admins
  on public.team_members
  for insert
  with check (public.is_team_admin(team_id));

create policy team_members_update_team_admins
  on public.team_members
  for update
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

create policy team_members_delete_team_admins
  on public.team_members
  for delete
  using (public.is_team_admin(team_id));

drop policy if exists team_towns_select_members on public.towns;
drop policy if exists team_towns_insert_company_admins on public.towns;
drop policy if exists team_towns_update_company_admins on public.towns;
drop policy if exists towns_select_members on public.towns;
drop policy if exists towns_insert_team_admins on public.towns;
drop policy if exists towns_update_team_admins on public.towns;

create policy towns_select_members
  on public.towns
  for select
  using (public.is_team_member(team_id));

create policy towns_insert_team_admins
  on public.towns
  for insert
  with check (public.is_team_admin(team_id));

create policy towns_update_team_admins
  on public.towns
  for update
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

drop policy if exists trees_select_team_town_members on public.trees;
drop policy if exists trees_insert_team_town_members on public.trees;
drop policy if exists trees_update_team_town_members on public.trees;
drop policy if exists trees_delete_team_town_members on public.trees;
drop policy if exists trees_select_town_members on public.trees;
drop policy if exists trees_insert_town_members on public.trees;
drop policy if exists trees_update_town_members on public.trees;
drop policy if exists trees_delete_town_members on public.trees;

create policy trees_select_town_members
  on public.trees
  for select
  using (public.is_town_member(town_id));

create policy trees_insert_town_members
  on public.trees
  for insert
  with check (
    public.is_town_member(town_id)
    and is_default = false
    and (created_by is null or created_by = auth.uid())
  );

create policy trees_update_town_members
  on public.trees
  for update
  using (public.can_mutate_tree(town_id, created_by, is_default))
  with check (public.can_mutate_tree(town_id, created_by, is_default));

create policy trees_delete_town_members
  on public.trees
  for delete
  using (public.can_mutate_tree(town_id, created_by, is_default));

grant select, insert, update on public.towns to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.trees to authenticated;

