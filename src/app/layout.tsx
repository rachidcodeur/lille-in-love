import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inscription — Lille in Love',
  description:
    'Dis-nous qui tu es, on s’occupe du reste. Chaque profil est lu à la main.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FDFBF9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * suppressHydrationWarning sur <html> et <body> : beaucoup d'extensions de
     * navigateur (gestionnaires de mots de passe, bloqueurs, assistants)
     * posent leurs propres attributs sur ces deux balises avant que React
     * n'hydrate la page. React signale alors une différence entre le HTML du
     * serveur et celui du client, alors que rien de notre côté n'a changé.
     *
     * L'avertissement ne porte que d'un niveau : il tait les attributs de ces
     * deux balises, et rien d'autre. Une vraie incohérence à l'intérieur de
     * l'application continue d'être signalée.
     */
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
