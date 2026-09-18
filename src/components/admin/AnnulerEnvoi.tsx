'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  memberId: string;
  /** Nom de la réponse restée en attente, ex. « Bienvenue dans le club ». */
  reponse: string;
  partDans: string | null;
};

/**
 * Une réponse est encore programmée alors que la décision a changé.
 *
 * Cela arrive quand on revient sur une décision dans les secondes qui suivent :
 * Resend n'accepte d'annuler qu'une fois l'email passé en « scheduled », et ce
 * basculement prend un délai variable. Quelques secondes plus tard,
 * l'annulation aboutit toujours — d'où ce bouton, plutôt qu'un message qui
 * laisserait le curateur sans recours.
 */
export function AnnulerEnvoi({ memberId, reponse, partDans }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function reprendre() {
    setBusy(true);
    setErreur(null);

    try {
      const response = await fetch('/api/admin/annuler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (result.ok) {
        router.refresh();
        return;
      }
      setErreur(result.error ?? 'Resend refuse encore. Réessaie dans une minute.');
    } catch {
      setErreur('Connexion interrompue.');
    }

    setBusy(false);
  }

  return (
    <div className="adm-alerte" data-gravite="haute">
      <strong>L’email « {reponse} » est toujours programmé</strong>
      {partDans ? ` — il partira ${partDans}.` : '.'}
      <br />
      Il ne correspond plus à la décision, qui a été changée trop vite pour que Resend
      accepte de l’arrêter. Quelques secondes suffisent en général&nbsp;: relance
      l’annulation.
      <div style={{ marginTop: 12 }}>
        <button type="button" className="adm-btn adm-btn-no" onClick={reprendre} disabled={busy}>
          {busy ? 'Annulation en cours…' : 'Annuler cet envoi'}
        </button>
      </div>
      {erreur && <p style={{ margin: '10px 0 0', fontSize: 13.5 }}>{erreur}</p>}
    </div>
  );
}
