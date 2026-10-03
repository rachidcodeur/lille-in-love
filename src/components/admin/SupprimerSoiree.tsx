'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icone } from './Icones';

/**
 * Effacer une soirée.
 *
 * Rien ne l'interdit — c'est ton organisation, et une soirée d'essai qu'on
 * ne peut plus retirer encombre pour toujours. Mais une soirée emporte son
 * crush time : ses participants, leurs choix et leurs matchs. On dit donc ce
 * que ça fait tomber avant de demander, parce qu'on se trompe de ligne dans
 * une liste plus souvent qu'on ne le croit.
 */
export function SupprimerSoiree({
  soireeId,
  nom,
  participants,
  matchs,
}: {
  soireeId: string;
  nom: string;
  participants: number;
  matchs: number;
}) {
  const router = useRouter();
  const [demande, setDemande] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function effacer() {
    setBusy(true);
    setErreur(null);
    const r = await fetch(`/api/admin/soirees?id=${soireeId}`, { method: 'DELETE' }).catch(
      () => null,
    );
    if (!r?.ok) {
      const res = (await r?.json().catch(() => null)) as { error?: string } | null;
      setErreur(res?.error ?? 'La suppression a échoué.');
      setBusy(false);
      return;
    }
    setDemande(false);
    setBusy(false);
    router.refresh();
  }

  if (!demande) {
    return (
      <button
        type="button"
        className="adm-btn adm-soiree-effacer"
        onClick={() => setDemande(true)}
        aria-label={`Supprimer ${nom}`}
      >
        <Icone nom="corbeille" taille={15} />
      </button>
    );
  }

  return (
    <div className="adm-alerte" data-gravite={matchs > 0 ? 'haute' : undefined}>
      <strong>Supprimer « {nom} » ?</strong>{' '}
      {participants === 0 ? (
        <>Elle n’a aucun participant : il n’y a rien d’autre à perdre.</>
      ) : (
        <>
          Ses {participants} participant{participants > 1 ? 's' : ''} partent avec elle
          {matchs > 0 && (
            <>
              , <strong>et leurs {matchs} match{matchs > 1 ? 's' : ''}</strong>
            </>
          )}
          . C’est définitif.
        </>
      )}

      <div className="adm-actions" style={{ marginTop: 12 }}>
        <button type="button" className="adm-btn adm-btn-no" disabled={busy} onClick={effacer}>
          {busy ? 'Suppression…' : 'Oui, supprimer'}
        </button>
        <button type="button" className="adm-btn" disabled={busy} onClick={() => setDemande(false)}>
          Annuler
        </button>
      </div>

      {erreur && (
        <div className="adm-feedback" data-kind="ko" style={{ marginTop: 10 }}>
          {erreur}
        </div>
      )}
    </div>
  );
}
