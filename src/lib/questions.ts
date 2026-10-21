import { BRAND } from './brand';

/**
 * Le questionnaire, décrit une seule fois.
 *
 * Le rendu (src/components/form) et la validation serveur (src/lib/validation.ts)
 * se lisent tous les deux ici : ajouter une question, c'est éditer ce fichier
 * puis le schéma Zod correspondant, rien d'autre.
 *
 * Ordre et intitulés repris du formulaire Tally « Inscription Lille in Love ».
 */

export type FieldType =
  | 'radio'
  | 'multi'
  | 'select'
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'naissance'
  | 'celibat'
  | 'partage'
  | 'matching'
  | 'photos'
  | 'consent';

export type Option = { value: string; label: string; hint?: string };

export type Field = {
  name: string;
  type: FieldType;
  label?: string;
  placeholder?: string;
  help?: string;
  /** Affiche « (facultatif) » à côté du libellé — visible, pas enfoui dans l'aide. */
  facultatif?: boolean;
  required?: boolean;
  options?: Option[];
  min?: number;
  max?: number;
  maxLength?: number;
  minLength?: number;
  /** Champ affiché seulement si la condition est vraie. */
  showIf?: { field: string; equals: string | boolean };
  /** Sur un radio : passe à l'étape suivante dès le clic. */
  advanceOnSelect?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
};

export type Step = {
  id: string;
  /** Numéro affiché, tel qu'il l'était sur Tally. */
  number?: string;
  section?: string;
  title: string;
  /** Une étape entière facultative : « (facultatif) » suit la question. */
  facultatif?: boolean;
  help?: string;
  /** Précision en petits caractères, sous l'aide. */
  note?: string;
  /**
   * Mention affichée sous les boutons, en petits caractères.
   * Sert au consentement implicite : quand une étape en porte une, envoyer
   * le formulaire vaut acceptation — pas besoin d'une case à cocher.
   */
  mention?: string;
  fields: Field[];
};

export const INTERESTS: Option[] = [
  { value: 'culture', label: 'Culture & spectacles' },
  { value: 'voyages', label: 'Voyages & découvertes' },
  { value: 'sorties', label: 'Sorties & fêtes' },
  { value: 'sport', label: 'Sport & bien-être' },
  { value: 'jeux_tech', label: 'Jeux & tech' },
  { value: 'creation', label: 'Création & DIY' },
  { value: 'nature', label: 'Nature & animaux' },
  { value: 'cuisine', label: 'Cuisine & gastronomie' },
  { value: 'autre', label: 'Autre' },
];

/** Remis dans l'ordre du calendrier — la liste Tally était mélangée. */
export const ZODIAC: Option[] = [
  { value: 'belier', label: 'Bélier' },
  { value: 'taureau', label: 'Taureau' },
  { value: 'gemeaux', label: 'Gémeaux' },
  { value: 'cancer', label: 'Cancer' },
  { value: 'lion', label: 'Lion' },
  { value: 'vierge', label: 'Vierge' },
  { value: 'balance', label: 'Balance' },
  { value: 'scorpion', label: 'Scorpion' },
  { value: 'sagittaire', label: 'Sagittaire' },
  { value: 'capricorne', label: 'Capricorne' },
  { value: 'verseau', label: 'Verseau' },
  { value: 'poissons', label: 'Poissons' },
];

export const REFERRALS: Option[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'pub_video', label: 'Une vidéo publicitaire Instagram ou Facebook' },
  { value: 'bouche_a_oreille', label: 'Le bouche-à-oreille' },
  { value: 'google', label: 'Google' },
  { value: 'chatgpt', label: 'ChatGPT ou une autre IA' },
  { value: 'affiche', label: 'Une affiche' },
  { value: 'flyer', label: 'Un flyer' },
  { value: 'autre', label: 'Autrement' },
];

