'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Regarder, de loin en loin, si quelque chose a changé.
 *
 * Deux choses doivent faire bouger l'écran sans qu'on y touche : un match
 * que l'autre vient de faire, et un crush time qui s'ouvre. Personne ne
 * recharge une page au milieu d'une soirée.
 *
 * On ne redessine que si l'un des deux a bougé : la demande est minuscule,
 * le redessin ne l'est pas. Et on se tait quand l'application n'est pas à
 * l'écran — un téléphone en poche n'a rien à rafraîchir.
 */
export function Veille({ matchs, manche }: { matchs: number; manche: string | null }) {
  const router = useRouter();

  useEffect(() => {
    let vivant = true;

    const regarder = async () => {
      if (!vivant || document.visibilityState !== 'visible') return;
      try {
        const r = await fetch('/api/crush/etat', { cache: 'no-store' });
        if (!r.ok) return;
        const etat = (await r.json()) as { matchs: number; manche: string | null };
        if (etat.matchs !== matchs || etat.manche !== manche) router.refresh();
      } catch {
        /* réseau de salle : on retentera dans huit secondes */
      }
    };

    const minuterie = setInterval(regarder, 8000);
    // Revenir sur l'application après l'avoir quittée doit la remettre à
    // jour tout de suite, pas huit secondes plus tard.
    document.addEventListener('visibilitychange', regarder);

    return () => {
      vivant = false;
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', regarder);
    };
  }, [matchs, manche, router]);

  return null;
}
