-- =====================================================================
--  LILLE IN LOVE — Signalement des envois inhabituels
--  À exécuter après les trois premiers scripts.
--
--  Jusqu'ici, un formulaire envoyé très vite était écarté sans rien dire :
--  la personne voyait « C'est envoyé » alors que rien n'était enregistré.
--  Perdre une vraie candidature en silence est bien pire que laisser passer
--  un robot. Désormais tout est enregistré, et ce qui semble douteux est
--  simplement signalé aux curateurs.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_members
  add column if not exists suspect boolean not null default false,
  add column if not exists suspect_raison text;

comment on column public.lil_members.suspect is
  'Envoi inhabituel (rempli anormalement vite, par exemple). La candidature est conservée : c''est aux curateurs de trancher.';

comment on column public.lil_members.suspect_raison is
  'Ce qui a motivé le signalement, en clair.';

-- Retrouver les signalements sans parcourir toute la table.
create index if not exists lil_members_suspect_idx
  on public.lil_members (created_at desc)
  where suspect;

-- La vue de travail doit exposer les nouvelles colonnes.
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
