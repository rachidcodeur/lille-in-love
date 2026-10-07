import { randomBytes, randomInt } from 'node:crypto';
import { colonne, lireCsv } from './csv';
import { age, peutVoir, type Genre, type Orientation } from './crush-regles';
import { DUREE_PAR_DEFAUT, estOuverte, finPrevue } from './manches';
import { notifier } from './notifications';
import { nomManche } from './crush-regles';
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
  /** Les quatre chiffres reçus par email, qui prouvent qui l'on est. */
  code?: string | null;
  claimed_at: string | null;
  retire_at: string | null;
};

/* ====================================================================
   Créer un crush time à partir de la billetterie
   ==================================================================== */

export type BilanImport = {
  attendus: number;
  ajoutes: number;
  rapproches: number;
  inconnus: { email: string; first_name: string }[];
  incomplets: { email: string; first_name: string }[];
  manches: number;
};

const jeton = () => randomBytes(16).toString('base64url');

/** Quatre chiffres : il doit se dire à voix haute, au fond d'une salle. */
export const nouveauCode = () => String(randomInt(1000, 10000));

type Candidat = {
  id?: string | null;
  email: string;
  first_name?: string | null;
  birth_date?: string | null;
  gender?: Genre | null;
  orientation?: Orientation | null;
};

/**
 * Inscrire des gens à une soirée.
 *
 * Le cœur commun aux deux portes : cocher dans la liste, ou importer le
 * fichier de la billetterie. Dans les deux cas on ne garde que des adresses,
 * et tout le reste — photo, prénom, âge, orientation — vient de la
 * candidature, qu'on retrouve par l'email.
 *
 * Réinscrire quelqu'un ne fait rien : son jeton ne doit pas changer, sinon
 * le lien qu'il a déjà reçu cesse de fonctionner.
 */
