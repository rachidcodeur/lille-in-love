/**
 * Reprise des candidatures de l'ancien site.
 *
 *   npm run import:anciennes -- "~/Downloads/candidatures_rows.csv"            (essai à blanc)
 *   npm run import:anciennes -- "~/Downloads/candidatures_rows.csv" --ecrire   (pour de vrai)
 *
 * Par défaut le script ne fait rien : il lit le CSV, prépare chaque ligne,
 * annonce ce qu'il écrirait, et s'arrête. C'est --ecrire qui engage.
 *
 * L'ancien questionnaire posait moins de questions : pas de nom de famille,
 * pas de centres d'intérêt cochés. Les champs correspondants restent vides —
 * c'est exact, la question n'a pas été posée — et la colonne « legacy »
 * permet au back-office de le dire au lieu de laisser croire à un oubli.
 *
 * Les candidatures reprises sont validées d'office : on ne refuse plus
 * personne, ce sont les groupes qui disent le type de candidat. Aucun email
 * ne part — ni à la reprise, ni plus tard : l'email de bienvenue n'existe que
 * si quelqu'un clique « valider » dans le back-office.
 *
 * LES PHOTOS vivent dans le stockage de l'ANCIEN projet Supabase
 * (ftvvarifktyxuqhmuoet, bucket privé candidature-photos). Le CSV ne contient
 * que leurs chemins. Il faut donc la clé de lecture de ce projet, dans
 * .env.local :
 *
 *   ANCIEN_SERVICE_ROLE_KEY=eyJ...
 *
 * Sans elle, les candidatures sont reprises sans leurs photos, et le script le
 * dit. Relancé plus tard avec la clé et --photos-seulement, il n'ajoutera que
 * les photos manquantes.
 *
 * Deux sorties de secours :
 *   --photos-seulement  n'écrit aucune candidature, complète les photos
 *   --defaire           remet à la corbeille tout ce que cet import a créé
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';

/* ------------------------------------------------------------------ */
/* Arguments                                                          */
/* ------------------------------------------------------------------ */
const args = process.argv.slice(2);
const drapeau = (nom) => args.includes(`--${nom}`);
const ECRIRE = drapeau('ecrire');
const PHOTOS_SEULEMENT = drapeau('photos-seulement');
const DEFAIRE = drapeau('defaire');
const fichier = args.find((a) => !a.startsWith('--'));

const gris = (s) => `\x1b[90m${s}\x1b[0m`;
const vert = (s) => `\x1b[32m${s}\x1b[0m`;
const rouge = (s) => `\x1b[31m${s}\x1b[0m`;
const gras = (s) => `\x1b[1m${s}\x1b[0m`;
const titre = (s) => console.log(`\n${gras(s)}`);

if (!fichier && !DEFAIRE) {
  console.error(`
Usage :  npm run import:anciennes -- <fichier.csv> [--ecrire]

  (sans --ecrire, le script montre ce qu'il ferait sans rien écrire)
  --photos-seulement   complète seulement les photos manquantes
  --defaire            remet à la corbeille les candidatures importées
`);
  process.exit(1);
}

const SB = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'lil-photos';

if (!SB || !KEY) {
  console.error(
    rouge('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires.') +
      '\nLance le script via npm, qui charge .env.local :  npm run import:anciennes -- <csv>',
  );
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(chemin, options = {}) {
  const r = await fetch(`${SB}/rest/v1/${chemin}`, { ...options, headers: { ...H, ...options.headers } });
  const texte = await r.text();
  let corps = null;
  try {
    corps = texte ? JSON.parse(texte) : null;
  } catch {
    corps = texte;
  }
  return { ok: r.ok, status: r.status, corps };
}

/* ------------------------------------------------------------------ */
/* Lecture du CSV                                                      */
/*                                                                     */
/* Écrit à la main plutôt qu'importé : les réponses contiennent des     */
/* virgules, des guillemets et des retours à la ligne, ce qu'un split   */
/* ne sait pas lire — mais c'est tout ce qu'il y a à savoir du format.  */
/* ------------------------------------------------------------------ */
function lireCsv(texte) {
  const lignes = [];
  let champ = '';
  let ligne = [];
  let dansGuillemets = false;

  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];

    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i += 1;
        } else {
          dansGuillemets = false;
        }
      } else {
        champ += c;
      }
      continue;
    }

    if (c === '"') dansGuillemets = true;
    else if (c === ',') {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n') {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
    } else if (c !== '\r') champ += c;
  }
  if (champ !== '' || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }

  const [entetes, ...corps] = lignes.filter((l) => l.some((v) => v !== ''));
  return corps.map((l) => Object.fromEntries(entetes.map((e, i) => [e.trim(), (l[i] ?? '').trim()])));
}

