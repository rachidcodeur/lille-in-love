import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';
import { supabaseAdmin } from './supabase';
import { rattraperEnvoisPasses } from './mailer';

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
  suspect: boolean;
  photo_count: number;
  votes_oui: number;
  votes_total: number;
};

export type MemberDetail = MemberSummary & {
  suspect_raison: string | null;
  postal_code: string | null;
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

export async function listMembers(status?: string): Promise<MemberSummary[]> {
  // « * » plutôt qu'une liste de colonnes : la vue peut ne pas encore avoir
  // celles de supabase/04_signalement.sql, et une liste explicite ferait
  // échouer toute la page pour une colonne manquante.
  let query = supabaseAdmin()
    .from('lil_members_overview')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (status && status !== 'tous') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MemberSummary[];
}

export async function countsByStatus(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin().from('lil_members').select('status');
  if (error) throw new Error(error.message);

  const counts: Record<string, number> = { tous: data?.length ?? 0 };
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
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
 * URLs d'affichage des photos.
 *
 * Le bucket est privé : on signe chaque accès pour une heure. Aucune photo
 * n'est jamais joignable par une URL devinable, et les liens du back-office
 * cessent de fonctionner peu après.
 */
export async function photoUrls(memberId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data: photos } = await db
    .from('lil_photos')
    .select('storage_path')
    .eq('member_id', memberId)
    .order('position', { ascending: true });

  if (!photos?.length) return [];

  const { data: signed } = await db.storage
    .from(env.storageBucket())
    .createSignedUrls(
      photos.map((p) => p.storage_path),
      3600,
    );

  // createSignedUrls renvoie une entrée par chemin, éventuellement en échec :
  // on écarte celles qui n'ont pas d'URL plutôt que d'afficher une image morte.
  return (signed ?? [])
    .map((entry) => entry.signedUrl)
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
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
