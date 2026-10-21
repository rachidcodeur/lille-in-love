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

  /** L'espace de curation. Il vit sur le sous-domaine, pas sur le site. */
  adminUrl: 'https://app.in-love.fr',
  /**
   * Le domaine du crush time. Vide en local et en préproduction : les liens
   * se construisent alors sur l'adresse qu'on a sous les yeux, ce qui les
   * rend cliquables partout sans réglage.
   */
  crushUrl: process.env.NEXT_PUBLIC_CRUSH_URL ?? '',

  /**
   * Le pixel Meta des campagnes publicitaires.
   *
   * Ce n'est pas un secret — il est lisible dans la page de n'importe quel
   * site qui l'utilise. Il reste réglable par variable d'environnement pour
   * pouvoir couper le suivi sans toucher au code.
   */
  pixelId: process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? '2145139243054242',
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
  // Neutre : ni tranche d'âge, ni ville. Chaque personne est orientée vers la
  // soirée qui lui correspond une fois sa candidature lue.
  titre: 'Soirée célibataires',
  precision: 'La date et le lieu seront communiqués aux membres inscrits.',
  reperes: ['Profils sélectionnés', 'Lieu privatisé'],
  // Plus de prix dans l'en-tête : il variera d'une soirée à l'autre, et
  // l'annoncer avant même de savoir à laquelle la personne ira revenait à
  // s'engager sur un chiffre qu'on ne maîtrise pas. Il se dit avec la date
  // et le lieu, une fois la candidature retenue.
} as const;
