import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed } from '@/lib/admin';
import {
  activerCrushTime,
  creerCrushTime,
  fermerManche,
  nouveauCode,
  ouvrirManche,
  remettre,
  retirer,
} from '@/lib/crush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tout ce que l'hôte fait d'un crush time, par une seule porte.
 *
 * Importer la billetterie, ouvrir une manche, retirer quelqu'un qui n'est
 * pas venu : ce sont des gestes rares, faits par une seule personne, souvent
 * depuis un téléphone au fond d'une salle. Une route unique et un verbe
 * explicite valent mieux que six adresses à retenir.
 */
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('importer'),
    soireeId: z.string().uuid(),
    csv: z.string().min(1, 'Le fichier est vide.'),
    // Les heures annoncées des manches, au format « 2026-10-18T20:00 ».
    heures: z.array(z.string().min(10)).min(1).max(9),
  }),
  z.object({
    action: z.literal('activer'),
    soireeId: z.string().uuid(),
    code: z
      .string()
      .regex(/^\d{4}$/, 'Le code tient en quatre chiffres')
      .optional(),
  }),
  z.object({ action: z.literal('ouvrir'), mancheId: z.string().uuid() }),
  z.object({ action: z.literal('fermer'), mancheId: z.string().uuid() }),
  z.object({ action: z.literal('retirer'), participantId: z.string().uuid() }),
  z.object({ action: z.literal('remettre'), participantId: z.string().uuid() }),
]);

export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const lu = schema.safeParse(await request.json().catch(() => null));
  if (!lu.success) {
    return NextResponse.json(
      { error: lu.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 },
    );
  }

  try {
    const commande = lu.data;
    switch (commande.action) {
      case 'importer': {
        const bilan = await creerCrushTime({
          soireeId: commande.soireeId,
          csv: commande.csv,
          heures: commande.heures.map((h) => new Date(h).toISOString()),
        });
        return NextResponse.json({ ok: true, bilan });
      }
      case 'activer': {
        const code = commande.code ?? nouveauCode();
        await activerCrushTime(commande.soireeId, code);
        return NextResponse.json({ ok: true, code });
      }
      case 'ouvrir':
        await ouvrirManche(commande.mancheId);
        return NextResponse.json({ ok: true });
      case 'fermer':
        await fermerManche(commande.mancheId);
        return NextResponse.json({ ok: true });
      case 'retirer':
        await retirer(commande.participantId);
        return NextResponse.json({ ok: true });
      case 'remettre':
        await remettre(commande.participantId);
        return NextResponse.json({ ok: true });
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/crush]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
