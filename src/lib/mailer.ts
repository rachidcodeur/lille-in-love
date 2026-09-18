import { Resend } from 'resend';
import { env } from './env';
import { buildEmail, type TemplateId } from '@/emails/templates';
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
   Envoi groupé — la publication d'une soirée
   ==================================================================== */

export type BulkItem = {
  template: TemplateId;
  memberId: string;
  to: string;
  firstName: string;
  trancheAge?: string;
};

export type BulkResult = {
  envoyes: number;
  /** Déjà reçu (ou programmé) : le filet anti-doublon les a retenus. */
  dejaPrevenus: number;
  echecs: { memberId: string; to: string; error: string }[];
};

/** Resend accepte 100 emails par lot, et 10 requêtes par seconde. */
const TAILLE_LOT = 100;
const PAUSE_ENTRE_LOTS_MS = 250;

/**
 * Envoie une série d'emails de la séquence, par lots.
 *
 * Une soirée peut concerner des centaines de personnes : un appel par email
 * dépasserait à la fois la limite de débit de Resend et le temps alloué à une
 * requête. On journalise d'abord toutes les lignes, on envoie par lots de 100,
 * puis on reporte les identifiants Resend.
 *
 * Le même principe que sendSequenceEmail s'applique : une personne qui a déjà
 * reçu ce message ne le reçoit pas une seconde fois.
 */
export async function sendBulkSequence(
  items: BulkItem[],
  soireeId: string | null,
): Promise<BulkResult> {
  const db = supabaseAdmin();
  const result: BulkResult = { envoyes: 0, dejaPrevenus: 0, echecs: [] };
  if (items.length === 0) return result;

  // --- Qui a déjà reçu (ou va recevoir) ce message ? ------------------
  const templates = [...new Set(items.map((i) => i.template))];
  const memberIds = [...new Set(items.map((i) => i.memberId))];
  const dejaVus = new Set<string>();

  // Par paquets : une liste d'identifiants trop longue ferait déborder l'URL.
  for (let i = 0; i < memberIds.length; i += 150) {
    const { data } = await db
      .from('lil_emails')
      .select('member_id, template')
      .in('member_id', memberIds.slice(i, i + 150))
      .in('template', templates)
      .in('status', ['programme', 'envoye']);
    for (const row of data ?? []) dejaVus.add(`${row.member_id}:${row.template}`);
  }

  const aEnvoyer = items.filter((item) => {
    const cle = `${item.memberId}:${item.template}`;
    if (dejaVus.has(cle)) return false;
    dejaVus.add(cle); // et pas deux fois dans la même série
    return true;
  });
  result.dejaPrevenus = items.length - aEnvoyer.length;

  // --- Envoi par lots -------------------------------------------------
  for (let debut = 0; debut < aEnvoyer.length; debut += TAILLE_LOT) {
    const lot = aEnvoyer.slice(debut, debut + TAILLE_LOT);
    const contenus = lot.map((item) => ({
      item,
      email: buildEmail(item.template, { firstName: item.firstName, trancheAge: item.trancheAge }),
    }));

    // On réserve les lignes d'abord : si l'envoi échoue, la trace reste.
    const { data: lignes, error: insertError } = await db
      .from('lil_emails')
      .insert(
        contenus.map(({ item, email }) => ({
          member_id: item.memberId,
          template: item.template,
          to_email: item.to,
          subject: email.subject,
          status: 'programme',
          soiree_id: soireeId,
        })),
      )
      .select('id, member_id, template');

    if (insertError || !lignes) {
      for (const { item } of contenus) {
        result.echecs.push({
          memberId: item.memberId,
          to: item.to,
          error: `journal : ${insertError?.message ?? 'insertion impossible'}`,
        });
      }
      continue;
    }

    const idDeLigne = new Map(lignes.map((l) => [`${l.member_id}:${l.template}`, l.id as string]));

    try {
      const { data, error } = await client().batch.send(
        contenus.map(({ item, email }) => ({
          from: env.emailFrom(),
          to: item.to,
          replyTo: env.emailReplyTo(),
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: { 'X-Entity-Ref-ID': `${item.memberId}:${item.template}` },
          tags: [{ name: 'template', value: item.template.replace(/_/g, '-') }],
        })),
      );

      // Même piège que pour un envoi seul : le SDK renvoie l'erreur, il ne la lève pas.
      if (error) throw new Error(error.message);

      const maintenant = new Date().toISOString();
      const mises = contenus.map(({ item }, index) => ({
        id: idDeLigne.get(`${item.memberId}:${item.template}`),
        member_id: item.memberId,
        template: item.template,
        to_email: item.to,
        status: 'envoye',
        resend_id: data?.data?.[index]?.id ?? null,
        sent_at: maintenant,
        soiree_id: soireeId,
      }));

      const { error: majError } = await db.from('lil_emails').upsert(mises);
      if (majError) console.error('[mailer] identifiants Resend non reportés', majError.message);

      result.envoyes += lot.length;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await db
        .from('lil_emails')
        .update({ status: 'echec', error: message.slice(0, 500) })
        .in('id', lignes.map((l) => l.id));
      for (const { item } of contenus) {
        result.echecs.push({ memberId: item.memberId, to: item.to, error: message });
      }
    }

    if (debut + TAILLE_LOT < aEnvoyer.length) {
      await new Promise((resolve) => setTimeout(resolve, PAUSE_ENTRE_LOTS_MS));
    }
  }

  return result;
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
