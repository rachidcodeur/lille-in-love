import { NextResponse } from 'next/server';
import { isAdminAllowed } from '@/lib/admin';
import { publierSoiree, soireeSchema, supprimerSoiree } from '@/lib/soirees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Enregistre une soirée. Aucun email n'est envoyé. */
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
    console.error('[soirees] enregistrement impossible', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Efface une soirée, et avec elle son crush time. */
export async function DELETE(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Soirée inconnue.' }, { status: 400 });
  }

  try {
    const porte = await supprimerSoiree(id);
    return NextResponse.json({ ok: true, porte });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[soirees] suppression impossible', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
