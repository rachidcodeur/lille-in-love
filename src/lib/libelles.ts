import { INTERESTS, REFERRALS, ZODIAC } from './questions';

/**
 * Les libellés lisibles du back-office.
 *
 * La base stocke des valeurs stables (`relation_serieuse`, `en_attente_tranche`) ;
 * l'écran, lui, doit se lire en français courant.
 */

export const STATUS_LABELS: Record<string, string> = {
  tous: 'Toutes',
  nouveau: 'À examiner',
  en_examen: 'En examen',
  valide: 'Validée',
  // Ancien statut : la tranche d'âge est désormais calculée à chaque soirée.
  en_attente_tranche: 'Validée (tranche)',
  non_retenu: 'Non retenue',
};

export const STATUS_ORDER = ['tous', 'nouveau', 'en_examen', 'valide', 'non_retenu'] as const;

export const TEMPLATE_LABELS: Record<string, string> = {
  '00_alerte_interne': 'Nouvelle inscription signalée à info@in-love.fr',
  '01_candidature_recue': 'Candidature reçue',
  '02_bienvenue': 'Bienvenue dans le club',
};

export const EMAIL_STATUS_LABELS: Record<string, string> = {
  programme: 'Programmé',
  envoye: 'Envoyé',
  annule: 'Annulé',
  echec: 'Échec',
};

const LOOKING_FOR: Record<string, string> = {
  relation_serieuse: 'Une relation sérieuse',
  bons_moments: 'Passer de bons moments',
};

const ORIENTATION: Record<string, string> = { hetero: 'Hétéro', gay: 'Gay' };

// Reprise de l'ancien formulaire : le questionnaire actuel ne pose pas la
// question, mais les fiches importées portent la réponse.
const CHILDREN_PREFERENCE: Record<string, string> = {
  peu_importe: 'Peu importe',
  sans_enfants: 'Plutôt sans enfants',
  avec_enfants: 'Plutôt avec enfants',
};

const GENDER: Record<string, string> = { femme: 'Femme', homme: 'Homme' };

function fromOptions(list: { value: string; label: string }[], value: string): string {
  return list.find((option) => option.value === value)?.label ?? value;
}

export const label = {
  gender: (v: string | null) => (v ? (GENDER[v] ?? v) : null),
  orientation: (v: string | null) => (v ? (ORIENTATION[v] ?? v) : null),
  lookingFor: (v: string | null) => (v ? (LOOKING_FOR[v] ?? v) : null),
  childrenPreference: (v: string | null) => (v ? (CHILDREN_PREFERENCE[v] ?? v) : null),
  zodiac: (v: string | null) => (v ? fromOptions(ZODIAC, v) : null),
  referral: (v: string | null) => (v ? fromOptions(REFERRALS, v) : null),
  interests: (list: string[] | null) =>
    list?.length ? list.map((v) => fromOptions(INTERESTS, v)).join(', ') : null,
  status: (v: string) => STATUS_LABELS[v] ?? v,
  template: (v: string) => TEMPLATE_LABELS[v] ?? v,
};

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const DATETIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string | null): string | null {
  return iso ? DATE_FORMAT.format(new Date(iso)) : null;
}

export function formatDateTime(iso: string | null): string | null {
  return iso ? DATETIME_FORMAT.format(new Date(iso)) : null;
}

/** « il y a 3 jours », « dans 24 h » — pour situer sans lire une date. */
export function relative(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  const absolute = Math.abs(minutes);

  const formatter = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
  if (absolute < 60) return formatter.format(minutes, 'minute');
  if (absolute < 60 * 24) return formatter.format(Math.round(minutes / 60), 'hour');
  return formatter.format(Math.round(minutes / (60 * 24)), 'day');
}
