import { z } from 'zod';
import { sendBulkSequence, type BulkItem } from './mailer';
import { supabaseAdmin } from './supabase';

/**
 * Les soirées, et ce que leur publication déclenche.
 *
 * La règle : dès qu'une soirée est publiée,
 *   - les profils non retenus reçoivent « On reviendra vers toi » (03) ;
 *   - les profils validés dont l'âge, le jour de la soirée, sort de sa classe
 *     d'âge reçoivent « Ta tranche d'âge ouvrira plus tard » (04).
 *
 * Personne ne reçoit deux fois le même message : une personne déjà prévenue
 * lors d'une soirée précédente ne l'est pas de nouveau.
 *
 * Deux groupes ne reçoivent rien pour l'instant, et c'est voulu :
 *   - les validés dans la classe d'âge, qui attendent leur invitation ;
 *   - les validés sans date de naissance (formulaire court), dont on ne peut
 *     pas savoir s'ils ont l'âge — on ne devine pas, on les signale.
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

export type Personne = { id: string; prenom: string; nom: string; email: string; age: number | null };

export type Audience = {
  /** Non retenus : recevront le 03. */
  refuses: Personne[];
  /** Validés hors classe d'âge : recevront le 04. */
  horsTranche: Personne[];
  /** Validés dans la classe d'âge : aucun email pour l'instant. */
  dansLaTranche: Personne[];
  /** Validés sans date de naissance : on ne peut pas trancher. */
  ageInconnu: Personne[];
  /** Auraient dû recevoir le 03 ou le 04, mais l'ont déjà reçu. */
  dejaPrevenus: Personne[];
};

/** Âge révolu à une date donnée — celle de la soirée, pas celle du jour. */
export function ageAu(naissance: string, jour: string): number {
  const [ny, nm, nd] = naissance.slice(0, 10).split('-').map(Number);
  const [jy, jm, jd] = jour.slice(0, 10).split('-').map(Number);
  let age = jy! - ny!;
  if (jm! < nm! || (jm === nm && jd! < nd!)) age -= 1;
  return age;
}

type MembreRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  birth_date: string | null;
};

/**
 * Qui recevra quoi si l'on publie cette soirée.
 *
 * Ne modifie rien : c'est ce que le curateur relit avant de confirmer.
 */
export async function calculerAudience(soiree: Pick<SoireeInput, 'ageMin' | 'ageMax' | 'date'>): Promise<Audience> {
  const db = supabaseAdmin();

  const { data: membres, error } = await db
    .from('lil_members')
    .select('id, first_name, last_name, email, status, birth_date')
    // en_attente_tranche : ancien statut de validation, traité comme « valide ».
    .in('status', ['non_retenu', 'valide', 'en_attente_tranche'])
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (membres ?? []) as MembreRow[];

  // Ce que chacun a déjà reçu parmi le 03 et le 04.
  const recus = new Set<string>();
  const ids = rows.map((m) => m.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await db
      .from('lil_emails')
      .select('member_id, template')
      .in('member_id', ids.slice(i, i + 150))
      .in('template', ['03_on_reviendra', '04_tranche_age'])
      .in('status', ['programme', 'envoye']);
    for (const r of data ?? []) recus.add(`${r.member_id}:${r.template}`);
  }

  const audience: Audience = {
    refuses: [],
    horsTranche: [],
    dansLaTranche: [],
    ageInconnu: [],
    dejaPrevenus: [],
  };

  for (const m of rows) {
    const age = m.birth_date ? ageAu(m.birth_date, soiree.date) : null;
    const personne: Personne = {
      id: m.id,
      prenom: m.first_name,
      nom: m.last_name,
      email: m.email,
      age,
    };

    if (m.status === 'non_retenu') {
      if (recus.has(`${m.id}:03_on_reviendra`)) audience.dejaPrevenus.push(personne);
      else audience.refuses.push(personne);
      continue;
    }

    // Validés
    if (age === null) {
      audience.ageInconnu.push(personne);
    } else if (age >= soiree.ageMin && age <= soiree.ageMax) {
      audience.dansLaTranche.push(personne);
    } else if (recus.has(`${m.id}:04_tranche_age`)) {
      audience.dejaPrevenus.push(personne);
    } else {
      audience.horsTranche.push(personne);
    }
  }

  return audience;
}

export type Bilan = {
  '03': number;
  '04': number;
  dans_la_tranche: number;
  age_inconnu: number;
  deja_prevenus: number;
  echecs: number;
};

export type Publication = {
  soireeId: string;
  bilan: Bilan;
  echecs: { to: string; error: string }[];
};

/**
 * Publie la soirée et envoie les réponses qu'elle déclenche.
 *
 * La soirée est enregistrée avant les envois : si un lot échoue, elle existe,
 * et les échecs sont consignés dans le journal de chaque fiche.
 */
export async function publierSoiree(input: SoireeInput): Promise<Publication> {
  const db = supabaseAdmin();

  const { data: soiree, error } = await db
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

  const audience = await calculerAudience(input);
  const tranche = `${input.ageMin}-${input.ageMax}`;

  const items: BulkItem[] = [
    ...audience.refuses.map((p) => ({
      template: '03_on_reviendra' as const,
      memberId: p.id,
      to: p.email,
      firstName: p.prenom,
    })),
    ...audience.horsTranche.map((p) => ({
      template: '04_tranche_age' as const,
      memberId: p.id,
      to: p.email,
      firstName: p.prenom,
      trancheAge: tranche,
    })),
  ];

  const envoi = await sendBulkSequence(items, soiree.id);

  const echoues = new Set(envoi.echecs.map((e) => e.memberId));
  const bilan: Bilan = {
    '03': audience.refuses.filter((p) => !echoues.has(p.id)).length,
    '04': audience.horsTranche.filter((p) => !echoues.has(p.id)).length,
    dans_la_tranche: audience.dansLaTranche.length,
    age_inconnu: audience.ageInconnu.length,
    deja_prevenus: audience.dejaPrevenus.length + envoi.dejaPrevenus,
    echecs: envoi.echecs.length,
  };

  await db.from('lil_soirees').update({ bilan }).eq('id', soiree.id);

  return {
    soireeId: soiree.id,
    bilan,
    echecs: envoi.echecs.map(({ to, error: e }) => ({ to, error: e })),
  };
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
  bilan: Bilan | null;
};

export async function listerSoirees(): Promise<SoireeRow[]> {
  const { data, error } = await supabaseAdmin()
    .from('lil_soirees')
    .select('*')
    .order('date_soiree', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoireeRow[];
}
