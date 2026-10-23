-- =====================================================================
--  LILLE IN LOVE — Qui l'on amène, reconnu
--  À exécuter après 22_matching_apres_envoi.sql.
--
--  On demandait le prénom de la personne qu'on amène, et c'est tout.
--  Deux « Julie » plus tard, on ne savait plus laquelle, ni si elle
--  s'était inscrite de son côté. On demande donc aussi son nom.
--
--  Et quand ces deux noms désignent quelqu'un qui est déjà dans la base,
--  on le lui montre pour qu'elle le confirme : c'est elle qui fait le
--  rapprochement, pas nous. Une fois confirmé, les deux fiches se
--  tiennent, et on sait les placer sur la même soirée.
--
--  « companion_member_id » n'est écrit qu'après cette confirmation. Non
--  confirmé, il reste nul : un nom qui se ressemble n'est pas une
--  personne qu'on a reconnue.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_members
  add column if not exists companion_last_name text;

alter table public.lil_members
  add column if not exists companion_member_id uuid
  references public.lil_members (id) on delete set null;

-- On remonte souvent la relation dans l'autre sens — « qui m'a cité ? » —
-- au moment de composer les tables.
create index if not exists lil_members_companion_member_idx
  on public.lil_members (companion_member_id)
  where companion_member_id is not null;

comment on column public.lil_members.companion_last_name is
  'Le nom de famille de la personne qu''on amène, tel qu''il a été saisi.';

comment on column public.lil_members.companion_member_id is
  'La fiche de cette personne, quand elle a été reconnue et confirmée à l''inscription. Nul tant que personne n''a confirmé.';

-- ---------------------------------------------------------------------
--  La vue de travail doit refléter les nouvelles colonnes
-- ---------------------------------------------------------------------
--  « select m.* » fige la liste des colonnes au moment où la vue est
--  créée : une colonne ajoutée après n'y apparaît jamais. Sans cette
--  recréation, le back-office continuerait d'ignorer le nom du
--  compagnon, et on chercherait l'erreur du mauvais côté.
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
  raise notice 'Le compagnon a un nom, et peut être rattaché à sa fiche.';
end $$;
