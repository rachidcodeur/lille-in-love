'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Profil } from '@/lib/crush';
import { nomManche } from '@/lib/crush-regles';
import { Compte } from './Compte';

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
  profils,
  dejaLike,
  matchs,
  prochaine,
  fin,
}: {
  numero: number;
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
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouveauMatch, setNouveauMatch] = useState<Profil | null>(null);

  const dejaMatche = new Set(matchs.map((m) => m.id));
  const choisi = profils.find((p) => p.id === dejaLike) ?? null;

  async function liker(profil: Profil) {
    setBusy(true);
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
      setErreur(res?.error ?? 'Connexion interrompue. Réessaie.');
      setBusy(false);
      return;
    }

    setOuvert(null);
    if (res?.match) setNouveauMatch(res.match);
    setBusy(false);
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
            {choisi ? (
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

      <div className="cr-grille">
        {profils.map((profil) => {
          const estChoisi = profil.id === dejaLike;
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
                    {profil.age ? ` · ${profil.age}` : ''}
                  </span>
                  {aMatche && <span className="cr-carte-match">Match</span>}
                </span>
              </button>

              {/* Le cœur se touche sans ouvrir le profil : on reconnaît un
                  visage, on choisit, c'est tout. La confirmation reste —
                  elle protège d'un geste qui ne se reprend pas. */}
              {aMatche ? (
                <span className="cr-coeur-carte" data-etat="match" aria-label="Vous avez matché">
                  ♥
                </span>
              ) : estChoisi ? (
                <span className="cr-coeur-carte" data-etat="choisi" aria-label="Ton choix">
                  ♥
                </span>
              ) : (
                !dejaLike && (
                  <button
                    type="button"
                    className="cr-coeur-carte"
                    aria-label={`Choisir ${profil.first_name}`}
                    onClick={() => liker(profil)}
                    disabled={busy}
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
            ) : dejaLike ? (
              <p className="cr-fiche-etat">
                Ton choix de ce crush time est déjà fait.
              </p>
            ) : (
              <button
                type="button"
                className="cr-bouton cr-coeur"
                disabled={busy}
                onClick={() => liker(ouvert)}
              >
                {busy ? 'Un instant…' : `♥ Je choisis ${ouvert.first_name}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Le match, qui doit s'annoncer tout seul --- */}
      {nouveauMatch && (
        <div className="cr-voile" role="dialog" aria-modal="true" onClick={() => setNouveauMatch(null)}>
          <div className="cr-fiche cr-match" onClick={(e) => e.stopPropagation()}>
            <p className="cr-match-mot">C’est un match</p>
            {nouveauMatch.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cr-fiche-photo" src={nouveauMatch.photo} alt="" />
            )}
            <h2 className="cr-fiche-nom">{nouveauMatch.first_name}</h2>
            <p className="cr-texte">
              Vous vous êtes choisis. Ses coordonnées sont dans l’onglet du bas.
            </p>
            <button type="button" className="cr-bouton" onClick={() => setNouveauMatch(null)}>
              Continuer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
