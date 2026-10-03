/**
 * La chaîne complète : inscription courte, curation, emails.
 *
 *   npm run test:curation
 *
 * Ni Supabase ni Resend ne sont sollicités : tests/fake-backend/server.mjs
 * tient leur rôle et permet de vérifier ce qui a réellement été écrit et
 * envoyé, y compris la date de programmation de l'email de bienvenue.
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(HERE, 'fixtures', name);

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const FAKE = process.env.E2E_FAKE_URL ?? 'http://localhost:54321';
const CHROME =
  process.env.E2E_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const failures = [];
const ok = (l) => console.log('  [32m✓[0m ' + l);
const bad = (l, d) => { failures.push(l); console.log('  [31m✗[0m ' + l + (d ? ' — ' + d : '')); };
const section = (l) => console.log('\n[1m' + l + '[0m');
const state = async () => (await fetch(`${FAKE}/__state`)).json();

/**
 * Attendre qu'une condition devienne vraie.
 *
 * Compter en millisecondes après un clic marche sur une machine au repos et
 * échoue sur une machine chargée — et un test qui échoue au hasard finit par
 * ne plus rien prouver. On regarde donc jusqu'à ce que ce soit vrai, ou
 * jusqu'à ce que ce soit vraiment faux.
 */
const jusqua = async (verifier, limite = 10_000) => {
  const fin = Date.now() + limite;
  for (;;) {
    try {
      if (await verifier()) return true;
    } catch {
      /* pas encore prêt */
    }
    if (Date.now() >= fin) return false;
    await new Promise((r) => setTimeout(r, 150));
  }
};

await fetch(`${FAKE}/__reset`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 700, height: 1000 } });
page.on('pageerror', (e) => bad('erreur JS', e.message));

/* ================================================================ */
section('1. Inscription par le formulaire court');

