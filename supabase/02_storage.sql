-- =====================================================================
--  LILLE IN LOVE — Bucket photos
--  À exécuter après 01_schema.sql.
--
--  Le bucket est PRIVÉ : aucune photo n'est accessible par URL publique.
--  L'API Next.js dépose les fichiers avec la clé service_role, et le
--  back-office les affiche via des URLs signées à durée de vie courte.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lil-photos',
  'lil-photos',
  false,
  8388608,                                            -- 8 Mo par fichier
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Pas de policy pour anon / authenticated : le bucket reste inaccessible
-- depuis le navigateur. Tous les accès passent par le serveur.
