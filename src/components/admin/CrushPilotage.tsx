'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icone } from './Icones';

type Manche = {
  id: string;
  numero: number;
  prevu_a: string;
  ouvert_at: string | null;
  ferme_at: string | null;
};

type Personne = {
  id: string;
  first_name: string;
  email: string;
  photo: string | null;
  gender: 'femme' | 'homme' | null;
  retire_at: string | null;
  member_id: string | null;
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

  const terme = recherche.trim().toLowerCase();
  const visibles = terme
    ? gens.filter(
        (p) =>
          p.first_name.toLowerCase().includes(terme) || p.email.toLowerCase().includes(terme),
      )
    : gens;

  return (
    <>
      <div className="adm-card">
        <div className="adm-card-head">
          <p className="adm-card-title">Les trois crush times</p>
        </div>

        <div className="adm-manches">
          {manches.map((manche) => {
            const ouverte = Boolean(manche.ouvert_at) && !manche.ferme_at;
            const finie = Boolean(manche.ferme_at);
            return (
              <div className="adm-manche" key={manche.id} data-etat={ouverte ? 'ouverte' : finie ? 'finie' : 'attente'}>
                <div>
                  <p className="adm-manche-nom">Crush time {manche.numero}</p>
                  <p className="adm-manche-heure">
                    {ouverte
                      ? `Ouvert depuis ${heure(manche.ouvert_at!)}`
                      : finie
                        ? `Terminé à ${heure(manche.ferme_at!)}`
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
                    className="adm-btn adm-btn-yes"
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
          Ouvrir envoie la notification à tout le monde. Une manche rouverte reprend là où elle
          s’était arrêtée : les choix déjà faits sont faits.
        </p>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <p className="adm-card-title">Les participants</p>
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
                <p className="adm-present-mail">{p.email}</p>
              </div>

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
          Retirer quelqu’un qui n’est pas venu le fait disparaître des profils, et rend son choix à
          qui l’avait liké sur la manche en cours. Ses matchs déjà faits restent : ils appartiennent
          aussi à l’autre.
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
