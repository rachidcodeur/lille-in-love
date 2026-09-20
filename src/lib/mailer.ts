import { Resend } from 'resend';
import { env } from './env';
import {
  ALERTE_INTERNE,
  buildAlerteInterne,
  buildEmail,
  type AlerteVars,
  type TemplateId,
} from '@/emails/templates';
import { BRAND } from './brand';
import { supabaseAdmin } from './supabase';

let resend: Resend | null = null;

function client(): Resend {
  if (!resend) resend = new Resend(env.resendApiKey());
  return resend;
}

type SendOptions = {
  template: TemplateId;
  to: string;
  firstName: string;
  memberId: string | null;
  /**
   * Envoi différé confié à Resend (jusqu'à 30 jours).
   * Accepte une date ISO ou un délai en langage naturel, ex. « in 24 hours ».
   * Rien à planifier de notre côté, et l'envoi reste annulable via son id.
   */
  scheduledAt?: string;
};

export type SendResult =
  | { ok: true; resendId: string | null; scheduled: boolean }
  | { ok: false; error: string };

/**
 * Envoie (ou programme) un email de la séquence et le journalise.
 *
 * L'écriture dans lil_emails a un index unique (member_id, template) : si le
 * même email a déjà été envoyé ou programmé pour cette personne, on ne le
 * renvoie pas. C'est ce qui évite le double email quand un formulaire est
 * soumis deux fois ou qu'une requête est rejouée.
 */
export async function sendSequenceEmail(options: SendOptions): Promise<SendResult> {
  const { template, to, firstName, memberId, scheduledAt } = options;
  const db = supabaseAdmin();
  const { subject, html, text } = buildEmail(template, { firstName });

  // On réserve la place d'abord : si la ligne existe déjà, on n'envoie rien.
  const { data: logRow, error: logError } = await db
    .from('lil_emails')
    .insert({
      member_id: memberId,
      template,
      to_email: to,
      subject,
      status: 'programme',
      scheduled_at: scheduledAt ?? null,
    })
    .select('id')
    .single();

  if (logError) {
    // 23505 = violation d'unicité → l'email est déjà parti, c'est un succès silencieux.
    if (logError.code === '23505') {
      return { ok: true, resendId: null, scheduled: false };
    }
    return { ok: false, error: `journal email : ${logError.message}` };
  }

  try {
    const { data, error } = await client().emails.send({
      from: env.emailFrom(),
      to,
      replyTo: env.emailReplyTo(),
      subject,
      html,
      text,
      ...(scheduledAt ? { scheduledAt } : {}),
      headers: {
        // Deux envois identiques dans la même minute ne partiront qu'une fois.
        'X-Entity-Ref-ID': `${memberId ?? 'anon'}:${template}`,
      },
      tags: [{ name: 'template', value: template.replace(/_/g, '-') }],
    });

    if (error) throw new Error(error.message);

    await db
      .from('lil_emails')
      .update({
        resend_id: data?.id ?? null,
        status: scheduledAt ? 'programme' : 'envoye',
        sent_at: scheduledAt ? null : new Date().toISOString(),
      })
      .eq('id', logRow.id);

    return { ok: true, resendId: data?.id ?? null, scheduled: Boolean(scheduledAt) };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await db
      .from('lil_emails')
      .update({ status: 'echec', error: message.slice(0, 500) })
      .eq('id', logRow.id);
    return { ok: false, error: message };
  }
}

/**
 * Prévient l'équipe qu'une candidature vient d'arriver.
 *
 * Ce message-là ne part pas au candidat : il part à info@in-love.fr, et on
 * répond directement à la personne en cliquant « Répondre ». Il est
 * journalisé comme les autres, donc soumis au même index unique : deux envois
 * du même formulaire ne donnent pas deux alertes.
 *
 * Un échec ici ne doit jamais remonter au visiteur : sa candidature est
 * enregistrée, c'est tout ce qui compte pour lui.
 */
export async function previenirEquipe(
  vars: AlerteVars & { memberId: string },
): Promise<SendResult> {
  const db = supabaseAdmin();
  const { subject, html, text } = buildAlerteInterne(vars);
  const destinataire = BRAND.contactEmail;

  const { data: logRow, error: logError } = await db
    .from('lil_emails')
    .insert({
      member_id: vars.memberId,
      template: ALERTE_INTERNE,
      to_email: destinataire,
      subject,
      status: 'programme',
    })
    .select('id')
    .single();

  if (logError) {
    if (logError.code === '23505') return { ok: true, resendId: null, scheduled: false };
    return { ok: false, error: `journal alerte : ${logError.message}` };
  }

  try {
    const { data, error } = await client().emails.send({
      from: env.emailFrom(),
      to: destinataire,
      // Répondre à l'alerte, c'est écrire à la personne : c'est le geste
      // qu'on fera neuf fois sur dix.
      replyTo: vars.email,
      subject,
      html,
      text,
      headers: { 'X-Entity-Ref-ID': `${vars.memberId}:${ALERTE_INTERNE}` },
      tags: [{ name: 'template', value: 'alerte-interne' }],
    });

    if (error) throw new Error(error.message);

    await db
      .from('lil_emails')
      .update({ resend_id: data?.id ?? null, status: 'envoye', sent_at: new Date().toISOString() })
      .eq('id', logRow.id);

    return { ok: true, resendId: data?.id ?? null, scheduled: false };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await db
      .from('lil_emails')
      .update({ status: 'echec', error: message.slice(0, 500) })
      .eq('id', logRow.id);
    return { ok: false, error: message };
  }
}

