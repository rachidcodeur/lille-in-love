-- =====================================================================
--  LILLE IN LOVE — Schéma d'inscription
--  À exécuter dans Supabase > SQL Editor.
--
--  Toutes les tables sont préfixées « lil_ » : le script est sans risque
--  pour un projet Supabase déjà utilisé par une autre application.
--  Il est idempotent — tu peux le relancer sans rien casser.
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- emails insensibles à la casse

-- ---------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------
do $$ begin
  create type lil_gender      as enum ('femme', 'homme');
  exception when duplicate_object then null;
end $$;

do $$ begin
  create type lil_orientation as enum ('hetero', 'gay');
  exception when duplicate_object then null;
end $$;

do $$ begin
  create type lil_looking_for as enum ('relation_serieuse', 'bons_moments');
  exception when duplicate_object then null;
end $$;

-- Le parcours d'un membre, de la candidature à la place acquise.
--   nouveau            : formulaire reçu, email 01 envoyé
--   en_examen          : au moins un curateur a voté, pas encore de décision
--   valide             : les deux curateurs ont dit oui → email 02 à J+1
--   en_attente_tranche : retenu, mais sa tranche d'âge n'est pas ouverte → email 04
--   non_retenu         : pas de place pour l'instant → email 03 (reste en base)
do $$ begin
  create type lil_status as enum (
    'nouveau', 'en_examen', 'valide', 'en_attente_tranche', 'non_retenu'
  );
  exception when duplicate_object then null;
end $$;

do $$ begin
  create type lil_vote as enum ('oui', 'non', 'peut_etre');
  exception when duplicate_object then null;
end $$;

do $$ begin
  create type lil_email_status as enum ('programme', 'envoye', 'annule', 'echec');
  exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 2. Membres — une ligne par personne, remplie une seule fois
-- ---------------------------------------------------------------------
create table if not exists public.lil_members (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Q01 à Q13 du questionnaire
  gender               lil_gender      not null,
  city                 text            not null,
  postal_code          text            not null,
  orientation          lil_orientation not null,
  has_children         boolean         not null,
  looking_for          lil_looking_for not null,
  height_cm            smallint        not null check (height_cm between 120 and 230),
  about                text            not null,   -- « Raconte-toi en deux lignes »
  motivation           text            not null,   -- « Pourquoi tu veux participer »
  interests            text[]          not null default '{}',
  interests_other      text,
  zodiac               text,                       -- optionnel
  profession           text            not null,
  instagram            text,                       -- optionnel
  comes_with           boolean         not null default false,
  companion_first_name text,
  companion_email      citext,
  referral             text            not null,   -- « Comment tu nous as connus »

  -- Q15 / Q16 — coordonnées
  first_name           text  not null,
  last_name            text  not null,
  phone                text  not null,
  email                citext not null,
  birth_date           date  not null,
  consent_at           timestamptz not null,

  -- Curation
  status        lil_status not null default 'nouveau',
  decided_at    timestamptz,          -- date de la décision finale des curateurs
  welcomed_at   timestamptz,          -- date d'envoi effectif de l'email 02
  admin_notes   text,

  -- Traçabilité / anti-abus
  source        text,                 -- ex. 'wordpress:/inscription/'
  user_agent    text,
  ip_hash       text,                 -- SHA-256 salé, jamais l'IP en clair (RGPD)

  constraint lil_members_email_key unique (email),
  -- Simple garde-fou contre une date aberrante. La règle réelle — 18 ans
  -- révolus — est vérifiée à la soumission (src/lib/validation.ts) : une
  -- contrainte qui dépend de la date du jour ne serait pas immutable.
  constraint lil_members_birth_date_plausible
    check (birth_date >= '1925-01-01'),
  -- Un accompagnant implique forcément un email de contact
  constraint lil_members_companion_coherent
    check (not comes_with or companion_email is not null)
);

comment on table public.lil_members is
  'Candidatures au club Lille in Love. On adhère une seule fois ; les invitations aux soirées se font ensuite par tranche d''âge.';

create index if not exists lil_members_status_idx     on public.lil_members (status, created_at desc);
create index if not exists lil_members_birth_idx      on public.lil_members (birth_date);
create index if not exists lil_members_gender_idx     on public.lil_members (gender);
create index if not exists lil_members_created_at_idx on public.lil_members (created_at desc);
create index if not exists lil_members_postal_idx     on public.lil_members (postal_code);

