/**
 * Une maquette complète, en local, sans toucher à rien.
 *
 *   npm run demo
 *
 * Démarre le faux Supabase des tests, l'application par-dessus, et remplit
 * le tout : des candidatures avec leurs photos, une soirée, son crush time,
 * ses participants. Rien n'est écrit dans la vraie base, aucun email ne part,
 * aucune clé réelle n'est nécessaire.
 *
 * C'est la façon de cliquer dans le back-office sans risque. « npm run dev »,
 * lui, parle à ton vrai Supabase : un import de test y créerait de vraies
 * lignes, et un clic de trop y enverrait de vrais emails.
 *
 * Ctrl+C pour tout éteindre.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');
const FAKE_PORT = Number(process.env.DEMO_FAKE_PORT ?? 54322);
const APP_PORT = Number(process.env.DEMO_PORT ?? 3001);
const FAKE = `http://localhost:${FAKE_PORT}`;
const APP = `http://localhost:${APP_PORT}`;

const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const gras = (s) => `\x1b[1m${s}\x1b[0m`;
const vert = (s) => `\x1b[32m${s}\x1b[0m`;

const enfants = [];
const eteindre = () => {
  for (const enfant of enfants) {
    try {
      enfant.kill('SIGTERM');
    } catch {
      /* déjà parti */
    }
  }
};
process.on('exit', eteindre);
process.on('SIGINT', () => {
  eteindre();
  process.exit(0);
});

/** Un port déjà pris ferait parler la démo à autre chose qu'elle-même. */
async function exigerPortLibre(port, quoi) {
  await new Promise((resoudre, rejeter) => {
    const sonde = createServer();
    sonde.once('error', (e) =>
      rejeter(
        e.code === 'EADDRINUSE'
          ? new Error(
              `Le port ${port} est occupé (${quoi}).\n` +
                `  Libère-le :  lsof -ti tcp:${port} -sTCP:LISTEN | xargs kill`,
            )
          : e,
      ),
    );
    sonde.once('listening', () => sonde.close(resoudre));
    sonde.listen(port);
  });
}

function demarrer(commande, args, env, nom) {
  const enfant = spawn(commande, args, { cwd: RACINE, env, stdio: 'pipe' });
  enfants.push(enfant);
  enfant.stderr.on('data', (bloc) => {
    const texte = bloc.toString();
    if (/error|Error/.test(texte)) process.stderr.write(gris(`[${nom}] ${texte}`));
  });
  return enfant;
}

async function attendre(url, quoi, limite = 90_000) {
  const fin = Date.now() + limite;
  while (Date.now() < fin) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`${quoi} n'a pas démarré (${url})`);
}

/* ------------------------------------------------------------------ */
/* De quoi remplir la maquette                                         */
/* ------------------------------------------------------------------ */
const CANDIDATES = [
  ['Inès', 'Berthier', 'femme', 'Lille', '1996-04-12', 'Architecte', 'C'],
  ['Camille', 'Noret', 'femme', 'Lille', '1993-09-01', 'Orthophoniste', 'A'],
  ['Salomé', 'Vasseur', 'femme', 'Roubaix', '1997-02-18', 'Libraire', 'C'],
  ['Jeanne', 'Delcourt', 'femme', 'Lille', '1991-11-30', 'Vétérinaire', 'B'],
  ['Samir', 'Haddad', 'homme', 'Roubaix', '1992-02-01', 'Chef de projet', 'A'],
  ['Thomas', 'Catez', 'homme', 'Lille', '1995-01-01', 'Ingénieur', 'B'],
  ['Marius', 'Leroy', 'homme', 'Lille', '1990-11-20', 'Charpentier', 'A'],
  ['Victor', 'Mazel', 'homme', 'Tourcoing', '1994-07-07', 'Kinésithérapeute', 'C'],
];

const entetes = {
  apikey: 'cle-de-demo',
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};
const poser = async (table, corps) =>
  (await fetch(`${FAKE}/rest/v1/${table}`, {
    method: 'POST',
    headers: entetes,
    body: JSON.stringify(corps),
  })).json();

