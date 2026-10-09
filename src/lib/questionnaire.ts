/**
 * Le questionnaire de fin de soirée.
 *
 * Décrit une seule fois, ici : l'écran des participants, la validation
 * côté serveur et l'export de l'hôte se lisent tous les trois dans ce
 * fichier. Ajouter une question, c'est l'écrire là et nulle part ailleurs.
 *
 * Repris mot pour mot du questionnaire papier « Lille in Love — Ton avis
 * compte », quinze questions en trois temps. Les intitulés ne sont pas
 * reformulés : quelqu'un qui a vu la feuille et qui voit l'écran doit
 * reconnaître les mêmes phrases.
 *
 * Tout est facultatif. Un questionnaire qu'on ne peut pas traverser se
 * ferme, et une réponse arrachée ne vaut rien.
 */

export type OptionQuestion = { valeur: string; libelle: string };

export type Question = {
  /** « q01 » … « q15 » : la clé sous laquelle la réponse est rangée. */
  id: string;
  numero: string;
  intitule: string;
  /** La consigne en petits caractères, quand il y en a une. */
  aide?: string;
  type: 'unique' | 'multiple' | 'note' | 'texte';
  options?: OptionQuestion[];
  /** Sur « multiple » : le nombre de cases qu'on peut cocher. */
  max?: number;
  /**
   * L'option qui annule les autres — « Rien de particulier ». La cocher
   * décoche tout le reste, et réciproquement : sans ça on récolte des
   * réponses qui se contredisent.
   */
  exclusive?: string;
  /** Un champ libre attaché, parfois ouvert par une option précise. */
  precision?: { id: string; libelle: string; siOption?: string };
  /** Sur la tranche d'âge libre : deux nombres plutôt qu'une phrase. */
  intervalle?: { id: string; libelle: string; siOption: string };
};

export type Section = {
  numero: string;
  nom: string;
  titre: string;
  questions: Question[];
};

/** Les cinq degrés de la première question, du pire au meilleur. */
const APPRECIATION: OptionQuestion[] = [
  { valeur: 'tres_decevante', libelle: 'Très décevante' },
  { valeur: 'decevante', libelle: 'Décevante' },
  { valeur: 'moyenne', libelle: 'Moyenne' },
  { valeur: 'bien', libelle: 'Bien' },
  { valeur: 'excellente', libelle: 'Excellente' },
];

