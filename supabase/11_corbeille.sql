-- =====================================================================
--  LILLE IN LOVE — Une corbeille pour les candidatures
--  À exécuter après 10_accompagnant.sql.
--
--  Supprimer une candidature, c'est effacer les réponses de quelqu'un et
--  ses photos. Un clic de trop ne doit pas suffire : la fiche part d'abord
--  à la corbeille, d'où elle peut revenir. C'est seulement là, et sur un
--  second geste, qu'on efface pour de bon.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La date de mise à la corbeille
-- ---------------------------------------------------------------------
alter table public.lil_members
  add column if not exists deleted_at timestamptz;

comment on column public.lil_members.deleted_at is
  'Date de mise à la corbeille. Vide = candidature active. La fiche reste en base, consultable et restaurable, tant qu''elle n''est pas effacée définitivement.';

-- Les listes lisent « deleted_at is null » à chaque fois : autant l'indexer.
create index if not exists lil_members_corbeille_idx
  on public.lil_members (deleted_at desc)
  where deleted_at is not null;

create index if not exists lil_members_actives_idx
  on public.lil_members (created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. La vue de travail expose la colonne
--    (« m.* » ne suffit pas : une vue est figée à sa création)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. Vérification
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lil_members_overview'
      and column_name = 'deleted_at'
  ) then
    raise exception 'La vue lil_members_overview n''expose pas deleted_at.';
  end if;

  raise notice 'Corbeille en place. Aucune candidature n''a été touchée.';
end $$;
