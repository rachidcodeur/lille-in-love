'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Quitter la session.
 *
 * Discret, en bas : ce n'est pas un geste de soirée. Il sert à essayer avec
 * deux comptes depuis le même téléphone, et à quelqu'un qui prête le sien.
 * Supprimer l'icône de l'écran d'accueil, lui, n'y change rien — Safari
 * garde ce qu'il sait, et c'est deux choses différentes.
 */
export function Sortir({ prenom }: { prenom: string }) {
  const router = useRouter();
  const [demande, setDemande] = useState(false);

  if (!demande) {
    return (
      <button type="button" className="cr-sortir" onClick={() => setDemande(true)}>
        Ce n’est pas moi ({prenom})
      </button>
    );
  }

  return (
    <p className="cr-sortir-confirme">
      <button
        type="button"
        onClick={async () => {
          await fetch('/api/crush/sortir', { method: 'POST' });
          router.refresh();
        }}
      >
        Se déconnecter
      </button>
      <button type="button" onClick={() => setDemande(false)}>
        Annuler
      </button>
    </p>
  );
}
