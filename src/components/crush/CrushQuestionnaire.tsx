'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  QUESTIONS,
  SECTIONS,
  remplies,
  type Question,
  type Reponses,
} from '@/lib/questionnaire';

/**
 * Le questionnaire de fin de soirée.
 *
 * Il prend la place des profils une fois les crush times terminés : c'est
 * le seul moment où tout le monde a encore son téléphone en main et la
 * soirée en tête. Un formulaire envoyé le lendemain ne revient pas.
 *
 * Trois sections plutôt qu'une page de quinze questions : debout, dans une
 * salle qui se vide, une liste qui n'en finit pas se ferme. Et ce qui est
 * répondu part à chaque passage de section — un téléphone rangé en route
 * ne doit rien faire recommencer.
 *
 * Tout est facultatif, et le bouton d'envoi est là dès la première
 * section. Une réponse arrachée ne vaut rien, et « Mes matchs » reste en
 * haut : personne n'est pris en otage par un questionnaire.
 */
export function CrushQuestionnaire({
  reponsesInitiales,
  dejaEnvoye,
}: {
  reponsesInitiales: Reponses;
  dejaEnvoye: boolean;
}) {
  const [reponses, setReponses] = useState<Reponses>(reponsesInitiales);
  const [section, setSection] = useState(0);
  const [envoye, setEnvoye] = useState(dejaEnvoye);
  const [occupe, setOccupe] = useState(false);
  const [souci, setSouci] = useState<string | null>(null);
  const haut = useRef<HTMLDivElement>(null);

  const enregistrer = useCallback(async (valeurs: Reponses, envoyer: boolean) => {
    const r = await fetch('/api/crush/questionnaire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reponses: valeurs, envoyer }),
    }).catch(() => null);
    return Boolean(r?.ok);
  }, []);

  // Le brouillon part aussi quand on quitte l'application en cours de
  // route : c'est le moment où l'on perdait tout.
  useEffect(() => {
    const ranger = () => {
      if (envoye) return;
      navigator.sendBeacon?.(
        '/api/crush/questionnaire',
        new Blob([JSON.stringify({ reponses, envoyer: false })], { type: 'application/json' }),
      );
    };
    document.addEventListener('visibilitychange', ranger);
    return () => document.removeEventListener('visibilitychange', ranger);
  }, [reponses, envoye]);

  const repondre = (id: string, valeur: Reponses[string]) =>
    setReponses((avant) => ({ ...avant, [id]: valeur }));

  async function suivante() {
    setOccupe(true);
    await enregistrer(reponses, false);
    setOccupe(false);
    setSection((s) => s + 1);
    haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function envoyer() {
    setOccupe(true);
    setSouci(null);
    const ok = await enregistrer(reponses, true);
    setOccupe(false);
    if (!ok) return setSouci('L’envoi n’a pas abouti. Réessaie dans un instant.');
    setEnvoye(true);
  }

  if (envoye) {
    return (
      <div className="cr-quiz cr-quiz-merci">
        <p className="cr-quiz-coeur" aria-hidden="true">
          ♥
        </p>
        <h2 className="cr-attente-mot">Merci pour ton retour.</h2>
        <p className="cr-texte">
          Tes réponses nous aideront à préparer les prochaines soirées. On espère que tu repars
          avec de beaux souvenirs… et peut-être l’envie de revoir quelqu’un.
        </p>
      </div>
    );
  }

  const courante = SECTIONS[section];
  const derniere = section === SECTIONS.length - 1;
  const faites = remplies(reponses);

  return (
    <div className="cr-quiz" ref={haut}>
      <p className="cr-quiz-chapeau">
        {courante.numero} / {courante.nom.toUpperCase()}
      </p>
      <h2 className="cr-quiz-titre">{courante.titre}</h2>

      {section === 0 && (
        <p className="cr-texte cr-quiz-intro">
          Avec ou sans crush, ton avis compte. Dis-nous ce que tu as aimé et ce qu’on pourrait
          améliorer. Rien n’est obligatoire.
        </p>
      )}

      {/* Où l'on en est, sans compte à rebours ni pression. */}
      <div className="cr-quiz-jauge" aria-hidden="true">
        <span style={{ width: `${(faites / QUESTIONS.length) * 100}%` }} />
      </div>
      <p className="cr-quiz-avancee">
        {faites} question{faites > 1 ? 's' : ''} sur {QUESTIONS.length}
      </p>

      {courante.questions.map((question) => (
        <Bloc
          key={question.id}
          question={question}
          reponses={reponses}
          repondre={repondre}
        />
      ))}

      {souci && (
        <p className="cr-souci" role="alert">
          {souci}
        </p>
      )}

      <div className="cr-quiz-pied">
        {!derniere && (
          <button type="button" className="cr-bouton" disabled={occupe} onClick={suivante}>
            {occupe ? 'Un instant…' : 'Continuer'}
          </button>
        )}
        <button
          type="button"
          className={derniere ? 'cr-bouton cr-coeur' : 'cr-passer'}
          disabled={occupe}
          onClick={envoyer}
        >
          {derniere ? 'Envoyer mes réponses' : 'Envoyer tout de suite'}
        </button>
      </div>
    </div>
  );
}

