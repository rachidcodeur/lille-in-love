'use client';

import { Fragment } from 'react';
import { BLOCS, type ChampMatching } from '@/lib/matching';

/**
 * Ce que l'écran manipule : les réponses, plus la case de consentement.
 *
 * Volontairement tolérant — « unknown » et non « string | string[] ». Une
 * case à cocher vaut un booléen, un champ vidé vaut la chaîne vide, et
 * c'est le serveur qui range tout cela avec « nettoyerMatching ». Ce
 * n'est pas à l'écran de refuser ce que la personne vient de taper.
 */
export type BrouillonMatching = Record<string, unknown>;

/**
 * Le formulaire de matching, d'un seul tenant.
 *
 * Pas d'étapes ici, contrairement au reste de l'inscription : la personne
 * a déjà dit oui, on n'a plus à la convaincre d'avancer. Découper vingt
 * questions en vingt écrans ne ferait que l'épuiser ; les voir toutes
 * permet au contraire de jauger ce qui reste et de sauter ce qu'on ne
 * veut pas dire.
 *
 * Tout est facultatif, et ça se voit : rien n'est marqué obligatoire,
 * rien ne bloque l'envoi.
 *
 * Les deux blocs sensibles — origines, religion — restent fermés tant que
 * la case de consentement n'est pas cochée. Le serveur les écarte de
 * toute façon sans elle ; ici, c'est la promesse qui est tenue à l'écran.
 */
export function MatchingAvance({
  valeurs,
  onChange,
}: {
  valeurs: BrouillonMatching;
  onChange: (valeurs: BrouillonMatching) => void;
}) {
  const consent = valeurs.consentSensible === true;
  const poser = (nom: string, valeur: unknown) => onChange({ ...valeurs, [nom]: valeur });

  // La case se pose juste avant le premier bloc qu'elle ouvre. Elle était
  // tout en bas : on cochait, et des questions apparaissaient au milieu,
  // hors de l'écran. Une case qui commande quelque chose doit être à côté
  // de ce qu'elle commande.
  const premierSensible = BLOCS.findIndex((b) => b.sensible);

  return (
    <div className="lil-matching">
      {BLOCS.map((bloc, index) => {
        const porte =
          index === premierSensible ? (
            <div className="lil-matching-porte" key="porte">
              <p className="lil-matching-porte-titre">Deux sujets de plus, si tu veux bien</p>
              <p className="lil-field-help">
                Les origines et la religion. La loi les range parmi les informations sensibles&nbsp;:
                on ne les affiche que si tu le demandes, elles ne servent qu’à la mise en relation,
                et tu peux les retirer quand tu veux.
              </p>
              <label className="lil-consent lil-matching-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => poser('consentSensible', e.target.checked)}
                />
                <span>J’accepte de répondre à ces deux sujets.</span>
              </label>
            </div>
          ) : null;

        if (bloc.sensible && !consent) return porte;

        return (
          <Fragment key={bloc.id}>
            {porte}
            <fieldset className="lil-matching-bloc">
            <legend>{bloc.titre}</legend>
            {bloc.intro && <p className="lil-field-help">{bloc.intro}</p>}
              {bloc.champs.map((champ) => (
                <Champ
                  key={champ.nom}
                  champ={champ}
                  valeur={valeurs[champ.nom]}
                  poser={poser}
                />
              ))}
            </fieldset>
          </Fragment>
        );
      })}
    </div>
  );
}

function Champ({
  champ,
  valeur,
  poser,
}: {
  champ: ChampMatching;
  valeur: unknown;
  poser: (nom: string, valeur: unknown) => void;
}) {
  const choisies = Array.isArray(valeur) ? (valeur as string[]) : [];

  const basculer = (option: string) => {
    if (champ.exclusive === option) {
      return poser(champ.nom, choisies.includes(option) ? [] : [option]);
    }
    const sansExclusive = choisies.filter((v) => v !== champ.exclusive);
    poser(
      champ.nom,
      sansExclusive.includes(option)
        ? sansExclusive.filter((v) => v !== option)
        : [...sansExclusive, option],
    );
  };

  return (
    <div className="lil-matching-champ">
      <p className="lil-field-label">{champ.libelle}</p>
      {champ.aide && <p className="lil-field-help">{champ.aide}</p>}

      {/* « aria-checked » et la puce, comme partout ailleurs dans le
          formulaire : c'est sur eux que repose tout le style de la
          sélection. Avec « aria-pressed » et sans puce, on cliquait et
          rien ne bougeait à l'œil — le choix était pris, mais invisible. */}
      {champ.type === 'radio' && (
        <div className="lil-choices lil-choices-serrees" role="radiogroup">
          {champ.options?.map((o) => (
            <button
              key={o.valeur}
              type="button"
              role="radio"
              aria-checked={valeur === o.valeur}
              className="lil-choice"
              onClick={() => poser(champ.nom, valeur === o.valeur ? '' : o.valeur)}
            >
              <span className="lil-choice-mark" aria-hidden="true" />
              <span>{o.libelle}</span>
            </button>
          ))}
        </div>
      )}

      {champ.type === 'cases' && (
        <div className="lil-choices lil-choices-serrees">
          {champ.options?.map((o) => (
            <button
              key={o.valeur}
              type="button"
              role="checkbox"
              aria-checked={choisies.includes(o.valeur)}
              className="lil-choice"
              onClick={() => basculer(o.valeur)}
            >
              <span className="lil-choice-mark" aria-hidden="true" />
              <span>{o.libelle}</span>
            </button>
          ))}
        </div>
      )}

      {champ.type === 'ligne' && (
        <input
          className="lil-input"
          type="text"
          maxLength={champ.max ?? 120}
          value={typeof valeur === 'string' ? valeur : ''}
          onChange={(e) => poser(champ.nom, e.target.value)}
        />
      )}

      {champ.type === 'texte' && (
        <textarea
          className="lil-input"
          rows={3}
          maxLength={champ.max ?? 400}
          value={typeof valeur === 'string' ? valeur : ''}
          onChange={(e) => poser(champ.nom, e.target.value)}
        />
      )}
    </div>
  );
}
