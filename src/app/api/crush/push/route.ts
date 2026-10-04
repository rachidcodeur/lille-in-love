import { NextResponse } from 'next/server';
import { z } from 'zod';
import { participantConnecte } from '@/lib/crush-session';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

/**
 * Retenir le téléphone de quelqu'un, pour pouvoir le prévenir.
 *
 * L'adresse que donne le navigateur est unique au couple téléphone +
 * application : la même personne qui réinstalle en apporte une nouvelle, et
 * l'ancienne meurt d'elle-même au premier envoi.
 */
export async function POST(requete: Request) {
  const moi = await participantConnecte();
  if (!moi) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });

  const lu = schema.safeParse(await requete.json().catch(() => null));
  if (!lu.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });

  const { error } = await supabaseAdmin().from('lil_crush_push').upsert(
    {
      participant_id: moi.id,
      endpoint: lu.data.endpoint,
      p256dh: lu.data.p256dh,
      auth: lu.data.auth,
      echecs: 0,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.error('[crush/push]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