const ETAPES: Step[] = [
  {
    id: 'gender',
    section: 'Profil',
    title: 'Je suis',
    fields: [
      {
        name: 'gender',
        type: 'radio',
        required: true,
        advanceOnSelect: true,
        options: [
          { value: 'femme', label: 'Une femme' },
          { value: 'homme', label: 'Un homme' },
        ],
      },
    ],
  },
  {
    id: 'location',
    section: 'Profil',
    title: 'Où habites-tu ?',
    fields: [
      {
        name: 'city',
        type: 'text',
        label: 'Ville',
        required: true,
        maxLength: 80,
        placeholder: 'Lille',
        autoComplete: 'address-level2',
      },
      {
        name: 'postalCode',
        type: 'text',
        label: 'Code postal',
        required: true,
        placeholder: '59000',
        inputMode: 'numeric',
        maxLength: 5,
        autoComplete: 'postal-code',
      },
    ],
  },
  {
    id: 'orientation',
    section: 'Profil',
    title: 'Je suis',
    fields: [
      {
        name: 'orientation',
        type: 'radio',
        required: true,
        advanceOnSelect: true,
        options: [
          { value: 'hetero', label: 'Hétéro' },
          { value: 'gay', label: 'Gay' },
        ],
      },
    ],
  },
  {
    id: 'looking-for',
    section: 'Profil',
    title: "Qu'est-ce que tu cherches ?",
    fields: [
      {
        name: 'lookingFor',
        type: 'radio',
        required: true,
        advanceOnSelect: true,
        options: [
          { value: 'relation_serieuse', label: 'Une relation sérieuse' },
          { value: 'bons_moments', label: 'Quelqu’un pour passer de bons moments' },
        ],
      },
    ],
  },
  {
    id: 'height',
    section: 'Profil',
    title: 'Quelle est ta taille ?',
    help: 'En centimètres.',
    fields: [
      {
        name: 'heightCm',
        type: 'number',
        required: true,
        min: 120,
        max: 230,
        placeholder: '175',
        inputMode: 'numeric',
      },
    ],
  },
  {
    id: 'about',
    section: 'Toi, en quelques mots',
    title: 'Raconte-toi en deux lignes',
    help: 'C’est ce qu’on lit en premier. Pas besoin de bien écrire — sois juste toi.',
    fields: [
      {
        name: 'about',
        type: 'textarea',
        required: true,
        maxLength: 600,
        placeholder: 'Ce qui te fait rire, ce que tu fais de tes dimanches, ce qui compte pour toi…',
      },
      {
        name: 'motivation',
        type: 'textarea',
        label: 'Pourquoi tu veux participer à nos soirées Lille in Love ?',
        required: true,
        maxLength: 600,
        placeholder: 'Même une phrase honnête suffit.',
      },
    ],
  },
  {
    id: 'single-since',
    section: 'Toi, en quelques mots',
    title: 'Depuis quand es-tu célibataire ?',
    // Posée ici, et non dans les premières étapes : la personne vient de
    // se raconter et de dire pourquoi elle vient. La question prolonge ce
    // qu'elle écrivait ; placée en cinquième, entre l'orientation et la
    // taille, elle tombait comme un interrogatoire.
    fields: [
      {
        // Quatre tranches ne suffisaient pas : « huit mois » et « sept
        // ans » tombaient dans le même panier. On laisse écrire le
        // nombre et choisir l'unité.
        name: 'singleSince',
        type: 'celibat',
        required: true,
      },
    ],
  },
  {
    id: 'zodiac',
    section: 'Toi, en quelques mots',
    title: 'Quel est ton signe astrologique ?',
    facultatif: true,
    help: 'Pour ceux que ça amuse.',
    fields: [
      {
        name: 'zodiac',
        type: 'select',
        options: ZODIAC,
        placeholder: 'Choisis ton signe',
      },
    ],
  },
  {
    id: 'profession',
    section: 'Toi, en quelques mots',
    title: 'Quelle est ta profession ?',
    fields: [
      {
        name: 'profession',
        type: 'text',
        required: true,
        maxLength: 120,
        placeholder: 'Ce que tu fais de tes journées',
      },
    ],
  },
  {
    id: 'instagram',
    section: 'Toi, en quelques mots',
    title: 'Ton Instagram ?',
    facultatif: true,
    help: 'On ne le partage jamais.',
    fields: [
      {
        name: 'instagram',
        type: 'text',
        maxLength: 60,
        placeholder: '@ton_compte',
      },
    ],
  },
  {
    id: 'companion',
    section: 'Toi, en quelques mots',
    title: 'Tu viens avec quelqu’un ?',
    help: 'Un ami, une amie — on essaie de vous placer sur la même soirée.',
    fields: [
      {
        name: 'comesWith',
        type: 'radio',
        required: true,
        options: [
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non, je viens seul·e' },
        ],
      },
      {
        name: 'companionFirstName',
        type: 'text',
        label: 'Son prénom',
        facultatif: true,
        maxLength: 60,
        placeholder: 'Pour lui envoyer une invitation',
        showIf: { field: 'comesWith', equals: 'oui' },
      },
      {
        // On prenait son prénom, et c'est tout : l'autre n'était au
        // courant de rien. Le lien s'affiche ici, avec de quoi le lui
        // envoyer en un geste — chacun remplit le sien.
        name: 'companionPartage',
        type: 'partage',
        showIf: { field: 'comesWith', equals: 'oui' },
      },
    ],
  },
  {
    id: 'referral',
    section: 'Toi, en quelques mots',
    title: 'Comment tu nous as connus ?',
    fields: [
      {
        name: 'referral',
        type: 'select',
        required: true,
        options: REFERRALS,
        placeholder: 'Choisis une réponse',
      },
      {
        // « Autrement » sans la suite ne nous apprend rien : c'est la
        // seule réponse dont on a besoin qu'elle soit précisée.
        name: 'referralOther',
        type: 'text',
        label: 'Par quel moyen ?',
        placeholder: 'Dis-nous en deux mots',
        maxLength: 120,
        showIf: { field: 'referral', equals: 'autre' },
      },
    ],
  },
  {
    id: 'photos',
    section: 'Photos',
    title: 'Ajoute tes meilleures photos',
    help: '1 à 3 photos de toi, visage visible. C’est dessus qu’on se choisira pendant la soirée — prends tes meilleures.',
    note: 'Ta photo pourra éventuellement être utilisée pour t’identifier lors d’un jeu pendant la soirée.',
    fields: [{ name: 'photos', type: 'photos', required: true, min: 1, max: 3 }],
  },
  {
    id: 'contact',
    section: 'Coordonnées',
    title: 'Tes coordonnées',
    fields: [
      {
        name: 'firstName',
        type: 'text',
        label: 'Prénom',
        required: true,
        maxLength: 60,
        autoComplete: 'given-name',
      },
      {
        name: 'lastName',
        type: 'text',
        label: 'Nom',
        help: 'Au minimum les trois premières lettres, si tu préfères rester discret·e.',
        required: true,
        maxLength: 60,
        autoComplete: 'family-name',
      },
      {
        name: 'phone',
        type: 'tel',
        label: 'Téléphone',
        required: true,
        placeholder: '06 12 34 56 78',
        inputMode: 'tel',
        autoComplete: 'tel',
      },
    ],
  },
  {
    id: 'final',
    section: 'Coordonnées',
    title: 'Pour finir',
    fields: [
      {
        name: 'email',
        type: 'email',
        label: 'Email',
        required: true,
        placeholder: 'ton@email.fr',
        autoComplete: 'email',
        help: 'C’est là qu’on t’écrira. Vérifie bien l’orthographe.',
      },
      {
        // Trois cases plutôt qu'un sélecteur de date : sur un téléphone,
        // remonter de 1990 au doigt dans un calendrier décourage, et
        // plusieurs personnes s'y sont arrêtées. On tape le jour et
        // l'année, on choisit le mois dans une liste.
        name: 'birthDate',
        type: 'naissance',
        label: 'Date de naissance',
        required: true,
      },
    ],
  },
];

