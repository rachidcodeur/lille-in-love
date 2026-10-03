import {
  estOuverte,
  manches,
  matchsDe,
  monLike,
  profilsPour,
  soireeActive,
} from '@/lib/crush';
import { participantConnecte } from '@/lib/crush-session';
import { CrushEntree } from '@/components/crush/CrushEntree';
import { CrushProfils } from '@/components/crush/CrushProfils';
import { CrushMatchs } from '@/components/crush/CrushMatchs';
import { CrushAttente } from '@/components/crush/CrushAttente';

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

  const [rounds, matchs] = await Promise.all([manches(moi.soiree_id), matchsDe(moi)]);
  const manche = rounds.find(estOuverte) ?? null;
  const [profils, dejaLike] = await Promise.all([
    manche ? profilsPour(moi) : Promise.resolve([]),
    manche ? monLike(moi, manche.id) : Promise.resolve(null),
  ]);

  return (
    <main className="cr-main">
      <header className="cr-entete">
        <div>
          <p className="cr-marque">Lille in Love</p>
          <p className="cr-moi">{moi.first_name}</p>
        </div>
        <CrushMatchs matchs={matchs} />
      </header>

      {manche ? (
        <CrushProfils
          numero={manche.numero}
          profils={profils}
          dejaLike={dejaLike}
          matchs={matchs}
        />
      ) : (
        <CrushAttente
          manches={rounds.map((m) => ({
            numero: m.numero,
            prevu_a: m.prevu_a,
            passee: Boolean(m.ferme_at),
          }))}
        />
      )}
    </main>
  );
}
