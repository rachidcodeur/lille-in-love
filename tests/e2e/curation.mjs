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

const mail01 = s.sent.find((m) => m.subject?.startsWith('Inscription'));
mail01 ? ok(`email 01 envoyé — objet « ${mail01.subject} »`) : bad('email 01 non envoyé');
mail01?.to === 'camille.dupont@example.com' ? ok('adressé à la bonne personne') : bad('destinataire', mail01?.to);
mail01?.text?.length > 100 ? ok('version texte présente (bon pour l’anti-spam)') : bad('version texte absente');
!mail01?.scheduled_at ? ok('envoyé immédiatement, sans délai') : bad('email 01 différé à tort');

/* ================================================================ */
section('3. Le back-office');

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
const rows = await page.locator('.adm-row').count();
rows === 1 ? ok('la candidature apparaît dans « À examiner »') : bad('lignes affichées', String(rows));

const rowText = await page.locator('.adm-row').first().innerText();
rowText.includes('Camille Dupont') ? ok('nom affiché') : bad('nom absent', rowText);
rowText.toLowerCase().includes('court') ? ok('marquée « court »') : bad('marqueur court absent');

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

const mailsShown = await page.locator('.adm-mail').count();
mailsShown === 1 ? ok('le journal des emails montre l’envoi 01') : bad('journal des emails', String(mailsShown));

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

const feedback = await page.locator('.adm-feedback').innerText().catch(() => '');
/partira .+ à \d{2}:\d{2}/.test(feedback) && feedback.includes('Bienvenue')
  ? ok(`retour à l’écran : « ${feedback} »`)
  : bad('pas de confirmation lisible', feedback);

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
section('5. Refus après validation : la bienvenue est rattrapée, rien d’autre ne part');

const envoisAvantRefus = s.sent.length;
await page.getByRole('button', { name: /Refuser/ }).click();
await page.waitForTimeout(2000);

s = await state();
const after = s.members[0];
after.status === 'non_retenu' ? ok('statut passé à « non retenue »') : bad('statut', after.status);

s.cancelled.length === 1 ? ok('l’email de bienvenue a été annulé chez Resend') : bad('annulation manquante', JSON.stringify(s.cancelled));
const log02b = s.emails.find((e) => e.template === '02_bienvenue');
log02b?.status === 'annule' ? ok('journal mis à jour en « annulé »') : bad('journal non annulé', log02b?.status);

s.sent.length === envoisAvantRefus
  ? ok('aucun « On reviendra vers toi » envoyé au refus : il attend une soirée')
  : bad('un email est parti au refus', s.sent.slice(envoisAvantRefus).map((m) => m.subject).join(', '));
((await page.locator('.adm-feedback').innerText().catch(() => '')) || '').includes('prochaine soirée')
  ? ok('le curateur sait que la réponse partira avec la prochaine soirée')
  : bad('message sur la prochaine soirée absent');

/* ---------------------------------------------------------------- */
section('5 bis. Refus puis validation : la bienvenue est reprogrammée');

await page.getByRole('button', { name: /Valider/ }).click();
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
section('5 ter. Même décision cliquée deux fois : rien ne bouge');

const avantDouble = s.emails.find((e) => e.template === '02_bienvenue' && e.status === 'programme');
const envoisAvant = s.sent.length;
await page.getByRole('button', { name: /Valider/ }).click();
await page.waitForTimeout(1800);
s = await state();
const apresDouble = s.emails.find((e) => e.template === '02_bienvenue' && e.status === 'programme');

s.sent.length === envoisAvant
  ? ok('aucun email supplémentaire confié à Resend')
  : bad('un doublon a été envoyé');
apresDouble?.scheduled_at === avantDouble?.scheduled_at
  ? ok('l’heure d’envoi reste 24 h après la première décision')
  : bad('heure d’envoi décalée', `${avantDouble?.scheduled_at} → ${apresDouble?.scheduled_at}`);
((await page.locator('.adm-feedback').innerText().catch(() => '')) || '').includes('Déjà retenu')
  ? ok('le curateur est prévenu que c’était déjà fait')
  : bad('message « déjà retenu » absent');

/* ================================================================ */
section('5 quater. Publier une soirée : qui reçoit quoi');

await fetch(`${FAKE}/__reset`, { method: 'POST' });

