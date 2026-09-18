/**
 * Les constantes de marque, réunies ici pour n'avoir qu'un seul endroit à
 * modifier — formulaire, emails et documentation s'y réfèrent.
 *
 * Attention aux deux domaines : le site d'inscription est sur in-love.fr,
 * mais les pages légales et l'adresse de contact publiées sont sur
 * lilleinlove.fr. Les URLs ci-dessous ont été vérifiées.
 */

export const BRAND = {
  name: 'Lille in Love',

  /** Adresse publiée sur lilleinlove.fr. */
  contactEmail: 'contact@lilleinlove.fr',

  /** Pages légales — elles vivent sur lilleinlove.fr, pas sur in-love.fr. */
  reglementUrl: 'https://lilleinlove.fr/reglement',
  confidentialiteUrl: 'https://lilleinlove.fr/confidentialite',

  /** Page qui accueille le formulaire. */
  inscriptionUrl: 'https://in-love.fr/inscription/',
} as const;
