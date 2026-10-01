import { randomBytes, randomInt } from 'node:crypto';
import { colonne, lireCsv } from './csv';
import { age, peutVoir, type Genre, type Orientation } from './crush-regles';
import { supabaseAdmin } from './supabase';
import { lienPhoto } from './admin';

/* ====================================================================
   Les règles du jeu — voir crush-regles.ts
   ==================================================================== */

export type Participant = {
  id: string;
  soiree_id: string;
  member_id: string | null;
  email: string;
  first_name: string;
  birth_date: string | null;
  gender: Genre | null;
  orientation: Orientation | null;
  jeton: string;
  claimed_at: string | null;
};

/* ====================================================================
   Créer un crush time à partir de la billetterie
   ==================================================================== */

export type BilanImport = {
  attendus: number;
  rapproches: number;
  inconnus: { email: string; first_name: string }[];
  incomplets: { email: string; first_name: string }[];
  doublons: number;
  manches: number;
};

const jeton = () => randomBytes(16).toString('base64url');

/** Quatre chiffres : il doit se dire à voix haute, au fond d'une salle. */
export const nouveauCode = () => String(randomInt(1000, 10000));

/**
 * Importer les acheteurs de billets, et ouvrir le crush time.
 *
 * Le CSV de la billetterie ne porte guère plus que des adresses. Tout le
 * reste — la photo, le prénom, l'âge, l'orientation — est déjà chez nous :
 * on rapproche sur l'email, et une personne qui a rempli le questionnaire
 * arrive avec son profil complet sans rien ressaisir.
 */
export async function creerCrushTime(options: {
  soireeId: string;
  csv: string;
  /** Les heures annoncées des manches, au format ISO. */
  heures: string[];
}): Promise<BilanImport> {
  const db = supabaseAdmin();
  const lignes = lireCsv(options.csv);

  // Une adresse peut revenir : deux billets achetés d'un même compte.
  const emails = new Map<string, string>();
  for (const ligne of lignes) {
    const email = colonne(ligne, 'email', 'e-mail', 'mail', 'courriel');
    if (!email || !email.includes('@')) continue;
    const prenom =
      colonne(ligne, 'prenom', 'first name', 'firstname', 'nom') ?? email.split('@')[0];
    if (!emails.has(email.toLowerCase())) emails.set(email.toLowerCase(), prenom);
  }

  const attendus = [...emails.keys()];
  if (attendus.length === 0) {
    throw new Error('Aucune adresse email trouvée dans ce fichier.');
  }

  // Les candidatures correspondantes, en une requête.
  const { data: membres, error } = await db
    .from('lil_members')
    .select('id, email, first_name, birth_date, gender, orientation')
    .in('email', attendus);
  if (error) throw new Error(error.message);

  const parEmail = new Map(
    (membres ?? []).map((m) => [String(m.email).toLowerCase(), m]),
  );

  const aEcrire = attendus.map((email) => {
    const membre = parEmail.get(email);
    return {
      soiree_id: options.soireeId,
      member_id: membre?.id ?? null,
      email,
      first_name: membre?.first_name ?? emails.get(email) ?? 'Invité',
      birth_date: membre?.birth_date ?? null,
      gender: membre?.gender ?? null,
      orientation: membre?.orientation ?? null,
      jeton: jeton(),
    };
  });

  // « ignore-duplicates » : relancer l'import après un achat de dernière
  // minute doit ajouter les nouveaux sans redistribuer les jetons déjà
  // envoyés — un lien qui change est un participant qui ne peut plus entrer.
  const { error: ecriture } = await db
    .from('lil_crush_participants')
    .upsert(aEcrire, { onConflict: 'soiree_id,email', ignoreDuplicates: true });
  if (ecriture) throw new Error(ecriture.message);

  // Les manches, et le code de la salle.
  const manches = options.heures.map((prevu_a, index) => ({
    soiree_id: options.soireeId,
    numero: index + 1,
    prevu_a,
  }));
  if (manches.length > 0) {
    const { error: e } = await db
      .from('lil_crush_rounds')
      .upsert(manches, { onConflict: 'soiree_id,numero' });
    if (e) throw new Error(e.message);
  }

  const { data: enBase } = await db
    .from('lil_crush_participants')
    .select('email, first_name, member_id, gender')
    .eq('soiree_id', options.soireeId);

  const lignesEnBase = enBase ?? [];
  return {
    attendus: attendus.length,
    rapproches: lignesEnBase.filter((p) => p.member_id).length,
    inconnus: lignesEnBase
      .filter((p) => !p.member_id)
      .map((p) => ({ email: String(p.email), first_name: p.first_name })),
    incomplets: lignesEnBase
      .filter((p) => p.member_id && !p.gender)
      .map((p) => ({ email: String(p.email), first_name: p.first_name })),
    doublons: lignes.length - attendus.length,
    manches: manches.length,
  };
}

