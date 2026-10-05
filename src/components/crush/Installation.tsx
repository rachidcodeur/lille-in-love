'use client';

import { useEffect, useState } from 'react';
import { regarder, type Terrain } from '@/lib/navigateur';

type Props = {
  /** Le jeton de la personne : il voyage dans le manifeste. */
  jeton: string;
  prenom: string;
};

/**
 * Faire poser l'application sur l'écran d'accueil.
 *
 * C'est le seul moyen de notifier quelqu'un sur iPhone : Apple réserve le
 * push aux applications installées. L'écran ne se contourne donc pas quand
 * un chemin d'installation existe — sans icône, la personne ne saura pas
 * qu'un crush time s'est ouvert, et toute la soirée repose là-dessus.
 *
 * Une seule exception, et elle est nécessaire : quand aucun chemin n'existe
 * — un ordinateur, un navigateur qui ne sait pas installer — refuser le
 * passage enfermerait quelqu'un dehors sans lui donner le moyen d'entrer.
 * On ne bloque que là où l'on peut proposer quelque chose.
 */
export function Installation({ jeton, prenom }: Props) {
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const [invite, setInvite] = useState<Event | null>(null);
  const [copie, setCopie] = useState(false);
  const [passee, setPassee] = useState(false);

  useEffect(() => {
    setTerrain(regarder());

    // Android et les navigateurs de bureau proposent un vrai bouton : on
    // garde l'invitation sous le coude au lieu de la laisser filer.
    const retenir = (e: Event) => {
      e.preventDefault();
      setInvite(e);
    };
    window.addEventListener('beforeinstallprompt', retenir);
    return () => window.removeEventListener('beforeinstallprompt', retenir);
  }, []);

  // Rien tant qu'on ne sait pas où l'on est : afficher puis se rétracter
  // ferait clignoter l'écran d'accueil de la soirée.
  if (!terrain || terrain.installee || passee) return null;

  // Y a-t-il un chemin à proposer ? Sur iPhone et sur Android, oui. Sur un
  // ordinateur ou un navigateur sans invitation d'installation, non — et
  // c'est le seul cas où l'on ouvre la porte.
  const chemin = terrain.integre || terrain.ios || Boolean(invite);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/crush/c/${jeton}`);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      /* le texte reste affiché juste au-dessus */
    }
  };

  return (
    <div className="cr-install">
      <p className="cr-marque">Lille in Love</p>
      <h1 className="cr-titre">Crush&nbsp;Time</h1>
      <p className="cr-texte">
        {prenom}, pose l’application sur ton écran d’accueil. C’est le seul moyen qu’on ait de te
        prévenir à l’ouverture d’un crush time et quand tu as un match.
      </p>

      {terrain.integre ? (
        /* Le cas qu'on rate le plus souvent : le lien arrive par mail, on
           l'ouvre depuis Gmail, et « Ajouter à l'écran d'accueil » n'existe
           pas dans ce navigateur-là. */
        <div className="cr-etapes">
          <h2 className="cr-etapes-titre">Ouvre ce lien dans {terrain.ios ? 'Safari' : 'ton navigateur'}</h2>
          <p className="cr-texte">
            Tu es dans le navigateur de {terrain.enferme ?? 'une autre application'}, qui ne sait
            pas poser d’icône.
            {terrain.ios && ' Touche les « … » en bas à droite, puis « Ouvrir dans Safari ».'}
          </p>
          <button type="button" className="cr-bouton" onClick={copier}>
            {copie ? '✓ Lien copié' : 'Copier mon lien'}
          </button>
          <p className="cr-aide">Puis colle-le dans {terrain.ios ? 'Safari' : 'Chrome'}.</p>
        </div>
      ) : invite ? (
        /* Android : un vrai bouton, et le système fait le reste. */
        <div className="cr-etapes">
          <button
            type="button"
            className="cr-bouton cr-coeur"
            onClick={async () => {
              const demande = invite as Event & { prompt: () => Promise<void> };
              await demande.prompt();
              setInvite(null);
            }}
          >
            Installer l’application
          </button>
        </div>
      ) : terrain.ios ? (
        <ol className="cr-etapes">
          <li>
            Touche <strong>Partager</strong>
            <span className="cr-pictogramme" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M8 8l4-4 4 4" />
                <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
              </svg>
            </span>
            en bas de l’écran
          </li>
          <li>
            Fais défiler, puis <strong>Sur l’écran d’accueil</strong>
          </li>
          <li>
            Touche <strong>Ajouter</strong>, puis ouvre l’icône
          </li>
        </ol>
      ) : (
        <ol className="cr-etapes">
          <li>
            Ouvre le menu <strong>⋮</strong> de ton navigateur
          </li>
          <li>
            Choisis <strong>Installer l’application</strong>
          </li>
        </ol>
      )}

      {/* Seulement là où l'on n'a rien à proposer : ailleurs, l'icône est
          la condition pour être prévenu, et toute la soirée en dépend. */}
      {!chemin && (
        <button type="button" className="cr-passer" onClick={() => setPassee(true)}>
          Continuer sans installer
        </button>
      )}
    </div>
  );
}
