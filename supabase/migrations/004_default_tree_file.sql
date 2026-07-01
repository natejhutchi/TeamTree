-- Promote the repo-backed TeamTown tree file to the TeamTown default tree row.
-- Existing edited trees remain untouched; only the default seed row is normalized.

do $$
declare
  teamtown_company_id uuid;
  teamtown_team_town_id uuid;
begin
  select id into teamtown_company_id
  from public.companies
  where slug = 'teamtown';

  if teamtown_company_id is null then
    return;
  end if;

  select id into teamtown_team_town_id
  from public.team_towns
  where company_id = teamtown_company_id
    and slug = 'teamtown';

  if teamtown_team_town_id is null then
    return;
  end if;

  if exists (
    select 1
    from public.trees
    where team_town_id = teamtown_team_town_id
      and name = 'TeamTown Starter Tree'
  ) and not exists (
    select 1
    from public.trees
    where team_town_id = teamtown_team_town_id
      and name = 'TeamTown Default'
  ) then
    update public.trees
    set name = 'TeamTown Default'
    where team_town_id = teamtown_team_town_id
      and name = 'TeamTown Starter Tree';
  end if;

  update public.trees
  set is_company_default = false
  where team_town_id = teamtown_team_town_id
    and name <> 'TeamTown Default';

  insert into public.trees (company_id, team_town_id, name, data, is_company_default)
  values (
    teamtown_company_id,
    teamtown_team_town_id,
    'TeamTown Default',
    jsonb_build_object(
      'version', 1,
      'source', 'tree-file:teamtown-default',
      'notes', '[]'::jsonb,
      'hiddenAnnouncementIndexes', '[]'::jsonb,
      'customBlocks', '[]'::jsonb,
      'deletedBlockIds', '[]'::jsonb,
      'blockPositions', '{}'::jsonb,
      'absoluteBlockIds', '[]'::jsonb,
      'customOptionsByBlock', '{}'::jsonb,
      'blockOverrides', '{}'::jsonb
    ),
    true
  )
  on conflict (team_town_id, name) do update
  set
    data = excluded.data,
    is_company_default = true,
    archived_at = null,
    updated_at = now();
end;
$$;

with ranked_defaults as (
  select
    id,
    row_number() over (partition by team_town_id order by updated_at desc, created_at desc) as default_rank
  from public.trees
  where is_company_default = true
    and archived_at is null
)
update public.trees t
set is_company_default = false
from ranked_defaults rd
where t.id = rd.id
  and rd.default_rank > 1;

create unique index if not exists trees_one_default_per_team_town_idx
  on public.trees(team_town_id)
  where is_company_default = true and archived_at is null;


