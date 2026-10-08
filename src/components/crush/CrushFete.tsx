'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profil } from '@/lib/crush';
import { alerterMatch } from '@/lib/alerte';
import { Contacts } from './Contacts';

/** Le nom de l'évènement par lequel un like victorieux appelle la fête. */
export const EVENEMENT_MATCH = 'lil:match';

type Moi = { prenom: string; photo: string | null };

/**
 * L'annonce d'un match.
 *
 * C'est le moment de la soirée, et il arrive de deux façons très
 * différentes :
 *
 *  · on vient de liker, et l'autre nous avait déjà liké — l'annonce tombe
 *    sous nos yeux, dans la seconde ;
 *  · l'autre vient de nous liker alors qu'on avait le téléphone en poche
 *    — la notification l'a dit, mais une notification se lit d'un œil, et
 *    la nouvelle mérite mieux que de se retrouver dans une liste.
 *
 * Le second cas est celui qu'on traitait mal. La base garde donc, de
 * chaque côté, si l'annonce a été vue ; celles qui ne l'ont pas été
 * arrivent ici et se jouent à l'ouverture, avec le même éclat. Celui qui
 * ferme la boucle, lui, est noté comme ayant vu dès l'écriture du match :
 * il l'a sous les yeux, l'annonce n'a pas à lui être rejouée.
 */
export function CrushFete({ moi, attendus }: { moi: Moi; attendus: Profil[] }) {
  const [file, setFile] = useState<Profil[]>([]);
  // Ce qu'on a déjà fêté dans cette session : le serveur peut renvoyer un
  // match une fraction de seconde avant que la note « vu » n'arrive, et la
  // fête ne doit pas se rejouer pour autant.
  const faits = useRef(new Set<string>());

  const ajouter = useCallback((profils: Profil[]) => {
    const neufs = profils.filter((p) => !faits.current.has(p.id));
    if (neufs.length === 0) return;
    for (const p of neufs) faits.current.add(p.id);
    setFile((avant) => [...avant, ...neufs]);
  }, []);

  // Les matchs que le serveur nous signale comme pas encore vus.
  useEffect(() => {
    ajouter(attendus);
  }, [attendus, ajouter]);

  // Celui qu'on vient de provoquer d'un clic sur un cœur. Il passe par un
  // évènement et non par le serveur : attendre le redessin de la page
  // mettrait une demi-seconde entre le geste et la fête.
  useEffect(() => {
    const ecouter = (e: Event) => ajouter([(e as CustomEvent<Profil>).detail]);
    window.addEventListener(EVENEMENT_MATCH, ecouter);
    return () => window.removeEventListener(EVENEMENT_MATCH, ecouter);
  }, [ajouter]);

  const lui = file[0] ?? null;

  // Le son et la note « vu » partent à l'affichage, pas à la fermeture :
  // l'annonce a été délivrée dès qu'elle est à l'écran, et un téléphone
  // qu'on repose sans toucher au bouton ne doit pas la revoir demain.
  useEffect(() => {
    if (!lui) return;
    alerterMatch();
    if (!lui.matchId) return;
    void fetch('/api/crush/vu', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matchId: lui.matchId }),
    }).catch(() => {
      /* réseau de salle : au pire la fête se rejoue, ce n'est pas une perte */
    });
  }, [lui]);

  if (!lui) return null;

  const suivant = file.length > 1;

  return (
    <div className="cr-fete" role="dialog" aria-modal="true" aria-label="C’est un match">
      <div className="cr-fete-lueur" aria-hidden="true" />

      {/* Des cœurs qui montent. Purement décoratif, et c'est le propos. */}
      <div className="cr-fete-pluie" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} data-i={i} />
        ))}
      </div>

      <div className="cr-fete-corps">
        <p className="cr-fete-mot">C’est un match</p>

        <div className="cr-fete-tetes">
          <Tete photo={moi.photo} prenom={moi.prenom} cote="gauche" />
          <Tete photo={lui.photo} prenom={lui.first_name} cote="droite" />
          <span className="cr-fete-coeur" aria-hidden="true">
            <Coeur />
          </span>
        </div>

        <h2 className="cr-fete-noms">
          {moi.prenom} <span>&amp;</span> {lui.first_name}
          {lui.nom ? ` ${lui.nom}` : ''}
        </h2>

        <p className="cr-fete-texte">
          Vous vous êtes choisis. À vous de jouer&nbsp;: voici comment le ou la retrouver.
        </p>

        <Contacts phone={lui.phone} instagram={lui.instagram} classe="cr-fete-contact" />

        <button
          type="button"
          className="cr-bouton cr-fete-ok"
          onClick={() => setFile((avant) => avant.slice(1))}
        >
          {suivant ? 'Et il y en a un autre' : 'Continuer'}
        </button>
      </div>
    </div>
  );
}

/** Un visage. À défaut de photo, l'initiale — jamais un trou. */
function Tete({
  photo,
  prenom,
  cote,
}: {
  photo: string | null;
  prenom: string;
  cote: 'gauche' | 'droite';
}) {
  return (
    <figure className="cr-fete-tete" data-cote={cote}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" />
      ) : (
        <span className="cr-fete-initiale">{prenom.slice(0, 1).toUpperCase()}</span>
      )}
    </figure>
  );
}

function Coeur() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.5-9A5.3 5.3 0 0 1 12 6.2 5.3 5.3 0 0 1 21.5 12c-2 4.4-9.5 9-9.5 9Z" />
    </svg>
  );
}
