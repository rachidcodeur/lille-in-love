import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, codeMatches, tokenFor } from '@/lib/admin';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ouvre le back-office quand ADMIN_CODE est renseigné.
 * Tant que cette variable est vide, l'accès est libre et cette route ne sert à rien.
 */
export async function POST(request: Request) {
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };

  if (!code || !codeMatches(code)) {
    return NextResponse.json({ error: 'Code incorrect.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, tokenFor(env.adminCode()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