await page.goto(`${BASE}/embed/court`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

const steps = await page.locator('.lil-progress-count').innerText();
steps.endsWith('/ 3') ? ok(`le parcours court fait 3 étapes (${steps})`) : bad('nombre d’étapes inattendu', steps);

await page.getByRole('radio', { name: 'Une femme' }).click();
await page.waitForTimeout(600);

await page.fill('#firstName', 'Camille');
await page.fill('#lastName', 'Dupont');
await page.fill('#email', 'Camille.Dupont@Example.com');
await page.getByRole('button', { name: 'Suivant' }).click();
await page.waitForTimeout(400);

const title = await page.locator('.lil-question').innerText();
title.includes('photos') ? ok('étape photos atteinte') : bad('pas à l’étape photos', title);

await page.setInputFiles('input[type=file]', [fixture('photo-1.png'), fixture('photo-2.png')]);
await page.waitForTimeout(2500);
(await page.locator('.lil-thumb-progress').count()) === 0
  ? ok('2 photos envoyées au stockage')
  : bad('photo bloquée à l’envoi');

// Plus de case à cocher sur l'étape des photos : l'envoi vaut acceptation,
// et une mention sous le bouton le dit.
(await page.locator('.lil-consent').count()) === 0
  ? ok('aucune case à cocher sur l’étape des photos')
  : bad('la case de consentement est revenue');
((await page.locator('.lil-mention').innerText().catch(() => '')) || '').includes('acceptes')
  ? ok('la mention d’acceptation est affichée sous le bouton')
  : bad('mention d’acceptation absente');
// Le garde anti-robot écarte tout formulaire rempli en moins de 12 secondes.
await page.waitForTimeout(11000);
await page.getByRole('button', { name: 'Envoyer ma candidature' }).click();
await page.waitForTimeout(1500);

const done = await page.locator('.lil-done-title').innerText().catch(() => '');
done.includes('Camille') ? ok(`écran de fin : « ${done} »`) : bad('pas d’écran de fin', done);

// La confirmation a maintenant sa propre adresse : on y arrive vraiment, et
// le prénom fait le voyage.
await page.waitForTimeout(1200);
page.url().includes('/merci')
  ? ok(`redirigé vers la page de remerciement (${new URL(page.url()).pathname})`)
  : bad('pas de redirection vers /merci', page.url());
((await page.locator('.lil-done-title').innerText().catch(() => '')) || '').includes('Camille')
  ? ok('la page de remerciement reprend le prénom')
  : bad('prénom perdu à la redirection');

// Le pixel publicitaire n'a rien à faire dans l'espace de curation : il y
// verrait des noms, des emails et des visages.
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
(await page.evaluate(() => typeof window.fbq)) === 'undefined'
  ? ok('aucun pixel publicitaire sur le back-office')
  : bad('le pixel est chargé dans l’espace de curation');

/* ================================================================ */
section('2. Ce qui est arrivé en base');

let s = await state();
const member = s.members[0];

s.members.length === 1 ? ok('1 candidature enregistrée') : bad('candidatures en base', String(s.members.length));
member?.form_version === 'court' ? ok('marquée « formulaire court »') : bad('form_version', member?.form_version);
member?.email === 'camille.dupont@example.com' ? ok('email normalisé en minuscules') : bad('email', member?.email);
member?.status === 'nouveau' ? ok('statut « nouveau »') : bad('statut', member?.status);
member?.city == null ? ok('les champs du formulaire long restent vides') : bad('city renseigné à tort', member?.city);
member?.ip_hash && member.ip_hash.length === 32 ? ok('IP conservée uniquement sous forme hachée') : bad('ip_hash', String(member?.ip_hash));

s.storage.filter((k) => k.startsWith(`candidatures/${member.id}/`)).length === 2
  ? ok('photos rangées sous l’identifiant du membre')
  : bad('photos mal rangées', JSON.stringify(s.storage));
s.storage.some((k) => k.startsWith('pending/')) ? bad('des photos traînent encore dans pending/') : ok('plus rien dans pending/');

// L'équipe doit être prévenue, sinon les candidatures se découvrent à la main.
const alerte = s.sent.find((m) => m.subject?.startsWith('Nouvelle candidature'));
alerte ? ok(`alerte interne envoyée — « ${alerte.subject} »`) : bad('aucune alerte à l’équipe');
alerte?.to === 'info@in-love.fr'
  ? ok('adressée à info@in-love.fr')
  : bad('destinataire de l’alerte', String(alerte?.to));
alerte?.reply_to === 'camille.dupont@example.com'
  ? ok('répondre à l’alerte écrit directement à la personne')
  : bad('reply-to de l’alerte', String(alerte?.reply_to));
s.emails.some((e) => e.template === '00_alerte_interne' && e.status === 'envoye')
  ? ok('journalisée sur la fiche, comme les autres')
  : bad('alerte absente du journal');
(alerte?.html ?? '').includes('https://app.in-love.fr/admin/')
  ? ok('le lien mène à la fiche sur app.in-love.fr')
  : bad('lien de l’alerte', (alerte?.html ?? '').match(/https?:\/\/[^"']+\/admin\/[^"']*/)?.[0] ?? 'aucun');

const mail01 = s.sent.find((m) => m.subject?.startsWith('Inscription'));
mail01 ? ok(`email 01 envoyé — objet « ${mail01.subject} »`) : bad('email 01 non envoyé');
mail01?.to === 'camille.dupont@example.com' ? ok('adressé à la bonne personne') : bad('destinataire', mail01?.to);
mail01?.text?.length > 100 ? ok('version texte présente (bon pour l’anti-spam)') : bad('version texte absente');
!mail01?.scheduled_at ? ok('envoyé immédiatement, sans délai') : bad('email 01 différé à tort');

/* ================================================================ */
section('3. Le back-office');

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
const rows = await page.locator('.adm-row').count();
rows === 1 ? ok('la candidature apparaît dans la liste') : bad('lignes affichées', String(rows));

const rowText = await page.locator('.adm-row').first().innerText();
rowText.includes('Camille Dupont') ? ok('nom affiché, complet') : bad('nom absent', rowText);
!rowText.toLowerCase().includes('court')
  ? ok('pas d’étiquette « court » : la ligne reste lisible')
  : bad('l’étiquette « court » est revenue sur la ligne');

const vignette = page.locator('.adm-avatar').first();
const avatarOk = await vignette
  .evaluate((el) => el.tagName === 'IMG' && el.naturalWidth > 0)
  .catch(() => false);
avatarOk ? ok('la vignette photo se charge') : bad('vignette non chargée');

// Une adresse stable, sinon le navigateur retélécharge tout à chaque
// passage — c'est ce que faisaient les URL signées, dont le jeton changeait
// à chaque rendu.
const adressePhoto = await vignette.getAttribute('src');
adressePhoto?.startsWith('/admin/photo/')
  ? ok('la photo passe par une adresse du back-office, pas par le stockage')
  : bad('adresse de photo inattendue', String(adressePhoto));

await page.reload({ waitUntil: 'networkidle' });
(await page.locator('.adm-avatar').first().getAttribute('src')) === adressePhoto
  ? ok('et cette adresse ne bouge pas d’un affichage à l’autre')
  : bad('l’adresse de la photo change à chaque rendu : rien ne peut être gardé');

const servie = await fetch(`${BASE}${adressePhoto}`);
const consigne = servie.headers.get('cache-control') ?? '';
const empreinte = servie.headers.get('etag');
servie.ok && consigne.includes('private') && /max-age=[1-9]/.test(consigne)
  ? ok('elle est servie avec un cache privé : gardée par le navigateur, par personne d’autre')
  : bad('en-têtes de cache inattendus', `${servie.status} ${consigne}`);

const relue = await fetch(`${BASE}${adressePhoto}`, { headers: { 'If-None-Match': empreinte ?? '' } });
relue.status === 304
  ? ok('et redemandée, elle répond « inchangée » sans renvoyer l’image')
  : bad('pas de 304 sur une photo inchangée', String(relue.status));

await page.locator('.adm-row').first().click();
await page.waitForLoadState('networkidle');

const fiche = await page.locator('.adm-name').innerText();
fiche.includes('Camille') ? ok('fiche ouverte') : bad('fiche non ouverte', fiche);

await jusqua(async () =>
  (await page.locator('.adm-photo').count()) === 2 &&
  (await page.locator('.adm-photo').evaluateAll((els) => els.every((el) => el.naturalWidth > 0))),
);
const bigPhotos = await page.locator('.adm-photo').count();
const bigLoaded = await page.locator('.adm-photo').evaluateAll(
  (els) => els.every((el) => el.naturalWidth > 0),
);
bigPhotos === 2 && bigLoaded
  ? ok('les 2 photos se chargent sur la fiche')
  : bad('photos sur la fiche', `${bigPhotos} élément(s), chargées: ${bigLoaded}`);

const vides = await page.locator('.adm-answer dd.vide').count();
vides > 0 ? ok(`${vides} réponses marquées « non renseigné » (formulaire court)`) : bad('champs vides non signalés');

// Deux lignes : l'alerte partie à l'équipe, et la candidature reçue partie
// au candidat. Le journal de la fiche montre les deux.
const mailsShown = await page.locator('.adm-mail').count();
const mailsTextes = (await page.locator('.adm-mail-name').allInnerTexts()).map((t) => t.trim());
mailsShown === 2 && mailsTextes.includes('Nouvelle inscription signalée à info@in-love.fr') && mailsTextes.includes('Candidature reçue')
  ? ok('le journal montre l’alerte interne et la candidature reçue')
  : bad('journal des emails', `${mailsShown} · ${mailsTextes.join(', ')}`);

/* ---------------------------------------------------------------- */
section('3 bis. La visionneuse de photos');

await page.locator('.adm-photo-cliquable').first().click();
await page.waitForTimeout(400);

(await page.locator('.adm-visionneuse').count()) === 1
  ? ok('un clic sur une photo l’ouvre en grand')
  : bad('la visionneuse ne s’ouvre pas');

const vue = await page.locator('.adm-visionneuse-image').boundingBox();
const naturel = await page
  .locator('.adm-visionneuse-image')
  .evaluate((el) => [el.naturalWidth, el.naturalHeight]);
const tient = vue.height <= 1100 && vue.width <= 700;
const fidele =
  Math.abs(vue.width / vue.height - naturel[0] / naturel[1]) < 0.01;
tient ? ok('la photo tient dans la fenêtre') : bad('la photo déborde', JSON.stringify(vue));
fidele ? ok('ses proportions sont respectées') : bad('photo déformée');

const srcA = await page.locator('.adm-visionneuse-image').getAttribute('src');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(350);
(await page.locator('.adm-visionneuse-image').getAttribute('src')) !== srcA
  ? ok('les flèches passent d’une photo à l’autre')
  : bad('navigation impossible');

const petite = await page.locator('.adm-visionneuse-image').boundingBox();
await page.locator('.adm-visionneuse-image').click();
await page.waitForTimeout(450);
const zoomee = await page.locator('.adm-visionneuse-image').boundingBox();
zoomee.height > petite.height * 2
  ? ok(`le clic agrandit la photo (×${(zoomee.height / petite.height).toFixed(1)})`)
  : bad('pas de zoom');

await page.keyboard.press('Escape');
await page.waitForTimeout(350);
(await page.locator('.adm-visionneuse').count()) === 0
  ? ok('Échap referme et rend la page au curateur')
  : bad('la visionneuse reste ouverte');
(await page.evaluate(() => getComputedStyle(document.body).overflow)) !== 'hidden'
  ? ok('le défilement de la page est rendu')
  : bad('page toujours bloquée');

/* ================================================================ */
section('4. Validation → réponse programmée');

const before = Date.now();
await page.getByRole('button', { name: /Valider/ }).click();
await page.waitForTimeout(2000);

// Une validation réussie ne s'annonce plus en vert : le bouton change, et
// c'est suffisant. Seul un échec doit laisser un message.
(await page.locator('.adm-feedback').count()) === 0
  ? ok('aucun message de confirmation après une validation réussie')
  : bad('un message reste affiché', await page.locator('.adm-feedback').innerText().catch(() => ''));
((await page.locator('.adm-btn-yes').innerText().catch(() => '')) || '').includes('Candidature validée')
  ? ok('le bouton dit que c’est fait')
  : bad('bouton inchangé', await page.locator('.adm-btn-yes').innerText().catch(() => ''));

s = await state();
const updated = s.members[0];
updated.status === 'valide' ? ok('statut passé à « validée »') : bad('statut', updated.status);
updated.decided_at ? ok('date de décision enregistrée') : bad('decided_at absent');

const mail02 = s.sent.find((m) => m.subject === 'Bienvenue dans le club');
mail02 ? ok('email 02 confié à Resend') : bad('email 02 absent');

if (mail02?.scheduled_at) {
  const delayMin = (new Date(mail02.scheduled_at).getTime() - before) / 60000;
  delayMin > 1.5 && delayMin < 2.5
    ? ok(`programmé dans ${delayMin.toFixed(1)} min — conforme à DELAI_REPONSE_MINUTES=2`)
    : bad('délai inattendu', delayMin.toFixed(1) + ' min');
} else {
  bad('email 02 non programmé', 'scheduled_at absent');
}

const log02 = s.emails.find((e) => e.template === '02_bienvenue');
log02?.status === 'programme' ? ok('journalisé comme « programmé »') : bad('statut du journal', log02?.status);

/* ================================================================ */
section('5. Annuler une validation : la bienvenue est rattrapée');

// On ne refuse plus personne, mais un clic malheureux doit pouvoir être
// repris : sans ça, la bienvenue partirait six heures plus tard sans recours.
const envoisAvantAnnulation = s.sent.length;
await page.getByRole('button', { name: /Annuler la validation/ }).click();
await page.waitForTimeout(2000);

s = await state();
const after = s.members[0];
after.status === 'nouveau' ? ok('la candidature repart dans la file') : bad('statut', after.status);
after.decided_at === null
  ? ok('la date de décision est effacée : elle redevient une candidature en attente')
  : bad('decided_at subsiste', String(after.decided_at));

s.cancelled.length === 1
  ? ok('l’email de bienvenue a été annulé chez Resend')
  : bad('annulation manquante', JSON.stringify(s.cancelled));
const log02b = s.emails.find((e) => e.template === '02_bienvenue');
log02b?.status === 'annule' ? ok('journal mis à jour en « annulé »') : bad('journal non annulé', log02b?.status);

s.sent.length === envoisAvantAnnulation
  ? ok('aucun email envoyé à l’annulation')
  : bad('un email est parti', s.sent.slice(envoisAvantAnnulation).map((m) => m.subject).join(', '));

/* ---------------------------------------------------------------- */
section('5 bis. Revalider : la bienvenue est reprogrammée');

await page.getByRole('button', { name: /Valider la candidature/ }).click();
await page.waitForTimeout(2200);
s = await state();

const logs02 = s.emails.filter((e) => e.template === '02_bienvenue');
logs02.some((e) => e.status === 'programme')
  ? ok('une nouvelle « Bienvenue » est programmée')
  : bad('aucune bienvenue reprogrammée', JSON.stringify(logs02.map((e) => e.status)));

const enAttente = s.emails.filter((e) => e.status === 'programme');
enAttente.length === 1
  ? ok('une seule réponse en attente : aucun message contradictoire')
  : bad('plusieurs réponses en attente', JSON.stringify(enAttente.map((e) => e.template)));

/* ---------------------------------------------------------------- */
section('5 ter. Une candidature validée ne peut pas l’être deux fois');

const avantDouble = s.emails.find((e) => e.template === '02_bienvenue' && e.status === 'programme');
const envoisAvant = s.sent.length;

// Le bouton se désactive une fois la décision prise : rien à recliquer,
// donc aucune chance de décaler l'heure d'envoi par inadvertance.
(await page.locator('.adm-btn-yes').isDisabled())
  ? ok('le bouton « Valider » est neutralisé une fois la candidature validée')
  : bad('le bouton Valider reste actif après validation');

// La route, elle, reste exposée : on vérifie qu'elle est idempotente.
const rejoue = await (
  await fetch(`${BASE}/api/admin/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId: s.members[0].id, decision: 'valide' }),
  })
).json();
await page.waitForTimeout(400);
s = await state();
const apresDouble = s.emails.find((e) => e.template === '02_bienvenue' && e.status === 'programme');

rejoue.dejaPrise ? ok('la route dit que la décision était déjà prise') : bad('dejaPrise absent', JSON.stringify(rejoue));
s.sent.length === envoisAvant
  ? ok('aucun email supplémentaire confié à Resend')
  : bad('un doublon a été envoyé');
apresDouble?.scheduled_at === avantDouble?.scheduled_at
  ? ok('l’heure d’envoi reste calée sur la première validation')
  : bad('heure d’envoi décalée', `${avantDouble?.scheduled_at} → ${apresDouble?.scheduled_at}`);

/* ================================================================ */
section('5 quater. Une soirée s’enregistre, et n’envoie rien');

await fetch(`${FAKE}/__reset`, { method: 'POST' });

// La séquence tient en deux emails. Enregistrer une soirée ne doit donc
// écrire qu'une ligne : ni 03, ni 04, ni quoi que ce soit d'autre.
const semer = async (m) => {
  const r = await fetch(`${FAKE}/rest/v1/lil_members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ gender: 'femme', last_name: 'Essai', consent_at: new Date().toISOString(), form_version: 'complet', ...m }),
  });
  return (await r.json())[0].id;
};

await semer({ first_name: 'Validee', email: 'validee@example.com', status: 'valide', birth_date: '1995-03-01' });
await semer({ first_name: 'Ancienne', email: 'ancienne@example.com', status: 'non_retenu', birth_date: '1990-01-01' });
await semer({ first_name: 'PasEncoreVue', email: 'pasencore@example.com', status: 'nouveau', birth_date: '1980-01-01' });

await page.goto(`${BASE}/admin/soirees`, { waitUntil: 'networkidle' });
const saisir = async (id, valeur) => {
  await page.fill(`#soiree-${id}`, valeur);
};
await saisir('nom', 'Soirée test');
await saisir('ageMin', '27');
await saisir('ageMax', '35');
await saisir('date', '2026-10-17');
await saisir('heure', '20:00');
await saisir('lieu', 'Lille');

// Un champ qui perd le focus à chaque frappe se voit tout de suite ici.
(await page.inputValue('#soiree-nom')) === 'Soirée test'
  ? ok('le formulaire se remplit normalement')
  : bad('saisie perdue', await page.inputValue('#soiree-nom'));

(await page.getByRole('button', { name: /prévenu/ }).count()) === 0
  ? ok('plus d’aperçu d’audience : il n’y a plus personne à prévenir')
  : bad('l’aperçu d’audience est toujours là');

await page.getByRole('button', { name: 'Enregistrer la soirée' }).click();
await page.waitForTimeout(2000);

s = await state();
s.soirees.length === 1 ? ok('la soirée est enregistrée') : bad('soirées en base', String(s.soirees.length));
s.sent.length === 0
  ? ok('aucun email envoyé, quel que soit le statut des candidatures')
  : bad('des emails sont partis', s.sent.map((m) => `${m.to} · ${m.subject}`).join(', '));
s.emails.length === 0 ? ok('aucune ligne ajoutée au journal') : bad('journal non vide', String(s.emails.length));

((await page.locator('.adm-feedback').innerText().catch(() => '')) || '').includes('est enregistrée')
  ? ok('le curateur voit la confirmation')
  : bad('pas de confirmation', await page.locator('.adm-feedback').innerText().catch(() => ''));

await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ================================================================ */
section('6. Annulation demandée trop tôt : l’application doit insister');

// Resend laisse un email quelques secondes en « queued » avant de le rendre
// annulable. On refuse les deux premières tentatives, comme en vrai.
await fetch(`${FAKE}/__reset`, { method: 'POST' });
const creer = async (prenom, email) => {
  await fetch(`${BASE}/api/inscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formVersion: 'court',
      gender: 'homme',
      firstName: prenom,
      lastName: 'Essai',
      email,
      consent: true,
      photos: [{ path: 'pending/22222222-2222-4222-8222-222222222222.jpg' }],
      elapsedMs: 60000,
    }),
  });
  return (await state()).members.at(-1).id;
};
const decider = async (memberId, decision) =>
  (
    await fetch(`${BASE}/api/admin/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, decision }),
    })
  ).json();

const tardif = await creer('Tardif', 'tardif@example.com');
await decider(tardif, 'valide');
await fetch(`${FAKE}/__cancel-pas-encore?fois=2`, { method: 'POST' });

const reprise = await decider(tardif, 'nouveau');
!reprise.annulationEchouee
  ? ok('l’annulation finit par aboutir malgré les premiers refus')
  : bad('abandon au premier refus', reprise.annulationEchouee);

s = await state();
const logTardif = s.emails.find((e) => e.member_id === tardif && e.template === '02_bienvenue');
logTardif?.status === 'annule'
  ? ok('journal mis à « annulé » une fois Resend d’accord')
  : bad('journal', logTardif?.status);

/* ================================================================ */
section('7. Si Resend refuse définitivement, le curateur doit le savoir');

const cible = await creer('Annulation', 'annulation@example.com');
await decider(cible, 'valide');
await fetch(`${FAKE}/__refuse-cancel?on=1`, { method: 'POST' });
const refus = await decider(cible, 'nouveau');

refus.annulationEchouee
  ? ok(`l’échec est remonté : « ${refus.annulationEchouee} »`)
  : bad('un refus d’annulation passe en silence');

