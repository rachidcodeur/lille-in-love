'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Lever un blocage.
 *
 * Un geste, sans confirmation : débloquer ne détruit rien, et se refait
 * en deux clics si c'était une erreur. C'est bloquer qui demande à être
 * confirmé, pas l'inverse.
 */
export function Debloquer({ blocageId, nom }: { blocageId: string; nom: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function debloquer() {
    setBusy(true);
    setErreur(null);
    try {
      const r = await fetch('/api/admin/corbeille', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'debloquer', blocageId }),
      });
      const res = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !res.ok) {
        setErreur(res.error ?? 'L’opération a échoué.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setErreur('Connexion interrompue. Réessaie.');
    }
    setBusy(false);
  }

  return (
    <div className="adm-corbeille-actions">
      <button type="button" className="adm-btn adm-btn-ghost" disabled={busy} onClick={debloquer}>
        {busy ? 'Un instant…' : `Débloquer ${nom}`.trim()}
      </button>
      {erreur && (
        <div className="adm-feedback" data-kind="ko">
          {erreur}
        </div>
      )}
    </div>
  );
}
