import { NextResponse } from 'next/server';
import { COOKIE_CRUSH } from '@/lib/crush-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sortir de l'application.
 *
 * Le cookie vit deux jours, et il survit à la suppression de l'icône : ce
 * sont deux choses séparées, et c'est normal — effacer un raccourci
 * n'efface pas ce que Safari sait. Mais il faut une porte de sortie, pour
 * essayer avec deux comptes, et pour quelqu'un qui prête son téléphone.
 */
export async function POST() {
  const reponse = NextResponse.json({ ok: true });
  reponse.cookies.set(COOKIE_CRUSH, '', { path: '/', maxAge: 0 });
  return reponse;
}
