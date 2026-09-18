import InscriptionForm from '@/components/form/InscriptionForm';

/**
 * Page de test, pratique en local (npm run dev) et pour vérifier un
 * déploiement. Le vrai point d'entrée public est /embed, chargé dans une
 * iframe depuis la page WordPress.
 */
export default function Home() {
  return (
    <main style={{ background: 'var(--cream)', minHeight: '100vh', paddingTop: 20 }}>
      <InscriptionForm />
    </main>
  );
}
