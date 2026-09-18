-- =====================================================================
--  LILLE IN LOVE — Groupes de soirée (A, B, C)
--  À exécuter après les scripts 01 à 05.
--
--  Valider une candidature dit « on la garde ». Le groupe dit « pour quelle
--  table » : c'est le tri que fait l'équipe avant de composer une soirée.
--  Un groupe n'envoie aucun email et ne change aucun statut — il ne sert
--  qu'à filtrer et à exporter.
--
--  On ajoute aussi children_preference, qui existait dans l'ancien export :
--  le questionnaire ne la demande pas encore, mais la colonne permet de
--  reprendre les données existantes sans les perdre.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Les deux colonnes
-- ---------------------------------------------------------------------
alter table public.lil_members
  add column if not exists soiree_group        text,
  add column if not exists children_preference text;

-- Trois lettres, pas une de plus : une valeur libre rendrait le filtre
-- inutilisable au bout de trois semaines.
do $$ begin
  alter table public.lil_members
    add constraint lil_members_soiree_group_valide
    check (soiree_group is null or soiree_group in ('A', 'B', 'C'));
  exception when duplicate_object then null;
end $$;

comment on column public.lil_members.soiree_group is
  'Groupe de composition d''une soirée : A, B ou C. Vide tant que personne n''a trié. N''a aucun effet sur les emails.';

comment on column public.lil_members.children_preference is
  'Préférence sur les enfants du partenaire, reprise de l''ancien formulaire (ex. peu_importe, sans_enfants). Non demandée par le questionnaire actuel.';

-- Parcourir « les femmes de 27 à 35 ans du groupe C » sans lire toute la table.
create index if not exists lil_members_groupe_idx
  on public.lil_members (soiree_group, gender)
  where soiree_group is not null;

-- ---------------------------------------------------------------------
-- 2. La vue de travail doit exposer les nouvelles colonnes
--    (« m.* » ne suffit pas : la vue est figée à sa création)
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
      and column_name = 'soiree_group'
  ) then
    raise exception 'La vue lil_members_overview n''expose pas soiree_group.';
  end if;

  raise notice 'Groupes A/B/C en place. Aucun email, aucun statut n''a changé.';
end $$;
