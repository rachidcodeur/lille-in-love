import { PublierSoiree } from '@/components/admin/PublierSoiree';
import { formatDate, formatDateTime } from '@/lib/libelles';
import { listerSoirees, type SoireeRow } from '@/lib/soirees';

export const dynamic = 'force-dynamic';

/** Publier une soirée, et retrouver celles déjà publiées avec ce qu'elles ont déclenché. */
export default async function SoireesPage() {
  let soirees: SoireeRow[] = [];
  let indisponible: string | null = null;

  try {
    soirees = await listerSoirees();
  } catch (cause) {
    indisponible = cause instanceof Error ? cause.message : String(cause);
  }

  return (
    <main className="adm-main">
      <h1 className="adm-title">Soirées</h1>
      <p className="adm-sub">
        Publier une soirée prévient aussitôt les profils non retenus (03) et les validés hors de
        sa classe d’âge (04).
      </p>

      {indisponible ? (
        <div className="adm-alerte" data-gravite="haute">
          <strong>Les soirées ne sont pas encore disponibles.</strong> Exécute{' '}
          <code>supabase/05_soirees.sql</code> dans le SQL Editor de Supabase, puis recharge la
          page.
          <br />
          <small>{indisponible}</small>
        </div>
      ) : (
        <div className="adm-soirees">
          <div className="adm-card">
            <p className="adm-card-title">Nouvelle soirée</p>
            <PublierSoiree />
          </div>

          <div>
            <div className="adm-card">
              <p className="adm-card-title">Publiées</p>
              {soirees.length === 0 ? (
                <p className="adm-hint" style={{ margin: 0 }}>
                  Aucune soirée publiée pour l’instant.
                </p>
              ) : (
                soirees.map((s) => (
                  <div className="adm-soiree" key={s.id}>
                    <p className="adm-soiree-nom">{s.nom}</p>
                    <p className="adm-soiree-infos">
                      {formatDate(s.date_soiree)}
                      {s.heure && ` à ${s.heure.slice(0, 5).replace(':', 'h')}`} · {s.lieu} ·{' '}
                      {s.age_min}-{s.age_max} ans
                    </p>
                    {s.bilan ? (
                      <div className="adm-soiree-bilan">
                        <span className="adm-chip" data-status="non_retenu">
                          {s.bilan['03']} × 03
                        </span>
                        <span className="adm-chip" data-status="en_attente_tranche">
                          {s.bilan['04']} × 04
                        </span>
                        <span className="adm-chip" data-status="valide">
                          {s.bilan.dans_la_tranche} dans la tranche
                        </span>
                        {s.bilan.age_inconnu > 0 && (
                          <span className="adm-chip" data-status="en_examen">
                            {s.bilan.age_inconnu} âge inconnu
                          </span>
                        )}
                        {s.bilan.echecs > 0 && (
                          <span className="adm-chip" data-status="nouveau">
                            {s.bilan.echecs} échec(s)
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="adm-hint" style={{ margin: 0 }}>
                        Bilan indisponible — la publication a pu être interrompue.
                      </p>
                    )}
                    <p className="adm-hint" style={{ margin: '8px 0 0' }}>
                      Publiée {formatDateTime(s.publiee_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
