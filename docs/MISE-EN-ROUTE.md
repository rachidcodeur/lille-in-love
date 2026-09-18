# Mise en route

État au 18 septembre 2026. Supabase et Resend sont configurés et vérifiés ;
il reste à déployer l'application et à brancher la page WordPress.

---

## 0. Ce qui est déjà fait

| Élément | État |
| --- | --- |
| Projet Supabase | `sljvoplsedepnecgmjih` — les 5 scripts SQL sont passés, bucket `lil-photos` privé |
| Resend | domaine **`in-love.fr` vérifié**, clé en place |
| Expéditeur | `Lille in Love <info@in-love.fr>` |
| Adresse de réponse | `info@in-love.fr` |
| `.env.local` | rempli et valide — `/api/health` répond `ok: true` |

Les pages légales vivent sur **lilleinlove.fr** (`/reglement`,
`/confidentialite`). Les mêmes adresses sur in-love.fr renvoient 404, c'est
pourquoi les liens du formulaire pointent sur lilleinlove.fr.

---

## 1. Essayer en local

```bash
npm install
npm run dev
```

| Adresse | Ce que c'est |
| --- | --- |
| `localhost:3000/` | le back-office (la racine y mène directement) |
| `localhost:3000/embed/court` | le formulaire court (3 écrans) |
| `localhost:3000/embed` | le formulaire complet (16 étapes) |
| `localhost:3000/api/health` | ce qui est configuré, ou ce qui manque |

Inscris-toi avec ta propre adresse, puis valide ta fiche dans `/admin` :
l'email de bienvenue part après le délai configuré.

### Vérifier sans rien casser

```bash
npm run test:curation   # tout, de l'inscription aux emails — sans aucune clé
npm run test:e2e        # le formulaire, dans un navigateur (npm run dev à côté)
npm run test:reel       # en conditions réelles, puis efface ses propres traces
```

Les deux premières tournent contre un faux Supabase et un faux Resend : rien
ne sort de la machine. `test:reel` écrit vraiment dans ta base et envoie
vraiment (vers `delivered@resend.dev`, que personne ne lit), puis supprime ce
qu'il a créé — il ne touche jamais aux autres candidatures.

---

## 2. Déployer l'application sur `app.in-love.fr`

Le plan gratuit de Vercel est réservé à un usage **non commercial** ; Lille in
Love vend des soirées. On passe donc par Hostinger, qui propose « Déployer
Application web » sur les offres Business et Cloud.

### a. Mettre le code sur GitHub

Crée un dépôt **privé** vide, puis :

```bash
git add .
git commit -m "Formulaire, curation et soirées"
git push -u origin main
```

`.env.local` est exclu par `.gitignore` : aucune clé ne part sur GitHub. Ne
mets **jamais** de vraie valeur dans `.env.example`, qui lui est versionné —
GitHub bloque les envois contenant une clé.

### b. Créer l'application chez Hostinger

hPanel → **Sites web → Ajouter un site web → Déployer Application web →
Importer un dépôt Git**, puis :

| Réglage | Valeur |
| --- | --- |
| Framework | Next.js |
| Version de Node | 20 ou 22 |
| Commande d'installation | `npm ci` |
| Commande de build | `npm run build` |
| Commande de démarrage | `npm run start` |
| Dossier de sortie | `.next` |

### c. Les variables d'environnement

