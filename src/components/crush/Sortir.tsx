'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Changer de profil.
 *
 * Tout en bas et en retrait : ce n'est pas un geste de soirée. Il sert à
 * essayer plusieurs comptes depuis un seul téléphone, et à qui prête le
 * sien. Supprimer l'icône de l'écran d'accueil n'y change rien — le cookie
 * appartient à Safari, pas au raccourci.
 */
export function Sortir({ prenom }: { prenom: string }) {
  const router = useRouter();
  const [demande, setDemande] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!demande) {
    return (
      <button type="button" className="cr-sortir" onClick={() => setDemande(true)}>
        Connecté en tant que {prenom} — changer
      </button>
    );
  }

  return (
    <p className="cr-sortir-confirme">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fetch('/api/crush/sortir', { method: 'POST' }).catch(() => null);
          router.refresh();
        }}
      >
        {busy ? 'Un instant…' : 'Se déconnecter'}
      </button>
      <button type="button" disabled={busy} onClick={() => setDemande(false)}>
        Annuler
      </button>
    </p>
  );
}
