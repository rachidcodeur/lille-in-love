import { NextResponse } from 'next/server';
import { estOuverte, manches, ouvrirCeQuiDoitLEtre } from '@/lib/crush';
import { participantConnecte } from '@/lib/crush-session';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ce qui a changé depuis tout à l'heure, en deux nombres.
 *
 * L'écran d'un participant doit bouger tout seul deux fois dans la soirée :
 * quand l'autre rend son like — c'est le moment qui compte — et quand un
 * crush time s'ouvre. Sans cela, il faut recharger pour l'apprendre, et
 * personne ne recharge une page au milieu d'une soirée.
 *
 * Volontairement minuscule : cinquante téléphones la demandent toutes les
 * huit secondes, et elle ne sert qu'à décider s'il faut redessiner la page.
 */
export async function GET() {
  const moi = await participantConnecte();
  if (!moi) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });

  // Les téléphones présents font avancer la soirée : l'heure d'une manche
  // arrive, et la première demande qui passe l'ouvre pour tout le monde.
  // Pas de tâche planifiée à installer, et rien ne bouge tant que l'hôte
  // n'a pas lancé la première.
  await ouvrirCeQuiDoitLEtre(moi.soiree_id).catch(() => {});

  const [rounds, { data: matchs }] = await Promise.all([
    manches(moi.soiree_id),
    supabaseAdmin()
      .from('lil_crush_matches')
      .select('id')
      .or(`a_id.eq.${moi.id},b_id.eq.${moi.id}`),
  ]);

  const ouverte = rounds.find((m) => estOuverte(m));
  return NextResponse.json(
    { matchs: matchs?.length ?? 0, manche: ouverte?.id ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
