import { NextResponse } from 'next/server';
import { z } from 'zod';
import { marquerMatchVu } from '@/lib/crush';
import { participantConnecte } from '@/lib/crush-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ matchId: z.string().uuid() });

/** L'annonce a été vue : elle ne se rejouera plus. */
export async function POST(requete: Request) {
  const moi = await participantConnecte();
  if (!moi) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });

  const lu = schema.safeParse(await requete.json().catch(() => null));
  if (!lu.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });

  await marquerMatchVu(moi, lu.data.matchId);
  return NextResponse.json({ ok: true });
}
