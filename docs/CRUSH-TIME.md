# Crush Time — les règles décidées

Ce qui est arrêté, et pourquoi. À relire avant de coder un écran : plusieurs
de ces choix ont l'air arbitraires et ne le sont pas.

---

## Le jeu

| Règle | Détail |
| --- | --- |
| **Un like par crush time** | Trois manches, trois choix. Tenu par une contrainte d'unicité en base, pas par le code |
| **Définitif** | Pas de retour en arrière, pas de « deliker ». Et sans confirmation : un toucher sur le cœur suffit |
| **Quinze minutes** | Une manche se referme d'elle-même passé ce délai, même si personne ne l'a refermée. L'hôte peut abréger |
| **Un match ignore la manche** | Likée à 20h, qui like en retour à minuit : c'est un match. Sinon l'espérance tombe à ~1 match par manche |
| **Qui voit qui** | L'intérêt doit aller dans les deux sens. Sur une soirée 100 % hétéro, cela vaut exactement « le sexe opposé » ; le groupe G marche sans cas particulier |
| **Profil incomplet** | Sans genre connu, on ne voit personne et personne ne vous voit. Le tableau de bord le signale |
| **Le contact après le match** | Email et Instagram seulement une fois le match fait. Avant, on pourrait court-circuiter le jeu. Le téléphone n'est pas partagé |

À 25 femmes et 25 hommes, un like chacun, l'espérance est d'environ
**1 match par manche** si les goûts étaient répartis au hasard — et moins
en vrai, les likes se concentrant. Le choix d'un seul like est assumé.

## Les écrans

- **La page crush time affiche 2 profils par rangée.** Pas un par un façon
  pile de cartes : dans une salle, on cherche la personne à qui on vient de
  parler, et une grille se parcourt.
- **Un cœur en haut à droite de chaque carte** : on reconnaît un visage et on
  choisit, sans ouvrir la fiche. La confirmation reste, puisque le geste ne
  se reprend pas.
- **Les noms** s'affichent avec les trois premières lettres du nom de
  famille — « Samir Had. ». De quoi distinguer deux Thomas sans livrer
  l'identité de personne, comme le formulaire le promet en la demandant.
- **Le profil ouvert** donne prénom, âge, métier, ville, et une présentation
  **coupée vers 140 caractères** — personne ne lit dix lignes debout, et une
  fiche qui s'allonge repousse le bouton hors de l'écran.
- **« Mes matchs » est en haut à droite**, pas en bas : c'est la récompense du
  jeu, elle doit se voir sans être cherchée, et le bas de l'écran disparaît
  sous le pouce et les barres du navigateur.
- **Le panneau ne montre que les matchs.** Un like reste en sourdine tant
  qu'il n'est pas rendu : l'afficher en attente ne dit rien d'utile et
  installe une surveillance qui n'a pas sa place dans une soirée. Que le
  choix ait été pris en compte, le bandeau du haut le dit déjà.
- **Un match donne les trois photos**, le téléphone, l'email et l'Instagram.
  Un like en attente ne donne rien de tout cela : c'est au match qu'on décide
  si l'on écrit, et un seul visage ne suffit pas.
- **Le like se montre avant la réponse du serveur.** Une seconde d'écran
  immobile après un toucher se lit comme un clic raté, et on retouche. Si le
  serveur refuse, l'écran reprend ce qu'il avait montré.
- **L'écran se met à jour seul**, toutes les huit secondes, quand l'autre rend
  le like ou qu'un crush time s'ouvre. Personne ne recharge une page au
  milieu d'une soirée. La veille se tait quand l'application n'est pas à
  l'écran.
- **La photo de tête** est celle rangée en position 1 dans le back-office,
  réordonnable par glissé-déposé. Elle décide à peu près seule du sort d'un
  profil. Une candidature sans photo peut en recevoir une à la main depuis
  sa fiche, et chaque photo se retire — le fichier part avec la ligne.
- **Le genre se corrige depuis la fiche.** Quelqu'un coche la mauvaise case,
  et toute la soirée en découle : le genre décide de qui voit qui. La
  correction suit jusque dans les soirées où la personne est déjà inscrite,
  qui en gardent une copie figée à l'inscription.
- Un like se confirme avant d'être écrit, puisqu'il ne se reprend pas.

## Composer la soirée

Deux portes, depuis l'onglet Soirées :

- **Cocher dans la liste** — le cas courant. On connaît ces gens, on les a
  triés en groupes, on sait qui on veut voir ensemble. Recherche, cases à
  cocher par groupe — **plusieurs à la fois**, aucune cochée valant « tous »
  — et « tout cocher » limité à ce que le filtre montre.
- **Importer un CSV** — quand c'est la billetterie qui fait foi. Seule
  l'adresse email est nécessaire ; le reste vient de la candidature.

