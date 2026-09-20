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
      },
      problemes,
      at: new Date().toISOString(),
    },
    { status: bloquants.length === 0 ? 200 : 503 },
  );
}
