import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isAdminAllowed } from '@/lib/admin';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Une photo de candidature, à une adresse qui ne change pas.
 *
 * Le bucket reste privé : c'est le serveur qui va chercher le fichier, après
 * avoir vérifié que la personne a le droit d'être là. Ce détour a une raison
 * précise — une URL signée porte un jeton différent à chaque rendu de page,
 * donc le navigateur ne reconnaît jamais deux fois la même image et
 * retélécharge tout à chaque passage. Ici l'adresse est la même d'une visite
 * à l'autre : la photo est lue une fois, puis relue depuis le cache.
 *
 * « private » est essentiel : ce sont des photos de candidats, aucun cache
 * partagé — celui de l'hébergeur compris — n'a le droit de les garder.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 404 plutôt que 401 : sans le code d'accès, on n'apprend même pas que
  // cette photo existe.
  if (!(await isAdminAllowed())) return new NextResponse(null, { status: 404 });

  const db = supabaseAdmin();
  const { data: photo } = await db
    .from('lil_photos')
    .select('storage_path, mime_type, size_bytes, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!photo) return new NextResponse(null, { status: 404 });

  // L'empreinte tient au fichier, pas à l'heure : tant que la photo est la
  // même, le navigateur peut se contenter d'un « rien n'a changé ».
  const empreinte = createHash('sha1')
    .update(`${photo.storage_path}|${photo.size_bytes ?? ''}|${photo.created_at ?? ''}`)
    .digest('hex')
    .slice(0, 20);
  const etag = `"${empreinte}"`;

  // Un jour en cache, puis une question à laquelle on répond « inchangé »
  // sans renvoyer l'image.
  const entetes = {
    'Cache-Control': 'private, max-age=86400, must-revalidate',
    // La réponse dépend du cookie d'accès : sans ce rappel, un cache
    // intermédiaire pourrait servir l'image à qui n'a pas le code.
    Vary: 'Cookie',
    ETag: etag,
  };

  if (requete.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: entetes });
  }

  const { data: fichier, error } = await db.storage
    .from(env.storageBucket())
    .download(photo.storage_path);

  if (error || !fichier) return new NextResponse(null, { status: 404 });

  const octets = Buffer.from(await fichier.arrayBuffer());
  return new NextResponse(octets, {
    headers: {
      ...entetes,
      // Le type vient de la base : une photo d'iPhone doit arriver annoncée
      // comme telle, c'est ce qui déclenche sa conversion côté navigateur.
      'Content-Type': photo.mime_type ?? fichier.type ?? 'application/octet-stream',
      'Content-Length': String(octets.length),
    },
  });
}
