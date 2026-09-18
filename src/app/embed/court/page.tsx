import InscriptionForm from '@/components/form/InscriptionForm';

export const metadata = { title: 'Inscription — Lille in Love' };

/**
 * Le parcours court : sexe, prénom, nom, email et photos.
 *
 * C'est cette page qu'on embarque dans WordPress le temps des premiers tests.
 * Le parcours complet reste disponible sur /embed, intact.
 */
export default function EmbedCourtPage() {
  return <InscriptionForm version="court" />;
}
