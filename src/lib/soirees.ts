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
};

export async function listerSoirees(): Promise<SoireeRow[]> {
  const { data, error } = await supabaseAdmin()
    .from('lil_soirees')
    .select('*')
    .order('date_soiree', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoireeRow[];
}
