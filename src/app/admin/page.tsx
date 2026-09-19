import Link from 'next/link';
import { facettes, listMembers, photoUrls } from '@/lib/admin';
import { STATUS_ORDER, label, relative } from '@/lib/libelles';
import {
  GENRE_CHOIX,
  GENRE_LABELS,
  GROUPE_CHOIX,
  GROUPE_LABELS,
  compter,
  correspond,
  filtresActifs,
  lien,
  parseFiltres,
  resume,
  versParams,
} from '@/lib/groupes';
import { GroupePicker } from '@/components/admin/GroupePicker';
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
  const parGroupe = compter(fiches, filtres, 'groupe', GROUPE_CHOIX);
  const parGenre = compter(fiches, filtres, 'genre', GENRE_CHOIX);
  const selection = fiches.filter((fiche) => correspond(fiche, filtres)).length;
  const aDesFiltres = filtresActifs(filtres);
  const detail = resume(filtres);

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

        <a
          className="adm-btn adm-btn-export"
          href={lien('/api/admin/export', filtres)}
          // download : le navigateur enregistre le fichier au lieu de l'ouvrir,
          // même si le serveur renvoie déjà un Content-Disposition.
          download
        >
          Exporter {selection} {selection > 1 ? 'fiches' : 'fiche'} en CSV
        </a>
      </div>

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

      <form className="adm-tri" method="get" action="/admin">
        {/* Le statut est choisi par les pastilles au-dessus : on le reconduit. */}
        {filtres.statut !== 'tous' && <input type="hidden" name="statut" value={filtres.statut} />}

        <label className="adm-tri-champ">
          <span>Groupe</span>
          <select name="groupe" defaultValue={filtres.groupe}>
            {GROUPE_CHOIX.map((choix) => (
              <option key={choix} value={choix}>
                {GROUPE_LABELS[choix]} ({parGroupe[choix] ?? 0})
              </option>
            ))}
          </select>
        </label>

        <label className="adm-tri-champ">
          <span>Qui</span>
          <select name="genre" defaultValue={filtres.genre}>
            {GENRE_CHOIX.map((choix) => (
              <option key={choix} value={choix}>
                {GENRE_LABELS[choix]} ({parGenre[choix] ?? 0})
              </option>
            ))}
          </select>
        </label>

        <label className="adm-tri-champ adm-tri-age">
          <span>Âge</span>
          <span className="adm-tri-bornes">
            <input
              type="number"
              name="ageMin"
              min={18}
              max={120}
              placeholder="18"
              defaultValue={filtres.ageMin ?? ''}
              aria-label="Âge minimum"
            />
            <i>–</i>
            <input
              type="number"
              name="ageMax"
              min={18}
              max={120}
              placeholder="99"
              defaultValue={filtres.ageMax ?? ''}
              aria-label="Âge maximum"
            />
          </span>
        </label>

        <button type="submit" className="adm-btn adm-btn-filtrer">
          Filtrer
        </button>

        {aDesFiltres && (
          <Link className="adm-tri-effacer" href="/admin">
            Tout effacer
          </Link>
        )}
      </form>

      {(filtres.ageMin !== null || filtres.ageMax !== null) && (
        <p className="adm-hint adm-tri-note">
          Les fiches du formulaire court n’ont pas de date de naissance : dès qu’une borne d’âge
          est posée, elles sortent de la sélection.
        </p>
      )}

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
                {member.form_version === 'court' && <span className="adm-tag">court</span>}
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
          {members.length} fiches affichées sur {selection}. L’export CSV, lui, les emporte
          toutes.
        </p>
      )}

      {aDesFiltres && (
        <p className="adm-hint">
          Le fichier exporté reprend la sélection ci-dessus —{' '}
          <code>?{versParams(filtres).toString()}</code>.
        </p>
      )}
    </main>
  );
}