s = await state();
const log = s.emails.find((e) => e.member_id === cible && e.template === '02_bienvenue');
log?.status === 'programme'
  ? ok('le journal garde « programmé » — on ne prétend pas l’avoir arrêté')
  : bad('journal marqué à tort', log?.status);
log?.error
  ? ok('la raison de l’échec est consignée')
  : bad('aucune trace de l’échec dans le journal');

await fetch(`${FAKE}/__refuse-cancel?on=0`, { method: 'POST' });
await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ================================================================ */
section('8. Un envoi rapide ne doit JAMAIS être perdu en silence');

// Le formulaire court tient en trois écrans : une personne pressée le remplit
// en quelques secondes. Ce cas écartait la candidature tout en affichant
// « C'est envoyé » — le pire des comportements possibles.
await fetch(`${FAKE}/__reset`, { method: 'POST' });

const rapide = await fetch(`${BASE}/api/inscription`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    formVersion: 'court',
    gender: 'femme',
    firstName: 'Pressée',
    lastName: 'Mais Vraie',
    email: 'pressee@example.com',
    consent: true,
    photos: [{ path: 'pending/44444444-4444-4444-8444-444444444444.jpg' }],
    elapsedMs: 3000,
  }),
});
const rapideBody = await rapide.json();

!rapideBody.skipped
  ? ok('la candidature n’est plus écartée')
  : bad('candidature perdue en silence — le bug est de retour');

s = await state();
const pressee = s.members.find((m) => m.email === 'pressee@example.com');
pressee ? ok('elle est bien enregistrée en base') : bad('absente de la base');
pressee?.suspect === true
  ? ok(`signalée aux curateurs : « ${pressee.suspect_raison} »`)
  : bad('non signalée', String(pressee?.suspect));
s.sent.some((m) => m.to === 'pressee@example.com')
  ? ok('l’email de confirmation part quand même')
  : bad('aucun email envoyé');

/* ---------------------------------------------------------------- */
section('9. Un champ piège rempli reste écarté');

const robot = await fetch(`${BASE}/api/inscription`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    formVersion: 'court',
    gender: 'homme',
    firstName: 'Robot',
    lastName: 'Spam',
    email: 'robot@example.com',
    consent: true,
    photos: [{ path: 'pending/55555555-5555-4555-8555-555555555555.jpg' }],
    elapsedMs: 120000,
    lil_ref_url: 'http://spam.example',
  }),
});
const robotBody = await robot.json();
robotBody.skipped ? ok('envoi ignoré') : bad('le piège n’a pas fonctionné');

s = await state();
!s.members.some((m) => m.email === 'robot@example.com')
  ? ok('rien enregistré')
  : bad('le robot est entré en base');

await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ================================================================ */
section('10. Filet anti-doublon');

// La base vient d'être remise à zéro : on recrée la candidature d'origine.
await fetch(`${BASE}/api/inscription`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    formVersion: 'court',
    gender: 'femme',
    firstName: 'Camille',
    lastName: 'Dupont',
    email: 'camille.dupont@example.com',
    consent: true,
    photos: [{ path: 'pending/33333333-3333-4333-8333-333333333333.jpg' }],
    elapsedMs: 60000,
  }),
});

const dupe = await fetch(`${BASE}/api/inscription`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    formVersion: 'court',
    gender: 'femme',
    firstName: 'Camille',
    lastName: 'Dupont',
    email: 'CAMILLE.DUPONT@example.com',
    consent: true,
    photos: [{ path: 'pending/11111111-1111-4111-8111-111111111111.jpg' }],
    elapsedMs: 60000,
  }),
});
const dupeBody = await dupe.json();
dupeBody.alreadyRegistered ? ok('un second envoi du même email est reconnu, pas dupliqué') : bad('doublon créé', JSON.stringify(dupeBody));

s = await state();
s.members.length === 1 ? ok('toujours une seule candidature en base') : bad('membres en base', String(s.members.length));

/* ---------------------------------------------------------------- */
section('10 bis. Le même numéro sous une autre adresse');

// Quelqu'un qui se réinscrit avec un autre email garde son téléphone :
// c'est la même personne, et une seconde fiche fausserait la curation.
const memeNumero = await (
  await fetch(`${BASE}/api/inscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formVersion: 'complet',
      gender: 'homme', birthDate: '1992-05-14', city: 'Lille', postalCode: '59000',
      orientation: 'hetero', hasChildren: 'non', lookingFor: 'relation_serieuse',
      heightCm: 180, about: 'Essai.', motivation: 'Essai.', interests: ['culture'],
      profession: 'Essai', referral: 'instagram', comesWith: 'non',
      firstName: 'Premier', lastName: 'Numero', phone: '06 12 34 56 78',
      email: 'premier.numero@example.com', consent: true, elapsedMs: 60000,
      photos: [{ path: 'pending/66666666-6666-4666-8666-666666666666.jpg' }],
    }),
  })
).json();
memeNumero.id ? ok('première candidature enregistrée') : bad('inscription refusée', JSON.stringify(memeNumero));

const secondEnvoi = await (
  await fetch(`${BASE}/api/inscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formVersion: 'complet',
      gender: 'homme', birthDate: '1992-05-14', city: 'Lille', postalCode: '59000',
      orientation: 'hetero', hasChildren: 'non', lookingFor: 'relation_serieuse',
      heightCm: 180, about: 'Essai.', motivation: 'Essai.', interests: ['culture'],
      profession: 'Essai', referral: 'instagram', comesWith: 'non',
      firstName: 'Second', lastName: 'Numero',
      // Écrit autrement, mais c'est le même numéro.
      phone: '+33612345678',
      email: 'second.numero@example.com', consent: true, elapsedMs: 60000,
      photos: [{ path: 'pending/77777777-7777-4777-8777-777777777777.jpg' }],
    }),
  })
).json();

secondEnvoi.alreadyRegistered && secondEnvoi.motif === 'telephone'
  ? ok('le numéro est reconnu, quelle que soit sa façon d’être écrit')
  : bad('doublon de téléphone non détecté', JSON.stringify(secondEnvoi));

s = await state();
s.members.filter((m) => m.phone === '+33612345678').length === 1
  ? ok('une seule fiche porte ce numéro')
  : bad('fiches avec ce numéro', String(s.members.filter((m) => m.phone === '+33612345678').length));

/* ================================================================ */
section('11. Groupes A/B/C, filtres croisés et export CSV');

await fetch(`${FAKE}/__reset`, { method: 'POST' });

