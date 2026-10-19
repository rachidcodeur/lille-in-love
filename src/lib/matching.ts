/**
 * Le formulaire de matching sur mesure.
 *
 * Proposé après la dernière question de l'inscription, à qui le veut.
 * Celui qui refuse envoie sa candidature comme avant ; celui qui accepte
 * voit cette série-là, d'un seul tenant et non en étapes : on n'est plus
 * en train de convaincre quelqu'un de s'inscrire, il a déjà dit oui, et
 * découper vingt questions en vingt écrans ne ferait que l'épuiser.
 *
 * Tout y est facultatif. Le service est un bonus ; une question sans
 * réponse n'empêche personne d'être mis en relation.
 *
 * ---------------------------------------------------------------------
 * Deux sujets demandent une précaution particulière.
 *
 * Les origines et la religion sont des « données sensibles » au sens de
 * l'article 9 du RGPD, au même titre que la santé ou les opinions
 * politiques. Les recueillir est licite, mais seulement sur consentement
 * explicite et distinct (art. 9.2.a) : d'où la case à cocher qui ouvre
 * ces deux blocs, et la date qu'on garde avec.
 *
 * La nationalité, elle, n'est pas une donnée sensible : c'est une donnée
 * personnelle ordinaire, qu'on traite comme la ville ou le métier.
 *
 * Les intitulés sont écrits en conséquence : on demande des préférences,
 * jamais une appartenance qu'on irait ensuite imposer à quelqu'un
 * d'autre, et « peu importe » figure en tête de chaque liste — c'est la
 * réponse la plus probable, elle doit être la plus facile à donner.
 * ---------------------------------------------------------------------
 */

export type ChampMatching = {
  /** La clé sous laquelle la réponse est rangée dans le JSON. */
  nom: string;
  libelle: string;
  aide?: string;
  type: 'radio' | 'cases' | 'texte' | 'ligne';
  options?: { valeur: string; libelle: string }[];
  /** Sur « cases » et « texte » : la longueur ou le nombre acceptés. */
  max?: number;
  /** Une option qui annule les autres, comme « aucune préférence ». */
  exclusive?: string;
  /** Ne s'affiche, et ne s'enregistre, qu'avec le consentement coché. */
  sensible?: boolean;
};

export type BlocMatching = {
  id: string;
  titre: string;
  intro?: string;
  /** Le bloc entier dépend du consentement aux données sensibles. */
  sensible?: boolean;
  champs: ChampMatching[];
};

const OUI_NON = [
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non' },
];

/** « Peu importe » en tête : c'est la réponse la plus fréquente. */
const PEU_IMPORTE = [
  { valeur: 'peu_importe', libelle: 'Peu importe' },
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non' },
];