/* ====================================================================
   Entrer
   ==================================================================== */

export async function soireeActive() {
  const { data } = await supabaseAdmin()
    .from('lil_soirees')
    .select('id, nom, date_soiree, lieu, crush_code, crush_actif')
    .eq('crush_actif', true)
    .maybeSingle();
  return data;
}

export async function participantParJeton(jetonRecu: string): Promise<Participant | null> {
  const { data } = await supabaseAdmin()
    .from('lil_crush_participants')
    .select('*')
    .eq('jeton', jetonRecu)
    .maybeSingle();
  return (data as Participant | null) ?? null;
}

/**
 * Entrer avec son adresse et le code annoncé dans la salle.
 *
 * C'est la porte de secours de ceux qui n'ont pas reçu leur lien, et en
 * pratique la porte principale : rien à attendre, rien à recevoir. Le code
 * seul ne suffit pas — il faut aussi figurer sur la liste des billets.
 */
export async function entrerAvecCode(
  email: string,
  code: string,
): Promise<Participant | null> {
  const soiree = await soireeActive();
  if (!soiree?.crush_code || soiree.crush_code !== code.trim()) return null;

  const { data } = await supabaseAdmin()
    .from('lil_crush_participants')
    .select('*')
    .eq('soiree_id', soiree.id)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  return (data as Participant | null) ?? null;
}

/* ====================================================================
   Les manches
   ==================================================================== */

export type Manche = {
  id: string;
  numero: number;
  prevu_a: string;
  ouvert_at: string | null;
  ferme_at: string | null;
};

export async function manches(soireeId: string): Promise<Manche[]> {
  const { data } = await supabaseAdmin()
    .from('lil_crush_rounds')
    .select('id, numero, prevu_a, ouvert_at, ferme_at')
    .eq('soiree_id', soireeId)
    .order('numero', { ascending: true });
  return (data ?? []) as Manche[];
}

export const estOuverte = (m: Manche) => Boolean(m.ouvert_at) && !m.ferme_at;

/* ====================================================================
   Les profils, les likes, les matchs
   ==================================================================== */

export type Profil = {
  id: string;
  first_name: string;
  age: number | null;
  photo: string | null;
  profession: string | null;
  about: string | null;
  email?: string;
};

/** Les participants qu'une personne peut voir, avec leur photo. */
export async function profilsPour(moi: Participant): Promise<Profil[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('lil_crush_participants')
    .select('*')
    .eq('soiree_id', moi.soiree_id);

  const visibles = ((data ?? []) as Participant[]).filter((autre) => peutVoir(moi, autre));
  return habiller(visibles);
}

/** Photo, métier, présentation : tout vient de la candidature d'origine. */
async function habiller(participants: Participant[]): Promise<Profil[]> {
  const ids = participants.map((p) => p.member_id).filter((id): id is string => Boolean(id));
  const db = supabaseAdmin();

  const [{ data: membres }, { data: photos }] = await Promise.all([
    ids.length
      ? db.from('lil_members').select('id, profession, about').in('id', ids)
      : Promise.resolve({ data: [] as { id: string; profession: string; about: string }[] }),
    ids.length
      ? db.from('lil_photos').select('id, member_id, position').in('member_id', ids)
      : Promise.resolve({ data: [] as { id: string; member_id: string; position: number }[] }),
  ]);

  const infos = new Map((membres ?? []).map((m) => [m.id, m]));
  const premiere = new Map<string, string>();
  for (const photo of [...(photos ?? [])].sort((a, b) => a.position - b.position)) {
    if (!premiere.has(photo.member_id)) premiere.set(photo.member_id, lienPhoto(photo.id));
  }

  return participants.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    age: age(p.birth_date),
    photo: p.member_id ? (premiere.get(p.member_id) ?? null) : null,
    profession: p.member_id ? (infos.get(p.member_id)?.profession ?? null) : null,
    about: p.member_id ? (infos.get(p.member_id)?.about ?? null) : null,
  }));
}