const ranger = async (m) => {
  const r = await fetch(`${FAKE}/rest/v1/lil_members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      gender: 'femme',
      last_name: 'Essai',
      status: 'valide',
      form_version: 'complet',
      consent_at: new Date().toISOString(),
      soiree_group: null,
      ...m,
    }),
  });
  return (await r.json())[0].id;
};

// Une population variée : c'est le croisement des critères qu'on veut voir
// fonctionner, pas chaque filtre pris isolément.
const idAmande = await ranger({ first_name: 'Amande', email: 'amande@example.com', birth_date: '1996-03-10' });
await ranger({
  first_name: 'Bea', email: 'bea@example.com', birth_date: '1998-02-05', soiree_group: 'C',
  phone: '0612345678', city: 'Lille', postal_code: '59000', profession: 'Libraire',
  instagram: '@bea', looking_for: 'relation_serieuse', orientation: 'hetero',
  has_children: false, height_cm: 167, zodiac: 'verseau', referral: 'affiche',
  about: 'Curieuse, du genre à dire "oui" trop vite.',
  motivation: 'Rencontrer,\nautrement.',
  interests: ['culture', 'voyages', 'autre'], interests_other: 'la poterie',
  companion_first_name: 'Lucie', companion_email: 'lucie@example.com',
});
await ranger({ first_name: 'Carmen', email: 'carmen@example.com', birth_date: '1984-01-20', soiree_group: 'C' });
await ranger({ first_name: 'David', email: 'david@example.com', birth_date: '1997-05-05', gender: 'homme', soiree_group: 'C' });
await ranger({ first_name: 'Elise', email: 'elise@example.com', birth_date: '1995-07-07', soiree_group: 'A' });
await ranger({ first_name: 'Flore', email: 'flore@example.com', form_version: 'court', soiree_group: 'C' });

// --- Attribuer un groupe depuis la fiche --------------------------
await page.goto(`${BASE}/admin/${idAmande}`, { waitUntil: 'networkidle' });
await page.locator('.adm-groupes[data-compact="false"] [title="Groupe C"]').click();
await jusqua(async () =>
  (await state()).members.find((m) => m.id === idAmande)?.soiree_group === 'C',
);

s = await state();
s.members.find((m) => m.id === idAmande)?.soiree_group === 'C'
  ? ok('un clic sur « C » range la candidature dans le groupe C')
  : bad('groupe non enregistré depuis la fiche', String(s.members.find((m) => m.id === idAmande)?.soiree_group));
s.members.find((m) => m.id === idAmande)?.status === 'valide'
  ? ok('le statut n’a pas bougé : un groupe n’est pas une décision')
  : bad('le statut a changé avec le groupe');
s.sent.length === 0 ? ok('aucun email déclenché par un changement de groupe') : bad('email envoyé à tort', String(s.sent.length));

// --- Le panneau de filtres, par le chemin d'un curateur -----------
// Les réglages ne s'affichent plus en permanence : ils vivent derrière
// l'icône, à droite. On refait donc le geste complet, du clic au résultat.
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
(await page.locator('.adm-panneau').count()) === 0
  ? ok('la page s’ouvre sans barre de réglages : seulement l’icône')
  : bad('le panneau est ouvert d’emblée');

await page.locator('.adm-filtres-bouton').click();
await page.waitForTimeout(400);
(await page.locator('.adm-panneau').count()) === 1
  ? ok('l’icône ouvre le panneau de droite')
  : bad('le panneau ne s’ouvre pas');

// Des cases, plus une liste déroulante : on en coche autant qu'on veut.
await page.locator('.adm-tri-cases label[data-groupe="C"] input').check();
await page.selectOption('.adm-panneau select[name="genre"]', 'femme');
await page.fill('.adm-panneau input[name="ageMin"]', '27');
await page.fill('.adm-panneau input[name="ageMax"]', '35');
await page.locator('.adm-btn-appliquer').click();
await page.waitForTimeout(1500);

page.url().includes('groupe=C') && page.url().includes('ageMax=35')
  ? ok('le panneau applique bien les critères choisis')
  : bad('critères non appliqués', page.url());
(await page.locator('.adm-panneau').count()) === 0
  ? ok('le panneau se referme une fois la liste filtrée')
  : bad('le panneau reste ouvert après l’envoi');
(await page.locator('.adm-filtres-bouton').getAttribute('data-actif')) === 'true'
  ? ok('l’icône signale qu’on ne regarde pas tout le monde')
  : bad('l’icône ne signale aucun critère');

await page.locator('.adm-filtres-bouton').click();
await page.waitForTimeout(400);

// Le bouton annonce le nombre de fiches des critères affichés, et se met à
// jour à la saisie — pas après coup.
((await page.locator('.adm-btn-appliquer').innerText().catch(() => '')) || '').includes('Voir 2 fiches')
  ? ok('le panneau compte la sélection en cours')
  : bad('compteur du panneau', await page.locator('.adm-btn-appliquer').innerText().catch(() => ''));

// Cocher un second groupe élargit la sélection au lieu de la remplacer :
// c'est tout l'intérêt des cases.
await page.locator('.adm-tri-cases label[data-groupe="A"] input').check();
await page.waitForTimeout(400);
((await page.locator('.adm-btn-appliquer').innerText().catch(() => '')) || '').includes('Voir 3 fiches')
  ? ok('cocher un second groupe ajoute ses fiches au lieu de remplacer')
  : bad('la seconde case ne cumule pas', await page.locator('.adm-btn-appliquer').innerText().catch(() => ''));

// Et décocher tout ramène tout le monde, sans case « tous » à chercher.
await page.locator('.adm-tri-cases input:checked').first().uncheck();
await page.locator('.adm-tri-cases input:checked').first().uncheck();
await page.waitForTimeout(400);
((await page.locator('.adm-btn-appliquer').innerText().catch(() => '')) || '').includes('Voir 3 fiches')
  ? ok('aucune case cochée vaut « tous les groupes »')
  : bad('tout décocher ne rend pas tout le monde', await page.locator('.adm-btn-appliquer').innerText().catch(() => ''));

// L'export vit dans le panneau et part du même formulaire : il emporte donc
// les critères affichés, y compris celui qu'on vient de changer.
const telechargement = page.waitForEvent('download', { timeout: 15000 });
await page.locator('.adm-btn-exporter').click();
const fichier = await telechargement.catch(() => null);
fichier?.suggestedFilename()?.endsWith('.csv')
  ? ok(`l’export du panneau télécharge ${fichier.suggestedFilename()}`)
  : bad('aucun fichier téléchargé depuis le panneau');
// On attend la fin du téléchargement : laissé en cours, il perturbe la
// navigation suivante et rend le test instable une fois sur deux.
await fichier?.path().catch(() => null);

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
(await page.locator('.adm-panneau').count()) === 0
  ? ok('Échap referme le panneau sans rien changer')
  : bad('Échap reste sans effet');

// --- Filtres croisés : les femmes de 27 à 35 ans du groupe C ------
const urlFiltre = `${BASE}/admin?groupe=C&genre=femme&ageMin=27&ageMax=35`;
await page.goto(urlFiltre, { waitUntil: 'networkidle' });

const noms = (await page.locator('.adm-row-name').allInnerTexts()).map((t) => t.trim());
noms.length === 2 && noms.every((n) => /Amande|Bea/.test(n))
  ? ok('la liste ne garde que les femmes de 27 à 35 ans du groupe C')
  : bad('sélection inattendue', noms.join(', ') || '(vide)');
!noms.some((n) => n.includes('Flore'))
  ? ok('la fiche sans date de naissance sort dès qu’une borne d’âge est posée')
  : bad('un âge inconnu est passé au travers du filtre');

// --- Attribuer un groupe depuis la liste, sans quitter la page ----
await page.locator('.adm-row', { hasText: 'Amande' }).locator('[title="Groupe B"]').click();
await page.waitForTimeout(1200);
page.url().includes('/admin?')
  ? ok('cliquer une touche de groupe dans la liste n’ouvre pas la fiche')
  : bad('la fiche s’est ouverte', page.url());

s = await state();
s.members.find((m) => m.id === idAmande)?.soiree_group === 'B'
  ? ok('le groupe se change aussi depuis la liste')
  : bad('groupe non enregistré depuis la liste', String(s.members.find((m) => m.id === idAmande)?.soiree_group));

await page.waitForTimeout(600);
(await page.locator('.adm-row-name').allInnerTexts()).length === 1
  ? ok('la fiche sort de la sélection dès qu’elle change de groupe')
  : bad('la liste ne s’est pas rafraîchie');

// --- L'export CSV de cette même sélection --------------------------
/** Les enregistrements d'un CSV : un champ entre guillemets peut contenir
 *  des retours à la ligne, qui ne sont pas des fins d'enregistrement. */
const lignesCsv = (texte) => {
  const lignes = [];
  let courante = '';
  let dansGuillemets = false;
  for (const c of texte.replace(/\r\n/g, '\n')) {
    if (c === '"') dansGuillemets = !dansGuillemets;
    if (c === '\n' && !dansGuillemets) {
      lignes.push(courante);
      courante = '';
    } else {
      courante += c;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
};

const reponse = await fetch(`${BASE}/api/admin/export?groupe=C&genre=femme&ageMin=27&ageMax=35`);
const csv = await reponse.text();
const lignes = lignesCsv(csv);

const ENTETE =
  'soiree_group,first_name,gender,age,birth_date,email,phone,city,postal_code,profession,' +
  'instagram,looking_for,orientation,has_children,children_preference,height_cm,zodiac_sign,' +
  'about_you,ideal_evening,interests,friend_name,friend_email,source,created_at,id';

lignes[0] === ENTETE
  ? ok('l’en-tête reprend exactement les colonnes de l’export existant')
  : bad('en-tête différent', lignes[0]);

(reponse.headers.get('content-disposition') ?? '').includes('candidatures_femmes_C_27-35.csv')
  ? ok('le fichier porte le nom de la sélection')
  : bad('nom de fichier', reponse.headers.get('content-disposition'));

// Amande vient de passer en B : l'export doit suivre la liste, pas la traîner.
lignes.length === 2
  ? ok('l’export contient exactement la sélection affichée (1 fiche)')
  : bad('lignes exportées', String(lignes.length - 1));

const bea = lignes[1] ?? '';
bea.startsWith('C,Bea,F,28,1998-02-05,bea@example.com,')
  ? ok('groupe, prénom, sexe en F/M, âge et date de naissance au bon format')
  : bad('début de ligne inattendu', bea.slice(0, 80));
bea.includes(',serieux,hetero,False,,167,verseau,')
  ? ok('« relation sérieuse » devient serieux, has_children devient False')
  : bad('valeurs converties', bea);
bea.includes('"Rencontrer,\nautrement."')
  ? ok('une virgule et un retour à la ligne dans un texte ne cassent pas le fichier')
  : bad('échappement des sauts de ligne', bea);
bea.includes('"Curieuse, du genre à dire ""oui"" trop vite."')
  ? ok('les guillemets d’un témoignage sont doublés, comme le veut le format')
  : bad('échappement des guillemets', bea);
bea.includes('"Culture & spectacles, Voyages & découvertes, la poterie"')
  ? ok('les centres d’intérêt sortent en clair, « autre » précisé')
  : bad('centres d’intérêt', bea);
bea.includes(',Lucie,lucie@example.com,affiche,')
  ? ok('l’accompagnant et l’origine de la candidature sont repris')
  : bad('accompagnant ou source', bea);

// --- Sans groupe, et remise à zéro ---------------------------------
const sansGroupe = await fetch(`${BASE}/api/admin/export?groupe=aucun`);
const sansGroupeCsv = lignesCsv(await sansGroupe.text());
sansGroupeCsv.length === 1
  ? ok('« sans groupe » ne renvoie plus personne : tout le monde est rangé')
  : bad('fiches sans groupe', sansGroupeCsv.slice(1).map((l) => l.split(',')[1]).join(', '));

// Symétrique du test précédent : une pastille de statut n'est qu'une
// indication. Elle ne doit pas avaler le clic — c'est arrivé, et une ligne
// qui ne s'ouvre pas quand on clique au milieu ne se remarque pas tout de suite.
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await page.waitForSelector('.adm-row');
await page.waitForTimeout(500);
// Un clic à la souris, aux coordonnées exactes de la pastille : Playwright
// refuserait de « cliquer la pastille » puisqu'elle est recouverte par le
// lien — et c'est précisément ce recouvrement qu'on veut vérifier.
const pastille = await page.locator('.adm-row', { hasText: 'Carmen' }).locator('.adm-chip').boundingBox();
await page.mouse.click(pastille.x + pastille.width / 2, pastille.y + pastille.height / 2);
await jusqua(async () => page.url().includes('/admin/') && page.url() !== `${BASE}/admin`);
((await page.locator('.adm-name').innerText().catch(() => '')) || '').includes('Carmen')
  ? ok('cliquer une pastille de statut ouvre la fiche, comme le reste de la ligne')
  : bad('la pastille de statut avale le clic', page.url());

await page.goto(`${BASE}/admin/${idAmande}`, { waitUntil: 'networkidle' });
await page.locator('.adm-groupes[data-compact="false"] .adm-groupe-btn-vide').click();
await page.waitForTimeout(900);
s = await state();
s.members.find((m) => m.id === idAmande)?.soiree_group == null
  ? ok('la touche « — » retire la candidature de tout groupe')
  : bad('groupe non retiré', String(s.members.find((m) => m.id === idAmande)?.soiree_group));

/* ---------------------------------------------------------------- */
section('11 bis. Chercher quelqu’un');

// Deux curateurs qui parcourent deux cents fiches ont besoin de retrouver
// une personne dont ils n'ont que le prénom, ou trois lettres de nom.
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await page.fill('.adm-recherche input[name="q"]', 'bea');
await page.locator('.adm-recherche button[type="submit"]').click();
await page.waitForTimeout(1200);

const trouvees = (await page.locator('.adm-row-name').allInnerTexts()).map((t) => t.trim());
trouvees.length === 1 && trouvees[0].includes('Bea')
  ? ok('la recherche retrouve une personne par son prénom')
  : bad('recherche par prénom', trouvees.join(', ') || '(vide)');

// L'email aussi : c'est souvent tout ce qu'on a sous la main.
await page.goto(`${BASE}/admin?q=carmen%40example`, { waitUntil: 'networkidle' });
((await page.locator('.adm-row-name').first().innerText().catch(() => '')) || '').includes('Carmen')
  ? ok('la recherche fonctionne aussi sur l’adresse email')
  : bad('recherche par email');

// Une recherche se combine avec les critères, et le compteur suit.
await page.goto(`${BASE}/admin?q=example&genre=homme`, { waitUntil: 'networkidle' });
const hommes = (await page.locator('.adm-row-name').allInnerTexts()).map((t) => t.trim());
hommes.length === 1 && hommes[0].includes('David')
  ? ok('recherche et filtres se combinent')
  : bad('combinaison recherche + filtre', hommes.join(', ') || '(vide)');
((await page.locator('.adm-sub').innerText().catch(() => '')) || '').includes('« example »')
  ? ok('le sous-titre rappelle ce qu’on cherche')
  : bad('recherche absente du sous-titre', await page.locator('.adm-sub').innerText().catch(() => ''));

// Une virgule casserait le filtre envoyé à Supabase : elle doit être écartée.
const piege = await fetch(`${BASE}/admin?q=${encodeURIComponent('bea,x)')}`);
piege.ok
  ? ok('un terme contenant virgule et parenthèse ne casse pas la requête')
  : bad('la recherche a fait tomber la page', String(piege.status));

await page.goto(`${BASE}/admin?q=personnequinexistepas`, { waitUntil: 'networkidle' });
((await page.locator('.adm-empty').innerText().catch(() => '')) || '').includes('Rien ne correspond')
  ? ok('une recherche vide le dit clairement')
  : bad('message de recherche vide absent');

/* ---------------------------------------------------------------- */
section('11 ter. Le groupe G et le filtre sur l’orientation');

const idGael = await ranger({
  first_name: 'Gael', email: 'gael@example.com', gender: 'homme',
  birth_date: '1996-05-05', orientation: 'gay',
});

await page.goto(`${BASE}/admin/${idGael}`, { waitUntil: 'networkidle' });
await page.locator('.adm-groupes[data-compact="false"] [title="Groupe G"]').click();
await page.waitForTimeout(900);
s = await state();
s.members.find((m) => m.id === idGael)?.soiree_group === 'G'
  ? ok('le groupe G s’attribue comme les trois autres')
  : bad('groupe G non enregistré', String(s.members.find((m) => m.id === idGael)?.soiree_group));

await page.goto(`${BASE}/admin?orientation=gay`, { waitUntil: 'networkidle' });
const gays = (await page.locator('.adm-row-name').allInnerTexts()).map((t) => t.trim());
gays.length === 1 && gays[0].includes('Gael')
  ? ok('le filtre « gay » ne garde que les fiches concernées')
  : bad('sélection « gay »', gays.join(', ') || '(vide)');

// « autre » doit ramasser aussi celles et ceux à qui on n'a jamais posé la
// question : le formulaire court ne la pose pas, et les oublier serait pire
// que de les ranger un peu vite.
await page.goto(`${BASE}/admin?orientation=autre`, { waitUntil: 'networkidle' });
const autres = (await page.locator('.adm-row-name').allInnerTexts()).map((t) => t.trim());
!autres.some((n) => n.includes('Gael')) && autres.some((n) => n.includes('Flore'))
  ? ok('« autre » écarte les gays et garde les fiches sans réponse')
  : bad('sélection « autre »', autres.join(', ') || '(vide)');

const csvGay = lignesCsv(await (await fetch(`${BASE}/api/admin/export?orientation=gay`)).text());
csvGay.length === 2 && csvGay[1].startsWith('G,Gael,M,') && csvGay[1].includes(',gay,')
  ? ok('l’export suit le même filtre, groupe G compris')
  : bad('export par orientation', csvGay.slice(1).join(' | ').slice(0, 140) || '(vide)');

await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ================================================================ */
section('12. Une photo d’iPhone (HEIC)');

await fetch(`${FAKE}/__reset`, { method: 'POST' });

// Chrome ne sait pas décoder le HEIC : si la vignette s'affiche et que le
// fichier déposé est un JPEG, c'est que la conversion a bien eu lieu dans le
// navigateur. Le format par défaut de l'iPhone ne doit jamais atteindre
// l'espace de curation tel quel — personne ne l'y verrait.
await page.goto(`${BASE}/embed/court`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

await page.getByRole('radio', { name: 'Un homme' }).click();
await page.waitForTimeout(600);
await page.fill('#firstName', 'Gaspard');
await page.fill('#lastName', 'IPH');
await page.fill('#email', 'gaspard@example.com');
await page.getByRole('button', { name: 'Suivant' }).click();
await page.waitForTimeout(400);

await page.setInputFiles('input[type=file]', [fixture('photo-iphone.heic')]);
// Le décodeur fait 3 Mo : on lui laisse le temps d'arriver et de travailler.
await page.waitForFunction(() => document.querySelectorAll('.lil-thumb-progress').length === 0, null, {
  timeout: 30000,
}).catch(() => {});

(await page.locator('.lil-thumb-progress').count()) === 0
  ? ok('la photo HEIC est acceptée et envoyée')
  : bad('photo HEIC bloquée', await page.locator('.lil-thumb-progress').first().innerText().catch(() => ''));

const vignetteLisible = await page
  .locator('.lil-thumb img')
  .first()
  .evaluate((el) => el.naturalWidth > 0)
  .catch(() => false);
vignetteLisible
  ? ok('la vignette s’affiche — convertie, elle ne resterait pas vide')
  : bad('vignette illisible : le HEIC n’a pas été converti');

await page.waitForTimeout(11000);
await page.getByRole('button', { name: 'Envoyer ma candidature' }).click();
await page.waitForTimeout(1500);

s = await state();
const deposee = s.storage.find((k) => k.includes('candidatures/'));
deposee?.endsWith('.jpg')
  ? ok(`déposée en JPEG (${deposee.split('/').pop()})`)
  : bad('format déposé', String(deposee));
s.photos[0]?.mime_type === 'image/jpeg'
  ? ok('le journal des photos enregistre bien image/jpeg')
  : bad('mime_type', String(s.photos[0]?.mime_type));

/* ---------------------------------------------------------------- */
section('12 bis. Un HEIC déjà en base reste visible');

// Les candidatures déposées avant cette conversion portent encore des HEIC.
// Le back-office doit les décoder à l'affichage, sinon le curateur juge un
// carré blanc.
const heicBrut = readFileSync(fixture('photo-iphone.heic'));
const idIphone = await (async () => {
  const r = await fetch(`${FAKE}/rest/v1/lil_members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      first_name: 'Ancienne', last_name: 'Photo', email: 'ancienne@example.com',
      gender: 'femme', status: 'nouveau', form_version: 'court',
      consent_at: new Date().toISOString(),
    }),
  });
  return (await r.json())[0].id;
})();

