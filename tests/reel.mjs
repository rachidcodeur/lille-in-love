/**
 * Essai de bout en bout contre les VRAIS services.
 *
 *   npm run dev        (dans un terminal)
 *   npm run test:reel  (dans un autre)
 *
 * Écrit vraiment dans ton Supabase et envoie vraiment par ton Resend, puis
 * efface tout. Le destinataire est delivered@resend.dev, l'adresse de test de
 * Resend : l'envoi est traité normalement mais personne ne le reçoit.
 *
 * À lancer après un déploiement ou un changement de clés, pour vérifier que
 * la chaîne entière fonctionne — ce que les tests hors ligne ne prouvent pas.
 */
const APP = process.env.APP_URL ?? 'http://localhost:3000';
const SB = process.env.SUPABASE_URL.replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const EMAIL = 'delivered@resend.dev';
// Resend accepte les sous-adresses : deux inscriptions, une seule boîte morte.
const EMAIL_ACCOMPAGNE = 'delivered+accompagne@resend.dev';
const failures = [];
const ok = (l) => console.log('  [32m✓[0m ' + l);
const bad = (l, d) => { failures.push(l); console.log('  [31m✗[0m ' + l + (d ? ' — ' + d : '')); };
const section = (l) => console.log('\n[1m' + l + '[0m');

const rest = async (path) => (await fetch(`${SB}/rest/v1/${path}`, { headers: H })).json();

let memberId = null;
let memberAccompagne = null;
let soireeId = null;

// Ce test crée sa propre candidature puis la supprime. Il ne touche jamais
// aux autres lignes : on relève le compte de départ et on vérifie à la fin
// qu'il n'a pas bougé.
const departMembres = (await rest('lil_members?select=id')).length;
const departEmails = (await rest('lil_emails?select=id')).length;
if (departMembres > 0) {
  console.log(`  (la base contient déjà ${departMembres} candidature(s) : elles ne seront pas touchées)`);
}

