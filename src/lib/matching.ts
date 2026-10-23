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
  /**
   * Ne s'affiche que si un champ voisin porte cette réponse. « Précise »
   * n'a de sens qu'après avoir coché « Autre » ; affiché tout le temps,
   * il demande de préciser quelque chose qu'on n'a pas dit.
   */
  siOption?: { champ: string; vaut: string };
};

/** La réponse voisine est-elle celle qu'on attend ? */
export function conditionRemplie(
  champ: ChampMatching,
  reponses: Record<string, unknown>,
): boolean {
  if (!champ.siOption) return true;
  const valeur = reponses[champ.siOption.champ];
  return Array.isArray(valeur)
    ? valeur.includes(champ.siOption.vaut)
    : valeur === champ.siOption.vaut;
}

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
        libelle: 'Désires-tu rencontrer quelqu’un qui a déjà des enfants ?',
        type: 'radio',
        options: PEU_IMPORTE,
      },
    ],
  },
  {
    id: 'situation',
    titre: 'Ta situation',
    champs: [
      {
        nom: 'situationMaritale',
        libelle: 'Ta situation maritale',
        type: 'radio',
        options: [
          { valeur: 'celibataire', libelle: 'Célibataire' },
          { valeur: 'divorce', libelle: 'Divorcé(e) ou séparé(e)' },
          { valeur: 'instance_divorce', libelle: 'En instance de divorce' },
          { valeur: 'veuf', libelle: 'Veuf / Veuve' },
          { valeur: 'pacse', libelle: 'Pacsé(e)' },
          { valeur: 'marie', libelle: 'Marié(e)' },
          { valeur: 'concubinage', libelle: 'En concubinage' },
        ],
      },
      {
        nom: 'typeRelation',
        libelle: 'Quel type de relation cherches-tu ?',
        aide: 'Plusieurs réponses possibles.',
        type: 'cases',
        options: [
          { valeur: 'mariage', libelle: 'Mariage' },
          { valeur: 'pacs', libelle: 'PACS' },
          { valeur: 'union_libre', libelle: 'Union libre' },
          { valeur: 'relation_libre', libelle: 'Relation libre' },
          { valeur: 'non_exclusif', libelle: 'Couple non exclusif' },
        ],
      },
    ],
  },
  {
    id: 'parcours',
    titre: 'Ton parcours professionnel',
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
          { valeur: 'en_formation', libelle: 'En cours de formation' },
        ],
      },
      {
        nom: 'situationPro',
        libelle: 'Ta situation professionnelle',
        type: 'radio',
        options: [
          { valeur: 'salarie', libelle: 'Salarié(e)' },
          { valeur: 'entrepreneur', libelle: 'Entrepreneur(e)' },
          { valeur: 'independant', libelle: 'Indépendant(e)' },
          { valeur: 'fonctionnaire', libelle: 'Fonctionnaire' },
          { valeur: 'etudiant', libelle: 'Étudiant(e) ou en formation' },
          { valeur: 'recherche', libelle: 'En recherche' },
          { valeur: 'retraite', libelle: 'Retraité(e)' },
          { valeur: 'autre', libelle: 'Autre' },
        ],
      },
      {
        nom: 'situationProAutre',
        libelle: 'Précise',
        type: 'ligne',
        max: 120,
        siOption: { champ: 'situationPro', vaut: 'autre' },
      },
      { nom: 'nationalite', libelle: 'Nationalité', type: 'ligne', max: 80 },
    ],
  },
  {
    id: 'origines',
    titre: 'Culture et origines',
    champs: [
      {
        nom: 'origines',
        libelle: 'Tes origines culturelles',
        aide: 'Comme tu les décrirais toi-même.',
        type: 'ligne',
        max: 120,
        sensible: true,
      },
      {
        nom: 'originesRecherchees',
        libelle: 'Des préférences culturelles pour la personne que tu rencontreras ?',
        aide: 'Plusieurs réponses possibles.',
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
      {
        nom: 'originesAutre',
        libelle: 'Précise',
        type: 'ligne',
        max: 120,
        sensible: true,
        siOption: { champ: 'originesRecherchees', vaut: 'autre' },
      },
    ],
  },
  {
    id: 'religion',
    titre: 'La religion',
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
        libelle: 'Désires-tu rencontrer quelqu’un d’une religion particulière ?',
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
    titre: 'La personne que tu cherches',
    champs: [
      {
        nom: 'physiqueIdeal',
        libelle: 'Physiquement, à quoi es-tu sensible ?',
        aide: 'Taille, allure, cheveux… sans te censurer.',
        type: 'texte',
        max: 500,
      },
      {
        nom: 'qualitesRecherchees',
        libelle: 'Et dans son caractère ?',
        aide: 'Les qualités qui comptent vraiment pour toi.',
        type: 'texte',
        max: 500,
      },
    ],
  },
  {
    id: 'toi',
    titre: 'Ton style de vie',
    champs: [
      {
        nom: 'personnalite',
        libelle: 'Décris-nous ton style de vie',
        aide: 'Tes journées, tes week-ends, ce qui te ressemble.',
        type: 'texte',
        max: 600,
      },
      {
        nom: 'passions',
        libelle: 'Tes passions',
        type: 'ligne',
        max: 200,
      },
      {
        nom: 'sorties',
        libelle: 'Quel genre de sorties aimes-tu ?',
        aide: 'Plusieurs réponses possibles.',
        type: 'cases',
        options: [
          { valeur: 'restaurant', libelle: 'Restaurant' },
          { valeur: 'bar', libelle: 'Bar, afterwork' },
          { valeur: 'concert', libelle: 'Concerts, festivals' },
          { valeur: 'culture', libelle: 'Musées, expos, théâtre' },
          { valeur: 'cinema', libelle: 'Cinéma' },
          { valeur: 'club', libelle: 'Clubs, soirées dansantes' },
          { valeur: 'nature', libelle: 'Balades, nature' },
          { valeur: 'sport_sortie', libelle: 'Sport, activités' },
          { valeur: 'maison', libelle: 'Soirées à la maison' },
        ],
      },
      {
        nom: 'restaurants',
        libelle: 'Tes restaurants préférés',
        aide: 'Plusieurs réponses possibles — pour savoir où vous emmener.',
        type: 'cases',
        // Des enseignes plutôt que des catégories : « rapide et sans
        // façon » ne dit pas la même chose à tout le monde, « McDonald's »
        // si. Il n'y a rien de vulgaire à nommer ce que les gens mangent.
        options: [
          { valeur: 'rapide', libelle: 'Fast-food (McDonald’s, Burger King…)' },
          { valeur: 'pizza_burger', libelle: 'Pizzeria, burgers, tacos' },
          { valeur: 'bistrot', libelle: 'Brasserie, bistrot de quartier' },
          { valeur: 'monde', libelle: 'Cuisine du monde (asiatique, libanais, italien…)' },
          { valeur: 'gastro', libelle: 'Gastronomique, belles tables' },
          { valeur: 'etoile', libelle: 'Étoilé, grande cuisine' },
          { valeur: 'vege', libelle: 'Végétarien, healthy' },
        ],
      },
    ],
  },
  {
    id: 'voyages',
    titre: 'Les voyages',
    champs: [
      {
        nom: 'voyagesParAn',
        libelle: 'Combien de fois voyages-tu par an ?',
        type: 'radio',
        options: [
          { valeur: 'jamais', libelle: 'Jamais' },
          { valeur: 'une', libelle: 'Une fois' },
          { valeur: 'deux_trois', libelle: 'Deux ou trois fois' },
          { valeur: 'plus', libelle: 'Plus que ça' },
        ],
      },
      {
        nom: 'destinations',
        libelle: 'Tes destinations, ou celles dont tu rêves',
        type: 'ligne',
        max: 200,
      },
      {
        nom: 'typeVoyage',
        libelle: 'Quel type de voyage aimes-tu ?',
        aide: 'Plusieurs réponses possibles.',
        type: 'cases',
        options: [
          { valeur: 'farniente', libelle: 'Farniente, plage' },
          { valeur: 'city', libelle: 'City-break' },
          { valeur: 'aventure', libelle: 'Aventure, road-trip' },
          { valeur: 'nature_voyage', libelle: 'Nature, randonnée' },
          { valeur: 'culturel', libelle: 'Culturel' },
          { valeur: 'luxe', libelle: 'Confort, hôtels' },
          { valeur: 'autre', libelle: 'Autre' },
        ],
      },
      {
        nom: 'typeVoyageAutre',
        libelle: 'Précise',
        type: 'ligne',
        max: 120,
        siOption: { champ: 'typeVoyage', vaut: 'autre' },
      },
    ],
  },
  {
    id: 'habitudes',
    titre: 'Tes habitudes',
    intro: 'Ce qui se partage au quotidien, et qui compte plus qu’on ne croit.',
    champs: [
      { nom: 'sport', libelle: 'Fais-tu du sport ?', type: 'radio', options: OUI_NON },
      {
        nom: 'sportPartenaire',
        libelle: 'Désires-tu rencontrer quelqu’un de sportif ?',
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
      { nom: 'cigarette', libelle: 'Fumes-tu ?', type: 'radio', options: OUI_NON },
      {
        nom: 'cigarettePartenaire',
        libelle: 'Désires-tu rencontrer quelqu’un qui fume ?',
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
        libelle: 'Des exigences sur celles de la personne que tu rencontreras ?',
        type: 'radio',
        options: PEU_IMPORTE,
      },
      { nom: 'animaux', libelle: 'As-tu un animal de compagnie ?', type: 'radio', options: OUI_NON },
      {
        nom: 'animauxLequel',
        libelle: 'Si oui, lequel ?',
        type: 'ligne',
        max: 120,
        siOption: { champ: 'animaux', vaut: 'oui' },
      },
      {
        nom: 'animauxPartenaire',
        libelle: 'Cela te dérangerait-il qu’elle en ait ?',
        type: 'radio',
        options: PEU_IMPORTE,
      },
    ],
  },
];

/**
 * Ce qui reste sans réponse.
 *
 * Le service est entièrement facultatif — on peut dire « Non merci » et
 * ne rien perdre. Mais une fois qu'on a dit oui, répondre à moitié ne
 * sert personne : on cherche sur ce qu'on nous donne, et un profil
 * à trois réponses ne se cherche pas. D'où ces questions obligatoires
 * dans un service qui, lui, ne l'est pas.
 *
 * Les « Précise » n'y échappent que tant que leur case n'est pas cochée.
 */
export function champsManquants(valeurs: Record<string, unknown>): string[] {
  const manque: string[] = [];
  for (const champ of CHAMPS) {
    if (!conditionRemplie(champ, valeurs)) continue;
    const valeur = valeurs[champ.nom];
    const vide = Array.isArray(valeur)
      ? valeur.length === 0
      : typeof valeur === 'string'
        ? valeur.trim() === ''
        : valeur === undefined || valeur === null;
    if (vide) manque.push(champ.nom);
  }
  return manque;
}

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
    // « Précise » sans la case qui l'ouvre : la réponse ne veut rien
    // dire, et elle n'a rien à faire en base.
    if (!conditionRemplie(champ, propre)) continue;
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
