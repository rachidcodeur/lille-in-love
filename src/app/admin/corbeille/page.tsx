import Link from 'next/link';
import { vignettes } from '@/lib/admin';
import { listerBloques, type Bloque } from '@/lib/blacklist';
import { listerCorbeille } from '@/lib/corbeille';
import { label, relative } from '@/lib/libelles';
import { ActionsCorbeille } from '@/components/admin/ActionsCorbeille';
import { Debloquer } from '@/components/admin/Debloquer';
import { Vignette } from '@/components/admin/Vignette';

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

  // Un visage se reconnaît, un prénom non : « Julie », il y en a huit.
  // C'est au moment de restaurer ou d'effacer qu'on veut être sûr.
  const apercus = fiches.length > 0 ? await vignettes(fiches.map((f) => f.id)) : new Map();

  // La liste noire vit à côté de la corbeille : ce sont les deux endroits
  // où l'on range quelqu'un, et le blocage se défait d'ici.
  let bloques: Bloque[] = [];
  let listeNoireAbsente = false;
  try {
    bloques = await listerBloques();
  } catch {
    listeNoireAbsente = true;
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
              {apercus.get(fiche.id) ? (
                <Vignette
                  className="adm-avatar"
                  src={apercus.get(fiche.id)!}
                  initiale={fiche.first_name.slice(0, 1).toUpperCase()}
                />
              ) : (
                <div className="adm-avatar adm-avatar-empty" aria-hidden="true">
                  {fiche.first_name.slice(0, 1).toUpperCase()}
                </div>
              )}

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

      {/* ---- La liste noire ------------------------------------------- */}
      <h2 className="adm-title adm-title-second">Bloqués</h2>
      <p className="adm-sub">
        Leur email et leur numéro ne permettent plus de s’inscrire. Débloquer les rend à nouveau
        possibles — la fiche, elle, reste où elle est.
      </p>

      {listeNoireAbsente ? (
        <div className="adm-alerte" data-gravite="haute">
          <strong>La liste noire n’est pas encore disponible.</strong> Exécute{' '}
          <code>supabase/25_blacklist.sql</code> dans le SQL Editor de Supabase, puis recharge la
          page.
        </div>
      ) : bloques.length === 0 ? (
        <div className="adm-empty">
          <p>Personne n’est bloqué.</p>
          <p className="adm-hint">
            Le bouton « Blacklister » se trouve sur la fiche, et ici sous chaque candidature.
          </p>
        </div>
      ) : (
        <div className="adm-list">
          {bloques.map((bloque) => (
            <article key={bloque.id} className="adm-row adm-row-corbeille">
              <div className="adm-avatar adm-avatar-empty" aria-hidden="true">
                {(bloque.first_name ?? '?').slice(0, 1).toUpperCase()}
              </div>

              <div className="adm-row-main">
                <p className="adm-row-name">
                  {[bloque.first_name, bloque.last_name].filter(Boolean).join(' ') || 'Sans nom'}
                </p>
                <p className="adm-row-meta">
                  {[bloque.email, bloque.phone].filter(Boolean).join(' · ')}
                  {` · bloqué ${relative(bloque.created_at)}`}
                </p>
                {bloque.raison && <p className="adm-row-meta">« {bloque.raison} »</p>}
              </div>

              <Debloquer blocageId={bloque.id} nom={bloque.first_name ?? ''} />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
