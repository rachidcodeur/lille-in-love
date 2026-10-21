import { BLOCS, remplisMatching, CHAMPS, type ReponsesMatching } from '@/lib/matching';

/**
 * Les réponses du formulaire avancé, sur la fiche.
 *
 * Repliées par défaut : la curation se fait sur les photos et les
 * quelques mots de la candidature, pas sur trente lignes de préférences.
 * On les ouvre quand on cherche quelqu'un pour quelqu'un.
 *
 * Les réponses sensibles portent une mention et la date du consentement :
 * si l'on nous demande un jour sur quelle base elles ont été recueillies,
 * la réponse est à côté d'elles.
 */
export function FicheMatching({
  optin,
  reponses,
  consentLe,
}: {
  optin: boolean | null;
  reponses: ReponsesMatching;
  consentLe: string | null;
}) {
  // Jamais proposé : les candidatures d'avant ce formulaire.
  if (optin === null) return null;

  if (optin === false) {
    return (
      <p className="adm-hint adm-matching-non">
        N’a pas souhaité le service de matching sur mesure.
      </p>
    );
  }

  const remplis = remplisMatching(reponses);
  const libelle = (nom: string, valeur: string) => {
    const champ = CHAMPS.find((c) => c.nom === nom);
    return champ?.options?.find((o) => o.valeur === valeur)?.libelle ?? valeur;
  };

  return (
    <details className="adm-card adm-matching">
      <summary>
        <span className="adm-card-title">Matching sur mesure</span>
        <span className="adm-hint">
          {remplis} réponse{remplis > 1 ? 's' : ''}
          {consentLe && ' · données sensibles acceptées'}
        </span>
      </summary>

      {consentLe && (
        <p className="adm-hint adm-matching-consent">
          Consentement aux données sensibles donné le{' '}
          {new Date(consentLe).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}.
        </p>
      )}

      {BLOCS.map((bloc) => {
        const dits = bloc.champs.filter((c) => {
          const v = reponses[c.nom];
          return Array.isArray(v) ? v.length > 0 : Boolean(v);
        });
        if (dits.length === 0) return null;

        return (
          <section className="adm-matching-bloc" key={bloc.id}>
            <h3>
              {bloc.titre}
              {bloc.sensible && <span className="adm-matching-tag">sensible</span>}
            </h3>
            <dl>
              {dits.map((champ) => {
                const v = reponses[champ.nom];
                return (
                  <div key={champ.nom}>
                    <dt>{champ.libelle}</dt>
                    <dd>
                      {Array.isArray(v)
                        ? v.map((x) => libelle(champ.nom, x)).join(' · ')
                        : libelle(champ.nom, v as string)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}
    </details>
  );
}