async function inscrire(soireeId: string, candidats: Candidat[]): Promise<number> {
  if (candidats.length === 0) return 0;

  const db = supabaseAdmin();
  const lignes = candidats.map((c) => ({
    soiree_id: soireeId,
    member_id: c.id ?? null,
    email: c.email,
    first_name: c.first_name || c.email.split('@')[0],
    birth_date: c.birth_date ?? null,
    gender: c.gender ?? null,
    orientation: c.orientation ?? null,
    jeton: jeton(),
    code: nouveauCode(),
  }));

  const { data, error } = await db
    .from('lil_crush_participants')
    .upsert(lignes, { onConflict: 'soiree_id,email', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(error.message);

  return (data ?? []).length;
}

/**
 * Les manches, posées une fois pour toutes.
 *
 * On n'y revient pas à chaque ajout de participant : réécrire les heures
 * effacerait l'ouverture déjà faite d'une manche en cours.
 */
async function poserManches(soireeId: string, heures: string[]): Promise<number> {
  if (heures.length === 0) return 0;
  const db = supabaseAdmin();

  const { data: existantes } = await db
    .from('lil_crush_rounds')
    .select('id')
    .eq('soiree_id', soireeId);
  if (existantes?.length) return 0;

  const { error } = await db.from('lil_crush_rounds').insert(
    heures.map((prevu_a, index) => ({ soiree_id: soireeId, numero: index + 1, prevu_a })),
  );
  if (error) throw new Error(error.message);
  return heures.length;
}

/** Ce que la soirée compte, une fois l'opération faite. */
async function bilan(
  soireeId: string,
  attendus: number,
  ajoutes: number,
  manches: number,
): Promise<BilanImport> {
  const { data } = await supabaseAdmin()
    .from('lil_crush_participants')
    .select('email, first_name, member_id, gender')
    .eq('soiree_id', soireeId)
    .is('retire_at', null);

  const lignes = data ?? [];
  return {
    attendus,
    ajoutes,
    rapproches: lignes.filter((p) => p.member_id).length,
    inconnus: lignes
      .filter((p) => !p.member_id)
      .map((p) => ({ email: String(p.email), first_name: p.first_name })),
    incomplets: lignes
      .filter((p) => p.member_id && !p.gender)
      .map((p) => ({ email: String(p.email), first_name: p.first_name })),
    manches,
  };
}

/**
 * Composer la soirée en cochant dans la liste des candidatures.
 *
 * C'est la porte de tous les jours : on connaît ces gens, on les a triés en
 * groupes, et on sait qui on veut voir ensemble.
 */
export async function composerCrushTime(options: {
  soireeId: string;
  memberIds: string[];
  heures?: string[];
}): Promise<BilanImport> {
  const { data: membres, error } = await supabaseAdmin()
    .from('lil_members')
    .select('id, email, first_name, birth_date, gender, orientation')
    .in('id', options.memberIds);
  if (error) throw new Error(error.message);

  const candidats = (membres ?? []).map((m) => ({ ...m, email: String(m.email).toLowerCase() }));
  const ajoutes = await inscrire(options.soireeId, candidats as Candidat[]);
  const manches = await poserManches(options.soireeId, options.heures ?? []);

  return bilan(options.soireeId, options.memberIds.length, ajoutes, manches);
}

/**
 * Ajouter quelqu'un qui n'est dans aucune liste.
 *
 * L'organisateur qui se met lui-même dans sa soirée, un ami de dernière
 * minute, quelqu'un qui a payé en espèces à la porte : il y a toujours un
 * cas que ni la billetterie ni les candidatures ne connaissent.
 *
 * Le genre est demandé parce qu'il décide de tout : sans lui, la personne
 * ne verrait personne et ne serait vue de personne. Si l'adresse correspond
 * à une candidature, le reste — photo, âge, métier — suit tout seul.
 */
export async function ajouterUnePersonne(options: {
  soireeId: string;
  email: string;
  first_name: string;
  gender: Genre;
  birth_date?: string | null;
}): Promise<BilanImport> {
  const email = options.email.trim().toLowerCase();

  const { data: membre } = await supabaseAdmin()
    .from('lil_members')
    .select('id, email, first_name, birth_date, gender, orientation')
    .eq('email', email)
    .maybeSingle();

  const ajoutes = await inscrire(options.soireeId, [
    {
      id: membre?.id ?? null,
      email,
      // Ce que la candidature sait prime sur ce qu'on vient de taper : elle
      // a été remplie par l'intéressé, pas par l'organisateur pressé.
      first_name: membre?.first_name ?? options.first_name.trim(),
      birth_date: membre?.birth_date ?? options.birth_date ?? null,
      gender: (membre?.gender as Genre | undefined) ?? options.gender,
      orientation: (membre?.orientation as Orientation | undefined) ?? 'hetero',
    },
  ]);

  return bilan(options.soireeId, 1, ajoutes, 0);
}

/**
 * Composer la soirée à partir du fichier de la billetterie.
 *
 * Le CSV ne porte guère plus que des adresses, et c'est suffisant : on
 * rapproche sur l'email, et une personne qui a rempli le questionnaire
 * arrive avec son profil complet sans rien ressaisir.
 */
export async function creerCrushTime(options: {
  soireeId: string;
  csv: string;
  heures?: string[];
}): Promise<BilanImport> {
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

  const { data: membres, error } = await supabaseAdmin()
    .from('lil_members')
    .select('id, email, first_name, birth_date, gender, orientation')
    .in('email', attendus);
  if (error) throw new Error(error.message);

  const parEmail = new Map((membres ?? []).map((m) => [String(m.email).toLowerCase(), m]));

  const candidats: Candidat[] = attendus.map((email) => {
    const membre = parEmail.get(email);
    return {
      id: membre?.id ?? null,
      email,
      first_name: membre?.first_name ?? emails.get(email) ?? null,
      birth_date: membre?.birth_date ?? null,
      gender: (membre?.gender as Genre | undefined) ?? null,
      orientation: (membre?.orientation as Orientation | undefined) ?? null,
    };
  });

  const ajoutes = await inscrire(options.soireeId, candidats);
  const manches = await poserManches(options.soireeId, options.heures ?? []);

  return bilan(options.soireeId, attendus.length, ajoutes, manches);
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
    .is('retire_at', null)
    .maybeSingle();
  return (data as Participant | null) ?? null;
}

/**
 * Combien d'essais pour une même adresse, et depuis quand.
 *
 * Quatre chiffres se devinent en dix mille coups. Dix essais par quart
 * d'heure suffisent largement à quelqu'un qui lit mal son mail, et
 * ramènent la devinette à plusieurs jours de patience. En mémoire : le
 * serveur est unique, et une table pour ça serait du bruit.
 */
const essais = new Map<string, { nombre: number; depuis: number }>();
const FENETRE = 15 * 60_000;
const MAX_ESSAIS = 10;

function tropDEssais(email: string): boolean {
  const vu = essais.get(email);
  const maintenant = Date.now();

  if (!vu || maintenant - vu.depuis > FENETRE) {
    essais.set(email, { nombre: 1, depuis: maintenant });
    return false;
  }

  vu.nombre += 1;
  return vu.nombre > MAX_ESSAIS;
}

/**
 * Entrer avec son adresse et son code.
 *
 * Le QR de la salle est le même pour tout le monde — cinquante QR
 * personnels coûtent trop cher à imprimer — alors il mène ici, et c'est le
 * code reçu par mail qui dit qui l'on est.
 *
 * Le code de la soirée reste accepté : c'est le filet de l'hôte pour celui
 * qui ne retrouve plus son mail au milieu du bruit. À n'annoncer que dans
 * ce cas, puisqu'il ouvre la porte de n'importe quelle adresse de la liste.
 */
export async function entrerAvecCode(
  email: string,
  code: string,
): Promise<Participant | null> {
  const adresse = email.trim().toLowerCase();
  if (tropDEssais(adresse)) return null;

  const soiree = await soireeActive();
  if (!soiree) return null;

  const { data } = await supabaseAdmin()
    .from('lil_crush_participants')
    .select('*')
    .eq('soiree_id', soiree.id)
    .eq('email', adresse)
    .is('retire_at', null)
    .maybeSingle();

  const participant = (data as Participant | null) ?? null;
  if (!participant) return null;

  const propose = code.trim();
  const sien = (participant.code ?? '').trim();
  const celuiDeLaSoiree = (soiree.crush_code ?? '').trim();

  const bon = (sien && propose === sien) || (celuiDeLaSoiree && propose === celuiDeLaSoiree);
  if (!bon) return null;

  // Entrée réussie : on rend ses essais à la personne.
  essais.delete(adresse);
  return participant;
}

/* ====================================================================
   Les manches
   ==================================================================== */

export { estOuverte, finPrevue, DUREE_PAR_DEFAUT } from './manches';

export type Manche = {
  id: string;
  numero: number;
  prevu_a: string;
  ouvert_at: string | null;
  ferme_at: string | null;
  /** Facultative : la colonne n'existe qu'une fois 15_duree_manches.sql passé. */
  duree_minutes?: number | null;
};

export async function manches(soireeId: string): Promise<Manche[]> {
  // « * » plutôt qu'une liste : duree_minutes peut ne pas exister encore,
  // et une colonne nommée mais absente ferait échouer toute la page.
  const { data } = await supabaseAdmin()
    .from('lil_crush_rounds')
    .select('*')
    .eq('soiree_id', soireeId)
    .order('numero', { ascending: true });
  return (data ?? []) as Manche[];
}

/* ====================================================================
   Les profils, les likes, les matchs
   ==================================================================== */

export type Profil = {
  id: string;
  first_name: string;
  /**
   * Les trois premières lettres du nom, comme le demande le formulaire.
   * De quoi distinguer deux Thomas sans livrer l'identité de personne.
   */
  nom: string | null;
  age: number | null;
  photo: string | null;
  profession: string | null;
  city: string | null;
  about: string | null;
  /** De quoi se retrouver. Jamais avant le match — sinon le jeu n'en est plus un. */
  email?: string;
  phone?: string | null;
  instagram?: string | null;
  /** Toutes ses photos, dans l'ordre. Réservé aux matchs, comme le contact. */
  photos?: string[];
  /** L'identifiant du match, quand ce profil en vient d'un. */
  matchId?: string;
};

/** « Haddad » devient « Had. ». Vide ou trop court, rien du tout. */
function abreger(nom: string | null | undefined): string | null {
  const propre = (nom ?? '').trim();
  if (propre.length < 2) return null;
  return propre.length <= 3 ? propre : `${propre.slice(0, 3)}.`;
}

/** Les participants qu'une personne peut voir, avec leur photo. */
export async function profilsPour(moi: Participant): Promise<Profil[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('lil_crush_participants')
    .select('*')
    .eq('soiree_id', moi.soiree_id)
    .is('retire_at', null);

  const visibles = ((data ?? []) as Participant[]).filter((autre) => peutVoir(moi, autre));
  return habiller(visibles);
}

/**
 * Photo, métier, présentation : tout vient de la candidature d'origine.
 *
 * Le moyen de recontacter quelqu'un n'est joint qu'après un match. Pendant
 * le crush time, on ne doit pas pouvoir court-circuiter le jeu en écrivant
 * directement à la personne qu'on vient de repérer.
 */
async function habiller(
  participants: Participant[],
  options: { contact?: boolean } = {},
): Promise<Profil[]> {
  const ids = participants.map((p) => p.member_id).filter((id): id is string => Boolean(id));
  const db = supabaseAdmin();

  const [{ data: membres }, { data: photos }] = await Promise.all([
    ids.length
      ? db
          .from('lil_members')
          .select('id, profession, city, about, instagram, phone, last_name')
          .in('id', ids)
      : Promise.resolve({
          data: [] as {
            id: string;
            profession: string;
            city: string | null;
            about: string;
            instagram: string | null;
            phone: string | null;
            last_name: string | null;
          }[],
        }),
    ids.length
      ? db.from('lil_photos').select('id, member_id, position').in('member_id', ids)
      : Promise.resolve({ data: [] as { id: string; member_id: string; position: number }[] }),
  ]);

  const infos = new Map((membres ?? []).map((m) => [m.id, m]));
  const premiere = new Map<string, string>();
  const toutes = new Map<string, string[]>();
  for (const photo of [...(photos ?? [])].sort((a, b) => a.position - b.position)) {
    const lien = lienPhoto(photo.id, 'crush', 'carte');
    if (!premiere.has(photo.member_id)) premiere.set(photo.member_id, lien);
    toutes.set(photo.member_id, [...(toutes.get(photo.member_id) ?? []), lien]);
  }

  return participants.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    // Trois lettres, pas une de plus : les anciennes candidatures n'ont pas
    // de nom du tout, et une chaîne vide ne doit pas s'afficher comme un
    // point en l'air.
    nom: abreger(p.member_id ? infos.get(p.member_id)?.last_name : null),
    age: age(p.birth_date),
    photo: p.member_id ? (premiere.get(p.member_id) ?? null) : null,
    profession: p.member_id ? (infos.get(p.member_id)?.profession ?? null) : null,
    city: p.member_id ? (infos.get(p.member_id)?.city ?? null) : null,
    about: p.member_id ? (infos.get(p.member_id)?.about ?? null) : null,
    ...(options.contact
      ? {
          email: p.email,
          phone: p.member_id ? (infos.get(p.member_id)?.phone ?? null) : null,
          instagram: p.member_id ? (infos.get(p.member_id)?.instagram ?? null) : null,
          photos: p.member_id ? (toutes.get(p.member_id) ?? []) : [],
        }
      : {}),
  }));
}

