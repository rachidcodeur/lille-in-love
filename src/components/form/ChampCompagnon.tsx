'use client';

import { useEffect, useState } from 'react';
import type { Values } from './Fields';

type Trouvee = { id: string; prenom: string; nom: string; photo: string | null };

/**
 * Qui l'on amène : son prénom, son nom, et sa fiche si elle existe déjà.
 *
 * On ne demandait que le prénom. Deux « Julie » plus tard, on ne savait
 * plus laquelle venait, ni si elle s'était inscrite de son côté — et deux
 * amis pouvaient finir sur deux soirées différentes.
 *
 * Quand les deux noms désignent quelqu'un de la base, on le montre et on
 * demande de confirmer. C'est la personne qui reconnaît qui elle amène,
 * pas nous : un nom qui se ressemble n'est pas un rapprochement. Tant
 * que personne n'a cliqué, rien n'est rattaché.
 *
 * Rien de tout cela n'est obligatoire : on peut amener quelqu'un qui ne
 * s'est pas encore inscrit, et c'est même le cas le plus fréquent.
 */
export function ChampCompagnon({
  values,
  onChange,
}: {
  values: Values;
  onChange: (name: string, value: unknown) => void;
}) {
  const prenom = typeof values.companionFirstName === 'string' ? values.companionFirstName : '';
  const nom = typeof values.companionLastName === 'string' ? values.companionLastName : '';
  const confirme = typeof values.companionMemberId === 'string' ? values.companionMemberId : '';

  const [trouvee, setTrouvee] = useState<Trouvee | null>(null);
  const [ecartee, setEcartee] = useState(false);

  // On cherche quand les deux noms tiennent debout, et pas à chaque
  // lettre : le délai laisse finir de taper, et évite d'interroger la
  // base vingt fois pour un seul nom.
  useEffect(() => {
    if (prenom.trim().length < 2 || nom.trim().length < 2) {
      setTrouvee(null);
      return;
    }

    let vivant = true;
    const minuteur = setTimeout(async () => {
      try {
        const r = await fetch('/api/compagnon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prenom: prenom.trim(), nom: nom.trim() }),
        });
        const reponse = await r.json();
        if (vivant) setTrouvee(reponse?.trouve ? (reponse as Trouvee) : null);
      } catch {
        // Hors ligne, ou la route ne répond pas : on ne propose rien.
        // Le formulaire part très bien sans ce rapprochement.
        if (vivant) setTrouvee(null);
      }
    }, 600);

    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [prenom, nom]);

  /** Changer un nom défait le rapprochement : il portait sur l'ancien. */
  const poserNom = (champ: string, valeur: string) => {
    onChange(champ, valeur);
    if (confirme) onChange('companionMemberId', '');
    setEcartee(false);
  };

  return (
    <div className="lil-compagnon">
      <div className="lil-compagnon-noms">
        <label className="lil-field-label" htmlFor="companionFirstName">
          Son prénom
        </label>
        <input
          id="companionFirstName"
          name="companionFirstName"
          className="lil-input"
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder="Julie"
          value={prenom}
          onChange={(e) => poserNom('companionFirstName', e.target.value)}
        />
      </div>

      <div className="lil-compagnon-noms">
        <label className="lil-field-label" htmlFor="companionLastName">
          Son nom de famille
        </label>
        <input
          id="companionLastName"
          name="companionLastName"
          className="lil-input"
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder="Dupont"
          value={nom}
          onChange={(e) => poserNom('companionLastName', e.target.value)}
        />
      </div>

      {trouvee && confirme === trouvee.id && (
        <p className="lil-compagnon-confirme">
          <span aria-hidden="true">✓</span> C’est bien {trouvee.prenom}. On vous placera sur la
          même soirée.
        </p>
      )}

      {trouvee && confirme !== trouvee.id && !ecartee && (
        <div className="lil-compagnon-trouve">
          {trouvee.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="lil-compagnon-photo" src={trouvee.photo} alt="" />
          ) : (
            <span className="lil-compagnon-photo lil-compagnon-sans" aria-hidden="true" />
          )}
          <div className="lil-compagnon-dit">
            <p className="lil-compagnon-nom">
              {trouvee.prenom} {trouvee.nom}
            </p>
            <p className="lil-field-help">
              Quelqu’un de ce nom est déjà inscrit. C’est bien la personne que tu amènes&nbsp;?
            </p>
            <div className="lil-compagnon-boutons">
              <button
                type="button"
                className="lil-btn-secondaire"
                onClick={() => onChange('companionMemberId', trouvee.id)}
              >
                Oui, c’est bien la personne
              </button>
              <button type="button" className="lil-compagnon-non" onClick={() => setEcartee(true)}>
                Non
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="lil-field-help">
        On lui enverra une invitation, et on essaiera de vous placer sur la même soirée.
      </p>
    </div>
  );
}
