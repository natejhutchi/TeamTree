-- Seed TeamTown company, members, default Team Town, and starter tree.
-- Run after 001_add_team_towns.sql.

insert into public.companies (name, slug, brand)
values (
  'TeamTown',
  'teamtown',
  '{"productName":"TeamTree","logoText":"TeamTree","metaphor":"tree"}'::jsonb
)
on conflict (slug) do update
set
  name = excluded.name,
  brand = public.companies.brand || excluded.brand,
  updated_at = now();

insert into public.company_members (company_id, email, display_name, role, status)
select id, 'nathan@teamtown.co', 'Nathan', 'admin', 'active'
from public.companies
where slug = 'teamtown'
on conflict (company_id, email) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  status = excluded.status,
  updated_at = now();

insert into public.company_members (company_id, email, display_name, role, status)
select id, 'alex@teamtown.co', 'Alex', 'rep', 'active'
from public.companies
where slug = 'teamtown'
on conflict (company_id, email) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  status = excluded.status,
  updated_at = now();

insert into public.team_towns (company_id, name, slug, brand)
select id, 'TeamTown', 'teamtown', brand
from public.companies
where slug = 'teamtown'
on conflict (company_id, slug) do update
set
  name = excluded.name,
  brand = public.team_towns.brand || excluded.brand,
  updated_at = now();

-- This links the repo tree file to TeamTown's default Team Town; edits are stored in trees.data.
insert into public.trees (company_id, team_town_id, name, data, is_company_default)
select
  c.id,
  tt.id,
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
from public.companies c
join public.team_towns tt on tt.company_id = c.id and tt.slug = 'teamtown'
where c.slug = 'teamtown'
on conflict (team_town_id, name) do update
set
  data = excluded.data,
  is_company_default = true,
  archived_at = null,
  updated_at = now();

