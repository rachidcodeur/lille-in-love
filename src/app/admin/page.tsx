import { Fragment } from 'react';
import Link from 'next/link';
import { facettes, listMembers, vignettes } from '@/lib/admin';
import { STATUS_ORDER, label, relative } from '@/lib/libelles';
import {
  compter,
  correspond,
  filtresActifs,
  lien,
  parseFiltres,
  presque,
  resume,
  trouve,
} from '@/lib/groupes';
import { GroupePicker } from '@/components/admin/GroupePicker';
import { Icone } from '@/components/admin/Icones';
import { PanneauFiltres } from '@/components/admin/PanneauFiltres';
import { Vignette } from '@/components/admin/Vignette';
import { FILTRES_PAR_DEFAUT } from '@/lib/groupes';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const LIMITE_AFFICHEE = 300;

/** Les candidatures, de la plus récente à la plus ancienne. */
export default async function AdminListPage({ searchParams }: Props) {
  const filtres = parseFiltres(await searchParams, STATUS_ORDER);

  let members: Awaited<ReturnType<typeof listMembers>>;
  let fiches: Awaited<ReturnType<typeof facettes>>;

  try {
    // Les facettes d'abord : c'est sur elles que se fait la recherche, pour
    // qu'elle ignore les accents — ce que « ilike » ne sait pas faire.
    fiches = await facettes();
    const idsTrouves = filtres.recherche
      ? fiches.filter((fiche) => trouve(fiche, filtres.recherche)).map((fiche) => fiche.id)
      : undefined;
    members = await listMembers(filtres, LIMITE_AFFICHEE, idsTrouves);
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

  // On ne refuse plus, on ne met plus « en examen » : ces pastilles ne
  // s'affichent que s'il reste des candidatures qui les portent.
  const statutsVisibles = STATUS_ORDER.filter(
    (status) =>
      ['tous', 'nouveau', 'valide'].includes(status) ||
      (parStatut[status] ?? 0) > 0 ||
      filtres.statut === status,
  );
  const selection = fiches.filter((fiche) => correspond(fiche, filtres)).length;
  const aDesFiltres = filtresActifs(filtres);
  const detail = resume(filtres);

  // Ce que porte la pastille de l'icône : les critères posés en dehors du
  // statut, qui a ses propres boutons juste à côté.
  const criteres = [
    filtres.groupes.length > 0,
    filtres.genre !== 'tous',
    filtres.orientation !== 'tous',
    filtres.ageMin !== null || filtres.ageMax !== null,
  ].filter(Boolean).length;

  // Les reprises de l'ancien site, dans ce qui est affiché : le nombre que
  // l'intertitre annonce.
  const anciennes = members.filter((member) => member.legacy).length;

  // Ce qui restreint encore la recherche, et les noms qui lui ressemblent.
  const autresCriteres = resume({ ...filtres, recherche: '' });
  const suggestions = filtres.recherche ? presque(fiches, filtres.recherche) : [];

  // Une vignette par fiche : c'est le premier repère quand on parcourt la
  // liste. Une seule requête pour toute la page — une par ligne faisait
  // crouler Supabase, et des vignettes revenaient vides.
  const apercus = await vignettes(members.map((member) => member.id));

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

      <form className="adm-recherche" method="get" action="/admin" role="search">
        {/* Les critères en cours survivent à une recherche : on cherche
            « Dupont » parmi les femmes du groupe C, pas dans toute la base. */}
        {filtres.statut !== 'tous' && <input type="hidden" name="statut" value={filtres.statut} />}
        {filtres.groupes.length > 0 && (
          <input type="hidden" name="groupe" value={filtres.groupes.join(',')} />
        )}
        {filtres.genre !== 'tous' && <input type="hidden" name="genre" value={filtres.genre} />}
        {filtres.orientation !== 'tous' && (
          <input type="hidden" name="orientation" value={filtres.orientation} />
        )}
        {filtres.ageMin !== null && <input type="hidden" name="ageMin" value={filtres.ageMin} />}
        {filtres.ageMax !== null && <input type="hidden" name="ageMax" value={filtres.ageMax} />}

        <span className="adm-recherche-loupe" aria-hidden="true">
          <Icone nom="loupe" taille={18} />
        </span>
        <input
          type="search"
          name="q"
          defaultValue={filtres.recherche}
          placeholder="Chercher un prénom, un nom, un email, une ville…"
          aria-label="Chercher une candidature"
        />
        {filtres.recherche && (
          <Link
            className="adm-recherche-vider"
            href={lien('/admin', filtres, { recherche: '' })}
            aria-label="Effacer la recherche"
          >
            <Icone nom="croix" taille={16} />
          </Link>
        )}
        <button type="submit" className="adm-btn adm-btn-filtrer">
          Chercher
        </button>
      </form>

      <div className="adm-barre-filtres">
        <nav className="adm-filters" aria-label="Statut">
          {statutsVisibles.map((status) => (
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
            {filtres.recherche ? (
              <>
                Rien ne correspond à « {filtres.recherche} »
                {/* Chercher avec un filtre de groupe oublié donne un écran
                    vide inexplicable : on dit ce qui restreint encore. */}
                {autresCriteres.length > 0 && <> parmi {autresCriteres.join(' · ')}</>}.
              </>
            ) : aDesFiltres ? (
              'Aucune fiche ne réunit ces critères. Élargis, ou remets tout à zéro.'
            ) : (
              'Personne ne s’est encore inscrit.'
            )}
          </p>

          {/* « Antony » quand la base dit « Anthony » : une lettre d'écart,
              et un écran vide qui ne l'explique pas. */}
          {suggestions.length > 0 && (
            <p className="adm-hint">
              Peut-être{' '}
              {suggestions.map((nom, index) => (
                <span key={nom}>
                  {index > 0 && ', '}
                  <Link href={lien('/admin', filtres, { recherche: nom })}>
                    <strong>{nom}</strong>
                  </Link>
                </span>
              ))}{' '}
              ?
            </p>
          )}

          {filtres.recherche && autresCriteres.length > 0 && (
            <p className="adm-hint">
              <Link href={lien('/admin', FILTRES_PAR_DEFAUT, { recherche: filtres.recherche })}>
                Chercher « {filtres.recherche} » dans toutes les candidatures
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="adm-list">
          {members.map((member, index) => (
            <Fragment key={member.id}>
              {/* La bascule entre les deux blocs, affichée une seule fois, là
                  où commence la première reprise. Sans elle on croirait à des
                  fiches mal remplies plutôt qu'à un autre questionnaire. */}
              {member.legacy && !members[index - 1]?.legacy && (
                <div className="adm-separateur">
                  <h2>Anciennes candidatures</h2>
                  <p>
                    {anciennes} {anciennes > 1 ? 'fiches reprises' : 'fiche reprise'} du site
                    précédent. Le questionnaire d’alors ne demandait ni le nom de famille ni les
                    centres d’intérêt : ces champs sont vides parce que la question n’a pas été
                    posée.
                  </p>
                </div>
              )}

              <article className="adm-row" data-ancienne={member.legacy ? 'true' : undefined}>
                <Link href={`/admin/${member.id}`} className="adm-row-lien">
                  {apercus.get(member.id) ? (
                    <Vignette
                      className="adm-avatar"
                      src={apercus.get(member.id)!}
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
            </Fragment>
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
