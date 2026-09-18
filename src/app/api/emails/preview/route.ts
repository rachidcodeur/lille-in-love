import { NextResponse } from 'next/server';
import { buildEmail, TEMPLATE_LABELS, type TemplateId } from '@/emails/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Aperçu des emails de la séquence, dans le navigateur.
 *
 *   /api/emails/preview?template=02_bienvenue&prenom=Camille
 *
 * Ouvert en local. En production, protégé par EMAIL_PREVIEW_TOKEN — sans ce
 * jeton configuré, la route reste fermée.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (process.env.NODE_ENV === 'production') {
    const expected = process.env.EMAIL_PREVIEW_TOKEN;
    if (!expected || url.searchParams.get('token') !== expected) {
      return new NextResponse('Non disponible.', { status: 404 });
    }
  }

  const template = url.searchParams.get('template') as TemplateId | null;
  const firstName = url.searchParams.get('prenom') || 'Camille';

  if (!template || !(template in TEMPLATE_LABELS)) {
    const links = (Object.keys(TEMPLATE_LABELS) as TemplateId[])
      .map(
        (id) =>
          `<li style="margin:0 0 10px"><a href="?template=${id}&prenom=${encodeURIComponent(
            firstName,
          )}">${TEMPLATE_LABELS[id]}</a></li>`,
      )
      .join('');
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><title>Aperçu des emails</title>
       <body style="font-family:system-ui;max-width:640px;margin:60px auto;padding:0 20px;color:#1C130F">
       <h1 style="font-size:22px">Séquence email — aperçu</h1>
       <ul style="line-height:1.7;padding-left:20px">${links}</ul>
       <p style="color:#77664C;font-size:14px">Ajoute <code>&amp;prenom=Sofia</code> pour changer le prénom.</p>
       </body>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const trancheAge = url.searchParams.get('tranche') || undefined;
  const { subject, html } = buildEmail(template, { firstName, trancheAge });

  // L'objet est rappelé en tête : c'est lui qu'on relit le plus souvent.
  const banner = `<div style="font-family:system-ui;background:#1C130F;color:#E4D6B4;padding:12px 18px;font-size:13px">
    <strong>Objet :</strong> ${subject}
  </div>`;

  return new NextResponse(banner + html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
