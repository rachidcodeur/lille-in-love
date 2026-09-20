-- =====================================================================
--  LILLE IN LOVE — L'accompagnant n'a plus d'email
--
--  ⚠  À PASSER EN URGENCE : sans ce script, toute personne qui répond
--     « Oui » à « Tu viens avec quelqu'un ? » voit sa candidature refusée
--     avec « On n'a pas réussi à enregistrer ta candidature ».
--
--  Le schéma d'origine exigeait l'email de l'accompagnant dès qu'on venait
--  accompagné :
--
--      check (not comes_with or companion_email is not null)
--
--  L'étape 12 du questionnaire ne demande plus cet email — on ne réclame
--  que le prénom, pour lui envoyer une invitation. La contrainte réclame
--  donc une donnée que plus personne ne fournit, et rejette la ligne.
--
--  On la retire. La colonne, elle, reste : d'anciennes candidatures la
--  portent, et l'export CSV la publie encore.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_members
  drop constraint if exists lil_members_companion_coherent;

comment on column public.lil_members.companion_email is
  'Email de l''accompagnant. Le questionnaire ne le demande plus depuis le 18/09/2026 : vide sur les candidatures récentes.';

-- ---------------------------------------------------------------------
-- Vérification : une candidature accompagnée doit désormais passer.
-- ---------------------------------------------------------------------
do $$
declare
  essai uuid;
begin
  insert into public.lil_members (first_name, last_name, email, gender, consent_at, comes_with, companion_first_name)
  values ('Verification', 'SQL', 'verification.contrainte@example.invalid', 'femme', now(), true, 'Lucie')
  returning id into essai;

  delete from public.lil_members where id = essai;

  raise notice 'Contrainte retirée : « je viens accompagné » passe de nouveau.';
exception
  when check_violation then
    raise exception 'La contrainte bloque encore les candidatures accompagnées.';
end $$;
