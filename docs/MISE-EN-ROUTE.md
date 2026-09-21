# Mise en route

État au 20 septembre 2026.

Le formulaire tourne, la curation aussi. Il reste **une migration SQL à
passer** et **le déploiement de l'application** sur `app.in-love.fr`.

---

## 0. Où on en est

| Élément | État |
| --- | --- |
| Projet Supabase | `sljvoplsedepnecgmjih`, bucket `lil-photos` privé |
| Scripts SQL passés | `01` à `05`, et `08` |
| **À passer d'urgence** | **`10_accompagnant.sql`** — sans lui, toute candidature « je viens accompagné » est refusée |
| **À passer aussi** | **`09_simplification.sql`** — il ouvre le groupe G |
| Resend | domaine **`in-love.fr` vérifié**, clé en place |
| Expéditeur / réponse | `Lille in Love <info@in-love.fr>` |
| `.env.local` | rempli et valide — `/api/health` répond `ok: true` |
| Sur WordPress | le **formulaire autonome** est en ligne sur `/inscription/` |
| Application | **pas encore déployée** |

Les deux sont relançables sans risque : ils n'envoient aucun email et ne
modifient aucune candidature.

> **`10_accompagnant.sql` est urgent.** Le schéma d'origine exigeait l'email
> de l'accompagnant dès qu'on cochait « je viens avec quelqu'un ». L'étape 12
> ne demande plus cet email : la base rejette donc ces candidatures, et la
> personne voit « On n'a pas réussi à enregistrer ta candidature ». Ces
> inscriptions-là ne laissent aucune trace — elles sont perdues.

Les pages légales vivent sur **lilleinlove.fr** (`/reglement`,
`/confidentialite`) : les mêmes adresses sur in-love.fr renvoient 404, d'où
les liens du formulaire.

---

## 1. Comment ça marche, en une page

**Deux emails partent au candidat, pas un de plus :**

| Email | Quand |
| --- | --- |
| 01 · Candidature reçue | à l'inscription, tout de suite |
| 02 · Bienvenue dans le club | **6 h après la validation** |

**Un troisième message vient à toi**, pas au candidat : à chaque inscription,
une alerte part sur `info@in-love.fr` avec le nom, l'adresse et un lien vers
la fiche. Répondre à ce message écrit directement à la personne.

**On ne refuse personne.** Chaque candidature est validée, et c'est son
**groupe** — A, B, C ou G (soirées gays) — qui dit à quelle soirée elle
correspond.

**Les soirées n'envoient rien.** On les note pour s'en souvenir ; l'email
d'invitation reste à écrire.

---

## 2. Essayer en local

```bash
npm install
npm run dev
```

| Adresse | Ce que c'est |
| --- | --- |
| `localhost:3000/` | le back-office (la racine y mène) |
| `localhost:3000/embed` | le formulaire complet, 16 étapes |
| `localhost:3000/embed/court` | le formulaire court, 3 écrans |
| `localhost:3000/api/health` | ce qui est configuré, ou ce qui manque |

Inscris-toi avec ta propre adresse, valide ta fiche dans `/admin`, et la
bienvenue part au délai configuré (`DELAI_REPONSE_MINUTES=2` en local, pour
ne pas attendre six heures).

### Vérifier sans rien casser

```bash
npm run test:curation   # tout, de l'inscription aux emails — sans aucune clé
npm run test:e2e        # le formulaire dans un navigateur (npm run dev à côté)
npm run test:reel       # en conditions réelles, puis efface ses propres traces
```

Les deux premières tournent contre un faux Supabase et un faux Resend : rien
ne sort de la machine, et elles ont leur propre dossier de build — ton
`npm run dev` peut continuer de tourner pendant ce temps. `test:reel` écrit
vraiment dans ta base et envoie vraiment (vers `delivered@resend.dev`, que
personne ne lit), puis supprime ce qu'il a créé.

### Un écran sans aucun style ?

C'est le symptôme d'un `.next` effacé sous un serveur qui tournait. `Ctrl+C`,
puis `npm run dev`.

