import { env } from './env';
import { supabaseAdmin } from './supabase';
import { cancelPendingDecisionEmails } from './decision';
import type { MemberSummary } from './admin';

/**
 * La corbeille.
 *
 * Supprimer une candidature, c'est effacer les réponses de quelqu'un et ses
 * photos. Un clic de trop ne doit donc pas suffire : la fiche part d'abord à
 * la corbeille, d'où elle revient intacte. L'effacement définitif est un
 * second geste, depuis la corbeille, et celui-là ne se rattrape pas.
 */

/** Met une candidature à la corbeille, et arrête ce qui devait lui partir. */
export async function mettreALaCorbeille(memberId: string): Promise<{ envoiArrete: boolean }> {
  const db = supabaseAdmin();

  // Une personne qu'on retire ne doit pas recevoir la bienvenue six heures
  // plus tard. On annule avant de ranger.
  const { echec } = await cancelPendingDecisionEmails(memberId);

  const { error } = await db
    .from('lil_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', memberId);

  if (error) throw new Error(error.message);
  return { envoiArrete: !echec };
}

export async function restaurer(memberId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('lil_members')
    .update({ deleted_at: null })
    .eq('id', memberId);
  if (error) throw new Error(error.message);
}

/**
 * Efface définitivement une candidature, photos comprises.
 *
 * Les fichiers partent en premier : une ligne sans photos vaut mieux que des
 * photos orphelines dans le bucket, que plus rien ne relierait à personne.
 * L'effacement n'est permis que depuis la corbeille — on ne supprime jamais
 * une fiche active d'un seul geste.
 */
export async function supprimerDefinitivement(memberId: string): Promise<void> {
  const db = supabaseAdmin();

  const { data: membre } = await db
    .from('lil_members')
    .select('id, deleted_at')
    .eq('id', memberId)
    .maybeSingle();

  if (!membre) throw new Error('candidature introuvable');
  if (!membre.deleted_at) throw new Error('cette candidature n’est pas à la corbeille');

  const { data: photos } = await db
    .from('lil_photos')
    .select('storage_path')
    .eq('member_id', memberId);

  if (photos?.length) {
    const { error } = await db.storage
      .from(env.storageBucket())
      .remove(photos.map((p) => p.storage_path));
    // Un fichier récalcitrant ne doit pas empêcher d'effacer la fiche : on
    // le signale, et la suppression continue.
    if (error) console.error('[corbeille] photos non effacées', error.message);
  }

  // lil_photos et lil_reviews partent en cascade ; lil_emails garde ses
  // lignes avec member_id à null, ce qui conserve l'historique d'envoi sans
  // conserver la personne.
  const { error } = await db.from('lil_members').delete().eq('id', memberId);
  if (error) throw new Error(error.message);
}

/** Ce que contient la corbeille, du plus récemment jeté au plus ancien. */
export async function listerCorbeille(): Promise<MemberSummary[]> {
  const { data, error } = await supabaseAdmin()
    .from('lil_members_overview')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);
  return (data ?? []) as MemberSummary[];
}