/**
 * Le parcours court.
 *
 * Sexe, prénom, nom, email et photos : de quoi ouvrir les inscriptions et
 * éprouver toute la chaîne — enregistrement, envoi des emails, curation —
 * sans demander quinze minutes aux premiers inscrits.
 *
 * L'email est indispensable : c'est par lui que passe toute la séquence.
 * Le consentement reste demandé — on collecte un nom, un visage et une
 * adresse, formulaire court ou pas.
 */
const ETAPES_COURT: Step[] = [
  {
    id: 'gender',
    section: 'Profil',
    title: 'Je suis',
    fields: [
      {
        name: 'gender',
        type: 'radio',
        required: true,
        advanceOnSelect: true,
        options: [
          { value: 'femme', label: 'Une femme' },
          { value: 'homme', label: 'Un homme' },
        ],
      },
    ],
  },
  {
    id: 'contact',
    section: 'Coordonnées',
    title: 'Qui es-tu ?',
    fields: [
      {
        name: 'firstName',
        type: 'text',
        label: 'Prénom',
        required: true,
        maxLength: 60,
        autoComplete: 'given-name',
      },
      {
        name: 'lastName',
        type: 'text',
        label: 'Nom',
        help: 'Au minimum les trois premières lettres, si tu préfères rester discret·e.',
        required: true,
        maxLength: 60,
        autoComplete: 'family-name',
      },
      {
        name: 'email',
        type: 'email',
        label: 'Email',
        required: true,
        placeholder: 'ton@email.fr',
        autoComplete: 'email',
        help: 'C’est là qu’on t’écrira. Vérifie bien l’orthographe.',
      },
    ],
  },
  {
    id: 'photos',
    section: 'Photos',
    title: 'Ajoute tes meilleures photos',
    help: '1 à 3 photos de toi, visage visible. C’est dessus qu’on se choisira pendant la soirée — prends tes meilleures.',
    note: 'Ta photo pourra éventuellement être utilisée pour t’identifier lors d’un jeu pendant la soirée.',
    // Plus de mention ici : l'acceptation est la même pour les deux
    // parcours, dans son bloc au-dessus du formulaire. Un encadré
    // juridique au moment de choisir ses photos n'était de toute façon
    // pas le bon endroit pour être lu.
    fields: [{ name: 'photos', type: 'photos', required: true, min: 1, max: 3 }],
  },
];