export const SECTIONS: Section[] = [
  {
    numero: '01',
    nom: 'La soirée en général',
    titre: 'Ton avis sur la soirée',
    questions: [
      {
        id: 'q01',
        numero: '01',
        intitule: 'Globalement, comment as-tu trouvé la soirée ?',
        type: 'unique',
        options: APPRECIATION,
      },
      {
        id: 'q02',
        numero: '02',
        intitule: 'Qu’est-ce que tu as le plus aimé ?',
        aide: 'Choisis jusqu’à 3 réponses.',
        type: 'multiple',
        max: 3,
        options: [
          { valeur: 'ambiance', libelle: 'L’ambiance générale' },
          { valeur: 'rencontres', libelle: 'Les rencontres et les discussions' },
          { valeur: 'jeux', libelle: 'Les jeux d’équipe' },
          { valeur: 'crush_time', libelle: 'Les Crush Time et les likes discrets' },
          { valeur: 'boite_defis', libelle: 'La boîte à défis' },
          { valeur: 'surprise', libelle: 'L’événement surprise' },
          { valeur: 'lieu', libelle: 'Le lieu' },
          { valeur: 'accueil', libelle: 'L’accueil et l’équipe' },
          { valeur: 'autre', libelle: 'Autre' },
        ],
        precision: { id: 'q02_autre', libelle: 'Précise', siOption: 'autre' },
      },
      {
        id: 'q03',
        numero: '03',
        intitule: 'Qu’est-ce qu’on devrait améliorer en priorité ?',
        aide: 'Choisis jusqu’à 3 réponses.',
        type: 'multiple',
        max: 3,
        exclusive: 'rien',
        options: [
          { valeur: 'accueil', libelle: 'L’accueil et les présentations à l’arrivée' },
          { valeur: 'animations', libelle: 'Les jeux et les animations' },
          { valeur: 'temps_libre', libelle: 'Le temps disponible pour discuter librement' },
          { valeur: 'crush_time', libelle: 'Le fonctionnement des Crush Time' },
          { valeur: 'groupe', libelle: 'La composition du groupe de participants' },
          { valeur: 'lieu', libelle: 'Le lieu ou le confort' },
          { valeur: 'musique', libelle: 'Le volume de la musique' },
          { valeur: 'rythme', libelle: 'Le rythme et les horaires' },
          { valeur: 'rien', libelle: 'Rien de particulier' },
          { valeur: 'autre', libelle: 'Autre' },
        ],
        precision: { id: 'q03_autre', libelle: 'Précise', siOption: 'autre' },
      },
      {
        id: 'q04',
        numero: '04',
        intitule: 'Comment as-tu trouvé l’accueil à ton arrivée ?',
        type: 'unique',
        options: [
          { valeur: 'tres_chaleureux', libelle: 'Très chaleureux, je me suis senti(e) bien accueilli(e)' },
          { valeur: 'agreable', libelle: 'Agréable' },
          { valeur: 'moyen', libelle: 'Moyen' },
          { valeur: 'insuffisant', libelle: 'Insuffisant, j’aurais aimé être davantage accompagné(e)' },
        ],
      },
    ],
  },
  {
    numero: '02',
    nom: 'Les rencontres et les animations',
    titre: 'Ton expérience pendant la soirée',
    questions: [
      {
        id: 'q05',
        numero: '05',
        intitule: 'T’es-tu senti(e) à l’aise pour aller vers les autres ?',
        type: 'unique',
        options: [
          { valeur: 'des_le_debut', libelle: 'Oui, dès le début' },
          { valeur: 'apres_adaptation', libelle: 'Oui, après un petit temps d’adaptation' },
          { valeur: 'moyennement', libelle: 'Moyennement' },
          { valeur: 'coup_de_pouce', libelle: 'Non, j’aurais aimé un petit coup de pouce' },
        ],
      },
      {
        id: 'q06',
        numero: '06',
        intitule: 'As-tu eu suffisamment d’occasions de faire connaissance avec les autres participants ?',
        type: 'unique',
        options: [
          { valeur: 'autant_que_voulu', libelle: 'Oui, autant que je le souhaitais' },
          { valeur: 'en_partie', libelle: 'En partie, mais j’aurais aimé davantage d’échanges' },
          { valeur: 'trop_peu', libelle: 'Non, j’ai eu trop peu d’occasions de discuter' },
          { valeur: 'sais_pas', libelle: 'Je ne sais pas' },
        ],
      },
      {
        id: 'q07',
        numero: '07',
        intitule: 'As-tu rencontré des personnes avec qui tu avais des points communs ?',
        type: 'unique',
        options: [
          { valeur: 'plusieurs', libelle: 'Oui, plusieurs personnes' },
          { valeur: 'une', libelle: 'Oui, une personne' },
          { valeur: 'pas_vraiment', libelle: 'Pas vraiment' },
          { valeur: 'pas_assez_echange', libelle: 'Je n’ai pas suffisamment échangé pour le savoir' },
        ],
      },
      {
        id: 'q08',
        numero: '08',
        intitule: 'Les jeux d’équipe t’ont-ils aidé(e) à briser la glace ?',
        type: 'unique',
        options: [
          { valeur: 'beaucoup', libelle: 'Oui, beaucoup' },
          { valeur: 'un_peu', libelle: 'Oui, un peu' },
          { valeur: 'pas_vraiment', libelle: 'Pas vraiment' },
          { valeur: 'pas_du_tout', libelle: 'Pas du tout' },
          { valeur: 'pas_participe', libelle: 'Je n’y ai pas participé' },
        ],
      },
      {
        id: 'q09',
        numero: '09',
        intitule: 'Le système de likes pendant les Crush Time était-il facile à utiliser ?',
        type: 'unique',
        options: [
          { valeur: 'tres_facile', libelle: 'Très facile' },
          { valeur: 'plutot_facile', libelle: 'Plutôt facile' },
          { valeur: 'plutot_complique', libelle: 'Plutôt compliqué' },
          { valeur: 'tres_complique', libelle: 'Très compliqué' },
          { valeur: 'pas_utilise', libelle: 'Je ne l’ai pas utilisé' },
        ],
        precision: { id: 'q09_difficulte', libelle: 'Une difficulté rencontrée ? Précise-la ici.' },
      },
      {
        id: 'q10',
        numero: '10',
        intitule:
          'Comment as-tu trouvé l’équilibre entre les animations et les moments de discussion libre ?',
        type: 'unique',
        options: [
          { valeur: 'equilibre', libelle: 'Bien équilibré' },
          { valeur: 'plus_de_discussion', libelle: 'J’aurais préféré plus de temps pour discuter librement' },
          { valeur: 'plus_d_animations', libelle: 'J’aurais préféré plus d’animations' },
          { valeur: 'sans_avis', libelle: 'Sans avis' },
        ],
      },
    ],
  },
  {
    numero: '03',
    nom: 'Tes envies pour la suite',
    titre: 'Les prochaines soirées',
    questions: [
      {
        id: 'q11',
        numero: '11',
        intitule: 'Le lieu était-il adapté pour faire des rencontres et discuter ?',
        type: 'unique',
        options: [
          { valeur: 'tout_a_fait', libelle: 'Tout à fait' },
          { valeur: 'plutot_oui', libelle: 'Plutôt oui' },
          { valeur: 'plutot_non', libelle: 'Plutôt non' },
          { valeur: 'pas_du_tout', libelle: 'Pas du tout' },
        ],
        precision: { id: 'q11_gene', libelle: 'Si quelque chose t’a gêné(e), dis-le nous.' },
      },
      {
        id: 'q12',
        numero: '12',
        intitule:
          'Pour une prochaine soirée, dans quelle tranche d’âge aimerais-tu rencontrer des célibataires ?',
        aide: 'Plusieurs réponses possibles.',
        type: 'multiple',
        options: [
          { valeur: '25_35', libelle: '25–35 ans' },
          { valeur: '34_45', libelle: '34–45 ans' },
          { valeur: '44_55', libelle: '44–55 ans' },
          { valeur: '54_67', libelle: '54–67 ans' },
          { valeur: 'autre_tranche', libelle: 'Une autre tranche d’âge' },
          { valeur: 'pas_le_critere', libelle: 'L’âge n’est pas mon critère principal' },
        ],
        intervalle: { id: 'q12_tranche', libelle: 'Ta tranche', siOption: 'autre_tranche' },
      },
      {
        id: 'q13',
        numero: '13',
        intitule: 'Si tu es toujours célibataire, aurais-tu envie de revenir à une soirée Lille in Love ?',
        type: 'unique',
        options: [
          { valeur: 'avec_plaisir', libelle: 'Oui, avec plaisir !' },
          { valeur: 'probablement', libelle: 'Probablement' },
          { valeur: 'peut_etre', libelle: 'Peut-être' },
          { valeur: 'probablement_pas', libelle: 'Probablement pas' },
          { valeur: 'non', libelle: 'Non' },
        ],
      },
      {
        id: 'q14',
        numero: '14',
        intitule: 'Recommanderais-tu Lille in Love à un(e) ami(e) célibataire ?',
        aide: '0 = pas du tout · 10 = sans hésiter',
        type: 'note',
      },
      {
        id: 'q15',
        numero: '15',
        intitule: 'Une idée, une envie ou quelque chose à nous raconter ?',
        aide: 'Une animation à tester, un détail à améliorer, un moment que tu as adoré… on t’écoute.',
        type: 'texte',
      },
    ],
  },
];

