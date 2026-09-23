import InscriptionForm from '@/components/form/InscriptionForm';

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
 * Le formulaire tel qu'il est affiché dans l'iframe posée sur
 * in-love.fr/inscription/. Voir public/embed.js pour le côté WordPress.
 */
export default function EmbedPage() {
  return <InscriptionForm />;
}
