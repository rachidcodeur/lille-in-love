'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Profil } from '@/lib/crush';
import { nomManche } from '@/lib/crush-regles';
import { Compte } from './Compte';
import { EVENEMENT_MATCH } from './CrushFete';

/**
 * Les profils de la manche, deux par rangée.
 *
 * Pas une pile de cartes qu'on balaie : dans une salle, on cherche la
 * personne à qui on vient de parler, et une grille se parcourt. Les visages
 * sont assez grands pour qu'on reconnaisse quelqu'un croisé il y a dix
 * minutes, et le détail s'ouvre d'un geste.
 *
 * Un seul like par crush time, sans retour en arrière. Un geste qui ne se
 * reprend pas se confirme : la carte s'ouvre, on lit le nom, on appuie.
 */
/**
 * Une présentation ramenée à ce qui se lit debout.
 *
 * Les candidatures contiennent parfois dix lignes. Personne ne les lit au
 * milieu d'une soirée, et une carte qui s'allonge repousse le bouton hors
 * de l'écran. On coupe au mot, pas au caractère.
 */
function court(texte: string, max = 140): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const dernierEspace = coupe.lastIndexOf(' ');
  return `${coupe.slice(0, dernierEspace > 60 ? dernierEspace : max).trimEnd()}…`;
}

