/**
 * Gabarit commun aux emails.
 *
 * Tout est en HTML tableau + styles en ligne : c'est la seule chose que
 * Outlook et Gmail rendent de la même façon. Pas de police web (les clients
 * mail les bloquent presque tous), on s'appuie sur une pile système proche
 * de la Bricolage Grotesque du site.
 */

export const BRAND = {
  cream: '#FDFBF9',
  sand: '#F6F0E4',
  gold: '#C3B291',
  goldSoft: '#E4D6B4',
  ink: '#1C130F',
  inkSoft: '#5A4A3C',
  border: '#E7DCC5',
} as const;

const FONT =
  "'Bricolage Grotesque', 'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

export type EmailBlock = string;

/** Un paragraphe de corps de texte. */
export function p(html: string): EmailBlock {
  return `<p style="margin:0 0 18px;font-family:${FONT};font-size:16px;line-height:1.65;color:${BRAND.ink};">${html}</p>`;
}

/** Une accroche, plus grande, pour ouvrir le message. */
export function lead(html: string): EmailBlock {
  return `<p style="margin:0 0 22px;font-family:${FONT};font-size:20px;line-height:1.45;font-weight:600;color:${BRAND.ink};">${html}</p>`;
}

/** Un encart discret, pour une information pratique. */
export function note(html: string): EmailBlock {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
    <tr><td style="background:${BRAND.sand};border-left:3px solid ${BRAND.gold};padding:16px 18px;border-radius:0 6px 6px 0;">
      <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.inkSoft};">${html}</p>
    </td></tr>
  </table>`;
}

export function divider(): EmailBlock {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="padding:8px 0 26px;"><div style="height:1px;background:${BRAND.border};line-height:1px;font-size:0;">&nbsp;</div></td>
  </tr></table>`;
}

export function signature(): EmailBlock {
  return `<p style="margin:26px 0 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${BRAND.ink};font-weight:600;">Lille in Love</p>`;
}

type ShellOptions = {
  /** Reprise en haut du mail, affichée par Gmail à côté de l'objet. */
  preheader: string;
  body: EmailBlock[];
  footer?: string;
};

export function render({ preheader, body, footer }: ShellOptions): string {
  const footerHtml =
    footer ??
    `Une question ? Réponds simplement à ce mail, on lit tout.`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Lille in Love</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${BRAND.cream};">${escapeHtml(
    preheader,
  )}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <tr>
            <td align="center" style="padding:0 0 28px;">
              <span style="font-family:${FONT};font-size:13px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.gold};font-weight:600;">Lille in Love</span>
            </td>
          </tr>

          <tr>
            <td style="background:#FFFFFF;border:1px solid ${BRAND.border};border-radius:14px;padding:38px 34px 34px;">
              ${body.join('\n')}
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 12px 0;">
              <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${BRAND.inkSoft};">${footerHtml}</p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Version texte, construite à partir du HTML.
 * Beaucoup de filtres anti-spam notent mal un mail qui n'en a pas.
 */
export function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|tr|div|h[1-6])>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&zwnj;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // On coupe les lignes AVANT de réduire les blancs : sinon une ligne faite
    // d'espaces compte comme du contenu et les trous restent.
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