export const BLOCS: BlocMatching[] = [
  {
    id: 'enfants',
    titre: 'Les enfants',
    champs: [
      { nom: 'enfants', libelle: 'As-tu des enfants ?', type: 'radio', options: OUI_NON },
      {
        nom: 'veutEnfants',
        libelle: 'Veux-tu des enfants ?',
        type: 'radio',
        options: [
          { valeur: 'oui', libelle: 'Oui' },
          { valeur: 'non', libelle: 'Non' },
          { valeur: 'sais_pas', libelle: 'Je ne sais pas encore' },
        ],
      },
      {
        nom: 'partenaireEnfants',
        libelle: 'Un partenaire qui a déjà des enfants ?',
        type: 'radio',
        options: PEU_IMPORTE,
      },
    ],
  },
  {
    id: 'parcours',
    titre: 'Ton parcours',
    champs: [
      {
        nom: 'etudes',
        libelle: 'Niveau d’études',
        type: 'radio',
        options: [
          { valeur: 'sans_diplome', libelle: 'Sans diplôme' },
          { valeur: 'cap_bep', libelle: 'CAP / BEP' },
          { valeur: 'bac', libelle: 'Bac' },
          { valeur: 'bac_2_3', libelle: 'Bac +2 / +3' },
          { valeur: 'bac_5', libelle: 'Bac +5' },
          { valeur: 'doctorat', libelle: 'Doctorat' },
        ],
      },
      {
        nom: 'nationalite',
        libelle: 'Nationalité',
        type: 'ligne',
        max: 80,
      },
    ],
  },
  {
    id: 'origines',
    titre: 'Culture et origines',
    sensible: true,
    champs: [
      {
        nom: 'origines',
        libelle: 'Tes origines culturelles',
        aide: 'Comme tu les décrirais toi-même. Facultatif.',
        type: 'ligne',
        max: 120,
        sensible: true,
      },
      {
        nom: 'originesRecherchees',
        libelle: 'As-tu des préférences culturelles pour ton partenaire ?',
        aide: 'Plusieurs réponses possibles. La plupart des gens cochent « aucune préférence ».',
        type: 'cases',
        exclusive: 'aucune',
        sensible: true,
        options: [
          { valeur: 'aucune', libelle: 'Aucune préférence' },
          { valeur: 'europeenne', libelle: 'Européenne' },
          { valeur: 'africaine', libelle: 'Africaine' },
          { valeur: 'maghrebine', libelle: 'Maghrébine' },
          { valeur: 'latino', libelle: 'Latino-américaine' },
          { valeur: 'asiatique', libelle: 'Asiatique' },
          { valeur: 'moyen_orient', libelle: 'Moyen-Orient' },
          { valeur: 'autre', libelle: 'Autre' },
        ],
      },
    ],
  },
  {
    id: 'religion',
    titre: 'La religion',
    sensible: true,
    champs: [
      {
        nom: 'religionImportance',
        libelle: 'La religion est-elle importante pour toi ?',
        type: 'radio',
        sensible: true,
        options: [
          { valeur: 'tres', libelle: 'Très importante' },
          { valeur: 'un_peu', libelle: 'Un peu' },
          { valeur: 'pas', libelle: 'Pas du tout' },
        ],
      },
      {
        nom: 'religionPartenaire',
        libelle: 'Souhaites-tu un partenaire d’une religion particulière ?',
        type: 'radio',
        sensible: true,
        options: PEU_IMPORTE,
      },
      {
        nom: 'religionLaquelle',
        libelle: 'Si oui, laquelle ?',
        type: 'ligne',
        max: 80,
        sensible: true,
      },
    ],
  },
  {
    id: 'ideal',
    titre: 'Ton partenaire idéal',
    intro: 'En quelques mots, sans te censurer.',
    champs: [
      {
        nom: 'physiqueIdeal',
        libelle: 'Physiquement',
        aide: 'Taille, cheveux, allure… ce à quoi tu es sensible.',
        type: 'texte',
        max: 500,
      },
      {
        nom: 'mentalIdeal',
        libelle: 'Et dans sa façon d’être',
        type: 'texte',
        max: 500,
      },
      {
        nom: 'qualitesRecherchees',
        libelle: 'Les qualités que tu recherches',
        type: 'texte',
        max: 400,
      },
      {
        nom: 'qualitesPossedees',
        libelle: 'Les qualités que tu possèdes',
        type: 'texte',
        max: 400,
      },
    ],
  },
  {
    id: 'toi',
    titre: 'Toi, en quelques mots',
    champs: [
      { nom: 'personnalite', libelle: 'Décris ta personnalité', type: 'texte', max: 600 },
      {
        nom: 'passions',
        libelle: 'As-tu des passions ? Lesquelles ?',
        type: 'texte',
        max: 400,
      },
    ],
  },
  {
    id: 'habitudes',
    titre: 'Vos habitudes',
    intro: 'Ce qui se partage au quotidien, et qui compte plus qu’on ne croit.',
    champs: [
      { nom: 'sport', libelle: 'Fais-tu du sport ?', type: 'radio', options: OUI_NON },
      {
        nom: 'sportPartenaire',
        libelle: 'Souhaites-tu un partenaire sportif ?',
        type: 'radio',
        options: PEU_IMPORTE,
      },
      {
        nom: 'alcool',
        libelle: 'Bois-tu de l’alcool ?',
        type: 'radio',
        options: [
          { valeur: 'jamais', libelle: 'Jamais' },
          { valeur: 'occasionnellement', libelle: 'Occasionnellement' },
          { valeur: 'regulierement', libelle: 'Régulièrement' },
        ],
      },
      {
        nom: 'alcoolPartenaire',
        libelle: 'Que ton partenaire en boive te dérange-t-il ?',
        type: 'radio',
        options: PEU_IMPORTE,
      },
      { nom: 'cigarette', libelle: 'Fumes-tu ?', type: 'radio', options: OUI_NON },
      {
        nom: 'cigarettePartenaire',
        libelle: 'Souhaites-tu un partenaire qui fume ?',
        type: 'radio',
        options: PEU_IMPORTE,
      },
      {
        nom: 'alimentation',
        libelle: 'Tes préférences alimentaires',
        aide: 'Végétarien, halal, casher, sans gluten, rien de particulier…',
        type: 'ligne',
        max: 120,
      },
      {
        nom: 'alimentationPartenaire',
        libelle: 'As-tu des exigences sur celles de ton partenaire ?',
        type: 'radio',
        options: PEU_IMPORTE,
      },
      {
        nom: 'animaux',
        libelle: 'As-tu un animal de compagnie ?',
        type: 'radio',
        options: OUI_NON,
      },
      {
        nom: 'animauxPartenaire',
        libelle: 'Cela te dérangerait-il que ton partenaire en ait ?',
        type: 'radio',
        options: PEU_IMPORTE,
      },
    ],
  },
];