// On sème des membres directement dans le faux Supabase : il faut des dates
// de naissance, que le formulaire court ne demande pas.
const JOUR = '2026-10-17';
const semer = async (m) => {
  const r = await fetch(`${FAKE}/rest/v1/lil_members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ gender: 'femme', last_name: 'Essai', consent_at: new Date().toISOString(), form_version: 'complet', ...m }),
  });
  return (await r.json())[0].id;
};

const idRefusee = await semer({ first_name: 'Refusee', email: 'refusee@example.com', status: 'non_retenu', birth_date: '1990-01-01' });
const idDedans = await semer({ first_name: 'Dedans', email: 'dedans@example.com', status: 'valide', birth_date: '1995-03-01' });
const idTropJeune = await semer({ first_name: 'TropJeune', email: 'jeune@example.com', status: 'valide', birth_date: '2002-06-01' });
// 27 ans le jour même de la soirée : dans la tranche, pas en dehors.
const idAnniv = await semer({ first_name: 'Anniversaire', email: 'anniv@example.com', status: 'valide', birth_date: '1999-10-17' });
// 26 ans la veille de ses 27 ans : encore hors tranche.
const idVeille = await semer({ first_name: 'Veille', email: 'veille@example.com', status: 'valide', birth_date: '1999-10-18' });
const idSansAge = await semer({ first_name: 'SansAge', email: 'sansage@example.com', status: 'valide', form_version: 'court' });
const idNouveau = await semer({ first_name: 'PasEncoreVu', email: 'nouveau@example.com', status: 'nouveau', birth_date: '1980-01-01' });

await page.goto(`${BASE}/admin/soirees`, { waitUntil: 'networkidle' });
const saisir = async (id, valeur) => {
  await page.fill(`#soiree-${id}`, valeur);
};
await saisir('nom', 'Soirée test');
await saisir('ageMin', '27');
await saisir('ageMax', '35');
await saisir('date', JOUR);
await saisir('heure', '20:00');
await saisir('lieu', 'Lille');

// Un champ qui perd le focus à chaque frappe se voit tout de suite ici.
(await page.inputValue('#soiree-nom')) === 'Soirée test'
  ? ok('le formulaire se remplit normalement')
  : bad('saisie perdue', await page.inputValue('#soiree-nom'));

await page.getByRole('button', { name: 'Voir qui sera prévenu' }).click();
await page.waitForTimeout(1500);

const groupes = await page.locator('.adm-groupe summary').allInnerTexts();
const nombre = (motif) => {
  const g = groupes.find((t) => t.includes(motif));
  return g ? Number(g.trim().split(/\s+/)[0]) : null;
};
nombre('(03)') === 1 ? ok('aperçu : 1 personne recevra le 03') : bad('aperçu 03', String(nombre('(03)')));
nombre('(04)') === 2 ? ok('aperçu : 2 recevront le 04 (trop jeune, et la veille de ses 27 ans)') : bad('aperçu 04', String(nombre('(04)')));
nombre('ont l’âge') === 2 ? ok('aperçu : 2 dans la tranche, dont celle qui a 27 ans le jour même') : bad('aperçu dans la tranche', String(nombre('ont l’âge')));
nombre('âge inconnu') === 1 ? ok('aperçu : 1 validé sans date de naissance, signalé') : bad('aperçu âge inconnu', String(nombre('âge inconnu')));

s = await state();
s.sent.length === 0 && s.soirees.length === 0
  ? ok('l’aperçu n’a rien envoyé ni enregistré')
  : bad('l’aperçu a eu des effets', `${s.sent.length} email(s), ${s.soirees.length} soirée(s)`);

// Modifier un champ doit invalider l'aperçu.
await saisir('ageMax', '40');
(await page.getByRole('button', { name: /Publier/ }).count()) === 0
  ? ok('changer la classe d’âge efface l’aperçu : on ne confirme jamais sur des chiffres périmés')
  : bad('le bouton Publier reste disponible après modification');
await saisir('ageMax', '35');
await page.getByRole('button', { name: 'Voir qui sera prévenu' }).click();
await page.waitForTimeout(1500);

await page.getByRole('button', { name: /Publier et envoyer 3 emails/ }).click();
await page.waitForTimeout(2500);

s = await state();
const recu = (email) => s.sent.filter((m) => m.to === email).map((m) => m.subject);

s.soirees.length === 1 ? ok('la soirée est enregistrée') : bad('soirées en base', String(s.soirees.length));
recu('refusee@example.com').some((x) => x.startsWith('Candidature'))
  ? ok('la personne non retenue reçoit le 03')
  : bad('03 manquant', JSON.stringify(recu('refusee@example.com')));
recu('jeune@example.com').some((x) => x.startsWith('Inscription,'))
  ? ok('la personne trop jeune reçoit le 04')
  : bad('04 manquant', JSON.stringify(recu('jeune@example.com')));
const mail04 = s.sent.find((m) => m.to === 'jeune@example.com');
mail04?.html?.includes('27-35')
  ? ok('le 04 cite la classe d’âge de la soirée (27-35)')
  : bad('classe d’âge absente du 04');
recu('dedans@example.com').length === 0 && recu('anniv@example.com').length === 0
  ? ok('les validés dans la tranche ne reçoivent rien')
  : bad('un validé dans la tranche a reçu un email');
recu('sansage@example.com').length === 0
  ? ok('le validé sans date de naissance ne reçoit rien')
  : bad('email envoyé sans connaître l’âge');
recu('nouveau@example.com').length === 0
  ? ok('une candidature pas encore examinée ne reçoit rien')
  : bad('un profil non examiné a reçu un refus');
s.sent.every((m) => m.lot)
  ? ok('envoyés par lot, pas un appel par email')
  : bad('envois individuels détectés');

const liens = s.emails.filter((e) => e.soiree_id === s.soirees[0].id);
liens.length === 3 && liens.every((e) => e.status === 'envoye' && e.resend_id)
  ? ok('chaque envoi est journalisé avec sa soirée et son identifiant Resend')
  : bad('journal incomplet', JSON.stringify(liens.map((e) => [e.template, e.status, Boolean(e.resend_id)])));

const bilan = s.soirees[0].bilan;
bilan && bilan['03'] === 1 && bilan['04'] === 2 && bilan.dans_la_tranche === 2 && bilan.age_inconnu === 1
  ? ok('le bilan de la soirée est enregistré')
  : bad('bilan', JSON.stringify(bilan));
((await page.locator('.adm-feedback').innerText().catch(() => '')) || '').includes('Soirée publiée')
  ? ok('le curateur voit le résultat de la publication')
  : bad('pas de confirmation de publication');

/* ---------------------------------------------------------------- */
section('5 quinquies. Seconde soirée : personne n’est prévenu deux fois');

const envoisAvantSeconde = s.sent.length;
const pub2 = await (
  await fetch(`${BASE}/api/admin/soirees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'Seconde', ageMin: 27, ageMax: 35, date: JOUR, lieu: 'Lille' }),
  })
).json();

s = await state();
s.sent.length === envoisAvantSeconde
  ? ok('aucun nouvel email : 03 et 04 déjà reçus')
  : bad('doublons envoyés', s.sent.slice(envoisAvantSeconde).map((m) => m.to).join(', '));
pub2.bilan?.deja_prevenus === 3
  ? ok('le bilan compte 3 personnes déjà prévenues')
  : bad('déjà prévenus', JSON.stringify(pub2.bilan));

/* ---------------------------------------------------------------- */
section('5 sexies. Si Resend refuse le lot, rien n’est perdu en silence');

await semer({ first_name: 'Nouvelle', email: 'nouvelle-refusee@example.com', status: 'non_retenu', birth_date: '1990-01-01' });
await fetch(`${FAKE}/__refuse-batch?on=1`, { method: 'POST' });
const pub3 = await (
  await fetch(`${BASE}/api/admin/soirees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'Troisième', ageMin: 27, ageMax: 35, date: JOUR, lieu: 'Lille' }),
  })
).json();
await fetch(`${FAKE}/__refuse-batch?on=0`, { method: 'POST' });

pub3.bilan?.echecs === 1
  ? ok('l’échec est compté dans le bilan')
  : bad('échec non compté', JSON.stringify(pub3.bilan));
s = await state();
const ligneEchec = s.emails.find((e) => e.to_email === 'nouvelle-refusee@example.com');
ligneEchec?.status === 'echec' && ligneEchec?.error
  ? ok('la ligne est marquée « échec » avec sa raison, visible sur la fiche')
  : bad('trace de l’échec', JSON.stringify(ligneEchec));

void idRefusee; void idDedans; void idTropJeune; void idAnniv; void idVeille; void idSansAge; void idNouveau;
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

const reprise = await decider(tardif, 'non_retenu');
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

const cible = await creer('Refus', 'refus@example.com');
await decider(cible, 'valide');
await fetch(`${FAKE}/__refuse-cancel?on=1`, { method: 'POST' });
const refus = await decider(cible, 'non_retenu');

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

await browser.close();
console.log('\n' + (failures.length === 0
  ? '[32mTout est vert.[0m'
  : `[31m${failures.length} échec(s) :[0m ` + failures.join(' | ')));
process.exit(failures.length === 0 ? 0 : 1);
