import { BRAND } from '@/lib/brand';

type Props = {
  /** Le prénom, quand on le connaît : on tutoie quelqu'un, pas un formulaire. */
  firstName?: string;
  /** Cette adresse avait déjà servi : on le dit plutôt que de faire semblant. */
  deja?: boolean;
};

/**
 * Le remerciement, après l'envoi.
 *
 * Écrit une seule fois : le formulaire l'affiche sur place, et /merci le
 * reprend mot pour mot — une page qu'on peut partager, mettre en favori, ou
 * vers laquelle rediriger depuis ailleurs.
 */
export function Remerciement({ firstName, deja = false }: Props) {
  const prenom = firstName ? `, ${firstName}` : '';

  return (
    <div className="lil-done lil-step">
      <div className="lil-done-seal" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 12.5l5 5L20 6.5"
            stroke="#A8946E"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {deja ? (
        <>
          <h2 className="lil-done-title">On t’a déjà{prenom}</h2>
          <p className="lil-done-text">
            Tu as déjà rempli le questionnaire avec cet email — pas besoin de recommencer. Ta
            candidature est bien dans nos mains.
          </p>
        </>
      ) : (
        <>
          <h2 className="lil-done-title">C’est envoyé{prenom}</h2>
          <p className="lil-done-text">
            On vient de t’écrire pour confirmer. Chez nous, pas d’algorithme : on lit chaque
            profil à la main. C’est plus lent, mais c’est exactement ce qui fait que les soirées
            se passent bien.
          </p>
          <p className="lil-done-text">
            On revient vers toi très vite. D’ici là, tu n’as rien à faire.
          </p>
        </>
      )}

      <p className="lil-done-note">
        Rien reçu&nbsp;? Regarde dans tes spams, ou écris-nous à{' '}
        <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>.
      </p>
    </div>
  );
}