Dans les deux cas, **le compte femmes / hommes reste sous les yeux**. Une
soirée à trente hommes et cinq femmes ne se rattrape pas sur place, et c'est
en cochant qu'on peut encore l'éviter.

On peut ajouter quelqu'un après coup, pour un billet de dernière minute.
**Réinscrire quelqu'un ne change pas son jeton** : le lien déjà envoyé doit
continuer de fonctionner.

## Entrer

**Un QR unique pour la salle**, affiché sur les tables ou un écran, et
imprimable depuis le tableau de bord de la soirée. Cinquante QR personnels
coûteraient trop cher à imprimer — celui-ci mène à `/crush`, où l'on dit
qui l'on est.

Pourquoi un QR plutôt qu'un lien cliqué dans le mail : **scanné avec
l'appareil photo, il ouvre Safari.** Un lien ouvert depuis l'app Gmail
s'ouvre dans son navigateur intégré, où « Ajouter à l'écran d'accueil »
n'existe pas. C'est la seule façon fiable de ne pas s'y retrouver enfermé.

**Chacun a son code à quatre chiffres**, reçu par mail avant la soirée.
Avec son adresse, il suffit à entrer. Le code de la soirée existe toujours
mais c'est désormais un **secours** : il ouvre n'importe quelle adresse de
la liste, et ne doit être annoncé que pour dépanner quelqu'un qui ne
retrouve plus son message.

Dix essais par quart d'heure et par adresse : quatre chiffres se devinent
en dix mille coups, pas en dix.

Le **lien personnel** envoyé par mail reste le chemin le plus court pour
qui le fait au calme, la veille.

La session tient deux jours, dans un cookie. **Supprimer l'icône de
l'écran d'accueil ne déconnecte pas** : ce sont deux choses séparées, et
Safari garde ce qu'il sait. D'où « Connecté en tant que X — changer » tout
en bas, pour essayer plusieurs profils depuis un seul téléphone.

## L'installation et les notifications

Sur iPhone, le web push n'existe **que** pour une application ajoutée à
l'écran d'accueil. Ce n'est pas un réglage : c'est la règle d'Apple. Sans
installation, pas de notification — pour la moitié de la salle.

Le choix a été fait d'essayer l'installation plutôt que le SMS. Le lien
personnel part donc **par email**, avant la soirée, et la page d'arrivée ne
montre pas les profils : elle montre comment poser l'icône.

### Les trois pièges, et ce qui les traite

**Le navigateur de Gmail.** Un lien ouvert depuis l'app Gmail s'ouvre dans
son navigateur intégré, où « Ajouter à l'écran d'accueil » n'existe pas, et
personne ne le devine. L'écran le détecte, l'explique, et propose de copier
le lien pour le coller dans Safari. Même chose pour Instagram, Facebook,
LinkedIn, et pour Chrome ou Firefox sur iOS. **Le QR de la salle évite tout
cela** : scanné avec l'appareil photo, il ouvre Safari.

**Le stockage séparé.** L'application installée a son propre stockage,
distinct de Safari : connecté dans Safari puis installé, on ouvre l'icône
*déconnecté*. Le manifeste est donc servi par `/crush/manifeste?t=<jeton>`
et son `start_url` absolu porte le jeton.

**« no-store » sur le manifeste.** Il interdisait à Safari de le garder, et
l'application installée s'ouvrait sur une page blanche. `private` écarte les
caches partagés sans empêcher le navigateur de le conserver.

**Le blocage.** L'écran ne se contourne pas là où un chemin d'installation
existe : sans icône, la personne ne saura pas qu'un crush time s'est
ouvert, et toute la soirée repose là-dessus. Une seule exception, et elle
est nécessaire — quand aucun chemin n'existe (un ordinateur, un navigateur
qui ne sait pas installer), refuser le passage enfermerait quelqu'un
dehors sans lui donner le moyen d'entrer.

Sur Android, `beforeinstallprompt` donne un vrai bouton : un geste.

**L'icône se grave à l'installation.** iOS la fige au moment où on pose le
raccourci, et l'hébergeur sert `public/` avec un an de cache : changer le
dessin sans changer l'adresse laisse l'ancienne image en place, même après
avoir supprimé puis réinstallé. Les adresses portent donc un numéro de
version — `src/lib/icones.ts`, à incrémenter à chaque nouveau dessin, et à
recopier dans `public/crush/sw.js` qui ne peut pas l'importer.

Un **widget** reste impossible — réservé aux applications natives.

### Les notifications

Deux moments, deux seulement : **l'ouverture d'une manche** et **un match**.
Un like reste muet — le notifier dirait à l'autre qu'il a été choisi.

**Rouvrir une manche prévient de nouveau** — c'est ce qu'il faut pour
essayer, et aussi le soir même : une manche rouverte parce qu'on l'avait
fermée trop tôt doit se redire. Ce qu'on écarte, c'est le double appui :
deux ouvertures à moins d'une minute ne sonnent qu'une fois. Un match, lui,
ne s'annonce qu'une seule fois.

