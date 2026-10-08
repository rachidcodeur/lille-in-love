/**
 * Les règles qui n'ont besoin de rien.
 *
 *   npm run test:regles
 *
 * Qui voit qui, et comment on lit un CSV qu'on n'a pas écrit. Ni base, ni
 * navigateur, ni serveur : ces deux-là décident du jeu et de l'import, et
 * doivent pouvoir être éprouvées en une seconde, aussi souvent qu'on veut.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const failures = [];
const ok = (l) => console.log('  \x1b[32m✓\x1b[0m ' + l);
const bad = (l, d) => { failures.push(l); console.log('  \x1b[31m✗\x1b[0m ' + l + (d ? ' — ' + d : '')); };
const section = (l) => console.log('\n\x1b[1m' + l + '\x1b[0m');

// Les règles sont écrites en TypeScript : on les compile à part, dans un
// dossier jetable, plutôt que d'ajouter un lanceur au projet.
const sortie = mkdtempSync(join(tmpdir(), 'lil-regles-'));
execFileSync(
  'npx',
  ['tsc', 'src/lib/crush-regles.ts', 'src/lib/csv.ts', 'src/lib/groupes.ts', 'src/lib/manches.ts',
   '--outDir', sortie, '--target', 'ES2022', '--module', 'esnext',
   '--moduleResolution', 'bundler', '--strict'],
  { stdio: 'inherit' },
);
// Sans ce marqueur, Node lit le JavaScript compilé comme du CommonJS et
// butte sur le premier « export ».
writeFileSync(join(sortie, 'package.json'), '{ "type": "module" }');

const { peutVoir, age, rang, nomManche, lienWhatsApp, instantDepuisParis, heureDeParis } = await import(join(sortie, 'crush-regles.js'));
const { lireCsv, colonne } = await import(join(sortie, 'csv.js'));
const { trouve, presque, sansAccent } = await import(join(sortie, 'groupes.js'));

const gens = {
  femmeHetero: { id: '1', gender: 'femme', orientation: 'hetero' },
  hommeHetero: { id: '2', gender: 'homme', orientation: 'hetero' },
  femmeHetero2: { id: '3', gender: 'femme', orientation: 'hetero' },
  hommeGay: { id: '4', gender: 'homme', orientation: 'gay' },
  hommeGay2: { id: '5', gender: 'homme', orientation: 'gay' },
  femmeGay: { id: '6', gender: 'femme', orientation: 'gay' },
  inconnue: { id: '7', gender: null, orientation: null },
};

/* ---------------------------------------------------------------- */
section('1. Qui voit qui');

peutVoir(gens.femmeHetero, gens.hommeHetero) && peutVoir(gens.hommeHetero, gens.femmeHetero)
  ? ok('une femme hétéro et un homme hétéro se voient')
  : bad('le cas le plus courant ne marche pas');

!peutVoir(gens.femmeHetero, gens.femmeHetero2)
  ? ok('deux femmes hétéro ne se voient pas')
  : bad('deux femmes hétéro se voient');

peutVoir(gens.hommeGay, gens.hommeGay2)
  ? ok('deux hommes gays se voient — c’est le groupe G')
  : bad('les gays ne voient personne : la règle « sexe opposé » est revenue');

!peutVoir(gens.femmeHetero, gens.hommeGay) && !peutVoir(gens.hommeGay, gens.femmeHetero)
  ? ok('une femme hétéro et un homme gay ne se voient pas, dans les deux sens')
  : bad('l’intérêt ne va que dans un sens');

!peutVoir(gens.femmeGay, gens.hommeHetero)
  ? ok('une femme gay et un homme hétéro ne se voient pas')
  : bad('couple impossible proposé');

peutVoir(gens.femmeGay, { id: '8', gender: 'femme', orientation: 'gay' })
  ? ok('deux femmes gays se voient')
  : bad('les femmes gays ne voient personne');

!peutVoir(gens.inconnue, gens.hommeHetero) && !peutVoir(gens.hommeHetero, gens.inconnue)
  ? ok('une personne au profil incomplet ne voit personne et n’est vue de personne')
  : bad('un profil incomplet est proposé au hasard');

!peutVoir(gens.femmeHetero, { ...gens.femmeHetero })
  ? ok('on ne se voit pas soi-même')
  : bad('on peut se liker soi-même');

