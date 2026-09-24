'use client';

import { useEffect } from 'react';

/**
 * Annonce la hauteur de la page à la fenêtre parente.
 *
 * Le formulaire le fait déjà pour lui-même ; cette version sert aux pages
 * qui n'ont pas sa mécanique — la page de remerciement, notamment. Sans
 * elle, l'iframe garderait la hauteur du formulaire et couperait le
 * message.
 */
export function HauteurIframe() {
  useEffect(() => {
    if (window.parent === window) return;

    const publier = () => {
      const hauteur = Math.ceil(document.documentElement.getBoundingClientRect().height);
      window.parent.postMessage({ type: 'lil:height', height: hauteur }, '*');
    };

    publier();
    const observateur = new ResizeObserver(publier);
    observateur.observe(document.documentElement);

    // Les polices arrivent après le premier rendu et changent la hauteur.
    document.fonts?.ready.then(publier).catch(() => {});

    return () => observateur.disconnect();
  }, []);

  return null;
}
