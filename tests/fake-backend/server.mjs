/**
 * Faux Supabase (PostgREST + Storage) et faux Resend, en mémoire.
 *
 * Sert uniquement à éprouver la chaîne complète — inscription, curation,
 * programmation des emails — sans toucher aux vrais services. Il ne reproduit
 * que ce que l'application appelle réellement, plus la contrainte d'unicité
 * de lil_emails, dont dépend le filet anti-doublon.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const tables = {
  lil_members: [],
  lil_photos: [],
  lil_curators: [
    { id: randomUUID(), email: 'curateur.1@lilleinlove.fr', full_name: 'Curateur 1', is_active: true, created_at: new Date().toISOString() },
    { id: randomUUID(), email: 'curateur.2@lilleinlove.fr', full_name: 'Curateur 2', is_active: true, created_at: new Date(Date.now() + 1000).toISOString() },
  ],
  lil_reviews: [],
  lil_emails: [],
  lil_soirees: [],
};

const storage = new Map();       // chemin -> { contentType, size }
export const sentEmails = [];    // journal des envois Resend
const cancelled = new Set();
let refuseCancel = false;
let refuseBatch = false;       // l'envoi par lots échoue, piloté par /__refuse-batch      // refus définitif, piloté par /__refuse-cancel
let cancelQueuedFois = 0;      // refus passagers « Email is not scheduled »

const log = [];
const record = (entry) => log.push({ at: Date.now(), ...entry });

/* ---------------------------------------------------------------- */
/* La vue lil_members_overview, recalculée à la lecture              */
/* ---------------------------------------------------------------- */
function overview() {
  return tables.lil_members.map((m) => ({
    ...m,
    age: m.birth_date
      ? Math.floor((Date.now() - new Date(m.birth_date).getTime()) / (365.25 * 864e5))
      : null,
    photo_count: tables.lil_photos.filter((p) => p.member_id === m.id).length,
    votes_oui: tables.lil_reviews.filter((r) => r.member_id === m.id && r.vote === 'oui').length,
    votes_non: tables.lil_reviews.filter((r) => r.member_id === m.id && r.vote === 'non').length,
    votes_total: tables.lil_reviews.filter((r) => r.member_id === m.id).length,
  }));
}

function readTable(name) {
  return name === 'lil_members_overview' ? overview() : (tables[name] ?? []);
}

/* ---------------------------------------------------------------- */
/* Filtres PostgREST : eq, in, is, gte, lte, order, limit           */
/* ---------------------------------------------------------------- */
function compare(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function applyFilters(rows, params) {
  let out = rows;

  for (const [key, raw] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;

    const [op, ...rest] = raw.split('.');
    const value = rest.join('.');

    if (op === 'eq') {
      out = out.filter((row) => {
        const actual = row[key];
        if (typeof actual === 'boolean') return String(actual) === value;
        if (actual === null || actual === undefined) return false;
        // citext : la comparaison d'email ignore la casse
        if (key.includes('email')) return String(actual).toLowerCase() === value.toLowerCase();
        return String(actual) === value;
      });
    } else if (op === 'in') {
      const list = value.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, ''));
      out = out.filter((row) => list.includes(String(row[key])));
    } else if (op === 'is') {
      // « is.null » : une colonne absente de l'objet vaut null, comme en base.
      if (value !== 'null') throw new Error(`is.${value} non géré`);
      out = out.filter((row) => row[key] === null || row[key] === undefined);
    } else if (op === 'gte' || op === 'lte') {
      const seuil = Number(value);
      out = out.filter((row) => {
        const actual = row[key];
        // Postgres écarte les null d'une comparaison : on fait pareil.
        if (actual === null || actual === undefined) return false;
        return op === 'gte' ? Number(actual) >= seuil : Number(actual) <= seuil;
      });
    } else {
      // Sans ça, un opérateur non géré serait ignoré en silence et un test
      // passerait alors que le filtre ne filtre rien.
      throw new Error(`opérateur PostgREST non géré : ${key}=${raw}`);
    }
  }

  // « order=a.asc,b.desc.nullslast » : plusieurs colonnes, dans l'ordre.
  const order = params.get('order');
  if (order) {
    const clauses = order.split(',').map((clause) => {
      const [field, ...options] = clause.split('.');
      return {
        field,
        desc: options.includes('desc'),
        nullsFirst: options.includes('nullsfirst'),
      };
    });
    out = [...out].sort((a, b) => {
      for (const { field, desc, nullsFirst } of clauses) {
        const av = a[field] ?? null;
        const bv = b[field] ?? null;
        if (av === null || bv === null) {
          if (av === bv) continue;
          return (av === null ? 1 : -1) * (nullsFirst ? -1 : 1);
        }
        const cmp = compare(av, bv);
        if (cmp !== 0) return desc ? -cmp : cmp;
      }
      return 0;
    });
  }

  const limit = params.get('limit');
  if (limit) out = out.slice(0, Number(limit));

  return out;
}

