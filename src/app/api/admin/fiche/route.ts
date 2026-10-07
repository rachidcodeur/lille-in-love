import { NextResponse } from 'next/server';
import { ajouterPhoto, changerGenre, isAdminAllowed, supprimerPhoto } from '@/lib/admin';
import { formatDe } from '@/lib/format-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Corriger une candidature à la main : une photo, un genre.
 *
 * Les deux manques qu'on découvre en relisant une fiche. Une photo
 * absente, et le profil ne montre qu'une initiale sur fond beige — autant
 * dire rien, un soir où tout se joue sur un visage. Un genre coché de
 * travers, et la personne ne voit personne et n'est vue de personne.
 */
export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const type = request.headers.get('content-type') ?? '';

  /* --- Une photo, envoyée en formulaire --------------------------- */
  if (type.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    const memberId = String(form?.get('memberId') ?? '');
    const fichier = form?.get('file');

    if (!/^[0-9a-f-]{36}$/i.test(memberId) || !(fichier instanceof File)) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }
    if (fichier.size === 0) {
      return NextResponse.json({ error: 'Le fichier est vide.' }, { status: 400 });
    }
    if (fichier.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Photo trop lourde (12 Mo maximum).' }, { status: 413 });
    }

    const octets = new Uint8Array(await fichier.arrayBuffer());

    // Le format se lit dans les octets, jamais dans ce que le navigateur
    // annonce : il est vide sur beaucoup d'Android, et faux ailleurs.
    const format = formatDe(octets);
    if (!format) {
      return NextResponse.json(
        { error: 'Format accepté : JPG, PNG, WEBP ou HEIC.' },
        { status: 415 },
      );
    }

    try {
      const photo = await ajouterPhoto({
        memberId,
        octets,
        extension: format.extension,
        mimeType: format.mimeType,
      });
      return NextResponse.json({ ok: true, photo });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error('[admin/fiche] photo', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  /* --- Le reste, en JSON ------------------------------------------ */
  const corps = (await request.json().catch(() => null)) as {
    action?: string;
    memberId?: string;
    photoId?: string;
    genre?: string;
  } | null;

  try {
    if (corps?.action === 'genre' && corps.memberId && /^(femme|homme)$/.test(corps.genre ?? '')) {
      await changerGenre(corps.memberId, corps.genre as 'femme' | 'homme');
      return NextResponse.json({ ok: true });
    }

    if (corps?.action === 'retirer-photo' && /^[0-9a-f-]{36}$/i.test(corps.photoId ?? '')) {
      await supprimerPhoto(corps.photoId!);
      return NextResponse.json({ ok: true });
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/fiche]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
}
