import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed, rangerPhotos } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  memberId: z.string().uuid(),
  // Les identifiants dans l'ordre voulu. Le premier est la photo du profil.
  ordre: z.array(z.string().uuid()).min(1).max(3),
});

/** Change l'ordre des photos d'une candidature. */
export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const lu = schema.safeParse(await request.json().catch(() => null));
  if (!lu.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  try {
    await rangerPhotos(lu.data.memberId, lu.data.ordre);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/photos]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
