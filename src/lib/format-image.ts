/**
 * Le format réel d'un fichier, lu dans ses octets.
 *
 * Le type annoncé par le navigateur ne vaut rien : il est vide sur beaucoup
 * d'Android, faux quand le fichier vient d'un gestionnaire de fichiers, et
 * de toute façon choisi par le client — donc modifiable. On lit l'en-tête,
 * qui lui ne ment pas.
 */

export type FormatImage = { extension: string; mimeType: string };

/** Les marques ISO-BMFF d'un fichier HEIF — le format de l'iPhone. */
const MARQUES_HEIF = new Set([
  'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1',
]);

function lire(octets: Uint8Array, debut: number, longueur: number): string {
  return String.fromCharCode(...octets.subarray(debut, debut + longueur));
}

export function formatDe(octets: Uint8Array): FormatImage | null {
  if (octets.length < 12) return null;

  // JPEG : FF D8 FF
  if (octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }

  // PNG : 89 P N G \r \n 1A \n
  if (
    octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47 &&
    octets[4] === 0x0d && octets[5] === 0x0a && octets[6] === 0x1a && octets[7] === 0x0a
  ) {
    return { extension: 'png', mimeType: 'image/png' };
  }

  // WEBP : « RIFF » … « WEBP »
  if (lire(octets, 0, 4) === 'RIFF' && lire(octets, 8, 4) === 'WEBP') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }

  // HEIF / AVIF : la taille, puis « ftyp », puis la marque.
  if (lire(octets, 4, 4) === 'ftyp') {
    const marque = lire(octets, 8, 4);
    if (MARQUES_HEIF.has(marque)) return { extension: 'heic', mimeType: 'image/heic' };
    if (marque === 'avif' || marque === 'avis') {
      return { extension: 'avif', mimeType: 'image/avif' };
    }
  }

  return null;
}
