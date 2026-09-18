import InscriptionForm from '@/components/form/InscriptionForm';

export const metadata = { title: 'Inscription — Lille in Love' };

/**
 * Le formulaire tel qu'il est affiché dans l'iframe posée sur
 * in-love.fr/inscription/. Voir public/embed.js pour le côté WordPress.
 */
export default function EmbedPage() {
  return <InscriptionForm />;
}