export type ResultatLike =
  | { ok: true; match: Profil | null }
  | { ok: false; raison: string };

/**
 * Liker quelqu'un — une seule personne par manche.
 *
 * On peut changer d'avis tant qu'on n'a pas matché : c'est la même ligne
 * qu'on déplace. Une fois le match fait, le like se fige — l'autre a déjà
 * reçu sa notification, et lui retirer son match serait une cruauté.
 *
 * Un match ne regarde pas la manche : si elle l'a liké ce soir et qu'il la
 * like deux heures plus tard, c'est un match. Avec un seul like par manche,
 * s'en tenir à la manche ne laisserait presque aucune chance aux deux
 * personnes de se croiser au même moment.
 */
export async function liker(moi: Participant, versId: string): Promise<ResultatLike> {
  const db = supabaseAdmin();

  const ouvertes = (await manches(moi.soiree_id)).filter(estOuverte);
  const manche = ouvertes[0];
  if (!manche) return { ok: false, raison: 'Le crush time n’est pas ouvert.' };

  const { data: cibleBrute } = await db
    .from('lil_crush_participants')
    .select('*')
    .eq('id', versId)
    .maybeSingle();
  const cible = cibleBrute as Participant | null;
  if (!cible || cible.soiree_id !== moi.soiree_id || !peutVoir(moi, cible)) {
    return { ok: false, raison: 'Ce profil n’est pas disponible.' };
  }

  // Déjà matché dans cette manche ? Le choix est fait.
  const { data: dejaMatche } = await db
    .from('lil_crush_matches')
    .select('id')
    .eq('round_id', manche.id)
    .or(`a_id.eq.${moi.id},b_id.eq.${moi.id}`)
    .limit(1);
  if (dejaMatche?.length) {
    return { ok: false, raison: 'Tu as déjà un match sur cette manche.' };
  }

  const { error } = await db
    .from('lil_crush_likes')
    .upsert(
      { round_id: manche.id, de_id: moi.id, vers_id: versId },
      { onConflict: 'round_id,de_id' },
    );
  if (error) return { ok: false, raison: error.message };

  // Est-ce qu'elle ou il m'a liké, ce soir, dans n'importe quelle manche ?
  const toutes = (await manches(moi.soiree_id)).map((m) => m.id);
  const { data: retour } = await db
    .from('lil_crush_likes')
    .select('id')
    .in('round_id', toutes)
    .eq('de_id', versId)
    .eq('vers_id', moi.id)
    .limit(1);

  if (!retour?.length) return { ok: true, match: null };

  // La paire est rangée : deux clics simultanés ne peuvent pas créer deux
  // matchs pour un seul couple, c'est la base qui s'en charge.
  const [a_id, b_id] = [moi.id, versId].sort();
  const { error: eMatch } = await db
    .from('lil_crush_matches')
    .upsert(
      { soiree_id: moi.soiree_id, round_id: manche.id, a_id, b_id },
      { onConflict: 'soiree_id,a_id,b_id', ignoreDuplicates: true },
    );
  if (eMatch) return { ok: false, raison: eMatch.message };

  const [profil] = await habiller([cible]);
  return { ok: true, match: profil ?? null };
}

/** Mon like de la manche en cours, s'il y en a un. */
export async function monLike(moi: Participant, mancheId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from('lil_crush_likes')
    .select('vers_id')
    .eq('round_id', mancheId)
    .eq('de_id', moi.id)
    .maybeSingle();
  return data?.vers_id ?? null;
}

/** Mes matchs, avec de quoi se retrouver après la soirée. */
export async function matchsDe(moi: Participant): Promise<Profil[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('lil_crush_matches')
    .select('a_id, b_id, created_at')
    .or(`a_id.eq.${moi.id},b_id.eq.${moi.id}`)
    .order('created_at', { ascending: true });

  const ids = (data ?? []).map((m) => (m.a_id === moi.id ? m.b_id : m.a_id));
  if (ids.length === 0) return [];

  const { data: gens } = await db.from('lil_crush_participants').select('*').in('id', ids);
  const profils = await habiller((gens ?? []) as Participant[]);

  // Un match donne droit à l'adresse : c'est tout l'intérêt du lendemain.
  const emails = new Map(((gens ?? []) as Participant[]).map((p) => [p.id, p.email]));
  return profils.map((p) => ({ ...p, email: emails.get(p.id) }));
}
