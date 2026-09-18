-- =====================================================================
--  LILLE IN LOVE — Formulaire court + curation
--  À exécuter après 01_schema.sql et 02_storage.sql.
--
--  Le formulaire court ne demande que le sexe, le prénom, le nom, l'email
--  et les photos. Les colonnes que le formulaire complet remplit doivent
--  donc accepter l'absence de réponse.
--  Idempotent : relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Les réponses du formulaire complet deviennent facultatives
--    Ce qui reste obligatoire : sexe, prénom, nom, email, consentement.
-- ---------------------------------------------------------------------
alter table public.lil_members
  alter column city          drop not null,
  alter column postal_code   drop not null,
  alter column orientation   drop not null,
  alter column has_children  drop not null,
  alter column looking_for   drop not null,
  alter column height_cm     drop not null,
  alter column about         drop not null,
  alter column motivation    drop not null,
  alter column profession    drop not null,
  alter column referral      drop not null,
  alter column phone         drop not null,
  alter column birth_date    drop not null;

-- ---------------------------------------------------------------------
-- 2. Savoir quel formulaire a été rempli
-- ---------------------------------------------------------------------
do $$ begin
  create type lil_form_version as enum ('court', 'complet');
  exception when duplicate_object then null;
end $$;

alter table public.lil_members
  add column if not exists form_version lil_form_version not null default 'complet';

comment on column public.lil_members.form_version is
  'Quel questionnaire la personne a rempli. Une fiche « court » a des champs vides : c''est normal, pas une donnée manquante.';

-- ---------------------------------------------------------------------
-- 3. Curateurs — pour l'instant l'accès au back-office est libre, mais
--    chaque vote reste attribué à quelqu'un : la règle des deux voix
--    pourra s'appliquer sans rien changer au schéma.
-- ---------------------------------------------------------------------
insert into public.lil_curators (email, full_name)
values
  ('curateur.1@lilleinlove.fr', 'Curateur 1'),
  ('curateur.2@lilleinlove.fr', 'Curateur 2')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------
-- 4. La vue de travail doit refléter les nouvelles colonnes
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