/** « 22h00 » — lisible d'un coup d'œil, au fond d'une salle. */
const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function CrushProfils({
  numero,
  mancheId,
  profils,
  dejaLike,
  matchs,
  prochaine,
  fin,
}: {
  numero: number;
  /** Celle qui est ouverte : de quoi vérifier qu'elle l'est toujours. */
  mancheId: string;
  profils: Profil[];
  dejaLike: string | null;
  matchs: Profil[];
  /** L'heure annoncée du crush time suivant, s'il en reste un. */
  prochaine: string | null;
  /** L'instant où celui-ci se referme : quinze minutes, ça se regarde fondre. */
  fin: string | null;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState<Profil | null>(null);
  /**
   * Le profil sur lequel on vient d'appuyer, en attente d'un oui.
   *
   * Un like ne se reprend pas et il n'y en a qu'un par manche : c'est
   * exactement le genre de geste qu'un pouce fait tout seul en marchant.
   * L'écran redemande, en nommant la personne — c'est le nom qui fait voir
   * l'erreur quand on a visé la mauvaise carte.
   */
  const [aConfirmer, setAConfirmer] = useState<Profil | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  /**
   * Le choix, affiché avant que le serveur réponde.
   *
   * Écrire un like demande quelques allers-retours ; une seconde d'écran
   * immobile après un toucher se lit comme un clic raté, et on retouche.
   * On montre donc le résultat tout de suite, et on le reprend si le
   * serveur refuse — ce qui n'arrive que s'il y avait vraiment un problème.
   */
  const [choixLocal, setChoixLocal] = useState<string | null>(dejaLike);
  useEffect(() => setChoixLocal(dejaLike), [dejaLike]);

  /**
   * La manche a-t-elle expiré sous nos yeux ?
   *
   * Quinze minutes passent, et l'écran ne le sait pas tout de suite : la
   * veille ne repasse que toutes les huit secondes. Dans cet intervalle, un
   * cœur touché devenait rose, puis redevenait vide quand le serveur
   * répondait que le crush time était fini. Ce rose-là n'aurait jamais dû
   * exister : il annonce un choix qui ne peut pas aboutir.
   *
   * On tient donc l'heure de fin côté écran, et les cœurs disparaissent à
   * la seconde où elle tombe — avant même que le serveur ait son mot à
   * dire.
   */
  const [termine, setTermine] = useState(false);
  useEffect(() => {
    if (!fin) return setTermine(false);
    const reste = new Date(fin).getTime() - Date.now();
    if (reste <= 0) return setTermine(true);
    setTermine(false);
    const minuterie = setTimeout(() => setTermine(true), reste);
    return () => clearTimeout(minuterie);
  }, [fin]);

  const dejaMatche = new Set(matchs.map((m) => m.id));

  /**
   * Les matchs en tête, le reste derrière.
   *
   * Deux listes mises bout à bout, et jamais un tri sur place : à l'intérieur
   * de chaque groupe, l'ordre reste celui que le serveur a rendu, qui ne
   * bouge plus. C'est ce qui fait qu'une carte reste où on l'a laissée.
   */
  const ranges = [
    ...profils.filter((p) => dejaMatche.has(p.id)),
    ...profils.filter((p) => !dejaMatche.has(p.id)),
  ];
  const choisi = profils.find((p) => p.id === choixLocal) ?? null;
  /**
   * Le like est-il seulement possible ?
   *
   * « choixLocal » et non « dejaLike » : entre le oui et la réponse du
   * serveur, le choix est fait pour qui regarde l'écran, et la fiche d'un
   * autre profil ne doit plus proposer d'en choisir un second.
   */
  const peutLiker = !choixLocal && !termine;

  /**
   * Pendant qu'on lit la demande, on vérifie que la manche tient toujours.
   *
   * L'hôte peut l'abréger, et l'écran ne l'apprendrait qu'à la prochaine
   * ronde de la veille. Sans ça, le oui peignait un cœur en rose pour un
   * like que le serveur allait refuser. Le temps de lecture ne coûte rien
   * à personne : il serait passé de toute façon.
   */
  useEffect(() => {
    if (!aConfirmer) return;
    let vivant = true;

    fetch('/api/crush/etat', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((etat: { manche?: string | null } | null) => {
        if (!vivant || !etat) return;
        if (etat.manche !== mancheId) {
          setAConfirmer(null);
          setTermine(true);
        }
      })
      .catch(() => {
        /* réseau de salle : on laisse passer, le serveur tranchera */
      });

    return () => {
      vivant = false;
    };
  }, [aConfirmer, mancheId]);

  /** Appuyer ne choisit pas : ça demande. Le oui vient après. */
  function demander(profil: Profil) {
    if (!peutLiker) return;
    setOuvert(null);
    setErreur(null);
    setAConfirmer(profil);
  }

  async function liker(profil: Profil) {
    // Le cœur se remplit avant l'aller-retour : c'est ce qui fait la
    // différence entre « c'est fait » et « est-ce que ça a marché ? ».
    // Mais seulement quand le choix peut aboutir — sinon on peindrait en
    // rose quelque chose qu'il faudrait effacer trois cents millisecondes
    // plus tard.
    if (!peutLiker) return;
    setChoixLocal(profil.id);
    setAConfirmer(null);
    setOuvert(null);
    setErreur(null);

    const r = await fetch('/api/crush/liker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versId: profil.id }),
    }).catch(() => null);

    const res = (await r?.json().catch(() => null)) as
      | { error?: string; match?: Profil | null }
      | null;

    if (!r?.ok) {
      // On reprend ce qu'on avait montré : laisser croire à un choix qui
      // n'existe pas en base ferait attendre un match impossible.
      setChoixLocal(dejaLike);
      setErreur(res?.error ?? 'Connexion interrompue. Réessaie.');
      return;
    }

    // La fête est tenue par un composant qui couvre l'écran entier, monté
    // plus haut : on lui passe la nouvelle plutôt que d'attendre le
    // redessin du serveur, qui mettrait une demi-seconde entre le geste et
    // les deux visages.
    if (res?.match) {
      window.dispatchEvent(new CustomEvent<Profil>(EVENEMENT_MATCH, { detail: res.match }));
    }
    // En arrière-plan : le compteur des matchs et la liste des likes se
    // remettent à jour sans que personne attende devant son écran.
    router.refresh();
  }

  return (
    <>
      {/* Le titre d'abord, le rappel ensuite : on sait où l'on est, puis
          ce qu'on a le droit de faire. */}
      <p className="cr-manche-titre">{nomManche(numero)}</p>

      <div className="cr-regle" data-fait={Boolean(choisi) || undefined}>
        <div className="cr-regle-texte">
          <p className="cr-regle-ligne">
            <span className="cr-regle-coeur" aria-hidden="true">
              ♥
            </span>
            {termine ? (
              <span>
                Ce crush time est <strong>terminé</strong>. Les profils disparaissent dans un
                instant.
              </span>
            ) : choisi ? (
              <span>
                Ton choix : <strong>{choisi.first_name}</strong>
              </span>
            ) : (
              <span>
                Tu as <strong>un like</strong> à donner pour l’instant. Utilise-le pour la personne
                qui t’intéresse le plus.
              </span>
            )}
          </p>

          {prochaine && <p className="cr-regle-suite">Prochain crush time à {heure(prochaine)}</p>}
        </div>

        {/* À droite et en gros : quinze minutes, ça se regarde fondre. */}
        {fin && (
          <div className="cr-regle-compte">
            <Compte jusqua={fin} />
            <span>restantes</span>
          </div>
        )}
      </div>

      {/* Un like refusé ne disait rien : le cœur reprenait sa place en
          silence, et on ne savait pas si on avait mal visé, si la manche
          venait de se fermer, ou si le réseau de la salle avait lâché. */}
      {erreur && (
        <p className="cr-souci" role="alert">
          {erreur}
        </p>
      )}

      <div className="cr-grille">
        {ranges.map((profil) => {
          const estChoisi = profil.id === choixLocal;
          const aMatche = dejaMatche.has(profil.id);

          return (
            // Deux boutons côte à côte plutôt qu'un bouton dans un bouton :
            // la carte ouvre le profil, le cœur choisit. Imbriqués, aucun
            // navigateur ne saurait lequel on vient de toucher.
            <div className="cr-carte" key={profil.id} data-choisi={estChoisi || undefined}>
              <button
                type="button"
                className="cr-carte-ouvrir"
                onClick={() => setOuvert(profil)}
                aria-label={`Voir le profil de ${profil.first_name}`}
              >
                {profil.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profil.photo} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="cr-carte-vide" aria-hidden="true">
                    {profil.first_name.slice(0, 1).toUpperCase()}
                  </span>
                )}

                <span className="cr-carte-pied">
                  <span className="cr-carte-nom">
                    {profil.first_name}
                    {profil.nom ? ` ${profil.nom}` : ''}
                    {profil.age ? ` · ${profil.age}` : ''}
                  </span>
                  {aMatche && <span className="cr-carte-match">Match</span>}
                </span>
              </button>

              {/* Le cœur se touche sans ouvrir le profil : on reconnaît un
                  visage, on désigne, c'est tout. L'écran redemande ensuite —
                  il protège d'un geste qui ne se reprend pas. */}
              {aMatche ? (
                <span className="cr-coeur-carte" data-etat="match" aria-label="Vous avez matché">
                  ♥
                </span>
              ) : estChoisi ? (
                <span className="cr-coeur-carte" data-etat="choisi" aria-label="Ton choix">
                  ♥
                </span>
              ) : (
                peutLiker && (
                  <button
                    type="button"
                    className="cr-coeur-carte"
                    aria-label={`Choisir ${profil.first_name}`}
                    onClick={() => demander(profil)}
                  >
                    ♡
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {profils.length === 0 && (
        <p className="cr-texte">Personne à afficher pour l’instant.</p>
      )}

      {/* --- Le profil en grand --- */}
      {ouvert && (
        <div className="cr-voile" role="dialog" aria-modal="true" onClick={() => setOuvert(null)}>
          <div className="cr-fiche" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cr-fermer" onClick={() => setOuvert(null)}>
              Fermer
            </button>

            {ouvert.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cr-fiche-photo" src={ouvert.photo} alt="" />
            )}

            <h2 className="cr-fiche-nom">
              {ouvert.first_name}
              {ouvert.nom ? ` ${ouvert.nom}` : ''}
              {ouvert.age ? <span> · {ouvert.age} ans</span> : null}
            </h2>
            {(ouvert.profession || ouvert.city) && (
              <p className="cr-fiche-metier">
                {[ouvert.profession, ouvert.city].filter(Boolean).join(' · ')}
              </p>
            )}
            {ouvert.about && <p className="cr-fiche-mot">{court(ouvert.about)}</p>}

            {dejaMatche.has(ouvert.id) ? (
              <p className="cr-fiche-etat">Vous avez matché.</p>
            ) : termine ? (
              <p className="cr-fiche-etat">Ce crush time est terminé.</p>
            ) : choixLocal ? (
              <p className="cr-fiche-etat">
                Ton choix de ce crush time est déjà fait.
              </p>
            ) : (
              <button type="button" className="cr-bouton cr-coeur" onClick={() => demander(ouvert)}>
                ♥ Je choisis {ouvert.first_name}
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Le oui, avant d'écrire --- */}
      {aConfirmer && (
        <div
          className="cr-voile"
          role="dialog"
          aria-modal="true"
          aria-label={`Confirmer ton choix : ${aConfirmer.first_name}`}
          onClick={() => setAConfirmer(null)}
        >
          <div className="cr-fiche cr-confirme" onClick={(e) => e.stopPropagation()}>
            {aConfirmer.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cr-confirme-photo" src={aConfirmer.photo} alt="" />
            ) : (
              <span className="cr-confirme-photo cr-confirme-initiale" aria-hidden="true">
                {aConfirmer.first_name.slice(0, 1).toUpperCase()}
              </span>
            )}

            <h2 className="cr-fiche-nom">
              {aConfirmer.first_name}
              {aConfirmer.nom ? ` ${aConfirmer.nom}` : ''}
            </h2>

            <p className="cr-confirme-mot">
              C’est ton <strong>seul like</strong> du {nomManche(numero)}, et il ne se reprend pas.
            </p>

            <button
              type="button"
              className="cr-bouton cr-coeur"
              onClick={() => liker(aConfirmer)}
            >
              ♥ Oui, je choisis {aConfirmer.first_name}
            </button>

            <button
              type="button"
              className="cr-fermer cr-annuler"
              onClick={() => setAConfirmer(null)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}
