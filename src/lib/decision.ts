import { env } from './env';
import { cancelScheduledEmail, sendSequenceEmail } from './mailer';
import { supabaseAdmin } from './supabase';
import type { TemplateId } from '@/emails/templates';

/**
 * Ce qui se passe quand les curateurs se prononcent.
 *
 * Deux décisions possibles après l'inscription :
 *   - profil retenu → « Bienvenue dans le club » (02), exactement 24 h après ;
 *   - profil non retenu → rien sur le moment. La réponse « On reviendra vers
 *     toi » (03) part à la publication de la prochaine soirée, parce que c'est
 *     la soirée qui décide qui a une place. Voir src/lib/soirees.ts.
 *
 * La réponse « Ta tranche d'âge ouvrira plus tard » (04) n'est plus une
 * décision : elle est calculée à la publication d'une soirée, d'après l'âge
 * des validés et la classe d'âge de la soirée.
 *
 * Le délai du 02 est confié à Resend, qui sait différer un envoi comme
 * l'annuler : changer d'avis avant l'envoi rattrape la bienvenue en attente.
 */

export type Decision = 'valide' | 'non_retenu';

/** L'email que chaque décision programme — le refus n'en programme aucun. */
export const EMAIL_FOR_DECISION: Record<Decision, TemplateId | null> = {
  valide: '02_bienvenue',
  non_retenu: null,
};

/** Les emails programmés par une décision, et qu'un changement d'avis doit rattraper. */
export const DECISION_TEMPLATES: TemplateId[] = ['02_bienvenue'];

/** L'email programmé qu'une personne doit avoir compte tenu de son statut, s'il y en a un. */
export function templateAttendu(status: string): TemplateId | null {
  return status === 'valide' ? '02_bienvenue' : null;
}

export type DecisionResult = {
  status: string;
  emailTemplate: TemplateId | null;
  /** Date d'envoi prévue, ou null si l'email part tout de suite. */
  scheduledFor: string | null;
  emailOk: boolean;
  emailError?: string;
  /** Renseigné si une réponse en attente n'a PAS pu être arrêtée. */
  annulationEchouee?: string;
  /** La même décision était déjà prise : rien n'a été renvoyé ni reprogrammé. */
  dejaPrise?: boolean;
  /** Cette réponse avait déjà été envoyée un jour : le filet anti-doublon l'a retenue. */
  alreadySent?: boolean;
};

/** Le membre, réduit à ce dont la décision a besoin. */
type MemberRow = { id: string; first_name: string; email: string; status: string };

async function loadMember(memberId: string): Promise<MemberRow | null> {
  const { data } = await supabaseAdmin()
    .from('lil_members')
    .select('id, first_name, email, status')
    .eq('id', memberId)
    .maybeSingle();
  return (data as MemberRow | null) ?? null;
}

/**
 * Annule les réponses encore en attente, sauf celle qu'on veut garder.
 *
 * Sert quand on revient sur une décision avant les 24 heures : sans ça, la
 * personne recevrait par exemple « Bienvenue dans le club » après un refus.
 */
export async function cancelPendingDecisionEmails(
  memberId: string,
  garder: TemplateId | null = null,
): Promise<{ echec: string | null }> {
  const db = supabaseAdmin();
  const { data: pending } = await db
    .from('lil_emails')
    .select('id, template, resend_id')
    .eq('member_id', memberId)
    .in('template', DECISION_TEMPLATES)
    .eq('status', 'programme');

  let echec: string | null = null;

  for (const row of pending ?? []) {
    if (row.template === garder) continue;

    if (row.resend_id) {
      const result = await cancelScheduledEmail(row.resend_id);
      if (!result.ok) echec = result.error;
    } else {
      // Jamais confié à Resend : il suffit de le retirer du journal.
      await db.from('lil_emails').update({ status: 'annule' }).eq('id', row.id);
    }
  }

  return { echec };
}

/**
 * Enregistre la voix d'un curateur, puis valide si le seuil est atteint.
 *
 * Le vote est remplacé s'il existe déjà : un curateur peut changer d'avis
 * sans créer de doublon (contrainte d'unicité sur member_id + curator_id).
 */