try {
  /* -------------------------------------------------------------- */
  section('1. Dépôt d’une photo dans le vrai stockage Supabase');

  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const bytes = await readFile(
    process.env.PHOTO_FIXTURE ?? join(here, 'e2e/fixtures/photo-1.png'),
  );

  const form = new FormData();
  form.append('file', new File([bytes], 'photo.png', { type: 'image/png' }));
  const up = await fetch(`${APP}/api/upload`, { method: 'POST', body: form });
  const upBody = await up.json();

  up.ok && upBody.path
    ? ok(`photo déposée : ${upBody.path}`)
    : bad('dépôt refusé', JSON.stringify(upBody));
  if (!upBody.path) throw new Error('arrêt : pas de photo');

  /* -------------------------------------------------------------- */
  section('2. Inscription par le formulaire court');

  const res = await fetch(`${APP}/api/inscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formVersion: 'court',
      gender: 'femme',
      firstName: 'Essai',
      lastName: 'Technique',
      email: EMAIL,
      consent: true,
      elapsedMs: 90_000,
      photos: [{ path: upBody.path, mimeType: 'image/png', sizeBytes: bytes.length }],
    }),
  });
  const body = await res.json();

  res.status === 201 && body.id
    ? ok(`candidature enregistrée (${body.id.slice(0, 8)}…)`)
    : bad('inscription refusée', `${res.status} ${JSON.stringify(body)}`);
  if (!body.id) throw new Error('arrêt : pas de candidature');
  memberId = body.id;

  body.emailSent ? ok('l’application déclare l’email 01 envoyé') : bad('email 01 non envoyé');

  /* -------------------------------------------------------------- */
  section('2 bis. « Je viens accompagné » — le cas qui a bloqué la prod');

  // Le questionnaire ne demande plus l'email de l'accompagnant, mais le
  // schéma l'exigeait encore : toute personne répondant « oui » était
  // refusée. Ce cas ne se voit qu'ici, contre la vraie base — un faux
  // Supabase n'a pas de contraintes.
  const accRes = await fetch(`${APP}/api/inscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formVersion: 'complet',
      gender: 'homme',
      birthDate: '1992-05-14',
      city: 'Lille',
      postalCode: '59000',
      orientation: 'hetero',
      hasChildren: 'non',
      lookingFor: 'relation_serieuse',
      heightCm: 180,
      about: 'Essai technique, à effacer.',
      motivation: 'Essai technique, à effacer.',
      interests: ['culture'],
      profession: 'Essai',
      referral: 'instagram',
      firstName: 'Essai',
      lastName: 'ACC',
      phone: '0600000000',
      email: EMAIL_ACCOMPAGNE,
      consent: true,
      elapsedMs: 90_000,
      comesWith: 'oui',
      companionFirstName: 'Lucie',
      photos: [{ path: upBody.path, mimeType: 'image/png', sizeBytes: bytes.length }],
    }),
  });
  const accBody = await accRes.json();

  accRes.status === 201 && accBody.id
    ? ok('une candidature accompagnée est acceptée')
    : bad(
        'candidature accompagnée refusée — passe supabase/10_accompagnant.sql',
        `${accRes.status} ${JSON.stringify(accBody)}`,
      );
  if (accBody.id) memberAccompagne = accBody.id;

  /* -------------------------------------------------------------- */
  section('3. Ce que Resend a réellement reçu');

  const [log01] = await rest(`lil_emails?member_id=eq.${memberId}&template=eq.01_candidature_recue&select=*`);
  log01?.status === 'envoye' ? ok('journalisé comme « envoyé »') : bad('statut du journal', log01?.status ?? 'aucune ligne');
  log01?.resend_id ? ok(`identifiant Resend : ${log01.resend_id.slice(0, 8)}…`) : bad('pas d’identifiant Resend');

  if (log01?.resend_id) {
    const r = await fetch(`https://api.resend.com/emails/${log01.resend_id}`, {
      headers: { Authorization: `Bearer ${RESEND}` },
    });
    if (r.ok) {
      const mail = await r.json();
      ok(`Resend confirme l’envoi — statut « ${mail.last_event ?? mail.status ?? '?'} »`);
      console.log(`      de      : ${mail.from}`);
      console.log(`      à       : ${Array.isArray(mail.to) ? mail.to.join(', ') : mail.to}`);
      console.log(`      objet   : ${mail.subject}`);
      // On compare à EMAIL_FROM plutôt qu'à un domaine écrit en dur : le jour
      // où l'expéditeur change, le test suit sans qu'on y pense.
      const attendu = (process.env.EMAIL_FROM ?? '').replace(/^.*<|>.*$/g, '');
      mail.from?.includes(attendu)
        ? ok(`expédié depuis le domaine vérifié (${attendu})`)
        : bad('expéditeur inattendu', `${mail.from} au lieu de ${attendu}`);
    } else {
      bad('Resend ne retrouve pas cet email', String(r.status));
    }
  }

  /* -------------------------------------------------------------- */
  section('4. Photo rangée dans le bucket privé');

  const photos = await rest(`lil_photos?member_id=eq.${memberId}&select=storage_path`);
  photos.length === 1 ? ok(`rangée sous ${photos[0].storage_path}`) : bad('photo non liée', String(photos.length));

  if (photos[0]) {
    const pub = await fetch(`${SB}/storage/v1/object/public/lil-photos/${photos[0].storage_path}`);
    pub.status === 400 || pub.status === 404
      ? ok('inaccessible sans signature — le bucket est bien privé')
      : bad('la photo est accessible publiquement', String(pub.status));
  }

  /* -------------------------------------------------------------- */
  section('5. Validation depuis le back-office');

  const avant = Date.now();
  const dec = await fetch(`${APP}/api/admin/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId, decision: 'valide' }),
  });
  const decBody = await dec.json();

  dec.ok && decBody.ok ? ok('décision enregistrée') : bad('décision refusée', JSON.stringify(decBody));
  decBody.emailOk ? ok('email 02 accepté par Resend') : bad('email 02 refusé', decBody.emailError);

  if (decBody.scheduledFor) {
    const min = (new Date(decBody.scheduledFor).getTime() - avant) / 60_000;
    ok(`programmé dans ${min.toFixed(1)} min (DELAI_REPONSE_MINUTES)`);
  } else {
    bad('email 02 non programmé');
  }

  const [membre] = await rest(`lil_members?id=eq.${memberId}&select=status,decided_at`);
  membre?.status === 'valide' ? ok('statut « validée » en base') : bad('statut', membre?.status);

  const [log02] = await rest(`lil_emails?member_id=eq.${memberId}&template=eq.02_bienvenue&select=*`);
  log02?.status === 'programme' ? ok('email 02 en attente dans le journal') : bad('journal 02', log02?.status);

  /* -------------------------------------------------------------- */
  section('6. Annuler la validation : l’envoi en attente est-il arrêté ?');

  const dec2 = await fetch(`${APP}/api/admin/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId, decision: 'nouveau' }),
  });
  const dec2Body = await dec2.json();
  dec2.ok ? ok('nouvelle décision enregistrée') : bad('refusée', JSON.stringify(dec2Body));

  // Resend n'accepte d'annuler qu'une fois l'email passé en « scheduled », et
  // ce basculement prend un délai variable (mesuré entre 3 et 17 s). Si
  // l'annulation immédiate échoue, la fiche propose de la reprendre : c'est ce
  // parcours-là qu'on vérifie, pas seulement le cas favorable.
  let annule = !dec2Body.annulationEchouee;

  if (annule) {
    ok('annulée du premier coup');
  } else {
    console.log(`      premier essai refusé : ${dec2Body.annulationEchouee}`);
    for (let essai = 1; essai <= 6 && !annule; essai += 1) {
      await new Promise((r) => setTimeout(r, 5000));
      const reprise = await fetch(`${APP}/api/admin/annuler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      const corps = await reprise.json();
      if (corps.ok) {
        annule = true;
        ok(`annulée en reprenant la main (essai ${essai}, ~${essai * 5} s après)`);
      }
    }
    if (!annule) bad('annulation impossible même après 30 s');
  }

  const [log02b] = await rest(
    `lil_emails?member_id=eq.${memberId}&template=eq.02_bienvenue&select=status`,
  );
  log02b?.status === 'annule'
    ? ok('le journal confirme l’annulation')
    : bad('journal non mis à jour', log02b?.status);

  const envoyes = await rest(
    `lil_emails?member_id=eq.${memberId}&status=eq.envoye&select=template`,
  );
  envoyes.length === 1 && envoyes[0].template === '01_candidature_recue'
    ? ok('un seul email est vraiment parti : la candidature reçue')
    : bad('emails envoyés', JSON.stringify(envoyes.map((e) => e.template)));

  /* -------------------------------------------------------------- */
  section('7. Enregistrer une soirée n’envoie plus rien');

  const table = await fetch(`${SB}/rest/v1/lil_soirees?select=id&limit=1`, { headers: H });
  if (!table.ok) {
    console.log('      supabase/05_soirees.sql n’est pas encore exécuté : soirée non testée.');
  } else {
    const avant = await rest(`lil_emails?member_id=eq.${memberId}&select=id`);

    const pub = await fetch(`${APP}/api/admin/soirees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: 'Soirée de test technique',
        ageMin: 27,
        ageMax: 35,
        date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        lieu: 'Test',
      }),
    });
    const pubBody = await pub.json();
    soireeId = pubBody.soireeId ?? null;

    pub.status === 201 ? ok('soirée enregistrée') : bad('enregistrement refusé', JSON.stringify(pubBody));

    const apres = await rest(`lil_emails?member_id=eq.${memberId}&select=id`);
    apres.length === avant.length
      ? ok('aucun email déclenché par l’enregistrement')
      : bad('des emails sont partis', String(apres.length - avant.length));
  }
} catch (cause) {
  bad('interruption', cause instanceof Error ? cause.message : String(cause));
}