/* ------------------------------------------------------------------ */
/* Correspondances entre l'ancien formulaire et le nouveau             */
/* ------------------------------------------------------------------ */
const GENRE = { M: 'homme', F: 'femme', homme: 'homme', femme: 'femme' };
const RECHERCHE = {
  serieux: 'relation_serieuse',
  'bons-moments': 'bons_moments',
  relation_serieuse: 'relation_serieuse',
  bons_moments: 'bons_moments',
};
const ORIENTATION = { hetero: 'hetero', gay: 'gay' };

/** Reprise de src/lib/validation.ts : 0770119088 devient +33770119088, pour
 *  que la détection de doublon à l'inscription reconnaisse ces numéros. */
function normaliserTelephone(brut) {
  const chiffres = (brut ?? '').replace(/[^\d+]/g, '');
  if (/^0\d{9}$/.test(chiffres)) return `+33${chiffres.slice(1)}`;
  if (/^33\d{9}$/.test(chiffres)) return `+${chiffres}`;
  return chiffres;
}

function normaliserInstagram(brut) {
  if (!brut) return null;
  const pseudo = brut
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/^@/, '')
    .split(/[/?]/)[0];
  return pseudo ? `@${pseudo}` : null;
}

const vide = (v) => !v || !String(v).trim();
const ouRien = (v) => (vide(v) ? null : String(v).trim());

/** L'instant de la reprise : c'est là qu'on décide de garder tout le monde. */
const decidee = new Date().toISOString();

function convertir(ligne) {
  const genre = GENRE[ligne.gender];
  const recherche = RECHERCHE[ligne.looking_for];
  const orientation = ORIENTATION[ligne.orientation];
  const taille = Number.parseInt(ligne.height_cm, 10);

  const problemes = [];
  if (!genre) problemes.push(`genre « ${ligne.gender} » inconnu`);
  if (!recherche) problemes.push(`looking_for « ${ligne.looking_for} » inconnu`);
  if (!orientation) problemes.push(`orientation « ${ligne.orientation} » inconnue`);
  if (!Number.isFinite(taille) || taille < 120 || taille > 230)
    problemes.push(`taille « ${ligne.height_cm} » hors bornes`);
  if (vide(ligne.email)) problemes.push('email manquant');
  if (vide(ligne.birth_date)) problemes.push('date de naissance manquante');
  if (vide(ligne.first_name)) problemes.push('prénom manquant');

  // Un accompagnant peut avoir été nommé sans son email : on garde le nom,
  // qui est l'information, et le back-office montrera qu'il manque l'adresse.
  const nomAmi = ouRien(ligne.friend_name);
  const emailAmi = ouRien(ligne.friend_email);

  const groupe = ['A', 'B', 'C', 'G'].includes(ligne.soiree_group) ? ligne.soiree_group : null;

  const fiche = {
    id: ligne.id || undefined,
    created_at: ligne.created_at || undefined,
    legacy: true,

    gender: genre,
    city: ligne.city || '',
    postal_code: ligne.postal_code || '',
    orientation,
    has_children: ligne.has_children === 'true',
    looking_for: recherche,
    height_cm: taille,

    // Deux textes libres de l'ancien questionnaire, dans les deux champs du
    // nouveau qui posent la même question.
    about: ligne.about_you || '',
    motivation: ligne.ideal_evening || '',

    // L'ancien formulaire demandait les centres d'intérêt en texte libre ;
    // le nouveau les fait cocher. Le texte va donc dans « autre ».
    interests: [],
    interests_other: ouRien(ligne.interests),

    zodiac: ouRien(ligne.zodiac_sign),
    profession: ligne.profession || '',
    instagram: normaliserInstagram(ligne.instagram),

    comes_with: Boolean(nomAmi || emailAmi),
    companion_first_name: nomAmi,
    companion_email: emailAmi,

    referral: ligne.source || ligne.referred_by || '',

    first_name: ligne.first_name,
    // L'ancien questionnaire ne demandait pas le nom de famille.
    last_name: ligne.last_name || '',
    phone: normaliserTelephone(ligne.phone),
    email: ligne.email.toLowerCase(),
    birth_date: ligne.birth_date,
    consent_at: ligne.created_at || new Date().toISOString(),

    // Ces candidatures ne sont plus à examiner : elles sont validées d'office,
    // comme le veut la règle actuelle — on garde tout le monde, et ce sont les
    // groupes qui disent le type de candidat. Écrire le statut directement en
    // base n'envoie rien : l'email de bienvenue n'existe que si quelqu'un
    // clique « valider » dans le back-office.
    status: 'valide',
    decided_at: decidee,
    form_version: 'complet',
    soiree_group: groupe,
    children_preference: ouRien(ligne.children_preference),
    admin_notes: ouRien(ligne.admin_notes),
    source: 'ancien-site',
  };

  let photos = [];
  try {
    photos = JSON.parse(ligne.photo_urls || '[]').filter(Boolean);
  } catch {
    problemes.push('photo_urls illisible');
  }

  return { fiche, photos, problemes };
}

