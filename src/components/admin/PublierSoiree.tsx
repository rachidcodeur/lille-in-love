'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const VIDE = { nom: '', ageMin: '27', ageMax: '35', date: '', heure: '', lieu: '' };

/**
 * Enregistrer une soirée.
 *
 * Aucun email ne part : ni maintenant, ni plus tard. On note une date, un
 * lieu et une classe d'âge, pour s'en souvenir et composer les tables à
 * partir des groupes. L'email d'invitation reste à écrire.
 */
export function PublierSoiree() {
  const router = useRouter();
  const [champs, setChamps] = useState(VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'ko'; texte: string } | null>(null);

  function maj(nom: keyof typeof VIDE, valeur: string) {
    setChamps((avant) => ({ ...avant, [nom]: valeur }));
    setErreurs((avant) => ({ ...avant, [nom]: '' }));
    setMessage(null);
  }

  async function enregistrer() {
    setBusy(true);
    setErreurs({});
    setMessage(null);

    try {
      const r = await fetch('/api/admin/soirees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(champs),
      });
      const res = (await r.json()) as {
        soireeId?: string;
        error?: string;
        champs?: Record<string, string>;
      };

      if (!r.ok || !res.soireeId) {
        if (res.champs) setErreurs(res.champs);
        setMessage({ kind: 'ko', texte: res.error ?? 'La soirée n’a pas pu être enregistrée.' });
        setBusy(false);
        return;
      }

      setMessage({ kind: 'ok', texte: `« ${champs.nom} » est enregistrée.` });
      setChamps(VIDE);
      router.refresh();
    } catch {
      setMessage({ kind: 'ko', texte: 'Connexion interrompue. Réessaie.' });
    }

    setBusy(false);
  }

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

  return (
    <div>
      {/* Champ est une fonction appelée directement, pas un composant monté :
          sinon chaque frappe recréerait l'input et lui ferait perdre le focus. */}
      <div className="adm-form-grille">
        {Champ({ nom: 'nom', label: 'Nom de la soirée', plein: true, placeholder: 'Première soirée Lille in Love' })}
        {Champ({ nom: 'ageMin', label: 'Âge minimum', type: 'number' })}
        {Champ({ nom: 'ageMax', label: 'Âge maximum', type: 'number' })}
        {Champ({ nom: 'date', label: 'Date', type: 'date' })}
        {Champ({ nom: 'heure', label: 'Heure (facultatif)', type: 'time' })}
        {Champ({ nom: 'lieu', label: 'Lieu', plein: true, placeholder: 'Nom et adresse du lieu' })}
      </div>

      <div className="adm-actions" style={{ marginTop: 18 }}>
        <button type="button" className="adm-btn adm-btn-yes" disabled={busy} onClick={enregistrer}>
          {busy ? 'Enregistrement…' : 'Enregistrer la soirée'}
        </button>
      </div>

      {message && (
        <div className="adm-feedback" data-kind={message.kind} style={{ marginTop: 14 }}>
          {message.texte}
        </div>
      )}

      <p className="adm-hint">
        Aucun email n’est envoyé. La soirée est notée pour s’en souvenir et composer les tables à
        partir des groupes.
      </p>
    </div>
  );
}
