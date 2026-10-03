import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from './env';
import { supabaseAdmin } from './supabase';

/**
 * Servir une photo, à la taille qu'on en fait.
 *
 * Deux constats ont dicté ce fichier. D'abord, une photo de candidature pèse
 * deux à trois cents kilo-octets : affichée en vignette de quarante pixels,
 * c'est trois cents fois trop, et une liste de cent quarante fiches fait
 * descendre trente méga-octets pour montrer des pastilles. Ensuite, chaque
 * demande coûtait deux allers-retours vers Supabase — un pour retrouver le
 * chemin, un pour lire le fichier — à chaque affichage, indéfiniment.
 *
 * On redimensionne donc, et on garde en mémoire. Une photo ne change jamais :
 * la deuxième demande ne touche plus ni la base ni le stockage.
 */

export type Taille = 'vignette' | 'carte' | 'pleine';

const LARGEURS: Record<Taille, number> = {
  vignette: 192, // les pastilles des listes, écran à deux fois la densité
  carte: 760, // une carte de profil, plein écran sur un téléphone
  pleine: 1600, // la visionneuse du back-office, quand on regarde de près
};

const QUALITES: Record<Taille, number> = { vignette: 72, carte: 76, pleine: 82 };

export function estUneTaille(valeur: string | null): valeur is Taille {
  return valeur === 'vignette' || valeur === 'carte' || valeur === 'pleine';
}

/* ------------------------------------------------------------------ */
/* Le garde-manger                                                     */
/* ------------------------------------------------------------------ */

type Gardee = { octets: Buffer; type: string; etag: string };

/**
 * Un cache en mémoire, borné.
 *
 * Les photos sont immuables : rien à invalider. La borne est en octets, pas
 * en nombre d'entrées — mille vignettes et dix pleines pages n'occupent pas
 * la même chose. Quand c'est plein, on vide la moitié la plus ancienne :
 * une éviction exacte ne vaut pas sa complexité pour un back-office.
 */
const MAX_OCTETS = 96 * 1024 * 1024;
const garde = new Map<string, Gardee>();
let occupe = 0;

function ranger(cle: string, valeur: Gardee) {
  if (valeur.octets.length > MAX_OCTETS / 4) return;
  garde.set(cle, valeur);
  occupe += valeur.octets.length;

  if (occupe > MAX_OCTETS) {
    for (const [k, v] of [...garde.entries()].slice(0, Math.ceil(garde.size / 2))) {
      garde.delete(k);
      occupe -= v.octets.length;
    }
  }
}

/* ------------------------------------------------------------------ */

/**
 * Réduire une photo.
 *
 * sharp arrive avec Next, mais en dépendance facultative : si l'hébergeur ne
 * l'a pas installée, on renvoie l'original plutôt que rien. Un HEIC, que
 * sharp ne sait pas toujours lire, suit le même chemin — le navigateur du
 * curateur le convertit déjà de son côté.
 */
async function reduire(
  octets: Buffer,
  taille: Taille,
): Promise<{ octets: Buffer; type: string } | null> {
  try {
    const { default: sharp } = await import('sharp');
    const reduit = await sharp(octets)
      // Les photos de téléphone portent leur orientation en métadonnée :
      // sans ça, une photo prise à la verticale ressort couchée.
      .rotate()
      .resize({ width: LARGEURS[taille], withoutEnlargement: true })
      .jpeg({ quality: QUALITES[taille], mozjpeg: true })
      .toBuffer();
    return { octets: reduit, type: 'image/jpeg' };
  } catch {
    return null;
  }
}

/**
 * La réponse HTTP d'une photo.
 *
 * `autorise` reçoit le member_id propriétaire et dit si celui qui demande a
 * le droit de la voir : le back-office et le crush time n'ont pas la même
 * règle, mais le reste du chemin est identique.
 */
export async function servirPhoto(options: {
  requete: Request;
  photoId: string;
  taille: Taille;
  espace: string;
  autorise: (memberId: string | null) => Promise<boolean> | boolean;
}): Promise<NextResponse> {
  const { requete, photoId, taille, espace, autorise } = options;
  const cle = `${espace}:${photoId}:${taille}`;

  const dejaLa = garde.get(cle);
  if (dejaLa) {
    // Même sortie que plus bas, mais sans toucher ni la base ni le stockage.
    return repondre(requete, dejaLa);
  }

  const db = supabaseAdmin();
  const { data: photo } = await db
    .from('lil_photos')
    .select('member_id, storage_path, mime_type, size_bytes, created_at')
    .eq('id', photoId)
    .maybeSingle();

  if (!photo) return new NextResponse(null, { status: 404 });
  if (!(await autorise(photo.member_id))) return new NextResponse(null, { status: 404 });

  const { data: fichier, error } = await db.storage
    .from(env.storageBucket())
    .download(photo.storage_path);
  if (error || !fichier) return new NextResponse(null, { status: 404 });

  const brut = Buffer.from(await fichier.arrayBuffer());
  const reduit = await reduire(brut, taille);

  const valeur: Gardee = {
    octets: reduit?.octets ?? brut,
    type: reduit?.type ?? photo.mime_type ?? fichier.type ?? 'application/octet-stream',
    etag: `"${createHash('sha1')
      .update(`${photo.storage_path}|${photo.size_bytes ?? ''}|${photo.created_at ?? ''}|${taille}`)
      .digest('hex')
      .slice(0, 20)}"`,
  };

  ranger(cle, valeur);
  return repondre(requete, valeur);
}

function repondre(requete: Request, photo: Gardee): NextResponse {
  // « private » : ce sont des photos de candidats, aucun cache partagé —
  // celui de l'hébergeur compris — n'a le droit d'en garder une copie.
  const entetes = {
    'Cache-Control': 'private, max-age=86400, must-revalidate',
    Vary: 'Cookie',
    ETag: photo.etag,
  };

  if (requete.headers.get('if-none-match') === photo.etag) {
    return new NextResponse(null, { status: 304, headers: entetes });
  }

  // Buffer est une vue sur un ArrayBuffer : on passe la vue, que la
  // signature de Response accepte, plutôt que le Buffer lui-même.
  return new NextResponse(new Uint8Array(photo.octets), {
    headers: {
      ...entetes,
      'Content-Type': photo.type,
      'Content-Length': String(photo.octets.length),
    },
  });
}