export type ResultatLike =
  | { ok: true; match: Profil | null }
  | { ok: false; raison: string };

/**
 * Liker quelqu'un — une seule personne par manche, et c'est définitif.
 *
 * Pas de retour en arrière : c'est ce qui donne au like sa valeur. Trois
 * manches, trois choix, qu'on assume. L'écran demande confirmation avant
 * d'écrire, parce qu'un geste irréversible se mérite.
 *
 * Un match ne regarde pas la manche : si elle l'a liké à 20h et qu'il la
 * like à minuit, c'est un match. Avec un seul like par manche, exiger que
 * les deux se croisent au même moment ne laisserait presque aucune chance.
 */
export async function liker(moi: Participant, versId: string): Promise<ResultatLike> {
  const db = supabaseAdmin();

  // Les manches et la personne visée ne dépendent pas l'une de l'autre :
  // les demander l'une après l'autre coûtait un aller-retour de plus, et
  // ce geste-là doit être le plus court de l'application.
  const [toutes, { data: cibleBrute }] = await Promise.all([
    manches(moi.soiree_id),
    db.from('lil_crush_participants').select('*').eq('id', versId).maybeSingle(),
  ]);

  const manche = toutes.find((m) => estOuverte(m));
  if (!manche) return { ok: false, raison: 'Le crush time n’est pas ouvert.' };

  const cible = cibleBrute as Participant | null;
  if (!cible || cible.soiree_id !== moi.soiree_id || cible.retire_at || !peutVoir(moi, cible)) {
    return { ok: false, raison: 'Ce profil n’est pas disponible.' };
  }

  // Un insert sec, jamais un upsert : si la contrainte d'unicité refuse,
  // c'est que le choix de cette manche est déjà fait, et il ne se reprend
  // pas. C'est la base qui tient la règle, pas la lecture qui précède.
  const { error } = await db
    .from('lil_crush_likes')
    .insert({ round_id: manche.id, de_id: moi.id, vers_id: versId });

  if (error) {
    const dejaChoisi = error.code === '23505';
    return {
      ok: false,
      raison: dejaChoisi ? 'Tu as déjà fait ton choix pour ce crush time.' : error.message,
    };
  }

  // Est-ce qu'elle ou il m'a liké ce soir, dans n'importe quelle manche ?
  const { data: retour } = await db
    .from('lil_crush_likes')
    .select('id')
    .in('round_id', toutes.map((m) => m.id))
    .eq('de_id', versId)
    .eq('vers_id', moi.id)
    .limit(1);

  if (!retour?.length) return { ok: true, match: null };

  // La paire est rangée par identifiant croissant : deux clics simultanés
  // ne peuvent pas créer deux matchs pour un seul couple.
  const [a_id, b_id] = [moi.id, versId].sort();
  const { error: eMatch } = await db
    .from('lil_crush_matches')
    .upsert(
      {
        soiree_id: moi.soiree_id,
        round_id: manche.id,
        a_id,
        b_id,
        // Mon côté est noté vu dès l'écriture : la fête s'affiche sous mes
        // yeux dans la seconde, elle n'a pas à m'être rejouée demain. Le
        // côté de l'autre reste vide — c'est lui qui déclenchera l'annonce
        // à sa prochaine ouverture.
        [a_id === moi.id ? 'vu_a_at' : 'vu_b_at']: new Date().toISOString(),
      },
      { onConflict: 'soiree_id,a_id,b_id', ignoreDuplicates: true },
    );
  if (eMatch) return { ok: false, raison: eMatch.message };

  // Les deux côtés sont prévenus, une seule fois. Celui qui vient de
  // cliquer le voit déjà à l'écran ; l'autre n'a peut-être pas son
  // téléphone en main, et c'est le moment de la soirée.
  await previenirDuMatch(moi, cible);

  const [profil] = await habiller([cible], { contact: true });
  return { ok: true, match: profil ?? null };
}

