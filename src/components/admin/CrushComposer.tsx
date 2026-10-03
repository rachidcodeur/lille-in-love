'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { sansAccent } from '@/lib/groupes';
import { Icone } from './Icones';

export type Candidat = {
  id: string;
  first_name: string;
  last_name: string;
  gender: 'femme' | 'homme';
  age: number | null;
  city: string | null;
  soiree_group: string | null;
  photo: string | null;
  /** Déjà inscrit à cette soirée : on le montre, on ne le recoche pas. */
  deja: boolean;
};

type Props = {
  soireeId: string;
  /** La date de la soirée, pour proposer des heures qui tombent juste. */
  date: string;
  candidats: Candidat[];
  /** Les manches existent déjà : on ne redemande pas les heures. */
  manchesPosees: boolean;
};

const GROUPES = ['A', 'B', 'C', 'G'] as const;

/**
 * Composer la soirée.
 *
 * Deux portes, parce qu'il y a deux situations. On coche dans la liste quand
 * on connaît les gens — c'est le cas courant, on les a triés en groupes et
 * on sait qui on veut voir ensemble. On importe le fichier de la billetterie
 * quand c'est elle qui fait foi.
 *
 * Dans les deux cas, le compte femmes / hommes reste sous les yeux : une
 * soirée à trente hommes et cinq femmes ne se rattrape pas sur place, et
 * c'est en cochant qu'on peut encore l'éviter.
 */
