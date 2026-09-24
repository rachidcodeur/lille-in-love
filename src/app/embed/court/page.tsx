import InscriptionForm from '@/components/form/InscriptionForm';
import { Pixel } from '@/components/form/Pixel';

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

export const metadata = { title: 'Inscription — Lille in Love' };

/**
 * Le parcours court : sexe, prénom, nom, email et photos.
 *
 * C'est cette page qu'on embarque dans WordPress le temps des premiers tests.
 * Le parcours complet reste disponible sur /embed, intact.
 */
export default function EmbedCourtPage() {
  return (
    <>
      <Pixel />
      <InscriptionForm version="court" />
    </>
  );
}
