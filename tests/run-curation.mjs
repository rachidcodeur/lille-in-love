/**
 * Lance la chaîne complète en autonomie.
 *
 *   npm run test:curation
 *
 * Démarre le faux Supabase + Resend, puis un serveur Next branché dessus,
 * joue le parcours dans un navigateur, et éteint tout. Aucune clé réelle
 * n'est nécessaire et rien n'est envoyé à l'extérieur.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const FAKE_PORT = 54321;
const APP_PORT = 3100;

/** L'environnement de test : tout pointe vers le faux service. */
const testEnv = {
  ...process.env,
  NODE_ENV: 'development',
  // Un dossier de build à part : le serveur de développement du poste peut
  // continuer de tourner pendant que les tests s'exécutent.
  NEXT_DIST_DIR: '.next-test',
  SUPABASE_URL: `http://localhost:${FAKE_PORT}`,
  SUPABASE_SERVICE_ROLE_KEY: 'cle-de-test',
  SUPABASE_STORAGE_BUCKET: 'lil-photos',
  RESEND_API_KEY: 're_cle_de_test',
  RESEND_BASE_URL: `http://localhost:${FAKE_PORT}`,
  EMAIL_FROM: 'Lille in Love <info@in-love.fr>',
  EMAIL_REPLY_TO: 'info@in-love.fr',
  IP_HASH_SALT: 'sel-de-test',
  ADMIN_CODE: '',
  // La fausse page WordPress de la section 14 : sans cette autorisation, la
  // politique « frame-ancestors » refuse l'iframe — comme elle le ferait
  // pour n'importe quel site non déclaré.
  ALLOWED_EMBED_ORIGINS: 'http://localhost:5597',
  // Un seul vote suffit, et chaque réponse part 2 minutes après la décision :
  // le test vérifie que le délai configuré est bien celui transmis à Resend.
  VOTES_REQUIS: '1',
  DELAI_REPONSE_MINUTES: '2',
  // Les compteurs anti-abus sont en mémoire : sans cela, deux exécutions
  // d'affilée se feraient bloquer par la limite de 5 inscriptions par heure.
  MAX_INSCRIPTIONS_PAR_HEURE: '500',
  MAX_PHOTOS_PAR_10MIN: '500',
};

const children = [];

/**
 * Un port déjà occupé ferait échouer le démarrage en silence : le test
 * parlerait alors à un autre serveur, avec d'autres données, et échouerait
 * pour de mauvaises raisons. On préfère s'arrêter net.
 */
async function exigerPortLibre(port, quoi) {
  const { createServer } = await import('node:net');
  await new Promise((resolve, reject) => {
    const sonde = createServer();
    sonde.once('error', (e) =>
      reject(
        e.code === 'EADDRINUSE'
          ? new Error(
              `Le port ${port} est déjà utilisé (${quoi}).\n` +
                `  Arrête ce qui l'occupe :  lsof -ti tcp:${port} -sTCP:LISTEN | xargs kill`,
            )
          : e,
      ),
    );
    sonde.once('listening', () => sonde.close(resolve));
    // Sans hôte, comme les serveurs de test : écouter sur 127.0.0.1 seul
    // réussirait alors qu'un autre processus occupe déjà toutes les interfaces.
    sonde.listen(port);
  });
}

function start(command, args, env, name) {
  const child = spawn(command, args, { cwd: ROOT, env, stdio: 'pipe' });
  children.push(child);
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    if (/error|Error/.test(text)) process.stderr.write(`[${name}] ${text}`);
  });
  return child;
}

function stopAll() {
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* déjà terminé */
    }
  }
}

async function waitFor(url, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // N'importe quelle réponse HTTP prouve que le serveur écoute — même
      // un 503 de diagnostic.
      await fetch(url);
      return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`${label} n'a pas démarré à temps (${url})`);
}

process.on('exit', stopAll);
process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});

try {
  await exigerPortLibre(FAKE_PORT, 'faux Supabase + Resend');
  await exigerPortLibre(APP_PORT, 'application de test');

  console.log('Démarrage du faux Supabase + Resend…');
  start('node', [join(HERE, 'fake-backend/server.mjs')], { ...process.env, FAKE_PORT: String(FAKE_PORT) }, 'fake');
  await waitFor(`http://localhost:${FAKE_PORT}/__state`, 'le faux service');

  console.log('Démarrage de l’application…');
  start('npx', ['next', 'dev', '-p', String(APP_PORT)], testEnv, 'next');
  await waitFor(`http://localhost:${APP_PORT}/api/health`, 'l’application');

  console.log('Parcours en cours…');
  const test = start(
    'node',
    [join(HERE, 'e2e/curation.mjs')],
    {
      ...process.env,
      E2E_BASE_URL: `http://localhost:${APP_PORT}`,
      E2E_FAKE_URL: `http://localhost:${FAKE_PORT}`,
    },
    'test',
  );
  test.stdout.pipe(process.stdout);

  const code = await new Promise((resolve) => test.on('exit', resolve));
  stopAll();
  process.exit(code ?? 1);
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : cause);
  stopAll();
  process.exit(1);
}
