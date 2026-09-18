'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  photos: string[];
  firstName: string;
};

/**
 * Les photos d'une candidature, et leur visionneuse plein écran.
 *
 * Juger un profil demande de regarder un visage de près : un clic ouvre la
 * photo en grand, un second l'agrandit encore et la fait suivre le curseur.
 * Les flèches passent d'une photo à l'autre, Échap referme.
 */
export function PhotoGallery({ photos, firstName }: Props) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [origine, setOrigine] = useState({ x: 50, y: 50 });

  const fermerRef = useRef<HTMLButtonElement>(null);
  // Pour rendre le focus à la vignette d'où l'on vient.
  const declencheur = useRef<HTMLElement | null>(null);

  const ouvrir = (index: number, element: HTMLElement) => {
    declencheur.current = element;
    setZoom(false);
    setOuverte(index);
  };

  const fermer = useCallback(() => {
    setOuverte(null);
    setZoom(false);
    declencheur.current?.focus();
  }, []);

  const deplacer = useCallback(
    (pas: number) => {
      setZoom(false);
      setOuverte((actuelle) => {
        if (actuelle === null) return null;
        return (actuelle + pas + photos.length) % photos.length;
      });
    },
    [photos.length],
  );

  /* --- Clavier et défilement de la page ---------------------------- */
  useEffect(() => {
    if (ouverte === null) return;

    const auClavier = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        fermer();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        deplacer(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        deplacer(-1);
      }
    };

    document.addEventListener('keydown', auClavier);

    // La page derrière ne doit pas défiler pendant qu'on regarde une photo.
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    fermerRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', auClavier);
      document.body.style.overflow = avant;
    };
  }, [ouverte, fermer, deplacer]);

  if (photos.length === 0) {
    return <div className="adm-nophoto">Aucune photo reçue.</div>;
  }

  const legende = (index: number) =>
    photos.length > 1
      ? `Photo ${index + 1} sur ${photos.length} de ${firstName}`
      : `Photo de ${firstName}`;

  return (
    <>
      <div className="adm-photos">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="adm-photo adm-photo-cliquable"
          src={photos[0]}
          alt={legende(0)}
          tabIndex={0}
          role="button"
          onClick={(e) => ouvrir(0, e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              ouvrir(0, e.currentTarget);
            }
          }}
        />

        {photos.length > 1 && (
          <div className="adm-photo-strip">
            {photos.slice(1).map((url, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                className="adm-photo adm-photo-cliquable"
                src={url}
                alt={legende(index + 1)}
                tabIndex={0}
                role="button"
                onClick={(e) => ouvrir(index + 1, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    ouvrir(index + 1, e.currentTarget);
                  }
                }}
              />
            ))}
          </div>
        )}

        <p className="adm-photo-aide">
          Clique une photo pour l’agrandir
          {photos.length > 1 && ' — les flèches passent de l’une à l’autre'}.
        </p>
      </div>

      {ouverte !== null && (
        <div
          className="adm-visionneuse"
          role="dialog"
          aria-modal="true"
          aria-label={legende(ouverte)}
          onClick={fermer}
        >
          <div className="adm-visionneuse-barre" onClick={(e) => e.stopPropagation()}>
            <span className="adm-visionneuse-compteur">
              {photos.length > 1 ? `${ouverte + 1} / ${photos.length}` : 'Photo'}
              {zoom && ' · agrandie'}
            </span>
            <button
              ref={fermerRef}
              type="button"
              className="adm-visionneuse-fermer"
              onClick={fermer}
              aria-label="Fermer"
            >
              Fermer <kbd>Échap</kbd>
            </button>
          </div>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="adm-visionneuse-fleche"
                data-cote="gauche"
                aria-label="Photo précédente"
                onClick={(e) => {
                  e.stopPropagation();
                  deplacer(-1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="adm-visionneuse-fleche"
                data-cote="droite"
                aria-label="Photo suivante"
                onClick={(e) => {
                  e.stopPropagation();
                  deplacer(1);
                }}
              >
                ›
              </button>
            </>
          )}

          {/* Pas de stopPropagation ici : cliquer à côté de la photo doit
              refermer, comme dans n'importe quelle visionneuse. Seule
              l'image elle-même retient le clic, pour zoomer. */}
          <div
            className="adm-visionneuse-cadre"
            onMouseMove={(e) => {
              if (!zoom) return;
              // L'agrandissement suit le curseur : on examine le détail qu'on
              // vise, sans avoir à faire défiler.
              const zone = e.currentTarget.getBoundingClientRect();
              setOrigine({
                x: ((e.clientX - zone.left) / zone.width) * 100,
                y: ((e.clientY - zone.top) / zone.height) * 100,
              });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="adm-visionneuse-image"
              data-zoom={zoom}
              style={
                zoom ? { transformOrigin: `${origine.x}% ${origine.y}%` } : undefined
              }
              src={photos[ouverte]}
              alt={legende(ouverte)}
              onClick={(e) => {
                e.stopPropagation();
                setZoom((z) => !z);
              }}
            />
          </div>

          <p className="adm-visionneuse-pied" onClick={(e) => e.stopPropagation()}>
            {zoom ? 'Clique à nouveau pour revenir à la taille normale.' : 'Clique la photo pour zoomer.'}
          </p>
        </div>
      )}
    </>
  );
}
