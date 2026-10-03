'use client';

import { useState } from 'react';
import type { Profil } from '@/lib/crush';

/**
 * Les matchs, et de quoi se retrouver demain.
 *
 * Replié tant qu'il n'y a rien, parce qu'une liste vide qu'on ouvre est une
 * déception qu'on s'inflige. L'adresse et l'Instagram n'apparaissent qu'ici :
 * pendant le crush time, pouvoir écrire à qui l'on vient de repérer viderait
 * le jeu de son sens.
 */
export function CrushMatchs({ matchs }: { matchs: Profil[] }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <section className="cr-matchs" data-ouvert={ouvert || undefined}>
      <button
        type="button"
        className="cr-matchs-onglet"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
      >
        <span>Mes matchs</span>
        <b>{matchs.length}</b>
      </button>

      {ouvert && (
        <div className="cr-matchs-corps">
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
      )}
    </section>
  );
}
