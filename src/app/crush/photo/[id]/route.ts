import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { participantConnecte } from '@/lib/crush-session';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Une photo, pour les participants d'une soirée.
 *
 * Le jumeau de /admin/photo, avec une autorisation différente : ici il faut
 * être de la soirée, et la photo doit appartenir à quelqu'un d'autre de la
 * même soirée. Sans cette seconde condition, un participant pourrait, en
 * changeant un identifiant dans l'adresse, parcourir les photos de toute la
 * base — y compris celles de gens qui ne sont pas là ce soir.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const moi = await participantConnecte();
  if (!moi) return new NextResponse(null, { status: 404 });

  const db = supabaseAdmin();
  const { data: photo } = await db
    .from('lil_photos')
    .select('member_id, storage_path, mime_type, size_bytes, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!photo) return new NextResponse(null, { status: 404 });

  const { data: proprietaire } = await db
    .from('lil_crush_participants')
    .select('id')
    .eq('soiree_id', moi.soiree_id)
    .eq('member_id', photo.member_id)
    .is('retire_at', null)
    .maybeSingle();

  if (!proprietaire) return new NextResponse(null, { status: 404 });

  const empreinte = createHash('sha1')
    .update(`${photo.storage_path}|${photo.size_bytes ?? ''}|${photo.created_at ?? ''}`)
    .digest('hex')
    .slice(0, 20);
  const etag = `"${empreinte}"`;

  const entetes = {
    'Cache-Control': 'private, max-age=86400, must-revalidate',
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
      'Content-Type': photo.mime_type ?? fichier.type ?? 'application/octet-stream',
      'Content-Length': String(octets.length),
    },
  });
}