/**
 * Annoncer un match aux deux personnes.
 *
 * Le prénom de l'autre voyage dans chaque message : « c'est un match »
 * tout seul fait sortir le téléphone pour rien, et la notification
 * s'affiche parfois sur un écran verrouillé que d'autres regardent.
 */
async function previenirDuMatch(a: Participant, b: Participant): Promise<void> {
  const db = supabaseAdmin();
  const [a_id, b_id] = [a.id, b.id].sort();

  const { data: match } = await db
    .from('lil_crush_matches')
    .select('id, notifie_at')
    .eq('soiree_id', a.soiree_id)
    .eq('a_id', a_id)
    .eq('b_id', b_id)
    .maybeSingle();

  if (!match || match.notifie_at) return;

  await Promise.all([
    notifier([a.id], {
      titre: `C'est un match avec ${b.first_name}`,
      corps: 'Ses coordonnées sont dans l’application.',
      lien: '/crush',
      etiquette: `match-${match.id}`,
    }),
    notifier([b.id], {
      titre: `C'est un match avec ${a.first_name}`,
      corps: 'Ses coordonnées sont dans l’application.',
      lien: '/crush',
      etiquette: `match-${match.id}`,
    }),
  ]);

  await db
    .from('lil_crush_matches')
    .update({ notifie_at: new Date().toISOString() })
    .eq('id', match.id);
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

/**
 * Les matchs dont je n'ai pas encore vu l'annonce.
 *
 * Celui qui ferme la boucle voit son match tout de suite ; l'autre a
 * peut-être le téléphone en poche. L'annonce l'attend donc, et se rejoue à
 * sa prochaine ouverture — c'est le moment de la soirée, il ne doit pas se
 * perdre dans une liste.
 */
export async function matchsNonVus(moi: Participant): Promise<Profil[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('lil_crush_matches')
    .select('id, a_id, b_id, vu_a_at, vu_b_at')
    .or(`a_id.eq.${moi.id},b_id.eq.${moi.id}`)
    .order('created_at', { ascending: true });

  const attendus = (data ?? []).filter((m) =>
    m.a_id === moi.id ? !m.vu_a_at : !m.vu_b_at,
  );
  if (attendus.length === 0) return [];

  const { data: gens } = await db
    .from('lil_crush_participants')
    .select('*')
    .in(
      'id',
      attendus.map((m) => (m.a_id === moi.id ? m.b_id : m.a_id)),
    );

  const profils = await habiller((gens ?? []) as Participant[], { contact: true });
  const parId = new Map(profils.map((p) => [p.id, p]));

  const sortie: Profil[] = [];
  for (const m of attendus) {
    const autre = parId.get(m.a_id === moi.id ? m.b_id : m.a_id);
    if (autre) sortie.push({ ...autre, matchId: m.id });
  }
  return sortie;
}

/** Noter que l'annonce a été vue, du bon côté. */
export async function marquerMatchVu(moi: Participant, matchId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: match } = await db
    .from('lil_crush_matches')
    .select('a_id, b_id')
    .eq('id', matchId)
    .maybeSingle();
  if (!match) return;

  const cote = match.a_id === moi.id ? 'vu_a_at' : match.b_id === moi.id ? 'vu_b_at' : null;
  if (!cote) return;

  await db
    .from('lil_crush_matches')
    .update({ [cote]: new Date().toISOString() })
    .eq('id', matchId);
}

