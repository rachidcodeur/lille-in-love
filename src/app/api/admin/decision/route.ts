import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed } from '@/lib/admin';
import { applyDecision } from '@/lib/decision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Annuler un envoi peut demander quelques réessais le temps que Resend
// bascule l'email en « scheduled ».
export const maxDuration = 30;

const schema = z.object({
  memberId: z.string().uuid(),
  decision: z.enum(['valide', 'non_retenu']),
});

/**
 * Applique une décision de curation.
 * « valide » programme la bienvenue à +24 h ; « non_retenu » n'envoie rien
 * avant la publication de la prochaine soirée.
 */
export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  try {
    const result = await applyDecision(parsed.data.memberId, parsed.data.decision);
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/decision]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
