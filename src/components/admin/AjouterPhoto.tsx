'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

/**
 * Ajouter une photo à une candidature, à la main.
 *
 * Il en manque parfois : un envoi qui a échoué, un téléphone à court de
 * place, quelqu'un qui n'avait pas la bonne sous la main. Sans elle, le
 * profil ne montre qu'une initiale sur fond beige — autant dire rien, un
 * soir où tout se joue sur un visage.
 */
export function AjouterPhoto({ memberId, place }: { memberId: string; place: number }) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(fichier: File) {
    setBusy(true);
    setErreur(null);

    const corps = new FormData();
    corps.append('memberId', memberId);
    corps.append('file', fichier);

    const r = await fetch('/api/admin/fiche', { method: 'POST', body: corps }).catch(() => null);
    const res = (await r?.json().catch(() => null)) as { error?: string } | null;

    if (!r?.ok) setErreur(res?.error ?? 'L’envoi a échoué.');
    else router.refresh();

    setBusy(false);
    if (champ.current) champ.current.value = '';
  }

  if (place <= 0) return null;

  return (
    <div className="adm-photo-ajout">
      <label className="adm-btn" data-busy={busy || undefined}>
        <input
          ref={champ}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && void envoyer(e.target.files[0])}
        />
        {busy ? 'Envoi…' : place === 3 ? 'Ajouter une photo' : 'Ajouter une autre photo'}
      </label>

      {erreur && (
        <div className="adm-feedback" data-kind="ko" style={{ marginTop: 10 }}>
          {erreur}
        </div>
      )}
    </div>
  );
}
