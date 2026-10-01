'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Ouvrir le crush time, et donner le code de la salle.
 *
 * Le code se dit à voix haute : c'est par lui qu'on entre quand on n'a pas
 * reçu son lien, et en pratique c'est la porte principale — rien à attendre,
 * rien à recevoir, aucun réseau à partager entre cinquante téléphones.
 */
export function ActiverCrush({
  soireeId,
  code,
  actif,
  participants,
}: {
  soireeId: string;
  code: string | null;
  actif: boolean;
  participants: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function activer() {
    setBusy(true);
    setErreur(null);
    const r = await fetch('/api/admin/crush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activer', soireeId }),
    }).catch(() => null);
    const res = (await r?.json().catch(() => null)) as { error?: string } | null;
    if (!r?.ok) setErreur(res?.error ?? 'L’activation a échoué.');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <p className="adm-card-title">Le soir même</p>
        <span className="adm-card-aside">{participants} participants</span>
      </div>

      {actif && code ? (
        <>
          <p className="adm-code-label">Le code à annoncer dans la salle</p>
          <p className="adm-code">{code}</p>
          <p className="adm-hint" style={{ marginTop: 10 }}>
            Avec leur email, il suffit à entrer. C’est ce crush time qui s’ouvre sur{' '}
            <strong>crush.in-love.fr</strong> — un seul à la fois.
          </p>
        </>
      ) : (
        <>
          <p className="adm-hint" style={{ margin: '0 0 16px' }}>
            Ouvrir ce crush time referme celui de la soirée précédente. Un code à quatre chiffres
            sera tiré : c’est celui que tu annonceras dans la salle.
          </p>
          <button type="button" className="adm-btn adm-btn-yes" disabled={busy} onClick={activer}>
            {busy ? 'Ouverture…' : 'Ouvrir ce crush time'}
          </button>
        </>
      )}

      {erreur && (
        <div className="adm-feedback" data-kind="ko" style={{ marginTop: 14 }}>
          {erreur}
        </div>
      )}
    </div>
  );
}
