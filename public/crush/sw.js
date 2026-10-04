/**
 * Le service worker du crush time.
 *
 * Il ne sert qu'à une chose : recevoir les notifications quand
 * l'application est fermée. Pas de mise en cache, pas de mode hors ligne —
 * une soirée dure trois heures, le réseau est là, et un cache mal réglé
 * montrerait des profils périmés au pire moment.
 *
 * Il vit sous /crush/ : un service worker ne peut agir que sur son dossier
 * et ce qu'il contient, et c'est exactement la portée qu'on veut. Le
 * back-office n'a rien à faire ici.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evenement) => evenement.waitUntil(self.clients.claim()));

self.addEventListener('push', (evenement) => {
  let message = { titre: 'Lille in Love', corps: '', lien: '/crush' };
  try {
    message = { ...message, ...evenement.data.json() };
  } catch {
    /* une notification sans contenu lisible reste une notification */
  }

  evenement.waitUntil(
    self.registration.showNotification(message.titre, {
      body: message.corps,
      icon: '/crush-192.png',
      badge: '/crush-192.png',
      // Deux notifications de même étiquette se remplacent : trois crush
      // times n'empilent pas trois bannières oubliées.
      tag: message.etiquette || 'lil-crush',
      renotify: true,
      data: { lien: message.lien },
      vibrate: [60, 40, 60],
    }),
  );
});

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const lien = evenement.notification.data?.lien || '/crush';

  evenement.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Si l'application est déjà ouverte quelque part, on la ramène au
      // premier plan plutôt que d'en ouvrir une seconde.
      for (const fenetre of fenetres) {
        if (fenetre.url.includes('/crush')) {
          await fenetre.focus();
          if ('navigate' in fenetre) await fenetre.navigate(lien);
          return;
        }
      }
      await self.clients.openWindow(lien);
    })(),
  );
});
