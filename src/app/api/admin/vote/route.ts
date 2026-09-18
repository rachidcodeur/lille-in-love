import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed } from '@/lib/admin';
import { castVote } from '@/lib/decision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  memberId: z.string().uuid(),
  curatorId: z.string().uuid(),
  vote: z.enum(['oui', 'non', 'peut_etre']),
  comment: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  try {
    const result = await castVote(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/vote]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