// Nos soirées n'accueillent que des hétéros pour l'instant ; le groupe G
// reste une option. Cette vérification dit que la règle retenue donne
// exactement « le sexe opposé » tant que personne n'est gay — autrement dit
// qu'on n'a rien compliqué pour un cas qui ne se présente pas encore.
const soireeHetero = [
  { id: 'f1', gender: 'femme', orientation: 'hetero' },
  { id: 'f2', gender: 'femme', orientation: 'hetero' },
  { id: 'h1', gender: 'homme', orientation: 'hetero' },
  { id: 'h2', gender: 'homme', orientation: 'hetero' },
];
const commeSexeOppose = soireeHetero.every((a) =>
  soireeHetero.every(
    (b) => peutVoir(a, b) === (a.id !== b.id && a.gender !== b.gender),
  ),
);
commeSexeOppose
  ? ok('dans une soirée 100 % hétéro, la règle vaut exactement « le sexe opposé »')
  : bad('la règle ne redonne pas « le sexe opposé » sur une soirée hétéro');

/* ---------------------------------------------------------------- */
section('2. Chercher quelqu’un');

const fiche = (first_name, last_name = '', city = null, email = 'x@y.fr') => ({
  id: first_name,
  status: 'nouveau',
  first_name,
  last_name,
  email,
  city,
  soiree_group: null,
  gender: 'femme',
  orientation: 'hetero',
  age: 30,
});

const base = [
  fiche('Solène', 'Vasseur', 'Lille'),
  fiche('Anthony', 'Dubois', 'Roubaix'),
  fiche('Inès', 'Berthier', 'Tourcoing'),
  fiche('Gaëtan', 'Branchu', 'Lens'),
  fiche('Marius', 'Leroy', 'Lille'),
];

trouve(base[0], 'Solene') && trouve(base[2], 'ines') && trouve(base[3], 'gaetan')
  ? ok('on trouve « Solène » en tapant « Solene » : les accents ne comptent plus')
  : bad('la recherche reste sensible aux accents');

trouve(base[0], 'Solène') && trouve(base[1], 'DUBOIS') && trouve(base[4], 'lille')
  ? ok('et toujours par le nom, la ville, ou avec les accents')
  : bad('recherche ordinaire cassée');

!trouve(base[4], 'Thomas')
  ? ok('ce qui ne correspond pas ne correspond toujours pas')
  : bad('la recherche ramène n’importe qui');

// Le cas qui a déclenché tout ça : une lettre d'écart, et un écran vide.
presque(base, 'Antony').includes('Anthony')
  ? ok('« Antony » propose « Anthony » : une lettre d’écart, pas un silence')
  : bad('aucune suggestion pour une lettre manquante', JSON.stringify(presque(base, 'Antony')));

presque(base, 'Solenne').includes('Solène')
  ? ok('et « Solenne » propose « Solène »')
  : bad('suggestion manquante', JSON.stringify(presque(base, 'Solenne')));

presque(base, 'Marius').length === 0
  ? ok('rien n’est proposé quand la recherche trouve déjà')
  : bad('suggestions inutiles', JSON.stringify(presque(base, 'Marius')));

presque(base, 'Zoé').length === 0 && presque(base, 'ab').length === 0
  ? ok('et rien de farfelu : deux lettres ou un nom étranger ne proposent rien')
  : bad('suggestions farfelues', JSON.stringify(presque(base, 'Zoé')));

sansAccent('Mélodie Gaëtan Inès') === 'melodie gaetan ines'
  ? ok('la normalisation retire les accents sans toucher au reste')
  : bad('normalisation inattendue', sansAccent('Mélodie Gaëtan Inès'));

/* ---------------------------------------------------------------- */
section('3. L’âge affiché');

age('1994-03-02', new Date('2026-10-01').getTime()) === 32
  ? ok('un anniversaire déjà passé compte')
  : bad('âge faux', String(age('1994-03-02', new Date('2026-10-01').getTime())));

age('1994-12-25', new Date('2026-10-01').getTime()) === 31
  ? ok('un anniversaire à venir ne compte pas encore')
  : bad('âge arrondi au-dessus', String(age('1994-12-25', new Date('2026-10-01').getTime())));

