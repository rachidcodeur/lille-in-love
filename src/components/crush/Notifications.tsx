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

      const sw = await navigator.serviceWorker.register('/crush/sw.js', { scope: '/crush/' });
      await navigator.serviceWorker.ready;

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
    } catch {
      setEtat('refusee');
    } finally {
      setBusy(false);
    }
  }

  if (etat === 'hors-app' || etat === 'inconnu' || etat === 'active') return null;

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
          <button type="button" className="cr-bouton cr-coeur" disabled={busy} onClick={activer}>
            {busy ? 'Un instant…' : 'Activer les notifications'}
          </button>
        </>
      )}
    </div>
  );
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
