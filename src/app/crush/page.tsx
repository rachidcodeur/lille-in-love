import {
  estOuverte,
  finPrevue,
  manches,
  matchsDe,
  mesLikes,
  monLike,
  profilsPour,
  soireeActive,
} from '@/lib/crush';
import { participantConnecte } from '@/lib/crush-session';
import { CrushEntree } from '@/components/crush/CrushEntree';
import { CrushProfils } from '@/components/crush/CrushProfils';
import { CrushMatchs } from '@/components/crush/CrushMatchs';
import { CrushAttente } from '@/components/crush/CrushAttente';
import { Veille } from '@/components/crush/Veille';
import { Installation } from '@/components/crush/Installation';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Le crush time, côté participant.
 *
 * Une seule page, trois états : on n'est pas entré, le crush time n'est pas
 * ouvert, il l'est. Quelqu'un debout dans une salle bruyante ne navigue pas
 * dans une arborescence — il regarde ce qu'il y a, et il y a une chose à la
 * fois.
 */
export default async function CrushPage({ searchParams }: Props) {
  const params = await searchParams;
  const moi = await participantConnecte();

  if (!moi) {
    const soiree = await soireeActive().catch(() => null);
    return (
      <CrushEntree
        soiree={soiree?.nom ?? null}
        ouverte={Boolean(soiree)}
        lienInvalide={params.erreur === 'lien'}
      />
    );
  }

  const [rounds, matchs, likes] = await Promise.all([
    manches(moi.soiree_id),
    matchsDe(moi),
    mesLikes(moi),
  ]);
  const manche = rounds.find(estOuverte) ?? null;
  // Celui d'après : savoir qu'il reste un tour, et à quelle heure, change
  // la façon dont on dépense son unique like.
  const suivante = manche
    ? (rounds.find((m) => m.numero > manche.numero && !m.ferme_at) ?? null)
    : null;
  const [profils, dejaLike] = await Promise.all([
    manche ? profilsPour(moi) : Promise.resolve([]),
    manche ? monLike(moi, manche.id) : Promise.resolve(null),
  ]);

  return (
    <main className="cr-main">
      {/* Le manifeste porte le jeton : l'icône posée sur l'écran d'accueil
          ouvre une session valide, et non une demande d'email. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="manifest" href={`/crush/manifeste?t=${moi.jeton}`} />

      {/* L'écran se remet à jour tout seul quand l'autre rend son like, ou
          quand un crush time s'ouvre. */}
      <Veille matchs={matchs.length} manche={manche?.id ?? null} />

      <Installation jeton={moi.jeton} prenom={moi.first_name} />

      <header className="cr-entete">
        <div>
          <p className="cr-marque">Lille in Love</p>
          <p className="cr-moi">{moi.first_name}</p>
        </div>
        <CrushMatchs matchs={matchs} likes={likes} />
      </header>

      {manche ? (
        <CrushProfils
          numero={manche.numero}
          profils={profils}
          dejaLike={dejaLike}
          matchs={matchs}
          prochaine={suivante?.prevu_a ?? null}
          fin={finPrevue(manche)?.toISOString() ?? null}
        />
      ) : (
        <CrushAttente
          manches={rounds.map((m) => ({
            numero: m.numero,
            prevu_a: m.prevu_a,
            // Une manche dont le temps est écoulé est passée, même si
            // personne ne l'a refermée.
            passee: Boolean(m.ferme_at) || (Boolean(m.ouvert_at) && !estOuverte(m)),
          }))}
        />
      )}
    </main>
  );
}
