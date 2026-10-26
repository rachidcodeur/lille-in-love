/**
 * Parcours du formulaire dans un vrai navigateur.
 *
 *   npm run dev          (dans un terminal)
 *   npm run test:e2e     (dans un autre)
 *
 * Supabase et Resend ne sont pas sollicités : les appels réseau sont
 * interceptés. On vérifie le comportement du formulaire, pas l'infrastructure.
 */
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RACINE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
// Le formulaire complet vit à /embed : la racine, elle, mène au back-office.
const BASE = `${RACINE}/embed`;
const CHROME =
  process.env.E2E_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const GREEN = '[32m';
const RED = '[31m';
const BOLD = '[1m';
const OFF = '[0m';

const failures = [];
const ok = (label) => console.log(`  ${GREEN}✓${OFF} ${label}`);
const bad = (label, detail) => {
  failures.push(label);
  console.log(`  ${RED}✗${OFF} ${label}${detail ? ' — ' + detail : ''}`);
};
const section = (label) => console.log(`\n${BOLD}${label}${OFF}`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

/**
 * Répondre à tout le second questionnaire.
 *
 * Trente questions obligatoires : les énumérer une à une dans le test
 * reviendrait à recopier « matching.ts », et à le recopier de nouveau à
 * chaque question ajoutée. On prend donc la première réponse venue, quelle
 * qu'elle soit — ce qu'on vérifie ici, c'est que l'envoi passe une fois
 * tout rempli, pas la teneur des réponses.
 */
async function repondreATout(page) {
  // Cocher une case peut en faire apparaître une autre (« Précise ») :
  // on repasse jusqu'à ce que plus rien ne manque.
  for (let tour = 0; tour < 4; tour += 1) {
    const champs = await page.locator('.lil-matching-champ').all();
    let reste = false;

    for (const champ of champs) {
      const choix = champ.locator('.lil-choice').first();
      if (await choix.count()) {
        if ((await champ.locator('[aria-checked="true"]').count()) === 0) {
          await choix.click();
          reste = true;
        }
        continue;
      }

      const saisie = champ.locator('input, textarea').first();
      if ((await saisie.count()) && !(await saisie.inputValue())) {
        await saisie.fill('Peu importe');
        reste = true;
      }
    }

    if (!reste) return;
    await page.waitForTimeout(150);
  }
}

/* ================================================================== */
section('Navigation et validation');
{
  const page = await browser.newPage({ viewport: { width: 680, height: 1000 } });
  page.on('pageerror', (e) => bad('erreur JS dans la page', e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // L'acceptation vit entre l'encart de la soirée et les questions :
  // elle ne dépend d'aucune d'entre elles, et se lit avant d'en avoir
  // répondu une seule.
  const accord = page.locator('.lil-accord');
  (await accord.count()) === 1
    ? ok('l’acceptation a son bloc, entre la soirée et les questions')
    : bad('pas de bloc d’acceptation');
  (await accord.evaluate((el) => {
    const carte = document.querySelector('.lil-card');
    return Boolean(carte && el.compareDocumentPosition(carte) & Node.DOCUMENT_POSITION_FOLLOWING);
  }))
    ? ok('et elle précède bien la carte des questions')
    : bad('le bloc d’acceptation n’est pas au-dessus du formulaire');
  (await accord.locator('a').count()) === 2
    ? ok('avec les liens vers le règlement et la confidentialité')
    : bad('liens absents', String(await accord.locator('a').count()));

  // Non cochée, rien ne bouge — pas même l'avance automatique du premier
  // choix, qui sans cela emporterait la personne avant qu'elle ait lu.
  await page.getByRole('radio', { name: 'Une femme' }).click();
  await page.waitForTimeout(700);
  ((await page.locator('.lil-question').innerText()) || '').includes('Je suis')
    ? ok('sans l’avoir acceptée, le parcours ne démarre pas')
    : bad('on avance sans accepter les conditions');
  (await page.locator('.lil-accord[data-manque]').count()) === 1
    ? ok('et le bloc le signale, sans rougir l’écran entier')
    : bad('rien ne signale l’acceptation manquante');

  // Cochée, le premier choix enchaîne de nouveau tout seul.
  await accord.locator('input').check();
  await page.waitForTimeout(200);
  (await page.locator('.lil-accord[data-manque]').count()) === 0
    ? ok('la cocher efface aussitôt le reproche')
    : bad('le bloc reste en erreur après avoir coché');

  await page.getByRole('radio', { name: 'Une femme' }).click();
  await page.waitForTimeout(700);
  ((await page.locator('.lil-question').innerText()) || '').includes('Où habites-tu')
    ? ok('et un choix unique enchaîne sur l’étape suivante')
    : bad('pas d’avance automatique', await page.locator('.lil-question').innerText());

  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(300);
  (await page.locator('.lil-error').count()) >= 2
    ? ok('les champs obligatoires vides bloquent')
    : bad('champs vides non signalés');


  await page.fill('#city', 'Lille');
  await page.fill('#postalCode', '123');
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(300);
  ((await page.locator('#postalCode-error').innerText().catch(() => '')) || '').includes(
    '5 chiffres',
  )
    ? ok('un code postal à 3 chiffres est refusé')
    : bad('code postal invalide accepté');

  // L'avance automatique vit toujours sur les étapes à un seul choix.
  await page.fill('#postalCode', '59000');
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('radio', { name: 'Hétéro' }).click();
  await page.waitForTimeout(700);
  ((await page.locator('.lil-question').innerText()) || '').includes('cherches')
    ? ok('un choix unique enchaîne toujours sur l’étape suivante')
    : bad('pas d’avance automatique', await page.locator('.lil-question').innerText());
  (await page.locator('.lil-error').count()) === 0
    ? ok('aucune erreur affichée à tort')
    : bad('erreur parasite après l’avance automatique');

  // Deux retours en arrière : on est passé par l'orientation.
  await page.getByRole('button', { name: 'Précédent' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Précédent' }).click();
  await page.waitForTimeout(400);
  (await page.inputValue('#city')) === 'Lille'
    ? ok('le bouton Retour conserve les réponses')
    : bad('réponse perdue au retour');

  await page.close();
}

/* ================================================================== */
section('Reprise d’un brouillon');
{
  const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.locator('.lil-accord input').check();
  await page.getByRole('radio', { name: 'Une femme' }).click();
  await page.waitForTimeout(600);
  await page.fill('#city', 'Roubaix');
  await page.fill('#postalCode', '59100');
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(400);

  // Chaque parcours a son propre brouillon : le court et le complet ne
  // doivent pas se mélanger.
  const key = 'lil-inscription-draft-v1-complet';
  const before = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
  before
    ? ok('un brouillon est bien enregistré')
    : bad('aucun brouillon enregistré', `clé ${key} absente`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);

  after?.values?.city === 'Roubaix'
    ? ok('les réponses sont restaurées après un rechargement')
    : bad('brouillon perdu');
  // Sans cela, quelqu'un qui revient finir son formulaire paraîtrait l'avoir
  // rempli en quelques secondes et serait pris pour un robot.
  after?.startedAt === before?.startedAt
    ? ok('l’heure d’ouverture survit au rechargement')
    : bad('heure d’ouverture réinitialisée');

  await page.close();
}

/* ================================================================== */
section('Parcours complet et envoi');
{
  const page = await browser.newPage({ viewport: { width: 680, height: 1100 } });
  page.on('pageerror', (e) => bad('erreur JS dans la page', e.message));

  // Réponse immédiate : c'est ce qui révélait la course entre la fin de
  // l'envoi et l'affichage de la vignette.
  let uploads = 0;
  await page.route('**/api/upload', async (route) => {
    uploads += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        path: `pending/0000000${uploads}-0000-4000-8000-00000000000${uploads}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1234,
      }),
    });
  });

  // La reconnaissance du compagnon : « Julie Dupont » existe, le reste
  // non. Un carré de pixels tient lieu de photo.
  const PIXEL =
    'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  let compagnonDemande = null;
  await page.route('**/api/compagnon', async (route) => {
    compagnonDemande = JSON.parse(route.request().postData() ?? '{}');
    const connue =
      compagnonDemande.prenom?.toLowerCase() === 'julie' &&
      compagnonDemande.nom?.toLowerCase() === 'dupont';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        connue
          ? {
              trouve: true,
              id: '99999999-8888-4777-8666-555555555555',
              prenom: 'Julie',
              nom: 'DUP',
              photo: PIXEL,
            }
          : { trouve: false },
      ),
    });
  });

  let sent = null;
  await page.route('**/api/inscription', async (route) => {
    sent = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      // Le jeton, comme le rend la vraie route : c'est lui qui déclenche
      // la proposition de matching sous le remerciement.
      body: JSON.stringify({
        ok: true,
        id: 'test',
        firstName: 'Camille',
        emailSent: true,
        matchingToken: '11111111-2222-4333-8444-555555555555',
      }),
    });
  });

  let matchingEnvoye = null;
  await page.route('**/api/matching', async (route) => {
    matchingEnvoye = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const next = async () => {
    await page.getByRole('button', { name: /Suivant|Envoyer/ }).click();
    await page.waitForTimeout(280);
  };
  const pick = async (name) => {
    await page.getByRole('radio', { name }).first().click();
    await page.waitForTimeout(450);
  };

  // L'acceptation se coche une fois pour toutes, au-dessus du formulaire.
  await page.locator('.lil-accord input').check();
  await pick('Une femme');

  await page.fill('#city', 'Lille');
  await page.fill('#postalCode', '59000');
  await next();
  await pick('Hétéro');
  await pick('Une relation sérieuse');
  await page.fill('#heightCm', '168');
  await next();
  // Plus de longueur minimale : deux mots suffisent.
  await page.fill('#about', 'Deux mots.');
  await page.fill('#motivation', 'Marre des applis, envie de rencontrer des gens en vrai.');
  await next();
  // Elle vient après qu'on s'est raconté, pas entre l'orientation et la
  // taille : à cet endroit elle prolonge ce qu'on vient d'écrire.
  (await page.locator('.lil-question').innerText()).includes('célibataire')
    ? ok('« depuis quand célibataire » suit la présentation, pas les premières étapes')
    : bad('la question du célibat n’est pas à sa place', await page.locator('.lil-question').innerText());
  // On écrit la durée au lieu de choisir une tranche : « huit mois » et
  // « sept ans » tombaient dans le même panier.
  (await page.locator('.lil-celibat input').count()) === 1 &&
  (await page.locator('.lil-celibat select').count()) === 1
    ? ok('la durée de célibat s’écrit, avec mois ou années au choix')
    : bad('pas de champ libre pour la durée de célibat');
  (await page.locator('.lil-celibat-jamais').count()) === 1
    ? ok('et « jamais été en couple » garde son bouton')
    : bad('l’option « jamais en couple » a disparu');

  // Un libellé par case : « Ex : 8 » dit le format, pas ce qu'on attend.
  const casesCelibat = (await page.locator('.lil-celibat-libelle').allInnerTexts()).join(' | ');
  casesCelibat.includes('Nombre') && casesCelibat.includes('Mois / Années')
    ? ok('les deux cases portent leur libellé')
    : bad('libellés de durée absents', casesCelibat);
  !(await page.locator('.lil-question').innerText()).includes('personne ne vérifie')
    ? ok('sans la phrase sur l’honneur')
    : bad('la mention « personne ne vérifie » est encore là');
  await page.fill('.lil-celibat-nombre', '8');
  await page.selectOption('.lil-celibat select', 'mois');
  await next();
  // « (facultatif) » se lit à côté de la question, pas au fond de l'aide :
  // c'est ce qui évite d'abandonner devant un champ qu'on pourrait sauter.
  ((await page.locator('.lil-question').innerText().catch(() => '')) || '').includes('(facultatif)')
    ? ok('la question facultative le dit à côté de son titre')
    : bad('mention « (facultatif) » absente', await page.locator('.lil-question').innerText().catch(() => ''));
  (await page.locator('.lil-facultatif').evaluate((el) => getComputedStyle(el).fontWeight))
    >= '700'
    ? ok('elle est en gras, sans être plus grande')
    : bad('mention pas assez visible');

  await page.selectOption('#zodiac', 'belier');
  await next();
  await page.fill('#profession', 'Architecte');
  await next();
  await page.fill('#instagram', 'https://instagram.com/camille.d/');
  await next();
  // Qui vient accompagné donne deux noms : « Julie » toute seule ne
  // désigne personne, et deux amis finissaient sur deux soirées.
  await page.getByRole('radio', { name: 'Oui' }).first().click();
  await page.waitForTimeout(300);
  (await page.locator('#companionFirstName').count()) === 1 &&
  (await page.locator('#companionLastName').count()) === 1
    ? ok('qui vient accompagné donne le prénom et le nom')
    : bad('les deux noms ne sont pas demandés');

  // La fiche reconnue s'affiche avec son visage, et attend qu'on la
  // confirme : le rapprochement se fait d'un clic, pas tout seul.
  await page.fill('#companionFirstName', 'Julie');
  await page.fill('#companionLastName', 'Dupont');
  await page.waitForSelector('.lil-compagnon-trouve', { timeout: 5000 });
  (await page.locator('.lil-compagnon-nom').innerText()).includes('DUP')
    ? ok('la fiche reconnue montre son prénom et trois lettres de nom')
    : bad('nom mal présenté', await page.locator('.lil-compagnon-nom').innerText());
  (await page.locator('.lil-compagnon-photo').count()) === 1
    ? ok('avec sa photo, pour lever le doute')
    : bad('pas de photo sur la fiche reconnue');

  if (process.env.E2E_SHOTS) {
    await page
      .locator('.lil-compagnon')
      .screenshot({ path: `${process.env.E2E_SHOTS}/compagnon.png` });
  }

  await page.getByRole('button', { name: 'Oui, c’est bien la personne' }).click();
  await page.waitForTimeout(200);
  (await page.locator('.lil-compagnon-confirme').count()) === 1
    ? ok('confirmée, elle est rattachée')
    : bad('la confirmation ne s’affiche pas');

  // Changer un nom défait le rapprochement : il portait sur l'ancien.
  await page.fill('#companionLastName', 'Duponte');
  await page.waitForTimeout(200);
  (await page.locator('.lil-compagnon-confirme').count()) === 0
    ? ok('et un nom changé la défait')
    : bad('la confirmation survit au changement de nom');
  await page.fill('#companionLastName', 'Dupont');
  await page.waitForSelector('.lil-compagnon-trouve', { timeout: 5000 });
  await page.getByRole('button', { name: 'Oui, c’est bien la personne' }).click();
  await page.waitForTimeout(200);

  await page.getByRole('radio', { name: 'Non, je viens seul·e' }).click();
  await page.waitForTimeout(300);
  (await page.locator('#companionFirstName').count()) === 0
    ? ok('et rien de tout ça pour qui vient seul')
    : bad('les champs du compagnon restent affichés');
  await page.getByRole('radio', { name: 'Oui' }).first().click();
  await page.waitForTimeout(300);
  await next();
  const sources = await page.locator('#referral option').allInnerTexts();
  sources.some((o) => o.includes('Google')) && sources.some((o) => o.includes('ChatGPT'))
    ? ok('Google et ChatGPT sont proposés parmi les sources')
    : bad('nouvelles sources absentes', sources.join(', '));

  await page.selectOption('#referral', 'autre');
  await page.waitForTimeout(300);
  (await page.locator('#referralOther').count()) === 1
    ? ok('« Autrement » ouvre un champ pour préciser')
    : bad('pas de champ de précision pour « Autrement »');
  await page.fill('#referralOther', 'Une amie du club de sport');

  await page.selectOption('#referral', 'instagram');
  await next();

  (await page.locator('.lil-question').innerText()).includes('photos')
    ? ok('les 13 premières étapes s’enchaînent')
    : bad('parcours interrompu avant les photos');

  await page.setInputFiles('input[type=file]', [
    join(HERE, 'fixtures/photo-1.png'),
    join(HERE, 'fixtures/photo-2.png'),
    join(HERE, 'fixtures/photo-3.png'),
  ]);
  await page.waitForTimeout(1800);

  (await page.locator('.lil-thumb').count()) === 3
    ? ok('3 vignettes affichées')
    : bad('vignettes manquantes');
  (await page.locator('.lil-thumb-progress').count()) === 0
    ? ok('aucune vignette bloquée sur « Envoi… »')
    : bad('vignette bloquée — course sur l’état des photos');
  (await page.locator('.lil-dropzone').count()) === 0
    ? ok('la zone de dépôt disparaît au maximum atteint')
    : bad('zone de dépôt encore visible');

  await next();
  await page.fill('#firstName', 'Camille');
  await page.fill('#lastName', 'Dupont');
  (await page.inputValue('#lastName')) === 'Dupont'
    ? ok('le nom complet est accepté, sans coupure à trois lettres')
    : bad('nom tronqué', await page.inputValue('#lastName'));
  await page.fill('#phone', '06 12 34 56 78');
  await next();
  await page.fill('#email', 'camille.dupont@example.com');

  // Trois cases plutôt qu'un sélecteur : sur un téléphone, remonter de
  // 1993 au doigt dans un calendrier décourage.
  (await page.locator('.lil-naissance input').count()) === 2 &&
  (await page.locator('.lil-naissance select').count()) === 1
    ? ok('la date de naissance se saisit en trois cases, le mois en liste')
    : bad('la date de naissance n’est pas en trois cases');
  (await page.locator('#birthDate').getAttribute('placeholder')) === 'Ex : 06'
    ? ok('le jour montre un exemple plutôt qu’un sigle')
    : bad('placeholder du jour inattendu', String(await page.locator('#birthDate').getAttribute('placeholder')));

  // L'exemple de l'année tient sans préfixe : la case est étroite, et le
  // libellé au-dessus dit déjà ce qu'on attend.
  (await page.locator('.lil-naissance-annee').evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
    ? ok('et celui de l’année tient dans sa case')
    : bad('l’exemple de l’année déborde de sa case');

  // Plus d'entrée vide dans la liste des mois : janvier ouvre la liste
  // et vaut par défaut.
  const moisOptions = await page.locator('.lil-naissance select option').allInnerTexts();
  moisOptions.length === 12 && moisOptions[0] === 'janvier'
    ? ok('la liste des mois commence à janvier, sans entrée vide')
    : bad('liste des mois inattendue', moisOptions.join(', '));
  (await page.locator('.lil-naissance select').inputValue()) === '01'
    ? ok('et janvier est choisi par défaut')
    : bad('aucun mois par défaut', await page.locator('.lil-naissance select').inputValue());

  const libellesDate = (await page.locator('.lil-naissance .lil-celibat-libelle').allInnerTexts())
    .join(' | ');
  libellesDate === 'Jour | Mois | Année'
    ? ok('les trois cases portent leur libellé')
    : bad('libellés de date inattendus', libellesDate);
  await page.fill('#birthDate', '17');
  await page.selectOption('.lil-naissance select', '04');

  // On tape l'année chiffre par chiffre : la première version recomposait
  // une date à chaque frappe, et « 1 » devenait « 0001 » sous les doigts.
  const annee = page.locator('.lil-naissance-annee');
  await annee.click();
  await annee.pressSequentially('1993', { delay: 60 });
  (await annee.inputValue()) === '1993'
    ? ok('l’année se tape librement, sans zéros ajoutés en cours de frappe')
    : bad('l’année est complétée toute seule', await annee.inputValue());
  (await page.locator('.lil-card .lil-consent').count()) === 0
    ? ok('et aucune étape ne redemande d’accepter : c’est fait une fois pour toutes')
    : bad('une case d’acceptation subsiste dans le formulaire');

  await next();
  await page.waitForTimeout(1200);

  ((await page.locator('.lil-done-title').innerText().catch(() => '')) || '').includes('Camille')
    ? ok('l’écran de fin s’affiche avec le prénom')
    : bad('pas d’écran de fin');

  const remerciement = await page.locator('.lil-done').innerText();
  remerciement.includes('mail') && remerciement.includes('rencontres')
    ? ok('le remerciement parle du mail et des rencontres')
    : bad('texte de remerciement inattendu', remerciement.replace(/\n+/g, ' | '));

  // L'en-tête a fait son travail avant l'envoi : le garder ici repoussait
  // le partage et le service sous deux écrans de défilement.
  (await page.locator('.lil-entete').count()) === 0
    ? ok('l’écran de fin se passe de l’en-tête')
    : bad('l’en-tête reste affiché après l’envoi');

  // Le partage s'intercale entre le remerciement et la proposition : on
  // pense à quelqu'un une fois qu'on a fini, pas pendant qu'on remplit.
  (await page.locator('.lil-partage-lien').innerText()).includes('/inscription')
    ? ok('le lien à partager s’affiche après l’envoi, en entier')
    : bad('pas de lien à partager', await page.locator('.lil-partage-lien').innerText().catch(() => ''));
  (await page.getByRole('button', { name: 'Partager le lien' }).count()) === 1
    ? ok('avec de quoi l’envoyer en un geste')
    : bad('pas de bouton de partage');
  (await page.locator('.lil-partage').evaluate((el) => {
    const done = document.querySelector('.lil-done');
    const service = document.querySelector('.lil-service');
    return Boolean(
      done &&
        service &&
        done.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING &&
        el.compareDocumentPosition(service) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  }))
    ? ok('entre le remerciement et la proposition de matching')
    : bad('le partage n’est pas à sa place');

  // Au large, les deux cartes se mettent côte à côte : empilées, on
  // s'arrêtait au premier écran — celui qui dit qu'il n'y a rien à faire
  // — sans découvrir qu'il se passait autre chose en dessous.
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.waitForTimeout(300);
  const cote = await page.evaluate(() => {
    const mot = document.querySelector('.lil-fin-mot');
    const service = document.querySelector('.lil-service');
    if (!mot || !service) return null;
    const a = mot.getBoundingClientRect();
    const b = service.getBoundingClientRect();
    return { memeHauteur: Math.abs(a.top - b.top) < 4, aDroite: b.left > a.right - 4 };
  });
  cote?.memeHauteur && cote?.aDroite
    ? ok('au large, la nouveauté se place à côté du mot d’envoi')
    : bad('les deux cartes restent empilées', JSON.stringify(cote));

  (await page.locator('.lil-service-offre .lil-service-chapeau').evaluate((el) => {
    const style = getComputedStyle(el);
    return style.display === 'inline-block' && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
  }))
    ? ok('et « Nouveauté » porte sa pastille, au lieu de se fondre en surtitre')
    : bad('« Nouveauté » n’est pas mis en avant');

  if (process.env.E2E_SHOTS) {
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/fin-large.png`, fullPage: true });
  }

  // Dans un téléphone, deux colonnes ne sont plus deux colonnes : elles
  // redeviennent une pile, dans l'ordre où on les lit.
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.waitForTimeout(300);
  (await page.evaluate(() => {
    const mot = document.querySelector('.lil-fin-mot');
    const service = document.querySelector('.lil-service');
    return mot && service
      ? service.getBoundingClientRect().top > mot.getBoundingClientRect().bottom - 4
      : false;
  }))
    ? ok('et dans un téléphone, elles se remettent l’une sous l’autre')
    : bad('les colonnes se chevauchent sur petit écran');

  await page.setViewportSize({ width: 680, height: 1000 });
  await page.waitForTimeout(300);

  if (process.env.E2E_SHOTS) {
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/fin.png`, fullPage: true });
  }

  // --- Le service, proposé une fois la candidature partie ------------
  // Il était la dernière étape du formulaire. Le mettre après change
  // tout : plus personne n'a à refuser une offre pour pouvoir envoyer.
  (await page.locator('.lil-service-offre').count()) === 1
    ? ok('le service de matching se propose après l’envoi, en seconde carte')
    : bad('pas de carte de service après l’envoi');

  // Le service s'ajoute aux rencontres, il ne les rattrape pas : rien
  // dans ce texte ne doit laisser croire qu'elles tiennent du hasard.
  const offre = await page.locator('.lil-service-offre').innerText();
  (await page.locator('.lil-service-titre').innerText()) === 'Service de matching personnalisé'
    ? ok('la carte porte le nom du service')
    : bad('titre inattendu', await page.locator('.lil-service-titre').innerText());
  !/hasard/i.test(offre)
    ? ok('et son texte ne présente pas les rencontres comme un coup de chance')
    : bad('le texte parle de hasard', offre.replace(/\n+/g, ' | '));
  (await page.locator('.lil-matching-bloc').count()) === 0
    ? ok('et ses questions attendent qu’on ait dit oui')
    : bad('les questions s’affichent sans qu’on ait accepté');

  // Ce que le « oui » engage se lit avant de le donner : c'est ce clic
  // qui vaut consentement, il n'y a plus de case à cocher derrière.
  /origines/i.test(offre) && /religion/i.test(offre)
    ? ok('la carte annonce les questions sensibles avant qu’on accepte')
    : bad('le consentement n’est pas annoncé sur la carte', offre.replace(/\n+/g, ' | '));

  await page.getByRole('button', { name: 'Oui, ça m’intéresse' }).click();
  await page.waitForTimeout(400);

  (await page.locator('.lil-confidentialite').count()) === 1
    ? ok('et la mention sur qui lit les réponses est là, avant de commencer')
    : bad('pas de mention de confidentialité');

  // Deux colonnes valent pour une proposition qui tient en un écran ; le
  // questionnaire ouvert fait trente questions et reprend toute la place.
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.waitForTimeout(300);
  (await page.evaluate(() => {
    const mot = document.querySelector('.lil-fin-mot');
    const service = document.querySelector('.lil-service');
    return mot && service
      ? service.getBoundingClientRect().top > mot.getBoundingClientRect().bottom - 4
      : false;
  }))
    ? ok('le questionnaire ouvert reprend toute la largeur')
    : bad('les trente questions restent dans une demi-colonne');
  await page.setViewportSize({ width: 680, height: 1000 });
  await page.waitForTimeout(300);
  (await page.locator('.lil-matching-bloc').count()) >= 8
    ? ok('le oui donné, toutes les questions se déroulent d’un coup')
    : bad('questions manquantes', String(await page.locator('.lil-matching-bloc').count()));
  (await page.locator('.lil-service-consent').count()) === 0
    ? ok('sans seconde case à cocher')
    : bad('la case de consentement secondaire est encore là');

  const titres = (await page.locator('.lil-matching-bloc legend').allInnerTexts())
    .join(' | ')
    .toLowerCase();
  titres.includes('origines') && titres.includes('religion')
    ? ok('origines et religion sont dans le fil, sans porte séparée')
    : bad('blocs sensibles absents', titres);
  titres.includes('voyages') && titres.includes('style de vie')
    ? ok('avec les nouveaux blocs : voyages, style de vie')
    : bad('nouveaux blocs absents', titres);

  // Un cliché à la demande, pour juger de l'allure : « E2E_SHOTS=dossier ».
  if (process.env.E2E_SHOTS) {
    await page.locator('.lil-matching-bloc', { hasText: 'Tes habitudes' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/matching.png`, fullPage: true });
  }

  // Trente questions à la suite : l'intitulé doit se distinguer de
  // l'aide et des options, sinon on ne sait plus ce qu'on lit.
  const taille = await page
    .locator('.lil-matching-champ .lil-field-label')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  taille >= 16
    ? ok('les intitulés du second questionnaire se lisent de loin')
    : bad('intitulés trop petits', `${taille}px`);

  // « Si oui, lequel ? » n'a de sens qu'après un « oui » : affiché
  // d'avance, il demande de préciser ce qu'on n'a pas encore dit.
  const animaux = page.locator('.lil-matching-bloc', { hasText: 'Tes habitudes' });
  const lequel = animaux.locator('.lil-matching-champ', { hasText: 'Si oui, lequel ?' });
  const avant = await lequel.count();
  await animaux
    .locator('.lil-matching-champ', { hasText: 'As-tu un animal de compagnie' })
    .getByRole('radio', { name: 'Oui' })
    .click();
  await page.waitForTimeout(200);
  avant === 0 && (await lequel.count()) === 1
    ? ok('« si oui, lequel ? » n’apparaît qu’après le « oui »')
    : bad('précision sur l’animal mal conditionnée', `avant ${avant}`);

  await page
    .locator('.lil-matching-bloc', { hasText: 'situation maritale' })
    .getByRole('radio', { name: 'Divorcé(e) ou séparé(e)' })
    .click();
  await page.waitForTimeout(200);

  // Le service est facultatif, ses questions ne le sont pas : une seule
  // réponse sur trente partait sans que rien ne le dise, et ne servait à
  // personne. L'envoi doit refuser, et montrer où il manque quelque chose.
  await page.getByRole('button', { name: 'Envoyer mes réponses' }).click();
  await page.waitForTimeout(400);
  (await page.locator('.lil-service-merci').count()) === 0
    ? ok('un questionnaire à moitié rempli ne part pas')
    : bad('l’envoi est passé avec des questions sans réponse');
  /questions? sans réponse/i.test(await page.locator('.lil-service .lil-error').innerText())
    ? ok('et l’envoi dit combien il en reste')
    : bad('pas de décompte des questions manquantes');
  (await page.locator('.lil-matching-champ[data-manque]').count()) > 0
    ? ok('chaque question laissée vide est signalée à sa place')
    : bad('les questions manquantes ne sont pas repérables');

  await repondreATout(page);

  await page.getByRole('button', { name: 'Envoyer mes réponses' }).click();
  await page.waitForTimeout(900);
  (await page.locator('.lil-service-merci').count()) === 1
    ? ok('l’envoi des réponses est confirmé sur place')
    : bad('pas de confirmation après l’envoi du matching');

  matchingEnvoye?.token === '11111111-2222-4333-8444-555555555555'
    ? ok('les réponses partent avec le jeton rendu à l’inscription')
    : bad('jeton absent de l’envoi', JSON.stringify(matchingEnvoye));
  matchingEnvoye?.reponses?.situationMaritale === 'divorce' &&
  matchingEnvoye?.reponses?.consentSensible === true
    ? ok('avec les réponses et le consentement donné en tête')
    : bad('réponses de matching perdues', JSON.stringify(matchingEnvoye?.reponses ?? null));

  if (!sent) {
    bad('aucune requête d’inscription reçue');
  } else {
    sent.photos?.length === 3 ? ok('3 chemins de photos transmis') : bad('photos mal transmises');
    typeof sent.heightCm === 'number' ? ok('taille envoyée en nombre') : bad('taille non numérique');
    sent.consent === true ? ok('consentement transmis') : bad('consentement manquant');
    sent.birthDate === '1993-04-17'
      ? ok('les trois cases se recomposent en une date exploitable pour l’âge')
      : bad('date de naissance mal recomposée', String(sent.birthDate));
    sent.singleSince === '8_mois'
      ? ok('la durée de célibat part telle qu’elle a été écrite')
      : bad('durée de célibat mal transmise', String(sent.singleSince));
    sent.referralOther === 'Une amie du club de sport'
      ? ok('et la précision de « Autrement » suit')
      : bad('précision de source perdue', String(sent.referralOther));
    sent.hasChildren === undefined
      ? ok('et la question sur les enfants a bien quitté le formulaire')
      : bad('la question sur les enfants est encore envoyée');
    // Le matching ne fait plus partie de l'envoi de la candidature : il
    // part ensuite, par sa propre route.
    sent.matchingOptin === undefined && sent.matching === undefined
      ? ok('la candidature part sans rien savoir du service de matching')
      : bad('le matching voyage encore avec l’inscription', JSON.stringify(sent.matching ?? null));
    sent.elapsedMs > 0 ? ok('durée de remplissage transmise') : bad('durée manquante');
    sent.lil_ref_url === '' && sent.lil_extra_1 === ''
      ? ok('les pièges anti-robot partent vides')
      : bad('pièges anti-robot remplis');
  }

  (await page.evaluate(() => localStorage.getItem('lil-inscription-draft-v1-complet'))) === null
    ? ok('le brouillon est effacé après l’envoi')
    : bad('brouillon encore présent');

  await page.close();
}

/* ================================================================== */
section('Téléphone (390 px)');
{
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
    ? ok('aucun débordement horizontal')
    : bad('la page déborde en largeur');

  await page.locator('.lil-accord input').check();
  await page.getByRole('radio', { name: 'Une femme' }).click();
  await page.waitForTimeout(600);

  const fontSizes = await page.evaluate(() =>
    [...document.querySelectorAll('.lil-input')].map((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    ),
  );
  fontSizes.length > 0 && fontSizes.every((s) => s >= 16)
    ? ok('champs à 16 px — iOS ne zoomera pas à la saisie')
    : bad('police des champs sous 16 px', JSON.stringify(fontSizes));

  const heights = await page.evaluate(() =>
    [...document.querySelectorAll('.lil-input,.lil-btn')].map((el) =>
      Math.round(el.getBoundingClientRect().height),
    ),
  );
  heights.every((h) => h >= 44)
    ? ok('cibles tactiles d’au moins 44 px')
    : bad('cibles tactiles trop petites', JSON.stringify(heights));

  await page.close();
}

/* ================================================================== */
section('Hydratation');
{
  // Les extensions de navigateur posent leurs attributs sur <html> et <body>
  // avant que React n'hydrate : sans suppressHydrationWarning, chaque visiteur
  // équipé d'un gestionnaire de mots de passe verrait une erreur en console.
  for (const chemin of ['/embed', '/embed/court', '/admin']) {
    const page = await browser.newPage();
    const soucis = [];
    page.on('console', (m) => {
      if (/hydrat|did not match|Text content/i.test(m.text())) soucis.push(m.text().slice(0, 90));
    });
    page.on('pageerror', (e) => {
      if (/hydrat/i.test(e.message)) soucis.push(e.message.slice(0, 90));
    });

    // On simule une extension qui marque le <body>.
    await page.addInitScript(() => {
      document.body?.setAttribute('data-ext-simulee', '1.0');
    });
    await page.goto(`${RACINE}${chemin}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    soucis.length === 0
      ? ok(`${chemin} : aucune erreur d’hydratation, même avec une extension`)
      : bad(`${chemin} : erreur d’hydratation`, soucis[0]);

    await page.close();
  }
}

await browser.close();

console.log(
  '\n' +
    (failures.length === 0
      ? `${GREEN}Tout est vert.${OFF}`
      : `${RED}${failures.length} échec(s) :${OFF} ` + failures.join(' | ')),
);
process.exit(failures.length === 0 ? 0 : 1);
