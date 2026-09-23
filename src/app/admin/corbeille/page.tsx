import Link from 'next/link';
import { listerCorbeille } from '@/lib/corbeille';
import { label, relative } from '@/lib/libelles';
import { ActionsCorbeille } from '@/components/admin/ActionsCorbeille';

export const dynamic = 'force-dynamic';

/** Les candidatures retirées de la liste, restaurables tant qu'on ne les efface pas. */
export default async function CorbeillePage() {
  let fiches: Awaited<ReturnType<typeof listerCorbeille>> = [];
  let indisponible: string | null = null;

  try {
    fiches = await listerCorbeille();
  } catch (cause) {
    indisponible = cause instanceof Error ? cause.message : String(cause);
  }

  return (
    <main className="adm-main">
      <Link href="/admin" className="adm-back">
        ← Toutes les candidatures
      </Link>

      <p className="adm-eyebrow">Espace curation</p>
      <h1 className="adm-title">Corbeille</h1>
      <p className="adm-sub">
        {fiches.length === 0
          ? 'Rien ici.'
          : `${fiches.length} candidature${fiches.length > 1 ? 's' : ''} retirée${
              fiches.length > 1 ? 's' : ''
            } de la liste.`}{' '}
        Restaurer la remet parmi les autres ; effacer emporte aussi ses photos, et ne se
        rattrape pas.
      </p>

      {indisponible ? (
        <div className="adm-alerte" data-gravite="haute">
          <strong>La corbeille n’est pas encore disponible.</strong> Exécute{' '}
          <code>supabase/11_corbeille.sql</code> dans le SQL Editor de Supabase, puis recharge la
          page.
          <br />
          <small>{indisponible}</small>
        </div>
      ) : fiches.length === 0 ? (
        <div className="adm-empty">
          <p>La corbeille est vide.</p>
          <p className="adm-hint">
            Les candidatures que tu retires depuis une fiche atterrissent ici.
          </p>
        </div>
      ) : (
        <div className="adm-list">
          {fiches.map((fiche) => (
            <article key={fiche.id} className="adm-row adm-row-corbeille">
              <div className="adm-avatar adm-avatar-empty" aria-hidden="true">
                {fiche.first_name.slice(0, 1).toUpperCase()}
              </div>

              <div className="adm-row-main">
                <p className="adm-row-name">
                  {fiche.first_name} {fiche.last_name}
                </p>
                <p className="adm-row-meta">
                  {[
                    label.gender(fiche.gender),
                    fiche.age ? `${fiche.age} ans` : null,
                    fiche.city,
                    fiche.email,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {fiche.deleted_at && ` · retirée ${relative(fiche.deleted_at)}`}
                </p>
              </div>

              <ActionsCorbeille
                memberId={fiche.id}
                nom={fiche.first_name}
                place="corbeille"
              />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
