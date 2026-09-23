import type { Metadata } from 'next';
import { Entete } from '@/components/form/Entete';
import { Remerciement } from '@/components/form/Remerciement';

/**
 * Rendu à chaque requête, jamais figé.
 *
 * Next préfigeait cette page et la servait avec « s-maxage=31536000 » : le
 * cache d'Hostinger la gardait alors un an. Or son contenu change — le prix,
 * le titre et la date de la soirée viennent de brand.ts. Une modification
 * aurait pu mettre des semaines à se voir. On paie un rendu par visite,
 * c'est quelques millisecondes pour une page de cette taille.
 */
export const dynamic = 'force-dynamic';

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