---

## 3. Déployer sur `app.in-love.fr`

Le plan gratuit de Vercel est réservé à un usage **non commercial** ; Lille in
Love vend des soirées. On passe donc par Hostinger, qui propose « Déployer
Application web » sur les offres Business et Cloud.

### a. Le code est sur GitHub

```bash
git push origin main
```

`.env.local` et `.env.hostinger.local` sont exclus par `.gitignore` : aucune
clé ne part sur GitHub. Ne mets **jamais** de vraie valeur dans
`.env.example`, qui lui est versionné — GitHub bloque les envois contenant
une clé, et un crochet de pré-commit le bloque avant lui.

### b. Créer l'application

hPanel → **Sites web → Ajouter un site web → Déployer Application web →
Importer un dépôt Git**, puis :

| Réglage | Valeur |
| --- | --- |
| Dépôt / branche | `lille-in-love` / `main` |
| Framework | Next.js |
| Version de Node | **20 ou 22** |
| Commande d'installation | `npm ci` |
| Commande de build | `npm run build` |
| Commande de démarrage | `npm run start` |
| Dossier de sortie | `.next` |

### c. Les variables d'environnement

**Le plus simple : importer le fichier tout prêt.** `.env.hostinger.local`, à
la racine du projet, contient les **15 variables** avec les valeurs de
production.
Dans le tableau de bord du site : **Variables d'environnement → Importer .env**.

> Ce fichier contient tes clés. Il est exclu de git, ne le partage pas. Il
> comporte un `ADMIN_CODE` tout neuf : si tu en as déjà un chez Hostinger et
> que tu préfères le garder, supprime cette ligne avant d'importer.

À la main, ce sont ces quinze noms — **il les faut tous** :

```
SUPABASE_URL                 RESEND_API_KEY          ADMIN_CODE
SUPABASE_SERVICE_ROLE_KEY    EMAIL_FROM              DELAI_REPONSE_MINUTES
SUPABASE_STORAGE_BUCKET      EMAIL_REPLY_TO          VOTES_REQUIS
IP_HASH_SALT                 ALLOWED_EMBED_ORIGINS   MAX_INSCRIPTIONS_PAR_HEURE
NEXT_PUBLIC_SITE_URL         MAX_PHOTOS_PAR_10MIN    EMAIL_PREVIEW_TOKEN
```

Quatre valeurs diffèrent de ton `.env.local` :

| Variable | En production | Pourquoi |
| --- | --- | --- |
| `DELAI_REPONSE_MINUTES` | **`360`** | 6 h. En local, `2` pour les essais. |
| `ADMIN_CODE` | **un code long** | sans lui, `/admin` est public une fois en ligne |
| `IP_HASH_SALT` | **une nouvelle valeur** | `openssl rand -hex 32` |
| `VOTES_REQUIS` | `1` ou `2` | `2` pour la règle des deux curateurs |

**Après toute modification, redéploie** : les variables sont lues au
démarrage, et `ALLOWED_EMBED_ORIGINS` dès la construction.

> **`EMAIL_FROM` sans guillemets.** Sa valeur contient des espaces et des
> chevrons : `Lille in Love <info@in-love.fr>`. Si l'importateur laisse des
> guillemets autour, Resend refuse l'expéditeur — `/api/health` le signale.

> **`/admin` en ligne sans `ADMIN_CODE`** : n'importe qui trouvant l'adresse
> voit les noms, les emails et les photos des candidats. Renseigne-le.

### d. Si le déploiement échoue

| Ce que dit Hostinger | Ce qui se passe |
| --- | --- |
| `Module not found: Can't resolve '@/…'` | l'installation a sauté les devDependencies. TypeScript est une dépendance normale depuis le 20/09 : ce cas est réglé. |
| `/api/health` liste des variables vides | l'import du `.env` ne s'est pas fait, ou le site n'a pas été redéployé depuis. |
| `"cleSupabase": "anon"` dans `/api/health` | c'est la clé publique qui a été collée à la place de `service_role` : l'application lit, mais n'écrit rien. |
| build interrompu sans message | mémoire ou temps de construction dépassés. Relance : la seconde tentative repart d'un cache chaud. |
| rien ne se déclenche | Hostinger n'est pas sur le dernier commit de `main`. |