const cheminHeic = `candidatures/${idIphone}/1.heic`;
await fetch(`${FAKE}/storage/v1/object/lil-photos/${cheminHeic}`, {
  method: 'POST',
  headers: { 'Content-Type': 'image/heic' },
  body: heicBrut,
});
await fetch(`${FAKE}/rest/v1/lil_photos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ member_id: idIphone, storage_path: cheminHeic, position: 1, mime_type: 'image/heic' }),
});

await page.goto(`${BASE}/admin/${idIphone}`, { waitUntil: 'networkidle' });
const heicAffiche = await page
  .waitForFunction(() => {
    const img = document.querySelector('.adm-photo');
    return img && img.naturalWidth > 0;
  }, null, { timeout: 30000 })
  .then(() => true)
  .catch(() => false);

heicAffiche
  ? ok('le HEIC déjà stocké est décodé et affiché sur la fiche')
  : bad('photo HEIC invisible dans le back-office');

await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ================================================================ */
section('13. La corbeille');

await fetch(`${FAKE}/__reset`, { method: 'POST' });

const semerCorbeille = async (m) => {
  const r = await fetch(`${FAKE}/rest/v1/lil_members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      gender: 'femme', last_name: 'Essai', status: 'nouveau', form_version: 'complet',
      consent_at: new Date().toISOString(), ...m,
    }),
  });
  return (await r.json())[0].id;
};

const idJetee = await semerCorbeille({ first_name: 'Jetee', email: 'jetee@example.com' });
await semerCorbeille({ first_name: 'Gardee', email: 'gardee@example.com' });

