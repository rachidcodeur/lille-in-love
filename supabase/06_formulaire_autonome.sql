-- =====================================================================
--  LILLE IN LOVE — Formulaire autonome (solution d'attente)
--
--  À exécuter UNIQUEMENT si tu mets le formulaire autonome sur WordPress
--  avant d'avoir déployé l'application.
--
--  Sans application déployée, il n'y a pas de serveur pour recevoir le
--  formulaire : le navigateur écrit alors directement dans Supabase, avec la
--  clé « anon » (publique par nature, visible dans le code de la page).
--
--  Ce script ouvre donc le strict minimum :
--    • écrire une candidature et ses photos — RIEN d'autre ;
--    • aucune lecture : personne ne peut relire les candidatures ni les
--      photos avec cette clé, même en la récupérant dans la page ;
--    • aucune modification ni suppression.
--
--  ⚠  CONTREPARTIE : n'importe qui peut envoyer des candidatures sans passer
--     par le formulaire. Les pièges anti-robot du formulaire ne protègent
--     que la page, pas la base. C'est acceptable le temps de quelques jours,
--     avec une curation manuelle — pas durablement.
--
--  ➜  UNE FOIS L'APPLICATION DÉPLOYÉE, exécute 07_fermer_formulaire_autonome.sql
--     pour tout refermer.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Déposer une candidature
-- ---------------------------------------------------------------------
drop policy if exists lil_members_insert_public on public.lil_members;

-- La colonne « suspect » vient de 04_signalement.sql. On l'ajoute à la règle
-- seulement si elle existe, pour que ce script fonctionne quel que soit
-- l'ordre dans lequel les migrations ont été passées.
do $$
declare
  garde_suspect text := '';
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lil_members' and column_name = 'suspect'
  ) then
    garde_suspect := 'and suspect = false';
  end if;

  execute format($f$
    create policy lil_members_insert_public
      on public.lil_members
      for insert
      to anon
      with check (
        -- Une candidature arrive toujours neuve : impossible de s'auto-valider
        -- ni de se signaler comme déjà traité.
        status = 'nouveau'
        %s
        and decided_at is null
        and welcomed_at is null
        and admin_notes is null
        and consent_at is not null
      )
  $f$, garde_suspect);
end $$;

grant insert on public.lil_members to anon;

-- ---------------------------------------------------------------------
-- 2. Rattacher ses photos
-- ---------------------------------------------------------------------
drop policy if exists lil_photos_insert_public on public.lil_photos;

create policy lil_photos_insert_public
  on public.lil_photos
  for insert
  to anon
  with check (position between 1 and 3);

grant insert on public.lil_photos to anon;

-- ---------------------------------------------------------------------
-- 3. Déposer les fichiers photo
--    Uniquement sous « candidatures/ » du bucket lil-photos. Le bucket
--    reste privé : déposer n'est pas relire.
-- ---------------------------------------------------------------------
drop policy if exists lil_photos_upload_public on storage.objects;

create policy lil_photos_upload_public
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'lil-photos'
    and (storage.foldername(name))[1] = 'candidatures'
  );

-- ---------------------------------------------------------------------
-- 4. Vérification
--    Ces trois requêtes doivent renvoyer 0 ligne : la clé publique ne doit
--    jamais permettre de lire quoi que ce soit.
-- ---------------------------------------------------------------------
do $$
declare
  lecture_possible boolean;
begin
  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('lil_members', 'lil_photos')
      and 'anon' = any (roles)
      and cmd <> 'INSERT'
  ) into lecture_possible;

  if lecture_possible then
    raise exception 'Une règle donne plus que le droit d''écrire à la clé publique.';
  end if;

  raise notice 'Formulaire autonome autorisé : écriture seule, aucune lecture.';
end $$;
