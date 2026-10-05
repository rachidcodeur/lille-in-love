/**
 * Le service worker du crush time.
 *
 * Il ne sert qu'à une chose : recevoir les notifications quand
 * l'application est fermée. Pas de mise en cache, pas de mode hors ligne —
 * une soirée dure trois heures, le réseau est là, et un cache mal réglé
 * montrerait des profils périmés au pire moment.
 *
 * Il vit à la racine, et non sous /crush/ : un service worker ne peut
 * prendre en charge que son propre dossier et ce qu'il contient, et celui
 * qui vivait dans /crush/ ne couvrait donc pas la page /crush elle-même —
 * sans barre oblique finale, elle est en dehors. De la racine, il peut
 * réclamer la portée « /crush », qui couvre les deux.
 *
 * La portée est demandée à l'inscription : le back-office n'a rien à faire
 * ici, et il n'y est pas.
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
      // Le numéro suit celui de src/lib/icones.ts : un service worker ne
      // peut pas importer, alors on le recopie — et ce commentaire est là
      // pour qu'on pense à le bouger en même temps.
      icon: '/crush-192.png?v=2',
      badge: '/crush-192.png?v=2',
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
