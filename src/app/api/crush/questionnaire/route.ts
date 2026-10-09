import { NextResponse } from 'next/server';
import { enregistrerQuestionnaire } from '@/lib/crush';
import { participantConnecte } from '@/lib/crush-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Enregistrer le questionnaire de fin de soirée.
 *
 * Deux usages pour une seule route : « envoyer: false » garde le
 * brouillon au fil des sections, « envoyer: true » le clôt. Le contenu
 * n'est pas validé par un schéma mais filtré question par question — une
 * clé inconnue ou une option inventée est écartée sans faire échouer
 * l'envoi, parce qu'un avis perdu pour une virgule serait perdu pour de
 * bon : la salle se vide, personne ne recommence.
 */
export async function POST(requete: Request) {
  const moi = await participantConnecte();
  if (!moi) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });

  const corps = (await requete.json().catch(() => null)) as {
    reponses?: unknown;
    envoyer?: boolean;
  } | null;
  if (!corps) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });

  const resultat = await enregistrerQuestionnaire(moi, corps.reponses, corps.envoyer === true);
  if (!resultat.ok) return NextResponse.json({ error: resultat.raison }, { status: 409 });

  return NextResponse.json({ ok: true });
}
