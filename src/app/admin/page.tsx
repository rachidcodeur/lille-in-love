import Link from 'next/link';
import { countsByStatus, listMembers, photoUrls } from '@/lib/admin';
import { STATUS_ORDER, label, relative } from '@/lib/libelles';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ statut?: string }> };

/** Les candidatures, de la plus récente à la plus ancienne. */
export default async function AdminListPage({ searchParams }: Props) {
  const { statut = 'nouveau' } = await searchParams;

  let members: Awaited<ReturnType<typeof listMembers>>;
  let counts: Record<string, number>;

  try {
    [members, counts] = await Promise.all([listMembers(statut), countsByStatus()]);
  } catch (cause) {
    // Presque toujours une clé Supabase absente ou fausse : on le dit
    // franchement plutôt que d'afficher une liste vide trompeuse.
    const message = cause instanceof Error ? cause.message : String(cause);
    return (
      <main className="adm-main">
        <h1 className="adm-title">Impossible de lire les candidatures</h1>
        <p className="adm-sub">{message}</p>
        <p className="adm-hint">
          Vérifie <code>SUPABASE_URL</code> et <code>SUPABASE_SERVICE_ROLE_KEY</code>, puis
          que les scripts <code>supabase/01</code> et <code>supabase/03</code> ont bien été
          exécutés. <code>/api/health</code> te dira ce qui manque.
        </p>
      </main>
    );
  }

  // Une vignette par fiche : c'est le premier repère quand on parcourt la liste.
  const thumbnails = await Promise.all(
    members.map(async (member) =>
      member.photo_count > 0 ? ((await photoUrls(member.id))[0] ?? null) : null,
    ),
  );

  return (
    <main className="adm-main">
      <h1 className="adm-title">Candidatures</h1>
      <p className="adm-sub">
        {counts.tous ?? 0} au total · {counts.nouveau ?? 0} à examiner
      </p>

      <nav className="adm-filters">
        {STATUS_ORDER.map((status) => (
          <Link
            key={status}
            href={`/admin?statut=${status}`}
            className="adm-filter"
            data-on={statut === status}
          >
            {label.status(status)} <b>{counts[status] ?? 0}</b>
          </Link>
        ))}
      </nav>

      {members.length === 0 ? (
        <div className="adm-empty">
          <p>Aucune candidature ici.</p>
          <p className="adm-hint">
            {statut === 'nouveau'
              ? 'Tout est examiné, ou personne ne s’est encore inscrit.'
              : 'Change de filtre pour en voir d’autres.'}
          </p>
        </div>
      ) : (
        <div className="adm-list">
          {members.map((member, index) => (
            <Link key={member.id} href={`/admin/${member.id}`} className="adm-row">
              {thumbnails[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="adm-avatar" src={thumbnails[index]!} alt="" />
              ) : (
                <div className="adm-avatar adm-avatar-empty" aria-hidden="true">
                  {member.first_name.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div className="adm-row-main">
                <p className="adm-row-name">
                  {member.first_name} {member.last_name}
                </p>
                <p className="adm-row-meta">
                  {[
                    label.gender(member.gender),
                    member.age ? `${member.age} ans` : null,
                    member.city,
                    member.email,
                    relative(member.created_at),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <div className="adm-row-side">
                {member.suspect && (
                  <span className="adm-tag" data-alerte="true" title="Envoi inhabituel">
                    à vérifier
                  </span>
                )}
                {member.form_version === 'court' && <span className="adm-tag">court</span>}
                <span className="adm-chip" data-status={member.status}>
                  {label.status(member.status)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
