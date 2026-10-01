/**
 * Lire un CSV qu'on n'a pas écrit.
 *
 * Les exports de billetterie contiennent des virgules dans les adresses, des
 * guillemets dans les noms et parfois un retour à la ligne au milieu d'un
 * champ : un découpage naïf les transforme en colonnes fantômes. Ce lecteur
 * ne connaît que la grammaire du format, ce qui suffit, et accepte aussi le
 * point-virgule — Excel en français n'écrit que celui-là.
 */

export type Ligne = Record<string, string>;

function separateur(premiereLigne: string): string {
  // Celui qui apparaît le plus hors des guillemets gagne. Compter bêtement
  // suffit : une ligne d'en-têtes n'a presque jamais de guillemets.
  const virgules = (premiereLigne.match(/,/g) ?? []).length;
  const pointsVirgules = (premiereLigne.match(/;/g) ?? []).length;
  const tabulations = (premiereLigne.match(/\t/g) ?? []).length;
  if (tabulations > virgules && tabulations > pointsVirgules) return '\t';
  return pointsVirgules > virgules ? ';' : ',';
}

export function lireCsv(texte: string): Ligne[] {
  // Le BOM que place Excel se retrouverait collé au premier en-tête, et la
  // colonne « email » s'appellerait « ﻿email ».
  const contenu = texte.replace(/^﻿/, '');
  const sep = separateur(contenu.split(/\r?\n/, 1)[0] ?? '');

  const lignes: string[][] = [];
  let champ = '';
  let ligne: string[] = [];
  let dansGuillemets = false;

  for (let i = 0; i < contenu.length; i += 1) {
    const c = contenu[i];

    if (dansGuillemets) {
      if (c === '"') {
        if (contenu[i + 1] === '"') {
          champ += '"';
          i += 1;
        } else dansGuillemets = false;
      } else champ += c;
      continue;
    }

    if (c === '"') dansGuillemets = true;
    else if (c === sep) {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n') {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
    } else if (c !== '\r') champ += c;
  }
  if (champ !== '' || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }

  const utiles = lignes.filter((l) => l.some((v) => v.trim() !== ''));
  const [entetes, ...corps] = utiles;
  if (!entetes) return [];

  return corps.map((l) =>
    Object.fromEntries(entetes.map((e, i) => [e.trim(), (l[i] ?? '').trim()])),
  );
}

/**
 * Retrouver une colonne sans connaître son nom exact.
 *
 * On ne sait pas ce que la billetterie appellera l'adresse : « Email »,
 * « E-mail », « Adresse e-mail », « Acheteur - email ». Plutôt que d'exiger
 * un format, on cherche l'en-tête qui contient le mot.
 */
export function colonne(ligne: Ligne, ...mots: string[]): string | null {
  const cles = Object.keys(ligne);
  for (const mot of mots) {
    const exacte = cles.find((c) => sansAccent(c) === sansAccent(mot));
    if (exacte && ligne[exacte]) return ligne[exacte].trim();
  }
  for (const mot of mots) {
    const proche = cles.find((c) => sansAccent(c).includes(sansAccent(mot)));
    if (proche && ligne[proche]) return ligne[proche].trim();
  }
  return null;
}

function sansAccent(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
