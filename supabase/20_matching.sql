-- =====================================================================
--  LILLE IN LOVE — Le matching sur mesure
--  À exécuter après 19_questionnaire.sql.
--
--  Après la dernière question du formulaire, on propose un service de
--  mise en relation plus poussé. Qui dit non envoie sa candidature comme
--  avant ; qui dit oui répond à une seconde série de questions.
--
--  Ces réponses tiennent dans un champ JSON et non en colonnes : elles
--  sont nombreuses, elles bougeront, et chaque question ajoutée aurait
--  demandé une migration.
--
--  Deux d'entre elles — les origines et la religion — sont des données
--  dites sensibles au sens de l'article 9 du RGPD. Elles ne peuvent être
--  recueillies que sur consentement explicite, distinct du reste : c'est
--  ce que « matching_consent » retient, avec sa date. Sans cette case
--  cochée, le formulaire n'envoie ni origines ni religion.
--
--  ⚠ Cette migration est DÉJÀ EXÉCUTÉE en production, mais le formulaire
--  qui s'en sert vit pour l'instant sur la branche « formulaire-v2 ».
--  Le fichier reste ici parce que le dossier doit refléter l'état réel de
--  la base : les colonnes existent, simplement personne ne les remplit
--  tant que l'ancien formulaire est en ligne. Elles sont toutes
--  facultatives, rien ne casse.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_members
  -- Oui ou non au service. Vide = la question n'a pas encore été posée,
  -- ce qui est le cas de toutes les candidatures d'avant.
  add column if not exists matching_optin boolean,
  add column if not exists matching jsonb not null default '{}'::jsonb,
  -- Le consentement aux données sensibles, horodaté : c'est lui qu'on
  -- montre si l'on nous demande sur quelle base elles ont été recueillies.
  add column if not exists matching_consent_at timestamptz,
  -- Posée dans le formulaire classique, celle-là.
  add column if not exists single_since text;

create index if not exists lil_members_matching_idx
  on public.lil_members (matching_optin)
  where matching_optin is true;

comment on column public.lil_members.matching_optin is
  'A accepté (true) ou refusé (false) le service de matching sur mesure. Vide = jamais proposé.';

comment on column public.lil_members.matching is
  'Les réponses du formulaire avancé. Voir src/lib/matching.ts.';

comment on column public.lil_members.matching_consent_at is
  'Consentement explicite aux données sensibles (origines, religion), RGPD art. 9.2.a.';

comment on column public.lil_members.single_since is
  'Depuis quand la personne est célibataire. Question du formulaire classique.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lil_members'
      and column_name = 'matching'
  ) then
    raise exception 'Le matching sur mesure n''est pas en place.';
  end if;

  raise notice 'Le formulaire avancé peut être proposé en fin d''inscription.';
end $$;
