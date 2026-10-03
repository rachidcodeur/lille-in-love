'use client';

import { useState } from 'react';
import type { Profil } from '@/lib/crush';
import { nomManche } from '@/lib/crush-regles';

/**
 * Mes choix et mes matchs, en haut à droite.
 *
 * Deux listes, parce que ce sont deux choses : un like est un choix qui
 * attend, un match est un choix rendu. Les confondre ferait croire à une
 * réciprocité qui n'existe pas encore — et voir ses propres likes évite de
 * se demander toute la soirée si le geste a été pris en compte.
 *
 * Qui m'a choisi reste invisible tant que ce n'est pas réciproque. Les
 * coordonnées et les trois photos n'apparaissent qu'au match : pendant le
 * crush time, pouvoir écrire à qui l'on vient de repérer viderait le jeu de
 * son sens.
 */
export function CrushMatchs({ matchs, likes }: { matchs: Profil[]; likes: Profil[] }) {
  const [ouvert, setOuvert] = useState(false);
  const enAttente = likes.filter((l) => !l.match);

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

            <h2 className="cr-fiche-nom">
              {matchs.length > 0 ? `${matchs.length} match${matchs.length > 1 ? 's' : ''}` : 'Mes matchs'}
            </h2>

            {matchs.length === 0 ? (
              <p className="cr-texte">
                Pas encore de match. Il en faut deux pour en faire un : un like n’est qu’une moitié.
              </p>
            ) : (
              matchs.map((m) => (
                <article className="cr-match-carte" key={m.id}>
                  <div className="cr-match-photos">
                    {(m.photos?.length ? m.photos : [m.photo]).filter(Boolean).map((url, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url as string} alt="" loading="lazy" data-rang={index} />
                    ))}
                  </div>

                  <p className="cr-match-nom">
                    {m.first_name}
                    {m.age ? ` · ${m.age} ans` : ''}
                  </p>
                  {(m.profession || m.city) && (
                    <p className="cr-match-ville">
                      {[m.profession, m.city].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <div className="cr-match-contacts">
                    {m.email && (
                      <a className="cr-match-contact" href={`mailto:${m.email}`}>
                        {m.email}
                      </a>
                    )}
                    {m.instagram && (
                      <a
                        className="cr-match-contact"
                        href={`https://instagram.com/${m.instagram.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {m.instagram}
                      </a>
                    )}
                  </div>
                </article>
              ))
            )}

            {/* Les choix qui attendent encore. Jamais présentés comme des
                matchs : c'est exactement la confusion à éviter. */}
            {enAttente.length > 0 && (
              <>
                <h3 className="cr-sous-titre">
                  {enAttente.length} like{enAttente.length > 1 ? 's' : ''} en attente
                </h3>
                <p className="cr-aide" style={{ marginTop: 0 }}>
                  Tu les as choisis. Ça ne devient un match que si c’est réciproque.
                </p>

                {enAttente.map((l) => (
                  <div className="cr-match-ligne" key={`${l.id}-${l.manche}`}>
                    {l.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.photo} alt="" loading="lazy" />
                    ) : (
                      <span className="cr-carte-vide" aria-hidden="true">
                        {l.first_name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="cr-match-nom">
                        {l.first_name}
                        {l.age ? ` · ${l.age} ans` : ''}
                      </p>
                      <p className="cr-match-ville">
                        {l.manche ? `Choisi au ${nomManche(l.manche)}` : 'En attente'}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