/** L'index unique (member_id, template) limité aux statuts actifs. */
function violatesEmailUnique(row) {
  return tables.lil_emails.some(
    (existing) =>
      existing.member_id === row.member_id &&
      existing.template === row.template &&
      ['programme', 'envoye'].includes(existing.status),
  );
}

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Range': '0-0/*',
    ...extraHeaders,
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  if (!raw.length) return null;
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return raw; // corps binaire (upload de photo)
  }
}

async function traiter(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  // Supabase autorise les appels depuis n'importe quelle page web : c'est ce
  // qui permet au formulaire autonome d'écrire depuis WordPress. On reproduit
  // ce comportement, sinon le navigateur bloquerait avant d'envoyer.
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Headers', '*, apikey, authorization, content-type, prefer, x-upsert');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'content-range, location');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const body = await readBody(req);
  const prefer = req.headers['prefer'] ?? '';
  const wantsSingle = String(req.headers['accept'] ?? '').includes('pgrst.object');

  /* ---------------- Resend ---------------- */
  // Envoi par lots : un tableau d'emails, une réponse { data: [{ id }] } dans l'ordre.
  if (path === '/emails/batch' && req.method === 'POST') {
    if (refuseBatch) {
      record({ what: 'resend:batch-refuse', taille: body.length });
      return json(res, 500, { name: 'application_error', message: 'lot refusé (simulation)' });
    }
    const ids = body.map((email) => {
      const id = randomUUID();
      sentEmails.push({ id, ...email, lot: true, receivedAt: new Date().toISOString() });
      return { id };
    });
    record({ what: 'resend:batch', taille: body.length });
    return json(res, 200, { data: ids });
  }
  if (path === '/__refuse-batch' && req.method === 'POST') {
    refuseBatch = url.searchParams.get('on') === '1';
    return json(res, 200, { refuseBatch });
  }

  if (path === '/emails' && req.method === 'POST') {
    const id = randomUUID();
    sentEmails.push({ id, ...body, receivedAt: new Date().toISOString() });
    record({ what: 'resend:send', subject: body.subject, scheduled_at: body.scheduled_at ?? null });
    return json(res, 200, { id });
  }
  if (/^\/emails\/[^/]+\/cancel$/.test(path) && req.method === 'POST') {
    const id = path.split('/')[2];
    // Permet au test de vérifier qu'un refus d'annulation est bien signalé,
    // et non avalé en silence.
    if (refuseCancel) {
      record({ what: 'resend:cancel-refuse', id });
      return json(res, 422, { name: 'validation_error', message: 'trop tard pour annuler' });
    }
    // Reproduit le vrai comportement de Resend : un email tout juste
    // programmé n'est pas encore annulable pendant quelques secondes.
    if (cancelQueuedFois > 0) {
      cancelQueuedFois -= 1;
      record({ what: 'resend:cancel-pas-encore', id, restant: cancelQueuedFois });
      return json(res, 422, { name: 'validation_error', message: 'Email is not scheduled' });
    }
    cancelled.add(id);
    record({ what: 'resend:cancel', id });
    return json(res, 200, { object: 'email', id });
  }
  if (path === '/__refuse-cancel' && req.method === 'POST') {
    refuseCancel = url.searchParams.get('on') === '1';
    return json(res, 200, { refuseCancel });
  }
  if (path === '/__cancel-pas-encore' && req.method === 'POST') {
    cancelQueuedFois = Number(url.searchParams.get('fois') ?? '0');
    return json(res, 200, { cancelQueuedFois });
  }

  /* ---------------- Storage ---------------- */
  if (path.startsWith('/storage/v1/object/')) {
    if (path === '/storage/v1/object/move' && req.method === 'POST') {
      const { sourceKey, destinationKey } = body;
      if (!storage.has(sourceKey)) return json(res, 404, { message: 'not found' });
      storage.set(destinationKey, storage.get(sourceKey));
      storage.delete(sourceKey);
      return json(res, 200, { message: 'ok' });
    }
    if (path.startsWith('/storage/v1/object/sign/') && req.method === 'POST') {
      const paths = body.paths ?? [body.path];
      return json(
        res,
        200,
        // base64url : le chemin contient des « / » qui, encodés dans une
        // chaîne de requête, se font ré-encoder en route. Évitons-les.
        paths.map((p) => ({
          path: p,
          signedURL: `/fake-photo?p=${Buffer.from(p).toString('base64url')}`,
        })),
      );
    }
    if (req.method === 'POST') {
      const key = decodeURIComponent(path.replace('/storage/v1/object/lil-photos/', ''));
      storage.set(key, { size: body?.length ?? 0, bytes: Buffer.isBuffer(body) ? body : null });
      return json(res, 200, { Key: `lil-photos/${key}` });
    }
  }

  /* ---------------- PostgREST ---------------- */
  if (path.startsWith('/rest/v1/')) {
    const table = path.replace('/rest/v1/', '');
    const params = url.searchParams;

    if (req.method === 'GET') {
      const rows = applyFilters(readTable(table), params);

      if (prefer.includes('count=exact') && String(req.headers['range-unit'] ?? '') !== '') {
        // head:true → supabase-js n'attend que l'en-tête Content-Range
      }
      if (prefer.includes('count=exact')) {
        return json(res, 200, rows, { 'Content-Range': `0-${rows.length}/${rows.length}` });
      }
      if (wantsSingle) {
        if (rows.length === 0) return json(res, 406, { code: 'PGRST116', message: 'no rows' });
        return json(res, 200, rows[0]);
      }
      return json(res, 200, rows);
    }

    if (req.method === 'POST') {
      const incoming = Array.isArray(body) ? body : [body];
      const isUpsert = prefer.includes('resolution=merge-duplicates');
      const created = [];

      for (const item of incoming) {
        if (table === 'lil_emails' && !isUpsert && violatesEmailUnique(item)) {
          return json(res, 409, {
            code: '23505',
            message: 'duplicate key value violates unique constraint "lil_emails_once_per_member"',
          });
        }
        if (table === 'lil_members' && tables.lil_members.some(
          (m) => String(m.email).toLowerCase() === String(item.email).toLowerCase(),
        )) {
          return json(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' });
        }

        // Upsert sur la clé primaire, comme PostgREST par défaut.
        if (isUpsert && item.id) {
          const existing = tables[table].find((r) => r.id === item.id);
          if (existing) {
            Object.assign(existing, item, { updated_at: new Date().toISOString() });
            created.push(existing);
            continue;
          }
        }

        if (isUpsert && table === 'lil_reviews') {
          const existing = tables.lil_reviews.find(
            (r) => r.member_id === item.member_id && r.curator_id === item.curator_id,
          );
          if (existing) {
            Object.assign(existing, item);
            created.push(existing);
            continue;
          }
        }

        const row = {
          id: item.id ?? randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: item.status ?? (table === 'lil_emails' ? 'programme' : 'nouveau'),
          form_version: item.form_version ?? 'complet',
          interests: item.interests ?? [],
          ...item,
        };
        tables[table].push(row);
        created.push(row);
        record({ what: `insert:${table}`, id: row.id });
      }

      // .single() / .maybeSingle() : PostgREST renvoie l'objet seul,
      // c'est ce dont dépend `const { data: member } = ...insert().single()`.
      if (wantsSingle) return json(res, 201, created[0] ?? null);
      return json(res, 201, created);
    }

    if (req.method === 'PATCH') {
      const rows = applyFilters(readTable(table), params);
      for (const row of rows) {
        const target = tables[table].find((r) => r.id === row.id);
        if (target) Object.assign(target, body, { updated_at: new Date().toISOString() });
        record({ what: `update:${table}`, id: row.id, patch: body });
      }
      if (wantsSingle) return json(res, 200, rows[0] ?? null);
      return json(res, 200, rows);
    }

    if (req.method === 'DELETE') {
      const rows = applyFilters(readTable(table), params);
      const ids = new Set(rows.map((r) => r.id));
      tables[table] = tables[table].filter((r) => !ids.has(r.id));
      return json(res, 200, rows);
    }
  }

  /* ---------------- Image signée réellement servie ---------------- */
  if (path === '/storage/v1/fake-photo' || path === '/fake-photo') {
    const encoded = url.searchParams.get('p');
    const key = encoded ? Buffer.from(encoded, 'base64url').toString('utf8') : null;
    const file = key ? storage.get(key) : null;
    if (!file?.bytes) return json(res, 404, { message: 'photo absente' });
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': file.bytes.length });
    return res.end(file.bytes);
  }

  /* ---------------- Introspection pour les tests ---------------- */
  if (path === '/__state') {
    return json(res, 200, {
      members: tables.lil_members,
      emails: tables.lil_emails,
      soirees: tables.lil_soirees,
      reviews: tables.lil_reviews,
      photos: tables.lil_photos,
      curators: tables.lil_curators,
      sent: sentEmails,
      cancelled: [...cancelled],
      storage: [...storage.keys()],
      log,
    });
  }
  if (path === '/__reset') {
    tables.lil_members = [];
    tables.lil_photos = [];
    tables.lil_reviews = [];
    tables.lil_emails = [];
    tables.lil_soirees = [];
    refuseBatch = false;
    sentEmails.length = 0;
    cancelled.clear();
    refuseCancel = false;
    cancelQueuedFois = 0;
    storage.clear();
    log.length = 0;
    return json(res, 200, { ok: true });
  }

  json(res, 404, { message: `non géré : ${req.method} ${path}` });
}

const server = createServer(async (req, res) => {
  try {
    await traiter(req, res);
  } catch (erreur) {
    // Un faux serveur qui meurt en silence ferait échouer la suite entière
    // sans dire pourquoi. On répond, et le test lit le message.
    console.error('[faux backend]', erreur);
    json(res, 400, { message: String(erreur?.message ?? erreur) });
  }
});

const PORT = Number(process.env.FAKE_PORT ?? 54321);
server.listen(PORT, () => console.log(`faux Supabase + Resend sur http://localhost:${PORT}`));
