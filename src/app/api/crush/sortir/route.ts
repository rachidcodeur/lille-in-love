import { NextResponse } from 'next/server';
import { COOKIE_CRUSH } from '@/lib/crush-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sortir de l'application.
 *
 * Le cookie vit deux jours et survit à la suppression de l'icône : ce sont
 * deux choses séparées, et Safari garde ce qu'il sait. Il faut donc une
 * porte de sortie — pour essayer plusieurs profils depuis un seul
 * téléphone, et pour qui prête le sien.
 */
export async function POST() {
  const reponse = NextResponse.json({ ok: true });
  reponse.cookies.set(COOKIE_CRUSH, '', { path: '/', maxAge: 0 });
  return reponse;
}
