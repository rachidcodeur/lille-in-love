/**
 * Reconnaître le navigateur, et seulement ce qui change quelque chose.
 *
 * Trois questions, trois réponses, et rien de plus : peut-on installer
 * depuis ici, comment, et est-on déjà installé. Le reste de la détection
 * d'agent utilisateur est un marécage dont on n'a pas besoin.
 */

export type Terrain = {
  /** L'application est ouverte depuis l'écran d'accueil. */
  installee: boolean;
  ios: boolean;
  /** Un navigateur intégré à une autre application : Gmail, Instagram… */
  integre: boolean;
  /** Le nom de l'application qui enferme, quand on le reconnaît. */
  enferme: string | null;
};

export function regarder(): Terrain {
  if (typeof window === 'undefined') {
    return { installee: false, ios: false, integre: false, enferme: null };
  }

  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const installee =
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari sur iOS n'a jamais adopté display-mode : il a son propre
    // indicateur, et c'est le seul moyen de le savoir là-bas.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  // Les navigateurs intégrés se reconnaissent à leur signature. On ne
  // cherche que ceux par lesquels un lien d'invitation arrive vraiment.
  const enfermeurs: [RegExp, string][] = [
    [/FBAN|FBAV|FB_IAB/, 'Facebook'],
    [/Instagram/, 'Instagram'],
    [/\bGSA\b/, 'Google'],
    [/LinkedInApp/, 'LinkedIn'],
    [/Snapchat/, 'Snapchat'],
    [/Twitter/, 'X'],
    [/\bLine\//, 'LINE'],
  ];
  const trouve = enfermeurs.find(([motif]) => motif.test(ua));

  // Sur iOS, tout navigateur est Safari dessous. Celui de Gmail se
  // reconnaît à l'absence de la barre d'outils… qu'on ne peut pas tester.
  // On s'en tient donc aux signatures, et à une précaution : Chrome et
  // Firefox sur iOS ne savent pas non plus poser une icône.
  const autreQueSafari = ios && /CriOS|FxiOS|EdgiOS/.test(ua);

  return {
    installee,
    ios,
    integre: Boolean(trouve) || autreQueSafari,
    enferme: trouve?.[1] ?? (autreQueSafari ? 'ce navigateur' : null),
  };
}
