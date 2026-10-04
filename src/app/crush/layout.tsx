import type { Metadata, Viewport } from 'next';
import './crush.css';

export const metadata: Metadata = {
  title: 'Lille in Love — Crush Time',
  description: 'Les profils de la soirée, le temps d’un crush time.',
  robots: { index: false, follow: false },
  // iOS ne lit pas les icônes du manifeste pour l'écran d'accueil : il ne
  // regarde que celle-ci. Sans elle, l'icône serait une capture floue de
  // la page.
  icons: { apple: '/crush-apple-touch.png' },
  appleWebApp: {
    // C'est ce titre-là qui s'écrit sous l'icône sur iPhone : le manifeste
    // n'a pas toujours le dernier mot.
    title: 'Lille in Love',
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  other: {
    // Next écrit « mobile-web-app-capable », le nom standardisé. iOS ne
    // connaît que l'ancien, et c'est lui qui décide si l'icône s'ouvre en
    // plein écran ou dans un Safari miniature.
    'apple-mobile-web-app-capable': 'yes',
  },
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
  return <div className="cr-racine">{children}</div>;
}