// Une bienvenue programmée doit être arrêtée au passage : une personne
// retirée ne peut pas recevoir un message six heures plus tard.
await fetch(`${BASE}/api/admin/decision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ memberId: idJetee, decision: 'valide' }),
});
await page.waitForTimeout(800);

await page.goto(`${BASE}/admin/${idJetee}`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Mettre à la corbeille' }).click();
await jusqua(async () => {
  const etat = await state();
  return (
    Boolean(etat.members.find((m) => m.id === idJetee)?.deleted_at) &&
    etat.emails.find((e) => e.member_id === idJetee && e.template === '02_bienvenue')?.status ===
      'annule'
  );
});

s = await state();
s.members.find((m) => m.id === idJetee)?.deleted_at
  ? ok('la fiche est datée de sa mise à la corbeille')
  : bad('deleted_at absent');
s.members.find((m) => m.id === idJetee)
  ? ok('la candidature reste en base : rien n’est effacé')
  : bad('la fiche a disparu de la base');
s.emails.find((e) => e.member_id === idJetee && e.template === '02_bienvenue')?.status === 'annule'
  ? ok('la bienvenue en attente est arrêtée')
  : bad('bienvenue non annulée', s.emails.find((e) => e.member_id === idJetee)?.status);

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await jusqua(async () => (await page.locator('.adm-row').count()) === 1);
const restantes = (await page.locator('.adm-row-name').allInnerTexts()).map((t) => t.trim());
restantes.length === 1 && restantes[0].includes('Gardee')
  ? ok('elle a quitté la liste des candidatures')
  : bad('liste après mise à la corbeille', restantes.join(', ') || '(vide)');

const csvApres = (await (await fetch(`${BASE}/api/admin/export`)).text()).trim().split('\n');
csvApres.length === 2 && !csvApres[1].includes('Jetee')
  ? ok('et l’export ne l’emporte plus')
  : bad('export', csvApres.slice(1).map((l) => l.split(',')[1]).join(', '));

await page.goto(`${BASE}/admin/corbeille`, { waitUntil: 'networkidle' });
((await page.locator('.adm-row-name').first().innerText().catch(() => '')) || '').includes('Jetee')
  ? ok('on la retrouve dans la corbeille')
  : bad('corbeille vide');

await page.getByRole('button', { name: 'Restaurer' }).click();
await page.waitForTimeout(1500);
s = await state();
s.members.find((m) => m.id === idJetee)?.deleted_at == null
  ? ok('restaurer la remet parmi les autres')
  : bad('restauration sans effet');

// Effacer pour de bon : deux gestes, et la ligne disparaît vraiment.
await fetch(`${BASE}/api/admin/corbeille`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ memberId: idJetee, action: 'corbeille' }),
});
await page.goto(`${BASE}/admin/corbeille`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Effacer définitivement' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Effacer Jetee/ }).click();
await page.waitForTimeout(1800);

s = await state();
!s.members.some((m) => m.id === idJetee)
  ? ok('l’effacement définitif retire bien la ligne')
  : bad('la fiche est toujours là');

// Une fiche active ne peut pas être effacée d'un seul geste.
const active = s.members.find((m) => m.email === 'gardee@example.com');
const refusEffacement = await (
  await fetch(`${BASE}/api/admin/corbeille`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId: active.id, action: 'effacer' }),
  })
).json();
refusEffacement.error?.includes('corbeille')
  ? ok('effacer une fiche active est refusé : il faut passer par la corbeille')
  : bad('une fiche active a pu être effacée', JSON.stringify(refusEffacement));

await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ================================================================ */
section('14. Depuis la page WordPress : la redirection emporte toute la page');

await fetch(`${FAKE}/__reset`, { method: 'POST' });

// On rejoue la vraie configuration : une page tierce, le widget, l'iframe.
// Sans ça, embed.js — le seul morceau qui tourne réellement chez le client —
// ne serait jamais testé.
const { createServer } = await import('node:http');
const PORT_SITE = 5597;
const PAGE_MERCI = `http://localhost:${PORT_SITE}/merci-wordpress`;

const siteWordpress = createServer(async (req, res) => {
  if (req.url.startsWith('/embed.js')) {
    const js = await fetch(`${BASE}/embed.js`).then((r) => r.text());
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    return res.end(js);
  }
  if (req.url.startsWith('/merci-wordpress')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset="utf-8"><title>Merci</title><h1>Merci WordPress</h1>');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Inscription</title></head><body>
     <div data-lil-form="court" data-lil-app="${BASE}" data-lil-merci="${PAGE_MERCI}" data-min-height="560"></div>
     <script src="/embed.js" async></script></body></html>`,
  );
});
siteWordpress.listen(PORT_SITE);

await page.goto(`http://localhost:${PORT_SITE}/`, { waitUntil: 'networkidle' });
const cadre = page.frameLocator('iframe');

(await page.locator('iframe').count()) === 1
  ? ok('le widget a posé l’iframe sur la page')
  : bad('aucune iframe posée par embed.js');

await cadre.getByRole('radio', { name: 'Une femme' }).click();
await page.waitForTimeout(600);
await cadre.locator('#firstName').fill('Leila');
await cadre.locator('#lastName').fill('Wordpress');
await cadre.locator('#email').fill('leila.wordpress@example.com');
await cadre.getByRole('button', { name: 'Suivant' }).click();
await page.waitForTimeout(500);

await cadre.locator('input[type=file]').setInputFiles(fixture('photo-1.png'));
await page.waitForTimeout(2500);
// Le garde anti-robot du parcours court écarte tout envoi trop rapide.
await page.waitForTimeout(6000);
await cadre.getByRole('button', { name: 'Envoyer ma candidature' }).click();

await page.waitForURL('**/merci-wordpress', { timeout: 15000 }).catch(() => {});
page.url().includes('/merci-wordpress')
  ? ok('la page entière part vers le remerciement, pas seulement l’iframe')
  : bad('la page WordPress n’a pas bougé', page.url());

s = await state();
s.members.some((m) => m.email === 'leila.wordpress@example.com')
  ? ok('et la candidature est bien enregistrée')
  : bad('candidature perdue au passage');

siteWordpress.close();
await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ---------------------------------------------------------------- */
section('15. La reprise des anciennes candidatures');

const POSTE = { apikey: 'cle-de-test', 'Content-Type': 'application/json' };
const poser = (table, corps) =>
  fetch(`${FAKE}/rest/v1/${table}`, { method: 'POST', headers: POSTE, body: JSON.stringify(corps) });

// Deux candidatures du site actuel : la liste doit les garder devant, et la
// dernière arrivée en tête.
await poser('lil_members', [
  {
    first_name: 'Avant',
    last_name: 'Dernier',
    email: 'avant@example.com',
    gender: 'homme',
    status: 'nouveau',
    created_at: '2026-09-20T10:00:00.000Z',
  },
  {
    first_name: 'Nouvelle',
    last_name: 'Venue',
    email: 'nouvelle@example.com',
    gender: 'femme',
    status: 'nouveau',
    created_at: '2026-09-25T10:00:00.000Z',
  },
  // Une ancienne candidature déjà présente en base, sous son identifiant
  // d'origine : le script ne doit pas la réécrire, seulement la marquer.
  {
    id: '55555555-5555-4555-8555-555555555555',
    first_name: 'Adoptee',
    last_name: 'Deja-La',
    email: 'adoptee.ancienne@example.com',
    gender: 'femme',
    city: 'Tourcoing',
    status: 'nouveau',
    soiree_group: 'B',
    admin_notes: 'Une note écrite à la main, qui ne doit pas disparaître.',
    source: 'wordpress:/inscription/',
    created_at: '2026-06-20T12:00:00.000Z',
  },
]);

// Les photos telles qu'elles dorment dans le stockage de l'ancien projet.
for (const nom of ['solene', 'adoptee']) {
  await fetch(`${FAKE}/storage/v1/object/anciennes-photos/ev/${nom}.jpg`, {
    method: 'POST',
    headers: { apikey: 'cle-de-test', 'Content-Type': 'image/jpeg' },
    body: readFileSync(fixture('photo-1.png')),
  });
}

const lancerImport = (...drapeaux) =>
  execFileSync('node', ['scripts/importer-anciennes.mjs', fixture('anciennes.csv'), ...drapeaux], {
    cwd: join(HERE, '..', '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      SUPABASE_URL: FAKE,
      SUPABASE_SERVICE_ROLE_KEY: 'cle-de-test',
      SUPABASE_STORAGE_BUCKET: 'lil-photos',
      ANCIEN_SUPABASE_URL: FAKE,
      ANCIEN_SERVICE_ROLE_KEY: 'cle-de-test',
      ANCIEN_BUCKET: 'anciennes-photos',
    },
  });

// --- L'essai à blanc n'écrit rien ---------------------------------
// Le script colore sa sortie : on la dépouille avant de la lire.
const blanc = lancerImport().replace(/\u001b\[\d+m/g, '');
s = await state();
s.members.length === 3 && s.members.every((m) => !m.legacy)
  ? ok('sans --ecrire, rien n’est écrit ni marqué')
  : bad('l’essai à blanc a touché la base', `${s.members.length} fiches`);
/\n\s*2 à écrire/.test(blanc) &&
/1 déjà en base, à marquer/.test(blanc) &&
/1 laissée telle quelle/.test(blanc) &&
/1 illisible/.test(blanc)
  ? ok('le plan distingue écrire, marquer, laisser et refuser')
  : bad('décompte inattendu', blanc.slice(-600));

// --- Puis l'import pour de vrai -----------------------------------
lancerImport('--ecrire');
s = await state();

const solene = s.members.find((m) => m.email === 'solene.ancienne@example.com');
const marius = s.members.find((m) => m.email === 'marius.ancien@example.com');

solene && marius ? ok('les 2 candidatures reprises sont en base') : bad('candidatures manquantes');
s.members.some((m) => m.email === 'bancale@example.com')
  ? bad('une ligne au genre inconnu est passée')
  : ok('la ligne au genre inconnu est refusée, pas devinée');
s.members.filter((m) => m.email === 'nouvelle@example.com').length === 1
  ? ok('l’adresse déjà en base n’est pas dupliquée')
  : bad('doublon d’email créé');

solene?.legacy === true && solene?.gender === 'femme' && solene?.looking_for === 'relation_serieuse'
  ? ok('le genre et la recherche sont traduits, la fiche est marquée « ancienne »')
  : bad('correspondances fausses', JSON.stringify({ legacy: solene?.legacy, gender: solene?.gender, looking_for: solene?.looking_for }));

solene?.status === 'valide' && marius?.status === 'valide' && solene?.decided_at
  ? ok('les reprises arrivent validées : elles ne sont plus à examiner')
  : bad('statut inattendu', JSON.stringify({ solene: solene?.status, marius: marius?.status }));

solene?.phone === '+33612345678'
  ? ok('le téléphone est normalisé comme à l’inscription (+33…)')
  : bad('téléphone non normalisé', solene?.phone);

solene?.instagram === '@solene.l'
  ? ok('l’URL Instagram est ramenée à un pseudo')
  : bad('instagram non normalisé', solene?.instagram);

solene?.interests_other === 'Lecture, randonnée, théâtre' && Array.isArray(solene?.interests) && solene.interests.length === 0
  ? ok('les centres d’intérêt en texte libre vont dans « autre »')
  : bad('centres d’intérêt mal repris', JSON.stringify(solene?.interests_other));

solene?.last_name === '' && solene?.id === '11111111-1111-4111-8111-111111111111'
  ? ok('le nom de famille reste vide et l’identifiant d’origine est conservé')
  : bad('identité mal reprise', JSON.stringify({ last_name: solene?.last_name, id: solene?.id }));

solene?.soiree_group === 'C' && solene?.created_at.startsWith('2026-06-01')
  ? ok('le groupe et la date d’origine sont conservés')
  : bad('groupe ou date perdus', JSON.stringify({ g: solene?.soiree_group, d: solene?.created_at }));

marius?.comes_with === true && marius?.companion_email === 'paul.ancien@example.com'
  ? ok('l’accompagnant est repris')
  : bad('accompagnant perdu', JSON.stringify(marius?.companion_email));

marius?.about?.includes('chiche') && marius?.about?.includes('Deux lignes')
  ? ok('une réponse à virgules, guillemets et retour à la ligne est lue correctement')
  : bad('le CSV à champs multilignes est mal lu', JSON.stringify(marius?.about));

solene?.comes_with === true && solene?.companion_email === null
  ? ok('un accompagnant nommé sans son adresse est gardé quand même')
  : bad('accompagnant sans email mal repris', JSON.stringify(solene?.companion_email));

// --- La ligne déjà présente est adoptée, pas réécrite ---------------
const adoptee = s.members.find((m) => m.id === '55555555-5555-4555-8555-555555555555');
s.members.filter((m) => m.email === 'adoptee.ancienne@example.com').length === 1
  ? ok('la ligne déjà en base n’est pas dupliquée sous un nouvel identifiant')
  : bad('doublon créé pour une ligne déjà présente');
adoptee?.legacy === true && adoptee?.status === 'valide'
  ? ok('elle est marquée « ancienne » et validée')
  : bad('marquage manqué', JSON.stringify({ legacy: adoptee?.legacy, status: adoptee?.status }));
adoptee?.last_name === 'Deja-La' &&
adoptee?.admin_notes === 'Une note écrite à la main, qui ne doit pas disparaître.' &&
adoptee?.source === 'wordpress:/inscription/'
  ? ok('le reste de sa fiche est intact : le travail fait dessus n’est pas écrasé')
  : bad('fiche écrasée', JSON.stringify({ nom: adoptee?.last_name, notes: adoptee?.admin_notes }));

// --- Les photos ---------------------------------------------------
const photoSolene = s.photos.find((p) => p.member_id === solene?.id);
photoSolene?.storage_path === `candidatures/${solene?.id}/1.jpg`
  ? ok('la photo est rangée sous la candidature, comme à l’inscription')
  : bad('photo mal rangée', JSON.stringify(photoSolene));
s.storage.includes(`candidatures/${solene?.id}/1.jpg`)
  ? ok('et le fichier a bien été déposé dans le stockage')
  : bad('fichier absent du stockage', JSON.stringify(s.storage));
s.photos.some((p) => p.member_id === adoptee?.id)
  ? ok('la ligne adoptée reçoit sa photo elle aussi')
  : bad('photo non rattachée à la ligne adoptée');

// --- Aucun email ne part, malgré le statut « validée » --------------
// C'est le point délicat : valider depuis le back-office programme l'email
// de bienvenue. Écrire le statut en base, non — et ce test le fige.
s.emails.length === 0 && s.sent.length === 0
  ? ok('aucun email n’est programmé ni envoyé, bien que les fiches soient validées')
  : bad('la reprise a écrit dans le journal des emails', `${s.emails.length} / ${s.sent.length}`);

// --- Relancer ne duplique rien ------------------------------------
lancerImport('--ecrire');
s = await state();
s.members.length === 5 && s.photos.length === 2
  ? ok('relancé, l’import ne duplique ni fiche ni photo')
  : bad('la relance a dupliqué', `${s.members.length} fiches, ${s.photos.length} photos`);

// --- L'intertitre dans la liste -----------------------------------
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });

const disposition = await page.evaluate(() =>
  [...(document.querySelector('.adm-list')?.children ?? [])].map((el) =>
    el.classList.contains('adm-separateur')
      ? `— ${el.querySelector('h2')?.textContent?.trim()} —`
      : el.querySelector('.adm-row-name')?.textContent?.trim(),
  ),
);

JSON.stringify(disposition) ===
JSON.stringify([
  'Nouvelle Venue',
  'Avant Dernier',
  '— Anciennes candidatures —',
  'Marius',
  'Adoptee Deja-La',
  'Solène',
])
  ? ok('nouvelles en haut, intertitre, puis anciennes — chaque bloc du plus récent au plus ancien')
  : bad('ordre ou intertitre inattendus', JSON.stringify(disposition));

// Le séparateur ne doit apparaître qu'une fois, même avec plusieurs reprises.
(await page.locator('.adm-separateur').count()) === 1
  ? ok('l’intertitre n’apparaît qu’une fois')
  : bad('intertitre répété');

// --- La fiche dit d'où elle vient ---------------------------------
await page.goto(`${BASE}/admin/${solene.id}`, { waitUntil: 'networkidle' });
(await page.locator('.adm-reprise').count()) === 1 &&
(await page.locator('.adm-reprise').innerText()).includes('question n’a pas été posée')
  ? ok('la fiche explique ses champs vides au lieu de laisser croire à un oubli')
  : bad('la fiche ne signale pas la reprise');

// --- La sortie de secours ----------------------------------------
lancerImport('--defaire', '--ecrire');
s = await state();
const apres = (email) => s.members.find((m) => m.email === email);

apres('solene.ancienne@example.com')?.deleted_at && apres('marius.ancien@example.com')?.deleted_at
  ? ok('--defaire met à la corbeille ce que le script avait écrit')
  : bad('--defaire n’a pas jeté les lignes écrites');

!apres('adoptee.ancienne@example.com')?.deleted_at &&
apres('adoptee.ancienne@example.com')?.legacy === false
  ? ok('mais il se contente de démarquer celle qui existait avant lui, sans la jeter')
  : bad(
      'une ligne préexistante a été jetée',
      JSON.stringify(apres('adoptee.ancienne@example.com')),
    );

s.members.filter((m) => !m.deleted_at).length === 3
  ? ok('les candidatures du site actuel n’ont pas bougé')
  : bad('--defaire a débordé', JSON.stringify(s.members.map((m) => [m.first_name, Boolean(m.deleted_at)])));

await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ---------------------------------------------------------------- */
section('16. Ranger les photos d’une candidature');

// La première photo part partout : dans la liste, et sur le profil que
// verront les participants pendant le crush time. Il faut pouvoir choisir
// laquelle c'est.
const [garance] = await (
  await fetch(`${FAKE}/rest/v1/lil_members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      first_name: 'Garance',
      last_name: 'Photo',
      email: 'garance@example.com',
      gender: 'femme',
      status: 'nouveau',
      consent_at: new Date().toISOString(),
    }),
  })
).json();

const fixtures = ['photo-1.png', 'photo-2.png', 'photo-1.png'];
const posees = [];
for (const [index, nom] of fixtures.entries()) {
  const chemin = `candidatures/${garance.id}/${index + 1}.png`;
  await fetch(`${FAKE}/storage/v1/object/lil-photos/${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: readFileSync(fixture(nom)),
  });
  const [photo] = await (
    await fetch(`${FAKE}/rest/v1/lil_photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        member_id: garance.id,
        storage_path: chemin,
        position: index + 1,
        mime_type: 'image/png',
      }),
    })
  ).json();
  posees.push(photo.id);
}

const positions = async () => {
  const s = await state();
  return s.photos
    .filter((p) => p.member_id === garance.id)
    .sort((a, b) => a.position - b.position)
    .map((p) => posees.indexOf(p.id) + 1);
};

/** Attendre que la base ait vraiment rangé, plutôt que de compter en ms. */
const attendreOrdre = async (attendu) => {
  for (let essai = 0; essai < 40; essai += 1) {
    if (JSON.stringify(await positions()) === JSON.stringify(attendu)) return true;
    await page.waitForTimeout(150);
  }
  return false;
};

/** Ce que donne « amener la troisième en tête » sur l'ordre actuel. */
const troisiemeDevant = (avant) => [avant[2], avant[0], avant[1]];

await page.goto(`${BASE}/admin/${garance.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

(await page.locator('.adm-photo-case').count()) === 3
  ? ok('les trois photos sont rangeables')
  : bad('cases de photo manquantes', String(await page.locator('.adm-photo-case').count()));

(await page.locator('.adm-photo-case[data-rang="premiere"] .adm-photo-rang').innerText())
  .toLowerCase()
  .includes('profil')
  ? ok('la première porte sa marque : c’est elle qu’on verra au crush time')
  : bad('la photo de profil n’est pas signalée');

// --- Le bouton, celui qui marche au doigt -------------------------
// Chaque étape part de l'ordre qu'elle trouve : sans cela, un échec en
// entraînerait un autre et on chercherait deux défauts là où il n'y en a
// qu'un.
const avantBouton = await positions();
await page.locator('.adm-photo-case').nth(2).locator('.adm-photo-premier').click();

(await attendreOrdre(troisiemeDevant(avantBouton)))
  ? ok('« Mettre en premier » amène la troisième photo en tête')
  : bad('ordre inattendu après le bouton', JSON.stringify(await positions()));

// --- Le glissé-déposé ---------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const avantGlisse = await positions();

// Deux vérifications, parce qu'un navigateur piloté ne sait pas déclencher
// un vrai glissé HTML5 à la souris : d'abord que la case est réellement
// attrapable, ensuite que la séquence d'événements range bien les photos.
const cases = page.locator('.adm-photo-case');
(await cases.nth(2).getAttribute('draggable')) === 'true' &&
(await cases.nth(2).locator('img').getAttribute('draggable')) === 'false'
  ? ok('la case s’attrape, et l’image ne vole pas le geste')
  : bad('la case n’est pas déplaçable');

await page.evaluate(() => {
  const toutes = document.querySelectorAll('.adm-photo-case');
  // Un seul DataTransfer traverse la séquence, comme dans un vrai glissé :
  // c'est lui qui porte le rang de la case attrapée.
  const dt = new DataTransfer();
  const evenement = (nom) =>
    new DragEvent(nom, { dataTransfer: dt, bubbles: true, cancelable: true });
  toutes[2].dispatchEvent(evenement('dragstart'));
  toutes[0].dispatchEvent(evenement('dragover'));
  toutes[0].dispatchEvent(evenement('drop'));
  toutes[2].dispatchEvent(evenement('dragend'));
});

(await attendreOrdre(troisiemeDevant(avantGlisse)))
  ? ok('glisser la dernière sur la première les range aussi')
  : bad('ordre inattendu après le glissé', JSON.stringify(await positions()));

// --- Ce que la liste affiche --------------------------------------
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const vignetteListe = await page
  .locator('.adm-row', { hasText: 'Garance' })
  .locator('.adm-avatar')
  .getAttribute('src');

// Quelle qu'elle soit, la vignette doit être celle qui occupe la position 1.
const enTete = (await state()).photos
  .filter((p) => p.member_id === garance.id)
  .sort((a, b) => a.position - b.position)[0];

vignetteListe === `/admin/photo/${enTete.id}`
  ? ok('la liste suit : c’est la photo choisie qui sert de vignette')
  : bad('la vignette ne suit pas l’ordre', String(vignetteListe));

// --- Une photo qui n'est pas à soi --------------------------------
const intrusion = await fetch(`${BASE}/api/admin/photos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ memberId: garance.id, ordre: [posees[0], '11111111-2222-4333-8444-555555555555'] }),
});
intrusion.status >= 400
  ? ok('une photo qui n’appartient pas à la candidature est refusée')
  : bad('on peut déplacer la photo de quelqu’un d’autre', String(intrusion.status));

await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ---------------------------------------------------------------- */
section('17. Composer une soirée');

const invites = [
  ['Inès', 'femme', 'C'],
  ['Camille', 'femme', 'A'],
  ['Samir', 'homme', 'A'],
  ['Thomas', 'homme', 'B'],
];
const fiches = await (
  await fetch(`${FAKE}/rest/v1/lil_members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(
      invites.map(([prenom, genre, groupe]) => ({
        first_name: prenom,
        last_name: 'Invité',
        email: `${prenom.toLowerCase()}.invite@example.com`,
        gender: genre,
        orientation: 'hetero',
        city: 'Lille',
        birth_date: '1994-01-01',
        soiree_group: groupe,
        status: 'valide',
        consent_at: new Date().toISOString(),
      })),
    ),
  })
).json();

const [soireeC] = await (
  await fetch(`${FAKE}/rest/v1/lil_soirees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      nom: 'Soirée à composer',
      age_min: 26,
      age_max: 36,
      date_soiree: '2026-10-18',
      lieu: 'Un lieu, Lille',
      publiee_at: new Date().toISOString(),
    }),
  })
).json();

await page.goto(`${BASE}/admin/soirees/${soireeC.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

(await page.locator('.adm-choix-ligne').count()) === invites.length
  ? ok('les candidatures s’offrent à être cochées')
  : bad('liste à cocher incomplète', String(await page.locator('.adm-choix-ligne').count()));

// --- Le filtre par groupe ------------------------------------------
await page.locator('.adm-tri-cases label[data-groupe="A"] input').check();
await page.waitForTimeout(300);
(await page.locator('.adm-choix-ligne').count()) === 2
  ? ok('le filtre par groupe restreint la liste')
  : bad('le filtre de groupe ne filtre pas', String(await page.locator('.adm-choix-ligne').count()));

// Deux groupes à la fois : c'est le propre des cases.
await page.locator('.adm-tri-cases label[data-groupe="C"] input').check();
await page.waitForTimeout(300);
(await page.locator('.adm-choix-ligne').count()) === 3
  ? ok('cocher un second groupe élargit la liste')
  : bad('les groupes ne se cumulent pas', String(await page.locator('.adm-choix-ligne').count()));

await page.locator('.adm-tri-cases label[data-groupe="C"] input').uncheck();
await page.waitForTimeout(300);

// « Tout cocher » ne doit prendre que ce que le filtre laisse voir.
await page.getByRole('button', { name: 'Tout cocher' }).click();
await page.waitForTimeout(300);
(await page.locator('.adm-choix-pied strong').innerText()) === '2'
  ? ok('« tout cocher » s’arrête à ce que le filtre montre')
  : bad('tout cocher déborde du filtre', await page.locator('.adm-choix-pied').innerText());

// --- L'équilibre, sous les yeux -------------------------------------
await page.locator('.adm-tri-cases label[data-groupe="A"] input').uncheck();
await page.waitForTimeout(300);
await page.locator('.adm-choix-ligne', { hasText: 'Inès' }).locator('input').check();

(await page.locator('.adm-choix-pied').innerText()).includes('2 femmes · 1 homme')
  ? ok('le compte femmes / hommes suit chaque case cochée')
  : bad('équilibre non affiché', await page.locator('.adm-choix-pied').innerText());

// --- Créer -----------------------------------------------------------
await page.getByRole('button', { name: 'Créer le crush time' }).click();
await jusqua(async () => {
  const etat = await state();
  return (
    etat.crushParticipants.filter((p) => p.soiree_id === soireeC.id).length === 3 &&
    etat.crushRounds.filter((r) => r.soiree_id === soireeC.id).length === 3
  );
});

s = await state();
const inscrits = s.crushParticipants.filter((p) => p.soiree_id === soireeC.id);
inscrits.length === 3
  ? ok('les 3 personnes cochées sont inscrites à la soirée')
  : bad('inscriptions inattendues', String(inscrits.length));

inscrits.every((p) => p.member_id && p.gender && p.jeton)
  ? ok('chacune arrive avec son profil et son jeton d’accès')
  : bad('participant incomplet', JSON.stringify(inscrits[0]));

new Set(inscrits.map((p) => p.jeton)).size === inscrits.length
  ? ok('les jetons sont tous différents')
  : bad('deux participants partagent un jeton');

s.crushRounds.filter((r) => r.soiree_id === soireeC.id).length === 3
  ? ok('les trois manches sont posées')
  : bad('manches manquantes');

// --- Ajouter après coup ---------------------------------------------
await page.waitForTimeout(400);
(await page.locator('.adm-ajout').count()) === 1
  ? ok('on peut encore ajouter quelqu’un après la création')
  : bad('pas de porte pour un billet de dernière minute');

await page.locator('.adm-ajout summary').click();
await page.waitForTimeout(400);
(await page.locator('.adm-choix-ligne[data-deja]').count()) === 3
  ? ok('celles déjà de la soirée sont montrées, mais pas recochables')
  : bad('les inscrites ne sont pas signalées', String(await page.locator('.adm-choix-ligne[data-deja]').count()));

const jetonsAvant = new Map(inscrits.map((p) => [p.email, p.jeton]));
await page.locator('.adm-choix-ligne:not([data-deja])').first().locator('input').check();
await page.getByRole('button', { name: 'Ajouter à la soirée' }).click();
await jusqua(
  async () =>
    (await state()).crushParticipants.filter((p) => p.soiree_id === soireeC.id).length === 4,
);

s = await state();
const apresAjout = s.crushParticipants.filter((p) => p.soiree_id === soireeC.id);
apresAjout.length === 4
  ? ok('la quatrième personne rejoint la soirée')
  : bad('ajout raté', String(apresAjout.length));

apresAjout.every((p) => !jetonsAvant.has(p.email) || jetonsAvant.get(p.email) === p.jeton)
  ? ok('et les jetons déjà distribués ne changent pas — les liens envoyés restent valables')
  : bad('un jeton a changé : le lien déjà envoyé ne marche plus');

// --- Quelqu'un qui n'est dans aucune liste --------------------------
await page.getByRole('tab', { name: 'À la main' }).click();
await page.waitForTimeout(300);
(await page.locator('.adm-depot').count()) === 0
  ? ok('le dépôt de fichier disparaît sous l’onglet « à la main »')
  : bad('le volet CSV reste affiché sous un autre onglet');

await page.fill('#main-email', 'organisateur@in-love.fr');
await page.fill('#main-prenom', 'Rachid');
await page.selectOption('#main-genre', 'homme');
await page.getByRole('button', { name: 'Ajouter cette personne' }).click();
await jusqua(async () =>
  (await state()).crushParticipants.some((p) => p.email === 'organisateur@in-love.fr'),
);

s = await state();
const ajoutMain = s.crushParticipants.find((p) => p.email === 'organisateur@in-love.fr');
ajoutMain?.gender === 'homme' && ajoutMain?.first_name === 'Rachid' && ajoutMain?.jeton
  ? ok('une personne absente de la billetterie et des candidatures peut être ajoutée')
  : bad('ajout à la main raté', JSON.stringify(ajoutMain));

// --- Son lien personnel, affiché pour qu'on puisse l'envoyer --------
await page.waitForTimeout(400);
const lienAffiche = await page
  .locator('.adm-present', { hasText: 'Rachid' })
  .locator('button', { hasText: 'Lien' })
  .getAttribute('title');
lienAffiche?.endsWith(`/crush/c/${ajoutMain.jeton}`)
  ? ok('le tableau de bord donne son lien personnel, prêt à envoyer')
  : bad('lien personnel absent du tableau de bord', String(lienAffiche));

await fetch(`${FAKE}/__reset`, { method: 'POST' });

/* ---------------------------------------------------------------- */
section('18. Le crush time, côté participant');

const [soireeCrush] = await (
  await fetch(`${FAKE}/rest/v1/lil_soirees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      nom: 'Soirée du crush time',
      age_min: 26,
      age_max: 36,
      date_soiree: '2026-10-18',
      lieu: 'Un lieu, Lille',
      publiee_at: new Date().toISOString(),
      crush_code: '4812',
      crush_actif: true,
    }),
  })
).json();

// Samir est rattaché à une candidature : c'est elle qui porte sa ville et
// sa présentation, et c'est le cas courant.
const [ficheSamir] = await (
  await fetch(`${FAKE}/rest/v1/lil_members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      first_name: 'Samir',
      last_name: 'Crush',
      email: 'samir@soiree.test',
      gender: 'homme',
      orientation: 'hetero',
      city: 'Roubaix',
      profession: 'Chef de projet',
      about:
        'Une présentation volontairement très longue, qui dépasse de loin ce qu’on lit debout au milieu d’une soirée bruyante, et qui doit donc se faire couper quelque part avant la fin de cette phrase interminable.',
      status: 'valide',
      consent_at: new Date().toISOString(),
    }),
  })
).json();

const salle = [
  ['Inès', 'femme', 'ines'],
  ['Salomé', 'femme', 'salome'],
  ['Samir', 'homme', 'samir'],
  ['Thomas', 'homme', 'thomas'],
];
const presents = await (
  await fetch(`${FAKE}/rest/v1/lil_crush_participants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(
      salle.map(([prenom, genre, jeton]) => ({
        soiree_id: soireeCrush.id,
        member_id: prenom === 'Samir' ? ficheSamir.id : null,
        email: `${jeton}@soiree.test`,
        first_name: prenom,
        gender: genre,
        orientation: 'hetero',
        birth_date: '1994-01-01',
        jeton,
      })),
    ),
  })
).json();
const qui = Object.fromEntries(presents.map((p) => [p.first_name, p]));

const [manche1] = await (
  await fetch(`${FAKE}/rest/v1/lil_crush_rounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      soiree_id: soireeCrush.id,
      numero: 1,
      prevu_a: new Date().toISOString(),
      ouvert_at: new Date().toISOString(),
    }),
  })
).json();

const tel = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
tel.on('pageerror', (e) => bad('erreur JS (crush)', e.message));

// --- Entrer par le code annoncé dans la salle ----------------------
await tel.goto(`${BASE}/crush`, { waitUntil: 'networkidle' });
await tel.fill('#cr-email', 'ines@soiree.test');
await tel.fill('#cr-code', '1234');
await tel.getByRole('button', { name: 'Entrer' }).click();
await tel.waitForTimeout(900);
(await tel.locator('.cr-erreur').innerText().catch(() => '')).includes('incorrect')
  ? ok('un mauvais code est refusé, sans dire laquelle des deux moitiés est fausse')
  : bad('mauvais code accepté');

await tel.fill('#cr-code', '4812');
await tel.getByRole('button', { name: 'Entrer' }).click();
await tel.waitForTimeout(1800);

// --- Qui on voit ---------------------------------------------------
const vus = (await tel.locator('.cr-carte-nom').allInnerTexts()).map((t) => t.split(' ·')[0].trim());
JSON.stringify(vus.sort()) === JSON.stringify(['Samir', 'Thomas'])
  ? ok('une femme hétéro ne voit que les hommes de la soirée')
  : bad('profils inattendus', vus.join(', ') || '(aucun)');

(await tel.locator('.cr-grille')).isVisible() &&
(await tel.locator('.cr-grille').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)) === 2
  ? ok('les profils s’affichent deux par rangée')
  : bad('la grille n’a pas deux colonnes');

// --- Ce que montre le profil ouvert --------------------------------
await tel.locator('.cr-carte', { hasText: 'Samir' }).locator('.cr-carte-ouvrir').click();
await tel.waitForTimeout(500);
const fichePubliee = await tel.locator('.cr-fiche').innerText();
fichePubliee.includes('Chef de projet') && fichePubliee.includes('Roubaix')
  ? ok('le profil ouvert donne le métier et la ville')
  : bad('métier ou ville absents', fichePubliee.replace(/\n+/g, ' | '));

const presentation = await tel.locator('.cr-fiche-mot').innerText();
presentation.length <= 145 && presentation.endsWith('…')
  ? ok('une longue présentation est coupée : personne ne lit dix lignes debout')
  : bad('présentation non raccourcie', `${presentation.length} caractères`);
await tel.locator('.cr-fermer').click();
await tel.waitForTimeout(400);

// --- Le cœur de la carte, sans ouvrir le profil --------------------
(await tel.locator('.cr-matchs-onglet').count()) === 1 &&
(await tel.locator('.cr-entete .cr-matchs-onglet').count()) === 1
  ? ok('« Mes matchs » est en haut, dans l’en-tête')
  : bad('le bouton des matchs n’est pas dans l’en-tête');

await tel.locator('.cr-carte', { hasText: 'Samir' }).locator('.cr-coeur-carte').click();
await tel.waitForTimeout(500);
(await tel.locator('.cr-confirme').count()) === 1 && (await tel.locator('.cr-fiche-mot').count()) === 0
  ? ok('le cœur de la carte mène droit à la confirmation, sans passer par le profil')
  : bad('le cœur de la carte n’ouvre pas la confirmation');
await tel.getByRole('button', { name: 'Revenir' }).click();
await tel.waitForTimeout(300);

// --- Liker, avec confirmation --------------------------------------
await tel.locator('.cr-carte', { hasText: 'Samir' }).click();
await tel.waitForTimeout(500);
await tel.getByRole('button', { name: /Je choisis/ }).click();
await tel.waitForTimeout(400);
(await tel.locator('.cr-confirme').innerText()).includes('ne se reprend pas')
  ? ok('un geste irréversible demande confirmation')
  : bad('pas de confirmation avant le like');

await tel.getByRole('button', { name: /^Oui/ }).click();
await jusqua(async () => (await state()).crushLikes.length > 0);

s = await state();
s.crushLikes.filter((l) => l.de_id === qui['Inès'].id).length === 1
  ? ok('le like est enregistré, une seule fois')
  : bad('like non enregistré', String(s.crushLikes.length));
s.crushMatches.length === 0
  ? ok('aucun match tant que l’autre n’a pas choisi')
  : bad('match créé à sens unique');

// --- Un second like est refusé -------------------------------------
await tel.locator('.cr-carte', { hasText: 'Thomas' }).click();
await tel.waitForTimeout(500);
(await tel.locator('.cr-fiche-etat').innerText().catch(() => '')).includes('déjà fait')
  ? ok('le second choix de la manche n’est même pas proposé')
  : bad('on peut liker deux fois dans une manche');

const secondLike = await tel.evaluate(async (versId) => {
  const r = await fetch('/api/crush/liker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versId }),
  });
  return r.status;
}, qui['Thomas'].id);
secondLike === 409
  ? ok('et la base le refuse aussi quand on contourne l’écran')
  : bad('un second like est passé par l’API', String(secondLike));

