-- Restrict roles to admin/rep and make tree mutations owner-aware.
-- Reps can create/edit/archive their own non-default trees.
-- Admins can create/edit/archive any tree and manage company members.

create extension if not exists citext;

-- Normalize old role names before tightening the constraint.
update public.company_members
set role = case
  when role in ('owner', 'admin') then 'admin'
  else 'rep'
end
where role not in ('admin', 'rep');

alter table public.company_members
  drop constraint if exists company_members_role_check;

alter table public.company_members
  add constraint company_members_role_check check (role in ('admin', 'rep'));

create or replace function public.is_company_admin(target_company_id uuid)
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
      and cm.role = 'admin'
  );
$$;

create or replace function public.can_edit_company_trees(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_member(target_company_id);
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
      and public.is_company_member(tt.company_id)
  );
$$;

create or replace function public.can_mutate_tree(
  target_team_town_id uuid,
  target_created_by uuid,
  target_is_company_default boolean
)
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
      and (
        public.is_company_admin(tt.company_id)
        or (
          public.is_company_member(tt.company_id)
          and target_created_by = auth.uid()
          and target_is_company_default = false
        )
      )
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

  if not public.is_company_admin(new.company_id) then
    if old.created_by is distinct from new.created_by then
      raise exception 'tree_owner_cannot_be_changed';
    end if;

    if old.is_company_default is distinct from new.is_company_default then
      raise exception 'default_tree_flag_cannot_be_changed';
    end if;

    if old.company_id is distinct from new.company_id or old.team_town_id is distinct from new.team_town_id then
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

-- company_members: admins manage members; members can read their company roster.
drop policy if exists company_members_select_self_company on public.company_members;
create policy company_members_select_self_company
  on public.company_members
  for select
  using (public.is_company_member(company_id));

drop policy if exists company_members_insert_company_admins on public.company_members;
create policy company_members_insert_company_admins
  on public.company_members
  for insert
  with check (public.is_company_admin(company_id));

drop policy if exists company_members_update_company_admins on public.company_members;
create policy company_members_update_company_admins
  on public.company_members
  for update
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

drop policy if exists company_members_delete_company_admins on public.company_members;
create policy company_members_delete_company_admins
  on public.company_members
  for delete
  using (public.is_company_admin(company_id));

-- Tree policies: all members select; members insert own trees; admins/owners mutate.
drop policy if exists trees_insert_team_town_editors on public.trees;
drop policy if exists trees_insert_team_town_members on public.trees;
create policy trees_insert_team_town_members
  on public.trees
  for insert
  with check (
    public.is_team_town_member(team_town_id)
    and is_company_default = false
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists trees_update_team_town_editors on public.trees;
drop policy if exists trees_update_team_town_members on public.trees;
create policy trees_update_team_town_members
  on public.trees
  for update
  using (public.can_mutate_tree(team_town_id, created_by, is_company_default))
  with check (public.can_mutate_tree(team_town_id, created_by, is_company_default));

drop policy if exists trees_delete_company_admins_via_team_town on public.trees;
drop policy if exists trees_delete_team_town_members on public.trees;
create policy trees_delete_team_town_members
  on public.trees
  for delete
  using (public.can_mutate_tree(team_town_id, created_by, is_company_default));

grant select, insert, update, delete on public.company_members to authenticated;