/* ------------------------------------------------------------------ */
/* La colonne legacy doit exister — sauf pour un simple essai à blanc, */
/* qui doit pouvoir montrer le plan avant qu'on touche à la base.      */
/* ------------------------------------------------------------------ */
const sonde = await rest('lil_members?select=legacy&limit=1');
if (!sonde.ok) {
  const message =
    'La colonne « legacy » est absente de la base.' +
    '\n\nOuvre Supabase > SQL Editor et exécute, dans cet ordre, ceux que tu n’as pas' +
    '\nencore passés :' +
    '\n  supabase/10_accompagnant.sql   (indispensable : des accompagnants sans email)' +
    '\n  supabase/11_corbeille.sql' +
    '\n  supabase/12_anciennes.sql';

  if (ECRIRE) {
    console.error(`${rouge(`\n${message}`)}\n\nDétail : ${JSON.stringify(sonde.corps)}\n`);
    process.exit(1);
  }
  console.log(`\n${gris(message)}\n${gris('L’essai à blanc continue : il ne fait que lire.')}`);
}

/* ------------------------------------------------------------------ */
/* Défaire                                                             */
/* ------------------------------------------------------------------ */
if (DEFAIRE) {
  const { corps: existantes } = await rest('lil_members?select=id,first_name&legacy=is.true&deleted_at=is.null');
  const nb = Array.isArray(existantes) ? existantes.length : 0;
  titre(`Défaire l'import — ${nb} candidature(s) reprise(s) encore active(s)`);

  if (!ECRIRE) {
    console.log(gris('Essai à blanc. Ajoute --ecrire pour les mettre à la corbeille.'));
    process.exit(0);
  }
  if (nb === 0) process.exit(0);

  const r = await rest('lil_members?legacy=is.true&deleted_at=is.null', {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });
  console.log(
    r.ok
      ? vert(`${nb} candidature(s) mise(s) à la corbeille. Elles sont récupérables dans /admin/corbeille.`)
      : rouge(`Échec : ${JSON.stringify(r.corps)}`),
  );
  process.exit(r.ok ? 0 : 1);
}

/* ------------------------------------------------------------------ */
/* Lecture et conversion                                               */
/* ------------------------------------------------------------------ */
const chemin = fichier.startsWith('~') ? fichier.replace('~', homedir()) : fichier;
const lignes = lireCsv(await readFile(chemin, 'utf8'));

