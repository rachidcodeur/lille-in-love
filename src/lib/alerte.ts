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
/** Ce qu'on n'a pas pu jouer faute de geste, et qu'on jouera au premier. */
let enAttente: (() => void) | null = null;

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
      // Une fanfare arrivée avant le premier geste a été mise de côté :
      // c'est le cas de l'application ouverte depuis l'icône, où le match
      // s'affiche avant qu'on ait touché quoi que ce soit.
      const differee = enAttente;
      enAttente = null;
      if (differee) setTimeout(differee, 60);
    } catch {
      /* pas de son : ce n'est pas grave, l'écran dit la même chose */
    }
  };

  document.addEventListener('pointerdown', ouvrir, { once: true });
  return () => document.removeEventListener('pointerdown', ouvrir);
}

/** Une note, à un moment donné, d'un volume donné. */
function note(frequence: number, retard: number, duree: number, force = 0.22) {
  if (!contexte || contexte.state !== 'running') return;

  const oscillateur = contexte.createOscillator();
  const volume = contexte.createGain();
  const debut = contexte.currentTime + retard;

  oscillateur.type = 'sine';
  oscillateur.frequency.value = frequence;

  // Une attaque douce et une extinction progressive : un son carré claque
  // et s'entend comme une erreur.
  volume.gain.setValueAtTime(0, debut);
  volume.gain.linearRampToValueAtTime(force, debut + 0.015);
  volume.gain.exponentialRampToValueAtTime(0.001, debut + duree);

  oscillateur.connect(volume).connect(contexte.destination);
  oscillateur.start(debut);
  oscillateur.stop(debut + duree);
}

/** Deux notes brèves, montantes ou descendantes selon la nouvelle. */
function jouer(notes: [number, number], duree: number) {
  notes.forEach((frequence, index) => note(frequence, index * duree, duree));
}

/**
 * Jouer, ou retenir pour le premier geste.
 *
 * Un match reçu pendant qu'on n'était pas dans l'application s'affiche dès
 * l'ouverture, avant tout contact avec l'écran — et le navigateur refuse
 * alors tout son. Plutôt que de perdre la fanfare, on la garde : elle
 * partira à la première touche, qui ne tardera pas puisqu'il y a un bouton
 * sous les yeux.
 */
function jouerOuAttendre(fanfare: () => void) {
  if (contexte?.state === 'running') fanfare();
  else enAttente = fanfare;
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

/**
 * Un match : une petite fanfare.
 *
 * Un accord majeur qui monte (fa, la, do, fa), puis la tonique tenue une
 * octave au-dessus avec sa quinte : quatre notes se remarquent dans une
 * salle bruyante là où deux passent pour un accusé de réception. Tout est
 * programmé d'un coup sur l'horloge audio, et non au minuteur : à cette
 * échelle, setTimeout dérive assez pour que l'arpège sonne de travers.
 */
export function alerterMatch() {
  jouerOuAttendre(() => {
    const arpege = [698.46, 880, 1046.5, 1396.9];
    arpege.forEach((frequence, index) => note(frequence, index * 0.11, 0.3, 0.2));
    // L'accord final, posé sur la dernière note de l'arpège et tenu : c'est
    // lui qui donne l'impression d'un aboutissement et non d'une suite.
    note(1396.9, 0.44, 0.9, 0.17);
    note(2093, 0.46, 0.8, 0.09);
  });
  vibrer([110, 70, 110, 70, 240]);
}
