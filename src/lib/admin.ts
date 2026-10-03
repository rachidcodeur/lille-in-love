import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';
import { supabaseAdmin } from './supabase';
import { rattraperEnvoisPasses } from './mailer';
import type { FicheFiltrable, Filtres, Groupe } from './groupes';

/* ====================================================================
   Accès au back-office
   ==================================================================== */

export const ADMIN_COOKIE = 'lil_admin';

function expectedToken(code: string): string {
  // Le cookie ne contient jamais le code lui-même, seulement son empreinte.
  return createHmac('sha256', code).update('lil-admin-v1').digest('hex');
}

export function tokenFor(code: string): string {
  return expectedToken(code);
}

export function codeMatches(candidate: string): boolean {
  const code = env.adminCode();
  if (!code) return true;
  const a = Buffer.from(candidate);
  const b = Buffer.from(code);
  // Comparaison à durée constante : on ne laisse pas deviner le code
  // caractère par caractère en mesurant le temps de réponse.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Le back-office est-il ouvert à cette requête ?
 *
 * Sans ADMIN_CODE, l'accès est libre — c'est le réglage actuel. Renseigner
 * cette variable suffit à fermer l'interface, sans toucher au code.
 */
export async function isAdminAllowed(): Promise<boolean> {
  const code = env.adminCode();
  if (!code) return true;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === expectedToken(code);
}

/* ====================================================================
   Lecture des candidatures
   ==================================================================== */

export type MemberSummary = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  gender: 'femme' | 'homme';
  city: string | null;
  age: number | null;
  status: string;
  form_version: 'court' | 'complet';
  deleted_at?: string | null;
  /** Groupe de composition d'une soirée : A, B ou C. Vide tant qu'on n'a pas trié. */
  soiree_group: Groupe | null;
  /**
   * Candidature reprise de l'ancien site. Facultative : la colonne n'existe
   * qu'une fois supabase/12_anciennes.sql exécuté.
   */
  legacy?: boolean;
  suspect: boolean;
  photo_count: number;
  votes_oui: number;
  votes_total: number;
};

export type MemberDetail = MemberSummary & {
  /** Date de mise à la corbeille, ou null si la candidature est active. */
  deleted_at: string | null;
  suspect_raison: string | null;
  postal_code: string | null;
  children_preference: string | null;
  orientation: string | null;
  has_children: boolean | null;
  looking_for: string | null;
  height_cm: number | null;
  about: string | null;
  motivation: string | null;
  interests: string[] | null;
  interests_other: string | null;
  zodiac: string | null;
  profession: string | null;
  instagram: string | null;
  comes_with: boolean | null;
  companion_first_name: string | null;
  companion_email: string | null;
  referral: string | null;
  phone: string | null;
  birth_date: string | null;
  decided_at: string | null;
  welcomed_at: string | null;
  admin_notes: string | null;
  source: string | null;
};

export type EmailLogRow = {
  id: string;
  template: string;
  subject: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
  /** La soirée dont la publication a déclenché cet email, s'il y en a une. */
  soiree_nom?: string | null;
};

/**
 * Applique les filtres de la liste à une requête sur la vue de travail.
 *
 * La recherche fait exception : « ilike » ne sait pas ignorer les accents,
 * et une base de prénoms français s'y rendrait à moitié introuvable. Elle se
 * fait donc en mémoire, sur la lecture légère qui sert déjà aux compteurs,
 * et on ne transmet ici que les identifiants retenus. Un seul endroit décide
 * de ce qui correspond, donc la liste et les compteurs ne peuvent plus se
 * contredire.
 */
function filtrer<Q extends {
  eq(colonne: string, valeur: string): Q;
  in(colonne: string, valeurs: string[]): Q;
  is(colonne: string, valeur: null): Q;
  or(conditions: string): Q;
  gte(colonne: string, valeur: number): Q;
  lte(colonne: string, valeur: number): Q;
}>(query: Q, filtres: Filtres, idsRecherche?: string[]): Q {
  // La corbeille ne se mêle jamais aux listes : ni dans les fiches, ni dans
  // les compteurs, ni dans l'export.
  let q = query.is('deleted_at', null);

  if (filtres.recherche) {
    // Une liste vide ne doit rien ramener, et non tout ramener.
    q = q.in('id', idsRecherche ?? []);
  }

  if (filtres.statut !== 'tous') q = q.eq('status', filtres.statut);

  // Plusieurs groupes à la fois, « sans groupe » compris. Les trois cas sont
  // séparés parce que « in » ne sait pas tester un vide : en SQL, null n'est
  // égal à rien, pas même à lui-même.
  if (filtres.groupes.length > 0) {
    const lettres = filtres.groupes.filter((g) => g !== 'aucun');
    const sansGroupe = filtres.groupes.includes('aucun');

    if (sansGroupe && lettres.length === 0) q = q.is('soiree_group', null);
    else if (!sansGroupe) q = q.in('soiree_group', lettres);
    else q = q.or(`soiree_group.in.(${lettres.join(',')}),soiree_group.is.null`);
  }

  if (filtres.genre !== 'tous') q = q.eq('gender', filtres.genre);

  // « autre » veut dire tout sauf gay, sans oublier celles et ceux à qui on
  // n'a pas posé la question : en SQL, « différent de gay » écarte les vides.
  if (filtres.orientation === 'gay') q = q.eq('orientation', 'gay');
  else if (filtres.orientation === 'autre') q = q.or('orientation.neq.gay,orientation.is.null');

  // L'âge est calculé par la vue : une fiche sans date de naissance
  // (formulaire court) sort dès qu'une borne est posée. C'est voulu — mieux
  // vaut l'absence qu'un âge supposé.
  if (filtres.ageMin !== null) q = q.gte('age', filtres.ageMin);
  if (filtres.ageMax !== null) q = q.lte('age', filtres.ageMax);

  return q;
}

