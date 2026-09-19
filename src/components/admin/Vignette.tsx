'use client';

import { useEffect, useRef, useState } from 'react';
import { reparerHeic } from '@/lib/heic';

type Props = {
  src: string;
  className?: string;
  alt?: string;
  /** Affichée si la photo reste illisible : mieux qu'un carré vide. */
  initiale: string;
};

/**
 * Une photo de candidature, y compris au format iPhone.
 *
 * Les candidatures déposées avant la conversion à l'envoi portent parfois un
 * HEIC, que seul Safari sait afficher. Plutôt que de laisser un carré blanc
 * au curateur, on décode le fichier ici, dans son navigateur, au moment où
 * l'image échoue à se charger. Une photo ordinaire ne paie rien : le
 * décodeur n'est cherché qu'en cas d'échec.
 */
export function Vignette({ src, className, alt = '', initiale }: Props) {
  const [url, setUrl] = useState(src);
  const [perdue, setPerdue] = useState(false);
  const essaye = useRef(false);
  const image = useRef<HTMLImageElement>(null);

  async function auSecours() {
    if (essaye.current) {
      setPerdue(true);
      return;
    }
    essaye.current = true;

    const jpeg = await reparerHeic(src);
    if (jpeg) setUrl(jpeg);
    else setPerdue(true);
  }

  // La page arrive toute faite du serveur : l'image a le temps d'échouer
  // avant que React n'écoute quoi que ce soit, et son « error » se perd.
  // On regarde donc son état à l'hydratation, sans attendre l'événement.
  useEffect(() => {
    const img = image.current;
    if (img && img.complete && img.naturalWidth === 0) void auSecours();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (perdue) {
    return (
      <div className={`${className ?? ''} adm-avatar-empty`.trim()} aria-hidden="true">
        {initiale}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} className={className} src={url} alt={alt} onError={auSecours} />;
}
