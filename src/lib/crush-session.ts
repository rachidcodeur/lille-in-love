import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';
import { participantParJeton, type Participant } from './crush';
import { supabaseAdmin } from './supabase';

export const COOKIE_CRUSH = 'lil_crush';

/**
 * La session d'un participant.
 *
 * Pas de mot de passe, pas de compte à créer : le lien personnel ou le code
 * de la salle suffit à entrer, et c'est ensuite ce cookie qui tient. Il ne
 * contient que l'identifiant du participant et sa signature — rien qu'on
 * puisse fabriquer soi-même, rien qu'on puisse lire pour apprendre autre
 * chose.
 *
 * La clé est le sel du hachage d'IP, avec un message qui lui est propre :
 * deux usages d'un même secret ne doivent jamais produire la même signature.
 */
function signature(participantId: string): string {
  const cle = env.ipSalt() || 'lille-in-love-sans-sel';
  return createHmac('sha256', cle).update(`lil-crush-v1:${participantId}`).digest('hex').slice(0, 32);
}

export function valeurCookie(participantId: string): string {
  return `${participantId}.${signature(participantId)}`;
}

function lireValeur(brut: string | undefined): string | null {
  if (!brut) return null;
  const separateur = brut.lastIndexOf('.');
  if (separateur < 1) return null;

  const id = brut.slice(0, separateur);
  const signe = brut.slice(separateur + 1);
  const attendue = signature(id);

  // Comparaison à durée constante : on ne laisse pas deviner la signature
  // caractère par caractère en mesurant le temps de réponse.
  const a = Buffer.from(signe);
  const b = Buffer.from(attendue);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

/**
 * Qui regarde la page.
 *
 * Relu en base à chaque fois, et non reconstitué depuis le cookie : une
 * personne retirée de la soirée entre-temps ne doit pas continuer d'entrer
 * parce qu'elle avait déjà le cookie en poche.
 */
export async function participantConnecte(): Promise<Participant | null> {
  const jar = await cookies();
  const id = lireValeur(jar.get(COOKIE_CRUSH)?.value);
  if (!id) return null;

  const { data } = await supabaseAdmin()
    .from('lil_crush_participants')
    .select('*')
    .eq('id', id)
    .is('retire_at', null)
    .maybeSingle();

  return (data as Participant | null) ?? null;
}

/** Noter qu'il ou elle est entré, pour que l'hôte sache qui n'a pas ouvert. */
export async function marquerArrivee(participant: Participant): Promise<void> {
  if (participant.claimed_at) return;
  await supabaseAdmin()
    .from('lil_crush_participants')
    .update({ claimed_at: new Date().toISOString() })
    .eq('id', participant.id);
}

/** Le participant désigné par un lien personnel, s'il est encore de la soirée. */
export async function parLien(jeton: string): Promise<Participant | null> {
  return participantParJeton(jeton);
}