// --- Le match, des deux côtés --------------------------------------
const tel2 = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await tel2.goto(`${BASE}/crush/c/samir`, { waitUntil: 'networkidle' });
await tel2.waitForTimeout(1200);
!tel2.url().includes('/c/samir')
  ? ok('le lien personnel échange son jeton contre une session et disparaît de l’adresse')
  : bad('le jeton reste dans la barre d’adresse', tel2.url());

await tel2.locator('.cr-carte', { hasText: 'Inès' }).click();
await tel2.waitForTimeout(500);
await tel2.getByRole('button', { name: /Je choisis/ }).click();
await tel2.waitForTimeout(400);
await tel2.getByRole('button', { name: /^Oui/ }).click();
await jusqua(async () => (await state()).crushMatches.length === 1);

(await tel2.locator('.cr-match-mot').innerText().catch(() => ''))
  .includes('match')
  ? ok('le match s’annonce tout de suite à celui qui ferme la boucle')
  : bad('aucun match annoncé');

s = await state();
s.crushMatches.length === 1
  ? ok('un seul match en base pour la paire')
  : bad('nombre de matchs inattendu', String(s.crushMatches.length));
s.crushMatches[0].a_id < s.crushMatches[0].b_id
  ? ok('la paire est rangée : deux clics simultanés ne peuvent pas la dédoubler')
  : bad('paire non ordonnée');

