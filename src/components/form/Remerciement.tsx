import { BRAND } from '@/lib/brand';
import { PartagerInscription } from './PartagerInscription';
import { ServiceMatching } from './ServiceMatching';

type Props = {
  /** Le prénom, quand on le connaît : on tutoie quelqu'un, pas un formulaire. */
  firstName?: string;
  /** Cette adresse avait déjà servi : on le dit plutôt que de faire semblant. */
  deja?: boolean;
  /** Ce qui a permis de reconnaître la personne : son email ou son numéro. */
  motif?: 'email' | 'telephone';
  /**
   * Le jeton rendu à l'envoi, qui autorise à compléter le matching.
   * Absent sur la page /merci ouverte directement : on ne propose le
   * service qu'à celui qui vient d'envoyer sa candidature.
   */
  matchingToken?: string | null;
};

/**
 * Le remerciement, après l'envoi.
 *
 * Écrit une seule fois : le formulaire l'affiche sur place, et /merci le
 * reprend mot pour mot — une page qu'on peut partager, mettre en favori, ou
 * vers laquelle rediriger depuis ailleurs.
 *
 * Une copie autonome existe pour la page WordPress :
 * docs/merci-wordpress.html. Si le texte change ici, change-le là aussi.
 */
export function Remerciement({
  firstName,
  deja = false,
  motif = 'email',
  matchingToken = null,
}: Props) {
  const prenom = firstName ? `, ${firstName}` : '';

  return (
    <>
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
            {motif === 'telephone'
              ? 'Ce numéro est déjà associé à une candidature — pas besoin de recommencer.'
              : 'Tu as déjà rempli le questionnaire avec cet email — pas besoin de recommencer.'}{' '}
            Ta candidature est bien dans nos mains.
          </p>
        </>
      ) : (
        <>
          <h2 className="lil-done-title">C’est envoyé{prenom}</h2>
          <p className="lil-done-text">
            On vient de t’envoyer un mail. Chez nous, pas d’algorithme : on lit chaque profil à
            la main, un par un. C’est plus lent, et c’est exactement ce qui nous différencie des
            sites de rencontres — c’est aussi ce qui fait que les rencontres se passent bien.
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

      {/* Le partage vient ici, et plus au milieu des questions : on
          pense à quelqu'un une fois qu'on a soi-même fini, pas pendant
          qu'on remplit. */}
      <PartagerInscription />

      {/* Après l'encart, et seulement pour qui vient d'envoyer : la
          candidature est en sécurité avant qu'on propose quoi que ce
          soit. */}
      {!deja && matchingToken && <ServiceMatching token={matchingToken} />}
    </>
  );
}
