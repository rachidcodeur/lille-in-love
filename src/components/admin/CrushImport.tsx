'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Créer le crush time d'une soirée à partir de la billetterie.
 *
 * Le fichier ne sert qu'à une chose : savoir qui a payé. Tout le reste —
 * photo, prénom, âge, orientation — est déjà chez nous et se retrouve par
 * l'adresse email. On ne demande donc rien d'autre que le fichier et les
 * heures annoncées.
 */
export function CrushImport({ soireeId, date }: { soireeId: string; date: string }) {
  const router = useRouter();
  const [csv, setCsv] = useState<string | null>(null);
  const [nomFichier, setNomFichier] = useState('');
  const [heures, setHeures] = useState([`${date}T20:00`, `${date}T22:00`, `${date}T00:00`]);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lire(fichier: File) {
    setErreur(null);
    setNomFichier(fichier.name);
    setCsv(await fichier.text());
  }

  async function importer() {
    if (!csv) return;
    setBusy(true);
    setErreur(null);

    const r = await fetch('/api/admin/crush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'importer', soireeId, csv, heures }),
    }).catch(() => null);

    const res = (await r?.json().catch(() => null)) as { error?: string } | null;
    if (!r?.ok) setErreur(res?.error ?? 'L’import a échoué.');
    else router.refresh();
    setBusy(false);
  }

  return (
    <div>
      <label className="adm-depot" data-rempli={Boolean(csv)}>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => e.target.files?.[0] && void lire(e.target.files[0])}
        />
        <span>{nomFichier || 'Choisir le fichier de la billetterie (.csv)'}</span>
      </label>

      <p className="adm-hint">
        Seule l’adresse email est nécessaire. Le fichier peut venir d’Excel ou de BilletWeb, avec
        virgules ou points-virgules.
      </p>

      <div className="adm-form-grille" style={{ marginTop: 18 }}>
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
        Ces heures sont celles qu’on annonce. L’ouverture reste un geste : rien ne part sans que tu
        appuies.
      </p>

      <div className="adm-actions" style={{ marginTop: 18 }}>
        <button type="button" className="adm-btn adm-btn-yes" disabled={!csv || busy} onClick={importer}>
          {busy ? 'Import en cours…' : 'Créer le crush time'}
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