/** Toutes les questions, à plat, dans l'ordre. */
export const QUESTIONS: Question[] = SECTIONS.flatMap((s) => s.questions);

export type Reponses = Record<string, string | string[] | number | null>;

/**
 * Ce qu'on accepte d'écrire en base.
 *
 * Les réponses arrivent d'un navigateur : on ne garde que les questions
 * qu'on connaît, les options qu'on a proposées, et des textes bornés. Tout
 * le reste tombe — pas d'erreur, pas de questionnaire perdu pour une clé
 * inattendue, mais rien d'inventé ne rentre.
 */
export function nettoyer(brut: unknown): Reponses {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {};
  const entrant = brut as Record<string, unknown>;
  const propre: Reponses = {};

  for (const question of QUESTIONS) {
    const valeur = entrant[question.id];
    const connues = new Set((question.options ?? []).map((o) => o.valeur));

    if (question.type === 'unique') {
      if (typeof valeur === 'string' && connues.has(valeur)) propre[question.id] = valeur;
    }

    if (question.type === 'multiple' && Array.isArray(valeur)) {
      let choix = valeur.filter((v): v is string => typeof v === 'string' && connues.has(v));
      choix = [...new Set(choix)];
      // L'option exclusive l'emporte : « Rien de particulier » coché avec
      // trois reproches est une réponse qui ne veut rien dire.
      if (question.exclusive && choix.includes(question.exclusive)) choix = [question.exclusive];
      else if (question.max) choix = choix.slice(0, question.max);
      if (choix.length > 0) propre[question.id] = choix;
    }

    if (question.type === 'note' && typeof valeur === 'number') {
      const note = Math.round(valeur);
      if (note >= 0 && note <= 10) propre[question.id] = note;
    }

    if (question.type === 'texte') {
      const texte = typeof valeur === 'string' ? valeur.trim().slice(0, 1000) : '';
      if (texte) propre[question.id] = texte;
    }

    // Les champs rattachés : un « Autre » précisé, une difficulté, une
    // tranche d'âge. Ils ne valent que si leur question les a ouverts.
    if (question.precision) {
      const ouverte =
        !question.precision.siOption ||
        (Array.isArray(propre[question.id]) &&
          (propre[question.id] as string[]).includes(question.precision.siOption));
      const texte = entrant[question.precision.id];
      const propreTexte = typeof texte === 'string' ? texte.trim().slice(0, 500) : '';
      if (ouverte && propreTexte) propre[question.precision.id] = propreTexte;
    }

    if (question.intervalle) {
      const choisie =
        Array.isArray(propre[question.id]) &&
        (propre[question.id] as string[]).includes(question.intervalle.siOption);
      const de = entrant[`${question.intervalle.id}_de`];
      const a = entrant[`${question.intervalle.id}_a`];
      if (choisie && typeof de === 'number' && typeof a === 'number') {
        const bas = Math.round(de);
        const haut = Math.round(a);
        if (bas >= 18 && haut <= 99 && bas <= haut) {
          propre[`${question.intervalle.id}_de`] = bas;
          propre[`${question.intervalle.id}_a`] = haut;
        }
      }
    }
  }

  return propre;
}

