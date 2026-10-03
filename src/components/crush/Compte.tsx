'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Un compte à rebours.
 *
 * Quinze minutes, c'est court : il faut le voir fondre pour s'y mettre.
 * Quand il arrive à zéro, la page se recharge d'elle-même — un crush time
 * qui se ferme sans que l'écran bouge laisserait quelqu'un toucher un cœur
 * pour rien.
 *
 * Le compte ne démarre qu'après l'hydratation : calculé sur le serveur, il
 * afficherait une seconde déjà périmée et React signalerait la différence.
 */
export function Compte({
  jusqua,
  onFini,
}: {
  /** L'instant visé, au format ISO. */
  jusqua: string;
  /** Ce qu'on fait en arrivant à zéro. Par défaut, on recharge. */
  onFini?: () => void;
}) {
  const router = useRouter();
  const [reste, setReste] = useState<number | null>(null);

  useEffect(() => {
    const cible = new Date(jusqua).getTime();

    const battre = () => {
      const restant = cible - Date.now();
      setReste(restant);
      if (restant <= 0) {
        if (onFini) onFini();
        else router.refresh();
      }
    };

    battre();
    const minuterie = setInterval(battre, 1000);
    return () => clearInterval(minuterie);
  }, [jusqua, onFini, router]);

  if (reste === null) return <span className="cr-compte" aria-hidden="true">—</span>;

  const secondes = Math.max(0, Math.floor(reste / 1000));
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const sec = secondes % 60;

  const texte = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;

  return (
    <span
      className="cr-compte"
      data-urgent={h === 0 && m < 2 ? 'true' : undefined}
      // La lecture d'un compte qui change chaque seconde est intenable pour
      // un lecteur d'écran : il annonce le texte complet, poliment.
      aria-live="off"
      aria-label={h > 0 ? `${h} heures ${m} minutes` : `${m} minutes ${sec} secondes`}
    >
      {texte}
    </span>
  );
}