async function remplir() {
  // Trois chacun : c'est le maximum, et c'est ce que montre une fiche de
  // match — autant voir la mise en page complète.
  const fixtures = ['photo-1.png', 'photo-2.png', 'photo-1.png'].map((nom) =>
    readFileSync(join(RACINE, 'tests/e2e/fixtures', nom)),
  );

  const membres = await poser(
    'lil_members',
    CANDIDATES.map(([prenom, nom, genre, ville, naissance, metier, groupe], index) => ({
      first_name: prenom,
      last_name: nom,
      email: `${prenom.toLowerCase()}@exemple.fr`,
      phone: `+336000000${String(index).padStart(2, '0')}`,
      gender: genre,
      orientation: 'hetero',
      city: ville,
      postal_code: '59000',
      birth_date: naissance,
      profession: metier,
      height_cm: 170,
      has_children: false,
      looking_for: 'relation_serieuse',
      about: 'Deux lignes de présentation, pour voir à quoi ça ressemble.',
      motivation: 'Rencontrer des gens autrement qu’en balayant un écran.',
      interests: ['culture', 'voyages'],
      referral: 'instagram',
      soiree_group: groupe,
      status: index % 3 === 0 ? 'valide' : 'nouveau',
      consent_at: new Date().toISOString(),
      created_at: new Date(Date.now() - index * 36e5).toISOString(),
    })),
  );

  // Deux photos chacun, vraiment déposées : les vignettes et la visionneuse
  // du back-office ne servent à rien sur des images absentes.
  for (const membre of membres) {
    for (const [index, octets] of fixtures.entries()) {
      const chemin = `candidatures/${membre.id}/${index + 1}.png`;
      await fetch(`${FAKE}/storage/v1/object/lil-photos/${chemin}`, {
        method: 'POST',
        headers: { apikey: 'cle-de-demo', 'Content-Type': 'image/png' },
        body: octets,
      });
      await poser('lil_photos', [
        { member_id: membre.id, storage_path: chemin, position: index + 1, mime_type: 'image/png' },
      ]);
    }
  }

  const jour = new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10);
  const [soiree] = await poser('lil_soirees', [
    {
      nom: 'Soirée de démonstration',
      age_min: 26,
      age_max: 36,
      date_soiree: jour,
      lieu: 'Un lieu privatisé, Lille',
      publiee_at: new Date().toISOString(),
      crush_code: '4812',
      crush_actif: true,
    },
  ]);

  await poser(
    'lil_crush_participants',
    membres.map((membre, index) => ({
      soiree_id: soiree.id,
      member_id: membre.id,
      email: membre.email,
      first_name: membre.first_name,
      birth_date: membre.birth_date,
      gender: membre.gender,
      orientation: 'hetero',
      jeton: `demo-${index}`,
    })),
  );

  // Un acheteur de billet inconnu de la base : c'est le cas que le tableau
  // de bord doit signaler, et il ne se voit que s'il existe.
  await poser('lil_crush_participants', [
    {
      soiree_id: soiree.id,
      member_id: null,
      email: 'inconnu@exemple.fr',
      first_name: 'Hugo',
      jeton: 'demo-inconnu',
    },
  ]);

  const rounds = await poser(
    'lil_crush_rounds',
    [20, 22, 0].map((heure, index) => ({
      soiree_id: soiree.id,
      numero: index + 1,
      prevu_a: `${jour}T${String(heure).padStart(2, '0')}:00:00.000Z`,
      // Le premier crush time est déjà ouvert : sans cela, la maquette ne
      // montre qu'une salle d'attente.
      ouvert_at: index === 0 ? new Date().toISOString() : null,
    })),
  );

  return { soiree, membres, rounds };
}

/* ------------------------------------------------------------------ */
try {
  await exigerPortLibre(FAKE_PORT, 'faux Supabase');
  await exigerPortLibre(APP_PORT, 'application de démonstration');

  console.log(gris('Démarrage du faux Supabase…'));
  demarrer('node', [join(RACINE, 'tests/fake-backend/server.mjs')], {
    ...process.env,
    FAKE_PORT: String(FAKE_PORT),
  }, 'faux');
  await attendre(`${FAKE}/__state`, 'le faux service');

  console.log(gris('Démarrage de l’application…'));
  demarrer('npx', ['next', 'dev', '-p', String(APP_PORT)], {
    ...process.env,
    NODE_ENV: 'development',
    // Un dossier de build à part : ton « npm run dev » habituel peut
    // continuer de tourner pendant ce temps.
    NEXT_DIST_DIR: '.next-demo',
    SUPABASE_URL: FAKE,
    SUPABASE_SERVICE_ROLE_KEY: 'cle-de-demo',
    SUPABASE_STORAGE_BUCKET: 'lil-photos',
    RESEND_API_KEY: 're_cle_de_demo',
    RESEND_BASE_URL: FAKE,
    EMAIL_FROM: 'Lille in Love <info@in-love.fr>',
    EMAIL_REPLY_TO: 'info@in-love.fr',
    IP_HASH_SALT: 'sel-de-demo',
    ADMIN_CODE: '',
    VOTES_REQUIS: '1',
    MAX_INSCRIPTIONS_PAR_HEURE: '500',
    MAX_PHOTOS_PAR_10MIN: '500',
  }, 'app');
  await attendre(`${APP}/api/health`, 'l’application');

  console.log(gris('Remplissage…'));
  const { soiree, rounds } = await remplir();

  // Quelqu'un a déjà donné son like : en entrant comme Inès et en le
  // choisissant en retour, le match se fait sous les yeux.
  const participants = await (
    await fetch(`${FAKE}/rest/v1/lil_crush_participants?soiree_id=eq.${soiree.id}`, {
      headers: { apikey: 'cle-de-demo' },
    })
  ).json();
  const parPrenom = Object.fromEntries(participants.map((p) => [p.first_name, p]));
  if (parPrenom['Samir'] && parPrenom['Inès']) {
    await poser('lil_crush_likes', [
      { round_id: rounds[0].id, de_id: parPrenom['Samir'].id, vers_id: parPrenom['Inès'].id },
    ]);
  }

  console.log(`
${vert('La maquette tourne.')} Rien n'est écrit dans ta vraie base.

  ${gras('Candidatures')}   ${APP}/admin
  ${gras('Soirées')}        ${APP}/admin/soirees
  ${gras('Crush Time')}     ${APP}/admin/soirees/${soiree.id}
  ${gras('Formulaire')}     ${APP}/embed

  ${gras('Crush Time — Inès')}   ${APP}/crush/c/${parPrenom['Inès']?.jeton ?? 'demo-0'}
  ${gras('Crush Time — Samir')}  ${APP}/crush/c/${parPrenom['Samir']?.jeton ?? 'demo-4'}
  ${gras('Par le code')}         ${APP}/crush  ${gris('(email + 4812)')}

  ${gris('Le premier crush time est ouvert. Samir a déjà choisi Inès :')}
  ${gris('entre comme Inès, choisis Samir, et le match se fait.')}

${gris('Ctrl+C pour tout éteindre.')}
`);

  await new Promise(() => {});
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : cause);
  eteindre();
  process.exit(1);
}
