/**
 * Les groupes de soirée et le tri de la liste.
 *
 * Un groupe (A, B, C) répond à « pour quelle table ? », pas à « on la
 * garde ? » — cette question-là, c'est le statut. Attribuer un groupe
 * n'envoie aucun email et ne change aucun statut.
 *
 * Ce fichier est la seule définition des filtres : la page, l'export CSV et
 * les tests lisent tous la même chose, et une URL de liste se transforme en
 * URL d'export en changeant le chemin.
 */

export const GROUPES = ['A', 'B', 'C', 'G'] as const;
export type Groupe = (typeof GROUPES)[number];

export const GROUPE_CHOIX = ['tous', ...GROUPES, 'aucun'] as const;
export const GENRE_CHOIX = ['tous', 'femme', 'homme'] as const;
export const ORIENTATION_CHOIX = ['tous', 'gay', 'autre'] as const;

export const GROUPE_LABELS: Record<string, string> = {
  tous: 'Tous les groupes',
  A: 'Groupe A',
  B: 'Groupe B',
  C: 'Groupe C',
  G: 'Groupe G',
  aucun: 'Sans groupe',
};

export const GENRE_LABELS: Record<string, string> = {
  tous: 'Femmes et hommes',
  femme: 'Femmes',
  homme: 'Hommes',
};

/* « autre » couvre tout le reste, y compris les candidatures qui n'ont pas
   répondu à la question — le formulaire court ne la pose pas. */
export const ORIENTATION_LABELS: Record<string, string> = {
  tous: 'Toutes orientations',
  gay: 'Gay',
  autre: 'Autre',
};

export type Filtres = {
  /** Ce qu'on cherche : un prénom, un bout de nom, un email, une ville. */
  recherche: string;
  statut: string;
  groupe: string;
  genre: string;
  orientation: string;
  ageMin: number | null;
  ageMax: number | null;
};

export const FILTRES_PAR_DEFAUT: Filtres = {
  recherche: '',
  statut: 'tous',
  groupe: 'tous',
  genre: 'tous',
  orientation: 'tous',
  ageMin: null,
  ageMax: null,
};

export type ParamsBruts = Record<string, string | string[] | undefined>;

function premier(valeur: string | string[] | undefined): string | undefined {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}

