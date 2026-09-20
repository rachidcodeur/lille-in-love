import { isAdminAllowed, membersForExport } from '@/lib/admin';
import { versCsv } from '@/lib/export-csv';
import { correspond, nomFichier, parseFiltres } from '@/lib/groupes';
import { STATUS_ORDER } from '@/lib/libelles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * L'export CSV de la sélection affichée.
 *
 * Les filtres passent par l'URL, exactement ceux de `/admin` : le bouton
 * « Exporter » n'est qu'un changement de chemin. Le fichier reprend colonne
 * pour colonne le format des exports déjà utilisés par l'équipe.
 */
export async function GET(request: Request) {
  if (!(await isAdminAllowed())) {
    return new Response('Accès refusé.', { status: 401 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filtres = parseFiltres(params, STATUS_ORDER);

  try {
    const membres = await membersForExport(filtres);

    // Ceinture et bretelles : on revérifie en mémoire ce que la base a filtré.
    // Une fiche de trop dans un export ne se remarque que chez le destinataire.
    const retenus = membres.filter((m) =>
      correspond(
        {
          status: m.status,
          soiree_group: m.soiree_group,
          gender: m.gender,
          orientation: m.orientation,
          age: m.age,
          first_name: m.first_name,
          last_name: m.last_name,
          email: m.email,
          city: m.city,
        },
        filtres,
      ),
    );

    return new Response(versCsv(retenus), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nomFichier(filtres)}"`,
        'Cache-Control': 'no-store',
        'X-Lil-Lignes': String(retenus.length),
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[admin/export]', message);
    return new Response(`Export impossible : ${message}`, { status: 500 });
  }
}
