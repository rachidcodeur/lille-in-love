import type { Metadata } from 'next';
import { Entete } from '@/components/form/Entete';
import { HauteurIframe } from '@/components/form/HauteurIframe';
import { Pixel } from '@/components/form/Pixel';
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
type Props = { searchParams: Promise<{ p?: string; deja?: string }> };

export default async function MerciPage({ searchParams }: Props) {
  const { p, deja } = await searchParams;

  return (
    <div className="lil-shell">
      <Pixel />
      <HauteurIframe />
      <Entete />
      <div className="lil-card">
        {/* Le prénom passe par l'adresse, pour que le message reste celui
            qu'on vient de lire dans le formulaire. Rien d'autre n'y transite. */}
        <Remerciement firstName={(p ?? '').slice(0, 40) || undefined} deja={deja === '1'} />
      </div>
    </div>
  );
}