export async function castVote(options: {
  memberId: string;
  curatorId: string;
  vote: 'oui' | 'non' | 'peut_etre';
  comment?: string | null;
}): Promise<DecisionResult> {
  const db = supabaseAdmin();

  const { error: voteError } = await db.from('lil_reviews').upsert(
    {
      member_id: options.memberId,
      curator_id: options.curatorId,
      vote: options.vote,
      comment: options.comment ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,curator_id' },
  );

  if (voteError) throw new Error(`vote non enregistré : ${voteError.message}`);

  const { count: ouiCount } = await db
    .from('lil_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', options.memberId)
    .eq('vote', 'oui');

  const { count: totalCount } = await db
    .from('lil_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', options.memberId);

  if ((ouiCount ?? 0) >= env.votesRequis()) {
    return applyDecision(options.memberId, 'valide');
  }

  // Pas (ou plus) de décision : toute réponse en attente doit être rattrapée.
  const member = await loadMember(options.memberId);
  let echec: string | null = null;
  if (member && templateAttendu(member.status)) {
    ({ echec } = await cancelPendingDecisionEmails(options.memberId));
    if (echec) console.error('[decision] réponse non annulée', options.memberId, echec);
  }

  const status = (totalCount ?? 0) > 0 ? 'en_examen' : 'nouveau';
  await db.from('lil_members').update({ status, decided_at: null }).eq('id', options.memberId);

  return {
    status,
    emailTemplate: null,
    scheduledFor: null,
    emailOk: true,
    annulationEchouee: echec ?? undefined,
  };
}

/**
 * Applique une décision.
 *
 * Validation : la bienvenue est programmée à +24 h. Refus : la bienvenue
 * éventuellement en attente est annulée, et rien d'autre ne part avant la
 * prochaine soirée.
 */
export async function applyDecision(
  memberId: string,
  decision: Decision,
): Promise<DecisionResult> {
  const db = supabaseAdmin();
  const member = await loadMember(memberId);
  if (!member) throw new Error('candidature introuvable');

  const template = EMAIL_FOR_DECISION[decision];

  // Même décision cliquée deux fois : on ne touche à rien — surtout pas à
  // l'heure d'envoi de la bienvenue, qui doit rester 24 h après la première.
  if (member.status === decision) {
    if (!template) {
      return { status: decision, emailTemplate: null, scheduledFor: null, emailOk: true, dejaPrise: true };
    }
    const { data: existant } = await db
      .from('lil_emails')
      .select('status, scheduled_at')
      .eq('member_id', memberId)
      .eq('template', template)
      .in('status', ['programme', 'envoye'])
      .maybeSingle();

    if (existant) {
      return {
        status: decision,
        emailTemplate: template,
        scheduledFor: existant.status === 'programme' ? existant.scheduled_at : null,
        emailOk: true,
        dejaPrise: true,
      };
    }
  }

  // Changement d'avis : la bienvenue en attente est rattrapée si on refuse.
  const annulation = await cancelPendingDecisionEmails(memberId, template);

  const { error: statusError } = await db
    .from('lil_members')
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq('id', memberId);

  if (statusError) throw new Error(`statut non enregistré : ${statusError.message}`);

  // Refus : aucun email maintenant, la prochaine soirée s'en chargera.
  if (!template) {
    return {
      status: decision,
      emailTemplate: null,
      scheduledFor: null,
      emailOk: true,
      annulationEchouee: annulation.echec ?? undefined,
    };
  }

  const delayMinutes = env.delaiReponseMinutes();
  const scheduledFor =
    delayMinutes > 0 ? new Date(Date.now() + delayMinutes * 60_000).toISOString() : null;

  const mail = await sendSequenceEmail({
    template,
    to: member.email,
    firstName: member.first_name,
    memberId,
    scheduledAt: scheduledFor ?? undefined,
  });

  if (mail.ok && !scheduledFor) {
    await db.from('lil_members').update({ welcomed_at: new Date().toISOString() }).eq('id', memberId);
  }

  const alreadySent = mail.ok && mail.resendId === null && !mail.scheduled;

  return {
    status: decision,
    emailTemplate: template,
    scheduledFor: alreadySent ? null : scheduledFor,
    emailOk: mail.ok,
    emailError: mail.ok ? undefined : mail.error,
    annulationEchouee: annulation.echec ?? undefined,
    alreadySent,
  };
}

/** Renvoie un email de la séquence après un échec. */
export async function resendEmail(
  memberId: string,
  template: TemplateId,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  const member = await loadMember(memberId);
  if (!member) return { ok: false, error: 'candidature introuvable' };

  // On efface la trace de l'échec pour que le filet anti-doublon laisse passer.
  await db
    .from('lil_emails')
    .delete()
    .eq('member_id', memberId)
    .eq('template', template)
    .eq('status', 'echec');

  const mail = await sendSequenceEmail({
    template,
    to: member.email,
    firstName: member.first_name,
    memberId,
  });

  return mail.ok ? { ok: true } : { ok: false, error: mail.error };
}
