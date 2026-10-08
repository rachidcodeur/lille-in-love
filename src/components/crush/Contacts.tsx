import { lienWhatsApp } from '@/lib/crush-regles';

/**
 * De quoi se retrouver après la soirée.
 *
 * WhatsApp en premier, le numéro ensuite, l'Instagram en dernier : c'est
 * l'ordre dans lequel on écrit à quelqu'un rencontré la veille. L'adresse
 * email n'y est plus du tout — personne n'écrit un mail au lendemain d'une
 * soirée, et une adresse en dit souvent plus sur l'identité qu'un numéro.
 *
 * Le bouton WhatsApp ne s'affiche que si le numéro se traduit sans
 * supposition. Le numéro reste de toute façon sur la ligne d'en dessous :
 * il se lit, se copie, et marche partout.
 */
export function Contacts({
  phone,
  instagram,
  classe,
}: {
  phone?: string | null;
  instagram?: string | null;
  classe: string;
}) {
  const whatsapp = lienWhatsApp(phone);
  const pseudo = instagram ? instagram.replace(/^@/, '') : null;

  // Quelqu'un venu de la billetterie sans jamais avoir rempli le formulaire
  // n'a ni numéro ni Instagram : sa fiche ne contient que son prénom. Le
  // match est réel, le moyen de le prolonger manque — et il vaut mieux le
  // dire que laisser un bloc vide qu'on prend pour un écran qui charge.
  if (!phone && !pseudo) {
    return (
      <p className="cr-contact-vide">
        Sa fiche ne donne aucun moyen de la recontacter. C’est le moment d’aller lui parler.
      </p>
    );
  }

  return (
    <div className={`${classe}s cr-contacts`}>
      {whatsapp && (
        <a className={`${classe} cr-contact`} href={whatsapp} target="_blank" rel="noreferrer">
          <IconeWhatsApp />
          <span>WhatsApp</span>
        </a>
      )}
      {phone && (
        <a className={`${classe} cr-contact`} href={`tel:${phone}`}>
          <IconeTelephone />
          <span>{phone}</span>
        </a>
      )}
      {pseudo && (
        <a
          className={`${classe} cr-contact`}
          href={`https://instagram.com/${pseudo}`}
          target="_blank"
          rel="noreferrer"
        >
          <IconeInstagram />
          <span>@{pseudo}</span>
        </a>
      )}
    </div>
  );
}

function IconeWhatsApp() {
  return (
    <svg className="cr-contact-icone" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.03 1.02-1.03 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.27-.2-.57-.34M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37A9.86 9.86 0 0 1 2.16 11.9c0-5.45 4.44-9.88 9.9-9.88 2.63 0 5.12 1.03 6.98 2.9a9.83 9.83 0 0 1 2.9 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.9 0-3.17-1.23-6.15-3.48-8.4Z" />
    </svg>
  );
}

function IconeTelephone() {
  return (
    <svg className="cr-contact-icone" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.6 10.8a16.5 16.5 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z" />
    </svg>
  );
}

function IconeInstagram() {
  return (
    <svg className="cr-contact-icone" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.86s0 3.6-.07 4.86c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.86.07s-3.6 0-4.86-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.6 2.2 15.2 2.2 12s0-3.6.07-4.86c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.4 2.21 8.8 2.2 12 2.2Zm0 3.1a6.7 6.7 0 1 0 0 13.4 6.7 6.7 0 0 0 0-13.4Zm0 11.05a4.35 4.35 0 1 1 0-8.7 4.35 4.35 0 0 1 0 8.7Zm6.96-11.31a1.56 1.56 0 1 1-3.13 0 1.56 1.56 0 0 1 3.13 0Z" />
    </svg>
  );
}
