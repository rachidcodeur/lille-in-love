'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { alerterMatch, alerterOuverture, preparerLeSon } from '@/lib/alerte';

/**
 * Regarder, de loin en loin, si quelque chose a changé.
 *
 * Et le faire remarquer : quand l'application est ouverte sous les yeux,
 * le système n'affiche aucune notification, et un écran qui se redessine
 * en silence ne se remarque pas dans une salle bruyante.
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
    // Le son doit être déverrouillé par un geste, et le geste arrive
    // toujours avant la nouvelle : on prépare dès l'arrivée sur la page.
    const ranger = preparerLeSon();

    const regarder = async () => {
      if (!vivant || document.visibilityState !== 'visible') return;
      try {
        const r = await fetch('/api/crush/etat', { cache: 'no-store' });
        if (!r.ok) return;
        const etat = (await r.json()) as { matchs: number; manche: string | null };
        if (etat.matchs === matchs && etat.manche === manche) return;

        // Application ouverte sous les yeux : le système n'affiche aucune
        // notification, c'est donc à nous de faire remarquer la nouvelle.
        if (etat.matchs > matchs) alerterMatch();
        else if (etat.manche && etat.manche !== manche) alerterOuverture();

        router.refresh();
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
      ranger();
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', regarder);
    };
  }, [matchs, manche, router]);

  return null;
}
