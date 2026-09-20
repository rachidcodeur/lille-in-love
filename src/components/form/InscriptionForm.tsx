'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BRAND } from '@/lib/brand';
import {
  HONEYPOT_FIELDS,
  stepsFor,
  type Field,
  type FormVersion,
  type Step,
} from '@/lib/questions';
import { FieldControl, type Errors, type Values } from './Fields';
import { PhotoUpload, type UploadedPhoto } from './PhotoUpload';
import { Entete } from './Entete';

/** Un brouillon par parcours : le court et le complet ne se mélangent pas. */
const draftKey = (version: FormVersion) => `lil-inscription-draft-v1-${version}`;

const INITIAL: Values = {
  interests: [],
  photos: [],
  consent: false,
};

/** Un champ conditionnel n'existe que si sa condition est remplie. */
function isVisible(field: Field, values: Values): boolean {
  if (!field.showIf) return true;
  const current = values[field.showIf.field];
  if (Array.isArray(current)) return current.includes(field.showIf.equals as string);
  return current === field.showIf.equals;
}

/**
 * Validation d'une étape, côté navigateur.
 *
 * Elle double celle du serveur (src/lib/validation.ts) : ici c'est du confort,
 * là-bas c'est la règle. Les messages sont volontairement identiques pour que
 * l'expérience soit la même si une requête passe outre.
 */
function validateStep(step: Step, values: Values): Errors {
  const errors: Errors = {};

  for (const field of step.fields) {
    if (!isVisible(field, values)) continue;

    const value = values[field.name];

    if (field.type === 'photos') {
      const photos = (value as UploadedPhoto[]) ?? [];
      const ready = photos.filter((p) => p.status === 'pret');
      if (ready.length === 0) {
        errors[field.name] = photos.some((p) => p.status === 'envoi')
          ? 'Patiente une seconde, l’envoi se termine.'
          : 'Ajoute au moins une photo.';
      }
      continue;
    }

    if (field.type === 'multi') {
      if (field.required && (!Array.isArray(value) || value.length === 0)) {
        errors[field.name] = 'Choisis au moins une réponse.';
      }
      continue;
    }

    if (field.type === 'consent') {
      if (field.required && value !== true) {
        errors[field.name] = 'Il faut accepter le règlement pour continuer.';
      }
      continue;
    }

    const text = typeof value === 'string' ? value.trim() : '';

    if (field.required && !text) {
      errors[field.name] =
        field.type === 'radio' || field.type === 'select'
          ? 'Choisis une réponse.'
          : 'Ce champ est nécessaire.';
      continue;
    }

    if (!text) continue; // facultatif et vide : rien à vérifier

    if (field.minLength && text.length < field.minLength) {
      errors[field.name] = `Encore un peu — ${field.minLength} caractères au minimum.`;
    } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
      errors[field.name] = 'Cet email ne semble pas valide.';
    } else if (field.type === 'tel' && !/^(?:\+?\d[\d\s.\-()]{7,20})$/.test(text)) {
      errors[field.name] = 'Ce numéro ne semble pas valide.';
    } else if (field.name === 'postalCode' && !/^\d{5}$/.test(text)) {
      errors[field.name] = 'Un code postal a 5 chiffres.';
    } else if (field.type === 'number') {
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) errors[field.name] = 'Indique un nombre.';
      else if (field.min !== undefined && parsed < field.min)
        errors[field.name] = `Au moins ${field.min}.`;
      else if (field.max !== undefined && parsed > field.max)
        errors[field.name] = `Au plus ${field.max}.`;
    } else if (field.type === 'date') {
      const age = ageFrom(text);
      if (age === null) errors[field.name] = 'Cette date n’existe pas.';
      else if (age < 18) errors[field.name] = 'Nos soirées sont réservées aux majeurs.';
      else if (age > 99) errors[field.name] = 'Cette date ne semble pas juste.';
    }
  }

  return errors;
}

