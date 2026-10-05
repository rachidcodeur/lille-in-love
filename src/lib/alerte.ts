/**
 * Faire remarquer quelque chose, quand l'application est déjà ouverte.
 *
 * Ce qu'on peut vraiment faire, et ce qu'on ne peut pas :
 *
 *  · Une notification poussée joue le son système du téléphone, sur iPhone
 *    comme sur Android. On ne choisit pas lequel — aucun navigateur
 *    n'implémente le son personnalisé des notifications web.
 *  · La vibration d'une notification marche sur Android. iOS l'ignore :
 *    Safari n'a jamais implémenté l'API Vibration, ni dans la page, ni
 *    dans une notification.
 *  · En revanche, quand l'application est ouverte sous les yeux, aucune
 *    notification ne s'affiche — et c'est là qu'il faut faire du bruit
 *    nous-mêmes. Le son, lui, marche partout.
 *
 * D'où ce fichier : il ne sert qu'au cas « application ouverte », qui est
 * justement celui que le système ne couvre pas.
 */

let contexte: AudioContext | null = null;

/**
 * Déverrouiller le son au premier geste.
 *
 * Les navigateurs refusent de jouer quoi que ce soit avant qu'on ait
 * touché l'écran — sinon une page pourrait sonner toute seule. On prépare
 * donc le terrain dès le premier contact, longtemps avant d'en avoir
 * besoin.
 */
export function preparerLeSon(): () => void {
  const ouvrir = () => {
    try {
      const Fabrique =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Fabrique) return;
      contexte ??= new Fabrique();
      if (contexte.state === 'suspended') void contexte.resume();
    } catch {
      /* pas de son : ce n'est pas grave, l'écran dit la même chose */
    }
  };

  document.addEventListener('pointerdown', ouvrir, { once: true });
  return () => document.removeEventListener('pointerdown', ouvrir);
}

/** Deux notes brèves, montantes ou descendantes selon la nouvelle. */
function jouer(notes: [number, number], duree: number) {
  if (!contexte || contexte.state !== 'running') return;

  notes.forEach((frequence, index) => {
    const oscillateur = contexte!.createOscillator();
    const volume = contexte!.createGain();
    const debut = contexte!.currentTime + index * duree;

    oscillateur.type = 'sine';
    oscillateur.frequency.value = frequence;

    // Une attaque douce et une extinction progressive : un son carré
    // claque et s'entend comme une erreur.
    volume.gain.setValueAtTime(0, debut);
    volume.gain.linearRampToValueAtTime(0.22, debut + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.001, debut + duree);

    oscillateur.connect(volume).connect(contexte!.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree);
  });
}

function vibrer(motif: number[]) {
  // Absente sur iPhone : Safari n'a jamais implémenté l'API.
  if (typeof navigator.vibrate === 'function') navigator.vibrate(motif);
}

/** Un crush time vient de s'ouvrir : deux notes qui montent. */
export function alerterOuverture() {
  jouer([660, 880], 0.16);
  vibrer([80, 60, 80]);
}

/** Un match : trois notes, et plus long — ça se fête. */
export function alerterMatch() {
  jouer([660, 990], 0.2);
  setTimeout(() => jouer([1320, 1320], 0.22), 400);
  vibrer([110, 70, 110, 70, 180]);
}
