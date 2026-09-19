'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  GENRE_CHOIX,
  GENRE_LABELS,
  GROUPE_CHOIX,
  GROUPE_LABELS,
  type Filtres,
} from '@/lib/groupes';
import { Icone } from './Icones';

type Props = {
  filtres: Filtres;
  parGroupe: Record<string, number>;
  parGenre: Record<string, number>;
  /** Combien de critères sont posés, en dehors du statut. */
  criteres: number;
};

/**
 * Le tri des candidatures : une icône à droite, un panneau au clic.
 *
 * Neuf fois sur dix on parcourt la liste sans rien filtrer ; la barre de
 * réglages n'a pas à occuper le haut de la page en permanence. Elle se replie
 * donc derrière une icône, qui porte le nombre de critères en cours — de quoi
 * savoir, sans ouvrir, qu'on ne regarde pas tout le monde.
 */
export function PanneauFiltres({ filtres, parGroupe, parGenre, criteres }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;

    const auClavier = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOuvert(false);
      }
    };
    document.addEventListener('keydown', auClavier);

    // La page derrière ne défile pas pendant qu'on règle.
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    panneau.current?.focus();

    return () => {
      document.removeEventListener('keydown', auClavier);
      document.body.style.overflow = avant;
      // On rend le focus à l'icône : au clavier, on repart d'où l'on venait.
      bouton.current?.focus();
    };
  }, [ouvert]);

  return (
    <>
      <button
        ref={bouton}
        type="button"
        className="adm-filtres-bouton"
        data-actif={criteres > 0}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        onClick={() => setOuvert(true)}
      >
        <Icone nom="filtre" taille={18} />
        <span className="adm-filtres-mot">Filtres</span>
        {criteres > 0 && (
          <span className="adm-filtres-compte" aria-label={`${criteres} critère(s) en cours`}>
            {criteres}
          </span>
        )}
      </button>

      {ouvert && (
        <>
          <div className="adm-voile" onClick={() => setOuvert(false)} aria-hidden="true" />

          <div
            className="adm-panneau"
            role="dialog"
            aria-modal="true"
            aria-label="Filtrer les candidatures"
            tabIndex={-1}
            ref={panneau}
          >
            <div className="adm-panneau-barre">
              <p className="adm-card-title">Filtrer</p>
              <button
                type="button"
                className="adm-panneau-fermer"
                onClick={() => setOuvert(false)}
                aria-label="Fermer"
              >
                <Icone nom="croix" taille={18} />
              </button>
            </div>

            <form className="adm-panneau-corps" method="get" action="/admin">
              {/* Le statut est choisi par les pastilles de la page : on le reconduit. */}
              {filtres.statut !== 'tous' && (
                <input type="hidden" name="statut" value={filtres.statut} />
              )}

              <label className="adm-tri-champ">
                <span>Groupe</span>
                <select name="groupe" defaultValue={filtres.groupe}>
                  {GROUPE_CHOIX.map((choix) => (
                    <option key={choix} value={choix}>
                      {GROUPE_LABELS[choix]} ({parGroupe[choix] ?? 0})
                    </option>
                  ))}
                </select>
              </label>

              <label className="adm-tri-champ">
                <span>Qui</span>
                <select name="genre" defaultValue={filtres.genre}>
                  {GENRE_CHOIX.map((choix) => (
                    <option key={choix} value={choix}>
                      {GENRE_LABELS[choix]} ({parGenre[choix] ?? 0})
                    </option>
                  ))}
                </select>
              </label>

              <div className="adm-tri-champ">
                <span>Âge</span>
                <span className="adm-tri-bornes">
                  <input
                    type="number"
                    name="ageMin"
                    min={18}
                    max={120}
                    placeholder="18"
                    defaultValue={filtres.ageMin ?? ''}
                    aria-label="Âge minimum"
                  />
                  <i>–</i>
                  <input
                    type="number"
                    name="ageMax"
                    min={18}
                    max={120}
                    placeholder="99"
                    defaultValue={filtres.ageMax ?? ''}
                    aria-label="Âge maximum"
                  />
                </span>
                <p className="adm-panneau-note">
                  Les fiches du formulaire court n’ont pas de date de naissance : dès qu’une borne
                  est posée, elles sortent de la sélection.
                </p>
              </div>

              <div className="adm-panneau-pied">
                <button type="submit" className="adm-btn adm-btn-appliquer">
                  Voir les candidatures
                </button>
                {criteres > 0 && (
                  <Link
                    className="adm-tri-effacer"
                    href={filtres.statut === 'tous' ? '/admin' : `/admin?statut=${filtres.statut}`}
                  >
                    Tout effacer
                  </Link>
                )}
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
