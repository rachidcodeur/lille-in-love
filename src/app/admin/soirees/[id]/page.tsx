import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CrushImport } from '@/components/admin/CrushImport';
import { CrushPilotage } from '@/components/admin/CrushPilotage';
import { ActiverCrush } from '@/components/admin/ActiverCrush';
import { manches, participants } from '@/lib/crush';
import { getSoiree } from '@/lib/soirees';
import { formatDate } from '@/lib/libelles';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/** Le crush time d'une soirée : le créer, puis le tenir le soir même. */
export default async function CrushPage({ params }: Props) {
  const { id } = await params;

  const soiree = await getSoiree(id).catch(() => null);
  if (!soiree) notFound();

  let gens: Awaited<ReturnType<typeof participants>> = [];
  let rounds: Awaited<ReturnType<typeof manches>> = [];
  let indisponible: string | null = null;

  try {
    [gens, rounds] = await Promise.all([participants(id), manches(id)]);
  } catch (cause) {
    indisponible = cause instanceof Error ? cause.message : String(cause);
  }

  const cree = gens.length > 0;

  return (
    <main className="adm-main">
      <Link href="/admin/soirees" className="adm-back">
        ← Toutes les soirées
      </Link>

      <p className="adm-eyebrow">Crush Time</p>
      <h1 className="adm-title">{soiree.nom}</h1>
      <p className="adm-sub">
        {formatDate(soiree.date_soiree)} · {soiree.lieu} · {soiree.age_min}-{soiree.age_max} ans
      </p>

      {indisponible ? (
        <div className="adm-alerte" data-gravite="haute">
          <strong>Le crush time n’est pas encore disponible.</strong> Exécute{' '}
          <code>supabase/13_crushtime.sql</code> dans le SQL Editor de Supabase, puis recharge.
          <br />
          <small>{indisponible}</small>
        </div>
      ) : !cree ? (
        <div className="adm-card">
          <div className="adm-card-head">
            <p className="adm-card-title">Importer la billetterie</p>
          </div>
          <CrushImport soireeId={id} date={soiree.date_soiree} />
        </div>
      ) : (
        <>
          <ActiverCrush
            soireeId={id}
            code={soiree.crush_code ?? null}
            actif={Boolean(soiree.crush_actif)}
            participants={gens.filter((p) => !p.retire_at).length}
          />
          <CrushPilotage manches={rounds} gens={gens} />
        </>
      )}
    </main>
  );
}
