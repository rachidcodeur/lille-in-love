-- =====================================================================
--  LILLE IN LOVE — La liste noire
--  À exécuter après 24_aisance_tranches.sql.
--
--  Quelqu'un qui s'est mal comporté une soirée ne doit pas pouvoir se
--  réinscrire le lendemain. Mettre sa fiche à la corbeille ne suffit
--  pas : rien n'empêche de renvoyer le même formulaire.
--
--  On garde donc ce qui permet de le reconnaître — son email et son
--  numéro — et rien d'autre de ce qu'il avait écrit. Le prénom et le nom
--  sont recopiés ici pour que la liste reste lisible une fois la fiche
--  effacée ; c'est tout ce qu'on conserve de la personne.
--
--  Le blocage n'est pas définitif : on débloque depuis la corbeille, et
--  la ligne disparaît.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

create table if not exists public.lil_blacklist (
  id          uuid primary key default gen_random_uuid(),
  -- L'un ou l'autre peut manquer : le parcours court ne demande pas de
  -- numéro. Les deux ne peuvent pas manquer en même temps.
  email       text,
  phone       text,
  first_name  text,
  last_name   text,
  raison      text,
  created_at  timestamptz not null default now(),
  constraint lil_blacklist_pas_vide check (email is not null or phone is not null)
);

-- Les deux colonnes sur lesquelles on interroge à chaque inscription :
-- elles sont écrites normalisées (email en minuscules, numéro au format
-- international), pour que la comparaison soit une égalité et rien de plus.
create unique index if not exists lil_blacklist_email_idx
  on public.lil_blacklist (email)
  where email is not null;

create unique index if not exists lil_blacklist_phone_idx
  on public.lil_blacklist (phone)
  where phone is not null;

comment on table public.lil_blacklist is
  'Les adresses et numéros qui ne peuvent plus s''inscrire. Alimentée depuis la fiche ou la corbeille, vidée en débloquant.';

comment on column public.lil_blacklist.raison is
  'Pourquoi, en une phrase, pour celui qui relira dans six mois.';

-- La clé de service écrit et lit ; personne d'autre n'y touche.
alter table public.lil_blacklist enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.lil_blacklist from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.lil_blacklist from authenticated';
  end if;
end $$;

do $$
begin
  raise notice 'La liste noire est en place.';
end $$;
