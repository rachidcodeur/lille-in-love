import { createHash } from 'node:crypto';
import { env } from './env';

/**
 * Empreinte d'IP, jamais l'IP en clair.
 *
 * Sert uniquement à repérer les envois en rafale depuis une même source.
 * Salée, donc non réversible et non recoupable avec une autre base (RGPD).
 */
export function hashIp(ip: string | null): string | null {
  const salt = env.ipSalt();
  if (!ip || !salt) return null;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/** L'IP du visiteur derrière le proxy de l'hébergeur. */
export function clientIp(request: Request): string | null {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? null;
}

/**
 * Limitation de débit en mémoire.
 *
 * Suffisant pour le volume attendu (quelques dizaines d'inscriptions par jour)
 * et pour bloquer un script qui insiste. Sur plusieurs instances, chacune a son
 * compteur : c'est un garde-fou, pas un quota strict. Si le trafic grandit,
 * remplacer par un compteur dans Supabase ou Upstash sans changer l'appelant.
 */
const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    const retryAfterSeconds = Math.ceil((windowMs - (now - recent[0]!)) / 1000);
    hits.set(key, recent);
    return { ok: false, retryAfterSeconds };
  }

  recent.push(now);
  hits.set(key, recent);

  // Ménage occasionnel pour que la Map ne grossisse pas indéfiniment.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }

  return { ok: true, retryAfterSeconds: 0 };
}

/** En-têtes CORS pour les appels venus de la page WordPress. */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowed = env.allowedEmbedOrigins();
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
