'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { CrushAffiche } from './CrushAffiche';

/**
 * Ouvrir le crush time, et donner le code de la salle.
 *
 * Un seul code pour toute la soirée. Chacun avait le sien, reçu par mail :
 * il fallait le retrouver dans sa boîte, debout, en musique, et l'hôte
 * n'avait rien à répondre à qui l'avait perdu.
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
            Le code de la salle
          </p>
          <p className="adm-code">{code}</p>
          <p className="adm-hint" style={{ marginTop: 10 }}>
            À annoncer à voix haute et à écrire au mur : c’est le même pour tout le monde. Chacun
            entre avec son adresse et ces quatre chiffres. Il ouvre n’importe quelle adresse de la
            liste — quelqu’un qui l’entend et connaît l’adresse d’un autre peut entrer à sa place.
            Le lien personnel, lui, ne se devine pas : c’est la voie à privilégier.
          </p>
        </>
      ) : (
        <>
          <p className="adm-hint" style={{ margin: '0 0 16px' }}>
            Ouvrir ce crush time referme celui de la soirée précédente. Un code à quatre chiffres
            sera tiré : c’est celui que tu annonceras dans la salle, le même pour tout le monde.
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
