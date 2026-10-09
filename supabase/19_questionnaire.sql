-- =====================================================================
--  LILLE IN LOVE — Le questionnaire de fin de soirée
--  À exécuter après 18_match_vu.sql.
--
--  Les trois crush times passés, l'application n'a plus rien à proposer :
--  elle affiche alors le questionnaire de satisfaction. C'est le seul
--  moment où tout le monde a son téléphone en main et la soirée encore
--  en tête — un formulaire envoyé le lendemain ne revient jamais.
--
--  Les réponses tiennent dans un seul champ JSON plutôt qu'en colonnes.
--  Un questionnaire de satisfaction se réécrit d'une soirée à l'autre :
--  en colonnes, chaque question ajoutée demanderait une migration, et les
--  anciennes réponses laisseraient des colonnes mortes derrière elles.
--
--  Une ligne par personne, et une seule : on peut revenir compléter ce
--  qu'on avait laissé, on ne répond pas deux fois.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

create table if not exists public.lil_crush_questionnaires (
  id             uuid primary key default gen_random_uuid(),
  soiree_id      uuid not null references public.lil_soirees(id) on delete cascade,
  participant_id uuid not null references public.lil_crush_participants(id) on delete cascade,
  -- { "q01": "excellente", "q02": ["ambiance", "jeux"], "q14": 9, … }
  reponses       jsonb not null default '{}'::jsonb,
  -- Vide tant que la personne n'a pas appuyé sur « Envoyer » : ce qui est
  -- écrit avant n'est qu'un brouillon, gardé pour qu'un téléphone rangé
  -- en cours de route ne fasse pas tout recommencer.
  envoye_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint lil_crush_questionnaires_une_fois unique (participant_id)
);

create index if not exists lil_crush_questionnaires_soiree_idx
  on public.lil_crush_questionnaires (soiree_id, envoye_at);

comment on table public.lil_crush_questionnaires is
  'Le questionnaire de satisfaction, rempli dans l''application une fois les crush times terminés.';

comment on column public.lil_crush_questionnaires.reponses is
  'Les réponses, indexées par identifiant de question. Voir src/lib/questionnaire.ts.';

comment on column public.lil_crush_questionnaires.envoye_at is
  'Date d''envoi. Vide = brouillon en cours, à ne pas compter dans les résultats.';

-- La table n'est lue et écrite que par la clé service_role, côté serveur,
-- comme le reste du crush time. On ferme quand même la porte : une clé
-- « anon » qui traînerait ne doit pas pouvoir lire les réponses de la
-- salle entière.
alter table public.lil_crush_questionnaires enable row level security;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'lil_crush_questionnaires'
  ) then
    raise exception 'Le questionnaire de fin de soirée n''est pas en place.';
  end if;

  raise notice 'Le questionnaire s''affichera une fois les crush times terminés.';
end $$;
