import { PublierSoiree } from '@/components/admin/PublierSoiree';
import { formatDate, formatDateTime } from '@/lib/libelles';
import { listerSoirees, type SoireeRow } from '@/lib/soirees';

export const dynamic = 'force-dynamic';

/** Noter une soirée à venir, et retrouver celles déjà enregistrées. */
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
      <p className="adm-eyebrow">Espace curation</p>
      <h1 className="adm-title">Soirées</h1>
      <p className="adm-sub">
        Une date, un lieu, une classe d’âge. Aucun email n’est envoyé : les tables se composent à
        partir des groupes.
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
              <p className="adm-card-title">Enregistrées</p>
              {soirees.length === 0 ? (
                <p className="adm-hint" style={{ margin: 0 }}>
                  Aucune soirée enregistrée pour l’instant.
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
                    <p className="adm-hint" style={{ margin: '8px 0 0' }}>
                      Enregistrée {formatDateTime(s.publiee_at)}
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
