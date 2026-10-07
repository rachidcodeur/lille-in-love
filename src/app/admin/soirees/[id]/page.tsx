import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CrushComposer, type Candidat } from '@/components/admin/CrushComposer';
import { CrushPilotage } from '@/components/admin/CrushPilotage';
import { ActiverCrush } from '@/components/admin/ActiverCrush';
import { manches, ouvrirCeQuiDoitLEtre, participants } from '@/lib/crush';
import { notificationsPossibles } from '@/lib/notifications';
import { facettes, vignettes } from '@/lib/admin';
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
  let candidats: Candidat[] = [];
  let indisponible: string | null = null;

  try {
    const fiches = await facettes();
    // L'écran de l'hôte fait avancer la soirée au même titre que les
    // téléphones : c'est souvent le seul ouvert pendant qu'on fait l'appel.
    await ouvrirCeQuiDoitLEtre(id).catch(() => {});
    [gens, rounds] = await Promise.all([participants(id), manches(id)]);

    // Qui est déjà de la soirée, pour le montrer sans permettre de le
    // recocher. Le rapprochement se fait sur l'email : c'est lui qui a servi
    // à inscrire, que ce soit par la liste ou par la billetterie.
    const inscrits = new Set(gens.map((p) => String(p.email).toLowerCase()));
    const apercus = await vignettes(fiches.map((f) => f.id));

    // Sans genre renseigné, personne ne les verrait et ils ne verraient
    // personne : les proposer serait proposer une place vide.
    candidats = fiches
      .filter((f): f is typeof f & { gender: 'femme' | 'homme' } =>
        f.gender === 'femme' || f.gender === 'homme',
      )
      .map((f) => ({
        id: f.id,
        first_name: f.first_name,
        last_name: f.last_name,
        gender: f.gender,
        age: f.age,
        city: f.city,
        soiree_group: f.soiree_group,
        photo: apercus.get(f.id) ?? null,
        deja: inscrits.has(String(f.email).toLowerCase()),
      }));
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
            <p className="adm-card-title">Composer la soirée</p>
          </div>
          <CrushComposer
            soireeId={id}
            date={soiree.date_soiree}
            candidats={candidats}
            manchesPosees={rounds.length > 0}
          />
        </div>
      ) : (
        <CrushPilotage
          soireeId={id}
          manches={rounds}
          gens={gens}
          notificationsConfigurees={notificationsPossibles()}
          colonneDroite={
            <>
              <ActiverCrush
                soireeId={id}
                code={soiree.crush_code ?? null}
                actif={Boolean(soiree.crush_actif)}
                participants={gens.filter((p) => !p.retire_at).length}
              />

              {/* Replié : un billet de dernière minute est l'exception,
                  pas le geste du soir. */}
              <details className="adm-card adm-ajout">
                <summary>
                  <span className="adm-card-title">Ajouter des participants</span>
                  <span className="adm-hint">Un billet acheté à la dernière minute</span>
                </summary>
                <CrushComposer
                  soireeId={id}
                  date={soiree.date_soiree}
                  candidats={candidats}
                  manchesPosees={rounds.length > 0}
                />
              </details>
            </>
          }
        />
      )}
    </main>
  );
}
