import { NextResponse } from 'next/server';
import { z } from 'zod';
import { liker } from '@/lib/crush';
import { participantConnecte } from '@/lib/crush-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ versId: z.string().uuid() });

/** Donner son like de la manche. Une fois, et c'est tout. */
export async function POST(requete: Request) {
  const moi = await participantConnecte();
  if (!moi) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });

  const lu = schema.safeParse(await requete.json().catch(() => null));
  if (!lu.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });

  const resultat = await liker(moi, lu.data.versId);
  if (!resultat.ok) return NextResponse.json({ error: resultat.raison }, { status: 409 });

  return NextResponse.json({ ok: true, match: resultat.match });
}
