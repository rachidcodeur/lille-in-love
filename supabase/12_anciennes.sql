-- =====================================================================
--  LILLE IN LOVE — Les anciennes candidatures
--  À exécuter après 11_corbeille.sql.
--
--  Le site précédent a recueilli une centaine de candidatures. Elles sont
--  reprises ici : ce sont de vraies personnes, qui ont vraiment répondu,
--  et les perdre serait perdre un été de campagne.
--
--  Mais elles n'ont pas répondu au même questionnaire. Pas de nom de
--  famille, pas de centres d'intérêt cochés, des photos qui viennent
--  d'ailleurs. Les mélanger sans le dire ferait croire à un formulaire
--  incomplet là où il n'y a qu'une autre époque : d'où cette colonne, qui
--  permet de les grouper sous un intertitre et de les trier à part.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La marque
-- ---------------------------------------------------------------------
alter table public.lil_members
  add column if not exists legacy boolean not null default false;

comment on column public.lil_members.legacy is
  'Candidature reprise de l''ancien site. Le questionnaire d''alors posait moins de questions : certains champs sont vides sans que personne n''ait rien oublié.';

-- La liste trie « les nouvelles d'abord, les anciennes ensuite, chaque
-- bloc du plus récent au plus ancien ». Un index composite pour l'un et
-- l'autre bloc, restreint aux fiches actives.
create index if not exists lil_members_legacy_idx
  on public.lil_members (legacy, created_at desc)
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
-- 3. Ce que l'ancien questionnaire ne demandait pas
--
--  Le nom de famille et les deux textes libres sont « not null » : une
--  reprise les remplit avec une chaîne vide, ce qui est exact — la
--  question n'a pas été posée. Rien à changer côté schéma, sinon la
--  certitude que le nom de famille n'est pas contraint à être non vide.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lil_members_overview'
      and column_name = 'legacy'
  ) then
    raise exception 'La vue lil_members_overview n''expose pas legacy.';
  end if;

  raise notice 'Colonne legacy en place. Lance ensuite : npm run import:anciennes -- <fichier.csv> --ecrire';
end $$;
