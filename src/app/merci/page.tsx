import type { Metadata } from 'next';
import { Entete } from '@/components/form/Entete';
import { Remerciement } from '@/components/form/Remerciement';

export const metadata: Metadata = {
  title: 'Merci — Lille in Love',
  // Une page de confirmation n'a rien à faire dans un moteur de recherche.
  robots: { index: false, follow: false },
};

/**
 * La page de remerciement, autonome.
 *
 * Le formulaire affiche déjà ce message sur place après l'envoi. Celle-ci
 * existe pour qu'on puisse y renvoyer depuis ailleurs — un lien dans un
 * email, une redirection, un partage — sans refaire le questionnaire.
 */
export default function MerciPage() {
  return (
    <div className="lil-shell">
      <Entete />
      <div className="lil-card">
        <Remerciement />
      </div>
    </div>
  );
}
