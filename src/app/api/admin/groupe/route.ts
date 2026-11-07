import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed, setGroup } from '@/lib/admin';
import { GROUPES, type Groupe } from '@/lib/groupes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  memberId: z.string().uuid(),
  // Un tableau vide retire la candidature de tout groupe.
  groupes: z.array(z.enum([...GROUPES] as [Groupe, ...Groupe[]])).max(GROUPES.length),
});

/**
 * Range une candidature dans des groupes de soirée, ou l'en retire.
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
    await setGroup(parsed.data.memberId, parsed.data.groupes);
    return NextResponse.json({ ok: true, groupes: parsed.data.groupes });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/groupe]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
