import { NextResponse } from 'next/server';
import { parLien } from '@/lib/crush-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Le manifeste de l'application installée, personnalisé.
 *
 * Le détail qui décide de tout : sur iPhone, l'application posée sur
 * l'écran d'accueil a un stockage séparé de celui de Safari. Quelqu'un qui
 * se connecte dans Safari puis installe l'icône l'ouvre… déconnecté, et se
 * retrouve devant une demande d'email au milieu d'une soirée.
 *
 * L'adresse de départ porte donc son jeton : l'icône ouvre une session
 * valide, du premier coup. C'est pour cela que ce manifeste n'est pas un
 * fichier statique.
 */
export async function GET(requete: Request) {
  const adresse = new URL(requete.url);
  const jeton = adresse.searchParams.get('t') ?? '';
  const participant = jeton ? await parLien(jeton) : null;

  // Adresse absolue, construite sur celle qu'on vient de nous demander :
  // un chemin relatif se résout normalement sans peine, mais pas toujours
  // depuis un manifeste qui porte lui-même une chaîne de requête — et une
  // icône qui s'ouvre sur une page blanche ne se rattrape pas un soir de
  // soirée.
  const depart = new URL(
    participant ? `/crush/c/${participant.jeton}` : '/crush',
    adresse.origin,
  ).toString();

  return NextResponse.json(
    {
      name: 'Lille in Love',
      short_name: 'Lille in Love',
      description: 'Les profils de la soirée, le temps d’un crush time.',
      start_url: depart,
      // La portée couvre tout ce que voit un participant, et rien d'autre :
      // le back-office n'a rien à faire dans une application installée.
      scope: '/crush/',
      display: 'standalone',
      background_color: '#141010',
      theme_color: '#141010',
      orientation: 'portrait',
      lang: 'fr',
      icons: [
        { src: '/crush-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/crush-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/crush-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        // « private » suffit à écarter les caches partagés, et il le faut :
        // ce manifeste porte un jeton. Mais pas « no-store » — Safari doit
        // pouvoir le garder, sinon l'icône posée sur l'écran d'accueil n'a
        // plus d'adresse de départ et s'ouvre sur une page blanche.
        'Cache-Control': 'private, max-age=3600',
      },
    },
  );
}
