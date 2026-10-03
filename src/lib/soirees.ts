import { z } from 'zod';
import { supabaseAdmin } from './supabase';

/**
 * Les soirées.
 *
 * Elles ne déclenchent plus aucun email. La séquence tient désormais en deux
 * messages — « Candidature reçue » à l'inscription, « Bienvenue » après
 * validation — et c'est le groupe (A, B, C, G) qui dit à quelle soirée une
 * candidature correspond.
 *
 * Enregistrer une soirée sert donc à s'en souvenir : son nom, sa classe
 * d'âge, sa date, son lieu. L'email d'invitation, lui, reste à écrire.
 */

export const soireeSchema = z
  .object({
    nom: z.string().trim().min(1, 'Donne un nom à la soirée').max(120),
    ageMin: z.coerce.number().int().min(18, '18 ans minimum').max(99),
    ageMax: z.coerce.number().int().min(18).max(99, '99 ans maximum'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
    heure: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Heure invalide')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    lieu: z.string().trim().min(1, 'Indique le lieu').max(200),
  })
  .refine((s) => s.ageMax >= s.ageMin, {
    path: ['ageMax'],
    message: 'L’âge maximum doit être supérieur ou égal au minimum',
  });

export type SoireeInput = z.infer<typeof soireeSchema>;

export type Publication = { soireeId: string };

/**
 * Enregistre une soirée.
 *
 * Aucun email ne part : ni au moment de l'enregistrement, ni plus tard. On
 * note une date, un lieu et une classe d'âge, rien de plus.
 */
export async function publierSoiree(input: SoireeInput): Promise<Publication> {
  const { data: soiree, error } = await supabaseAdmin()
    .from('lil_soirees')
    .insert({
      nom: input.nom,
      age_min: input.ageMin,
      age_max: input.ageMax,
      date_soiree: input.date,
      heure: input.heure ?? null,
      lieu: input.lieu,
    })
    .select('id')
    .single();

  if (error || !soiree) throw new Error(`soirée non enregistrée : ${error?.message ?? 'inconnue'}`);

  return { soireeId: soiree.id };
}

export type SoireeRow = {
  id: string;
  nom: string;
  age_min: number;
  age_max: number;
  date_soiree: string;
  heure: string | null;
  lieu: string;
  publiee_at: string;
  /** Le crush time, quand il y en a un. Absent tant que 13_crushtime.sql n'est pas passé. */
  crush_code?: string | null;
  crush_actif?: boolean;
};

export async function listerSoirees(): Promise<SoireeRow[]> {
  const { data, error } = await supabaseAdmin()
    .from('lil_soirees')
    .select('*')
    .order('date_soiree', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoireeRow[];
}

/** Une soirée et son crush time, pour le tableau de bord de l'hôte. */
export async function getSoiree(id: string): Promise<SoireeRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('lil_soirees')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SoireeRow | null) ?? null;
}

/** Ce qu'une soirée emporterait avec elle. */
export type CeQuEllePorte = { participants: number; matchs: number };

/**
 * Ce que portent toutes les soirées, en deux requêtes.
 *
 * Une par soirée faisait deux allers-retours chacune : sur une liste qui
 * s'allonge, c'est la page entière qui ralentit pour afficher deux nombres.
 */
export async function cheptel(
  soireeIds: string[],
): Promise<Record<string, CeQuEllePorte>> {
  const vide = Object.fromEntries(soireeIds.map((id) => [id, { participants: 0, matchs: 0 }]));
  if (soireeIds.length === 0) return vide;

  const db = supabaseAdmin();
  const [participants, matchs] = await Promise.all([
    db.from('lil_crush_participants').select('soiree_id').in('soiree_id', soireeIds),
    db.from('lil_crush_matches').select('soiree_id').in('soiree_id', soireeIds),
  ]);

  for (const ligne of participants.data ?? []) {
    if (vide[ligne.soiree_id]) vide[ligne.soiree_id].participants += 1;
  }
  for (const ligne of matchs.data ?? []) {
    if (vide[ligne.soiree_id]) vide[ligne.soiree_id].matchs += 1;
  }
  return vide;
}

/**
 * Compter avant d'effacer.
 *
 * Supprimer une soirée fait tomber en cascade ses participants, leurs likes
 * et leurs matchs. Un match n'est pas une donnée d'organisation : c'est ce
 * que deux personnes ont obtenu d'une soirée. On veut donc savoir ce qu'on
 * s'apprête à défaire avant de le défaire.
 *
 * Les tables du crush time peuvent ne pas exister : 13_crushtime.sql n'a
 * peut-être pas été passé, et la liste des soirées doit s'afficher quand même.
 */
export async function ceQuElleporte(soireeId: string): Promise<CeQuEllePorte> {
  const db = supabaseAdmin();
  const [participants, matchs] = await Promise.all([
    db.from('lil_crush_participants').select('id').eq('soiree_id', soireeId),
    db.from('lil_crush_matches').select('id').eq('soiree_id', soireeId),
  ]);
  return {
    participants: participants.data?.length ?? 0,
    matchs: matchs.data?.length ?? 0,
  };
}

/**
 * Effacer une soirée, et son crush time avec elle.
 *
 * Rien ne l'interdit, même si des matchs y sont attachés : c'est ton
 * organisation, et une soirée d'essai qu'on ne peut plus retirer encombre
 * pour toujours. L'écran dit en revanche ce que la suppression emporte,
 * compté avant de demander — on peut se tromper de ligne dans une liste.
 */
export async function supprimerSoiree(soireeId: string): Promise<CeQuEllePorte> {
  const porte = await ceQuElleporte(soireeId);

  // Les participants, leurs likes et leurs matchs partent en cascade, et
  // les emails envoyés à l'occasion de cette soirée perdent simplement leur
  // rattachement : leur trace, elle, reste.
  const { error } = await supabaseAdmin().from('lil_soirees').delete().eq('id', soireeId);
  if (error) throw new Error(error.message);

  return porte;
}
