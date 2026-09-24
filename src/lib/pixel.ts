/**
 * Les événements envoyés au pixel Meta.
 *
 * Volontairement minuscule : on ne transmet ni prénom, ni email, ni réponse
 * au questionnaire — seulement le fait qu'une candidature a été envoyée.
 *
 * Ne tourne que dans le navigateur, et ne fait rien si le pixel n'est pas
 * chargé (bloqueur de publicité, suivi coupé, test automatisé).
 */

type Fbq = (action: string, evenement: string, donnees?: unknown, options?: unknown) => void;

export function suivreCandidature(identifiant?: string): void {
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== 'function') return;

  try {
    // « eventID » permet à Meta de reconnaître un même envoi compté deux
    // fois — un rechargement, un double clic — et de ne le garder qu'une.
    fbq('track', 'Lead', { content_name: 'Candidature Lille in Love' }, identifiant ? { eventID: identifiant } : undefined);
  } catch {
    /* le suivi ne doit jamais empêcher une inscription d'aboutir */
  }
}
