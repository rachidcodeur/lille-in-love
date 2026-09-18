'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Personne = { id: string; prenom: string; nom: string; email: string; age: number | null };

type Audience = {
  refuses: Personne[];
  horsTranche: Personne[];
  dansLaTranche: Personne[];
  ageInconnu: Personne[];
  dejaPrevenus: Personne[];
};

type Bilan = {
  '03': number;
  '04': number;
  dans_la_tranche: number;
  age_inconnu: number;
  deja_prevenus: number;
  echecs: number;
};

const VIDE = { nom: '', ageMin: '27', ageMax: '35', date: '', heure: '', lieu: '' };

/**
 * Publier une soirée.
 *
 * Publier envoie des emails à beaucoup de monde d'un coup, et ça ne se
 * rattrape pas. On passe donc toujours par un aperçu : qui recevra le 03, qui
 * recevra le 04, qui ne recevra rien et pourquoi. Modifier un champ après
 * l'aperçu l'annule, pour qu'on ne confirme jamais sur des chiffres périmés.
 */
export function PublierSoiree() {
  const router = useRouter();
  const [champs, setChamps] = useState(VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState<Audience | null>(null);
  const [etape, setEtape] = useState<'saisie' | 'apercu' | 'publication'>('saisie');
  const [message, setMessage] = useState<{ kind: 'ok' | 'ko'; texte: string } | null>(null);

  const maj = (nom: keyof typeof VIDE, valeur: string) => {
    setChamps((c) => ({ ...c, [nom]: valeur }));
    setErreurs((e) => ({ ...e, [nom]: '' }));
    // Les chiffres de l'aperçu ne valent plus rien si la soirée change.
    if (audience) {
      setAudience(null);
      setEtape('saisie');
    }
  };

  const corps = () =>
    JSON.stringify({
      nom: champs.nom,
      ageMin: Number(champs.ageMin),
      ageMax: Number(champs.ageMax),
      date: champs.date,
      heure: champs.heure,
      lieu: champs.lieu,
    });

  async function apercu() {
    setMessage(null);
    const r = await fetch('/api/admin/soirees/apercu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corps(),
    });
    const res = (await r.json()) as {
      ok?: boolean;
      error?: string;
      fieldErrors?: Record<string, string>;
      audience?: Audience;
    };
    if (!r.ok || !res.audience) {
      setErreurs(res.fieldErrors ?? {});
      setMessage({ kind: 'ko', texte: res.error ?? 'Aperçu impossible.' });
      return;
    }
    setErreurs({});
    setAudience(res.audience);
    setEtape('apercu');
  }

  async function publier() {
    setEtape('publication');
    setMessage(null);
    try {
      const r = await fetch('/api/admin/soirees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corps(),
      });
      const res = (await r.json()) as {
        ok?: boolean;
        error?: string;
        bilan?: Bilan;
        echecs?: { to: string; error: string }[];
      };

      if (!r.ok || !res.bilan) {
        setMessage({ kind: 'ko', texte: res.error ?? 'La publication a échoué.' });
        setEtape('apercu');
        return;
      }

      const b = res.bilan;
      setMessage({
        kind: b.echecs > 0 ? 'ko' : 'ok',
        texte:
          `Soirée publiée. ${b['03']} « On reviendra vers toi » et ${b['04']} « Tranche d’âge » envoyés.` +
          (b.echecs > 0
            ? ` ${b.echecs} envoi(s) en échec — le détail est dans le journal de chaque fiche.`
            : ''),
      });
      setChamps(VIDE);
      setAudience(null);
      setEtape('saisie');
      router.refresh();
    } catch {
      setMessage({ kind: 'ko', texte: 'Connexion interrompue. Vérifie la liste avant de republier.' });
      setEtape('apercu');
    }
  }

  const aEnvoyer = audience ? audience.refuses.length + audience.horsTranche.length : 0;
  const tranche = `${champs.ageMin}-${champs.ageMax} ans`;

  const Champ = ({
    nom,
    label,
    type = 'text',
    plein = false,
    placeholder,
  }: {
    nom: keyof typeof VIDE;
    label: string;
    type?: string;
    plein?: boolean;
    placeholder?: string;
  }) => (
    <div className={`adm-champ${plein ? ' plein' : ''}`}>
      <label htmlFor={`soiree-${nom}`}>{label}</label>
      <input
        id={`soiree-${nom}`}
        className="lil-input"
        type={type}
        value={champs[nom]}
        placeholder={placeholder}
        min={type === 'number' ? 18 : undefined}
        max={type === 'number' ? 99 : undefined}
        aria-invalid={Boolean(erreurs[nom])}
        onChange={(e) => maj(nom, e.target.value)}
      />
      {erreurs[nom] && <p className="adm-champ-erreur">{erreurs[nom]}</p>}
    </div>
  );

  const Groupe = ({
    nombre,
    titre,
    detail,
    personnes,
    envoi = false,
    alerte = false,
  }: {
    nombre: number;
    titre: string;
    detail: string;
    personnes: Personne[];
    envoi?: boolean;
    alerte?: boolean;
  }) => (
    <details className="adm-groupe" data-envoi={envoi && nombre > 0} data-alerte={alerte && nombre > 0}>
      <summary>
        <span className="adm-groupe-nombre">{nombre}</span>
        <span className="adm-groupe-texte">
          {titre}
          <small>{detail}</small>
        </span>
      </summary>
      {personnes.length > 0 && (
        <ul>
          {personnes.slice(0, 200).map((p) => (
            <li key={p.id}>
              {p.prenom} {p.nom} — {p.email}
              {p.age !== null && ` · ${p.age} ans`}
            </li>
          ))}
          {personnes.length > 200 && <li>… et {personnes.length - 200} autres</li>}
        </ul>
      )}
    </details>
  );

  return (
    <div>
      {/* Champ et Groupe sont des fonctions appelées directement, pas des
          composants montés : sinon chaque frappe recréerait l'input et lui
          ferait perdre le focus. */}
      <div className="adm-form-grille">
        {Champ({ nom: 'nom', label: 'Nom de la soirée', plein: true, placeholder: 'Première soirée Lille in Love' })}
        {Champ({ nom: 'ageMin', label: 'Âge minimum', type: 'number' })}
        {Champ({ nom: 'ageMax', label: 'Âge maximum', type: 'number' })}
        {Champ({ nom: 'date', label: 'Date', type: 'date' })}
        {Champ({ nom: 'heure', label: 'Heure (facultatif)', type: 'time' })}
        {Champ({ nom: 'lieu', label: 'Lieu', plein: true, placeholder: 'Nom et adresse du lieu' })}
      </div>

      {etape === 'saisie' && (
        <button
          type="button"
          className="adm-btn adm-btn-no"
          style={{ width: '100%', marginTop: 18 }}
          onClick={apercu}
        >
          Voir qui sera prévenu
        </button>
      )}

      {audience && etape !== 'saisie' && (
        <>
          <div className="adm-audience">
            {Groupe({
              nombre: audience.refuses.length,
              titre: 'recevront « On reviendra vers toi » (03)',
              detail: 'Profils non retenus',
              personnes: audience.refuses,
              envoi: true,
            })}
            {Groupe({
              nombre: audience.horsTranche.length,
              titre: 'recevront « Ta tranche d’âge ouvrira plus tard » (04)',
              detail: `Validés dont l’âge le jour de la soirée sort des ${tranche}`,
              personnes: audience.horsTranche,
              envoi: true,
            })}
            {Groupe({
              nombre: audience.dansLaTranche.length,
              titre: 'ont l’âge de la soirée — aucun email',
              detail: 'Validés dans la classe d’âge : ils attendent leur invitation',
              personnes: audience.dansLaTranche,
            })}
            {Groupe({
              nombre: audience.ageInconnu.length,
              titre: 'âge inconnu — aucun email',
              detail: 'Validés sans date de naissance (formulaire court) : impossible de savoir s’ils ont l’âge',
              personnes: audience.ageInconnu,
              alerte: true,
            })}
            {Groupe({
              nombre: audience.dejaPrevenus.length,
              titre: 'déjà prévenus — aucun email',
              detail: 'Ont déjà reçu ce message lors d’une soirée précédente',
              personnes: audience.dejaPrevenus,
            })}
          </div>

          <button
            type="button"
            className="adm-btn adm-btn-yes"
            style={{ width: '100%', marginTop: 18 }}
            disabled={etape === 'publication'}
            onClick={publier}
          >
            {etape === 'publication'
              ? 'Publication et envoi…'
              : aEnvoyer > 0
                ? `Publier et envoyer ${aEnvoyer} email${aEnvoyer > 1 ? 's' : ''}`
                : 'Publier la soirée (aucun email à envoyer)'}
          </button>
          <p className="adm-hint">Les envois partent immédiatement et ne peuvent pas être rappelés.</p>
        </>
      )}

      {message && (
        <div className="adm-feedback" data-kind={message.kind} style={{ marginTop: 14 }}>
          {message.texte}
        </div>
      )}
    </div>
  );
}