/** Tous les champs, à plat. */
export const CHAMPS: ChampMatching[] = BLOCS.flatMap((b) => b.champs);

export type ReponsesMatching = Record<string, string | string[]>;

/**
 * Ce qu'on accepte d'écrire.
 *
 * Les réponses viennent d'un navigateur : on ne garde que les champs
 * qu'on connaît, les options qu'on a proposées, et des textes bornés.
 *
 * Sans consentement, les champs sensibles tombent — y compris si le
 * navigateur les envoie quand même. C'est la seule garantie qui tienne :
 * une case décochée à l'écran ne prouve rien côté serveur.
 */
export function nettoyerMatching(brut: unknown, consentement: boolean): ReponsesMatching {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {};
  const entrant = brut as Record<string, unknown>;
  const propre: ReponsesMatching = {};

  for (const champ of CHAMPS) {
    if (champ.sensible && !consentement) continue;
    const valeur = entrant[champ.nom];
    const connues = new Set((champ.options ?? []).map((o) => o.valeur));

    if (champ.type === 'radio') {
      if (typeof valeur === 'string' && connues.has(valeur)) propre[champ.nom] = valeur;
    }

    if (champ.type === 'cases' && Array.isArray(valeur)) {
      let choix = [...new Set(valeur.filter((v): v is string => typeof v === 'string' && connues.has(v)))];
      if (champ.exclusive && choix.includes(champ.exclusive)) choix = [champ.exclusive];
      else if (champ.max) choix = choix.slice(0, champ.max);
      if (choix.length > 0) propre[champ.nom] = choix;
    }

    if (champ.type === 'texte' || champ.type === 'ligne') {
      const texte = typeof valeur === 'string' ? valeur.trim().slice(0, champ.max ?? 300) : '';
      if (texte) propre[champ.nom] = texte;
    }
  }

  return propre;
}

/** Combien de champs ont reçu une réponse — de quoi jauger la fiche. */
export function remplisMatching(reponses: ReponsesMatching): number {
  return CHAMPS.filter((c) => {
    const v = reponses[c.nom];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  }).length;
}
