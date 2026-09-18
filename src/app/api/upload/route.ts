import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import { clientIp, corsHeaders, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024; // 8 Mo, aligné sur le bucket
const ACCEPTED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

/**
 * Dépose une photo dans le bucket privé et renvoie son chemin.
 *
 * Le fichier arrive avant que la candidature n'existe : il atterrit sous
 * « pending/ », et /api/inscription le déplacera sous l'identifiant du membre
 * au moment de la validation finale. Le chemin est généré ici, jamais fourni
 * par le navigateur.
 */
export async function POST(request: Request) {
  const cors = corsHeaders(request);
  const ip = clientIp(request);

  const limit = rateLimit(`upload:${ip ?? 'inconnu'}`, {
    limit: env.maxPhotosParDixMinutes(),
    windowMs: 10 * 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop d’envois d’affilée. Réessaie dans un instant.' },
      { status: 429, headers: { ...cors, 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Requête illisible.' }, { status: 400, headers: cors });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400, headers: cors });
  }

  const extension = ACCEPTED[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: 'Format accepté : JPG, PNG, WEBP ou HEIC.' },
      { status: 415, headers: cors },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'Le fichier est vide.' }, { status: 400, headers: cors });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Photo trop lourde (8 Mo maximum).' },
      { status: 413, headers: cors },
    );
  }

  const path = `pending/${randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabaseAdmin()
    .storage.from(env.storageBucket())
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) {
    console.error('[upload] échec du dépôt', error.message);
    return NextResponse.json(
      { error: 'L’envoi de la photo a échoué. Réessaie.' },
      { status: 502, headers: cors },
    );
  }

  return NextResponse.json(
    { path, mimeType: file.type, sizeBytes: file.size },
    { status: 201, headers: cors },
  );
}
