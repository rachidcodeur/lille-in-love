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
  const jeton = new URL(requete.url).searchParams.get('t') ?? '';
  const participant = jeton ? await parLien(jeton) : null;

  const depart = participant ? `/crush/c/${participant.jeton}` : '/crush';

  return NextResponse.json(
    {
      name: 'Crush Time — Lille in Love',
      short_name: 'Crush Time',
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
        // Il porte un jeton : aucun cache partagé ne doit le garder.
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
