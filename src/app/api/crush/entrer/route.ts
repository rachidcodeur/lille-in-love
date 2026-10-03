import { NextResponse } from 'next/server';
import { z } from 'zod';
import { entrerAvecCode } from '@/lib/crush';
import { COOKIE_CRUSH, marquerArrivee, valeurCookie } from '@/lib/crush-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().trim().email('Cette adresse ne ressemble pas à une adresse email.'),
  code: z.string().trim().regex(/^\d{4}$/, 'Le code tient en quatre chiffres.'),
});

/**
 * Entrer avec son adresse et le code annoncé dans la salle.
 *
 * La porte principale, en pratique : rien à recevoir, rien à attendre, aucun
 * réseau à partager entre cinquante téléphones. Le code seul ne suffit pas —
 * il faut aussi figurer sur la liste des billets.
 */
export async function POST(requete: Request) {
  const lu = schema.safeParse(await requete.json().catch(() => null));
  if (!lu.success) {
    return NextResponse.json(
      { error: lu.error.issues[0]?.message ?? 'Requête invalide.' },
      { status: 400 },
    );
  }

  const participant = await entrerAvecCode(lu.data.email, lu.data.code).catch(() => null);

  if (!participant) {
    // Un seul message pour les deux échecs : dire « ce code est bon mais pas
    // cette adresse » apprendrait à qui tâtonne quelle moitié corriger.
    return NextResponse.json(
      { error: 'Adresse ou code incorrect. Le code est annoncé dans la salle.' },
      { status: 401 },
    );
  }

  await marquerArrivee(participant);

  const reponse = NextResponse.json({ ok: true, prenom: participant.first_name });
  reponse.cookies.set(COOKIE_CRUSH, valeurCookie(participant.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 2,
  });
  return reponse;
}
