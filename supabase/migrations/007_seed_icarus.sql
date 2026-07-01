-- Seed Icarus team, admin member, and default town.
-- Run after 005_team_town_naming_and_example_tree.sql.

insert into public.teams (name, slug, brand)
values (
  'Icarus',
  'icarus',
  '{"productName":"TeamTree","logoText":"Icarus","metaphor":"tree"}'::jsonb
)
on conflict (slug) do update
set
  name = excluded.name,
  brand = public.teams.brand || excluded.brand,
  updated_at = now();

insert into public.team_members (team_id, email, display_name, role, status)
select id, 'nemokooks@gmail.com', 'NemoKooks', 'admin', 'active'
from public.teams
where slug = 'icarus'
on conflict (team_id, email) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  status = excluded.status,
  updated_at = now();

insert into public.towns (team_id, name, slug, brand)
select id, 'Icarus', 'icarus', brand
from public.teams
where slug = 'icarus'
on conflict (team_id, slug) do update
set
  name = excluded.name,
  brand = public.towns.brand || excluded.brand,
  updated_at = now();

-- The towns_create_default_tree trigger creates the default Example tree for this town.