/**
 * Annule un envoi programmé (décision changée avant l'échéance).
 *
 * Le SDK Resend ne lève pas d'exception quand l'API refuse : il renvoie un
 * champ `error`. Sans le lire, on noterait « annulé » dans notre journal alors
 * que l'email partirait quand même — une personne refusée recevrait la
 * bienvenue. On ne marque donc l'annulation qu'une fois Resend confirmé.
 */
export async function cancelScheduledEmail(
  resendId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let message = 'erreur inconnue';

  // Un email tout juste confié à Resend reste en « queued » avant de passer
  // en « scheduled », et l'annulation n'est acceptée qu'à partir de là —
  // Resend répond « Email is not scheduled » entre-temps. Ce délai est
  // imprévisible : mesuré entre 3 et 17 secondes. On réessaie donc une
  // douzaine de secondes, sans faire attendre le curateur davantage ; au-delà,
  // la fiche propose de relancer l'annulation, qui aboutit alors toujours.
  for (let essai = 0; essai < 7; essai += 1) {
    try {
      const { error } = await client().emails.cancel(resendId);
      if (error) throw new Error(error.message);

      await supabaseAdmin()
        .from('lil_emails')
        .update({ status: 'annule', error: null })
        .eq('resend_id', resendId);

      return { ok: true };
    } catch (cause) {
      message = cause instanceof Error ? cause.message : String(cause);

      // Seule cette erreur-là est passagère. Un email introuvable ou déjà
      // parti ne le deviendra pas en réessayant.
      const passagere = /not scheduled/i.test(message);
      if (!passagere || essai === 6) break;

      await new Promise((resolve) => setTimeout(resolve, 1800));
    }
  }

  console.error('[mailer] annulation refusée par Resend', resendId, message);
  // Le journal garde « programme » : la fiche montrera que l'envoi tient
  // toujours, plutôt que de laisser croire qu'il est arrêté.
  await supabaseAdmin()
    .from('lil_emails')
    .update({ error: `annulation impossible : ${message}`.slice(0, 500) })
    .eq('resend_id', resendId);

  return { ok: false, error: message };
}

/* ====================================================================
   Suivi des envois programmés
   ==================================================================== */

/**
 * Met le journal à jour pour les envois programmés dont l'heure est passée.
 *
 * Resend expédie seul un email programmé, sans nous prévenir : sans ce
 * rattrapage, la fiche afficherait « Programmé » bien après l'arrivée du
 * message. On lui demande donc l'état réel au moment où l'on consulte le
 * journal. (Un webhook Resend ferait la même chose en temps réel, mais demande
 * une adresse publique — à envisager une fois l'application déployée.)
 */
export async function rattraperEnvoisPasses(
  lignes: { id: string; status: string; scheduled_at: string | null; resend_id?: string | null }[],
): Promise<Map<string, { status: string; sent_at: string | null }>> {
  const maintenant = Date.now();
  const echus = lignes.filter(
    (l) =>
      l.status === 'programme' &&
      l.resend_id &&
      l.scheduled_at &&
      new Date(l.scheduled_at).getTime() <= maintenant,
  );

  const majs = new Map<string, { status: string; sent_at: string | null }>();

  await Promise.all(
    echus.map(async (ligne) => {
      try {
        const { data, error } = await client().emails.get(ligne.resend_id!);
        if (error || !data) return;

        const evenement = data.last_event;
        let status: string | null = null;
        if (['sent', 'delivered', 'opened', 'clicked', 'delivery_delayed'].includes(evenement)) status = 'envoye';
        else if (['bounced', 'failed', 'complained'].includes(evenement)) status = 'echec';
        else if (evenement === 'canceled') status = 'annule';
        if (!status) return; // encore en file chez Resend

        const sent_at = status === 'envoye' ? (ligne.scheduled_at ?? new Date().toISOString()) : null;
        await supabaseAdmin()
          .from('lil_emails')
          .update({
            status,
            sent_at,
            ...(status === 'echec' ? { error: `Resend : ${evenement}` } : {}),
          })
          .eq('id', ligne.id);
        majs.set(ligne.id, { status, sent_at });
      } catch {
        // Resend injoignable : on garde l'état connu, on réessaiera à la prochaine consultation.
      }
    }),
  );

  return majs;
}