/** Les deux parcours possibles. */
export type FormVersion = 'court' | 'complet';

export function stepsFor(version: FormVersion): Step[] {
  return version === 'court' ? STEPS_COURT : STEPS_COMPLET;
}

/**
 * Les champs pièges : invisibles à l'écran, un robot les remplit quand même.
 *
 * Les noms sont volontairement inhabituels. « website », « company » ou
 * « address » seraient remplis par les gestionnaires de mots de passe et les
 * remplissages automatiques du navigateur — on écarterait alors de vraies
 * personnes.
 */
export const HONEYPOT_FIELDS = ['lil_ref_url', 'lil_extra_1', 'lil_extra_2'] as const;

/**
 * En dessous de ce temps de remplissage, l'envoi est jugé inhabituel.
 *
 * La candidature est tout de même enregistrée — elle est seulement signalée
 * aux curateurs. Le formulaire court tient en trois écrans et se remplit
 * légitimement très vite : un seuil unique écartait de vrais inscrits.
 */
export const MIN_FILL_SECONDS: Record<FormVersion, number> = {
  court: 5,
  complet: 12,
};

/**
 * Les numéros affichés se calculent, ils ne s'écrivent pas.
 *
 * Ils l'étaient, repris de Tally. Retirer une question en plein milieu a
 * suffi pour que deux étapes portent le même numéro : personne ne pense à
 * renuméroter les douze suivantes, et l'écran se met à mentir.
 */
function numeroter(etapes: Step[]): Step[] {
  return etapes.map((etape, index) => ({
    ...etape,
    number: String(index + 1).padStart(2, '0'),
  }));
}

export const STEPS_COMPLET: Step[] = numeroter(ETAPES);
export const STEPS_COURT: Step[] = numeroter(ETAPES_COURT);