Un déploiement complet occupe environ **600 Mo** (400 Mo de dépendances,
170 Mo de build) pour **11 000 fichiers**.

**Supprimer l'application ne perd aucune donnée** : les candidatures, les
photos et les emails sont chez Supabase et Resend. Seuls le sous-domaine et
les variables sont à refaire.

### e. Le sous-domaine

Dans les réglages du site, section **Domaines**, indique `app.in-love.fr`. Le
domaine étant chez Hostinger, le DNS et le certificat HTTPS se configurent
seuls. Compte quelques minutes à quelques heures.

### f. Vérifier

- `https://app.in-love.fr/api/health` → `"ok": true`, `"problemes": []`, et
  `"expediteur"` affiche bien `Lille in Love <info@in-love.fr>` ;
- `https://app.in-love.fr/` → le back-office, qui demande le code ;
- `https://app.in-love.fr/embed` → le formulaire s'affiche.

Chaque `git push` sur `main` redéploie ensuite tout seul.

---

## 4. Brancher la page WordPress

### Aujourd'hui : le formulaire autonome

C'est ce qui est en ligne. Le navigateur écrit directement dans Supabase ; les
candidatures et les photos arrivent bien, **mais aucun email ne part** — cela
demande un serveur.

Pour le mettre à jour, recolle
[`formulaire-autonome-complet.html`](formulaire-autonome-complet.html) (ou
[`-court.html`](formulaire-autonome-court.html)) dans le bloc HTML de la page,
puis **renseigne la ligne `SUPABASE_ANON_KEY`** (Supabase → Settings → API →
clé *anon public*) et purge le cache LiteSpeed.

> **Retire le titre « JE VEUX PARTICIPER » de la page WordPress** : le
> formulaire porte le sien désormais, il apparaîtrait deux fois.

### Une fois l'application déployée : l'iframe

Remplace le contenu du bloc HTML par :

```html
<div data-lil-form="complet" data-lil-app="https://app.in-love.fr" data-min-height="560"></div>
<script src="https://app.in-love.fr/embed.js" async></script>
```

Puis exécute `supabase/07_fermer_formulaire_autonome.sql`, qui referme
l'écriture directe depuis le navigateur.

**Garde `data-lil-app`.** LiteSpeed Cache peut regrouper les scripts de la
page : sans cet attribut, le formulaire chercherait l'application sur
in-love.fr et ne s'afficherait pas.

Si rien ne s'affiche :
- message `frame-ancestors` en console → `ALLOWED_EMBED_ORIGINS` ne contient
  pas l'adresse exacte du site ; corrige, puis **redéploie** ;
- rien du tout → LiteSpeed Cache → *Optimisation de page* → exclus `embed.js`
  de l'optimisation JS.

---

## 5. Le formulaire

### Ce que le visiteur voit en arrivant

« Je veux *participer* », puis la carte de la soirée : « La première soirée /
Célibataires 27-35 ans », ses repères, **le prix — 20 € par personne** — et,
dessous, une ligne qui dit que ce tarif exceptionnel augmentera pour les
soirées suivantes.

Tout ce bloc se modifie dans **un seul endroit** : `src/lib/brand.ts`,
constante `SOIREE`. Après modification, regénère le formulaire autonome :

```bash
node tools/formulaire-autonome/build.mjs
```

### Deux détails à connaître

**Le nom de famille est demandé en entier**, avec une indication : « au
minimum les trois premières lettres, si tu préfères rester discret·e ». Rien
n'est coupé : qui écrit son nom complet le garde.

**Les photos d'iPhone (HEIC) sont converties dans le navigateur.** Safari sait
lire ce format, ni Chrome ni Android : une photo déposée telle quelle
deviendrait un carré blanc dans l'espace de curation. Les deux formulaires la
convertissent en JPEG avant l'envoi, et le back-office décode à l'affichage
les quelques HEIC déposés avant ce changement.

