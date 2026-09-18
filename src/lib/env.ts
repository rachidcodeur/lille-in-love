import { BRAND } from './brand';

/**
 * Variables d'environnement, lues une fois et vérifiées.
 *
 * On échoue au démarrage plutôt qu'au milieu d'une inscription : une clé
 * manquante doit se voir au déploiement, pas quand quelqu'un valide sa candidature.
 */

/** Un entier positif lu dans l'environnement, ou la valeur par défaut. */
function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Voir .env.example et docs/MISE-EN-ROUTE.md`,
    );
  }
  return value;
}

export const env = {
  // Un slash final collé depuis le tableau de bord Supabase donnerait des
  // URLs à double slash : on le retire une fois pour toutes.
  supabaseUrl: () => required('SUPABASE_URL').replace(/\/+$/, ''),
  supabaseServiceKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),

  resendApiKey: () => required('RESEND_API_KEY'),
  emailFrom: () => process.env.EMAIL_FROM ?? `Lille in Love <${BRAND.contactEmail}>`,
  emailReplyTo: () => process.env.EMAIL_REPLY_TO ?? BRAND.contactEmail,

  /** Sel du hachage d'IP. Sans lui, on n'enregistre simplement pas d'IP. */
  ipSalt: () => process.env.IP_HASH_SALT ?? '',

  storageBucket: () => process.env.SUPABASE_STORAGE_BUCKET ?? 'lil-photos',

  allowedEmbedOrigins: (): string[] =>
    (process.env.ALLOWED_EMBED_ORIGINS ?? 'https://in-love.fr,https://www.in-love.fr')
      .split(/[\s,]+/)
      .filter(Boolean),

  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? 'https://in-love.fr',

  isProduction: () => process.env.NODE_ENV === 'production',

  /* --- Limitation de débit ------------------------------------------- */

  /** Candidatures acceptées par heure et par adresse IP. */
  maxInscriptionsParHeure: () => positiveInt(process.env.MAX_INSCRIPTIONS_PAR_HEURE, 5),

  /** Photos acceptées par tranche de 10 minutes et par adresse IP. */
  maxPhotosParDixMinutes: () => positiveInt(process.env.MAX_PHOTOS_PAR_10MIN, 30),

  /* --- Curation ------------------------------------------------------ */

  /**
   * Nombre de voix « oui » qui valident une candidature.
   * 1 pour tester seul, 2 pour la règle réelle des deux curateurs.
   */
  votesRequis: () => positiveInt(process.env.VOTES_REQUIS, 2),

  /**
   * Délai entre une décision de curation et l'envoi de la réponse, en minutes.
   * Validation, refus ou tranche d'âge : la réponse part 24 h après (1440).
   * Quelques minutes suffisent pour un test local.
   *
   * DELAI_BIENVENUE_MINUTES est l'ancien nom, du temps où seule la bienvenue
   * attendait : il reste lu pour ne pas casser un .env existant.
   */
  delaiReponseMinutes: () => {
    const brut = process.env.DELAI_REPONSE_MINUTES ?? process.env.DELAI_BIENVENUE_MINUTES ?? '1440';
    const parsed = Number(brut);
    // Resend refuse de programmer au-delà de 30 jours.
    const max = 30 * 24 * 60;
    return Number.isFinite(parsed) && parsed >= 0 ? Math.min(Math.floor(parsed), max) : 1440;
  },

  /**
   * Code d'accès au back-office. Vide = accès libre.
   * Le remplir suffit à fermer l'interface, sans toucher au code.
   */
  adminCode: () => (process.env.ADMIN_CODE ?? '').trim(),
};