/** Un âge saisi à la main : on ne fait confiance à rien. */
function age(valeur: string | string[] | undefined): number | null {
  const brut = premier(valeur);
  if (!brut) return null;
  const n = Number.parseInt(brut, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(120, Math.max(18, n));
}

function parmi(valeur: string | string[] | undefined, autorisees: readonly string[], defaut: string) {
  const brut = premier(valeur);
  return brut && autorisees.includes(brut) ? brut : defaut;
}

export function parseFiltres(params: ParamsBruts, statutsConnus: readonly string[]): Filtres {
  let ageMin = age(params.ageMin);
  let ageMax = age(params.ageMax);
  // Bornes inversées : on remet dans l'ordre plutôt que de ne rien renvoyer.
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];

  return {
    // Les caractères qui ont un sens pour PostgREST sont écartés dès l'entrée :
    // une virgule ou une parenthèse casserait le filtre construit plus loin.
    recherche: (premier(params.q) ?? '').replace(/[(),*"'\\%]/g, ' ').trim().slice(0, 60),
    statut: parmi(params.statut, statutsConnus, 'tous'),
    groupe: parmi(params.groupe, GROUPE_CHOIX, 'tous'),
    genre: parmi(params.genre, GENRE_CHOIX, 'tous'),
    orientation: parmi(params.orientation, ORIENTATION_CHOIX, 'tous'),
    ageMin,
    ageMax,
  };
}

/** Les paramètres d'URL, sans ce qui vaut déjà le réglage par défaut. */
export function versParams(filtres: Filtres, remplace: Partial<Filtres> = {}): URLSearchParams {
  const f = { ...filtres, ...remplace };
  const params = new URLSearchParams();
  if (f.recherche) params.set('q', f.recherche);
  if (f.statut !== 'tous') params.set('statut', f.statut);
  if (f.groupe !== 'tous') params.set('groupe', f.groupe);
  if (f.genre !== 'tous') params.set('genre', f.genre);
  if (f.orientation !== 'tous') params.set('orientation', f.orientation);
  if (f.ageMin !== null) params.set('ageMin', String(f.ageMin));
  if (f.ageMax !== null) params.set('ageMax', String(f.ageMax));
  return params;
}

export function lien(chemin: string, filtres: Filtres, remplace: Partial<Filtres> = {}): string {
  const params = versParams(filtres, remplace).toString();
  return params ? `${chemin}?${params}` : chemin;
}

/** Autre chose que « tout le monde » est-il demandé ? */
export function filtresActifs(filtres: Filtres): boolean {
  return versParams(filtres).toString().length > 0;
}

/** « Femmes · groupe C · 27–35 ans » — le résumé qui titre l'export. */
export function resume(filtres: Filtres): string[] {
  const morceaux: string[] = [];
  if (filtres.recherche) morceaux.push(`« ${filtres.recherche} »`);
  if (filtres.genre !== 'tous') morceaux.push(GENRE_LABELS[filtres.genre]);
  if (filtres.orientation !== 'tous') {
    morceaux.push(filtres.orientation === 'gay' ? 'gays' : 'hors gays');
  }
  if (filtres.groupe === 'aucun') morceaux.push('sans groupe');
  else if (filtres.groupe !== 'tous') morceaux.push(`groupe ${filtres.groupe}`);
  if (filtres.ageMin !== null && filtres.ageMax !== null) {
    morceaux.push(`${filtres.ageMin}–${filtres.ageMax} ans`);
  } else if (filtres.ageMin !== null) {
    morceaux.push(`${filtres.ageMin} ans et plus`);
  } else if (filtres.ageMax !== null) {
    morceaux.push(`${filtres.ageMax} ans et moins`);
  }
  return morceaux;
}

/** Le nom du fichier CSV : « candidatures_femmes_C_27-35.csv ». */
export function nomFichier(filtres: Filtres): string {
  const bouts = ['candidatures'];
  if (filtres.genre !== 'tous') bouts.push(filtres.genre === 'femme' ? 'femmes' : 'hommes');
  if (filtres.orientation !== 'tous') bouts.push(filtres.orientation);
  if (filtres.groupe !== 'tous') bouts.push(filtres.groupe === 'aucun' ? 'sans-groupe' : filtres.groupe);
  if (filtres.statut !== 'tous') bouts.push(filtres.statut);
  if (filtres.ageMin !== null || filtres.ageMax !== null) {
    bouts.push(`${filtres.ageMin ?? ''}-${filtres.ageMax ?? ''}`);
  }
  return `${bouts.join('_')}.csv`;
}

/* ====================================================================
   Le même filtre, appliqué en mémoire
   ==================================================================== */

export type FicheFiltrable = {
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  city: string | null;
  soiree_group: string | null;
  gender: string | null;
  orientation: string | null;
  age: number | null;
};

/**
 * La liste est filtrée par Supabase ; les compteurs, eux, se calculent ici
 * sur une seule lecture légère. Les deux doivent dire la même chose — d'où
 * cette fonction, qui reproduit exactement les conditions envoyées à
 * PostgREST, y compris le traitement des âges inconnus (formulaire court) :
 * dès qu'une borne d'âge est posée, ils sortent de la sélection.
 */
export function correspond(fiche: FicheFiltrable, filtres: Filtres): boolean {
  if (filtres.recherche && !trouve(fiche, filtres.recherche)) return false;
  if (filtres.statut !== 'tous' && fiche.status !== filtres.statut) return false;

  if (filtres.groupe === 'aucun') {
    if (fiche.soiree_group) return false;
  } else if (filtres.groupe !== 'tous' && fiche.soiree_group !== filtres.groupe) {
    return false;
  }

  if (filtres.genre !== 'tous' && fiche.gender !== filtres.genre) return false;

  // « autre », c'est tout sauf gay — y compris les fiches sans réponse,
  // que le formulaire court ne demande pas.
  if (filtres.orientation === 'gay' && fiche.orientation !== 'gay') return false;
  if (filtres.orientation === 'autre' && fiche.orientation === 'gay') return false;

  if (filtres.ageMin !== null && (fiche.age === null || fiche.age < filtres.ageMin)) return false;
  if (filtres.ageMax !== null && (fiche.age === null || fiche.age > filtres.ageMax)) return false;

  return true;
}

/**
 * La fiche répond-elle à la recherche ?
 *
 * Prénom, nom, email et ville, sans distinction de casse. Les accents, eux,
 * comptent : la base fait la même lecture, et il vaut mieux deux endroits qui
 * disent la même chose qu'un compteur en désaccord avec la liste.
 */
function trouve(fiche: FicheFiltrable, terme: string): boolean {
  const aiguille = terme.toLowerCase();
  return [fiche.first_name, fiche.last_name, fiche.email, fiche.city].some((champ) =>
    (champ ?? '').toLowerCase().includes(aiguille),
  );
}

/** Combien de fiches pour chaque valeur possible d'un filtre, les autres tenus. */
export function compter(
  fiches: FicheFiltrable[],
  filtres: Filtres,
  champ: 'statut' | 'groupe' | 'genre' | 'orientation',
  valeurs: readonly string[],
): Record<string, number> {
  const comptes: Record<string, number> = {};
  for (const valeur of valeurs) {
    comptes[valeur] = fiches.filter((fiche) =>
      correspond(fiche, { ...filtres, [champ]: valeur }),
    ).length;
  }
  return comptes;
}
