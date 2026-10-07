'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Corriger le genre d'une candidature.
 *
 * Quelqu'un se trompe de case, et toute la soirée en découle : le genre
 * décide de qui voit qui. Replié tant qu'on n'en a pas besoin — c'est une
 * correction, pas un réglage qu'on passe son temps à changer.
 */
export function CorrigerGenre({
  memberId,
  genre,
}: {
  memberId: string;
  genre: 'femme' | 'homme';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const autre = genre === 'femme' ? 'homme' : 'femme';

  async function corriger() {
    setBusy(true);
    setErreur(null);
    const r = await fetch('/api/admin/fiche', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'genre', memberId, genre: autre }),
    }).catch(() => null);

    const res = (await r?.json().catch(() => null)) as { error?: string } | null;
    if (!r?.ok) setErreur(res?.error ?? 'La correction a échoué.');
    else router.refresh();
    setBusy(false);
  }

  return (
    <details className="adm-corriger">
      <summary>Corriger</summary>
      <p className="adm-hint">
        Le genre décide de qui voit qui pendant un crush time. La correction suit jusque dans les
        soirées où la personne est inscrite.
      </p>
      <button type="button" className="adm-btn" disabled={busy} onClick={corriger}>
        {busy ? 'Correction…' : `C’est ${autre === 'femme' ? 'une femme' : 'un homme'}`}
      </button>
      {erreur && (
        <div className="adm-feedback" data-kind="ko" style={{ marginTop: 10 }}>
          {erreur}
        </div>
      )}
    </details>
  );
}
