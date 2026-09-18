'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GROUPES, type Groupe } from '@/lib/groupes';

type Props = {
  memberId: string;
  groupe: Groupe | null;
  /** Dans la liste : quatre petites touches. Sur la fiche : la version lisible. */
  compact?: boolean;
};

/**
 * Le groupe de composition d'une soirée.
 *
 * C'est une étiquette de travail, pas une décision : rien n'est envoyé, le
 * statut ne bouge pas, et on peut changer d'avis autant de fois qu'on veut.
 * D'où l'affichage optimiste — la touche s'allume tout de suite, et ne
 * revient en arrière que si la base refuse.
 */
export function GroupePicker({ memberId, groupe, compact = false }: Props) {
  const router = useRouter();
  const [valeur, setValeur] = useState<Groupe | null>(groupe);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisir(cible: Groupe | null) {
    if (busy || cible === valeur) return;

    const precedent = valeur;
    setValeur(cible);
    setBusy(true);
    setErreur(null);

    try {
      const response = await fetch('/api/admin/groupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, groupe: cible }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setValeur(precedent);
        setErreur(result.error ?? 'Le groupe n’a pas pu être enregistré.');
      } else {
        // Les compteurs des filtres se recalculent côté serveur.
        router.refresh();
      }
    } catch {
      setValeur(precedent);
      setErreur('Connexion interrompue. Réessaie.');
    }

    setBusy(false);
  }

  return (
    <div className="adm-groupes" data-compact={compact}>
      {!compact && <p className="adm-card-title">Groupe de soirée</p>}

      <div className="adm-groupes-choix" role="group" aria-label="Groupe de soirée">
        {GROUPES.map((lettre) => (
          <button
            key={lettre}
            type="button"
            className="adm-groupe-btn"
            data-on={valeur === lettre}
            disabled={busy}
            aria-pressed={valeur === lettre}
            title={`Groupe ${lettre}`}
            onClick={() => choisir(lettre)}
          >
            {lettre}
          </button>
        ))}
        <button
          type="button"
          className="adm-groupe-btn adm-groupe-btn-vide"
          data-on={valeur === null}
          disabled={busy}
          aria-pressed={valeur === null}
          title="Aucun groupe"
          onClick={() => choisir(null)}
        >
          <span aria-hidden="true">—</span>
          <span className="adm-visuellement-cache">Aucun groupe</span>
        </button>
      </div>

      {!compact && (
        <p className="adm-hint">
          Pour composer les tables d’une soirée. Aucun email n’est envoyé, le statut ne change
          pas.
        </p>
      )}

      {erreur && (
        <div className="adm-feedback" data-kind="ko">
          {erreur}
        </div>
      )}
    </div>
  );
}
