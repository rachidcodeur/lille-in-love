'use client';

import { useState } from 'react';
import { BRAND } from '@/lib/brand';

/**
 * L'adresse publique du formulaire, celle qu'on donne de la main à la
 * main. Sans la barre oblique finale : c'est ainsi qu'on la dicte.
 */
const LIEN = BRAND.inscriptionUrl.replace(/\/$/, '');

/**
 * De quoi passer le formulaire à quelqu'un.
 *
 * Il vivait au milieu des questions, pour qui venait accompagné. Il est
 * remonté sur l'écran de fin : on pense à quelqu'un une fois qu'on a
 * soi-même terminé, pas pendant qu'on remplit — et ça vaut aussi pour
 * qui vient seul.
 *
 * Le partage natif quand le téléphone le propose, la copie sinon, et le
 * lien lisible dans les deux cas : on ne remplace pas ce qu'on peut lire
 * par un bouton qui promet de faire quelque chose.
 */
export function PartagerInscription() {
  const [copie, setCopie] = useState(false);

  const partager = async () => {
    const texte = `Inscris-toi à la soirée Lille in Love : ${LIEN}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Lille in Love', text: texte, url: LIEN });
        return;
      } catch {
        /* partage refusé ou annulé : on retombe sur la copie */
      }
    }
    try {
      await navigator.clipboard.writeText(LIEN);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
    } catch {
      /* presse-papier refusé : le lien reste lisible juste au-dessus */
    }
  };

  return (
    <div className="lil-partage">
      <p className="lil-partage-titre">Partage le formulaire à ton ami</p>
      <p className="lil-field-help">
        Chacun remplit le sien — c’est comme ça qu’on peut vous placer sur la même soirée.
      </p>
      <p className="lil-partage-lien">{LIEN}</p>
      <button type="button" className="lil-btn-secondaire" onClick={partager}>
        {copie ? '✓ Lien copié' : 'Partager le lien'}
      </button>
    </div>
  );
}
