import { supabaseAdmin } from './supabase';
import { normalizePhone } from './validation';

/**
 * La liste noire.
 *
 * Mettre une fiche à la corbeille la retire de la curation, mais
 * n'empêche rien : le lendemain, le même formulaire repart avec la même
 * adresse. Bloquer, c'est garder de quoi reconnaître quelqu'un — son
 * email, son numéro — et refuser l'inscription suivante.
 *
 * On ne conserve que ça, plus son nom pour que la liste reste lisible
 * une fois la fiche effacée. Tout le reste de ce qu'il avait écrit s'en
 * va avec la fiche.
 */

export type Bloque = {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  raison: string | null;
  created_at: string;
};

/** Écrit comme on interrogera : minuscules d'un côté, E.164 de l'autre. */
function pourLaBase(email?: string | null, phone?: string | null) {
  return {
    email: email?.trim().toLowerCase() || null,
    phone: phone?.trim() ? normalizePhone(phone) : null,
  };
}

/**
 * Cette adresse ou ce numéro sont-ils bloqués ?
 *
 * Appelé à chaque inscription, avant toute écriture. Une table absente —
 * migration 25 pas encore passée — ne bloque personne : on préfère
 * laisser entrer que refuser tout le monde sur une erreur technique.
 */
export async function estBloque(email: string, phone?: string | null): Promise<boolean> {
  const cherche = pourLaBase(email, phone);

  const conditions = [`email.eq.${cherche.email}`];
  if (cherche.phone) conditions.push(`phone.eq.${cherche.phone}`);

  const { data, error } = await supabaseAdmin()
    .from('lil_blacklist')
    .select('id')
    .or(conditions.join(','))
    .limit(1);

  if (error) {
    console.error('[blacklist] vérification impossible', error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Bloque quelqu'un, à partir de sa fiche.
 *
 * On cherche la ligne, puis on l'écrit — plutôt qu'un « upsert ». Les
 * index uniques de cette table sont partiels (« where email is not
 * null »), et PostgreSQL refuse d'inférer un index partiel pour un
 * ON CONFLICT : l'upsert échouait systématiquement, avec une erreur
 * 42P10 qu'on prenait pour une table absente.
 *
 * Bloquer deux fois la même personne n'est pas une erreur — c'est le
 * même résultat, et le curateur n'a pas à s'en soucier. La seconde fois
 * met simplement la ligne à jour.
 *
 * Rend « false » si l'écriture n'a pas abouti : le geste n'a pas eu
 * lieu, et l'écran doit le dire plutôt que de laisser croire au
 * contraire. La raison est journalisée telle que la base l'a donnée.
 */
export async function bloquer(
  membre: {
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
  },
  raison?: string,
): Promise<boolean> {
  const cle = pourLaBase(membre.email, membre.phone);
  if (!cle.email && !cle.phone) return false;

  const db = supabaseAdmin();
  const ligne = {
    ...cle,
    first_name: membre.first_name,
    last_name: membre.last_name,
    raison: raison?.trim() || null,
  };

  // Déjà bloqué, par l'un ou l'autre de ses identifiants ?
  const conditions = [];
  if (cle.email) conditions.push(`email.eq.${cle.email}`);
  if (cle.phone) conditions.push(`phone.eq.${cle.phone}`);

  const { data: existante, error: lecture } = await db
    .from('lil_blacklist')
    .select('id')
    .or(conditions.join(','))
    .limit(1);

  if (lecture) {
    console.error('[blacklist] lecture impossible', lecture.message);
    return false;
  }

  if (existante?.[0]) {
    const { error } = await db.from('lil_blacklist').update(ligne).eq('id', existante[0].id);
    if (error) console.error('[blacklist] mise à jour impossible', error.message);
    return !error;
  }

  const { error } = await db.from('lil_blacklist').insert(ligne);
  if (!error) return true;

  // Deux curateurs d'un coup : la contrainte d'unicité a tranché, et
  // l'autre ligne fait le même travail que la nôtre.
  if (error.code === '23505') return true;

  console.error('[blacklist] blocage impossible', error.message);
  return false;
}

export async function debloquer(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from('lil_blacklist').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Qui est bloqué, du plus récent au plus ancien. */
export async function listerBloques(): Promise<Bloque[]> {
  const { data, error } = await supabaseAdmin()
    .from('lil_blacklist')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);
  return (data ?? []) as Bloque[];
}