titre(`Reprise de ${lignes.length} candidature(s) — ${chemin}`);
if (!ECRIRE) console.log(gris('Essai à blanc : rien ne sera écrit. Ajoute --ecrire pour engager.'));

const converties = lignes.map(convertir);
const invalides = converties.filter((c) => c.problemes.length > 0);
const valides = converties.filter((c) => c.problemes.length === 0);

for (const { fiche, problemes } of invalides) {
  console.log(`  ${rouge('✗')} ${fiche.first_name} <${fiche.email}> — ${problemes.join(', ')}`);
}

/* --- Ce qui est déjà en base ---------------------------------------- */
const { corps: deja } = await rest('lil_members?select=id,email,phone');
const parId = new Set(deja.map((m) => m.id));
const parEmail = new Set(deja.map((m) => (m.email ?? '').toLowerCase()));
const parTel = new Set(deja.map((m) => m.phone).filter(Boolean));

const aEcrire = [];
const dejaLa = [];
for (const c of valides) {
  if (parId.has(c.fiche.id)) dejaLa.push({ ...c, motif: 'déjà importée' });
  else if (parEmail.has(c.fiche.email)) dejaLa.push({ ...c, motif: 'email déjà en base' });
  else if (c.fiche.phone && parTel.has(c.fiche.phone)) dejaLa.push({ ...c, motif: 'numéro déjà en base' });
  else {
    aEcrire.push(c);
    parEmail.add(c.fiche.email);
    if (c.fiche.phone) parTel.add(c.fiche.phone);
  }
}

console.log(`
  ${gras(String(aEcrire.length))} à reprendre
  ${dejaLa.length} déjà en base (ignorée${dejaLa.length > 1 ? 's' : ''})
  ${invalides.length} illisible${invalides.length > 1 ? 's' : ''}
  ${aEcrire.reduce((n, c) => n + c.photos.length, 0)} photo(s) à récupérer`);

for (const c of dejaLa) console.log(gris(`  · ${c.fiche.first_name} <${c.fiche.email}> — ${c.motif}`));

/* ------------------------------------------------------------------ */
/* Écriture des candidatures                                           */
/* ------------------------------------------------------------------ */
let importees = PHOTOS_SEULEMENT ? [] : aEcrire;

if (PHOTOS_SEULEMENT) {
  titre('Photos seulement : aucune candidature ne sera écrite');
} else if (ECRIRE && aEcrire.length > 0) {
  titre('Écriture');
  // Par paquets de 25 : un refus de la base nomme alors une poignée de
  // lignes, pas cent, et on voit tout de suite laquelle pose problème.
  const reussies = [];
  for (let i = 0; i < aEcrire.length; i += 25) {
    const paquet = aEcrire.slice(i, i + 25);
    const r = await rest('lil_members', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(paquet.map((c) => c.fiche)),
    });
    if (!r.ok) {
      console.log(rouge(`  ✗ paquet ${i / 25 + 1} refusé : ${JSON.stringify(r.corps)}`));
      continue;
    }
    for (const m of r.corps) {
      const source = paquet.find((c) => c.fiche.email === (m.email ?? '').toLowerCase());
      reussies.push({ ...source, fiche: { ...source.fiche, id: m.id } });
    }
    console.log(vert(`  ✓ ${reussies.length}/${aEcrire.length}`));
  }
  importees = reussies;
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */
// Le projet et le bucket de l'ancien site. Ni l'un ni l'autre n'est un
// secret — seule la clé en est un, et elle reste dans .env.local.
const A_URL = (process.env.ANCIEN_SUPABASE_URL ?? 'https://ftvvarifktyxuqhmuoet.supabase.co').replace(/\/+$/, '');
const A_KEY = process.env.ANCIEN_SERVICE_ROLE_KEY ?? process.env.ANCIEN_ANON_KEY;
const A_BUCKET = process.env.ANCIEN_BUCKET ?? 'candidature-photos';

titre('Photos');