/** Moi, tel que les autres me voient. */
export async function monProfil(moi: Participant): Promise<Profil | null> {
  const [profil] = await habiller([moi]);
  return profil ?? null;
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
  return habiller((gens ?? []) as Participant[], { contact: true });
}

/* ====================================================================
   Tenir la liste, le soir même
   ==================================================================== */

export type LigneParticipant = Participant & {
  photo: string | null;
  /** Son téléphone est-il abonné aux notifications ? */
  notifiable: boolean;
};

/** Tout le monde, retirés compris : c'est la liste d'émargement de l'hôte. */
export async function participants(soireeId: string): Promise<LigneParticipant[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('lil_crush_participants')
    .select('*')
    .eq('soiree_id', soireeId)
    .order('first_name', { ascending: true });

  const gens = (data ?? []) as Participant[];
  const ids = gens.map((p) => p.member_id).filter((id): id is string => Boolean(id));

  const [{ data: photos }, { data: abonnes }] = await Promise.all([
    ids.length
      ? db.from('lil_photos').select('id, member_id, position').in('member_id', ids)
      : Promise.resolve({ data: [] as { id: string; member_id: string; position: number }[] }),
    // Qui a vraiment posé l'application et accordé la permission. C'est la
    // seule façon de savoir, avant la soirée, combien de téléphones
    // sonneront — et de voir tout de suite si la chaîne est cassée.
    db
      .from('lil_crush_push')
      .select('participant_id')
      .in(
        'participant_id',
        gens.map((p) => p.id),
      ),
  ]);

  const premiere = new Map<string, string>();
  for (const photo of [...(photos ?? [])].sort((a, b) => a.position - b.position)) {
    if (!premiere.has(photo.member_id)) {
      premiere.set(photo.member_id, lienPhoto(photo.id, 'admin', 'vignette'));
    }
  }

  const notifiables = new Set((abonnes ?? []).map((a) => a.participant_id));

  return gens.map((p) => ({
    ...p,
    photo: p.member_id ? (premiere.get(p.member_id) ?? null) : null,
    notifiable: notifiables.has(p.id),
  }));
}

