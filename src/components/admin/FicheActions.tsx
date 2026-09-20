'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  memberId: string;
  status: string;
  votesOui: number;
  votesRequis: number;
  /** Délai entre la validation et l'envoi de la bienvenue, en minutes. */
  delaiMinutes: number;
};

type Decision = 'valide' | 'nouveau';

type Feedback = { kind: 'ok' | 'ko'; message: string };

/** « dans 6 heures », « dans 2 minutes » — pour annoncer ce qui va se passer. */
function delayInWords(minutes: number): string {
  if (minutes <= 0) return 'tout de suite';
  if (minutes < 60) return `dans ${minutes} minute${minutes > 1 ? 's' : ''}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `dans ${hours} heure${hours > 1 ? 's' : ''}`;
  return `dans ${Math.round(hours / 24)} jours`;
}

const heure = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Ce qu'on peut faire d'une candidature.
 *
 * Une seule décision : valider. On ne refuse plus personne — c'est le groupe
 * qui dira à quelle soirée la personne correspond. Valider programme
 * « Bienvenue dans le club » au délai configuré.
 *
 * Le second bouton n'est pas un refus, c'est un droit à l'erreur : il remet
 * la candidature dans la file et rattrape la bienvenue encore en attente.
 * Il ne s'affiche donc que tant qu'il y a quelque chose à rattraper.
 */
export function FicheActions({ memberId, status, votesOui, votesRequis, delaiMinutes }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function decide(decision: Decision) {
    setBusy(decision);
    setFeedback(null);

    try {
      const response = await fetch('/api/admin/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, decision }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        emailOk?: boolean;
        emailError?: string;
        annulationEchouee?: string;
        scheduledFor?: string | null;
        dejaPrise?: boolean;
        alreadySent?: boolean;
      };

      if (!response.ok || !result.ok) {
        setFeedback({ kind: 'ko', message: result.error ?? 'La décision n’a pas pu être enregistrée.' });
        setBusy(null);
        return;
      }

      const fait = decision === 'valide' ? 'Candidature validée' : 'Validation annulée';

      if (result.annulationEchouee) {
        // Le cas à ne surtout pas taire : la décision est enregistrée, mais
        // la bienvenue déjà programmée va partir malgré tout.
        setFeedback({
          kind: 'ko',
          message:
            `${fait}, mais « Bienvenue dans le club », déjà programmé, n’a PAS pu être arrêté ` +
            `(${result.annulationEchouee}). Utilise « Annuler cet envoi » en haut de la fiche.`,
        });
      } else if (result.emailOk === false) {
        setFeedback({
          kind: 'ko',
          message: `${fait}, mais l’email n’a pas pu être programmé : ${
            result.emailError ?? 'erreur inconnue'
          }`,
        });
      } else if (decision === 'nouveau') {
        setFeedback({
          kind: 'ok',
          message: result.dejaPrise
            ? 'Cette candidature était déjà en attente.'
            : `${fait}. La candidature repart dans la file, et la bienvenue en attente est arrêtée.`,
        });
      } else if (result.dejaPrise) {
        setFeedback({
          kind: 'ok',
          message: result.scheduledFor
            ? `Déjà validée. « Bienvenue dans le club » reste prévu ${heure.format(new Date(result.scheduledFor))}.`
            : 'Déjà validée, et « Bienvenue dans le club » est déjà parti.',
        });
      } else if (result.alreadySent) {
        setFeedback({
          kind: 'ok',
          message: `${fait}. « Bienvenue dans le club » avait déjà été envoyé à cette personne : il n’est pas renvoyé.`,
        });
      } else {
        setFeedback({
          kind: 'ok',
          message: result.scheduledFor
            ? `${fait}. « Bienvenue dans le club » partira ${heure.format(new Date(result.scheduledFor))}.`
            : `${fait}. « Bienvenue dans le club » vient de partir.`,
        });
      }

      router.refresh();
    } catch {
      setFeedback({ kind: 'ko', message: 'Connexion interrompue. Réessaie.' });
    }

    setBusy(null);
  }

  return (
    <div className="adm-actions">
      <button
        type="button"
        className="adm-btn adm-btn-yes"
        disabled={busy !== null || status === 'valide'}
        onClick={() => decide('valide')}
      >
        {busy === 'valide'
          ? 'Enregistrement…'
          : status === 'valide'
            ? 'Candidature validée'
            : 'Valider la candidature'}
      </button>

      {status === 'valide' && (
        <button
          type="button"
          className="adm-btn adm-btn-no"
          disabled={busy !== null}
          onClick={() => decide('nouveau')}
        >
          {busy === 'nouveau' ? 'Enregistrement…' : 'Annuler la validation'}
        </button>
      )}

      {feedback && (
        <div className="adm-feedback" data-kind={feedback.kind}>
          {feedback.message}
        </div>
      )}

      <p className="adm-hint">
        Valider envoie « Bienvenue dans le club » {delayInWords(delaiMinutes)}. C’est le seul
        email que la curation déclenche.
        {status === 'valide' &&
          ' Annuler avant l’échéance arrête cet envoi et remet la candidature dans la file.'}
        {votesRequis > 1 && (
          <>
            {' '}
            Règle en vigueur : {votesRequis} voix (actuellement {votesOui}).
          </>
        )}
      </p>
    </div>
  );
}
