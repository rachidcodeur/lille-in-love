import { INTERESTS } from './questions';
import type { MemberDetail } from './admin';

/**
 * L'export CSV des candidatures.
 *
 * Le format n'est pas choisi ici : il reprend colonne pour colonne, valeur
 * pour valeur, les exports que l'équipe utilise déjà (`soiree_group`,
 * `gender` en F/M, `looking_for` en `serieux`/`bons-moments`…). Un fichier
 * exporté par ce back-office doit pouvoir remplacer l'ancien sans que rien
 * en aval ne s'en aperçoive.
 */

export const COLONNES = [
  'soiree_group',
  'first_name',
  'gender',
  'age',
  'birth_date',
  'email',
  'phone',
  'city',
  'postal_code',
  'profession',
  'instagram',
  'looking_for',
  'orientation',
  'has_children',
  'children_preference',
  'height_cm',
  'zodiac_sign',
  'about_you',
  'ideal_evening',
  'interests',
  'friend_name',
  'friend_email',
  'source',
  'created_at',
  'id',
] as const;

const GENRE: Record<string, string> = { femme: 'F', homme: 'M' };
const CHERCHE: Record<string, string> = {
  relation_serieuse: 'serieux',
  bons_moments: 'bons-moments',
};

/** Les centres d'intérêt en clair, le « autre » précisé à la suite. */
function interets(member: MemberDetail): string {
  const choisis = (member.interests ?? [])
    .filter((v) => v !== 'autre')
    .map((v) => INTERESTS.find((o) => o.value === v)?.label ?? v);
  if (member.interests_other) choisis.push(member.interests_other);
  return choisis.join(', ');
}

/**
 * `2026-06-13T09:18:06.866415+00:00` → `2026-06-13 09:18:06.866415+00`,
 * l'écriture des exports existants.
 */
function horodatage(iso: string | null): string {
  if (!iso) return '';
  return iso.replace('T', ' ').replace(/Z$/, '+00').replace(/\+00:00$/, '+00');
}

function booleen(valeur: boolean | null): string {
  if (valeur === null || valeur === undefined) return '';
  return valeur ? 'True' : 'False';
}

function texte(valeur: string | number | null | undefined): string {
  return valeur === null || valeur === undefined ? '' : String(valeur);
}

/** Une ligne du fichier, dans l'ordre de COLONNES. */
export function ligneExport(member: MemberDetail): string[] {
  return [
    texte(member.soiree_group),
    texte(member.first_name),
    member.gender ? (GENRE[member.gender] ?? member.gender) : '',
    texte(member.age),
    texte(member.birth_date),
    texte(member.email),
    texte(member.phone),
    texte(member.city),
    texte(member.postal_code),
    texte(member.profession),
    texte(member.instagram),
    member.looking_for ? (CHERCHE[member.looking_for] ?? member.looking_for) : '',
    texte(member.orientation),
    booleen(member.has_children),
    texte(member.children_preference),
    texte(member.height_cm),
    texte(member.zodiac),
    texte(member.about),
    texte(member.motivation),
    interets(member),
    texte(member.companion_first_name),
    texte(member.companion_email),
    // « source » désigne ici comment la personne nous a connus : c'est la
    // réponse au questionnaire, pas la provenance technique de l'envoi.
    texte(member.referral),
    horodatage(member.created_at),
    texte(member.id),
  ];
}

/** Guillemets RFC 4180 : seulement quand le contenu l'exige. */
function champ(valeur: string): string {
  return /[",\r\n]/.test(valeur) ? `"${valeur.replace(/"/g, '""')}"` : valeur;
}

export function versCsv(membres: MemberDetail[]): string {
  const lignes = [COLONNES.join(',')];
  for (const membre of membres) lignes.push(ligneExport(membre).map(champ).join(','));
  // Une dernière fin de ligne : tous les tableurs l'attendent.
  return `${lignes.join('\n')}\n`;
}
