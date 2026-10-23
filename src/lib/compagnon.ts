import { supabaseAdmin } from '@/lib/supabase';

/** « Jean-Éric » et « jean eric » désignent la même personne. */
export function pliage(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * La fiche qui porte ces deux noms, s'il n'y en a qu'une.
 *
 * La comparaison se fait en mémoire : « ilike » ne sait pas ignorer les
 * accents, et une base de prénoms français s'y rendrait à moitié
 * introuvable. On ne lit que les noms. Le jour où la base se compte en
 * dizaines de milliers, c'est une colonne sans accents qu'il faudra, pas
 * une requête plus maligne.
 *
 * Deux homonymes : on ne renvoie rien. Montrer la mauvaise Julie serait
 * pire que de n'en montrer aucune.
 */
export async function chercherCompagnon(prenom: string, nom: string) {
  const { data } = await supabaseAdmin()
    .from('lil_members')
    .select('id, first_name, last_name')
    .is('deleted_at', null)
    .limit(5000);

  const cherche = { prenom: pliage(prenom), nom: pliage(nom) };
  const trouves = (data ?? []).filter(
    (m) => pliage(m.first_name ?? '') === cherche.prenom && pliage(m.last_name ?? '') === cherche.nom,
  );

  return trouves.length === 1 ? trouves[0] : null;
}