age(null) === null && age('pas une date') === null
  ? ok('une date absente ou illisible ne devient pas un âge')
  : bad('une date illisible produit un âge');

/* ---------------------------------------------------------------- */
section('4. Le nom d’une manche');

rang(1) === '1er' && rang(2) === '2e' && rang(3) === '3e'
  ? ok('1er, 2e, 3e — et non « 1ème »')
  : bad('rang mal formé', [rang(1), rang(2), rang(3)].join(' '));

nomManche(1) === '1er crush time' && nomManche(3) === '3e crush time'
  ? ok('« 1er crush time » se dit à voix haute, « Crush time 1 » non')
  : bad('nom de manche inattendu', nomManche(1));

/* ---------------------------------------------------------------- */
section('5. Une manche se referme toute seule');

const { estOuverte, finPrevue } = await import(join(sortie, 'manches.js'));

const t = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

!estOuverte({ ouvert_at: null, ferme_at: null })
  ? ok('une manche jamais ouverte est fermée')
  : bad('une manche jamais ouverte se dit ouverte');

estOuverte({ ouvert_at: t(5), ferme_at: null })
  ? ok('ouverte il y a cinq minutes : encore ouverte')
  : bad('une manche récente est déjà close');

!estOuverte({ ouvert_at: t(16), ferme_at: null })
  ? ok('ouverte il y a seize minutes : close, même sans que personne l’ait refermée')
  : bad('une manche oubliée accepterait encore des likes');

!estOuverte({ ouvert_at: t(2), ferme_at: t(1) })
  ? ok('et l’hôte peut toujours abréger')
  : bad('la fermeture manuelle est ignorée');

estOuverte({ ouvert_at: t(20), ferme_at: null, duree_minutes: 30 })
  ? ok('une durée différente est respectée')
  : bad('duree_minutes ignorée');

(() => {
  const fin = finPrevue({ ouvert_at: '2026-10-18T21:00:00.000Z', ferme_at: null });
  return fin && fin.toISOString() === '2026-10-18T21:15:00.000Z';
})()
  ? ok('la fin tombe quinze minutes après l’ouverture')
  : bad('fin mal calculée');

/* ---------------------------------------------------------------- */
section('6. Le CSV de la billetterie');

const virgules = lireCsv('Email,Prénom\nmarie@exemple.fr,Marie\njean@exemple.fr,Jean\n');
virgules.length === 2 && virgules[0]['Email'] === 'marie@exemple.fr'
  ? ok('un CSV ordinaire se lit')
  : bad('CSV simple mal lu', JSON.stringify(virgules));

const excel = lireCsv('﻿Email;Prénom\nmarie@exemple.fr;Marie\n');
excel.length === 1 && excel[0]['Email'] === 'marie@exemple.fr'
  ? ok('le point-virgule d’Excel français et son BOM invisible sont absorbés')
  : bad('export Excel mal lu', JSON.stringify(excel));

const costaud = lireCsv(
  'Email,Nom,Note\n' +
    'marie@exemple.fr,"Dupont, Marie","Elle a dit ""oui"""\n' +
    'jean@exemple.fr,"Martin\nJean",court\n',
);
costaud.length === 2 &&
costaud[0]['Nom'] === 'Dupont, Marie' &&
costaud[0]['Note'] === 'Elle a dit "oui"' &&
costaud[1]['Nom'] === 'Martin\nJean'
  ? ok('virgules, guillemets doublés et retours à la ligne dans un champ')
  : bad('CSV complexe mal lu', JSON.stringify(costaud));

const entetes = lireCsv('Adresse e-mail de l’acheteur,Participant - Prénom\nz@b.fr,Zoé\n')[0];
colonne(entetes, 'email', 'e-mail', 'mail') === 'z@b.fr'
  ? ok('la colonne email est retrouvée sous un en-tête inconnu')
  : bad('colonne email introuvable', JSON.stringify(entetes));

colonne(entetes, 'prenom', 'first name') === 'Zoé'
  ? ok('et le prénom aussi, accents compris')
  : bad('colonne prénom introuvable');

colonne(entetes, 'telephone') === null
  ? ok('une colonne absente ne renvoie pas n’importe quoi')
  : bad('colonne inventée');