export function CrushComposer({ soireeId, date, candidats, manchesPosees }: Props) {
  const router = useRouter();
  const [porte, setPorte] = useState<'liste' | 'csv' | 'main'>('liste');
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [recherche, setRecherche] = useState('');
  const [groupes, setGroupes] = useState<Set<string>>(new Set());
  const [csv, setCsv] = useState<string | null>(null);
  const [nomFichier, setNomFichier] = useState('');
  const [heures, setHeures] = useState([`${date}T20:00`, `${date}T22:00`, `${date}T00:00`]);
  const [main, setMain] = useState({ email: '', prenom: '', genre: '', naissance: '' });
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const parGroupe = useMemo(() => {
    const compte: Record<string, number> = { aucun: 0 };
    for (const c of candidats) {
      const cle = c.soiree_group ?? 'aucun';
      compte[cle] = (compte[cle] ?? 0) + 1;
    }
    return compte;
  }, [candidats]);

  const visibles = useMemo(() => {
    // Sans accents : personne ne tape « Solène » quand il cherche Solène.
    const terme = sansAccent(recherche.trim());
    return candidats.filter((c) => {
      // Aucune case cochée veut dire « tous les groupes ».
      if (groupes.size > 0 && !groupes.has(c.soiree_group ?? 'aucun')) return false;
      if (!terme) return true;
      return sansAccent(`${c.first_name} ${c.last_name} ${c.city ?? ''}`).includes(terme);
    });
  }, [candidats, groupes, recherche]);

  const retenus = candidats.filter((c) => choisis.has(c.id));
  const femmes = retenus.filter((c) => c.gender === 'femme').length;
  const hommes = retenus.length - femmes;
  const dejaLa = candidats.filter((c) => c.deja).length;

  function basculer(id: string) {
    setChoisis((avant) => {
      const suite = new Set(avant);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });
  }

  /** Cocher ou décocher d'un coup ce que le filtre laisse voir. */
  function toutBasculer() {
    const cochables = visibles.filter((c) => !c.deja).map((c) => c.id);
    const toutCoche = cochables.every((id) => choisis.has(id));
    setChoisis((avant) => {
      const suite = new Set(avant);
      for (const id of cochables) {
        if (toutCoche) suite.delete(id);
        else suite.add(id);
      }
      return suite;
    });
  }

  async function envoyer() {
    setBusy(true);
    setErreur(null);

    const corps =
      porte === 'liste'
        ? { action: 'composer', soireeId, memberIds: [...choisis] }
        : porte === 'csv'
          ? { action: 'importer', soireeId, csv }
          : { action: 'ajouter', soireeId, ...main };

    const r = await fetch('/api/admin/crush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...corps, ...(manchesPosees ? {} : { heures }) }),
    }).catch(() => null);

    const res = (await r?.json().catch(() => null)) as { error?: string } | null;
    if (!r?.ok) setErreur(res?.error ?? 'L’opération a échoué.');
    else {
      setChoisis(new Set());
      setCsv(null);
      setNomFichier('');
      setMain({ email: '', prenom: '', genre: '', naissance: '' });
      router.refresh();
    }
    setBusy(false);
  }

  const pret =
    porte === 'liste'
      ? choisis.size > 0
      : porte === 'csv'
        ? Boolean(csv)
        : Boolean(main.email.includes('@') && main.prenom.trim() && main.genre);

  return (
    <div>
      <div className="adm-portes" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={porte === 'liste'}
          data-on={porte === 'liste'}
          onClick={() => setPorte('liste')}
        >
          Cocher dans la liste
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={porte === 'csv'}
          data-on={porte === 'csv'}
          onClick={() => setPorte('csv')}
        >
          Importer un CSV
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={porte === 'main'}
          data-on={porte === 'main'}
          onClick={() => setPorte('main')}
        >
          À la main
        </button>
      </div>

      {porte === 'liste' ? (
        <>
          <div className="adm-recherche" style={{ margin: '0 0 14px' }}>
            <span className="adm-recherche-loupe" aria-hidden="true">
              <Icone nom="loupe" taille={18} />
            </span>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Chercher un prénom, un nom, une ville…"
              aria-label="Chercher une candidature"
            />
          </div>

          {/* Plusieurs groupes à la fois : on compose rarement une soirée
              avec un seul. Aucune case cochée = tout le monde. */}
          <fieldset className="adm-tri-cases" style={{ marginBottom: 16 }}>
            <legend>Groupes</legend>
            {[...GROUPES, 'aucun'].map((choix) => (
              <label key={choix} data-groupe={choix} data-on={groupes.has(choix)}>
                <input
                  type="checkbox"
                  checked={groupes.has(choix)}
                  onChange={() =>
                    setGroupes((avant) => {
                      const suite = new Set(avant);
                      if (suite.has(choix)) suite.delete(choix);
                      else suite.add(choix);
                      return suite;
                    })
                  }
                />
                <span>{choix === 'aucun' ? 'Sans groupe' : choix}</span>
                <b>{parGroupe[choix] ?? 0}</b>
              </label>
            ))}
          </fieldset>

          <div className="adm-choix-barre">
            <button type="button" className="adm-btn" onClick={toutBasculer} disabled={visibles.length === 0}>
              {visibles.filter((c) => !c.deja).every((c) => choisis.has(c.id)) && visibles.some((c) => !c.deja)
                ? 'Tout décocher'
                : 'Tout cocher'}
            </button>
            <span className="adm-hint" style={{ margin: 0 }}>
              {visibles.length} affichée{visibles.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="adm-choix">
            {visibles.map((c) => (
              <label className="adm-choix-ligne" key={c.id} data-deja={c.deja || undefined}>
                <input
                  type="checkbox"
                  checked={c.deja || choisis.has(c.id)}
                  disabled={c.deja}
                  onChange={() => basculer(c.id)}
                />
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="adm-avatar" src={c.photo} alt="" loading="lazy" />
                ) : (
                  <div className="adm-avatar adm-avatar-empty" aria-hidden="true">
                    {c.first_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="adm-choix-main">
                  <p className="adm-choix-nom">
                    {c.first_name} {c.last_name}
                    {c.deja && <span className="adm-tag">déjà dans la soirée</span>}
                  </p>
                  <p className="adm-choix-meta">
                    {[c.gender === 'femme' ? 'Femme' : 'Homme', c.age ? `${c.age} ans` : null, c.city]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {c.soiree_group && <span className="adm-choix-groupe">{c.soiree_group}</span>}
              </label>
            ))}

            {visibles.length === 0 && (
              <p className="adm-hint" style={{ margin: 0 }}>
                Aucune candidature ne correspond.
              </p>
            )}
          </div>
        </>
      ) : porte === 'csv' ? (
        <>
          <label className="adm-depot" data-rempli={Boolean(csv)}>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={async (e) => {
                const fichier = e.target.files?.[0];
                if (!fichier) return;
                setErreur(null);
                setNomFichier(fichier.name);
                setCsv(await fichier.text());
              }}
            />
            <span>{nomFichier || 'Choisir le fichier de la billetterie (.csv)'}</span>
          </label>
          <p className="adm-hint">
            Seule l’adresse email est nécessaire. Le fichier peut venir d’Excel ou de la
            billetterie, avec virgules ou points-virgules. Tout le reste — photo, prénom, âge — est
            retrouvé dans les candidatures.
          </p>
        </>
      ) : null}

      {porte === 'main' && (
        <div className="adm-form-grille">
          <div className="adm-champ plein">
            <label htmlFor="main-email">Adresse email</label>
            <input
              id="main-email"
              className="lil-input"
              type="email"
              autoCapitalize="off"
              placeholder="celle avec laquelle la personne se connectera"
              value={main.email}
              onChange={(e) => setMain({ ...main, email: e.target.value })}
            />
          </div>

          <div className="adm-champ">
            <label htmlFor="main-prenom">Prénom</label>
            <input
              id="main-prenom"
              className="lil-input"
              value={main.prenom}
              onChange={(e) => setMain({ ...main, prenom: e.target.value })}
            />
          </div>

          <div className="adm-champ">
            <label htmlFor="main-genre">Femme ou homme</label>
            <select
              id="main-genre"
              className="lil-input"
              value={main.genre}
              onChange={(e) => setMain({ ...main, genre: e.target.value })}
            >
              <option value="">À choisir</option>
              <option value="femme">Femme</option>
              <option value="homme">Homme</option>
            </select>
          </div>

          <div className="adm-champ">
            <label htmlFor="main-naissance">Date de naissance (facultatif)</label>
            <input
              id="main-naissance"
              className="lil-input"
              type="date"
              value={main.naissance}
              onChange={(e) => setMain({ ...main, naissance: e.target.value })}
            />
          </div>

          <p className="adm-hint plein">
            Le genre décide de tout : sans lui, la personne ne verrait personne et ne serait vue de
            personne. Si cette adresse correspond à une candidature, sa photo et ses réponses
            suivent toutes seules.
          </p>
        </div>
      )}

      {!manchesPosees && (
        <>
          <div className="adm-form-grille" style={{ marginTop: 20 }}>
            {heures.map((heure, index) => (
              <div className="adm-champ" key={index}>
                <label htmlFor={`manche-${index}`}>Crush time {index + 1}</label>
                <input
                  id={`manche-${index}`}
                  className="lil-input"
                  type="datetime-local"
                  value={heure}
                  onChange={(e) =>
                    setHeures((avant) => avant.map((h, i) => (i === index ? e.target.value : h)))
                  }
                />
              </div>
            ))}
          </div>
          <p className="adm-hint">
            Ces heures sont celles qu’on annonce. L’ouverture reste un geste : rien ne part sans que
            tu appuies.
          </p>
        </>
      )}

      {/* Le compte reste sous les yeux pendant qu'on coche : une soirée à
          trente hommes et cinq femmes ne se rattrape pas sur place. */}
      {/* Collant seulement sous l'onglet « liste » : c'est là qu'on fait
          défiler longtemps et que le compte doit rester sous les yeux.
          Ailleurs il recouvrirait les champs du formulaire. */}
      <div className="adm-choix-pied" data-collant={porte === 'liste' || undefined}>
        <p className="adm-choix-compte">
          {porte === 'main' ? (
            <span className="adm-hint">
              Une personne qui n’est ni dans la billetterie, ni dans les candidatures.
            </span>
          ) : porte === 'liste' ? (
            <>
              <strong>{retenus.length}</strong> personne{retenus.length > 1 ? 's' : ''}
              {retenus.length > 0 && (
                <>
                  {' '}
                  · {femmes} femme{femmes > 1 ? 's' : ''} · {hommes} homme{hommes > 1 ? 's' : ''}
                </>
              )}
              {dejaLa > 0 && <span className="adm-hint"> · {dejaLa} déjà dans la soirée</span>}
            </>
          ) : (
            <span className="adm-hint">Les adresses du fichier seront rapprochées des candidatures.</span>
          )}
        </p>

        <button type="button" className="adm-btn adm-btn-yes" disabled={!pret || busy} onClick={envoyer}>
          {busy
            ? 'Enregistrement…'
            : porte === 'main'
              ? 'Ajouter cette personne'
              : manchesPosees
                ? 'Ajouter à la soirée'
                : 'Créer le crush time'}
        </button>
      </div>

      {erreur && (
        <div className="adm-feedback" data-kind="ko" style={{ marginTop: 14 }}>
          {erreur}
        </div>
      )}
    </div>
  );
}
