import { NextResponse } from 'next/server';
import { isAdminAllowed } from '@/lib/admin';
import { publierSoiree, soireeSchema } from '@/lib/soirees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Une soirée peut déclencher plusieurs lots d'emails.
export const maxDuration = 60;

/** Publie une soirée et envoie les 03 et 04 qu'elle déclenche. */
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
    const publication = await publierSoiree(parsed.data);
    return NextResponse.json({ ok: true, ...publication }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[soirees] publication impossible', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
