-- =====================================================================
--  LILLE IN LOVE — Facebook, au même titre qu'Instagram
--  À exécuter après 25_blacklist.sql.
--
--  On ne demandait qu'Instagram. Tout le monde n'y est pas, et pour une
--  partie des inscrits c'est Facebook qui permet de mettre un visage et
--  un parcours sur un nom. Les deux se demandent donc sur le même écran,
--  et les deux sont facultatifs.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_members
  add column if not exists facebook text;

comment on column public.lil_members.facebook is
  'Pseudo Facebook, ou lien complet quand le compte n''en a pas. Jamais publié.';

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
  raise notice 'Facebook est demandé et enregistré.';
end $$;
