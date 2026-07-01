create table if not exists public.tree_versions (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  tree_name text not null,
  version_number integer not null,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tree_versions_version_number_check check (version_number > 0)
);

create unique index if not exists tree_versions_tree_version_idx
  on public.tree_versions(tree_id, version_number);

create index if not exists tree_versions_tree_created_at_idx
  on public.tree_versions(tree_id, created_at desc);

create or replace function public.capture_tree_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version_number integer;
begin
  if old.data is not distinct from new.data then
    return new;
  end if;

  select coalesce(max(tv.version_number), 0) + 1
    into next_version_number
  from public.tree_versions tv
  where tv.tree_id = old.id;

  insert into public.tree_versions (
    tree_id,
    team_id,
    tree_name,
    version_number,
    data,
    created_by
  )
  values (
    old.id,
    old.team_id,
    old.name,
    next_version_number,
    old.data,
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists trees_capture_version on public.trees;
create trigger trees_capture_version
  before update of data on public.trees
  for each row
  execute function public.capture_tree_version();

alter table public.tree_versions enable row level security;

drop policy if exists tree_versions_select_team_members on public.tree_versions;
create policy tree_versions_select_team_members
  on public.tree_versions
  for select
  using (public.is_team_member(team_id));

grant select on public.tree_versions to authenticated;

