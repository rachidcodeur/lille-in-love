/**
 * Le temps d'une manche, sans rien autour.
 *
 * Extrait de crush.ts, qui parle à Supabase : ces deux fonctions décident
 * si l'on peut encore liker, et doivent pouvoir être éprouvées seules.
 */

export type Minutee = {
  ouvert_at: string | null;
  ferme_at: string | null;
  /** Facultative : la colonne n'existe qu'une fois 15_duree_manches.sql passé. */
  duree_minutes?: number | null;
};

/** Quinze minutes, sauf mention contraire. */
export const DUREE_PAR_DEFAUT = 15;

/** L'heure à laquelle la manche se referme d'elle-même. */
export function finPrevue(m: Minutee): Date | null {
  if (!m.ouvert_at) return null;
  const minutes = m.duree_minutes ?? DUREE_PAR_DEFAUT;
  return new Date(new Date(m.ouvert_at).getTime() + minutes * 60_000);
}

/**
 * La manche est-elle ouverte, maintenant ?
 *
 * Le temps compte autant que le geste de l'hôte : une manche oubliée
 * accepterait encore des likes à minuit, ce qui viderait de son sens la
 * règle du choix unique par manche. Cette fonction sert aussi côté serveur,
 * au moment d'écrire un like — l'écran n'est pas le gardien.
 */
export function estOuverte(m: Minutee, maintenant = Date.now()): boolean {
  if (!m.ouvert_at || m.ferme_at) return false;
  const fin = finPrevue(m);
  return fin === null || maintenant < fin.getTime();
}
