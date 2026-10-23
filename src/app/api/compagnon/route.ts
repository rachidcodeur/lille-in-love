import { NextResponse } from 'next/server';
import { z } from 'zod';
import { chercherCompagnon } from '@/lib/compagnon';
import { vignetteEnLigne } from '@/lib/photos';
import { clientIp, corsHeaders, rateLimit } from '@/lib/security';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  prenom: z.string().trim().min(2).max(60),
  nom: z.string().trim().min(2).max(60),
});

/**
 * Reconnaître la personne qu'on amène.
 *
 * On ne dévoile pas les participants : cette route ne répond que si le
 * prénom ET le nom donnés désignent une seule fiche, exactement. Elle ne
 * cherche pas par approximation, ne renvoie jamais de liste, et ne dit
 * rien de plus qu'un prénom, trois lettres de nom et une vignette — de
 * quoi reconnaître quelqu'un qu'on connaît déjà, pas de quoi découvrir
 * quelqu'un qu'on ne connaît pas.
 *
 * Il reste qu'on peut essayer des noms au hasard. D'où la limite par IP :
 * vingt essais par heure n'empêchent pas de retrouver son amie, et ne
 * permettent pas de parcourir un annuaire.
 *
 * Le rapprochement n'est pas fait ici : la route dit « c'est peut-être
 * elle », et c'est la personne qui confirme. Un nom qui se ressemble
 * n'est pas quelqu'un qu'on a reconnu.
 */
export async function POST(requete: Request) {
  const cors = corsHeaders(requete);

  const barriere = rateLimit(`compagnon:${clientIp(requete) ?? 'inconnu'}`, {
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (!barriere.ok) {
    return NextResponse.json(
      { trouve: false },
      { status: 429, headers: { ...cors, 'Retry-After': String(barriere.retryAfterSeconds) } },
    );
  }

  const lu = schema.safeParse(await requete.json().catch(() => null));
  if (!lu.success) return NextResponse.json({ trouve: false }, { headers: cors });

  const fiche = await chercherCompagnon(lu.data.prenom, lu.data.nom);
  if (!fiche) return NextResponse.json({ trouve: false }, { headers: cors });

  return NextResponse.json(
    {
      trouve: true,
      id: fiche.id,
      prenom: fiche.first_name,
      // Les trois premières lettres, comme partout ailleurs : de quoi
      // lever un doute entre deux Julie sans afficher l'état civil.
      nom: (fiche.last_name ?? '').slice(0, 3).toUpperCase(),
      photo: await vignetteEnLigne(fiche.id),
    },
    { headers: cors },
  );
}

export async function OPTIONS(requete: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(requete) });
}
