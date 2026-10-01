-- =====================================================================
--  LILLE IN LOVE — Crush Time
--  À exécuter après 12_anciennes.sql.
--
--  Une soirée, trois manches, un like par manche. Les règles du jeu sont
--  écrites ici plutôt que dans le code : un seul like par manche est une
--  contrainte d'unicité, pas une vérification qu'on espère ne pas oublier.
--  Cinquante personnes qui cliquent en même temps ne laissent pas le temps
--  de rattraper une règle contournée.
--
--  Le crush time est temporaire : il appartient à une soirée, et une
--  nouvelle soirée en ouvre un autre. Les matchs, eux, restent.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Ce qu'une soirée gagne
-- ---------------------------------------------------------------------
alter table public.lil_soirees
  add column if not exists crush_code   text,
  add column if not exists crush_actif  boolean not null default false;

comment on column public.lil_soirees.crush_code is
  'Code partagé, annoncé à voix haute dans la salle. Avec son email, il suffit à entrer : rien à recevoir, donc rien à attendre.';

comment on column public.lil_soirees.crush_actif is
  'Le crush time en cours. Une seule soirée à la fois — les autres ne montrent plus que leurs matchs.';

-- Un seul crush time ouvert, garanti par la base : deux soirées actives
-- voudraient dire deux salles, et ce n'est jamais arrivé.
create unique index if not exists lil_soirees_un_seul_crush
  on public.lil_soirees ((crush_actif)) where crush_actif;

-- ---------------------------------------------------------------------
-- 2. Les participants — ceux qui ont acheté un billet
-- ---------------------------------------------------------------------
create table if not exists public.lil_crush_participants (
  id          uuid primary key default gen_random_uuid(),
  soiree_id   uuid   not null references public.lil_soirees(id) on delete cascade,
  -- La candidature d'origine, quand on a su la retrouver : c'est elle qui
  -- porte la photo et les réponses. Vide pour un acheteur inconnu de la base.
  member_id   uuid   references public.lil_members(id) on delete set null,

  email       citext not null,
  first_name  text   not null,
  birth_date  date,
  gender      lil_gender,
  orientation lil_orientation,

  -- Le lien personnel. Il vaut mot de passe : il n'est jamais affiché nulle
  -- part, et il ne sert que cette soirée.
  jeton       text   not null unique,
  claimed_at  timestamptz,          -- première ouverture
  created_at  timestamptz not null default now(),

  constraint lil_crush_participants_une_fois unique (soiree_id, email)
);

comment on table public.lil_crush_participants is
  'Les personnes attendues à une soirée, importées de la billetterie. Une ligne par soirée : la même personne revient avec un nouveau jeton.';

create index if not exists lil_crush_participants_soiree_idx
  on public.lil_crush_participants (soiree_id);

-- ---------------------------------------------------------------------
-- 3. Les manches
-- ---------------------------------------------------------------------
create table if not exists public.lil_crush_rounds (
  id         uuid     primary key default gen_random_uuid(),
  soiree_id  uuid     not null references public.lil_soirees(id) on delete cascade,
  numero     smallint not null check (numero between 1 and 9),
  -- L'heure annoncée. L'ouverture réelle reste un geste de l'hôte : une
  -- soirée ne tient jamais son horaire, et le dîner traîne toujours.
  prevu_a    timestamptz not null,
  ouvert_at  timestamptz,
  ferme_at   timestamptz,
  created_at timestamptz not null default now(),

  constraint lil_crush_rounds_numero unique (soiree_id, numero)
);

create index if not exists lil_crush_rounds_soiree_idx
  on public.lil_crush_rounds (soiree_id, numero);

-- ---------------------------------------------------------------------
-- 4. Les likes — un seul par manche, et c'est la base qui le tient
-- ---------------------------------------------------------------------
create table if not exists public.lil_crush_likes (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.lil_crush_rounds(id)       on delete cascade,
  de_id      uuid not null references public.lil_crush_participants(id) on delete cascade,
  vers_id    uuid not null references public.lil_crush_participants(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- LA règle du jeu. On peut changer d'avis tant que la manche est ouverte
  -- — c'est la même ligne qu'on déplace, pas une seconde qu'on ajoute.
  constraint lil_crush_likes_un_par_manche unique (round_id, de_id),
  constraint lil_crush_likes_pas_soi_meme  check (de_id <> vers_id)
);

create index if not exists lil_crush_likes_vers_idx
  on public.lil_crush_likes (round_id, vers_id);

-- ---------------------------------------------------------------------
-- 5. Les matchs
-- ---------------------------------------------------------------------
create table if not exists public.lil_crush_matches (
  id         uuid not null primary key default gen_random_uuid(),
  soiree_id  uuid not null references public.lil_soirees(id)             on delete cascade,
  round_id   uuid not null references public.lil_crush_rounds(id)        on delete cascade,
  -- Rangés par identifiant croissant : une paire ne peut s'écrire que
  -- d'une seule manière, donc l'unicité la protège vraiment. Sans cet
  -- ordre, deux clics simultanés créeraient deux matchs pour un seul.
  a_id       uuid not null references public.lil_crush_participants(id)  on delete cascade,
  b_id       uuid not null references public.lil_crush_participants(id)  on delete cascade,
  created_at timestamptz not null default now(),

  constraint lil_crush_matches_ordonnee check (a_id < b_id),
  constraint lil_crush_matches_une_fois unique (soiree_id, a_id, b_id)
);

create index if not exists lil_crush_matches_a_idx on public.lil_crush_matches (a_id);
create index if not exists lil_crush_matches_b_idx on public.lil_crush_matches (b_id);

-- ---------------------------------------------------------------------
-- 6. Les abonnements aux notifications
-- ---------------------------------------------------------------------
create table if not exists public.lil_crush_push (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.lil_crush_participants(id) on delete cascade,
  -- L'adresse que le navigateur nous donne. Un même téléphone réinstallé en
  -- donne une nouvelle : l'ancienne meurt d'elle-même au premier envoi.
  endpoint       text not null unique,
  p256dh         text not null,
  auth           text not null,
  created_at     timestamptz not null default now(),
  echecs         smallint not null default 0
);

create index if not exists lil_crush_push_participant_idx
  on public.lil_crush_push (participant_id);

-- ---------------------------------------------------------------------
-- 7. Rien de tout cela n'est lisible depuis un navigateur
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'lil_crush_participants', 'lil_crush_rounds', 'lil_crush_likes',
    'lil_crush_matches', 'lil_crush_push'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Vérification
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lil_crush_likes_un_par_manche'
  ) then
    raise exception 'La règle « un like par manche » n''est pas en place.';
  end if;

  raise notice 'Crush Time en place. Aucune soirée n''a été touchée.';
end $$;
