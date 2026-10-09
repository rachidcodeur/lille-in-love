import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vérifie d'un coup d'œil que le déploiement est correctement configuré.
 *
 * Au-delà de la présence des variables, on regarde leur forme : l'erreur la
 * plus courante est de coller la clé Resend dans le champ Supabase, ou la clé
 * « anon » à la place de « service_role ». Les deux passeraient un simple
 * test de présence et échoueraient à la première inscription.
 */
/**
 * Le rôle et le projet inscrits dans une clé Supabase.
 *
 * Une clé « anon » et une clé « service_role » se ressemblent trait pour
 * trait : même longueur, même préfixe. Coller l'une pour l'autre laisse
 * l'application démarrer, répondre, et échouer à la première écriture — avec
 * un message qui ne dit rien de la cause. Le rôle est écrit dans le jeton :
 * autant le lire.
 */
function lireCle(cle: string): { role?: string; projet?: string } {
  try {
    const charge = JSON.parse(
      Buffer.from(cle.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { role?: string; ref?: string };
    return { role: charge.role, projet: charge.ref };
  } catch {
    return {};
  }
}

/**
 * Les colonnes que chaque migration du crush time apporte.
 *
 * Une migration oubliée ne se voit nulle part : l'application démarre,
 * les pages s'affichent, et ça casse au moment précis où on s'en sert —
 * le soir, dans la salle. C'est exactement ce qui est arrivé avec le
 * marquage des annonces vues. Autant poser la question à la base.
 *
 * On demande une colonne par migration, avec « limit 0 » : PostgREST
 * refuse la requête si la colonne n'existe pas, sans lire une seule
 * ligne.
 */
const MIGRATIONS: { fichier: string; table: string; colonne: string; sans: string }[] = [
  {
    fichier: '13_crushtime.sql',
    table: 'lil_crush_participants',
    colonne: 'jeton',
    sans: 'le crush time ne marche pas du tout',
  },
  {
    fichier: '14_ordre_photos.sql',
    table: 'lil_photos',
    colonne: 'position',
    sans: 'les photos ne se rangent pas, la photo de tête est au hasard',
  },
  {
    fichier: '15_duree_manches.sql',
    table: 'lil_crush_rounds',
    colonne: 'duree_minutes',
    sans: 'toutes les manches durent quinze minutes, sans réglage possible',
  },
  {
    fichier: '17_notifications.sql',
    table: 'lil_crush_matches',
    colonne: 'notifie_at',
    sans: 'aucune notification ne part, ni à l’ouverture ni au match',
  },
  {
    fichier: '18_match_vu.sql',
    table: 'lil_crush_matches',
    colonne: 'vu_a_at',
    sans: 'un match reçu hors de l’application ne se rejoue pas à l’ouverture',
  },
  {
    fichier: '19_questionnaire.sql',
    table: 'lil_crush_questionnaires',
    colonne: 'reponses',
    sans: 'le questionnaire de fin de soirée ne s’affiche pas et aucun avis n’est recueilli',
  },
];

/** Ce que la base ne connaît pas encore. */
async function migrationsManquantes(url: string, cle: string): Promise<string[]> {
  if (!url || !cle) return [];

  const absentes = await Promise.all(
    MIGRATIONS.map(async ({ fichier, table, colonne, sans }) => {
      try {
        const reponse = await fetch(
          `${url.replace(/\/$/, '')}/rest/v1/${table}?select=${colonne}&limit=0`,
          {
            headers: { apikey: cle, Authorization: `Bearer ${cle}` },
            cache: 'no-store',
          },
        );
        if (reponse.ok) return null;
        const corps = (await reponse.json().catch(() => null)) as { code?: string } | null;
        // 42703 : colonne inconnue. 42P01 : table inconnue.
        return corps?.code === '42703' || corps?.code === '42P01'
          ? `${fichier} n’a pas été exécutée — sans elle, ${sans}.`
          : null;
      } catch {
        // Base injoignable : les autres contrôles le diront déjà.
        return null;
      }
    }),
  );

  return absentes.filter((x): x is string => x !== null);
}

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const resendKey = process.env.RESEND_API_KEY ?? '';

  const problemes: string[] = [];

  // En test, SUPABASE_URL pointe vers le faux service local : on ne juge la
  // forme que des URLs distantes.
  const estLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(supabaseUrl);

  if (!supabaseUrl) {
    problemes.push('SUPABASE_URL est vide.');
  } else if (!estLocal && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/.test(supabaseUrl)) {
    problemes.push('SUPABASE_URL ne ressemble pas à une URL de projet Supabase.');
  }

  if (!serviceKey) {
    problemes.push('SUPABASE_SERVICE_ROLE_KEY est vide.');
  } else if (estLocal) {
    // Clé factice du faux service : rien à vérifier.
  } else if (serviceKey.startsWith('re_')) {
    problemes.push(
      'SUPABASE_SERVICE_ROLE_KEY contient une clé Resend (« re_… »). Il faut la clé ' +
        'service_role de Supabase : Settings → API, un long jeton commençant par « eyJ ».',
    );
  } else if (!serviceKey.startsWith('eyJ')) {
    problemes.push(
      'SUPABASE_SERVICE_ROLE_KEY ne ressemble pas à une clé Supabase (elle devrait commencer par « eyJ »).',
    );
  }

  // Le rôle porté par la clé, et le projet qu'elle ouvre.
  const cle = estLocal || !serviceKey ? {} : lireCle(serviceKey);

  if (cle.role && cle.role !== 'service_role') {
    problemes.push(
      `SUPABASE_SERVICE_ROLE_KEY porte le rôle « ${cle.role} », pas « service_role ». ` +
        'L\'application lira peut-être, mais n\'écrira rien : chaque inscription échouera. ' +
        'Reprends la clé service_role dans Supabase → Settings → API.',
    );
  }

  // Deux projets Supabase se sont déjà succédé ici : une URL et une clé qui
  // ne désignent pas le même projet donneraient « table introuvable ».
  const projetUrl = supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\./)?.[1];
  if (cle.projet && projetUrl && cle.projet !== projetUrl) {
    problemes.push(
      `SUPABASE_URL vise le projet « ${projetUrl} » mais la clé appartient à « ${cle.projet} ».`,
    );
  }

  if (!resendKey) {
    problemes.push('RESEND_API_KEY est vide.');
  } else if (!estLocal && !resendKey.startsWith('re_')) {
    problemes.push('RESEND_API_KEY ne ressemble pas à une clé Resend (elle commence par « re_ »).');
  }

  // EMAIL_FROM contient des espaces et des chevrons : selon l'importateur de
  // variables, les guillemets peuvent être conservés, et Resend refuse alors
  // l'expéditeur. Autant s'en apercevoir ici plutôt qu'au premier envoi.
  const expediteur = process.env.EMAIL_FROM ?? '';
  if (!expediteur) {
    problemes.push('EMAIL_FROM est vide.');
  } else if (/["']/.test(expediteur)) {
    problemes.push(
      `EMAIL_FROM contient des guillemets (${expediteur}). Retire-les : ` +
        'Resend refuserait cet expéditeur.',
    );
  } else if (!/^[^<>@]*<?[^\s<>@]+@[^\s<>@]+\.[a-z]{2,}>?$/i.test(expediteur.trim())) {
    problemes.push(`EMAIL_FROM ne ressemble pas à un expéditeur valide (${expediteur}).`);
  }

  if (!process.env.IP_HASH_SALT) {
    // Sans conséquence sur le fonctionnement : on le signale sans bloquer.
    problemes.push('IP_HASH_SALT est vide : aucune trace d’IP ne sera conservée (facultatif).');
  }

  // Les migrations en attente : signalées, mais jamais bloquantes. Le
  // formulaire et la curation tournent sans celles du crush time.
  const migrations = await migrationsManquantes(supabaseUrl, serviceKey);
  problemes.push(...migrations.map((m) => `${m} (facultatif tant que tu n’ouvres pas de soirée)`));

  const bloquants = problemes.filter((p) => !p.includes('facultatif'));

  return NextResponse.json(
    {
      ok: bloquants.length === 0,
      configured: {
        supabase: Boolean(supabaseUrl && serviceKey),
        cleSupabase: cle.role ?? null,
        projetSupabase: cle.projet ?? projetUrl ?? null,
        resend: Boolean(resendKey),
        expediteur: expediteur || null,
        ipSalt: Boolean(process.env.IP_HASH_SALT),
        adminOuvert: !(process.env.ADMIN_CODE ?? '').trim(),
        // Sans ces deux-là, l'application marche mais ne notifie rien —
        // et personne ne s'en aperçoit avant le soir de la soirée.
        notifications: Boolean(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
        ),
        migrationsAJour: migrations.length === 0,
      },
      problemes,
      at: new Date().toISOString(),
    },
    { status: bloquants.length === 0 ? 200 : 503 },
  );
}