/** Une question, du type qu'elle annonce. */
function Bloc({
  question,
  reponses,
  repondre,
}: {
  question: Question;
  reponses: Reponses;
  repondre: (id: string, valeur: Reponses[string]) => void;
}) {
  const valeur = reponses[question.id];
  const choisies = Array.isArray(valeur) ? valeur : [];

  const basculer = (option: string) => {
    // « Rien de particulier » annule le reste, et réciproquement : une
    // réponse qui se contredit ne s'exploite pas.
    if (question.exclusive === option) {
      return repondre(question.id, choisies.includes(option) ? [] : [option]);
    }
    const sansExclusive = choisies.filter((v) => v !== question.exclusive);
    if (sansExclusive.includes(option)) {
      return repondre(question.id, sansExclusive.filter((v) => v !== option));
    }
    if (question.max && sansExclusive.length >= question.max) return;
    repondre(question.id, [...sansExclusive, option]);
  };

  const precisionOuverte =
    question.precision &&
    (!question.precision.siOption || choisies.includes(question.precision.siOption));
  const intervalleOuvert =
    question.intervalle && choisies.includes(question.intervalle.siOption);

  return (
    // Un groupe plutôt qu'un « fieldset » : la « legend » native se pose à
    // cheval sur la bordure du haut, et le filet de séparation lui passait
    // au travers. On garde le regroupement pour les lecteurs d'écran.
    <div className="cr-quiz-bloc" role="group" aria-labelledby={`${question.id}-titre`}>
      <p className="cr-quiz-legende" id={`${question.id}-titre`}>
        <span className="cr-quiz-num">{question.numero}</span>
        {question.intitule}
      </p>
      {question.aide && <p className="cr-quiz-aide">{question.aide}</p>}

      {question.type === 'unique' && (
        <div className="cr-quiz-choix">
          {question.options?.map((o) => (
            <button
              key={o.valeur}
              type="button"
              className="cr-quiz-option"
              data-coche={valeur === o.valeur || undefined}
              aria-pressed={valeur === o.valeur}
              onClick={() => repondre(question.id, valeur === o.valeur ? null : o.valeur)}
            >
              {o.libelle}
            </button>
          ))}
        </div>
      )}

      {question.type === 'multiple' && (
        <div className="cr-quiz-choix">
          {question.options?.map((o) => {
            const coche = choisies.includes(o.valeur);
            const plein =
              !coche &&
              Boolean(question.max) &&
              choisies.filter((v) => v !== question.exclusive).length >= (question.max ?? 0) &&
              question.exclusive !== o.valeur;
            return (
              <button
                key={o.valeur}
                type="button"
                className="cr-quiz-option"
                data-coche={coche || undefined}
                data-plein={plein || undefined}
                aria-pressed={coche}
                onClick={() => basculer(o.valeur)}
              >
                {o.libelle}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'note' && (
        <div className="cr-quiz-notes">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              className="cr-quiz-note"
              data-coche={valeur === n || undefined}
              aria-pressed={valeur === n}
              onClick={() => repondre(question.id, valeur === n ? null : n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {question.type === 'texte' && (
        <textarea
          className="cr-quiz-texte"
          rows={4}
          maxLength={1000}
          value={typeof valeur === 'string' ? valeur : ''}
          onChange={(e) => repondre(question.id, e.target.value)}
        />
      )}

      {precisionOuverte && question.precision && (
        <input
          type="text"
          className="cr-quiz-ligne"
          placeholder={question.precision.libelle}
          aria-label={question.precision.libelle}
          maxLength={500}
          value={
            typeof reponses[question.precision.id] === 'string'
              ? (reponses[question.precision.id] as string)
              : ''
          }
          onChange={(e) => repondre(question.precision!.id, e.target.value)}
        />
      )}

      {intervalleOuvert && question.intervalle && (
        <p className="cr-quiz-intervalle">
          de
          <input
            type="number"
            inputMode="numeric"
            min={18}
            max={99}
            aria-label="Âge minimum"
            value={nombreOuVide(reponses[`${question.intervalle.id}_de`])}
            onChange={(e) =>
              repondre(`${question.intervalle!.id}_de`, enNombre(e.target.value))
            }
          />
          à
          <input
            type="number"
            inputMode="numeric"
            min={18}
            max={99}
            aria-label="Âge maximum"
            value={nombreOuVide(reponses[`${question.intervalle.id}_a`])}
            onChange={(e) => repondre(`${question.intervalle!.id}_a`, enNombre(e.target.value))}
          />
          ans
        </p>
      )}
    </div>
  );
}

const nombreOuVide = (v: Reponses[string]) => (typeof v === 'number' ? String(v) : '');
const enNombre = (v: string) => (v === '' ? null : Number(v));
