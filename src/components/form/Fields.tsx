'use client';

import type { Field } from '@/lib/questions';

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
