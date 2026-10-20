'use client';

import { useEffect, useState } from 'react';
import type { Field } from '@/lib/questions';
import { MatchingAvance, type BrouillonMatching } from './MatchingAvance';
import { PartagerInscription } from './PartagerInscription';

/** Les mois en toutes lettres : « 09 » se retient mal, « septembre » non. */
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export type Values = Record<string, unknown>;
export type Errors = Record<string, string>;

type FieldProps = {
  field: Field;
  value: unknown;
  error?: string;
  onChange: (name: string, value: unknown) => void;
  /** Appelé quand un choix unique doit enchaîner sur l'étape suivante. */
  onAdvance?: () => void;
};

function ErrorLine({ id, message }: { id: string; message: string }) {
  return (
    <p className="lil-error" id={id} role="alert">
      <span aria-hidden="true">↳</span>
      <span>{message}</span>
    </p>
  );
}

/** Compteur de caractères, affiché seulement quand la limite approche. */
function Counter({ length, max }: { length: number; max: number }) {
  if (length < max * 0.7) return null;
  return (
    <span className="lil-counter" data-over={length > max}>
      {length} / {max}
    </span>
  );
}

/**
 * La date de naissance, en trois cases.
 *
 * Un sélecteur de date ouvre un calendrier sur aujourd'hui et oblige à
 * remonter de 1990 au doigt, mois par mois. Plusieurs personnes s'y sont
 * arrêtées. On tape le jour et l'année ; seul le mois, qui se mémorise
 * mal en chiffres, reste une liste.
 *
 * Les trois morceaux vivent ici, et non dans la valeur du formulaire.
 * C'était l'erreur de la première version : elle recomposait une date à
 * chaque frappe, et « 1 » tapé dans l'année devenait « 0001 » sous les
 * doigts. On laisse écrire, et on ne compose que lorsque les trois cases
 * tiennent debout.
 */
