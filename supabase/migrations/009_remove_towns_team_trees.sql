-- Collapse the workspace model from teams -> towns -> trees to teams -> trees.

drop trigger if exists towns_create_default_tree on public.towns;
drop trigger if exists trees_team_matches_town on public.trees;

drop function if exists public.ensure_town_default_tree() cascade;
drop function if exists public.create_default_tree_for_town(uuid) cascade;
drop function if exists public.tree_team_matches_town() cascade;
drop function if exists public.is_town_member(uuid) cascade;
drop function if exists public.can_mutate_tree(uuid, uuid, boolean) cascade;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trees'
      and column_name = 'town_id'
  ) then
    update public.trees tr
    set team_id = towns.team_id
    from public.towns towns
    where tr.town_id = towns.id
      and (tr.team_id is null or tr.team_id <> towns.team_id);
  end if;
end;
$$;

alter table public.trees
  alter column team_id set not null;

drop index if exists public.trees_one_default_per_team_town_idx;
drop index if exists public.trees_one_default_per_town_idx;
drop index if exists public.trees_team_town_id_idx;
drop index if exists public.trees_town_id_idx;

alter table public.trees
  drop column if exists town_id cascade;

create unique index if not exists trees_one_default_per_team_idx
  on public.trees(team_id)
  where is_default = true and archived_at is null;

create unique index if not exists trees_team_name_active_idx
  on public.trees(team_id, name)
  where archived_at is null;

create or replace function public.can_mutate_tree(
  target_team_id uuid,
  target_created_by uuid,
  target_is_default boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_team_admin(target_team_id)
    or (
      public.is_team_member(target_team_id)
      and target_created_by = auth.uid()
      and target_is_default = false
    );
$$;

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

    if old.team_id is distinct from new.team_id then
      raise exception 'tree_team_cannot_be_changed';
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

drop function if exists public.claim_team_membership() cascade;

create or replace function public.claim_team_membership()
returns table (
  team_id uuid,
  team_name text,
  team_slug text,
  display_name text,
  member_role text,
  team_brand jsonb
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
    tm.display_name,
    tm.role,
    teams.brand
  from public.team_members tm
  join public.teams teams on teams.id = tm.team_id
  where tm.user_id = auth.uid()
    and tm.status = 'active'
  order by tm.created_at asc
  limit 1;
end;
$$;

create or replace function public.create_default_tree_for_team(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_team_id is null then
    raise exception 'team_not_found';
  end if;

  insert into public.trees (team_id, name, data, is_default)
  values (
    target_team_id,
    'Example',
    public.default_tree_data('tree-file:teamtree-default'),
    true
  )
  on conflict (team_id, name) where archived_at is null do update
    set is_default = true,
        updated_at = now();
end;
$$;

create or replace function public.ensure_team_default_tree()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_default_tree_for_team(new.id);
  return new;
end;
$$;

drop trigger if exists teams_create_default_tree on public.teams;
create trigger teams_create_default_tree
after insert on public.teams
for each row execute function public.ensure_team_default_tree();

insert into public.trees (team_id, name, data, is_default)
select
  teams.id,
  'Example',
  public.default_tree_data('tree-file:teamtree-default'),
  true
from public.teams teams
where not exists (
  select 1
  from public.trees trees
  where trees.team_id = teams.id
    and trees.is_default = true
    and trees.archived_at is null
)
on conflict (team_id, name) where archived_at is null do update
  set is_default = true,
      updated_at = now();

drop policy if exists trees_select_team_town_members on public.trees;
drop policy if exists trees_insert_team_town_members on public.trees;
drop policy if exists trees_update_team_town_members on public.trees;
drop policy if exists trees_delete_team_town_members on public.trees;
drop policy if exists trees_select_town_members on public.trees;
drop policy if exists trees_insert_town_members on public.trees;
drop policy if exists trees_update_town_members on public.trees;
drop policy if exists trees_delete_town_members on public.trees;
drop policy if exists trees_select_team_members on public.trees;
drop policy if exists trees_insert_team_members on public.trees;
drop policy if exists trees_update_team_members on public.trees;
drop policy if exists trees_delete_team_members on public.trees;

create policy trees_select_team_members
  on public.trees
  for select
  using (public.is_team_member(team_id));

create policy trees_insert_team_members
  on public.trees
  for insert
  with check (
    public.is_team_member(team_id)
    and is_default = false
    and (created_by is null or created_by = auth.uid())
  );

create policy trees_update_team_members
  on public.trees
  for update
  using (public.can_mutate_tree(team_id, created_by, is_default))
  with check (public.can_mutate_tree(team_id, created_by, is_default));

create policy trees_delete_team_members
  on public.trees
  for delete
  using (public.can_mutate_tree(team_id, created_by, is_default));

drop table if exists public.towns cascade;
