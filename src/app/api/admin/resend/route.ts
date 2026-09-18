import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed } from '@/lib/admin';
import { resendEmail } from '@/lib/decision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  memberId: z.string().uuid(),
  template: z.enum([
    '01_candidature_recue',
    '02_bienvenue',
    '03_on_reviendra',
    '04_tranche_age',
  ]),
});

/** Relance un email après un échec d'envoi. */
export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const result = await resendEmail(parsed.data.memberId, parsed.data.template);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
