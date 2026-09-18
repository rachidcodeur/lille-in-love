'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Saisie du code d'accès, affichée uniquement quand ADMIN_CODE est renseigné. */
export function GateForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);

        const response = await fetch('/api/admin/entree', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (response.ok) {
          router.refresh();
        } else {
          setError('Code incorrect.');
          setBusy(false);
        }
      }}
    >
      <input
        type="password"
        className="lil-input"
        value={code}
        autoFocus
        placeholder="Code d’accès"
        onChange={(event) => setCode(event.target.value)}
      />
      {error && (
        <div className="adm-feedback" data-kind="ko">
          {error}
        </div>
      )}
      <button
        type="submit"
        className="adm-btn adm-btn-yes"
        style={{ width: '100%', marginTop: 12 }}
        disabled={busy || code.length === 0}
      >
        {busy ? 'Vérification…' : 'Entrer'}
      </button>
    </form>
  );
}
