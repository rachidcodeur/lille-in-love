import { z } from 'zod';
import { INTERESTS, REFERRALS, ZODIAC } from './questions';

const values = (opts: { value: string }[]) => opts.map((o) => o.value) as [string, ...string[]];

/**
 * Espaces en trop enlevés.
 * `.trim()` de Zod renvoie bien un ZodString : on peut continuer à chaîner
 * `.min()`, `.regex()` derrière, contrairement à un `.transform()`.
 */
const trimmed = z.string().trim();

/** Champ facultatif : une chaîne vide vaut « non renseigné ». */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/**
 * Le formulaire tel qu'il arrive du navigateur.
 * Rien n'est fait confiance : le client peut mentir sur tout.
 */
export const inscriptionSchema = z
  .object({
    formVersion: z.literal('complet').optional(),

    gender: z.enum(['femme', 'homme']),

    city: trimmed.min(1, 'Indique ta ville').max(80),
    postalCode: trimmed.regex(/^\d{5}$/, 'Code postal à 5 chiffres'),

    orientation: z.enum(['hetero', 'gay']),
    hasChildren: z.enum(['oui', 'non']),
    lookingFor: z.enum(['relation_serieuse', 'bons_moments']),

    heightCm: z.coerce
      .number()
      .int('Une taille en centimètres, sans virgule')
      .min(120, 'Taille invalide')
      .max(230, 'Taille invalide'),

    // Aucune longueur minimale : on préfère deux mots sincères à un
    // paragraphe écrit pour atteindre un quota.
    about: trimmed.min(1, 'Dis-nous un mot').max(600, 'Un peu plus court, si tu veux bien'),
    motivation: trimmed.min(1, 'Dis-nous un mot').max(600, 'Un peu plus court, si tu veux bien'),

    interests: z
      .array(z.enum(values(INTERESTS)))
      .min(1, 'Choisis au moins un centre d’intérêt')
      .max(INTERESTS.length),
    interestsOther: optionalText(120),

    zodiac: z.enum(values(ZODIAC)).optional(),
    profession: trimmed.min(1, 'Indique ta profession').max(120),
    instagram: optionalText(60),

    comesWith: z.enum(['oui', 'non']),
    companionFirstName: optionalText(60),
    // Plus demandé par le formulaire ; toléré pour ne pas casser un envoi
    // qui viendrait d'une page en cache.
    companionEmail: z.string().trim().email('Email invalide').max(180).optional().or(z.literal('')),

    referral: z.enum(values(REFERRALS)),

    firstName: trimmed.min(1, 'Indique ton prénom').max(60),
    lastName: trimmed.min(1, 'Indique ton nom, au moins ses trois premières lettres').max(60),
    phone: trimmed
      // 10 chiffres français, ou format international — on reste tolérant sur la ponctuation
      .regex(/^(?:\+?\d[\d\s.\-()]{7,20})$/, 'Numéro de téléphone invalide'),
    email: z.string().trim().toLowerCase().email('Email invalide').max(180),

    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format jj/mm/aaaa'),

    consent: z.literal(true, {
      errorMap: () => ({ message: 'Il faut accepter le règlement pour continuer' }),
    }),

    /** Chemins renvoyés par /api/upload, pas les fichiers eux-mêmes. */
    photos: z
      .array(
        z.object({
          path: z.string().min(1).max(300),
          mimeType: z.string().max(80).optional(),
          sizeBytes: z.number().int().nonnegative().optional(),
        }),
      )
      .min(1, 'Ajoute au moins une photo')
      .max(3, '3 photos maximum'),

    /** Anti-robot — voir HONEYPOT_FIELDS. */
    lil_ref_url: z.string().max(0).optional(),
    lil_extra_1: z.string().max(0).optional(),
    lil_extra_2: z.string().max(0).optional(),

    /** Millisecondes écoulées depuis l'ouverture du formulaire. */
    elapsedMs: z.number().int().nonnegative().optional(),

    source: optionalText(200),
  })
  .superRefine((data, ctx) => {
    // « Autre » coché sans précision : on veut savoir quoi.
    if (data.interests.includes('autre') && !data.interestsOther) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['interestsOther'],
        message: 'Précise ce centre d’intérêt',
      });
    }

    const age = ageFromBirthDate(data.birthDate);
    if (age === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['birthDate'], message: 'Date invalide' });
    } else if (age < 18) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['birthDate'],
        message: 'Nos soirées sont réservées aux majeurs',
      });
    } else if (age > 99) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['birthDate'], message: 'Date invalide' });
    }
  });

export type InscriptionInput = z.infer<typeof inscriptionSchema>;

/* ====================================================================
   Parcours court
   ==================================================================== */

/**
 * Le formulaire court : sexe, prénom, nom, email, photos, consentement.
 *
 * Les pièges anti-robot et la mesure du temps de remplissage sont les mêmes
 * que sur le formulaire complet — un parcours plus court n'est pas une raison
 * de baisser la garde.
 */
export const inscriptionCourteSchema = z.object({
  formVersion: z.literal('court'),

  gender: z.enum(['femme', 'homme']),
  firstName: trimmed.min(1, 'Indique ton prénom').max(60),
  lastName: trimmed.min(1, 'Indique ton nom, au moins ses trois premières lettres').max(60),
  email: z.string().trim().toLowerCase().email('Email invalide').max(180),

  consent: z.literal(true, {
    errorMap: () => ({ message: 'Il faut accepter le règlement pour continuer' }),
  }),

  photos: z
    .array(
      z.object({
        path: z.string().min(1).max(300),
        mimeType: z.string().max(80).optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1, 'Ajoute au moins une photo')
    .max(3, '3 photos maximum'),

  lil_ref_url: z.string().max(0).optional(),
  lil_extra_1: z.string().max(0).optional(),
  lil_extra_2: z.string().max(0).optional(),

  elapsedMs: z.number().int().nonnegative().optional(),
  source: optionalText(200),
});

export type InscriptionCourteInput = z.infer<typeof inscriptionCourteSchema>;



/** Âge révolu, ou null si la date n'existe pas (31/02 et compagnie). */
export function ageFromBirthDate(iso: string): number | null {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  const hadBirthday =
    now.getUTCMonth() + 1 > m || (now.getUTCMonth() + 1 === m && now.getUTCDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

/** Numéro normalisé en E.164 quand c'est un numéro français reconnaissable. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^0\d{9}$/.test(digits)) return `+33${digits.slice(1)}`;
  if (/^33\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}

/** « @Compte » et les URLs complètes ramenés à un simple pseudo. */
export function normalizeInstagram(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const handle = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/^@/, '')
    .split(/[/?]/)[0];
  return handle ? `@${handle}` : undefined;
}
