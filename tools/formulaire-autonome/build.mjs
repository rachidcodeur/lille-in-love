/**
 * Assemble les formulaires autonomes : un fichier HTML par parcours.
 *
 *   node tools/formulaire-autonome/build.mjs
 *
 * Les questions sont extraites de src/lib/questions.ts, jamais recopiées :
 * le formulaire autonome et l'application ne peuvent pas diverger.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..', '..');

const brut = execFileSync(
  'npx',
  ['--yes', 'tsx', '-e',
   "import {STEPS_COURT, STEPS_COMPLET, HONEYPOT_FIELDS} from './src/lib/questions';" +
   "import {SOIREE} from './src/lib/brand';" +
   "console.log(JSON.stringify({court:STEPS_COURT, complet:STEPS_COMPLET, pieges:HONEYPOT_FIELDS, soiree:SOIREE}));"],
  { cwd: RACINE, encoding: 'utf8' },
);
const q = JSON.parse(brut.slice(brut.indexOf('{'), brut.lastIndexOf('}') + 1));

const VARIANTES = {
  court: {
    fichier: 'formulaire-autonome-court.html',
    titre: 'FORMULAIRE COURT — 3 écrans',
    resume: 'Sexe, prénom, nom, email et photos.',
  },
  complet: {
    fichier: 'formulaire-autonome-complet.html',
    titre: 'FORMULAIRE COMPLET — 16 étapes',
    resume: 'Le questionnaire entier, celui qui remplace Tally à l’identique.',
  },
};

const gabarit = readFileSync(join(ICI, 'gabarit.html'), 'utf8');

for (const [parcours, v] of Object.entries(VARIANTES)) {
  const autre = parcours === 'court' ? 'complet' : 'court';
  const html = gabarit
    .replaceAll('__TITRE__', v.titre)
    .replaceAll('__RESUME__', v.resume)
    .replaceAll('__AUTRE_FICHIER__', VARIANTES[autre].fichier)
    .replaceAll('__AUTRE_NOM__', autre)
    .replaceAll('__ETAPES__', JSON.stringify(q[parcours]))
    .replaceAll('__PIEGES__', JSON.stringify(q.pieges))
    .replaceAll('__PARCOURS__', parcours)
    .replaceAll('__SOIREE__', JSON.stringify(q.soiree));

  const restes = html.match(/__[A-Z_]+__/g);
  if (restes) throw new Error(`marqueurs non remplacés : ${[...new Set(restes)].join(', ')}`);

  const sortie = join(RACINE, 'docs', v.fichier);
  writeFileSync(sortie, html);
  console.log(`${v.fichier.padEnd(36)} ${String(q[parcours].length).padStart(2)} étapes · ${html.length} caractères`);
}
