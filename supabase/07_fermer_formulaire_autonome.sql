-- =====================================================================
--  LILLE IN LOVE — Refermer le formulaire autonome
--
--  À exécuter dès que l'application est déployée et que la page WordPress
--  pointe vers app.in-love.fr : le navigateur n'a alors plus à écrire
--  directement dans la base, tout repasse par le serveur.
--
--  Après ce script, la clé publique ne peut plus rien du tout.
-- =====================================================================

drop policy if exists lil_members_insert_public on public.lil_members;
drop policy if exists lil_photos_insert_public  on public.lil_photos;
drop policy if exists lil_photos_upload_public  on storage.objects;

revoke insert on public.lil_members from anon;
revoke insert on public.lil_photos  from anon;

do $$
declare
  restant integer;
begin
  select count(*) into restant
  from pg_policies
  where 'anon' = any (roles)
    and (
      (schemaname = 'public' and tablename in ('lil_members', 'lil_photos'))
      or policyname = 'lil_photos_upload_public'
    );

  if restant > 0 then
    raise exception 'Il reste % règle(s) ouverte(s) à la clé publique.', restant;
  end if;

  raise notice 'Formulaire autonome refermé : la clé publique n''a plus aucun droit.';
end $$;
