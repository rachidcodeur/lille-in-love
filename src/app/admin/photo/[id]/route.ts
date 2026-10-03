import { NextResponse } from 'next/server';
import { isAdminAllowed } from '@/lib/admin';
import { estUneTaille, servirPhoto } from '@/lib/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Une photo de candidature, à une adresse qui ne change pas.
 *
 * Le bucket reste privé : c'est le serveur qui va chercher le fichier, après
 * avoir vérifié que la personne a le droit d'être là. Ce détour a une raison
 * précise — une URL signée porte un jeton différent à chaque rendu de page,
 * donc le navigateur ne reconnaît jamais deux fois la même image et
 * retélécharge tout à chaque passage.
 *
 * « ?t=vignette » demande une version réduite : une pastille de quarante
 * pixels n'a pas besoin des trois cents kilo-octets de l'original.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 404 plutôt que 401 : sans le code d'accès, on n'apprend même pas que
  // cette photo existe.
  if (!(await isAdminAllowed())) return new NextResponse(null, { status: 404 });

  const demandee = new URL(requete.url).searchParams.get('t');
  return servirPhoto({
    requete,
    photoId: id,
    taille: estUneTaille(demandee) ? demandee : 'pleine',
    espace: 'admin',
    autorise: () => true,
  });
}