/** Une colonne que la base ne connaît pas encore : une migration en attente. */
function colonneAbsente(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || /does not exist/i.test(error.message ?? '');
}

export async function listMembers(
  filtres: Filtres,
  limite = 300,
  idsRecherche?: string[],
): Promise<MemberSummary[]> {
  // « * » plutôt qu'une liste de colonnes : la vue peut ne pas encore avoir
  // celles de supabase/04_signalement.sql, et une liste explicite ferait
  // échouer toute la page pour une colonne manquante.
  //
  // L'ordre : les candidatures du site actuel d'abord, les reprises de
  // l'ancien ensuite — et dans chaque bloc, la dernière arrivée en tête. En
  // SQL false précède true, donc « legacy asc » met les nouvelles devant.
  const construire = (avecAnciennes: boolean) => {
    const base = supabaseAdmin().from('lil_members_overview').select('*');
    const triee = avecAnciennes ? base.order('legacy', { ascending: true }) : base;
    return filtrer(
      triee.order('created_at', { ascending: false }).limit(limite),
      filtres,
      idsRecherche,
    );
  };

  const { data, error } = await construire(true);
  if (!error) return (data ?? []) as MemberSummary[];

  // supabase/12_anciennes.sql pas encore passé : la liste reste utilisable,
  // simplement sans son intertitre.
  if (!colonneAbsente(error)) throw new Error(error.message);

  const secours = await construire(false);
  if (secours.error) throw new Error(secours.error.message);
  return (secours.data ?? []) as MemberSummary[];
}

/**
 * Les fiches complètes de la sélection, pour l'export CSV.
 *
 * Rangées comme l'équipe les lit : groupe, puis femmes et hommes, puis âge.
 * Pas de limite de page ici — un export tronqué ne se voit pas.
 */
export async function membersForExport(
  filtres: Filtres,
  idsRecherche?: string[],
): Promise<MemberDetail[]> {
  const query = supabaseAdmin()
    .from('lil_members_overview')
    .select('*')
    .order('soiree_group', { ascending: true, nullsFirst: false })
    .order('gender', { ascending: true })
    .order('age', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(5000);

  const { data, error } = await filtrer(query, filtres, idsRecherche);
  if (error) throw new Error(error.message);
  return (data ?? []) as MemberDetail[];
}

/**
 * De quoi compter chaque filtre sans relire toute la base.
 *
 * Quatre colonnes suffisent : les compteurs affichés à côté de chaque bouton
 * se calculent ensuite en mémoire, filtre par filtre.
 */
export async function facettes(): Promise<FicheFiltrable[]> {
  const { data, error } = await supabaseAdmin()
    .from('lil_members_overview')
    .select('id, status, soiree_group, gender, orientation, age, first_name, last_name, email, city')
    .is('deleted_at', null)
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as FicheFiltrable[];
}

/**
 * Range une candidature dans un groupe de soirée — ou l'en retire.
 *
 * C'est une étiquette de travail : aucun email ne part, le statut ne bouge
 * pas. On peut donc se tromper et corriger sans conséquence.
 */
export async function setGroup(memberId: string, groupe: Groupe | null): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('lil_members')
    .update({ soiree_group: groupe })
    .eq('id', memberId);
  if (error) throw new Error(error.message);
}

export async function getMember(id: string): Promise<MemberDetail | null> {
  const { data, error } = await supabaseAdmin()
    .from('lil_members_overview')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MemberDetail | null) ?? null;
}

