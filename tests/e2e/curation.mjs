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

const avatarOk = await page.locator('.adm-avatar').first().evaluate(
  (el) => el.tagName === 'IMG' && el.naturalWidth > 0,
).catch(() => false);
avatarOk ? ok('la vignette photo se charge (URL signée)') : bad('vignette non chargée');

await page.locator('.adm-row').first().click();
await page.waitForLoadState('networkidle');

const fiche = await page.locator('.adm-name').innerText();
fiche.includes('Camille') ? ok('fiche ouverte') : bad('fiche non ouverte', fiche);

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
await page.waitForTimeout(900);

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

await page.selectOption('.adm-panneau select[name="groupe"]', 'C');
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

await page.selectOption('.adm-panneau select[name="groupe"]', 'tous');
await page.waitForTimeout(300);
((await page.locator('.adm-btn-appliquer').innerText().catch(() => '')) || '').includes('Voir 3 fiches')
  ? ok('changer un critère recompte aussitôt, sans valider')
  : bad('compteur figé', await page.locator('.adm-btn-appliquer').innerText().catch(() => ''));

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
await page.waitForTimeout(1500);
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

await browser.close();
console.log('\n' + (failures.length === 0
  ? '[32mTout est vert.[0m'
  : `[31m${failures.length} échec(s) :[0m ` + failures.join(' | ')));
process.exit(failures.length === 0 ? 0 : 1);
