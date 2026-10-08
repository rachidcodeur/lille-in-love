'use client';

import { useState } from 'react';
import type { Profil } from '@/lib/crush';
import { Contacts } from './Contacts';

/**
 * Mes matchs, en haut à droite.
 *
 * Seulement les matchs. Un like reste en sourdine tant qu'il n'a pas été
 * rendu : l'afficher en attente ne dit rien d'utile et installe une
 * surveillance qui n'a pas sa place dans une soirée. Que le choix ait été
 * pris en compte, le bandeau du haut le dit déjà — « ton choix : Samir ».
 *
 * Les coordonnées et les trois photos n'apparaissent qu'au match : pendant
 * le crush time, pouvoir écrire à qui l'on vient de repérer viderait le jeu
 * de son sens.
 *
 * Le bouton ne prend sa couleur qu'en crush time : le rose appelle au jeu,
 * et entre deux manches il n'y a rien à liker.
 */
export function CrushMatchs({ matchs, enManche }: { matchs: Profil[]; enManche: boolean }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        className="cr-matchs-onglet"
        // Le rose appelle au jeu. Entre deux crush times, il n'y a rien à
        // liker : un bouton qui fait signe vers une action impossible se
        // touche pour rien. Les matchs restent là, le bouton se fait
        // seulement sobre — bordure, mot et compte suffisent à le trouver.
        data-pleins={(matchs.length > 0 && enManche) || undefined}
        data-sobre={!enManche || undefined}
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
                    {m.nom ? ` ${m.nom}` : ''}
                    {m.age ? ` · ${m.age} ans` : ''}
                  </p>
                  {(m.profession || m.city) && (
                    <p className="cr-match-ville">
                      {[m.profession, m.city].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <Contacts phone={m.phone} instagram={m.instagram} classe="cr-match-contact" />
                </article>
              ))
            )}

          </div>
        </div>
      )}
    </>
  );
}
