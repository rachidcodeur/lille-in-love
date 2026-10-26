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
 *
 * Le questionnaire bouge — des questions s'ajoutent, se renomment, se
 * replient dans une autre. Cet affichage ne suppose donc jamais que ce
 * qu'il lit correspond à ce qu'il connaît : ce qu'il ne reconnaît pas
 * s'affiche quand même, à la fin. Une réponse donnée ne doit pas
 * disparaître de la fiche parce qu'on a reformulé la question.
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

  const dite = (nom: string) => {
    const v = reponses[nom];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  };

  const libelle = (nom: string, valeur: string) => {
    const champ = CHAMPS.find((c) => c.nom === nom);
    return champ?.options?.find((o) => o.valeur === valeur)?.libelle ?? valeur;
  };

  const lire = (nom: string) => {
    const v = reponses[nom];
    return Array.isArray(v) ? v.map((x) => libelle(nom, x)).join(' · ') : libelle(nom, v as string);
  };

  /**
   * « Dis-nous plus » n'est pas une question : c'est la fin de celle du
   * dessus. Affichée seule, elle donnait une ligne « Dis-nous plus ·
   * Chauffeur de bus » dont on ne savait plus de quoi elle répondait.
   * Elle rejoint donc sa question : « Autre — Chauffeur de bus ».
   */
  const precisions = new Map<string, string[]>();
  for (const champ of CHAMPS) {
    if (!champ.siOption || !dite(champ.nom)) continue;
    const parent = champ.siOption.champ;
    precisions.set(parent, [...(precisions.get(parent) ?? []), lire(champ.nom)]);
  }

  // Ce que les blocs ne montrent pas : des questions d'une version
  // précédente du formulaire, ou une clé qu'on ne connaît plus.
  const connus = new Set(CHAMPS.map((c) => c.nom));
  const orphelines = Object.keys(reponses).filter(
    (nom) => nom !== 'consentSensible' && !connus.has(nom) && dite(nom),
  );

  const remplis = remplisMatching(reponses) + orphelines.length;

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
        const dits = bloc.champs.filter((c) => !c.siOption && dite(c.nom));
        if (dits.length === 0) return null;

        return (
          <section className="adm-matching-bloc" key={bloc.id}>
            <h3>
              {bloc.titre}
              {bloc.sensible && <span className="adm-matching-tag">sensible</span>}
            </h3>
            <dl>
              {dits.map((champ) => {
                const suite = precisions.get(champ.nom);
                return (
                  <div key={champ.nom}>
                    <dt>
                      {champ.libelle}
                      {/* Un champ peut être sensible dans un bloc qui ne
                          l'est pas — « qu'est-ce qui te fait craquer »
                          touche à la couleur de peau. La mention se pose
                          donc aussi sur la ligne. */}
                      {!bloc.sensible && champ.sensible && (
                        <span className="adm-matching-tag">sensible</span>
                      )}
                    </dt>
                    <dd>
                      {lire(champ.nom)}
                      {suite && ` — ${suite.join(' · ')}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}

      {orphelines.length > 0 && (
        <section className="adm-matching-bloc adm-matching-anciennes">
          <h3>Réponses à des questions retirées</h3>
          <p className="adm-hint">
            Le questionnaire a changé depuis. On les garde telles quelles.
          </p>
          <dl>
            {orphelines.map((nom) => (
              <div key={nom}>
                <dt>{nom}</dt>
                <dd>{lire(nom)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </details>
  );
}
