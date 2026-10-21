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

/* ================================================================== */
section('Navigation et validation');
{
  const page = await browser.newPage({ viewport: { width: 680, height: 1000 } });
  page.on('pageerror', (e) => bad('erreur JS dans la page', e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // La première étape ne tourne plus toute seule : la case des conditions
  // est juste sous le choix, et avancer au premier clic l'empêcherait
  // d'être lue.
  await page.getByRole('radio', { name: 'Une femme' }).click();
  await page.waitForTimeout(500);
  ((await page.locator('.lil-question').innerText()) || '').includes('Je suis')
    ? ok('la première étape attend, pour laisser lire les conditions')
    : bad('la première étape tourne encore toute seule');

  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(300);
  (await page.locator('.lil-error').count()) >= 1
    ? ok('et l’on ne passe pas sans les avoir acceptées')
    : bad('on avance sans accepter les conditions');

  await page.locator('.lil-consent input').check();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(300);
  ((await page.locator('.lil-question').innerText()) || '').includes('Où habites-tu')
    ? ok('acceptées, le parcours démarre')
    : bad('le parcours ne démarre pas', await page.locator('.lil-question').innerText());

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

  await page.getByRole('radio', { name: 'Une femme' }).click();
  await page.locator('.lil-consent input').check();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(500);
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

  await pick('Une femme');

  // Les conditions à l'entrée, et non à la sortie : on accepte avant de
  // confier quoi que ce soit, pas après seize questions.
  (await page.locator('.lil-consent').count()) === 1
    ? ok('les conditions s’acceptent dès la première étape')
    : bad('pas de case d’acceptation à l’entrée');
  (await page.locator('.lil-consent a').count()) === 2
    ? ok('avec les liens vers le règlement et la confidentialité')
    : bad('liens absents de la case d’entrée', String(await page.locator('.lil-consent a').count()));
  await page.locator('.lil-consent input').check();
  await next();

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
  // Qui vient accompagné doit pouvoir envoyer le formulaire à l'autre :
  // on prenait son prénom, et c'est tout.
  await page.getByRole('radio', { name: 'Oui' }).first().click();
  await page.waitForTimeout(300);
  (await page.locator('.lil-partage-lien').innerText()).includes('/inscription')
    ? ok('qui vient accompagné voit le lien du formulaire, en entier')
    : bad('pas de lien à partager', await page.locator('.lil-partage-lien').innerText().catch(() => ''));
  (await page.getByRole('button', { name: 'Partager le lien' }).count()) === 1
    ? ok('avec de quoi l’envoyer en un geste')
    : bad('pas de bouton de partage');

  await page.getByRole('radio', { name: 'Non, je viens seul·e' }).click();
  await page.waitForTimeout(300);
  (await page.locator('.lil-partage').count()) === 0
    ? ok('et rien de tout ça pour qui vient seul')
    : bad('le bloc de partage reste affiché');
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
  (await page.locator('#birthDate').getAttribute('placeholder')) === 'Ex : 01'
    ? ok('le jour montre un exemple plutôt qu’un sigle')
    : bad('placeholder du jour inattendu', String(await page.locator('#birthDate').getAttribute('placeholder')));
  (await page.locator('.lil-naissance select option:not([hidden])').first().innerText()) === 'janvier'
    ? ok('et la liste des mois commence à janvier')
    : bad('la liste des mois ne commence pas à janvier');
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
  (await page.locator('.lil-consent').count()) === 0
    ? ok('et la dernière étape ne redemande plus d’accepter : c’est déjà fait')
    : bad('la case d’acceptation est encore à la fin');

  await next();
  await page.waitForTimeout(1200);

  ((await page.locator('.lil-done-title').innerText().catch(() => '')) || '').includes('Camille')
    ? ok('l’écran de fin s’affiche avec le prénom')
    : bad('pas d’écran de fin');

  const remerciement = await page.locator('.lil-done').innerText();
  remerciement.includes('mail') && remerciement.includes('rencontres')
    ? ok('le remerciement parle du mail et des rencontres')
    : bad('texte de remerciement inattendu', remerciement.replace(/\n+/g, ' | '));

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

  await page.getByRole('button', { name: 'Oui, ça m’intéresse' }).click();
  await page.waitForTimeout(400);

  // Le consentement se donne en tête, avant la première question.
  (await page.locator('.lil-matching-bloc').count()) === 0
    ? ok('rien ne s’affiche tant que les conditions ne sont pas acceptées')
    : bad('les questions s’affichent sans consentement');
  (await page.locator('.lil-confidentialite').count()) === 1
    ? ok('et la mention sur qui lit les réponses est là, avant de commencer')
    : bad('pas de mention de confidentialité');

  await page.locator('.lil-service-consent input').check();
  await page.waitForTimeout(400);
  (await page.locator('.lil-matching-bloc').count()) >= 8
    ? ok('cochée, toutes les questions se déroulent d’un coup')
    : bad('questions manquantes', String(await page.locator('.lil-matching-bloc').count()));

  const titres = (await page.locator('.lil-matching-bloc legend').allInnerTexts())
    .join(' | ')
    .toLowerCase();
  titres.includes('origines') && titres.includes('religion')
    ? ok('origines et religion sont dans le fil, sans porte séparée')
    : bad('blocs sensibles absents', titres);
  titres.includes('voyages') && titres.includes('style de vie')
    ? ok('avec les nouveaux blocs : voyages, style de vie')
    : bad('nouveaux blocs absents', titres);

  await page
    .locator('.lil-matching-bloc', { hasText: 'situation maritale' })
    .getByRole('radio', { name: 'Divorcé(e) ou séparé(e)' })
    .click();
  await page.waitForTimeout(200);

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

  await page.getByRole('radio', { name: 'Une femme' }).click();
  await page.locator('.lil-consent input').check();
  await page.getByRole('button', { name: 'Suivant' }).click();
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
