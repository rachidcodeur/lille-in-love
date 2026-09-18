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

  if (!resendKey) {
    problemes.push('RESEND_API_KEY est vide.');
  } else if (!estLocal && !resendKey.startsWith('re_')) {
    problemes.push('RESEND_API_KEY ne ressemble pas à une clé Resend (elle commence par « re_ »).');
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
        resend: Boolean(resendKey),
        ipSalt: Boolean(process.env.IP_HASH_SALT),
        adminOuvert: !(process.env.ADMIN_CODE ?? '').trim(),
      },
      problemes,
      at: new Date().toISOString(),
    },
    { status: bloquants.length === 0 ? 200 : 503 },
  );
}
