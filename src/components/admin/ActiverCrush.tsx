'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { CrushAffiche } from './CrushAffiche';

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
  // L'adresse dépend du domaine qu'on a sous les yeux : seul le navigateur
  // la connaît, et elle n'existe pas au premier rendu.
  const [racine, setRacine] = useState('');
  useEffect(() => setRacine(BRAND.crushUrl || window.location.origin), []);

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
          {racine && <CrushAffiche racine={racine} />}

          <p className="adm-code-label" style={{ marginTop: 22 }}>
            Code de secours
          </p>
          <p className="adm-code">{code}</p>
          <p className="adm-hint" style={{ marginTop: 10 }}>
            Chacun entre avec <strong>son</strong> code à quatre chiffres, reçu par mail. Celui-ci
            ouvre n’importe quelle adresse de la liste : ne l’annonce que pour dépanner quelqu’un
            qui ne retrouve plus son message.
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