/* ---------------------------------------------------------------- */
section('8. Nettoyage — la base doit retrouver son état initial');

if (memberId) {
  // Les réponses programmées partiraient même une fois la base vidée.
  const programmes = await rest(
    `lil_emails?member_id=eq.${memberId}&status=eq.programme&select=resend_id`,
  );
  for (const e of programmes) {
    if (!e.resend_id) continue;
    for (let i = 0; i < 8; i += 1) {
      const r = await fetch(`https://api.resend.com/emails/${e.resend_id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}` },
      });
      if (r.ok) break;
      await new Promise((res) => setTimeout(res, 2500));
    }
  }

  const photos = await rest(`lil_photos?member_id=eq.${memberId}&select=storage_path`);
  for (const p of photos) {
    await fetch(`${SB}/storage/v1/object/lil-photos/${p.storage_path}`, {
      method: 'DELETE',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
  }
  await fetch(`${SB}/rest/v1/lil_emails?member_id=eq.${memberId}`, { method: 'DELETE', headers: H });
  if (soireeId) {
    await fetch(`${SB}/rest/v1/lil_soirees?id=eq.${soireeId}`, { method: 'DELETE', headers: H });
  }
  // lil_photos part en cascade avec le membre.
  await fetch(`${SB}/rest/v1/lil_members?id=eq.${memberId}`, { method: 'DELETE', headers: H });
}

if (memberAccompagne) {
  const photos = await rest(`lil_photos?member_id=eq.${memberAccompagne}&select=storage_path`);
  for (const p of photos) {
    await fetch(`${SB}/storage/v1/object/lil-photos/${p.storage_path}`, {
      method: 'DELETE',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
  }
  await fetch(`${SB}/rest/v1/lil_emails?member_id=eq.${memberAccompagne}`, { method: 'DELETE', headers: H });
  await fetch(`${SB}/rest/v1/lil_members?id=eq.${memberAccompagne}`, { method: 'DELETE', headers: H });
}

const restants = await rest('lil_members?select=id');
const mailsRestants = await rest('lil_emails?select=id');
restants.length === departMembres && mailsRestants.length === departEmails
  ? ok(`aucune trace laissée : la base retrouve ses ${departMembres} candidature(s)`)
  : bad('la base a changé',
      `${departMembres} → ${restants.length} candidature(s), ${departEmails} → ${mailsRestants.length} email(s)`);

console.log('\n' + (failures.length === 0
  ? '[32mTout est vert — la chaîne fonctionne avec tes vrais comptes.[0m'
  : `[31m${failures.length} échec(s) :[0m ` + failures.join(' | ')));
process.exit(failures.length === 0 ? 0 : 1);
