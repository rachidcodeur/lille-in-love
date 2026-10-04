'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { nomManche } from '@/lib/crush-regles';
import { sansAccent } from '@/lib/groupes';
import { Icone } from './Icones';

type Manche = {
  id: string;
  numero: number;
  prevu_a: string;
  ouvert_at: string | null;
  ferme_at: string | null;
  duree_minutes?: number | null;
};

type Personne = {
  id: string;
  first_name: string;
  email: string;
  photo: string | null;
  gender: 'femme' | 'homme' | null;
  retire_at: string | null;
  member_id: string | null;
  jeton: string;
  code?: string | null;
};

async function commander(corps: Record<string, unknown>): Promise<string | null> {
  const r = await fetch('/api/admin/crush', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }).catch(() => null);
  if (r?.ok) return null;
  const res = (await r?.json().catch(() => null)) as { error?: string } | null;
  return res?.error ?? 'Le serveur n’a pas répondu.';
}

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Le tableau de bord du soir.
 *
 * Il sera consulté debout, dans une salle bruyante, par quelqu'un qui a
 * autre chose à faire. D'où les gros boutons, un seul geste par ligne, et
 * aucune confirmation sur ce qui se défait — ouvrir trop tôt se referme,
 * retirer quelqu'un se remet.
 */
