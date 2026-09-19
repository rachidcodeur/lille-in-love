/**
 * Le HEIC, format par défaut de l'appareil photo d'un iPhone.
 *
 * Safari sait le lire, à peu près personne d'autre : ni Chrome, ni Firefox,
 * ni Android. Une photo déposée telle quelle finit donc en carré blanc dans
 * le back-office — le curateur ne voit rien, et la candidature part avec un
 * handicap qui n'a rien à voir avec la personne.
 *
 * On la convertit donc en JPEG dans le navigateur, avant l'envoi. Quand le
 * navigateur sait décoder (Safari, iOS), c'est gratuit ; sinon on charge
 * libheif à la demande — 3 Mo qui ne partent qu'aux rares visiteurs qui en
 * ont besoin, et jamais pour une photo JPEG.
 *
 * Ce fichier ne tourne que dans le navigateur.
 */

/** Les marques ISO-BMFF qui désignent un fichier HEIF. */
const MARQUES = new Set([
  'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1',
]);

const MIME_HEIC = /^image\/hei[cf]/i;
const EXT_HEIC = /\.hei[cf]$/i;

/**
 * Ce fichier est-il du HEIC ?
 *
 * Le type déclaré ne suffit pas : Android et certains gestionnaires de
 * fichiers le laissent vide. On lit donc l'en-tête, qui ne ment pas.
 */
export async function estHeic(fichier: Blob, nom = ''): Promise<boolean> {
  if (MIME_HEIC.test(fichier.type)) return true;

  try {
    const entete = new Uint8Array(await fichier.slice(0, 12).arrayBuffer());
    if (entete.length >= 12) {
      const marqueur = String.fromCharCode(...entete.subarray(4, 12));
      if (marqueur.startsWith('ftyp')) return MARQUES.has(marqueur.slice(4, 8));
      return false;
    }
  } catch {
    // Fichier illisible : on retombe sur le nom, faute de mieux.
  }

  return EXT_HEIC.test(nom);
}

/**
 * Décode une image, HEIC compris.
 *
 * Renvoie `null` si personne n'y arrive : à l'appelant de décider quoi faire
 * du fichier d'origine — surtout pas de le jeter.
 */
export async function decoder(fichier: Blob, heic: boolean): Promise<ImageBitmap | null> {
  // 1. Le navigateur d'abord. Sur iPhone, il sait lire le HEIC tout seul.
  try {
    return await createImageBitmap(fichier);
  } catch {
    if (!heic) return null;
  }

  // 2. Sinon, et seulement pour du HEIC, on va chercher le décodeur.
  //    L'import est dynamique : il forme un morceau à part, téléchargé au
  //    moment où quelqu'un dépose vraiment une photo d'iPhone.
  try {
    const { heicTo } = await import('heic-to/csp');
    return await heicTo({ blob: fichier, type: 'bitmap' });
  } catch (erreur) {
    // Silencieux pour la personne — on garde le fichier d'origine — mais
    // visible pour qui ouvre la console : sinon on ne saurait jamais.
    console.warn('[Lille in Love] décodage HEIC impossible', erreur);
    return null;
  }
}

/** `IMG_0042.HEIC` → `IMG_0042.jpg`. */
export function enJpg(nom: string): string {
  const base = nom.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

/**
 * Une image redessinée en JPEG, au plus `maxCote` pixels de côté.
 *
 * Les photos de téléphone font 4 à 10 Mo : les réduire ici évite les envois
 * qui échouent sur une connexion moyenne, et suffit largement pour
 * reconnaître quelqu'un le soir venu.
 */
export async function versJpeg(
  bitmap: ImageBitmap,
  nom: string,
  maxCote = 1600,
  qualite = 0.86,
): Promise<File | null> {
  const echelle = Math.min(1, maxCote / Math.max(bitmap.width, bitmap.height));

  const toile = document.createElement('canvas');
  toile.width = Math.max(1, Math.round(bitmap.width * echelle));
  toile.height = Math.max(1, Math.round(bitmap.height * echelle));

  const contexte = toile.getContext('2d');
  if (!contexte) return null;

  contexte.drawImage(bitmap, 0, 0, toile.width, toile.height);

  const blob = await new Promise<Blob | null>((resoudre) =>
    toile.toBlob(resoudre, 'image/jpeg', qualite),
  );
  if (!blob) return null;

  return new File([blob], enJpg(nom), { type: 'image/jpeg' });
}

/**
 * Le JPEG lisible d'une photo déjà déposée, pour le back-office.
 *
 * Une candidature envoyée avant cette conversion peut porter un HEIC : plutôt
 * que d'afficher un carré vide au curateur, on le décode à l'affichage.
 * Renvoie `null` si ce n'est pas du HEIC, ou si le décodage échoue.
 */
export async function reparerHeic(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    if (!(await estHeic(blob, url))) return null;

    const bitmap = await decoder(blob, true);
    if (!bitmap) return null;

    // Plus grand qu'à l'envoi : ici on examine un visage, on ne l'économise pas.
    const jpeg = await versJpeg(bitmap, 'photo', 2000, 0.92);
    bitmap.close();
    return jpeg ? URL.createObjectURL(jpeg) : null;
  } catch {
    return null;
  }
}
