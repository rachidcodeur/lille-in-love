import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAllowed } from '@/lib/admin';
import { debloquer } from '@/lib/blacklist';
import {
  bloquerEtRanger,
  mettreALaCorbeille,
  restaurer,
  supprimerDefinitivement,
} from '@/lib/corbeille';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Mettre à la corbeille annule l'envoi en attente, ce qui peut demander
// quelques réessais le temps que Resend bascule l'email en « scheduled ».
export const maxDuration = 30;

const schema = z.object({
  memberId: z.string().uuid().optional(),
  action: z.enum(['corbeille', 'restaurer', 'effacer', 'bloquer', 'debloquer']),
  /** Pourquoi, en une phrase, pour celui qui relira dans six mois. */
  raison: z.string().trim().max(300).optional(),
  /** La ligne de la liste noire à retirer, pour « debloquer ». */
  blocageId: z.string().uuid().optional(),
});

/** Met à la corbeille, restaure, ou efface définitivement une candidature. */
export async function POST(request: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const { memberId, action, raison, blocageId } = parsed.data;

  try {
    if (action === 'debloquer') {
      if (!blocageId) {
        return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
      }
      await debloquer(blocageId);
      return NextResponse.json({ ok: true, action });
    }

    if (!memberId) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    if (action === 'bloquer') {
      const { bloque, envoiArrete } = await bloquerEtRanger(memberId, raison);
      // Le blocage a échoué mais la fiche est rangée : on ne répond pas
      // « c'est fait » à moitié.
      if (!bloque) {
        return NextResponse.json(
          {
            error:
              'La liste noire n’est pas encore en place. Exécute supabase/25_blacklist.sql, puis réessaie.',
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true, action, envoiArrete });
    }

    if (action === 'corbeille') {
      const { envoiArrete } = await mettreALaCorbeille(memberId);
      return NextResponse.json({ ok: true, action, envoiArrete });
    }
    if (action === 'restaurer') {
      await restaurer(memberId);
      return NextResponse.json({ ok: true, action });
    }
    await supprimerDefinitivement(memberId);
    return NextResponse.json({ ok: true, action });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/corbeille]', action, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