/**
 * Retirer quelqu'un qui n'est pas venu.
 *
 * C'est l'appel, fait à la porte avant d'ouvrir le premier crush time :
 * quelqu'un qui a payé sans venir occuperait sinon une place dans les
 * profils toute la soirée, et recevrait des likes perdus.
 *
 * Ses likes partent avec lui — en pratique il n'en a aucun à ce moment-là,
 * mais si on retire quelqu'un plus tard, celui qui l'avait choisi récupère
 * son choix pour la manche en cours au lieu d'attendre un match impossible.
 * Les matchs déjà faits, eux, restent : ils appartiennent aussi à l'autre.
 */
export async function retirer(participantId: string): Promise<void> {
  const db = supabaseAdmin();

  const { error } = await db
    .from('lil_crush_participants')
    .update({ retire_at: new Date().toISOString() })
    .eq('id', participantId);
  if (error) throw new Error(error.message);

  const { error: eLikes } = await db
    .from('lil_crush_likes')
    .delete()
    .or(`de_id.eq.${participantId},vers_id.eq.${participantId}`);
  if (eLikes) throw new Error(eLikes.message);
}

/** Il était bien là, finalement. */
export async function remettre(participantId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('lil_crush_participants')
    .update({ retire_at: null })
    .eq('id', participantId);
  if (error) throw new Error(error.message);
}

