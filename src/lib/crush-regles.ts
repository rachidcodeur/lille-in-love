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

/* ====================================================================
   L'heure de la soirée est l'heure de Lille

   Une soirée se passe dans une salle, à une heure annoncée à voix haute.
   Ni le fuseau du serveur, ni celui du téléphone n'ont voix au chapitre :
   « 21 h 00 » veut dire 21 h 00 à Lille, pour l'hôte qui pose l'horaire
   comme pour la personne qui lit son écran.

   Sans ça, deux choses cassaient. L'hôte saisit « 21:00 » dans un champ
   qui n'emporte aucun fuseau ; le serveur interprétait cette heure dans
   le sien — Paris sur un poste français, UTC sur l'hébergement, soit deux
   heures d'écart une fois en ligne. Et l'affichage suivait le fuseau de
   la machine qui dessinait la page, qui n'est pas le même au premier
   rendu (le serveur) et ensuite (le téléphone).
   ==================================================================== */

const PARIS = 'Europe/Paris';

/** De combien Paris devance UTC à cet instant précis. En millisecondes. */
function decalageDeParis(instant: Date): number {
  const morceaux = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const p: Record<string, string> = {};
  for (const m of morceaux) p[m.type] = m.value;

  const commeSiUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    // « 24 » et non « 00 » à minuit, selon les versions.
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return commeSiUTC - instant.getTime();
}

/**
 * « 2026-10-18T21:00 », saisi par l'hôte, devient l'instant qu'il désigne.
 *
 * C'est ce que rend un champ « datetime-local » : une heure de mur, sans
 * fuseau. On la lit comme une heure de Lille, et on la range en UTC.
 */
export function instantDepuisParis(local: string): string {
  const propre = local.trim();
  if (!propre) return '';
  // On complète les secondes si le champ ne les donne pas, puis on lit la
  // chaîne comme si elle était UTC : c'est le point de départ du calcul.
  const avecSecondes = /\d{2}:\d{2}:\d{2}/.test(propre) ? propre : `${propre}:00`;
  const depart = Date.parse(`${avecSecondes}Z`);
  if (Number.isNaN(depart)) return '';

  // Deux passes : à la nuit du changement d'heure, le décalage trouvé sur
  // l'instant de départ n'est plus celui qui s'applique une fois corrigé.
  let instant = depart - decalageDeParis(new Date(depart));
  instant = depart - decalageDeParis(new Date(instant));
  return new Date(instant).toISOString();
}

/** « 21:00 » — l'heure de Lille, quel que soit l'endroit d'où on regarde. */
export function heureDeParis(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PARIS,
  });
}
