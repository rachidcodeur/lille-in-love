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

export const GROUPES = ['A', 'B', 'C'] as const;
export type Groupe = (typeof GROUPES)[number];

export const GROUPE_CHOIX = ['tous', ...GROUPES, 'aucun'] as const;
export const GENRE_CHOIX = ['tous', 'femme', 'homme'] as const;

export const GROUPE_LABELS: Record<string, string> = {
  tous: 'Tous les groupes',
  A: 'Groupe A',
  B: 'Groupe B',
  C: 'Groupe C',
  aucun: 'Sans groupe',
};

export const GENRE_LABELS: Record<string, string> = {
  tous: 'Femmes et hommes',
  femme: 'Femmes',
  homme: 'Hommes',
};

export type Filtres = {
  statut: string;
  groupe: string;
  genre: string;
  ageMin: number | null;
  ageMax: number | null;
};

export const FILTRES_PAR_DEFAUT: Filtres = {
  statut: 'tous',
  groupe: 'tous',
  genre: 'tous',
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
    statut: parmi(params.statut, statutsConnus, 'tous'),
    groupe: parmi(params.groupe, GROUPE_CHOIX, 'tous'),
    genre: parmi(params.genre, GENRE_CHOIX, 'tous'),
    ageMin,
    ageMax,
  };
}

/** Les paramètres d'URL, sans ce qui vaut déjà le réglage par défaut. */
export function versParams(filtres: Filtres, remplace: Partial<Filtres> = {}): URLSearchParams {
  const f = { ...filtres, ...remplace };
  const params = new URLSearchParams();
  if (f.statut !== 'tous') params.set('statut', f.statut);
  if (f.groupe !== 'tous') params.set('groupe', f.groupe);
  if (f.genre !== 'tous') params.set('genre', f.genre);
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
  if (filtres.genre !== 'tous') morceaux.push(GENRE_LABELS[filtres.genre]);
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
  soiree_group: string | null;
  gender: string | null;
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
  if (filtres.statut !== 'tous' && fiche.status !== filtres.statut) return false;

  if (filtres.groupe === 'aucun') {
    if (fiche.soiree_group) return false;
  } else if (filtres.groupe !== 'tous' && fiche.soiree_group !== filtres.groupe) {
    return false;
  }

  if (filtres.genre !== 'tous' && fiche.gender !== filtres.genre) return false;
  if (filtres.ageMin !== null && (fiche.age === null || fiche.age < filtres.ageMin)) return false;
  if (filtres.ageMax !== null && (fiche.age === null || fiche.age > filtres.ageMax)) return false;

  return true;
}

/** Combien de fiches pour chaque valeur possible d'un filtre, les autres tenus. */
export function compter(
  fiches: FicheFiltrable[],
  filtres: Filtres,
  champ: 'statut' | 'groupe' | 'genre',
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
