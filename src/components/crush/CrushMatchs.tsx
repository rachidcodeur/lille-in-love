'use client';

import { useState } from 'react';
import type { Profil } from '@/lib/crush';

/**
 * Les matchs, en haut à droite.
 *
 * C'est la récompense du jeu : elle doit se voir sans être cherchée, et le
 * compte doit sauter aux yeux au moment où il passe de zéro à un. En bas de
 * l'écran, il disparaissait sous le pouce et sous les barres du navigateur.
 *
 * L'adresse et l'Instagram n'apparaissent qu'ici : pendant le crush time,
 * pouvoir écrire à qui l'on vient de repérer viderait le jeu de son sens.
 */
export function CrushMatchs({ matchs }: { matchs: Profil[] }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        className="cr-matchs-onglet"
        data-pleins={matchs.length > 0 || undefined}
        onClick={() => setOuvert(true)}
        aria-expanded={ouvert}
      >
        <span className="cr-matchs-coeur" aria-hidden="true">
          ♥
        </span>
        <span className="cr-matchs-mot">Mes matchs</span>
        <b>{matchs.length}</b>
      </button>

      {ouvert && (
        <div className="cr-voile" role="dialog" aria-modal="true" onClick={() => setOuvert(false)}>
          <div className="cr-fiche cr-matchs-corps" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cr-fermer" onClick={() => setOuvert(false)}>
              Fermer
            </button>
            <h2 className="cr-fiche-nom">Mes matchs</h2>

            {matchs.length === 0 ? (
              <p className="cr-texte">
                Pas encore de match. Il en faut deux pour en faire un — patience.
              </p>
            ) : (
              matchs.map((m) => (
                <div className="cr-match-ligne" key={m.id}>
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo} alt="" loading="lazy" />
                  ) : (
                    <span className="cr-carte-vide" aria-hidden="true">
                      {m.first_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="cr-match-nom">
                      {m.first_name}
                      {m.age ? ` · ${m.age} ans` : ''}
                    </p>
                    {m.city && <p className="cr-match-ville">{m.city}</p>}
                    {m.email && (
                      <p className="cr-match-contact">
                        <a href={`mailto:${m.email}`}>{m.email}</a>
                      </p>
                    )}
                    {m.instagram && <p className="cr-match-contact">{m.instagram}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