### Le son et la vibration

Ce qui est possible, et ce qui ne l'est pas :

| | iPhone | Android |
| --- | --- | --- |
| Son d'une notification poussée | **Oui**, le son système | **Oui**, le son système |
| Son personnalisé | Non — aucun navigateur ne l'implémente | Non |
| Vibration d'une notification | **Non** — Safari n'a pas l'API Vibration | **Oui** |
| Son et vibration **dans** l'application ouverte | Son oui, vibration non | Les deux |

Le dernier cas est le plus important et le seul qu'on contrôle : quand
l'application est ouverte sous les yeux, **le système n'affiche aucune
notification**. Un écran qui se redessine en silence ne se remarque pas
dans une salle bruyante. La veille joue donc elle-même deux notes montantes
à l'ouverture d'une manche, trois pour un match — synthétisées, sans
fichier à charger. Le son doit être déverrouillé par un geste : on le
prépare dès l'arrivée sur la page, bien avant d'en avoir besoin.

Les clés VAPID vivent dans `.env.local` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`). **Sans elles, rien n'est envoyé et tout le reste
marche** — la veille de huit secondes fait déjà basculer l'écran de ceux
qui l'ont sous les yeux.

Le service worker vit à **`/crush-sw.js`, à la racine**, et réclame la
portée `/crush`. Il a d'abord vécu dans `/crush/`, ce qui paraissait plus
propre — mais un service worker ne peut prendre en charge que son propre
dossier, et la page `/crush`, sans barre oblique finale, en était exclue.
`navigator.serviceWorker.ready` ne répondait alors jamais et le bouton
d'activation tournait sans fin. L'application ne s'en sert plus : elle
attend l'inscription qu'elle vient d'obtenir, avec une borne de dix
secondes et un message en cas d'échec.

Il ne met rien en cache ; une soirée dure trois heures, et un cache mal
réglé montrerait des profils périmés au pire moment.

Un abonnement que le service déclare mort (404, 410) est effacé : un
téléphone réinstallé en laisse un derrière lui.

## Le soir

L'ordre des gestes, et l'ordre du tableau de bord : **le code à annoncer →
l'appel → les trois crush times**. On retire les absents *avant* d'ouvrir la
première manche — quelqu'un qui a payé sans venir occuperait sinon une place
dans les profils toute la soirée. Retiré, il libère au passage le like de
ceux qui l'avaient choisi ; ses matchs déjà faits restent, ils appartiennent
aussi à l'autre.

L'ouverture d'une manche reste un geste de l'hôte, même si l'heure est
annoncée : une soirée ne tient jamais son horaire.

## Où ça vit

`crush.in-love.fr` — même application, second domaine. Deux origines
séparées : une faille dans l'application des participants ne doit pas
atteindre la session du back-office. Repli possible sur
`app.in-love.fr/crush`, au prix de ce cloisonnement.

## Les migrations

`13_crushtime.sql` (le schéma), `14_ordre_photos.sql` (l'ordre des photos),
`15_duree_manches.sql` (les quinze minutes), `16_code_personnel.sql` (le
code de chacun), `17_notifications.sql` (la trace des envois).

## Voir tout ça en local

```bash
npm run demo
```

Faux Supabase, application par-dessus, et de quoi cliquer : des
candidatures avec leurs photos, une soirée, son crush time **déjà ouvert**,
ses participants, et un acheteur sans profil pour voir l'alerte. **Rien
n'est écrit dans la vraie base, aucun email ne part.**

La commande affiche aussi deux liens de participants. Samir a déjà choisi
Inès : entre comme Inès, choisis Samir, et le match se fait sous tes yeux.

`npm run dev`, lui, parle au vrai Supabase : un import de test y créerait
de vraies lignes.

## Les photos

Servies par `/admin/photo/<id>` et `/crush/photo/<id>`, **réduites à la
taille qu'on en fait** — `?t=vignette` (192 px), `?t=carte` (760 px), sinon
pleine (1600 px) — et **gardées en mémoire** après le premier passage. Une
photo ne change jamais : la deuxième demande ne touche ni la base ni le
stockage.

Avant cela, une pastille de quarante pixels faisait descendre les trois
cents kilo-octets de l'original, cent quarante fois de suite, avec deux
allers-retours vers Supabase chacune. Sur une photo de 815 Ko mesurée :
vignette **moins de 1 Ko**, carte **8 Ko**, pleine **120 Ko** ; et 18 ms au
second passage.

`sharp` fait le travail. Il arrivait avec Next en dépendance facultative :
il est désormais déclaré, pour qu'un `npm ci` sur l'hébergeur ne l'oublie
pas. S'il manquait malgré tout, les routes renvoient l'original plutôt que
rien.