**Le plus simple : importer le fichier tout prêt.** `.env.hostinger.local`, à
la racine du projet, contient déjà les 14 variables avec les valeurs de
production (délai à 24 h, nouveau sel, code d'accès). Dans le tableau de bord
du site : **Variables d'environnement → Importer .env**.

> Ce fichier contient tes clés. Il est exclu de git, ne le partage pas. Il
> comporte aussi un `ADMIN_CODE` tout neuf : si tu en as déjà saisi un chez
> Hostinger et que tu préfères le garder, supprime cette ligne avant
> d'importer.

Si tu préfères les saisir à la main, voilà les 14 noms — **il faut les 14**,
une seule manquante et l'application ne démarre pas :

```
SUPABASE_URL                 RESEND_API_KEY          ADMIN_CODE
SUPABASE_SERVICE_ROLE_KEY    EMAIL_FROM              DELAI_REPONSE_MINUTES
SUPABASE_STORAGE_BUCKET      EMAIL_REPLY_TO          VOTES_REQUIS
IP_HASH_SALT                 ALLOWED_EMBED_ORIGINS   MAX_INSCRIPTIONS_PAR_HEURE
NEXT_PUBLIC_SITE_URL         MAX_PHOTOS_PAR_10MIN
```

Quatre valeurs diffèrent de ton `.env.local` :

| Variable | En production | Pourquoi |
| --- | --- | --- |
| `DELAI_REPONSE_MINUTES` | **`1440`** | 24 h. En local, c'est `2` pour les essais. |
| `ADMIN_CODE` | **un code long** | sans lui, `/admin` est public une fois en ligne |
| `IP_HASH_SALT` | **une nouvelle valeur** | `openssl rand -hex 32` |
| `VOTES_REQUIS` | `1` ou `2` | `2` pour la règle des deux curateurs |

**Après toute modification, redéploie** : les variables sont lues au démarrage,
et `ALLOWED_EMBED_ORIGINS` dès la construction.

> **`EMAIL_FROM` sans guillemets.** Sa valeur contient des espaces et des
> chevrons : `Lille in Love <info@in-love.fr>`. Si l'importateur laisse des
> guillemets autour, Resend refuse l'expéditeur — `/api/health` le signale.

> **`/admin` en ligne sans `ADMIN_CODE`** : n'importe qui trouvant l'adresse
> voit les noms, emails et photos des candidats — et peut publier une soirée,
> ce qui envoie des emails. Renseigne-le.

### d. Le sous-domaine

Dans les réglages du site, section **Domaines**, indique `app.in-love.fr`.
Le domaine étant chez Hostinger, le DNS et le certificat HTTPS se configurent
seuls. Compte quelques minutes à quelques heures.

### e. Vérifier

- `https://app.in-love.fr/api/health` → `"ok": true`, `"problemes": []`,
  et `"expediteur"` affiche bien `Lille in Love <info@in-love.fr>`
- `https://app.in-love.fr/` → redirige vers le back-office, qui demande le code
- `https://app.in-love.fr/embed/court` → le formulaire s'affiche

Si `/api/health` liste des variables vides, elles ne sont pas arrivées jusqu'à
l'application : vérifie-les dans le tableau de bord, puis **redéploie**.

Chaque `git push` sur `main` redéploie ensuite tout seul.

---

## 3. Brancher la page WordPress

1. Modifie `in-love.fr/inscription/` et supprime le bloc Tally.
2. À sa place, un bloc **HTML personnalisé** avec le contenu de
   [`widget-wordpress.html`](widget-wordpress.html) :

   ```html
   <div data-lil-form="court" data-lil-app="https://app.in-love.fr" data-min-height="560"></div>
   <script src="https://app.in-love.fr/embed.js" async></script>
   ```

3. Publie, puis **purge le cache** (LiteSpeed Cache → *Purger tout*).
4. Ouvre la page en navigation privée.

**Garde `data-lil-app`.** LiteSpeed Cache peut regrouper les scripts de la
page : sans cet attribut, le formulaire chercherait l'application sur
in-love.fr et ne s'afficherait pas.

Pour passer au questionnaire entier : `data-lil-form="complet"`.

Si rien ne s'affiche :
- message `frame-ancestors` en console → `ALLOWED_EMBED_ORIGINS` ne contient
  pas l'adresse exacte du site ; corrige, puis **redéploie** ;
- rien du tout → LiteSpeed Cache → *Optimisation de page* → exclus `embed.js`
  de l'optimisation JS.

---

## 4. Le back-office

`https://app.in-love.fr/admin`

### Candidatures

Une fiche par personne : photos en grand (clic pour agrandir, flèches pour
passer de l'une à l'autre), réponses, et le journal des emails.

| Bouton | Email envoyé | Quand |
| --- | --- | --- |
| Valider — profil retenu | 02 · Bienvenue dans le club | 24 h après le clic |
| Refuser — profil non retenu | *(rien sur le moment)* | à la publication d'une soirée |

Revenir sur une validation avant l'envoi annule la bienvenue en attente.
Recliquer la même décision ne change rien. Si Resend refuse l'annulation
— cela arrive dans les toutes premières secondes — la fiche l'affiche en
rouge avec un bouton **Annuler cet envoi** ; un clic quelques secondes plus
tard suffit toujours.

Une fiche marquée **« à vérifier »** signale un envoi inhabituel (formulaire
rempli très vite). La candidature est conservée : c'est souvent quelqu'un de
pressé.

### Soirées

`/admin/soirees` : nom, classe d'âge, date, heure, lieu. Avant tout envoi,
**« Voir qui sera prévenu »** montre exactement qui recevra quoi. Publier
envoie alors, immédiatement et par lots :

- **03 · On reviendra vers toi** à tous les profils non retenus ;
- **04 · Ta tranche d'âge** aux validés dont l'âge, **le jour de la soirée**,
  sort de sa classe d'âge.

Ne reçoivent rien : les validés qui ont l'âge (ils attendent leur invitation),
les candidatures pas encore examinées, et les personnes déjà prévenues lors
d'une soirée précédente.

> **Les validés du formulaire court n'ont pas de date de naissance** : on ne
> peut pas savoir s'ils ont l'âge. L'aperçu les compte à part, en « âge
> inconnu », et ils ne reçoivent rien.

---

## 5. En attendant le déploiement : le formulaire autonome

Si tu veux remplacer Tally **avant** d'avoir déployé, colle
[`formulaire-autonome-court.html`](formulaire-autonome-court.html) ou
[`formulaire-autonome-complet.html`](formulaire-autonome-complet.html) — un
seul des deux — dans le bloc HTML de la page.

Le navigateur écrit alors directement dans Supabase. Les candidatures et les
photos sont conservées, et tu les retrouves dans ton back-office local.
**Aucun email n'est envoyé** : cela demande un serveur.

1. Exécute `supabase/06_formulaire_autonome.sql` — il autorise la clé publique
   à écrire une candidature et ses photos, **et rien d'autre** : aucune
   lecture, aucune modification, aucune suppression.
2. Dans le fichier, renseigne la ligne `SUPABASE_ANON_KEY`
   (Supabase → Settings → API → clé **anon public**). L'URL du projet est déjà
   la bonne. Tant que la clé n'est pas mise, le formulaire le dit à l'écran.
3. Colle, publie, purge le cache.

Dès l'application déployée : remets le widget iframe (section 3) et exécute
`supabase/07_fermer_formulaire_autonome.sql`, qui referme tout.

---

## 6. La recette avant d'ouvrir

- [ ] `DELAI_REPONSE_MINUTES=1440` en production
- [ ] `ADMIN_CODE` renseigné
- [ ] `IP_HASH_SALT` différent de celui du poste local
- [ ] `/api/health` répond `ok: true` sur `app.in-love.fr`
- [ ] Une inscription de bout en bout depuis la page WordPress, sur téléphone
- [ ] L'email « Candidature reçue » arrive (regarde aussi les spams)
- [ ] La fiche apparaît dans `/admin` avec ses photos
- [ ] `07_fermer_formulaire_autonome.sql` exécuté si tu avais posé le
      formulaire autonome

Pour relire les quatre emails sans rien envoyer :
`https://app.in-love.fr/api/emails/preview?token=<EMAIL_PREVIEW_TOKEN>`

---

## Ce qui reste à construire

- **L'email d'invitation à une soirée**, pour les validés qui ont l'âge. Son
  texte n'a jamais été rédigé ; c'est la « deuxième partie » de la séquence.
- **La date de naissance dans le formulaire court**, sans laquelle ces
  inscrits ne peuvent être ni classés par âge ni invités.
