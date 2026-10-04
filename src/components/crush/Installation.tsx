'use client';

import { useEffect, useState } from 'react';
import { regarder, type Terrain } from '@/lib/navigateur';

type Props = {
  /** Le jeton de la personne : il voyage dans le manifeste. */
  jeton: string;
  prenom: string;
};

const DEJA_VU = 'lil-install-passee';

/**
 * Faire poser l'application sur l'écran d'accueil.
 *
 * C'est le seul moyen de notifier quelqu'un sur iPhone : Apple réserve le
 * push aux applications installées. Et c'est aussi le moment le plus
 * fragile de la soirée — cinq gestes à faire debout, dans une salle sombre,
 * par quelqu'un qui n'est pas venu pour installer un logiciel.
 *
 * D'où l'ordre : on dit pourquoi en une phrase, on montre le geste exact du
 * téléphone qu'on a dans la main, et on laisse toujours passer outre. Une
 * personne bloquée à l'installation est une personne perdue pour la soirée.
 */
export function Installation({ jeton, prenom }: Props) {
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const [passee, setPassee] = useState(true);
  const [invite, setInvite] = useState<Event | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    setTerrain(regarder());
    try {
      setPassee(localStorage.getItem(DEJA_VU) === 'oui');
    } catch {
      // Navigation privée, stockage refusé : on remontre l'écran, ce qui
      // est moins grave que de ne jamais le montrer.
      setPassee(false);
    }

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

  const plusTard = () => {
    try {
      localStorage.setItem(DEJA_VU, 'oui');
    } catch {
      /* tant pis */
    }
    setPassee(true);
  };

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

      {/* Toujours une sortie : quelqu'un bloqué ici est quelqu'un de perdu
          pour la soirée, et le jeu marche sans notification. */}
      <button type="button" className="cr-passer" onClick={plusTard}>
        Continuer sans installer
      </button>
    </div>
  );
}
