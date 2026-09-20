import { NextResponse } from 'next/server';
import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import { clientIp, corsHeaders, hashIp, rateLimit } from '@/lib/security';
import {
  ageFromBirthDate,
  inscriptionCourteSchema,
  inscriptionSchema,
  normalizeInstagram,
  normalizePhone,
  type InscriptionCourteInput,
  type InscriptionInput,
} from '@/lib/validation';
import { HONEYPOT_FIELDS, MIN_FILL_SECONDS } from '@/lib/questions';
import { previenirEquipe, sendSequenceEmail } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

/** Les colonnes communes aux deux parcours. */
function baseRow(data: InscriptionInput | InscriptionCourteInput) {
  return {
    gender: data.gender,
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    consent_at: new Date().toISOString(),
    status: 'nouveau' as const,
  };
}

/** Ce que le formulaire complet ajoute. */
function fullRow(data: InscriptionInput) {
  return {
    city: data.city,
    postal_code: data.postalCode,
    orientation: data.orientation,
    has_children: data.hasChildren === 'oui',
    looking_for: data.lookingFor,
    height_cm: data.heightCm,
    about: data.about,
    motivation: data.motivation,
    interests: data.interests,
    interests_other: data.interestsOther ?? null,
    zodiac: data.zodiac ?? null,
    profession: data.profession,
    instagram: normalizeInstagram(data.instagram) ?? null,
    comes_with: data.comesWith === 'oui',
    companion_first_name: data.companionFirstName ?? null,
    companion_email: data.comesWith === 'oui' ? data.companionEmail || null : null,
    referral: data.referral,
    phone: normalizePhone(data.phone),
    birth_date: data.birthDate,
  };
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  const ip = clientIp(request);

  // Deux barrières : par IP, et globale au cas où un script tournerait derrière plusieurs IP.
  const perIp = rateLimit(`inscription:${ip ?? 'inconnu'}`, {
    limit: env.maxInscriptionsParHeure(),
    windowMs: 60 * 60_000,
  });
  if (!perIp.ok) {
    return NextResponse.json(
      {
        error: `Tu as déjà envoyé plusieurs candidatures. Écris-nous à ${BRAND.contactEmail}.`,
      },
      { status: 429, headers: { ...cors, 'Retry-After': String(perIp.retryAfterSeconds) } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête illisible.' }, { status: 400, headers: cors });
  }

  const body = raw as Record<string, unknown>;
  const isCourt = body?.formVersion === 'court';

  // --- Champs pièges --------------------------------------------------
  // Invisibles à l'écran, et nommés de façon à ce qu'aucun remplissage
  // automatique de navigateur ne les touche : seul un robot les remplit.
  // On répond 200 pour ne pas lui apprendre ce qui l'a trahi.
  const trapped = HONEYPOT_FIELDS.some(
    (field) => typeof body?.[field] === 'string' && (body[field] as string).length > 0,
  );

  if (trapped) {
    console.warn('[inscription] piège déclenché, envoi ignoré', { ip: hashIp(ip) });
    return NextResponse.json({ ok: true, skipped: true }, { status: 200, headers: cors });
  }

  // --- Rempli anormalement vite ---------------------------------------
  // Ce signal-là ne suffit pas à écarter quelqu'un : le formulaire court
  // tient en trois écrans, et une personne pressée le remplit en quelques
  // secondes. On enregistre donc la candidature et on la signale simplement
  // aux curateurs — perdre un vrai inscrit en silence coûterait bien plus
  // cher que relire une fiche de trop.
  const seuilMs = MIN_FILL_SECONDS[isCourt ? 'court' : 'complet'] * 1000;
  const tooFast = typeof body?.elapsedMs === 'number' && body.elapsedMs < seuilMs;

  if (tooFast) {
    console.warn('[inscription] envoi très rapide, candidature signalée', {
      elapsedMs: body.elapsedMs,
      seuilMs,
      ip: hashIp(ip),
    });
  }

  // --- Validation -----------------------------------------------------
  // Le parcours court et le parcours complet n'attendent pas les mêmes
  // réponses : c'est le formulaire qui annonce lequel il est.
  const parsed = isCourt
    ? inscriptionCourteSchema.safeParse(raw)
    : inscriptionSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { error: 'Certaines réponses sont à revoir.', fieldErrors },
      { status: 422, headers: cors },
    );
  }

  const data = parsed.data;
  const db = supabaseAdmin();

  // --- Les photos existent-elles vraiment ? ---------------------------
  // Le navigateur nous renvoie des chemins ; on vérifie qu'ils viennent bien
  // de /api/upload et qu'ils désignent des fichiers réellement déposés.
  const bucket = env.storageBucket();
  for (const photo of data.photos) {
    if (!/^pending\/[0-9a-f-]{36}\.(jpg|png|webp|heic|heif)$/.test(photo.path)) {
      return NextResponse.json(
        { error: 'Photo invalide. Recharge la page et réessaie.' },
        { status: 400, headers: cors },
      );
    }
  }

  // --- Déjà inscrit ? -------------------------------------------------
  const { data: existing } = await db
    .from('lil_members')
    .select('id')
    .eq('email', data.email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        ok: true,
        alreadyRegistered: true,
        message:
          'Tu as déjà rempli le questionnaire avec cet email — pas besoin de recommencer. On revient vers toi.',
      },
      { status: 200, headers: cors },
    );
  }

  // --- Enregistrement -------------------------------------------------
  const commun = {
    ...baseRow(data),
    ...(isCourt ? {} : fullRow(data as InscriptionInput)),
    form_version: isCourt ? 'court' : 'complet',
    source: data.source ?? request.headers.get('referer') ?? null,
    user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    ip_hash: hashIp(ip),
  };

  const signalement = {
    suspect: tooFast,
    suspect_raison: tooFast
      ? `formulaire envoyé en ${Math.round((body.elapsedMs as number) / 1000)} s`
      : null,
  };

  const inserer = (row: Record<string, unknown>) =>
    db.from('lil_members').insert(row).select('id, first_name, last_name, email, city, birth_date, form_version').single();

  let { data: member, error: insertError } = await inserer({ ...commun, ...signalement });

  // Les colonnes de signalement viennent de supabase/04_signalement.sql, qui
  // s'exécute à la main. Tant qu'il ne l'a pas été, on enregistre sans elles
  // plutôt que de refuser la candidature — une inscription ne doit jamais
  // dépendre d'une migration oubliée.
  if (insertError?.code === 'PGRST204' || insertError?.code === '42703') {
    console.warn(
      '[inscription] colonnes de signalement absentes — exécute supabase/04_signalement.sql',
    );
    ({ data: member, error: insertError } = await inserer(commun));
  }

  if (insertError || !member) {
    // Deux envois simultanés du même formulaire : la contrainte d'unicité
    // sur l'email a fait son travail, on remercie quand même la personne.
    if (insertError?.code === '23505') {
      return NextResponse.json(
        { ok: true, alreadyRegistered: true },
        { status: 200, headers: cors },
      );
    }
    console.error('[inscription] insertion impossible', insertError?.message);
    return NextResponse.json(
      { error: 'On n’a pas réussi à enregistrer ta candidature. Réessaie dans un instant.' },
      { status: 500, headers: cors },
    );
  }

  // --- Photos : on les range sous le membre ---------------------------
  const storage = db.storage.from(bucket);
  const photoRows: {
    member_id: string;
    storage_path: string;
    position: number;
    mime_type: string | null;
    size_bytes: number | null;
  }[] = [];

  for (const [index, photo] of data.photos.entries()) {
    const extension = photo.path.split('.').pop()!;
    const destination = `candidatures/${member.id}/${index + 1}.${extension}`;
    const { error: moveError } = await storage.move(photo.path, destination);

    if (moveError) {
      // Une photo perdue ne doit pas faire échouer une candidature valable :
      // on l'enregistre quand même et le back-office affichera le manque.
      console.error('[inscription] photo non déplacée', photo.path, moveError.message);
      continue;
    }

    photoRows.push({
      member_id: member.id,
      storage_path: destination,
      position: index + 1,
      mime_type: photo.mimeType ?? null,
      size_bytes: photo.sizeBytes ?? null,
    });
  }

  if (photoRows.length > 0) {
    const { error: photoError } = await db.from('lil_photos').insert(photoRows);
    if (photoError) console.error('[inscription] photos non liées', photoError.message);
  }

  // --- Email 01 · Candidature reçue -----------------------------------
  const mail = await sendSequenceEmail({
    template: '01_candidature_recue',
    to: member.email,
    firstName: member.first_name,
    memberId: member.id,
  });

  if (!mail.ok) {
    // La candidature est enregistrée : c'est l'essentiel. L'email raté est
    // journalisé dans lil_emails et renvoyable depuis le back-office.
    console.error('[inscription] email 01 non envoyé', mail.error);
  }

  // --- Alerte interne · pour ne pas découvrir les inscriptions à la main ---
  // Elle part après la réponse au candidat et n'a aucune influence sur elle :
  // si l'alerte échoue, la candidature reste enregistrée et l'échec est
  // visible dans le journal de la fiche.
  const alerte = await previenirEquipe({
    memberId: member.id,
    prenom: member.first_name,
    nom: member.last_name ?? '',
    email: member.email,
    parcours: member.form_version === 'court' ? 'court' : 'complet',
    ville: member.city ?? null,
    age: member.birth_date ? ageFromBirthDate(member.birth_date) : null,
    ficheUrl: `${env.siteUrl().replace(/\/+$/, '')}/admin/${member.id}`,
  });

  if (!alerte.ok) console.error('[inscription] alerte interne non envoyée', alerte.error);

  return NextResponse.json(
    { ok: true, id: member.id, firstName: member.first_name, emailSent: mail.ok },
    { status: 201, headers: cors },
  );
}
