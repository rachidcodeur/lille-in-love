/**
 * Les pictogrammes du back-office.
 *
 * Tracés à la main plutôt qu'importés : une douzaine de traits ne justifie
 * pas une dépendance, et ils partent avec le HTML — aucun chargement, aucun
 * clignotement au premier affichage.
 */

export type NomIcone =
  | 'personne'
  | 'calendrier'
  | 'lieu'
  | 'coeur'
  | 'enfants'
  | 'loupe'
  | 'taille'
  | 'mallette'
  | 'etoile'
  | 'instagram'
  | 'avion'
  | 'duo'
  | 'enveloppe'
  | 'image';

const TRACES: Record<NomIcone, React.ReactNode> = {
  personne: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  calendrier: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  lieu: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  coeur: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />,
  enfants: (
    <>
      <circle cx="9" cy="7" r="3" />
      <circle cx="17" cy="10" r="2" />
      <path d="M3 20a6 6 0 0 1 12 0M15 20a4 4 0 0 1 6 0" />
    </>
  ),
  loupe: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  taille: <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />,
  mallette: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </>
  ),
  etoile: <path d="m12 3 2.6 5.6 5.4.7-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.4-.7z" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" />
    </>
  ),
  avion: <path d="M3 11l18-8-8 18-2-8z" />,
  duo: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
    </>
  ),
  enveloppe: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m21 16-5-5-8 8" />
    </>
  ),
};

export function Icone({ nom, taille = 16 }: { nom: NomIcone; taille?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACES[nom]}
    </svg>
  );
}