/* ====================================================================
   Ouvrir et fermer une manche
   ==================================================================== */

/**
 * Ouvrir ce dont l'heure est venue.
 *
 * L'hôte lance la première manche à la main ; les suivantes s'ouvrent
 * seules à l'heure annoncée. Rien ne part avant ce premier geste — une
 * soirée qui démarre toute seule parce qu'on a oublié de corriger une
 * heure est pire qu'une soirée qui attend.
 *
 * Appelée depuis la veille des participants, donc potentiellement par
 * cinquante téléphones à la même seconde. D'où l'écriture conditionnelle :
 * « ouvre si ce n'est pas déjà ouvert » est une seule instruction côté
 * base, et seul celui qui récupère la ligne envoie la notification.
 */
export async function ouvrirCeQuiDoitLEtre(soireeId: string): Promise<void> {
  const toutes = await manches(soireeId);

  // Rien tant que l'hôte n'a pas donné le départ.
  if (!toutes.some((m) => m.ouvert_at)) return;

  const maintenant = Date.now();
  const due = toutes.find(
    (m) => !m.ouvert_at && !m.ferme_at && new Date(m.prevu_a).getTime() <= maintenant,
  );
  if (!due) return;

  // Une manche déjà ouverte ailleurs ne doit pas se rouvrir : on ne touche
  // que si ouvert_at est encore vide, et la base arbitre.
  const { data } = await supabaseAdmin()
    .from('lil_crush_rounds')
    .update({ ouvert_at: new Date().toISOString() })
    .eq('id', due.id)
    .is('ouvert_at', null)
    .select('id')
    .maybeSingle();

  if (data) await previenirOuverture(due.id);
}

/** Deux ouvertures à moins d'une minute : c'est le même geste, hésitant. */
const REPIT_NOTIFICATION = 60_000;

/**
 * Ouvrir une manche, et prévenir la salle.
 *
 * Rouvrir prévient de nouveau : c'est ce qu'on veut en essai, et c'est
 * aussi ce qu'on veut le soir même — une manche rouverte parce qu'on
 * l'avait fermée trop tôt doit se redire. Ce qu'on refuse, c'est le double
 * appui : deux ouvertures à moins d'une minute d'intervalle ne font sonner
 * la salle qu'une fois.
 *
 * La notification part après l'écriture — annoncer un crush time qui ne
 * s'est pas ouvert serait pire que de ne rien annoncer.
 */
