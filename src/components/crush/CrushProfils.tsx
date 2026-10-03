'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Profil } from '@/lib/crush';

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
export function CrushProfils({
  numero,
  profils,
  dejaLike,
  matchs,
}: {
  numero: number;
  profils: Profil[];
  dejaLike: string | null;
  matchs: Profil[];
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState<Profil | null>(null);
  const [aConfirmer, setAConfirmer] = useState<Profil | null>(null);
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

    setAConfirmer(null);
    setOuvert(null);
    if (res?.match) setNouveauMatch(res.match);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <div className="cr-manche">
        <p className="cr-manche-titre">Crush time {numero}</p>
        <p className="cr-manche-regle">
          {choisi ? (
            <>
              Ton choix est fait&nbsp;: <strong>{choisi.first_name}</strong>.
            </>
          ) : (
            'Une seule personne, et c’est définitif.'
          )}
        </p>
      </div>

      <div className="cr-grille">
        {profils.map((profil) => (
          <button
            type="button"
            className="cr-carte"
            key={profil.id}
            data-choisi={profil.id === dejaLike || undefined}
            onClick={() => setOuvert(profil)}
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
              {dejaMatche.has(profil.id) && <span className="cr-carte-match">Match</span>}
              {profil.id === dejaLike && !dejaMatche.has(profil.id) && (
                <span className="cr-carte-coeur" aria-label="Ton choix">
                  ♥
                </span>
              )}
            </span>
          </button>
        ))}
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
            {ouvert.profession && <p className="cr-fiche-metier">{ouvert.profession}</p>}
            {ouvert.about && <p className="cr-fiche-mot">{ouvert.about}</p>}

            {dejaMatche.has(ouvert.id) ? (
              <p className="cr-fiche-etat">Vous avez matché.</p>
            ) : dejaLike ? (
              <p className="cr-fiche-etat">
                Ton choix de ce crush time est déjà fait.
              </p>
            ) : (
              <button type="button" className="cr-bouton cr-coeur" onClick={() => setAConfirmer(ouvert)}>
                ♥ Je choisis {ouvert.first_name}
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- La confirmation, parce que ça ne se reprend pas --- */}
      {aConfirmer && (
        <div className="cr-voile" role="dialog" aria-modal="true">
          <div className="cr-fiche cr-confirme">
            <h2 className="cr-fiche-nom">{aConfirmer.first_name}</h2>
            <p className="cr-texte">
              C’est ton seul choix pour ce crush time, et il ne se reprend pas.
            </p>
            {erreur && <p className="cr-erreur">{erreur}</p>}
            <button
              type="button"
              className="cr-bouton cr-coeur"
              disabled={busy}
              onClick={() => liker(aConfirmer)}
            >
              {busy ? 'Un instant…' : 'Oui, c’est elle ou lui'}
            </button>
            <button type="button" className="cr-fermer cr-annuler" onClick={() => setAConfirmer(null)}>
              Revenir
            </button>
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
