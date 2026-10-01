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
  ['tsc', 'src/lib/crush-regles.ts', 'src/lib/csv.ts',
   '--outDir', sortie, '--target', 'ES2022', '--module', 'esnext',
   '--moduleResolution', 'bundler', '--strict'],
  { stdio: 'inherit' },
);
// Sans ce marqueur, Node lit le JavaScript compilé comme du CommonJS et
// butte sur le premier « export ».
writeFileSync(join(sortie, 'package.json'), '{ "type": "module" }');

const { peutVoir, age } = await import(join(sortie, 'crush-regles.js'));
const { lireCsv, colonne } = await import(join(sortie, 'csv.js'));

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
section('2. L’âge affiché');

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
section('3. Le CSV de la billetterie');

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

/* ---------------------------------------------------------------- */
rmSync(sortie, { recursive: true, force: true });
console.log(
  '\n' +
    (failures.length === 0
      ? '\x1b[32mTout est vert.\x1b[0m'
      : `\x1b[31m${failures.length} échec(s) :\x1b[0m ` + failures.join(' | ')),
);
process.exit(failures.length === 0 ? 0 : 1);
