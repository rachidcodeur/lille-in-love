import { NextResponse } from 'next/server';
import { isAdminAllowed } from '@/lib/admin';
import { calculerAudience, soireeSchema } from '@/lib/soirees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Qui recevrait quoi si l'on publiait cette soirée — sans rien écrire ni envoyer.
 *
 * Publier envoie des emails à beaucoup de monde d'un coup, et ça ne se
 * rattrape pas : le curateur voit donc l'audience exacte avant de confirmer.
 */
export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const parsed = soireeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: 'Certains champs sont à revoir.', fieldErrors }, { status: 422 });
  }

  try {
    const audience = await calculerAudience(parsed.data);
    return NextResponse.json({ ok: true, audience });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