export async function getEmailLog(memberId: string): Promise<EmailLogRow[]> {
  const db = supabaseAdmin();
  // « * » : soiree_id n'existe qu'une fois supabase/05_soirees.sql exécuté.
  const { data, error } = await db
    .from('lil_emails')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as (EmailLogRow & { soiree_id?: string | null; resend_id?: string | null })[];

  // Les envois programmés dont l'heure est passée : on vérifie chez Resend
  // qu'ils sont bien partis, pour ne pas afficher « Programmé » à tort.
  const majs = await rattraperEnvoisPasses(rows);
  for (const r of rows) {
    const maj = majs.get(r.id);
    if (maj) Object.assign(r, maj);
  }

  // Le nom de la soirée, pour savoir d'où vient un 03 ou un 04. Une requête à
  // part plutôt qu'une jointure : la fiche doit s'afficher même si la table
  // des soirées n'existe pas encore.
  const ids = [...new Set(rows.map((r) => r.soiree_id).filter((id): id is string => Boolean(id)))];
  if (ids.length > 0) {
    const { data: soirees } = await db.from('lil_soirees').select('id, nom').in('id', ids);
    const noms = new Map((soirees ?? []).map((s) => [s.id as string, s.nom as string]));
    for (const r of rows) r.soiree_nom = r.soiree_id ? (noms.get(r.soiree_id) ?? null) : null;
  }

  return rows;
}

/**
 * L'adresse d'une photo dans le back-office.
 *
 * Elle ne change pas d'une visite à l'autre — c'est tout l'intérêt. Une URL
 * signée par Supabase porte un jeton différent à chaque rendu : le navigateur
 * n'y reconnaît jamais deux fois la même image et retélécharge tout. Celle-ci
 * passe par src/app/admin/photo/[id], qui vérifie l'accès, va chercher le
 * fichier dans le bucket privé, et laisse le navigateur le garder un jour.
 */
export function lienPhoto(
  photoId: string,
  espace: 'admin' | 'crush' = 'admin',
  taille?: 'vignette' | 'carte' | 'pleine',
): string {
  // Deux portes pour le même fichier, parce que l'autorisation n'est pas la
  // même : le back-office demande le code d'accès, le crush time demande
  // d'être de la soirée. La taille, elle, dit ce qu'on en fait : demander
  // l'original pour une pastille de quarante pixels fait descendre trois
  // cents kilo-octets pour rien, cent quarante fois de suite.
  return `/${espace}/photo/${photoId}${taille ? `?t=${taille}` : ''}`;
}

/**
 * Une vignette par candidature, pour toute la liste, en une seule requête.
 *
 * Auparavant chaque ligne demandait la sienne : sur cent quarante fiches,
 * cela faisait presque trois cents allers-retours vers Supabase à chaque
 * affichage, dont une partie revenait bredouille — d'où les vignettes qui
 * manquaient tant qu'on n'avait pas rechargé.
 */
export async function vignettes(memberIds: string[]): Promise<Map<string, string>> {
  if (memberIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin()
    .from('lil_photos')
    .select('id, member_id, position')
    .in('member_id', memberIds)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);

  const parMembre = new Map<string, string>();
  for (const photo of data ?? []) {
    // La liste est triée par position : la première vue est la bonne.
    if (!parMembre.has(photo.member_id)) {
      parMembre.set(photo.member_id, lienPhoto(photo.id, 'admin', 'vignette'));
    }
  }
  return parMembre;
}

export type PhotoRangee = { id: string; url: string };

/**
 * Les photos d'une candidature, dans l'ordre choisi.
 *
 * L'identifiant voyage avec l'adresse : c'est lui qui sert à les ranger, et
 * la position 1 décide de ce qu'on voit partout ailleurs.
 */
export async function photosDe(memberId: string): Promise<PhotoRangee[]> {
  const { data, error } = await supabaseAdmin()
    .from('lil_photos')
    .select('id')
    .eq('member_id', memberId)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((photo) => ({ id: photo.id, url: lienPhoto(photo.id) }));
}

/**
 * Ranger les photos d'une candidature.
 *
 * Passe par une fonction de la base plutôt que par trois mises à jour :
 * échanger deux positions traverse forcément un état où deux photos se
 * disputent la même place, et seule une transaction peut l'autoriser sans
 * laisser de trace si quoi que ce soit échoue.
 */
export async function rangerPhotos(memberId: string, ordre: string[]): Promise<void> {
  const { error } = await supabaseAdmin().rpc('lil_ranger_photos', {
    p_member: memberId,
    p_ordre: ordre,
  });
  if (error) throw new Error(error.message);
}

/** Le premier curateur actif — l'accès étant libre, les votes lui sont attribués. */
export async function defaultCuratorId(): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from('lil_curators')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function listCurators(): Promise<{ id: string; full_name: string | null; email: string }[]> {
  const { data } = await supabaseAdmin()
    .from('lil_curators')
    .select('id, full_name, email')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  return data ?? [];
}