// --- Le contact, seulement après le match --------------------------
await tel2.getByRole('button', { name: 'Continuer' }).click();
await tel2.waitForTimeout(600);
await tel2.locator('.cr-matchs-onglet').click();
await tel2.waitForTimeout(600);
(await tel2.locator('.cr-matchs-corps').innerText()).includes('ines@soiree.test')
  ? ok('l’adresse de la personne n’apparaît qu’une fois le match fait')
  : bad('contact absent de l’onglet matchs');

const htmlProfils = await tel.content();
!htmlProfils.includes('samir@soiree.test')
  ? ok('et jamais dans la page des profils, où elle court-circuiterait le jeu')
  : bad('une adresse email fuite dans la liste des profils');

// --- La photo de quelqu'un d'une autre soirée est refusée ----------
const [intruse] = await (
  await fetch(`${FAKE}/rest/v1/lil_photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      member_id: '99999999-9999-4999-8999-999999999999',
      storage_path: 'candidatures/ailleurs/1.png',
      position: 1,
      mime_type: 'image/png',
    }),
  })
).json();
const volee = await tel.evaluate(async (id) => (await fetch(`/crush/photo/${id}`)).status, intruse.id);
volee === 404
  ? ok('la photo de quelqu’un qui n’est pas de la soirée est introuvable')
  : bad('on peut parcourir les photos de toute la base', String(volee));

// --- Hors manche ----------------------------------------------------
await fetch(`${FAKE}/rest/v1/lil_crush_rounds?id=eq.${manche1.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ferme_at: new Date().toISOString() }),
});
await tel.goto(`${BASE}/crush`, { waitUntil: 'networkidle' });
await tel.waitForTimeout(800);
(await tel.locator('.cr-attente').count()) === 1 && (await tel.locator('.cr-carte').count()) === 0
  ? ok('manche fermée : les profils disparaissent, les horaires restent')
  : bad('les profils restent visibles hors manche');

await tel.close();
await tel2.close();
await fetch(`${FAKE}/__reset`, { method: 'POST' });

await browser.close();
console.log('\n' + (failures.length === 0
  ? '[32mTout est vert.[0m'
  : `[31m${failures.length} échec(s) :[0m ` + failures.join(' | ')));
process.exit(failures.length === 0 ? 0 : 1);
