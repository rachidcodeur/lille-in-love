import Link from 'next/link';
import { facettes, listMembers, photoUrls } from '@/lib/admin';
import { STATUS_ORDER, label, relative } from '@/lib/libelles';
import {
  compter,
  correspond,
  filtresActifs,
  lien,
  parseFiltres,
  resume,
} from '@/lib/groupes';
import { GroupePicker } from '@/components/admin/GroupePicker';
import { PanneauFiltres } from '@/components/admin/PanneauFiltres';
import { Vignette } from '@/components/admin/Vignette';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const LIMITE_AFFICHEE = 300;

/** Les candidatures, de la plus récente à la plus ancienne. */
export default async function AdminListPage({ searchParams }: Props) {
  const filtres = parseFiltres(await searchParams, STATUS_ORDER);

  let members: Awaited<ReturnType<typeof listMembers>>;
  let fiches: Awaited<ReturnType<typeof facettes>>;

  try {
    [members, fiches] = await Promise.all([listMembers(filtres, LIMITE_AFFICHEE), facettes()]);
  } catch (cause) {
    // Presque toujours une clé Supabase absente ou fausse : on le dit
    // franchement plutôt que d'afficher une liste vide trompeuse.
    const message = cause instanceof Error ? cause.message : String(cause);
    return (
      <main className="adm-main">
        <h1 className="adm-title">Impossible de lire les candidatures</h1>
        <p className="adm-sub">{message}</p>
        <p className="adm-hint">
          Vérifie <code>SUPABASE_URL</code> et <code>SUPABASE_SERVICE_ROLE_KEY</code>, puis que
          les scripts <code>supabase/01</code>, <code>supabase/03</code> et{' '}
          <code>supabase/08</code> ont bien été exécutés — ce dernier ajoute les groupes A/B/C.{' '}
          <code>/api/health</code> te dira ce qui manque.
        </p>
      </main>
    );
  }

  const parStatut = compter(fiches, filtres, 'statut', STATUS_ORDER);
  const selection = fiches.filter((fiche) => correspond(fiche, filtres)).length;
  const aDesFiltres = filtresActifs(filtres);
  const detail = resume(filtres);

  // Ce que porte la pastille de l'icône : les critères posés en dehors du
  // statut, qui a ses propres boutons juste à côté.
  const criteres = [
    filtres.groupe !== 'tous',
    filtres.genre !== 'tous',
    filtres.ageMin !== null || filtres.ageMax !== null,
  ].filter(Boolean).length;

  // Une vignette par fiche : c'est le premier repère quand on parcourt la liste.
  const thumbnails = await Promise.all(
    members.map(async (member) =>
      member.photo_count > 0 ? ((await photoUrls(member.id))[0] ?? null) : null,
    ),
  );

  return (
    <main className="adm-main">
      <div className="adm-head">
        <div>
          <p className="adm-eyebrow">Espace curation</p>
          <h1 className="adm-title">Candidatures</h1>
          <p className="adm-sub">
            {selection} {selection > 1 ? 'fiches' : 'fiche'}
            {detail.length > 0 ? ` · ${detail.join(' · ')}` : ' au total'}
            {/* « à examiner » n'a de sens que s'il reste quelque chose à faire. */}
            {(parStatut.nouveau ?? 0) > 0 && ` · ${parStatut.nouveau} à examiner`}
          </p>
        </div>

      </div>

      <div className="adm-barre-filtres">
        <nav className="adm-filters" aria-label="Statut">
          {STATUS_ORDER.map((status) => (
            <Link
              key={status}
              href={lien('/admin', filtres, { statut: status })}
              className="adm-filter"
              data-on={filtres.statut === status}
            >
              {label.status(status)} <b>{parStatut[status] ?? 0}</b>
            </Link>
          ))}
        </nav>

        <PanneauFiltres filtres={filtres} fiches={fiches} criteres={criteres} />
      </div>

      {members.length === 0 ? (
        <div className="adm-empty">
          <p>Aucune candidature ici.</p>
          <p className="adm-hint">
            {aDesFiltres
              ? 'Aucune fiche ne réunit ces critères. Élargis, ou remets tout à zéro.'
              : 'Personne ne s’est encore inscrit.'}
          </p>
        </div>
      ) : (
        <div className="adm-list">
          {members.map((member, index) => (
            <article key={member.id} className="adm-row">
              <Link href={`/admin/${member.id}`} className="adm-row-lien">
                {thumbnails[index] ? (
                  <Vignette
                    className="adm-avatar"
                    src={thumbnails[index]!}
                    initiale={member.first_name.slice(0, 1).toUpperCase()}
                  />
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
              </Link>

              <div className="adm-row-side">
                {member.suspect && (
                  <span className="adm-tag" data-alerte="true" title="Envoi inhabituel">
                    à vérifier
                  </span>
                )}
                <span className="adm-chip" data-status={member.status}>
                  {label.status(member.status)}
                </span>
                <GroupePicker memberId={member.id} groupe={member.soiree_group} compact />
              </div>
            </article>
          ))}
        </div>
      )}

      {selection > members.length && (
        <p className="adm-hint">
          {members.length} fiches affichées sur {selection}. L’export CSV, dans le panneau des
          filtres, les emporte toutes.
        </p>
      )}
    </main>
  );
}
