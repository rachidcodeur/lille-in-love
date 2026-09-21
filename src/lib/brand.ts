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

  /** L'adresse à laquelle on nous écrit, affichée partout. */
  contactEmail: 'info@in-love.fr',

  /** Pages légales — elles vivent sur lilleinlove.fr, pas sur in-love.fr. */
  reglementUrl: 'https://lilleinlove.fr/reglement',
  confidentialiteUrl: 'https://lilleinlove.fr/confidentialite',

  /** Page qui accueille le formulaire. */
  inscriptionUrl: 'https://in-love.fr/inscription/',
} as const;

/**
 * La soirée annoncée en tête du formulaire.
 *
 * Ces lignes changeront à chaque nouvelle soirée : elles sont ici pour
 * n'avoir qu'un fichier à ouvrir, et le formulaire autonome les reprend au
 * moment où on le regénère.
 */
export const SOIREE = {
  chapeau: 'La première soirée',
  titre: 'Célibataires 27-35 ans',
  precision: 'À Lille · la date et le lieu sont communiqués aux inscrit·es.',
  reperes: ['27-35 ans', 'Profils sélectionnés', 'Lieu privatisé'],
  prix: '20 €',
  prixDetail: 'par personne',
  /** Sous le prix, en une ligne : pourquoi s'inscrire maintenant. */
  prixMention: 'Tarif exceptionnel pour cette première soirée — il augmentera pour les suivantes.',
} as const;
