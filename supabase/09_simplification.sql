-- =====================================================================
--  LILLE IN LOVE — Simplification de la curation
--  À exécuter après 08_groupes.sql.
--
--  On ne refuse plus personne : toute candidature est validée, et c'est le
--  groupe qui dit de quel type de soirée elle relève. Un quatrième groupe
--  apparaît pour cela : G.
--
--  Les statuts « non_retenu », « en_examen » et « en_attente_tranche » ne
--  sont plus posés par personne. On ne les supprime pas : des candidatures
--  les portent peut-être encore, et effacer un état déjà décidé serait
--  réécrire l'histoire. Le back-office ne les propose plus que s'il en
--  reste.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le groupe G rejoint A, B et C
-- ---------------------------------------------------------------------
alter table public.lil_members
  drop constraint if exists lil_members_soiree_group_valide;

alter table public.lil_members
  add constraint lil_members_soiree_group_valide
  check (soiree_group is null or soiree_group in ('A', 'B', 'C', 'G'));

comment on column public.lil_members.soiree_group is
  'Groupe de composition d''une soirée : A, B, C ou G. Vide tant que personne n''a trié. N''a aucun effet sur les emails.';

-- ---------------------------------------------------------------------
-- 2. Filtrer par orientation sans parcourir toute la table
--    (« les gays du groupe G », « tout le monde sauf »)
-- ---------------------------------------------------------------------
create index if not exists lil_members_orientation_idx
  on public.lil_members (orientation, gender)
  where orientation is not null;

-- ---------------------------------------------------------------------
-- 3. Vérification
-- ---------------------------------------------------------------------
do $$
declare
  restants int;
begin
  select count(*) into restants
  from public.lil_members
  where status in ('non_retenu', 'en_examen', 'en_attente_tranche');

  if restants > 0 then
    raise notice 'Groupe G en place. % candidature(s) portent encore un ancien statut : elles restent visibles dans le back-office.', restants;
  else
    raise notice 'Groupe G en place. Aucun ancien statut en base.';
  end if;
end $$;