lireCsv('').length === 0 && lireCsv('Email\n').length === 0
  ? ok('un fichier vide ou sans ligne ne casse rien')
  : bad('fichier vide mal géré');

section('7. Le lien WhatsApp');

lienWhatsApp('06 12 34 56 78') === 'https://wa.me/33612345678'
  ? ok('un numéro français tel qu’on l’écrit devient un lien international')
  : bad('numéro français mal traduit', String(lienWhatsApp('06 12 34 56 78')));

lienWhatsApp('+33 6 12 34 56 78') === 'https://wa.me/33612345678'
  ? ok('le « + » et les espaces s’effacent')
  : bad('format international mal traduit', String(lienWhatsApp('+33 6 12 34 56 78')));

lienWhatsApp('0033612345678') === 'https://wa.me/33612345678'
  ? ok('et le « 00 » composé à l’ancienne vaut le « + »')
  : bad('préfixe 00 mal traduit', String(lienWhatsApp('0033612345678')));

lienWhatsApp('+32 470 12 34 56') === 'https://wa.me/32470123456'
  ? ok('un numéro étranger garde son indicatif, on n’y touche pas')
  : bad('numéro belge abîmé', String(lienWhatsApp('+32 470 12 34 56')));

lienWhatsApp('12 34 56') === null && lienWhatsApp('') === null && lienWhatsApp(null) === null
  ? ok('et ce qui ne ressemble à rien ne donne pas de lien : mieux vaut pas de bouton qu’un inconnu')
  : bad('un numéro douteux a produit un lien', String(lienWhatsApp('12 34 56')));

section('8. L’heure de la soirée est l’heure de Lille');

// L'hôte saisit « 21:00 » dans un champ qui n'emporte aucun fuseau. Cette
// heure-là est celle du mur de la salle, et rien d'autre.
instantDepuisParis('2026-07-18T21:00') === '2026-07-18T19:00:00.000Z'
  ? ok('en été, 21 h à Lille font 19 h UTC')
  : bad('heure d’été mal convertie', String(instantDepuisParis('2026-07-18T21:00')));

instantDepuisParis('2026-01-17T21:00') === '2026-01-17T20:00:00.000Z'
  ? ok('en hiver, elles font 20 h UTC — le décalage suit la saison')
  : bad('heure d’hiver mal convertie', String(instantDepuisParis('2026-01-17T21:00')));

// La nuit où l'on recule les montres : le décalage trouvé sur l'instant de
// départ n'est plus celui qui s'applique une fois corrigé.
instantDepuisParis('2026-10-25T03:00') === '2026-10-25T02:00:00.000Z'
  ? ok('et la nuit du changement d’heure ne décale rien')
  : bad('bascule d’heure mal gérée', String(instantDepuisParis('2026-10-25T03:00')));

heureDeParis('2026-07-18T19:00:00.000Z') === '21:00'
  ? ok('et l’affichage refait le chemin inverse')
  : bad('affichage faux', heureDeParis('2026-07-18T19:00:00.000Z'));

// Le plus important : tout cela doit valoir depuis n'importe où. Le serveur
// d'hébergement tourne en UTC, le téléphone d'un invité peut être resté sur
// un autre fuseau, et l'heure annoncée reste celle de la salle.
const ailleurs = execFileSync(
  process.execPath,
  [
    '-e',
    `import('${join(sortie, 'crush-regles.js')}').then((m) => {
      console.log(JSON.stringify([
        m.instantDepuisParis('2026-07-18T21:00'),
        m.heureDeParis('2026-07-18T19:00:00.000Z'),
      ]));
    })`,
  ],
  { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' },
).trim();

ailleurs === JSON.stringify(['2026-07-18T19:00:00.000Z', '21:00'])
  ? ok('depuis un fuseau à six heures de là, le résultat ne bouge pas d’une minute')
  : bad('le fuseau de la machine déteint encore sur l’heure', ailleurs);

/* ---------------------------------------------------------------- */
rmSync(sortie, { recursive: true, force: true });
console.log(
  '\n' +
    (failures.length === 0
      ? '\x1b[32mTout est vert.\x1b[0m'
      : `\x1b[31m${failures.length} échec(s) :\x1b[0m ` + failures.join(' | ')),
);
process.exit(failures.length === 0 ? 0 : 1);
