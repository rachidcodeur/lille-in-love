/**
 * Les règles du crush time, sans rien autour.
 *
 * Aucune base, aucun réseau : ce fichier ne dépend de rien, et c'est voulu.
 * Ce sont les règles du jeu — qui voit qui, quel âge affiche-t-on — et elles
 * doivent pouvoir être éprouvées seules, en une seconde, sans monter un
 * serveur. Tout ce qui touche à Supabase vit dans crush.ts.
 */

export type Genre = 'femme' | 'homme';
export type Orientation = 'hetero' | 'gay';

/** Le minimum pour savoir si deux personnes ont quelque chose à faire ensemble. */
export type Gouts = {
  id: string;
  gender: Genre | null;
  orientation: Orientation | null;
};

/** Cette personne pourrait-elle s'intéresser à celle-là ? */
function interesse(qui: Gouts, par: Gouts): boolean {
  if (!qui.gender || !qui.orientation || !par.gender) return false;
  return qui.orientation === 'gay' ? par.gender === qui.gender : par.gender !== qui.gender;
}

/**
 * Qui voit qui.
 *
 * L'intérêt doit aller dans les deux sens, sinon on fait perdre son temps à
 * tout le monde : un homme gay n'a rien à faire dans la liste d'une femme
 * hétéro, et réciproquement. Dire « le sexe opposé » aurait effacé le
 * groupe G ; cette règle-ci le prend naturellement en compte.
 *
 * Une personne dont on ignore le genre ne voit personne et n'est vue de
 * personne : mieux vaut qu'elle manque à l'appel — l'hôte le verra dans son
 * tableau de bord — que d'être proposée à côté de la plaque.
 */
export function peutVoir(a: Gouts, b: Gouts): boolean {
  if (a.id === b.id) return false;
  return interesse(a, b) && interesse(b, a);
}

/** L'âge affiché sur un profil. */
export function age(naissance: string | null, maintenant = Date.now()): number | null {
  if (!naissance) return null;
  const date = new Date(naissance);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((maintenant - date.getTime()) / 86_400_000 / 365.25);
}

/**
 * « 1er », « 2e », « 3e ».
 *
 * « Crush time 1 » se lit comme une référence de dossier ; « 1er crush
 * time » se dit à voix haute dans une salle, et c'est là que le mot sert.
 */
export function rang(numero: number): string {
  return numero === 1 ? '1er' : `${numero}e`;
}

/** « 2e crush time » — le titre d'une manche, partout pareil. */
export function nomManche(numero: number): string {
  return `${rang(numero)} crush time`;
}

/**
 * Le lien WhatsApp d'un numéro, ou rien si on n'en est pas sûr.
 *
 * WhatsApp n'accepte qu'un numéro au format international, sans « + » ni
 * espace : wa.me/33612345678. Les numéros arrivent, eux, comme les gens les
 * écrivent — « 06 12 34 56 78 », « +33 6 12 34 56 78 », « 0033612... ».
 *
 * On traduit les trois formes, et on s'arrête là. Deviner l'indicatif d'un
 * numéro qu'on ne reconnaît pas mènerait à un lien qui ouvre WhatsApp sur
 * une conversation avec un inconnu — pire que pas de bouton du tout, parce
 * qu'on ne s'en rendrait compte qu'après avoir écrit. Le numéro reste
 * affiché à côté : il se copie.
 */
export function lienWhatsApp(telephone: string | null | undefined): string | null {
  const brut = (telephone ?? '').trim();
  if (!brut) return null;

  // Tout ce qui n'est pas un chiffre est de la mise en forme — espaces,
  // points, tirets, parenthèses — sauf le « + » de tête, qui porte un sens.
  const international = brut.startsWith('+');
  const chiffres = brut.replace(/\D/g, '');
  if (!chiffres) return null;

  if (international) return chiffres.length >= 8 ? `https://wa.me/${chiffres}` : null;
  // « 00 » est le « + » composé à l'ancienne.
  if (chiffres.startsWith('00')) {
    const sans = chiffres.slice(2);
    return sans.length >= 8 ? `https://wa.me/${sans}` : null;
  }
  // Un numéro français tel qu'on le note : dix chiffres, un zéro devant.
  if (chiffres.length === 10 && chiffres.startsWith('0')) {
    return `https://wa.me/33${chiffres.slice(1)}`;
  }
  // Déjà en international sans le signe.
  if (chiffres.length >= 11) return `https://wa.me/${chiffres}`;

  return null;
}