function ChampNaissance({
  field,
  value,
  error,
  onChange,
  label,
}: Pick<FieldProps, 'field' | 'value' | 'error' | 'onChange'> & { label: React.ReactNode }) {
  const errorId = `${field.name}-error`;
  const depuisIso = (v: unknown) => {
    const m = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-') : null;
    return m ? { jour: String(Number(m[2])), mois: m[1]!, annee: m[0]! } : { jour: '', mois: '', annee: '' };
  };

  const [parts, setParts] = useState(() => depuisIso(value));

  // Le brouillon restauré au rechargement arrive par la valeur : on se
  // recale dessus, sans écraser ce qu'on est en train de taper.
  useEffect(() => {
    const venu = depuisIso(value);
    if (!venu.annee) return;
    setParts((avant) =>
      avant.jour || avant.mois || avant.annee ? avant : venu,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const poser = (suite: { jour: string; mois: string; annee: string }) => {
    setParts(suite);
    const { jour, mois, annee } = suite;
    // Rien ne remonte tant que la date n'est pas complète : une date à
    // moitié écrite n'est pas une date, et la valider ferait clignoter
    // une erreur dès le premier chiffre de l'année.
    const complete = jour && mois && annee.length === 4;
    onChange(
      field.name,
      complete ? `${annee}-${mois}-${jour.padStart(2, '0')}` : '',
    );
  };

  const chiffres = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

  return (
    <div>
      {label}
      <div className="lil-naissance">
        <input
          id={field.name}
          className="lil-input lil-naissance-jour"
          type="text"
          inputMode="numeric"
          autoComplete="bday-day"
          placeholder="Ex : 01"
          aria-label="Jour de naissance"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={parts.jour}
          onChange={(e) => poser({ ...parts, jour: chiffres(e.target.value, 2) })}
        />
        <select
          className="lil-input lil-naissance-mois"
          autoComplete="bday-month"
          aria-label="Mois de naissance"
          aria-invalid={Boolean(error)}
          value={parts.mois}
          onChange={(e) => poser({ ...parts, mois: e.target.value })}
        >
          {/* « hidden » et non une entrée ordinaire : la liste déroulée
              commence donc à janvier, comme demandé, mais rien n'est
              choisi tant qu'on n'a pas choisi. Sans cela, quelqu'un né en
              mars qui ne touche pas au champ enverrait janvier. */}
          <option value="" hidden>
            Mois
          </option>
          {MOIS.map((nom, i) => (
            <option key={nom} value={String(i + 1).padStart(2, '0')}>
              {nom}
            </option>
          ))}
        </select>
        <input
          className="lil-input lil-naissance-annee"
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder="Ex : 1993"
          aria-label="Année de naissance"
          aria-invalid={Boolean(error)}
          value={parts.annee}
          onChange={(e) => poser({ ...parts, annee: chiffres(e.target.value, 4) })}
        />
      </div>
      {field.help && <p className="lil-field-help">{field.help}</p>}
      {error && <ErrorLine id={errorId} message={error} />}
    </div>
  );
}

/**
 * Depuis combien de temps, en mois ou en années.
 *
 * Quatre tranches toutes faites mettaient « huit mois » et « sept ans »
 * dans le même panier, et obligeaient à arrondir une réponse qu'on
 * connaît précisément. On écrit le nombre, on choisit l'unité.
 *
 * Reste un cas qu'aucun nombre ne dit : n'avoir jamais été en couple.
 * Il a son propre bouton, et il efface la durée — les deux réponses
 * s'excluent.
 */
function ChampCelibat({
  field,
  value,
  error,
  onChange,
  label,
}: Pick<FieldProps, 'field' | 'value' | 'error' | 'onChange'> & { label: React.ReactNode }) {
  const errorId = `${field.name}-error`;
  const brut = typeof value === 'string' ? value : '';
  const jamais = brut === 'jamais';
  const [nombre = '', unite = 'mois'] = jamais || !brut ? ['', 'mois'] : brut.split('_');

  const poser = (n: string, u: string) =>
    onChange(field.name, n ? `${n}_${u}` : '');

  return (
    <div>
      {label}
      <div className="lil-celibat">
        <input
          id={field.name}
          className="lil-input lil-celibat-nombre"
          type="text"
          inputMode="numeric"
          placeholder="Ex : 8"
          aria-label="Depuis combien de temps"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={nombre}
          onChange={(e) => poser(e.target.value.replace(/\D/g, '').slice(0, 2), unite)}
        />
        <select
          className="lil-input lil-celibat-unite"
          aria-label="Mois ou années"
          value={unite}
          onChange={(e) => poser(nombre, e.target.value)}
        >
          <option value="mois">mois</option>
          <option value="ans">ans</option>
        </select>
      </div>

      <button
        type="button"
        className="lil-choice lil-celibat-jamais"
        role="radio"
        aria-checked={jamais}
        onClick={() => onChange(field.name, jamais ? '' : 'jamais')}
      >
        <span className="lil-choice-mark" aria-hidden="true" />
        <span>Je n’ai jamais été en couple</span>
      </button>

      {field.help && <p className="lil-field-help">{field.help}</p>}
      {error && <ErrorLine id={errorId} message={error} />}
    </div>
  );
}

export function FieldControl({ field, value, error, onChange, onAdvance }: FieldProps) {
  const errorId = `${field.name}-error`;
  const describedBy = error ? errorId : undefined;

  const label = field.label ? (
    <label className="lil-field-label" htmlFor={field.name}>
      {field.label}
      {field.facultatif && <span className="lil-facultatif">(facultatif)</span>}
    </label>
  ) : null;

  switch (field.type) {
    /* ---- Choix unique ------------------------------------------- */
    case 'radio':
      return (
        <div>
          {label}
          <div className="lil-choices" role="radiogroup" aria-labelledby={field.name}>
            {field.options?.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={value === option.value}
                className="lil-choice"
                onClick={() => {
                  onChange(field.name, option.value);
                  if (field.advanceOnSelect && onAdvance) {
                    // Laisse voir la sélection avant de tourner la page.
                    window.setTimeout(onAdvance, 260);
                  }
                }}
              >
                <span className="lil-choice-mark" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          {error && <ErrorLine id={errorId} message={error} />}
        </div>
      );

    /* ---- Choix multiple ----------------------------------------- */
    case 'multi': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          {label}
          <div className="lil-chips">
            {field.options?.map((option) => {
              const isOn = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isOn}
                  className="lil-chip"
                  onClick={() =>
                    onChange(
                      field.name,
                      isOn
                        ? selected.filter((v) => v !== option.value)
                        : [...selected, option.value],
                    )
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {error && <ErrorLine id={errorId} message={error} />}
        </div>
      );
    }

    /* ---- Liste déroulante --------------------------------------- */
    case 'select':
      return (
        <div>
          {label}
          <select
            id={field.name}
            name={field.name}
            className="lil-select"
            value={(value as string) ?? ''}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => onChange(field.name, event.target.value)}
          >
            <option value="">{field.placeholder ?? 'Choisis une réponse'}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.help && <p className="lil-field-help">{field.help}</p>}
          {error && <ErrorLine id={errorId} message={error} />}
        </div>
      );

    /* ---- Texte long --------------------------------------------- */
    case 'textarea': {
      const text = (value as string) ?? '';
      return (
        <div>
          {label}
          <textarea
            id={field.name}
            name={field.name}
            className="lil-textarea"
            placeholder={field.placeholder}
            value={text}
            maxLength={field.maxLength}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => onChange(field.name, event.target.value)}
          />
          {field.maxLength && <Counter length={text.length} max={field.maxLength} />}
          {field.help && <p className="lil-field-help">{field.help}</p>}
          {error && <ErrorLine id={errorId} message={error} />}
        </div>
      );
    }

    /* ---- Le lien à envoyer à qui l'on amène ---------------------- */
    case 'partage':
      return <PartagerInscription />;

    /* ---- Depuis combien de temps célibataire --------------------- */
    case 'celibat':
      return (
        <ChampCelibat
          field={field}
          value={value}
          error={error}
          onChange={onChange}
          label={label}
        />
      );

    /* ---- Date de naissance, en trois cases ----------------------- */
    case 'naissance':
      return (
        <ChampNaissance
          field={field}
          value={value}
          error={error}
          onChange={onChange}
          label={label}
        />
      );

    /* ---- Le formulaire avancé, d'un seul tenant ------------------ */
    case 'matching':
      return (
        <MatchingAvance
          valeurs={(value ?? {}) as BrouillonMatching}
          onChange={(v) => onChange(field.name, v)}
        />
      );

    /* ---- Consentement ------------------------------------------- */
    case 'consent':
      return (
        <div>
          <label className="lil-consent">
            <input
              type="checkbox"
              name={field.name}
              checked={value === true}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              onChange={(event) => onChange(field.name, event.target.checked)}
            />
            {/* Le libellé contient les liens vers le règlement et la politique
                de confidentialité : il est défini dans questions.ts, pas saisi
                par un utilisateur. */}
            <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
          </label>
          {error && <ErrorLine id={errorId} message={error} />}
        </div>
      );

    /* ---- Champs de saisie simples ------------------------------- */
    default: {
      const inputType =
        field.type === 'number'
          ? 'text' // on gère nous-mêmes : évite les flèches et le scroll accidentel
          : field.type === 'date'
            ? 'date'
            : field.type === 'email'
              ? 'email'
              : field.type === 'tel'
                ? 'tel'
                : 'text';

      // Personne de moins de 18 ans ne peut s'inscrire : la borne est posée
      // dans le sélecteur lui-même, pas seulement dans le message d'erreur.
      const maxDate =
        field.type === 'date'
          ? new Date(Date.now() - 18 * 365.25 * 86_400_000).toISOString().slice(0, 10)
          : undefined;

      return (
        <div>
          {label}
          <input
            id={field.name}
            name={field.name}
            type={inputType}
            className="lil-input"
            placeholder={field.placeholder}
            value={(value as string) ?? ''}
            maxLength={field.maxLength}
            max={maxDate}
            min={field.type === 'date' ? '1925-01-01' : undefined}
            inputMode={field.inputMode}
            autoComplete={field.autoComplete}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => {
              const next =
                field.type === 'number'
                  ? event.target.value.replace(/[^\d]/g, '')
                  : event.target.value;
              onChange(field.name, next);
            }}
          />
          {field.help && <p className="lil-field-help">{field.help}</p>}
          {error && <ErrorLine id={errorId} message={error} />}
        </div>
      );
    }
  }
}
