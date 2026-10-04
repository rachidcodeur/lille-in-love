import type { Metadata, Viewport } from 'next';
import './crush.css';

export const metadata: Metadata = {
  title: 'Crush Time — Lille in Love',
  description: 'Les profils de la soirée, le temps d’un crush time.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pas de zoom : on tape sur des cœurs, pas sur du texte à loupe, et un
  // double-tap malheureux ne doit pas agrandir la page au mauvais moment.
  maximumScale: 1,
  themeColor: '#1C130F',
};

export default function CrushLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* iOS ne lit pas les icônes du manifeste pour l'écran d'accueil :
          il ne regarde que celle-ci. Sans elle, l'icône serait une capture
          floue de la page. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <link rel="apple-touch-icon" href="/crush-apple-touch.png" />
      <div className="cr-racine">{children}</div>
    </>
  );
}