function ageFrom(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [unknown, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  const hadBirthday =
    now.getUTCMonth() + 1 > m || (now.getUTCMonth() + 1 === m && now.getUTCDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

type Props = {
  /** Origine de l'API. Vide quand le formulaire est servi par la même app. */
  apiBase?: string;
  /** « court » pour le parcours réduit, « complet » pour les 16 étapes. */
  version?: FormVersion;
};

export default function InscriptionForm({ apiBase = '', version = 'complet' }: Props) {
  const STEPS = useMemo(() => stepsFor(version), [version]);
  const DRAFT_KEY = draftKey(version);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [done, setDone] = useState<{ firstName: string; already: boolean } | null>(null);

  const startedAt = useRef(Date.now());
  const rootRef = useRef<HTMLDivElement>(null);
  const step = STEPS[index]!;
  const isLast = index === STEPS.length - 1;

  // Un choix unique enchaîne sur l'étape suivante via un setTimeout : à ce
  // moment-là, la fonction capturée date du rendu précédent et ne verrait pas
  // la réponse qu'on vient de cocher. On lit donc toujours l'état courant ici.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const indexRef = useRef(index);
  indexRef.current = index;
  const stepsRef = useRef(STEPS);
  stepsRef.current = STEPS;

  /* --- Brouillon : on ne perd pas 15 minutes de réponses ------------ */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          values?: Values;
          index?: number;
          startedAt?: number;
        };
        // On reprend l'heure d'ouverture d'origine. Sinon, quelqu'un qui
        // revient finir son formulaire paraîtrait l'avoir rempli en quelques
        // secondes, et le serveur le prendrait pour un robot.
        if (typeof parsed.startedAt === 'number' && parsed.startedAt <= Date.now()) {
          startedAt.current = parsed.startedAt;
        }
        if (parsed.values) setValues({ ...INITIAL, ...parsed.values, photos: [] });
        // On ne restaure pas l'étape des photos : elles ne sont pas persistées.
        if (typeof parsed.index === 'number') {
          // Les photos ne sont pas conservées : on ne renvoie jamais la
          // personne au-delà de l'étape qui les demande.
          const photoStep = STEPS.findIndex((step) => step.id === 'photos');
          const ceiling = photoStep >= 0 ? photoStep : STEPS.length - 1;
          setIndex(Math.max(0, Math.min(parsed.index, ceiling)));
        }
      }
    } catch {
      // localStorage indisponible (navigation privée) : tant pis, on continue.
    }
  }, []);

  useEffect(() => {
    if (done) return;
    try {
      const { photos: _photos, ...persistable } = values;
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ values: persistable, index, startedAt: startedAt.current }),
      );
    } catch {
      /* ignoré */
    }
  }, [values, index, done]);

  /* --- Hauteur communiquée à la page WordPress ---------------------- */
  useEffect(() => {
    const node = rootRef.current;
    if (!node || window.parent === window) return;

    const publish = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      window.parent.postMessage({ type: 'lil:height', height }, '*');
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => observer.disconnect();
  }, [index, done, errors, values]);

  /* --- Remonter en haut de l'iframe à chaque étape ------------------ */
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'lil:step', index }, '*');
    }
    rootRef.current?.querySelector<HTMLElement>('input, textarea, select')?.focus({
      preventScroll: true,
    });
  }, [index]);

  const setValue = useCallback((name: string, value: unknown) => {
    // La ref est mise à jour tout de suite : ce qui lit l'état hors rendu
    // (avance automatique, envoi) voit la réponse sans attendre React.
    valuesRef.current = { ...valuesRef.current, [name]: value };
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => {
      if (!previous[name]) return previous;
      const { [name]: _removed, ...rest } = previous;
      return rest;
    });
  }, []);

  const goBack = () => {
    setErrors({});
    setIndex((i) => Math.max(0, i - 1));
  };

  const goNext = useCallback(() => {
    const steps = stepsRef.current;
    const stepErrors = validateStep(steps[indexRef.current]!, valuesRef.current);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  }, []);

  async function submit() {
    const stepErrors = validateStep(step, valuesRef.current);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setSubmitting(true);
    setGlobalError(null);

    const photos = ((values.photos as UploadedPhoto[]) ?? [])
      .filter((p) => p.status === 'pret' && p.path)
      .map((p) => ({ path: p.path!, mimeType: p.mimeType, sizeBytes: p.sizeBytes }));

    // Une étape qui porte une mention remplace la case à cocher : l'envoi
    // vaut acceptation.
    const consentementImplicite = STEPS.some((etape) => Boolean(etape.mention));

    const payload = {
      ...values,
      consent: consentementImplicite ? true : values.consent === true,
      formVersion: version,
      photos,
      ...(version === 'complet' ? { heightCm: Number(values.heightCm) } : {}),
      elapsedMs: Date.now() - startedAt.current,
      source: window.parent !== window ? document.referrer || 'iframe' : window.location.href,
      ...Object.fromEntries(HONEYPOT_FIELDS.map((name) => [name, values[name] ?? ''])),
    };

    try {
      const response = await fetch(`${apiBase}/api/inscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        fieldErrors?: Errors;
        firstName?: string;
        alreadyRegistered?: boolean;
      };

      if (!response.ok) {
        if (result.fieldErrors) {
          // Ramener la personne sur la première étape qui pose problème.
          const faulty = Object.keys(result.fieldErrors)[0];
          const target = STEPS.findIndex((step) =>
            step.fields.some((field) => field.name === faulty),
          );
          if (target >= 0) setIndex(target);
          setErrors(result.fieldErrors);
        }
        setGlobalError(result.error ?? 'Quelque chose a coincé. Réessaie.');
        setSubmitting(false);
        return;
      }

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignoré */
      }

      setDone({
        firstName: result.firstName ?? (values.firstName as string) ?? '',
        already: Boolean(result.alreadyRegistered),
      });
    } catch {
      setGlobalError(
        'On n’arrive pas à joindre le serveur. Vérifie ta connexion et réessaie.',
      );
      setSubmitting(false);
    }
  }

  const progress = useMemo(
    () => Math.round(((done ? STEPS.length : index) / STEPS.length) * 100),
    [index, done],
  );

  /* --- Écran de fin ------------------------------------------------- */
  if (done) {
    return (
      <div className="lil-shell" ref={rootRef}>
        <Entete />
        <div className="lil-card">
          <div className="lil-done lil-step">
            <div className="lil-done-seal" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 12.5l5 5L20 6.5"
                  stroke="#A8946E"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {done.already ? (
              <>
                <h2 className="lil-done-title">On t’a déjà, {done.firstName}</h2>
                <p className="lil-done-text">
                  Tu as déjà rempli le questionnaire avec cet email — pas besoin de
                  recommencer. Ta candidature est bien dans nos mains.
                </p>
              </>
            ) : (
              <>
                <h2 className="lil-done-title">C’est envoyé, {done.firstName}</h2>
                <p className="lil-done-text">
                  On vient de t’écrire pour confirmer. Chez nous, pas d’algorithme : on lit
                  chaque profil à la main. C’est plus lent, mais c’est exactement ce qui fait
                  que les soirées se passent bien.
                </p>
                <p className="lil-done-text">
                  On revient vers toi très vite. D’ici là, tu n’as rien à faire.
                </p>
              </>
            )}

            <p className="lil-done-note">
              Rien reçu&nbsp;? Regarde dans tes spams, ou écris-nous à{' '}
              <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* --- Formulaire --------------------------------------------------- */
  return (
    <div className="lil-shell" ref={rootRef}>
      <Entete />
      <form
        className="lil-card"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (isLast) void submit();
          else goNext();
        }}
      >
        <div className="lil-progress">
          <div className="lil-progress-track">
            <div
              className="lil-progress-bar"
              style={{ width: `${Math.max(progress, 4)}%` }}
              role="progressbar"
              aria-valuenow={index + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-label="Progression du questionnaire"
            />
          </div>
          <span className="lil-progress-count">
            {index + 1} / {STEPS.length}
          </span>
        </div>

        {globalError && (
          <div className="lil-alert" role="alert">
            {globalError}
          </div>
        )}

        <div className="lil-step" key={step.id}>
          {step.section && <p className="lil-eyebrow">{step.section}</p>}
          <h2 className="lil-question">
            {step.number && (
              <span className="lil-question-numero" aria-hidden="true">
                {step.number}
              </span>
            )}
            {step.title}
            {step.facultatif && <span className="lil-facultatif">(facultatif)</span>}
          </h2>
          {step.help && <p className="lil-help">{step.help}</p>}
          {step.note && <p className="lil-note">{step.note}</p>}

          <div className="lil-fields">
            {step.fields.filter((field) => isVisible(field, values)).map((field) =>
              field.type === 'photos' ? (
                <PhotoUpload
                  key={field.name}
                  apiBase={apiBase}
                  max={field.max ?? 3}
                  photos={(values.photos as UploadedPhoto[]) ?? []}
                  error={errors[field.name]}
                  onChange={(photos) => setValue('photos', photos)}
                />
              ) : (
                <FieldControl
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  error={errors[field.name]}
                  onChange={setValue}
                  onAdvance={isLast ? undefined : goNext}
                />
              ),
            )}
          </div>
        </div>

        {/* Pièges anti-robot : invisibles, et retirés du parcours au clavier. */}
        <div className="lil-trap" aria-hidden="true">
          {HONEYPOT_FIELDS.map((name) => (
            <input
              key={name}
              type="text"
              name={name}
              tabIndex={-1}
              autoComplete="off"
              value={(values[name] as string) ?? ''}
              onChange={(event) => setValue(name, event.target.value)}
            />
          ))}
        </div>

        <div className="lil-nav">
          {index > 0 && (
            <button type="button" className="lil-btn lil-btn-ghost" onClick={goBack}>
              Précédent
            </button>
          )}
          <button type="submit" className="lil-btn lil-btn-primary" disabled={submitting}>
            {submitting ? 'Envoi…' : isLast ? 'Envoyer ma candidature' : 'Suivant'}
          </button>
        </div>

        {step.mention && (
          <p
            className="lil-mention"
            // Le texte vient de questions.ts, pas d'une saisie utilisateur.
            dangerouslySetInnerHTML={{ __html: step.mention }}
          />
        )}

      </form>
    </div>
  );
}
