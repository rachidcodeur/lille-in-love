import type { Depouillement } from '@/lib/questionnaire';

/**
 * Les réponses au questionnaire, dépouillées.
 *
 * Lisible sans tableur : l'hôte veut savoir, le lendemain matin, ce qui a
 * plu et ce qui a manqué. Le CSV reste là pour qui veut croiser.
 *
 * Les prénoms n'apparaissent pas. Ils sont en base — il faut bien
 * distinguer deux réponses — mais un avis se donne plus librement quand
 * il ne s'affiche pas à côté de son nom.
 */
export function CrushBilan({
  soireeId,
  reponses,
  depouillement,
  participants,
}: {
  soireeId: string;
  reponses: number;
  depouillement: Depouillement[];
  participants: number;
}) {
  if (reponses === 0) {
    return (
      <section className="adm-card">
        <h2 className="adm-card-title">Questionnaire de fin de soirée</h2>
        <p className="adm-hint" style={{ marginTop: 8 }}>
          Aucune réponse pour l’instant. Le questionnaire s’ouvre dans l’application dès que les
          trois crush times sont passés.
        </p>
      </section>
    );
  }

  const note = depouillement.find((d) => d.moyenne !== undefined);

  return (
    <section className="adm-card">
      <h2 className="adm-card-title">Questionnaire de fin de soirée</h2>

      <p className="adm-bilan-compte">
        <b>{reponses}</b> réponse{reponses > 1 ? 's' : ''} sur {participants} participant
        {participants > 1 ? 's' : ''}
        {note?.moyenne !== undefined && (
          <>
            {' · '}
            <b>{note.moyenne}/10</b> de recommandation
          </>
        )}
      </p>

      <a
        className="adm-btn"
        href={`/api/admin/questionnaire?soiree=${soireeId}`}
        download
        style={{ marginTop: 12, display: 'inline-block' }}
      >
        Télécharger les réponses (CSV)
      </a>

      {depouillement.map(({ question, comptes, textes, moyenne }) => {
        const total = comptes.reduce((t, c) => t + c.nombre, 0);
        if (total === 0 && textes.length === 0 && moyenne === undefined) return null;

        return (
          <div className="adm-bilan-q" key={question.id}>
            <p className="adm-bilan-titre">
              <span className="adm-bilan-num">{question.numero}</span>
              {question.intitule}
            </p>

            {comptes
              .filter((c) => c.nombre > 0)
              // Le plus choisi en premier : c'est la réponse qu'on cherche.
              .sort((a, b) => b.nombre - a.nombre)
              .map((c) => (
                <div className="adm-bilan-ligne" key={c.libelle}>
                  <span className="adm-bilan-barre" aria-hidden="true">
                    <span style={{ width: `${Math.round((c.nombre / total) * 100)}%` }} />
                  </span>
                  <span className="adm-bilan-label">{c.libelle}</span>
                  <b>{c.nombre}</b>
                </div>
              ))}

            {moyenne !== undefined && <p className="adm-bilan-note">Moyenne : {moyenne} / 10</p>}

            {textes.map((t, i) => (
              <blockquote className="adm-bilan-mot" key={i}>
                {t}
              </blockquote>
            ))}
          </div>
        );
      })}
    </section>
  );
}
