'use client';

import { useEffect, useState } from 'react';
import { regarder } from '@/lib/navigateur';

type Etat = 'inconnu' | 'possible' | 'refusee' | 'active' | 'hors-app';

/**
 * Autoriser les notifications.
 *
 * Sur iPhone, Apple ne les accorde qu'à une application posée sur l'écran
 * d'accueil : depuis Safari, la demande n'existe même pas. On ne la propose
 * donc qu'une fois l'application installée — demander avant ne ferait que
 * griller la seule occasion qu'on a.
 *
 * Et la demande doit partir d'un geste : un navigateur refuse sèchement une
 * permission réclamée au chargement, sans rien montrer à personne.
 */
export function Notifications({ clePublique }: { clePublique: string }) {
  const [etat, setEtat] = useState<Etat>('inconnu');
  const [busy, setBusy] = useState(false);
  const [souci, setSouci] = useState<string | null>(null);

  useEffect(() => {
    const terrain = regarder();
    if (!terrain.installee) return setEtat('hors-app');
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return setEtat('hors-app');
    }
    if (Notification.permission === 'granted') return setEtat('active');
    if (Notification.permission === 'denied') return setEtat('refusee');
    setEtat('possible');
  }, []);

  async function activer() {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        setEtat('refusee');
        return;
      }

      const sw = await navigator.serviceWorker.register('/crush-sw.js', { scope: '/crush' });
      await actif(sw);

      const abonnement = await sw.pushManager.subscribe({
        // Obligatoire sur tous les navigateurs : on ne reçoit rien en
        // silence, chaque notification s'affiche.
        userVisibleOnly: true,
        applicationServerKey: enOctets(clePublique),
      });

      const brut = abonnement.toJSON() as { keys?: { p256dh?: string; auth?: string } };
      await fetch('/api/crush/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: abonnement.endpoint,
          p256dh: brut.keys?.p256dh ?? '',
          auth: brut.keys?.auth ?? '',
        }),
      });

      setEtat('active');
    } catch (cause) {
      // On dit ce qui s'est passé plutôt que de laisser un bouton tourner :
      // un écran qui attend sans fin ne se distingue pas d'un écran cassé.
      setSouci(cause instanceof Error ? cause.message : String(cause));
      setEtat('possible');
    } finally {
      setBusy(false);
    }
  }

  if (etat === 'hors-app' || etat === 'inconnu') return null;

  // Active : on le dit une fois, sobrement. Sans retour, on reste à se
  // demander si le bouton a servi à quelque chose.
  if (etat === 'active') {
    return (
      <p className="cr-notifs-ok">
        <span aria-hidden="true">●</span> Notifications activées
      </p>
    );
  }

  return (
    <div className="cr-notifs" data-refusee={etat === 'refusee' || undefined}>
      {etat === 'refusee' ? (
        <p>
          Les notifications sont bloquées. Tu peux les rouvrir dans Réglages → Lille in Love. Sans
          elles, garde simplement l’application ouverte pendant la soirée.
        </p>
      ) : (
        <>
          <p>
            Active les notifications pour être prévenu à l’ouverture de chaque crush time, et quand
            tu as un match.
          </p>
          {souci && <p className="cr-notifs-souci">{souci}</p>}
          <button type="button" className="cr-bouton cr-coeur" disabled={busy} onClick={activer}>
            {busy ? 'Un instant…' : souci ? 'Réessayer' : 'Activer les notifications'}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Attendre que le service worker soit vivant.
 *
 * Surtout pas « navigator.serviceWorker.ready » : il n'aboutit que si la
 * page elle-même est dans la portée du service worker. La page /crush, sans
 * barre oblique finale, était hors de la portée /crush/ — l'attente ne se
 * terminait jamais, et le bouton tournait indéfiniment.
 *
 * On regarde donc l'inscription qu'on vient d'obtenir, et on borne
 * l'attente : mieux vaut un message qu'un écran qui tourne.
 */
function actif(inscription: ServiceWorkerRegistration): Promise<void> {
  if (inscription.active) return Promise.resolve();

  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(
      () => rejeter(new Error('Le service de notification n’a pas démarré. Réessaie.')),
      10_000,
    );

    const candidat = inscription.installing ?? inscription.waiting;
    if (!candidat) {
      clearTimeout(minuterie);
      return rejeter(new Error('Le service de notification n’a pas pu s’installer.'));
    }

    candidat.addEventListener('statechange', () => {
      if (candidat.state === 'activated') {
        clearTimeout(minuterie);
        resoudre();
      }
    });
  });
}

/**
 * La clé publique voyage en base64 « url-safe » ; le navigateur la veut en
 * octets. Il n'y a pas d'abréviation pour cette conversion.
 */
function enOctets(base64: string): ArrayBuffer {
  const complet = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const brut = atob(complet);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  // On rend le tampon, et non la vue : la signature de « subscribe »
  // n'accepte pas un Uint8Array adossé à un ArrayBufferLike générique.
  return octets.buffer;
}
