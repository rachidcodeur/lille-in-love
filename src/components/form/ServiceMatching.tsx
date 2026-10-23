'use client';

import { useState } from 'react';
import { champsManquants } from '@/lib/matching';
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
  const [manques, setManques] = useState<string[]>([]);

  /**
   * Le « oui » vaut consentement.
   *
   * Il n'y a plus de case à cocher en tête du formulaire : la carte
   * annonce ce qu'on va demander, origines et religion comprises, et le
   * bouton est l'acte par lequel on l'accepte. Rien n'est perdu au
   * passage — refuser le service reste possible, et c'est ce qui rend
   * l'accord libre.
   */
  function accepter() {
    setValeurs({ ...valeurs, consentSensible: true });
    setEtat('remplit');
  }

  async function envoyer() {
    // Le service est facultatif, ses questions ne le sont pas : un
    // formulaire vide partait sans rien dire, et ne servait à personne.
    const vides = champsManquants(valeurs);
    if (vides.length > 0) {
      setManques(vides);
      setSouci(
        vides.length === 1
          ? 'Il reste une question sans réponse.'
          : `Il reste ${vides.length} questions sans réponse.`,
      );
      document
        .querySelector(`.lil-matching-champ[data-nom="${vides[0]}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setOccupe(true);
    setSouci(null);
    setManques([]);
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
          Réponds à tout&nbsp;: c’est sur ces réponses, et rien d’autre, qu’on cherchera.
        </p>

        <Confidentialite />

        <MatchingAvance valeurs={valeurs} onChange={setValeurs} manques={manques} />

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
      </section>
    );
  }

  return (
    <section className="lil-service lil-service-offre">
      <p className="lil-service-chapeau">Nouveauté</p>
      <h2 className="lil-service-titre">Service de matching personnalisé</h2>

      <p className="lil-done-text">
        Nos rencontres réunissent des profils choisis un par un, et c’est déjà beaucoup. Si tu
        veux aller plus loin, on peut chercher pour toi dans tout notre réseau, sur les critères
        que tu nous donnes.
      </p>
      <p className="lil-done-text">
        Tu nous dis ce qui compte vraiment — fumeur ou non, avec ou sans enfants, origines,
        religion, style de vie, ce à quoi tu es sensible — et on ne te présente que des personnes
        qui correspondent. Avec leurs photos et leur profil, avant même de vous rencontrer.
      </p>
      <p className="lil-done-note">
        C’est sans engagement, et ta candidature est déjà enregistrée&nbsp;: tu peux refuser sans
        rien perdre. En acceptant, tu acceptes aussi de répondre à des questions sur tes origines
        et sur la religion&nbsp;; elles ne servent qu’à te présenter quelqu’un, et tu peux nous
        demander de les effacer quand tu veux.
      </p>

      <div className="lil-service-choix">
        <button type="button" className="lil-btn" onClick={accepter}>
          Oui, ça m’intéresse
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