if (!A_URL || !A_KEY) {
  console.log(
    `  ${gris('Non reprises.')} Les photos ne sont pas dans le CSV : il n’en contient que les` +
      `\n  chemins, et les fichiers vivent dans le stockage de l’ancien projet Supabase.` +
      `\n\n  Ajoute la clé de lecture de l’ancien projet dans .env.local :` +
      `\n    ANCIEN_SERVICE_ROLE_KEY=eyJ...` +
      `\n  puis :  npm run import:anciennes -- "${fichier}" --photos-seulement --ecrire` +
      `\n\n  Les candidatures, elles, sont reprises : seules les images manquent.`,
  );
} else {
  // En mode --photos-seulement, on repart de ce qui est déjà en base.
  let cibles = importees;
  if (PHOTOS_SEULEMENT) {
    const { corps: enBase } = await rest('lil_members?select=id,email&legacy=is.true');
    const idParEmail = new Map(enBase.map((m) => [(m.email ?? '').toLowerCase(), m.id]));
    cibles = valides
      .map((c) => ({ ...c, fiche: { ...c.fiche, id: idParEmail.get(c.fiche.email) } }))
      .filter((c) => c.fiche.id);
  }

  const { corps: connues } = await rest('lil_photos?select=member_id,storage_path');
  const dejaPhoto = new Set(connues.map((p) => p.storage_path));

  let reprises = 0;
  let manquantes = 0;

  for (const { fiche, photos } of cibles) {
    for (const [index, ancien] of photos.entries()) {
      const extension = (ancien.split('.').pop() || 'jpg').toLowerCase();
      const destination = `candidatures/${fiche.id}/${index + 1}.${extension}`;
      if (dejaPhoto.has(destination)) continue;

      if (!ECRIRE) {
        reprises += 1;
        continue;
      }

      const lu = await fetch(`${A_URL}/storage/v1/object/${A_BUCKET}/${ancien}`, {
        headers: { apikey: A_KEY, Authorization: `Bearer ${A_KEY}` },
      });
      if (!lu.ok) {
        manquantes += 1;
        console.log(rouge(`  ✗ ${fiche.first_name} — ${ancien} (${lu.status})`));
        continue;
      }
      const octets = Buffer.from(await lu.arrayBuffer());
      const type = lu.headers.get('content-type') || 'image/jpeg';

      const envoi = await fetch(`${SB}/storage/v1/object/${BUCKET}/${destination}`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': type, 'x-upsert': 'true' },
        body: octets,
      });
      if (!envoi.ok) {
        manquantes += 1;
        console.log(rouge(`  ✗ envoi ${destination} : ${await envoi.text()}`));
        continue;
      }

      const lien = await rest('lil_photos', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          member_id: fiche.id,
          storage_path: destination,
          position: index + 1,
          mime_type: type,
          size_bytes: octets.length,
        }),
      });
      if (!lien.ok) {
        manquantes += 1;
        console.log(rouge(`  ✗ lien ${destination} : ${JSON.stringify(lien.corps)}`));
        continue;
      }
      reprises += 1;
      if (reprises % 20 === 0) console.log(vert(`  ✓ ${reprises} photos`));
    }
  }

  console.log(
    `  ${vert(`${reprises} photo(s) ${ECRIRE ? 'reprise(s)' : 'à reprendre'}`)}` +
      (manquantes ? ` · ${rouge(`${manquantes} introuvable(s)`)}` : ''),
  );
}

/* ------------------------------------------------------------------ */
titre('Bilan');
if (!ECRIRE) {
  console.log(gris('Rien n’a été écrit. Relance avec --ecrire.'));
} else {
  console.log(
    `${vert(`${importees.length} candidature(s) reprise(s).`)}` +
      `\nElles apparaissent dans app.in-love.fr sous l’intertitre « Anciennes candidatures ».` +
      `\nAucun email n’a été envoyé — ni maintenant, ni plus tard.` +
      `\nPour revenir en arrière :  npm run import:anciennes -- --defaire --ecrire`,
  );
}
