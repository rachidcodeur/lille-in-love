'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GROUPES, type Groupe } from '@/lib/groupes';

type Props = {
  memberId: string;
  groupes: Groupe[];
  /** Dans la liste : de petites touches. Sur la fiche : la version lisible. */
  compact?: boolean;
};

/**
 * Le groupe de composition d'une soirée.
 *
 * C'est une étiquette de travail, pas une décision : rien n'est envoyé, le
 * statut ne bouge pas, et on peut changer d'avis autant de fois qu'on veut.
 * D'où l'affichage optimiste — la touche s'allume tout de suite, et ne
 * revient en arrière que si la base refuse.
 *
 * Plusieurs touches peuvent être allumées : on compose souvent deux
 * soirées en même temps, et quelqu'un peut convenir aux deux. Le « — »
 * les éteint toutes.
 */
export function GroupePicker({ memberId, groupes, compact = false }: Props) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState<Groupe[]>(groupes);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisir(cibles: Groupe[]) {
    if (busy) return;

    const precedent = valeurs;
    setValeurs(cibles);
    setBusy(true);
    setErreur(null);

    try {
      const response = await fetch('/api/admin/groupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, groupes: cibles }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setValeurs(precedent);
        setErreur(result.error ?? 'Le groupe n’a pas pu être enregistré.');
      } else {
        // Les compteurs des filtres se recalculent côté serveur.
        router.refresh();
      }
    } catch {
      setValeurs(precedent);
      setErreur('Connexion interrompue. Réessaie.');
    }

    setBusy(false);
  }

  return (
    <div className="adm-groupes" data-compact={compact}>
      {!compact && <p className="adm-card-title">Groupe de soirée</p>}

      <div className="adm-groupes-choix" role="group" aria-label="Groupe de soirée">
        {GROUPES.map((lettre) => {
          const allumee = valeurs.includes(lettre);
          return (
            <button
              key={lettre}
              type="button"
              className="adm-groupe-btn"
              data-on={allumee}
              disabled={busy}
              aria-pressed={allumee}
              title={`Groupe ${lettre}`}
              onClick={() =>
                choisir(
                  allumee ? valeurs.filter((g) => g !== lettre) : [...valeurs, lettre],
                )
              }
            >
              {lettre}
            </button>
          );
        })}
        <button
          type="button"
          className="adm-groupe-btn adm-groupe-btn-vide"
          data-on={valeurs.length === 0}
          disabled={busy}
          aria-pressed={valeurs.length === 0}
          title="Aucun groupe"
          onClick={() => choisir([])}
        >
          <span aria-hidden="true">—</span>
          <span className="adm-visuellement-cache">Aucun groupe</span>
        </button>
      </div>

      {!compact && (
        <p className="adm-hint">
          Pour composer les tables d’une soirée — plusieurs groupes possibles. Aucun email n’est
          envoyé, le statut ne change pas.
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
