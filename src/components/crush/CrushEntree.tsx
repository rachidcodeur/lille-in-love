'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * La porte d'entrée.
 *
 * Son adresse et le code annoncé dans la salle. Rien à recevoir, rien à
 * attendre : au moment où cinquante téléphones partagent le même réseau, un
 * email qui met deux minutes à arriver est un email qui n'arrive pas.
 */
export function CrushEntree({
  soiree,
  ouverte,
  lienInvalide,
}: {
  soiree: string | null;
  ouverte: boolean;
  lienInvalide: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(
    lienInvalide ? 'Ce lien n’est plus valable. Entre avec ton adresse et le code de la salle.' : null,
  );

  async function entrer() {
    setBusy(true);
    setErreur(null);
    const r = await fetch('/api/crush/entrer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    }).catch(() => null);

    const res = (await r?.json().catch(() => null)) as { error?: string } | null;
    if (!r?.ok) {
      setErreur(res?.error ?? 'Connexion interrompue. Réessaie.');
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (!ouverte) {
    return (
      <main className="cr-main cr-centre">
        <p className="cr-marque">Lille in Love</p>
        <h1 className="cr-titre">Crush Time</h1>
        <p className="cr-texte">
          Aucun crush time n’est ouvert pour le moment. Il s’ouvrira le soir de la prochaine
          soirée — on te le dira.
        </p>
      </main>
    );
  }

  return (
    <main className="cr-main cr-centre">
      <p className="cr-marque">Lille in Love</p>
      <h1 className="cr-titre">Crush Time</h1>
      {soiree && <p className="cr-soiree">{soiree}</p>}

      <form
        className="cr-form"
        onSubmit={(e) => {
          e.preventDefault();
          void entrer();
        }}
      >
        <label htmlFor="cr-email">Ton adresse email</label>
        <input
          id="cr-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          placeholder="celle de ton billet"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="cr-code">Ton code à quatre chiffres</label>
        <input
          id="cr-code"
          // « numeric » plutôt que « tel » : le clavier n'affiche que des
          // chiffres, sans les symboles d'un numéro de téléphone.
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="4 chiffres"
          className="cr-code-saisie"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          required
        />
        <p className="cr-aide">
          Il est dans le mail qu’on t’a envoyé. Si tu ne le retrouves pas, demande-le à
          l’organisateur.
        </p>

        {erreur && <p className="cr-erreur">{erreur}</p>}

        <button type="submit" className="cr-bouton" disabled={busy || code.length < 4 || !email}>
          {busy ? 'Un instant…' : 'Entrer'}
        </button>
      </form>
    </main>
  );
}
