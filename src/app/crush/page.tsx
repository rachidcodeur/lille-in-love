import {
  estOuverte,
  finPrevue,
  manches,
  matchsDe,
  matchsNonVus,
  monLike,
  monProfil,
  questionnaireDe,
  questionnaireOuvert,
  profilsPour,
  soireeActive,
} from '@/lib/crush';
import { participantConnecte } from '@/lib/crush-session';
import { CrushEntree } from '@/components/crush/CrushEntree';
import { CrushProfils } from '@/components/crush/CrushProfils';
import { CrushMatchs } from '@/components/crush/CrushMatchs';
import { CrushFete } from '@/components/crush/CrushFete';
import { CrushAttente } from '@/components/crush/CrushAttente';
import { CrushQuestionnaire } from '@/components/crush/CrushQuestionnaire';
import { Veille } from '@/components/crush/Veille';
import { Installation } from '@/components/crush/Installation';
import { Notifications } from '@/components/crush/Notifications';
import { Sortir } from '@/components/crush/Sortir';

export const dynamic = 'force-dynamic';

/**
 * Le manifeste, par les métadonnées plutôt que par une balise posée dans la
 * page : Next la déplacerait vers l'en-tête côté client et signalerait une
 * différence avec ce que le serveur a rendu.
 *
 * Il porte le jeton, et c'est le détail qui décide de tout : sur iPhone,
 * l'application installée a un stockage séparé de Safari, et l'icône
 * ouvrirait une demande d'email si son adresse de départ ne disait pas qui
 * l'on est.
 */
export async function generateMetadata() {
  const moi = await participantConnecte();
  return moi ? { manifest: `/crush/manifeste?t=${moi.jeton}` } : {};
}

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

  // « aFeter » : les matchs dont l'annonce ne m'a pas encore été faite.
  // Celui qui a liké le dernier les a vus tout de suite ; l'autre avait le
  // téléphone en poche, et c'est à l'ouverture qu'on les lui montre.
  const [rounds, matchs, aFeter, moiEnProfil] = await Promise.all([
    manches(moi.soiree_id),
    matchsDe(moi),
    matchsNonVus(moi),
    monProfil(moi),
  ]);
  const manche = rounds.find(estOuverte) ?? null;
  // Celui d'après : savoir qu'il reste un tour, et à quelle heure, change
  // la façon dont on dépense son unique like.
  const suivante = manche
    ? (rounds.find((m) => m.numero > manche.numero && !m.ferme_at) ?? null)
    : null;
  // Les trois manches passées, il n'y a plus rien à liker : la place
  // revient au questionnaire de fin de soirée, tant que les téléphones
  // sont encore en main.
  const bilanOuvert = questionnaireOuvert(rounds);
  const monBilan = bilanOuvert ? await questionnaireDe(moi) : null;

  const [profils, dejaLike] = await Promise.all([
    manche ? profilsPour(moi) : Promise.resolve([]),
    manche ? monLike(moi, manche.id) : Promise.resolve(null),
  ]);

  return (
    <main className="cr-main">
      {/* L'écran se remet à jour tout seul quand l'autre rend son like, ou
          quand un crush time s'ouvre. */}
      <Veille matchs={matchs.length} manche={manche?.id ?? null} />

      {/* Le moment de la soirée. Il passe devant tout le reste, y compris
          devant un profil resté ouvert. */}
      <CrushFete
        moi={{ prenom: moi.first_name, photo: moiEnProfil?.photo ?? null }}
        attendus={aFeter}
        matchs={matchs}
      />

      <Installation jeton={moi.jeton} prenom={moi.first_name} />

      {/* Une fois l'application installée : la permission, qui n'existe
          pas ailleurs sur iPhone. */}
      {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
        <Notifications clePublique={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
      )}

      <header className="cr-entete">
        <div>
          <p className="cr-marque">Lille in Love</p>
          <p className="cr-moi">{moi.first_name}</p>
        </div>
        <CrushMatchs matchs={matchs} enManche={Boolean(manche)} />
      </header>

      {bilanOuvert ? (
        <CrushQuestionnaire
          reponsesInitiales={monBilan?.reponses ?? {}}
          dejaEnvoye={monBilan?.envoye ?? false}
        />
      ) : manche ? (
        <CrushProfils
          numero={manche.numero}
          mancheId={manche.id}
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

      <Sortir prenom={moi.first_name} />
    </main>
  );
}
