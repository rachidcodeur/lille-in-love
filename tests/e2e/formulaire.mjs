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

  // Un choix unique doit enchaîner sur l'étape suivante sans faire surgir
  // d'erreur : la validation doit voir la réponse qu'on vient de cocher.
  await page.getByRole('radio', { name: 'Une femme' }).click();
  await page.waitForTimeout(700);
  const title = await page.locator('.lil-question').innerText();
  title.includes('Où habites-tu')
    ? ok('un choix unique enchaîne sur l’étape suivante')
    : bad('pas d’avance automatique', title);
  (await page.locator('.lil-error').count()) === 0
    ? ok('aucune erreur affichée à tort')
    : bad('erreur parasite après l’avance automatique');

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

  await page.fill('#postalCode', '59000');
  await page.getByRole('button', { name: 'Suivant' }).click();
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

  let sent = null;
  await page.route('**/api/inscription', async (route) => {
    sent = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, id: 'test', firstName: 'Camille', emailSent: true }),
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
  await pick('Plus de 2 ans');
  await page.getByRole('button', { name: 'Culture & spectacles' }).click();
  await page.getByRole('button', { name: 'Voyages & découvertes' }).click();
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
  await page.getByRole('radio', { name: 'Non, je viens seul·e' }).click();
  await next();
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
  // La case finale ne porte plus de lien : texte seul, et on coche pour passer.
  (await page.locator('.lil-consent a').count()) === 0
    ? ok('la case d’acceptation ne contient plus aucun lien')
    : bad('un lien subsiste dans la case d’acceptation');
  await page.locator('.lil-consent input').first().check();
  await next();

  // --- Le service de matching, proposé en dernier -------------------
  ((await page.locator('.lil-question').innerText().catch(() => '')) || '').includes('cherche')
    ? ok('le service de matching est proposé après la dernière question')
    : bad('pas d’étape de matching', await page.locator('.lil-question').innerText().catch(() => ''));

  (await page.locator('.lil-matching').count()) === 0
    ? ok('et ses questions restent repliées tant qu’on n’a pas dit oui')
    : bad('les questions avancées s’affichent sans qu’on ait accepté');

  await pick('Oui, je veux en savoir plus');
  await page.waitForTimeout(400);
  (await page.locator('.lil-matching-bloc').count()) >= 5
    ? ok('« oui » déroule toutes les questions d’un coup, sans nouvelle étape')
    : bad('les questions avancées ne s’affichent pas', String(await page.locator('.lil-matching-bloc').count()));

  // Les deux blocs sensibles restent fermés tant que la case n'est pas cochée.
  const titres = async () =>
    (await page.locator('.lil-matching-bloc legend').allInnerTexts()).join(' | ').toLowerCase();
  !(await titres()).includes('religion')
    ? ok('les blocs sensibles restent fermés sans consentement explicite')
    : bad('origines et religion affichées sans consentement', await titres());

  // --- Les options du formulaire avancé répondent-elles vraiment ? ---
  // Elles portaient « aria-pressed » quand tout le style du formulaire
  // repose sur « aria-checked » : le choix était pris, et invisible.
  const blocEnfants = page.locator('.lil-matching-bloc').filter({ hasText: 'As-tu des enfants' });
  const oui = blocEnfants.getByRole('radio', { name: 'Oui' }).first();
  await oui.click();
  await page.waitForTimeout(200);

  (await oui.getAttribute('aria-checked')) === 'true'
    ? ok('un choix du formulaire avancé se marque comme sélectionné')
    : bad('la sélection ne se voit pas', String(await oui.getAttribute('aria-checked')));
  (await oui.locator('.lil-choice-mark').count()) === 1
    ? ok('avec la même puce que partout ailleurs')
    : bad('la puce de sélection manque');


  // La case se tient juste devant ce qu'elle ouvre. Tout en bas, on
  // cochait et les questions apparaissaient au milieu, hors de l'écran.
  const porte = page.locator('.lil-matching-porte');
  (await porte.count()) === 1
    ? ok('la case de consentement a son propre encadré, dans le fil des questions')
    : bad('pas de porte pour les sujets sensibles');

  const avantPorte = await porte.evaluate((el) => {
    const blocs = [...document.querySelectorAll('.lil-matching-bloc')];
    const suivant = blocs.find((b) => el.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return suivant ? suivant.querySelector('legend')?.textContent?.toLowerCase() : null;
  });
  avantPorte && !avantPorte.includes('origines')
    ? ok('et les blocs qu’elle commande ne sont pas là tant qu’elle est décochée')
    : bad('un bloc sensible se glisse avant la case', String(avantPorte));

  await page.locator('.lil-matching-consent input').check();
  await page.waitForTimeout(350);

  const apresPorte = await porte.evaluate((el) => {
    const blocs = [...document.querySelectorAll('.lil-matching-bloc')];
    const suivant = blocs.find((b) => el.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return suivant ? suivant.querySelector('legend')?.textContent?.toLowerCase() : null;
  });
  apresPorte?.includes('origines')
    ? ok('cochée, le bloc qu’elle ouvre apparaît juste en dessous d’elle')
    : bad('le bloc ouvert n’est pas sous la case', String(apresPorte));
  (await titres()).includes('religion') && (await titres()).includes('origines')
    ? ok('la case de consentement les ouvre, et elle seule')
    : bad('le consentement n’ouvre pas les blocs sensibles', await titres());

  // Et les cases à cocher, qui obéissent à « aucune préférence ».
  const blocCulture = page.locator('.lil-matching-bloc').filter({ hasText: 'préférences culturelles' });
  await blocCulture.getByRole('checkbox', { name: 'Européenne' }).click();
  await blocCulture.getByRole('checkbox', { name: 'Africaine' }).click();
  await page.waitForTimeout(200);
  (await blocCulture.locator('[aria-checked="true"]').count()) === 2
    ? ok('deux cases cochées tiennent ensemble')
    : bad('les cases ne se cochent pas', String(await blocCulture.locator('[aria-checked="true"]').count()));

  await blocCulture.getByRole('checkbox', { name: 'Aucune préférence' }).click();
  await page.waitForTimeout(200);
  (await blocCulture.locator('[aria-checked="true"]').count()) === 1
    ? ok('et « aucune préférence » les décoche toutes, à l’écran aussi')
    : bad('« aucune préférence » ne décoche rien');


  await next();
  await page.waitForTimeout(900);

  ((await page.locator('.lil-done-title').innerText().catch(() => '')) || '').includes('Camille')
    ? ok('l’écran de fin s’affiche avec le prénom')
    : bad('pas d’écran de fin');

  if (!sent) {
    bad('aucune requête d’inscription reçue');
  } else {
    sent.photos?.length === 3 ? ok('3 chemins de photos transmis') : bad('photos mal transmises');
    typeof sent.heightCm === 'number' ? ok('taille envoyée en nombre') : bad('taille non numérique');
    sent.consent === true ? ok('consentement transmis') : bad('consentement manquant');
    sent.birthDate === '1993-04-17'
      ? ok('les trois cases se recomposent en une date exploitable pour l’âge')
      : bad('date de naissance mal recomposée', String(sent.birthDate));
    sent.singleSince === 'plus_2_ans'
      ? ok('« depuis quand célibataire » est posée dans le formulaire classique')
      : bad('réponse célibat manquante', String(sent.singleSince));
    sent.hasChildren === undefined
      ? ok('et la question sur les enfants a bien quitté le formulaire')
      : bad('la question sur les enfants est encore envoyée');
    sent.matchingOptin === 'oui'
      ? ok('le choix du service de matching est transmis')
      : bad('choix de matching manquant', String(sent.matchingOptin));
    sent.matching?.consentSensible === true
      ? ok('avec le consentement aux données sensibles')
      : bad('consentement sensible manquant', JSON.stringify(sent.matching ?? null));
    sent.matching?.enfants === 'oui'
      ? ok('et les réponses du formulaire avancé arrivent jusqu’au serveur')
      : bad('réponses avancées perdues en route', JSON.stringify(sent.matching ?? null));
    JSON.stringify(sent.matching?.originesRecherchees) === JSON.stringify(['aucune'])
      ? ok('« aucune préférence » arrive seule, sans les cases d’avant')
      : bad('cases contradictoires transmises', JSON.stringify(sent.matching?.originesRecherchees));
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
