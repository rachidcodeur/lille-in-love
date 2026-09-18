import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed, setGroup } from '@/lib/admin';
import { GROUPES, type Groupe } from '@/lib/groupes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  memberId: z.string().uuid(),
  // null retire la candidature de tout groupe.
  groupe: z.enum([...GROUPES] as [Groupe, ...Groupe[]]).nullable(),
});

/**
 * Range une candidature dans un groupe de soirée (A, B, C), ou l'en retire.
 * Aucun email n'est envoyé, aucun statut n'est touché.
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
    await setGroup(parsed.data.memberId, parsed.data.groupe);
    return NextResponse.json({ ok: true, groupe: parsed.data.groupe });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/groupe]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
