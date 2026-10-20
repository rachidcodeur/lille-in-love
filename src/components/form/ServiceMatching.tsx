'use client';

import { useState } from 'react';
import { MatchingAvance, type BrouillonMatching } from './MatchingAvance';

/**
 * Le service de matching, proposé une fois la candidature partie.
 *
 * Il était la dernière étape de l'inscription. Le mettre après change
 * tout : la candidature est en sécurité avant qu'on propose quoi que ce
 * soit, et personne n'a plus à refuser une offre pour pouvoir envoyer.
 * Ce qui se lit ici se lit l'esprit tranquille.
 *
 * Trois états, dans cet ordre : la proposition, les questions, le merci.
 */
export function ServiceMatching({ token }: { token: string }) {
  const [etat, setEtat] = useState<'propose' | 'remplit' | 'envoye' | 'refuse'>('propose');
  const [valeurs, setValeurs] = useState<BrouillonMatching>({});
  const [occupe, setOccupe] = useState(false);
  const [souci, setSouci] = useState<string | null>(null);

  const consent = valeurs.consentSensible === true;

  async function envoyer() {
    setOccupe(true);
    setSouci(null);
    try {
      const r = await fetch('/api/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reponses: valeurs }),
      });
      if (!r.ok) throw new Error('refus');
      setEtat('envoye');
    } catch {
      setSouci('L’envoi n’a pas abouti. Réessaie dans un instant.');
    } finally {
      setOccupe(false);
    }
  }

  // Refusé : la carte s'efface, et le remerciement reste seul. On ne
  // renvoie nulle part — la candidature vient d'être envoyée, il n'y a
  // rien d'autre à faire.
  if (etat === 'refuse') return null;

  if (etat === 'envoye') {
    return (
      <section className="lil-service lil-service-merci">
        <h2 className="lil-service-titre">C’est noté, merci.</h2>
        <p className="lil-done-text">
          On a tout ce qu’il faut pour commencer à chercher. On revient vers toi dès qu’on a
          quelqu’un à te présenter.
        </p>
      </section>
    );
  }

  if (etat === 'remplit') {
    return (
      <section className="lil-service">
        <h2 className="lil-service-titre">Parle-nous de la personne que tu cherches</h2>
        <p className="lil-done-text">
          Rien n’est obligatoire. Plus tu en dis, plus on cherche juste.
        </p>

        <Confidentialite />

        {/* En tête, avant la première question : on sait à quoi on
            s'engage avant de commencer, et plus rien ne s'ouvre ni ne se
            ferme en cours de route. */}
        <label className="lil-consent lil-service-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setValeurs({ ...valeurs, consentSensible: e.target.checked })}
          />
          <span>
            J’accepte de répondre à des questions sur mes origines et sur la religion. La loi les
            range parmi les informations sensibles&nbsp;: elles ne servent qu’à te présenter
            quelqu’un, et je peux les retirer quand je veux.
          </span>
        </label>

        {consent ? (
          <>
            <MatchingAvance valeurs={valeurs} onChange={setValeurs} />

            {souci && (
              <p className="lil-error" role="alert">
                <span aria-hidden="true">↳</span>
                <span>{souci}</span>
              </p>
            )}

            <button
              type="button"
              className="lil-btn lil-service-envoyer"
              disabled={occupe}
              onClick={envoyer}
            >
              {occupe ? 'Un instant…' : 'Envoyer mes réponses'}
            </button>
          </>
        ) : (
          <p className="lil-field-help lil-service-attente">
            Coche la case ci-dessus pour afficher les questions.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="lil-service lil-service-offre">
      <p className="lil-service-chapeau">Pour aller plus loin</p>
      <h2 className="lil-service-titre">On peut aussi chercher pour toi</h2>

      <p className="lil-done-text">
        Les rencontres, c’est le hasard d’un soir, et c’est très bien comme ça. Mais si tu
        préfères ne pas attendre le hasard, on peut chercher pour toi dans tout notre réseau.
      </p>
      <p className="lil-done-text">
        Tu nous dis ce qui compte vraiment — fumeur ou non, avec ou sans enfants, origines,
        religion, style de vie, ce à quoi tu es sensible — et on ne te présente que des personnes
        qui correspondent. Avec leurs photos et leur profil, avant même de vous rencontrer.
      </p>
      <p className="lil-done-note">
        C’est sans engagement, et ta candidature est déjà enregistrée&nbsp;: tu peux refuser sans
        rien perdre.
      </p>

      <div className="lil-service-choix">
        <button type="button" className="lil-btn" onClick={() => setEtat('remplit')}>
          Oui, cherchez pour moi
        </button>
        <button type="button" className="lil-btn-secondaire" onClick={() => setEtat('refuse')}>
          Non merci
        </button>
      </div>
    </section>
  );
}

/**
 * La mention qui dit qui lit tout ça.
 *
 * Écrite une fois, affichée dans les deux formulaires : quelqu'un qui
 * raconte sa vie veut savoir où elle va, et c'est la question qu'on se
 * pose juste avant de renoncer à répondre.
 */
export function Confidentialite() {
  return (
    <p className="lil-confidentialite">
      Tout ce que tu écris reste entre nous. Seuls les deux membres de l’équipe qui lisent les
      candidatures y ont accès — rien n’est publié, rien n’est revendu, et tu peux nous demander
      d’effacer tes réponses quand tu veux.
    </p>
  );
}