export async function ouvrirManche(mancheId: string): Promise<void> {
  const { data: manche, error } = await supabaseAdmin()
    .from('lil_crush_rounds')
    .update({ ouvert_at: new Date().toISOString(), ferme_at: null })
    .eq('id', mancheId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (manche) await previenirOuverture(mancheId);
}

/**
 * Prévenir la salle qu'une manche s'ouvre.
 *
 * Après l'écriture, jamais avant : annoncer un crush time qui ne s'est pas
 * ouvert serait pire que de ne rien annoncer.
 */
async function previenirOuverture(mancheId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: manche } = await db
    .from('lil_crush_rounds')
    .select('*')
    .eq('id', mancheId)
    .maybeSingle();
  if (!manche) return;

  const derniere = manche.notifie_at ? new Date(manche.notifie_at).getTime() : 0;
  if (Date.now() - derniere < REPIT_NOTIFICATION) return;

  const { data: gens } = await db
    .from('lil_crush_participants')
    .select('id')
    .eq('soiree_id', manche.soiree_id)
    .is('retire_at', null);

  const minutes = manche.duree_minutes ?? DUREE_PAR_DEFAUT;
  await notifier(
    (gens ?? []).map((p) => p.id),
    {
      titre: `${nomManche(manche.numero)}, c'est parti`,
      corps: `${minutes} minutes pour choisir une personne.`,
      lien: '/crush',
      etiquette: 'crush-manche',
    },
  );

  await db
    .from('lil_crush_rounds')
    .update({ notifie_at: new Date().toISOString() })
    .eq('id', mancheId);
}

export async function fermerManche(mancheId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('lil_crush_rounds')
    .update({ ferme_at: new Date().toISOString() })
    .eq('id', mancheId);
  if (error) throw new Error(error.message);
}

/**
 * Ouvrir le crush time d'une soirée, et refermer celui d'avant.
 *
 * Un seul à la fois, garanti par un index unique : deux crush times ouverts
 * voudraient dire deux salles, et ce n'est jamais arrivé. On éteint donc
 * avant d'allumer.
 */
export async function activerCrushTime(soireeId: string, code: string): Promise<void> {
  const db = supabaseAdmin();
  const { error: extinction } = await db
    .from('lil_soirees')
    .update({ crush_actif: false })
    .eq('crush_actif', true);
  if (extinction) throw new Error(extinction.message);

  const { error } = await db
    .from('lil_soirees')
    .update({ crush_actif: true, crush_code: code })
    .eq('id', soireeId);
  if (error) throw new Error(error.message);
}

/**
 * Une notification d'essai, à une seule personne.
 *
 * « Ça ne marche pas » peut vouloir dire six choses : clés absentes,
 * application non installée, permission refusée, abonnement perdu, envoi
 * refusé par le service, téléphone en silencieux. Ce bouton répond à la
 * question en deux secondes au lieu d'une soirée.
 */
export async function essaiNotification(
  participantId: string,
): Promise<{ envoyees: number; mortes: number }> {
  return notifier([participantId], {
    titre: 'Lille in Love',
    corps: 'Essai : si tu lis ceci, les notifications fonctionnent.',
    lien: '/crush',
    etiquette: 'crush-essai',
  });
}

/**
 * Régler les manches pour un essai, ou pour de vrai.
 *
 * Un essai ne se joue pas à 21h, 22h30 et 23h45 : on veut voir les trois
 * manches s'enchaîner tout de suite. Plutôt que de faire recalculer trois
 * heures à la main — et de se tromper —, on les pose ici : la première
 * maintenant, les suivantes à la file.
 *
 * Les heures ne font que décrire quand une manche devrait s'ouvrir. L'hôte
 * lance la première à la main ; c'est ce geste qui arme la suite.
 */
export async function reglerLesManches(options: {
  soireeId: string;
  dureeMinutes: number;
  /** Minutes entre la fin d'une manche et le début de la suivante. */
  pauseMinutes: number;
  /** D'où part la série. Par défaut, maintenant. */
  depart?: Date;
}): Promise<number> {
  const db = supabaseAdmin();
  const toutes = await manches(options.soireeId);
  if (toutes.length === 0) return 0;

  const depart = options.depart ?? new Date();
  const pas = (options.dureeMinutes + options.pauseMinutes) * 60_000;

  await Promise.all(
    toutes.map((manche, index) =>
      db
        .from('lil_crush_rounds')
        .update({
          prevu_a: new Date(depart.getTime() + index * pas).toISOString(),
          duree_minutes: options.dureeMinutes,
          // On repart de zéro : une manche déjà jouée ne doit pas rester
          // close, ni se croire déjà annoncée.
          ouvert_at: null,
          ferme_at: null,
          notifie_at: null,
        })
        .eq('id', manche.id),
    ),
  );

  return toutes.length;
}
