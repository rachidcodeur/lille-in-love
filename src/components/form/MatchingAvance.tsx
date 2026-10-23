'use client';

import { BLOCS, conditionRemplie, type ChampMatching } from '@/lib/matching';

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
 * Le consentement se donne en tête, avant la première question : on sait
 * à quoi on s'engage avant de commencer, et plus rien ne s'ouvre ni ne se
 * ferme en cours de route. Les deux sujets que la loi dit sensibles —
 * origines, religion — prennent donc leur place dans le fil comme les
 * autres. Le serveur les écarte de toute façon sans la case.
 */
export function MatchingAvance({
  valeurs,
  onChange,
  manques = [],
}: {
  valeurs: BrouillonMatching;
  onChange: (valeurs: BrouillonMatching) => void;
  /** Les champs restés vides à l'envoi : signalés là où ils sont. */
  manques?: string[];
}) {
  const poser = (nom: string, valeur: unknown) => onChange({ ...valeurs, [nom]: valeur });

  return (
    <div className="lil-matching">
      {BLOCS.map((bloc) => (
        <fieldset className="lil-matching-bloc" key={bloc.id}>
          <legend>{bloc.titre}</legend>
          {bloc.intro && <p className="lil-field-help">{bloc.intro}</p>}
          {bloc.champs
            .filter((champ) => conditionRemplie(champ, valeurs))
            .map((champ) => (
              <Champ
                key={champ.nom}
                champ={champ}
                valeur={valeurs[champ.nom]}
                poser={poser}
                manque={manques.includes(champ.nom)}
              />
            ))}
        </fieldset>
      ))}
    </div>
  );
}

function Champ({
  champ,
  valeur,
  poser,
  manque = false,
}: {
  champ: ChampMatching;
  valeur: unknown;
  poser: (nom: string, valeur: unknown) => void;
  manque?: boolean;
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
    <div
      className="lil-matching-champ"
      data-nom={champ.nom}
      data-manque={manque ? true : undefined}
    >
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
