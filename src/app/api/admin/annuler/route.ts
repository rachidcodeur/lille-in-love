import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed } from '@/lib/admin';
import { cancelPendingDecisionEmails, templateAttendu } from '@/lib/decision';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const schema = z.object({ memberId: z.string().uuid() });

/**
 * Reprend l'annulation d'une réponse restée en attente à tort.
 *
 * Resend n'accepte d'annuler qu'une fois l'email passé en « scheduled », et ce
 * basculement prend un délai variable. Quand la décision a été changée trop
 * vite, l'annulation échoue ; quelques secondes plus tard elle aboutit. On ne
 * touche qu'aux réponses qui ne correspondent plus au statut actuel : la bonne
 * réponse, elle, doit continuer d'attendre son heure.
 */
export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const { data: membre } = await supabaseAdmin()
    .from('lil_members')
    .select('status')
    .eq('id', parsed.data.memberId)
    .maybeSingle();

  if (!membre) {
    return NextResponse.json({ ok: false, error: 'Candidature introuvable.' }, { status: 404 });
  }

  const { echec } = await cancelPendingDecisionEmails(
    parsed.data.memberId,
    templateAttendu(membre.status),
  );

  return echec
    ? NextResponse.json({ ok: false, error: echec }, { status: 502 })
    : NextResponse.json({ ok: true });
}
