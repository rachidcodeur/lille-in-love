import { NextResponse } from 'next/server';
import { COOKIE_CRUSH, marquerArrivee, parLien, valeurCookie } from '@/lib/crush-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Le lien personnel : crush.in-love.fr/c/<jeton>
 *
 * Un seul geste — on scanne, on est dedans. Le jeton ne reste pas dans la
 * barre d'adresse : il est échangé contre un cookie et la page se recharge
 * sans lui, pour qu'une capture d'écran partagée ne donne l'accès à personne.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ jeton: string }> },
) {
  const { jeton } = await params;
  const participant = await parLien(jeton);

  // L'adresse de départ est celle qu'on vient de nous demander : le lien
  // marche donc en local, en préproduction et sur crush.in-love.fr sans
  // qu'une variable d'environnement ait à le savoir.
  const destination = new URL(participant ? '/crush' : '/crush?erreur=lien', requete.url);
  const reponse = NextResponse.redirect(destination);

  if (participant) {
    await marquerArrivee(participant);
    reponse.cookies.set(COOKIE_CRUSH, valeurCookie(participant.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // Le temps d'une soirée, et un peu plus : on ne redemande rien à
      // quelqu'un qui rouvre l'application au petit matin.
      maxAge: 60 * 60 * 24 * 2,
    });
  }

  return reponse;
}
