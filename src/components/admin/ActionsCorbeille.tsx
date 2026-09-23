'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Action = 'corbeille' | 'restaurer' | 'effacer';

type Props = {
  memberId: string;
  /** Le nom, pour que la confirmation dise de qui il s'agit. */
  nom: string;
  /** Sur une fiche active : mettre à la corbeille. Sinon : restaurer ou effacer. */
  place: 'fiche' | 'corbeille';
};

/**
 * Jeter, reprendre, effacer.
 *
 * Mettre à la corbeille se fait d'un clic et se défait : la fiche reste en
 * base, et l'email de bienvenue encore en attente est arrêté au passage.
 * L'effacement définitif, lui, emporte les photos et ne se rattrape pas —
 * il demande donc une confirmation qui nomme la personne.
 */
export function ActionsCorbeille({ memberId, nom, place }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState(false);

  async function agir(action: Action) {
    setBusy(action);
    setErreur(null);

    try {
      const r = await fetch('/api/admin/corbeille', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, action }),
      });
      const res = (await r.json()) as { ok?: boolean; error?: string };

      if (!r.ok || !res.ok) {
        setErreur(res.error ?? 'L’opération a échoué.');
        setBusy(null);
        return;
      }

      // Après un passage à la corbeille ou un effacement, la fiche n'a plus
      // de raison d'être à l'écran : on revient à la liste.
      if (action === 'restaurer') router.refresh();
      else router.push(place === 'fiche' ? '/admin' : '/admin/corbeille');
      router.refresh();
    } catch {
      setErreur('Connexion interrompue. Réessaie.');
    }

    setBusy(null);
  }

  if (place === 'fiche') {
    return (
      <div className="adm-actions">
        <button
          type="button"
          className="adm-btn adm-btn-corbeille"
          disabled={busy !== null}
          onClick={() => agir('corbeille')}
        >
          {busy ? 'Un instant…' : 'Mettre à la corbeille'}
        </button>
        <p className="adm-hint">
          La fiche quitte la liste sans être effacée, et l’email de bienvenue encore en attente
          est arrêté. Tu la retrouveras dans la corbeille.
        </p>
        {erreur && (
          <div className="adm-feedback" data-kind="ko">
            {erreur}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="adm-corbeille-actions">
      <button
        type="button"
        className="adm-btn adm-btn-ghost"
        disabled={busy !== null}
        onClick={() => agir('restaurer')}
      >
        {busy === 'restaurer' ? 'Un instant…' : 'Restaurer'}
      </button>

      {aConfirmer ? (
        <>
          <button
            type="button"
            className="adm-btn adm-btn-effacer"
            disabled={busy !== null}
            onClick={() => agir('effacer')}
          >
            {busy === 'effacer' ? 'Effacement…' : `Effacer ${nom} définitivement`}
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            disabled={busy !== null}
            onClick={() => setAConfirmer(false)}
          >
            Annuler
          </button>
        </>
      ) : (
        <button
          type="button"
          className="adm-btn adm-btn-ghost adm-btn-danger"
          disabled={busy !== null}
          onClick={() => setAConfirmer(true)}
        >
          Effacer définitivement
        </button>
      )}

      {erreur && (
        <div className="adm-feedback" data-kind="ko">
          {erreur}
        </div>
      )}
    </div>
  );
}
