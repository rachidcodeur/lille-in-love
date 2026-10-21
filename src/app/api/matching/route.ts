import { NextResponse } from 'next/server';
import { z } from 'zod';
import { nettoyerMatching } from '@/lib/matching';
import { supabaseAdmin } from '@/lib/supabase';
import { corsHeaders } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().uuid(),
  reponses: z.record(z.unknown()).default({}),
});

/**
 * Compléter le matching, une fois la candidature envoyée.
 *
 * Le jeton fait tout le travail d'autorisation : rendu une seule fois à
 * celui qui vient de s'inscrire, il désigne sa fiche et rien d'autre. Un
 * identifiant de fiche ne suffirait pas — on écrit ici des données que la
 * loi dit sensibles.
 *
 * Il est effacé dès qu'il a servi : on répond une fois, pas trois.
 */
export async function POST(requete: Request) {
  const cors = corsHeaders(requete);

  const lu = schema.safeParse(await requete.json().catch(() => null));
  if (!lu.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: cors });
  }

  const db = supabaseAdmin();
  const { data: membre } = await db
    .from('lil_members')
    .select('id')
    .eq('matching_token', lu.data.token)
    .maybeSingle();

  if (!membre) {
    return NextResponse.json(
      { error: 'Ce lien n’est plus valable. Écris-nous et on s’en occupe.' },
      { status: 404, headers: cors },
    );
  }

  const brut = lu.data.reponses as Record<string, unknown>;
  // Le consentement aux données sensibles se donne en tête du formulaire :
  // sans lui, origines et religion ne s'écrivent pas, quoi qu'envoie le
  // navigateur. Le tamis est ici et nulle part ailleurs.
  const consent = brut.consentSensible === true;

  const { error } = await db
    .from('lil_members')
    .update({
      matching_optin: true,
      matching: nettoyerMatching(brut, consent),
      matching_consent_at: consent ? new Date().toISOString() : null,
      // Usage unique : le jeton ne resservira pas.
      matching_token: null,
    })
    .eq('id', membre.id);

  if (error) {
    console.error('[matching]', error.message);
    return NextResponse.json(
      { error: 'On n’a pas réussi à enregistrer tes réponses. Réessaie dans un instant.' },
      { status: 500, headers: cors },
    );
  }

  return NextResponse.json({ ok: true }, { headers: cors });
}

export async function OPTIONS(requete: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(requete) });
}
