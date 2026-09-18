import InscriptionForm from '@/components/form/InscriptionForm';

/** Page de test locale du parcours court (le point d'entrée public est /embed/court). */
export default function CourtPage() {
  return (
    <main style={{ background: 'var(--cream)', minHeight: '100vh', paddingTop: 20 }}>
      <InscriptionForm version="court" />
    </main>
  );
}
