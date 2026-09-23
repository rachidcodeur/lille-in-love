import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed } from '@/lib/admin';
import { mettreALaCorbeille, restaurer, supprimerDefinitivement } from '@/lib/corbeille';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Mettre à la corbeille annule l'envoi en attente, ce qui peut demander
// quelques réessais le temps que Resend bascule l'email en « scheduled ».
export const maxDuration = 30;

const schema = z.object({
  memberId: z.string().uuid(),
  action: z.enum(['corbeille', 'restaurer', 'effacer']),
});

/** Met à la corbeille, restaure, ou efface définitivement une candidature. */
export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const { memberId, action } = parsed.data;

  try {
    if (action === 'corbeille') {
      const { envoiArrete } = await mettreALaCorbeille(memberId);
      return NextResponse.json({ ok: true, action, envoiArrete });
    }
    if (action === 'restaurer') {
      await restaurer(memberId);
      return NextResponse.json({ ok: true, action });
    }
    await supprimerDefinitivement(memberId);
    return NextResponse.json({ ok: true, action });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/corbeille]', action, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
