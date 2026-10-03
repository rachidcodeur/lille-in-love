import Link from 'next/link';
import { PublierSoiree } from '@/components/admin/PublierSoiree';
import { formatDate, formatDateTime } from '@/lib/libelles';
import { ceQuElleporte, listerSoirees, type SoireeRow } from '@/lib/soirees';
import { SupprimerSoiree } from '@/components/admin/SupprimerSoiree';

export const dynamic = 'force-dynamic';

/** Noter une soirée à venir, et retrouver celles déjà enregistrées. */
export default async function SoireesPage() {
  let soirees: SoireeRow[] = [];
  let charges: Record<string, { participants: number; matchs: number }> = {};
  let indisponible: string | null = null;

  try {
    soirees = await listerSoirees();
    // Ce que chaque soirée emporterait : compté ici pour que la demande de
    // confirmation sache quoi annoncer, sans aller-retour au moment du clic.
    const comptes = await Promise.all(soirees.map((s) => ceQuElleporte(s.id)));
    charges = Object.fromEntries(soirees.map((s, i) => [s.id, comptes[i]]));
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
                    <div className="adm-soiree-tete">
                      <p className="adm-soiree-nom">{s.nom}</p>
                      <SupprimerSoiree
                        soireeId={s.id}
                        nom={s.nom}
                        participants={charges[s.id]?.participants ?? 0}
                        matchs={charges[s.id]?.matchs ?? 0}
                      />
                    </div>
                    <p className="adm-soiree-infos">
                      {formatDate(s.date_soiree)}
                      {s.heure && ` à ${s.heure.slice(0, 5).replace(':', 'h')}`} · {s.lieu} ·{' '}
                      {s.age_min}-{s.age_max} ans
                    </p>
                    <p className="adm-hint" style={{ margin: '8px 0 0' }}>
                      Enregistrée {formatDateTime(s.publiee_at)}
                      {(charges[s.id]?.participants ?? 0) > 0 &&
                        ` · ${charges[s.id].participants} participants`}
                    </p>
                    {/* En cours, ce bouton est celui qu'on cherche des yeux
                        un soir de soirée : il ne doit pas ressembler aux
                        autres. */}
                    <Link
                      href={`/admin/soirees/${s.id}`}
                      className={`adm-btn adm-crush-lien${s.crush_actif ? ' adm-btn-yes' : ''}`}
                      data-encours={s.crush_actif || undefined}
                    >
                      {s.crush_actif && (
                        <span className="adm-pastille-vive" aria-hidden="true" />
                      )}
                      Crush Time{s.crush_actif ? ' en cours' : ''}
                    </Link>
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
