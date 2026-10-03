import { NextResponse } from 'next/server';
import { participantConnecte } from '@/lib/crush-session';
import { estUneTaille, servirPhoto } from '@/lib/photos';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Une photo, pour les participants d'une soirée.
 *
 * Le jumeau de /admin/photo, avec une autorisation différente : ici il faut
 * être de la soirée, et la photo doit appartenir à quelqu'un d'autre de la
 * même soirée. Sans cette seconde condition, un participant pourrait, en
 * changeant un identifiant dans l'adresse, parcourir les photos de toute la
 * base — y compris celles de gens qui ne sont pas là ce soir.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const moi = await participantConnecte();
  if (!moi) return new NextResponse(null, { status: 404 });

  const demandee = new URL(requete.url).searchParams.get('t');
  return servirPhoto({
    requete,
    photoId: id,
    taille: estUneTaille(demandee) ? demandee : 'carte',
    // Le cache est par espace : deux soirées n'ont pas les mêmes ayants droit.
    espace: `crush:${moi.soiree_id}`,
    autorise: async (memberId) => {
      if (!memberId) return false;
      const { data } = await supabaseAdmin()
        .from('lil_crush_participants')
        .select('id')
        .eq('soiree_id', moi.soiree_id)
        .eq('member_id', memberId)
        .is('retire_at', null)
        .maybeSingle();
      return Boolean(data);
    },
  });
}
