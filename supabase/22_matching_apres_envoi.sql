-- =====================================================================
--  LILLE IN LOVE — Le matching se propose après l'envoi
--  À exécuter après 21_referral_other.sql.
--
--  Le formulaire avancé était la dernière étape de l'inscription. Il
--  passe après : la candidature part d'abord, et la proposition s'affiche
--  sous le remerciement. Qui veut répondre le fait à tête reposée, sa
--  candidature déjà en sécurité ; qui ne veut pas n'a rien à refuser pour
--  envoyer.
--
--  Il faut donc pouvoir revenir écrire sur une fiche déjà enregistrée, et
--  seulement celle-là. D'où ce jeton : rendu une seule fois à la personne
--  qui vient de s'inscrire, il est effacé dès qu'il a servi. Sans lui, la
--  route refuse — un identifiant de fiche ne suffit pas à autoriser
--  l'écriture de données sensibles.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_members
  add column if not exists matching_token text;

-- Unique : deux fiches ne peuvent pas partager un jeton, et la recherche
-- par jeton reste immédiate.
create unique index if not exists lil_members_matching_token_idx
  on public.lil_members (matching_token)
  where matching_token is not null;

comment on column public.lil_members.matching_token is
  'Jeton à usage unique, rendu à l''envoi de la candidature, qui autorise à compléter le matching ensuite. Effacé dès qu''il a servi.';

do $$
begin
  raise notice 'Le matching peut être complété après l''envoi de la candidature.';
end $$;