export function CrushPilotage({
  manches,
  gens,
}: {
  manches: Manche[];
  gens: Personne[];
}) {
  const router = useRouter();
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  async function agir(cle: string, corps: Record<string, unknown>) {
    setOccupe(cle);
    setErreur(await commander(corps));
    setOccupe(null);
    router.refresh();
  }

  const presents = gens.filter((p) => !p.retire_at);
  const femmes = presents.filter((p) => p.gender === 'femme').length;
  const hommes = presents.filter((p) => p.gender === 'homme').length;
  const incomplets = presents.filter((p) => !p.gender);

  // Avant la première ouverture, cet écran sert à l'appel. Après, il sert à
  // rattraper : les deux ne se racontent pas de la même façon.
  const aucuneOuverte = manches.every((m) => !m.ouvert_at);

  // Seule la manche suivante porte le bouton franc. Trois boutons également
  // engageants, c'est une invitation à ouvrir le troisième crush time à 20h.
  const prochaine = manches.find((m) => !m.ouvert_at);

  // Le lien personnel de chacun. En production il porte le domaine du crush
  // time ; ailleurs, l'adresse qu'on a sous les yeux — un lien de maquette
  // doit rester cliquable depuis la maquette.
  //
  // Lue après coup et non pendant le rendu : le serveur ne connaît pas
  // l'adresse, et poser ici deux valeurs différentes mettait l'attribut
  // « title » en désaccord entre le serveur et le navigateur.
  const [racine, setRacine] = useState(BRAND.crushUrl);
  useEffect(() => setRacine(BRAND.crushUrl || window.location.origin), []);
  const lienDe = (p: Personne) => `${racine}/crush/c/${p.jeton}`;

  async function copier(texte: string, quoi: string) {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(quoi);
      setTimeout(() => setCopie(null), 2000);
    } catch {
      setErreur('Le navigateur a refusé le presse-papiers. Sélectionne le texte à la main.');
    }
  }

  const terme = sansAccent(recherche.trim());
  const visibles = terme
    ? gens.filter(
        (p) => sansAccent(p.first_name).includes(terme) || sansAccent(p.email).includes(terme),
      )
    : gens;

  return (
    <>
      <div className="adm-card">
        <div className="adm-card-head">
          <p className="adm-card-title">Qui est là ce soir</p>
          <span className="adm-card-aside">
            {presents.length} présents · {femmes} femmes · {hommes} hommes
            {/* Sans cette mention, le compte ne s'additionne pas et on
                cherche l'erreur là où il n'y en a pas. */}
            {incomplets.length > 0 && ` · ${incomplets.length} sans profil`}
          </span>
        </div>

        {incomplets.length > 0 && (
          <div className="adm-alerte" data-gravite="haute">
            <strong>
              {incomplets.length} {incomplets.length > 1 ? 'personnes' : 'personne'} sans profil
            </strong>{' '}
            — {incomplets.map((p) => p.first_name).join(', ')}.{' '}
            {incomplets.length > 1
              ? 'Elles ont acheté un billet sans avoir rempli le questionnaire : elles ne voient personne et personne ne les voit. Retire-les, ou fais-leur remplir le formulaire avant la première manche.'
              : 'Cette personne a acheté un billet sans avoir rempli le questionnaire : elle ne voit personne et personne ne la voit. Retire-la, ou fais-lui remplir le formulaire avant la première manche.'}
          </div>
        )}

        <div className="adm-choix-barre">
          <button
            type="button"
            className="adm-btn"
            onClick={() =>
              copier(
                presents
                  .map((p) => `${p.first_name}\t${p.email}\t${p.code ?? ''}\t${lienDe(p)}`)
                  .join('\n'),
                'tous',
              )
            }
          >
            {copie === 'tous' ? '✓ Copiés' : `Copier les ${presents.length} accès`}
          </button>
          <span className="adm-hint" style={{ margin: 0 }}>
            Prénom, adresse, code, lien — séparés par des tabulations, à coller dans un tableur
            ou un outil d’envoi.
          </span>
        </div>

        <div className="adm-recherche" style={{ margin: '0 0 16px' }}>
          <span className="adm-recherche-loupe" aria-hidden="true">
            <Icone nom="loupe" taille={18} />
          </span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un prénom, un email…"
            aria-label="Chercher un participant"
          />
        </div>

        <div className="adm-emargement">
          {visibles.map((p) => (
            <div className="adm-present" key={p.id} data-retire={Boolean(p.retire_at)}>
              {p.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="adm-avatar" src={p.photo} alt="" loading="lazy" />
              ) : (
                <div className="adm-avatar adm-avatar-empty" aria-hidden="true">
                  {p.first_name.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div className="adm-present-main">
                <p className="adm-present-nom">
                  {p.first_name}
                  {!p.gender && <span className="adm-tag">profil incomplet</span>}
                  {p.retire_at && <span className="adm-tag">retiré</span>}
                </p>
                <p className="adm-present-mail">
                  {p.email}
                  {p.code && <span className="adm-present-code">{p.code}</span>}
                </p>
              </div>

              {!p.retire_at && (
                <button
                  type="button"
                  className="adm-btn"
                  title={lienDe(p)}
                  onClick={() => copier(lienDe(p), p.id)}
                >
                  {copie === p.id ? '✓' : 'Lien'}
                </button>
              )}

              <button
                type="button"
                className="adm-btn"
                disabled={occupe === p.id}
                onClick={() =>
                  agir(p.id, {
                    action: p.retire_at ? 'remettre' : 'retirer',
                    participantId: p.id,
                  })
                }
              >
                {p.retire_at ? 'Remettre' : 'Retirer'}
              </button>
            </div>
          ))}
        </div>

        <p className="adm-hint">
          {aucuneOuverte
            ? 'Fais l’appel avant d’ouvrir le premier crush time : quelqu’un qui a payé sans venir occuperait une place dans les profils toute la soirée. Retiré, il disparaît ; remis, il revient.'
            : 'Les crush times ont commencé. Retirer quelqu’un maintenant le fait disparaître des profils et rend son choix à qui l’avait liké sur la manche en cours — mais les matchs déjà faits restent, ils appartiennent aussi à l’autre.'}
        </p>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <p className="adm-card-title">Les trois crush times</p>
        </div>

        <div className="adm-manches">
          {manches.map((manche) => {
            // Une manche dont les quinze minutes sont écoulées est close,
            // même si personne ne l'a refermée : c'est ce que voit le
            // serveur quand quelqu'un essaie de liker.
            const fin = manche.ouvert_at
              ? new Date(manche.ouvert_at).getTime() + (manche.duree_minutes ?? 15) * 60_000
              : null;
            const ecoulee = fin !== null && Date.now() >= fin;
            const ouverte = Boolean(manche.ouvert_at) && !manche.ferme_at && !ecoulee;
            const finie = Boolean(manche.ferme_at) || ecoulee;
            return (
              <div className="adm-manche" key={manche.id} data-etat={ouverte ? 'ouverte' : finie ? 'finie' : 'attente'}>
                <div>
                  <p className="adm-manche-nom">{nomManche(manche.numero)}</p>
                  <p className="adm-manche-heure">
                    {ouverte
                      ? `Ouvert à ${heure(manche.ouvert_at!)} · se referme à ${heure(new Date(fin!).toISOString())}`
                      : finie
                        ? `Terminé à ${heure(manche.ferme_at ?? new Date(fin!).toISOString())}`
                        : `Annoncé à ${heure(manche.prevu_a)}`}
                  </p>
                </div>
                {ouverte ? (
                  <button
                    type="button"
                    className="adm-btn"
                    disabled={occupe === manche.id}
                    onClick={() => agir(manche.id, { action: 'fermer', mancheId: manche.id })}
                  >
                    Fermer
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`adm-btn${manche.id === prochaine?.id ? ' adm-btn-yes' : ''}`}
                    disabled={occupe === manche.id}
                    onClick={() => agir(manche.id, { action: 'ouvrir', mancheId: manche.id })}
                  >
                    {finie ? 'Rouvrir' : 'Ouvrir'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="adm-hint">
          Ouvrir envoie la notification à tout le monde — fais l’appel avant. Chaque crush time se
          referme seul au bout de quinze minutes ; tu peux l’abréger, ou le rouvrir — il reprend là
          où il s’était arrêté, les choix déjà faits sont faits.
        </p>
      </div>

      {erreur && (
        <div className="adm-feedback" data-kind="ko">
          {erreur}
        </div>
      )}
    </>
  );
}
