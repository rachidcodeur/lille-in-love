import { questionnairesDe } from '@/lib/crush';
import { reponsesVersCsv } from '@/lib/questionnaire';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Les réponses d'une soirée, en CSV.
 *
 * Le fichier porte les libellés en toutes lettres, pas les codes internes :
 * il s'ouvre dans un tableur et se dépouille à l'œil, sans traduction.
 * Seuls les questionnaires envoyés y figurent — un brouillon n'est pas un
 * avis.
 */
export async function GET(requete: Request) {
  const soireeId = new URL(requete.url).searchParams.get('soiree') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(soireeId)) {
    return new Response('Soirée inconnue.', { status: 400 });
  }

  try {
    const lignes = await questionnairesDe(soireeId);
    const csv = reponsesVersCsv(
      lignes.map((l) => ({ prenom: l.prenom, envoyeA: l.envoyeA, reponses: l.reponses })),
    );

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="questionnaire-${soireeId.slice(0, 8)}.csv"`,
        'Cache-Control': 'no-store',
        'X-Lil-Lignes': String(lignes.length),
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/questionnaire]', message);
    return new Response(`Export impossible : ${message}`, { status: 500 });
  }
}