/** Combien de questions ont reçu une réponse. Sert à la barre d'avancée. */
export function remplies(reponses: Reponses): number {
  return QUESTIONS.filter((q) => {
    const v = reponses[q.id];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '';
  }).length;
}

/* ====================================================================
   Dépouiller
   ==================================================================== */

export type ReponseExportable = { prenom: string; envoyeA: string; reponses: Reponses };

/** Le libellé d'une option, pour un fichier qui se lit sans décodeur. */
function libelle(question: Question, valeur: string): string {
  return question.options?.find((o) => o.valeur === valeur)?.libelle ?? valeur;
}

function champ(valeur: string): string {
  return /[",\r\n]/.test(valeur) ? `"${valeur.replace(/"/g, '""')}"` : valeur;
}

/**
 * Le CSV des réponses.
 *
 * Une colonne par question, une ligne par personne, et les libellés en
 * toutes lettres plutôt que les codes internes : ce fichier s'ouvre dans
 * un tableur et se lit à l'œil, il n'a pas à être traduit d'abord. Les
 * réponses multiples tiennent dans une cellule, séparées par « ; ».
 */
export function reponsesVersCsv(lignes: ReponseExportable[]): string {
  const colonnes = ['prenom', 'envoye_a'];
  for (const q of QUESTIONS) {
    colonnes.push(q.id);
    if (q.precision) colonnes.push(q.precision.id);
    if (q.intervalle) colonnes.push(`${q.intervalle.id}_de`, `${q.intervalle.id}_a`);
  }

  const entete = [
    'Prénom',
    'Envoyé le',
    ...QUESTIONS.flatMap((q) => {
      const titres = [`${q.numero}. ${q.intitule}`];
      if (q.precision) titres.push(`${q.numero}. ${q.precision.libelle}`);
      if (q.intervalle) titres.push(`${q.numero}. de`, `${q.numero}. à`);
      return titres;
    }),
  ];

  const parId = new Map(QUESTIONS.map((q) => [q.id, q]));
  const cellule = (colonne: string, reponses: Reponses): string => {
    const valeur = reponses[colonne];
    if (valeur === undefined || valeur === null) return '';
    const question = parId.get(colonne);
    if (question && Array.isArray(valeur)) {
      return valeur.map((v) => libelle(question, v)).join(' ; ');
    }
    if (question && typeof valeur === 'string') return libelle(question, valeur);
    return String(valeur);
  };

  const corps = lignes.map((l) =>
    [l.prenom, l.envoyeA, ...colonnes.slice(2).map((c) => cellule(c, l.reponses))]
      .map(champ)
      .join(','),
  );

  return `${[entete.map(champ).join(','), ...corps].join('\n')}\n`;
}

export type Depouillement = {
  question: Question;
  /** Combien de fois chaque option a été choisie, dans l'ordre du formulaire. */
  comptes: { libelle: string; nombre: number }[];
  /** Les réponses libres, telles qu'elles ont été écrites. */
  textes: string[];
  /** La moyenne, pour la seule question notée. */
  moyenne?: number;
};

/** De quoi lire les résultats d'un coup d'œil, sans tableur. */
export function depouiller(lignes: ReponseExportable[]): Depouillement[] {
  return QUESTIONS.map((question) => {
    const comptes = (question.options ?? []).map((o) => ({ libelle: o.libelle, nombre: 0 }));
    const textes: string[] = [];
    const notes: number[] = [];

    for (const { reponses } of lignes) {
      const valeur = reponses[question.id];
      if (typeof valeur === 'string' && question.options) {
        const i = question.options.findIndex((o) => o.valeur === valeur);
        if (i >= 0) comptes[i].nombre += 1;
      }
      if (Array.isArray(valeur) && question.options) {
        for (const v of valeur) {
          const i = question.options.findIndex((o) => o.valeur === v);
          if (i >= 0) comptes[i].nombre += 1;
        }
      }
      if (typeof valeur === 'number') notes.push(valeur);
      if (question.type === 'texte' && typeof valeur === 'string') textes.push(valeur);
      // Les précisions libres se lisent avec leur question, pas à part.
      const precision = question.precision && reponses[question.precision.id];
      if (typeof precision === 'string') textes.push(precision);
    }

    return {
      question,
      comptes,
      textes,
      moyenne:
        notes.length > 0
          ? Math.round((notes.reduce((t, n) => t + n, 0) / notes.length) * 10) / 10
          : undefined,
    };
  });
}
