-- =====================================================================
--  LILLE IN LOVE — Soirées
--  À exécuter après les quatre premiers scripts.
--
--  Les réponses « On reviendra vers toi » (03) et « Ta tranche d'âge ouvrira
--  plus tard » (04) ne partent plus au moment de la décision : elles partent
--  quand une soirée est publiée, parce que c'est elle qui décide qui a une
--  place et qui n'en a pas.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

create table if not exists public.lil_soirees (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null check (length(trim(nom)) > 0),
  -- La classe d'âge, bornes incluses : 27 et 35 pour « 27-35 ans ».
  age_min      smallint not null check (age_min between 18 and 99),
  age_max      smallint not null check (age_max between 18 and 99),
  date_soiree  date not null,
  heure        time,
  lieu         text not null check (length(trim(lieu)) > 0),
  publiee_at   timestamptz not null default now(),
  -- Ce que la publication a déclenché, pour s'en souvenir sans recompter :
  -- { "03": 12, "04": 5, "dans_la_tranche": 30, "age_inconnu": 4, "deja_prevenus": 2 }
  bilan        jsonb,
  created_at   timestamptz not null default now(),

  constraint lil_soirees_tranche_coherente check (age_max >= age_min)
);

comment on table public.lil_soirees is
  'Soirées publiées depuis le back-office. La publication envoie le 03 aux profils non retenus et le 04 aux validés hors de la classe d''âge.';

create index if not exists lil_soirees_date_idx on public.lil_soirees (date_soiree desc);

-- Chaque email envoyé à l'occasion d'une soirée garde la trace de laquelle.
alter table public.lil_emails
  add column if not exists soiree_id uuid references public.lil_soirees(id) on delete set null;

create index if not exists lil_emails_soiree_idx on public.lil_emails (soiree_id)
  where soiree_id is not null;

-- Fermée côté client, comme le reste : seul le serveur y accède.
alter table public.lil_soirees enable row level security;