-- updated_at tenu à jour automatiquement
create or replace function public.lil_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists lil_members_touch on public.lil_members;
create trigger lil_members_touch
  before update on public.lil_members
  for each row execute function public.lil_touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. Photos — 1 à 3 par membre, stockées dans un bucket privé
-- ---------------------------------------------------------------------
create table if not exists public.lil_photos (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.lil_members(id) on delete cascade,
  storage_path text not null unique,          -- ex. 'candidatures/<member_id>/1.jpg'
  position     smallint not null default 1 check (position between 1 and 3),
  mime_type    text,
  size_bytes   integer,
  created_at   timestamptz not null default now(),
  unique (member_id, position)
);

create index if not exists lil_photos_member_idx on public.lil_photos (member_id);

-- ---------------------------------------------------------------------
-- 4. Curation — la validation demande l'accord de DEUX curateurs
-- ---------------------------------------------------------------------
create table if not exists public.lil_curators (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null unique,
  full_name  text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lil_reviews (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.lil_members(id)  on delete cascade,
  curator_id uuid not null references public.lil_curators(id) on delete cascade,
  vote       lil_vote not null,
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un curateur n'a qu'une voix par candidature (il peut la changer)
  unique (member_id, curator_id)
);

create index if not exists lil_reviews_member_idx on public.lil_reviews (member_id);

drop trigger if exists lil_reviews_touch on public.lil_reviews;
create trigger lil_reviews_touch
  before update on public.lil_reviews
  for each row execute function public.lil_touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. Journal des emails — ce qui est parti, ce qui est programmé
-- ---------------------------------------------------------------------
create table if not exists public.lil_emails (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid references public.lil_members(id) on delete set null,
  template     text not null,        -- '01_candidature_recue' … '04_tranche_age'
  to_email     citext not null,
  subject      text,
  resend_id    text,                 -- identifiant Resend (permet d'annuler un envoi programmé)
  status       lil_email_status not null default 'programme',
  scheduled_at timestamptz,
  sent_at      timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists lil_emails_member_idx   on public.lil_emails (member_id, created_at desc);
create index if not exists lil_emails_pending_idx  on public.lil_emails (status, scheduled_at)
  where status = 'programme';

-- Un même template ne part qu'une fois par membre (filet anti-doublon)
create unique index if not exists lil_emails_once_per_member
  on public.lil_emails (member_id, template)
  where status in ('programme', 'envoye');

-- ---------------------------------------------------------------------
-- 6. Vue de travail pour le back-office
-- ---------------------------------------------------------------------
create or replace view public.lil_members_overview as
select
  m.*,
  extract(year from age(current_date, m.birth_date))::smallint as age,
  (select count(*) from public.lil_photos  p where p.member_id = m.id) as photo_count,
  (select count(*) from public.lil_reviews r where r.member_id = m.id and r.vote = 'oui') as votes_oui,
  (select count(*) from public.lil_reviews r where r.member_id = m.id and r.vote = 'non') as votes_non,
  (select count(*) from public.lil_reviews r where r.member_id = m.id) as votes_total
from public.lil_members m;

-- ---------------------------------------------------------------------
-- 7. RLS — tout est fermé côté client.
--     Seule la clé service_role (API Next.js, côté serveur) écrit et lit.
-- ---------------------------------------------------------------------
alter table public.lil_members  enable row level security;
alter table public.lil_photos   enable row level security;
alter table public.lil_curators enable row level security;
alter table public.lil_reviews  enable row level security;
alter table public.lil_emails   enable row level security;

-- Aucune policy n'est créée volontairement : sans policy, anon et
-- authenticated n'ont accès à rien. service_role contourne la RLS.
-- Les policies de lecture pour les curateurs connectés seront ajoutées
-- avec le back-office (02_admin.sql).

-- Les rôles anon / authenticated appartiennent à Supabase : on ne révoque
-- que s'ils existent, pour que le script tourne aussi sur un Postgres nu.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.lil_members_overview from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.lil_members_overview from authenticated';
  end if;
end $$;
