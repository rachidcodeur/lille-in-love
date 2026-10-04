import { supabaseAdmin } from './supabase';

/**
 * Les notifications poussées vers les téléphones.
 *
 * Deux moments, deux seulement : l'ouverture d'une manche, et un match. Un
 * like reste muet — le notifier dirait à l'autre qu'il a été choisi, et ce
 * serait la fin du jeu.
 *
 * Sur iPhone, cela ne marche que pour une application posée sur l'écran
 * d'accueil : c'est la règle d'Apple, et c'est pour cela que le parcours
 * d'arrivée insiste tant. Tout ce qui suit ne concerne donc que ceux qui
 * ont installé — le reste de la soirée continue de marcher sans.
 */

export type Message = {
  titre: string;
  corps: string;
  /** Là où mène le toucher sur la notification. */
  lien: string;
  /** Regroupe les notifications qui se remplacent entre elles. */
  etiquette?: string;
};

type Abonnement = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  echecs: number;
};

/** Les clés sont facultatives : sans elles, on n'envoie simplement rien. */
function clefs(): { publique: string; privee: string; sujet: string } | null {
  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  if (!publique || !privee) return null;
  return {
    publique,
    privee,
    sujet: process.env.VAPID_SUBJECT ?? 'mailto:info@in-love.fr',
  };
}

export const notificationsPossibles = () => clefs() !== null;

/**
 * Envoyer à une liste de participants.
 *
 * Les échecs ne remontent pas : une notification perdue ne doit jamais
 * empêcher une manche de s'ouvrir ni un match d'exister. On nettoie en
 * revanche les abonnements que le service déclare morts — un téléphone
 * réinstallé en laisse un derrière lui, et le réessayer indéfiniment
 * ralentirait tous les envois suivants.
 */
export async function notifier(
  participantIds: string[],
  message: Message,
): Promise<{ envoyees: number; mortes: number }> {
  const config = clefs();
  if (!config || participantIds.length === 0) return { envoyees: 0, mortes: 0 };

  const db = supabaseAdmin();
  const { data } = await db
    .from('lil_crush_push')
    .select('id, endpoint, p256dh, auth, echecs')
    .in('participant_id', participantIds);

  const abonnements = (data ?? []) as Abonnement[];
  if (abonnements.length === 0) return { envoyees: 0, mortes: 0 };

  const { default: webpush } = await import('web-push');
  webpush.setVapidDetails(config.sujet, config.publique, config.privee);

  const charge = JSON.stringify(message);
  const mortes: string[] = [];
  let envoyees = 0;

  await Promise.all(
    abonnements.map(async (abonnement) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: abonnement.endpoint,
            keys: { p256dh: abonnement.p256dh, auth: abonnement.auth },
          },
          charge,
          // Une minute de validité : au-delà, la notification n'a plus de
          // sens — le crush time sera fini.
          { TTL: 60 },
        );
        envoyees += 1;
      } catch (cause) {
        // 404 et 410 : l'abonnement n'existe plus chez le service. Rien à
        // réessayer, c'est définitif.
        const statut = (cause as { statusCode?: number })?.statusCode;
        if (statut === 404 || statut === 410) mortes.push(abonnement.id);
      }
    }),
  );

  if (mortes.length > 0) {
    await db.from('lil_crush_push').delete().in('id', mortes);
  }

  return { envoyees, mortes: mortes.length };
}
