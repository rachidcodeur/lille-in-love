-- =====================================================================
--  LILLE IN LOVE — L'aisance en soirée, et les soirées souhaitées
--  À exécuter après 23_compagnon.sql.
--
--  Deux questions ajoutées au formulaire d'inscription.
--
--  « aisance » dit comment quelqu'un arrive dans une salle pleine de
--  monde. On ne s'en sert pas pour trier mais pour placer : quelqu'un de
--  très timide assis à côté de quelqu'un de très à l'aise passe la
--  soirée à écouter, et les deux repartent sans s'être rencontrés.
--
--  « tranches_age » dit à quelles soirées la personne veut participer.
--  Plusieurs réponses : les tranches affichées sur les invitations se
--  chevauchent d'un ou deux ans, et quelqu'un de 35 ans peut se
--  reconnaître dans deux d'entre elles.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_members
  add column if not exists aisance text;

alter table public.lil_members
  add column if not exists tranches_age text[] not null default '{}';

-- On compose les tables par tranche : c'est la question posée à chaque
-- fois qu'on monte une soirée.
create index if not exists lil_members_tranches_age_idx
  on public.lil_members using gin (tranches_age);

comment on column public.lil_members.aisance is
  'Très timide, timide, à l''aise, très à l''aise. Sert au placement à table, pas à la sélection.';

comment on column public.lil_members.tranches_age is
  'Les tranches d''âge des soirées auxquelles la personne souhaite participer.';

-- ---------------------------------------------------------------------
--  La vue de travail doit refléter les nouvelles colonnes
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
  raise notice 'L''aisance et les tranches d''âge sont enregistrées.';
end $$;
