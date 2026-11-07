-- =====================================================================
--  LILLE IN LOVE — Plusieurs groupes pour une même personne
--  À exécuter après 26_facebook.sql.
--
--  Un groupe répondait à « pour quelle table ? », et une personne n'en
--  avait qu'un. Mais on compose souvent deux soirées en même temps, et
--  quelqu'un peut convenir aux deux : l'obliger à choisir revenait à
--  l'écarter de l'une des deux, ou à refaire le rangement à chaque fois.
--
--  « soiree_group » n'est pas supprimée : elle est recopiée dans la
--  nouvelle colonne, puis laissée en place. Si quelque chose tournait
--  mal, les anciens rangements sont encore là, intacts.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_members
  add column if not exists soiree_groups text[] not null default '{}';

-- Reprise des rangements déjà faits. « where soiree_groups = '{}' » : on
-- ne réécrit pas par-dessus un rangement multiple fait depuis.
update public.lil_members
   set soiree_groups = array[soiree_group]
 where soiree_group is not null
   and soiree_groups = '{}';

-- On interroge cette colonne à chaque composition de soirée.
create index if not exists lil_members_soiree_groups_idx
  on public.lil_members using gin (soiree_groups);

comment on column public.lil_members.soiree_groups is
  'Les groupes de composition — A, B, C, D, G, S. Une personne peut convenir à plusieurs soirées.';

comment on column public.lil_members.soiree_group is
  'Ancienne colonne à valeur unique, remplacée par soiree_groups. Conservée le temps de vérifier la reprise.';

-- ---------------------------------------------------------------------
--  La vue de travail doit refléter la nouvelle colonne
-- ---------------------------------------------------------------------
--  « select m.* » fige la liste des colonnes au moment où la vue est
--  créée : une colonne ajoutée après n'y apparaît jamais.
drop view if exists public.lil_members_overview;

create view public.lil_members_overview as
select
  m.*,
  case
    when m.birth_date is null then null
    else extract(year from age(current_date, m.birth_date))::smallint
  end as age,
  (select count(*) from public.lil_photos  p where p.member_id = m.id) as photo_count,
  (select count(*) from public.lil_reviews r where r.member_id = m.id and r.vote = 'oui') as votes_oui,
  (select count(*) from public.lil_reviews r where r.member_id = m.id and r.vote = 'non') as votes_non,
  (select count(*) from public.lil_reviews r where r.member_id = m.id) as votes_total
from public.lil_members m;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.lil_members_overview from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.lil_members_overview from authenticated';
  end if;
end $$;

do $$
begin
  raise notice 'Une candidature peut désormais appartenir à plusieurs groupes.';
end $$;