---

## 6. Le back-office

`https://app.in-love.fr/admin`

### Décider

Une fiche par personne : photos en grand (clic pour agrandir, flèches pour
passer de l'une à l'autre), réponses, et le journal des emails.

Un seul bouton : **Valider la candidature**. Elle programme « Bienvenue dans
le club » six heures plus tard.

Le second bouton, **« Annuler la validation »**, n'est pas un refus : c'est le
droit à l'erreur. Il n'apparaît qu'après une validation, remet la candidature
dans la file et arrête l'envoi en attente. Si Resend refuse l'annulation —
cela arrive dans les toutes premières secondes — la fiche l'affiche en rouge
avec un bouton **Annuler cet envoi** ; un clic quelques secondes plus tard
suffit toujours.

Une fiche marquée **« à vérifier »** signale un envoi inhabituel (formulaire
rempli très vite). La candidature est conservée : c'est souvent quelqu'un de
pressé.

### Retrouver quelqu'un

Le champ de recherche en haut cherche dans le prénom, le nom, l'email et la
ville, et se combine avec les filtres. Les accents comptent.

### Trier, grouper, exporter

Chaque fiche se range dans un **groupe : A, B, C ou G**. Les touches sont à
droite de chaque ligne, et sur la fiche. C'est une étiquette de travail :
**aucun email ne part, le statut ne change pas**. La touche **—** retire du
groupe.

L'icône **Filtres**, à droite, ouvre un panneau : groupe, femmes/hommes,
orientation (gay ou autre), tranche d'âge. Le compteur se met à jour à la
saisie, et l'icône porte le nombre de critères en cours.

> Une fiche du formulaire court n'a pas de date de naissance : dès qu'une
> borne d'âge est posée, elle sort de la sélection. Le filtre « autre »
> garde en revanche celles qui n'ont pas répondu sur l'orientation.

**Exporter en CSV**, dans le même panneau, télécharge exactement la sélection
affichée, au format des exports que l'équipe utilise déjà : mêmes colonnes,
même ordre, mêmes valeurs (`F`/`M`, `serieux`, `True`/`False`…).

### Soirées

`/admin/soirees` : nom, classe d'âge, date, heure, lieu. **Aucun email n'est
envoyé** — ni à l'enregistrement, ni plus tard.

---

## 7. La recette avant d'ouvrir

- [ ] `supabase/10_accompagnant.sql` exécuté (bloquant)
- [ ] `supabase/09_simplification.sql` exécuté
- [ ] Une inscription en répondant **« oui, je viens avec quelqu'un »**
- [ ] `DELAI_REPONSE_MINUTES=360` en production
- [ ] `ADMIN_CODE` renseigné
- [ ] `IP_HASH_SALT` différent de celui du poste local
- [ ] `/api/health` répond `ok: true` sur `app.in-love.fr`
- [ ] Une inscription de bout en bout **depuis un iPhone**, photo comprise
- [ ] L'alerte arrive sur `info@in-love.fr`
- [ ] L'email « Candidature reçue » arrive chez le candidat (regarde les spams)
- [ ] La fiche apparaît dans `/admin` avec ses photos
- [ ] Le titre en double retiré de la page WordPress
- [ ] `07_fermer_formulaire_autonome.sql` exécuté si tu passes à l'iframe

Pour relire les deux emails sans rien envoyer :
`https://app.in-love.fr/api/emails/preview?token=<EMAIL_PREVIEW_TOKEN>`

---

## Ce qui reste à construire

- **L'email d'invitation à une soirée**, envoyé aux membres du bon groupe. Son
  texte n'a jamais été rédigé ; c'est la suite de la séquence, et la seule
  raison qui reste d'enregistrer une soirée.
- **La date de naissance dans le formulaire court**, sans laquelle ces
  inscrits ne peuvent être ni classés par âge ni invités.
