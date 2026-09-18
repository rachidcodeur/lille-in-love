# Mise en route

De zéro à un formulaire en ligne, avec le back-office qui va avec. Compte une
heure la première fois, l'essentiel étant de l'attente (DNS, vérification de
domaine).

---

## 0. Ce qu'il faut récupérer

Cinq valeurs, à mettre dans un fichier `.env.local` à la racine du projet —
jamais ailleurs, jamais dans WordPress, jamais dans un message.

```bash
cp .env.example .env.local
```

| Variable                    | Où la trouver                                                          |
| --------------------------- | ---------------------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase → ton projet → **Settings → API** → « Project URL »            |
| `SUPABASE_SERVICE_ROLE_KEY` | Même écran → **`service_role` secret** (pas la clé `anon`)              |
| `RESEND_API_KEY`            | resend.com → **API Keys → Create** (permission « Sending access »)      |
| `EMAIL_FROM`                | Une adresse du domaine vérifié, ex. `contact@lilleinlove.fr`            |
| `IP_HASH_SALT`              | À générer : `openssl rand -hex 32`                                      |

> **La clé `service_role` ouvre toute la base.** Elle ne doit vivre que dans
> `.env.local` (ignoré par git) et dans les variables d'environnement de ton
> hébergeur.

Pour tes premiers essais, ajoute aussi :

```bash
VOTES_REQUIS=1               # tu valides seul
DELAI_REPONSE_MINUTES=2      # la réponse part 2 min après la décision, pas 24 h
```

**Tu peux tout essayer avant même d'avoir ces clés** : `npm run test:curation`
joue le parcours entier contre un faux Supabase et un faux Resend locaux.

---

## 1. Supabase — créer les tables

Dans ton projet Supabase, ouvre **SQL Editor** et exécute les cinq fichiers,
dans l'ordre :

1. `supabase/01_schema.sql` — les tables, les index, la sécurité
2. `supabase/02_storage.sql` — le bucket des photos
3. `supabase/03_formulaire_court.sql` — le formulaire court et la curation
4. `supabase/04_signalement.sql` — le signalement des envois inhabituels
5. `supabase/05_soirees.sql` — les soirées et les envois qu'elles déclenchent

Tous sont **relançables sans risque** et toutes les tables sont préfixées
`lil_`. Rien de ce que tu as déjà dans ce projet n'est touché.

> Si le quatrième n'est pas encore passé, l'application continue de
> fonctionner : elle enregistre les candidatures sans le signalement et
> l'écrit dans les journaux. Une inscription ne dépend jamais d'une migration
> oubliée.

Vérifie ensuite dans **Table Editor** que tu vois : `lil_members`, `lil_photos`,
`lil_curators`, `lil_reviews`, `lil_emails`.

---

## 2. Resend — l'expéditeur

### Aujourd'hui : `mariage-parfait.net`

Ce domaine est déjà vérifié sur ton compte, on s'en sert donc en attendant :

```bash
EMAIL_FROM="Lille in Love <contact@mariage-parfait.net>"
EMAIL_REPLY_TO=contact@lilleinlove.fr
```

L'adresse de réponse, elle, n'a pas besoin d'être vérifiée : c'est un simple
en-tête. Quand quelqu'un répond à un email du club, sa réponse arrive bien sur
`contact@lilleinlove.fr`.

### À faire avant d'ouvrir au public : vérifier `lilleinlove.fr`

Un email signé « Lille in Love » mais expédié depuis `mariage-parfait.net`
détonne, et certains clients mail affichent un avertissement « via… ».

1. **Domains → Add Domain** : saisis `lilleinlove.fr`.
2. Resend affiche 3 enregistrements DNS (SPF, DKIM, et un DMARC conseillé).
   Ajoute-les dans **Hostinger → Domaines → DNS**, sur `lilleinlove.fr`.
3. Attends la validation (souvent 15 minutes, parfois quelques heures).
4. Remplace `EMAIL_FROM` par `contact@lilleinlove.fr`. Rien d'autre à changer.

---

## 3. Essayer en local

```bash
npm install
npm run dev
```

- `http://localhost:3000/court` — le formulaire court (3 écrans)
- `http://localhost:3000/` — le formulaire complet (16 écrans)
- `http://localhost:3000/admin` — le back-office
- `http://localhost:3000/api/health` — ce qui est configuré ou non

Inscris-toi avec ta propre adresse, puis ouvre `/admin` : ta fiche est là.
Clique **Valider** — l'email de bienvenue est programmé, et la fiche indique
quand il partira. Change d'avis : l'envoi en attente est annulé.

---

## 4. Déployer l'application sur `app.in-love.fr`

### Pourquoi Hostinger, et pas Vercel gratuit

Le plan gratuit de Vercel est réservé à un usage **non commercial** ; Lille in
Love vend des soirées. Il faudrait le plan Pro (payant). Ton hébergement
Hostinger propose déjà « Déployer Application web » (offres Business et Cloud),
reconnaît Next.js et n'impose pas cette restriction : c'est le choix retenu.

### a. Mettre le code sur GitHub

Le dossier n'est pas encore un dépôt git. Crée un dépôt **privé** vide sur
github.com (sans README), puis, dans le dossier du projet :

```bash
git init
git add .
git commit -m "Lille in Love — formulaire et curation"
git branch -M main
git remote add origin https://github.com/<ton-compte>/lille-in-love.git
git push -u origin main
```

`.env.local` est exclu par `.gitignore` : aucune clé ne part sur GitHub.

### b. Préparer Supabase

Vérifie que les cinq scripts de `supabase/` sont passés dans le SQL Editor —
en particulier `04_signalement.sql` et `05_soirees.sql`, les plus récents.

### c. Créer l'application chez Hostinger

1. hPanel → **Sites web** → **Ajouter un site web** → **Déployer Application
   web** → **Importer un dépôt Git**.
2. Autorise GitHub, choisis le dépôt `lille-in-love`, branche `main`.
3. Réglages de build :

   | Réglage                | Valeur          |
   | ---------------------- | --------------- |
   | Framework              | Next.js         |
   | Version de Node        | 20 ou 22        |
   | Commande d'installation| `npm ci`        |
   | Commande de build      | `npm run build` |
   | Commande de démarrage  | `npm run start` |
   | Dossier de sortie      | `.next`         |

4. **Variables d'environnement — avant le premier déploiement** : l'adresse
   autorisée à afficher le formulaire est figée au moment du build.

   | Variable                    | Valeur de production                                  |
   | --------------------------- | ----------------------------------------------------- |
   | `SUPABASE_URL`              | la même qu'en local                                   |
   | `SUPABASE_SERVICE_ROLE_KEY` | la même qu'en local                                   |
   | `SUPABASE_STORAGE_BUCKET`   | `lil-photos`                                          |
   | `RESEND_API_KEY`            | la même qu'en local                                   |
   | `EMAIL_FROM`                | `Lille in Love <contact@mariage-parfait.net>` en attendant `lilleinlove.fr` |
   | `EMAIL_REPLY_TO`            | `contact@lilleinlove.fr`                              |
   | `IP_HASH_SALT`              | une nouvelle valeur : `openssl rand -hex 32`          |
   | `ALLOWED_EMBED_ORIGINS`     | `https://in-love.fr,https://www.in-love.fr`           |
   | `DELAI_REPONSE_MINUTES`     | **`1440`** (24 h) — pas la valeur de test             |
   | `VOTES_REQUIS`              | `1` (ou `2` pour la règle des deux curateurs)          |
   | `ADMIN_CODE`                | **un code** — voir l'encadré ci-dessous               |
   | `NEXT_PUBLIC_SITE_URL`      | `https://in-love.fr`                                  |

   Hostinger peut importer un fichier `.env` d'un coup : pars de `.env.local`,
   mais **corrige `DELAI_REPONSE_MINUTES` et `ADMIN_CODE`** avant l'import.

   > **Une fois en ligne, `/admin` est public.** Sans `ADMIN_CODE`, n'importe
   > qui trouvant l'adresse voit les noms, emails et photos des candidats, et
   > peut publier une soirée qui enverra des emails. Renseigne un code long.

5. Lance le déploiement. Hostinger attribue une adresse temporaire.
6. Rattache le domaine : dans les réglages du site, section **Domaines**,
   indique `app.in-love.fr`. Le domaine `in-love.fr` étant chez Hostinger, le
   DNS et le certificat HTTPS se configurent seuls ; compte quelques minutes à
   quelques heures.

Chaque `git push` sur `main` redéploie ensuite automatiquement.

### d. Vérifier

- `https://app.in-love.fr/api/health` doit répondre `"ok": true` avec
  `"problemes": []`.
- `https://app.in-love.fr/court` affiche le formulaire court.
- `https://app.in-love.fr/admin` demande le code d'accès.

---

## 5. WordPress — remplacer le formulaire Tally

1. Modifie la page `in-love.fr/inscription/`.
2. Supprime le bloc qui contient le formulaire Tally.
3. Ajoute à sa place un bloc **HTML personnalisé** et colle le contenu de
   [`widget-wordpress.html`](widget-wordpress.html) :

   ```html
   <div data-lil-form="court" data-lil-app="https://app.in-love.fr" data-min-height="560"></div>
   <script src="https://app.in-love.fr/embed.js" async></script>
   ```

   **Garde `data-lil-app`.** LiteSpeed Cache, installé d'office sur les
   WordPress Hostinger, peut regrouper les scripts de la page : sans cet
   attribut, le formulaire chercherait l'application sur `in-love.fr` et ne
   s'afficherait pas (reproduit en test).
4. Mets à jour la page, puis **purge le cache** (barre d'admin WordPress →
   LiteSpeed Cache → *Purger tout*).
5. Ouvre la page en navigation privée : le formulaire s'affiche et sa hauteur
   s'ajuste à chaque étape.

Si le formulaire n'apparaît pas :
- console du navigateur, message `frame-ancestors` → `ALLOWED_EMBED_ORIGINS`
  ne contient pas l'adresse exacte du site ; corrige-la puis **redéploie**
  (elle est lue au build) ;
- rien du tout → LiteSpeed Cache → *Optimisation de page* → *Réglages JS* :
  ajoute `embed.js` dans les exclusions.

Pour passer au questionnaire complet plus tard : `data-lil-form="complet"`.

---

## 6. Le back-office

`https://app.in-love.fr/admin`

La liste est filtrée par statut ; une fiche montre les photos en grand, les
réponses, et le journal des emails. Trois issues, chacune avec son email :

| Action                         | Email                         | Quand                               |
| ------------------------------ | ----------------------------- | ----------------------------------- |
| Valider — profil retenu        | 02 · Bienvenue dans le club   | 24 h après la validation            |
| Refuser — profil non retenu    | 03 · On reviendra vers toi    | à la publication d'une soirée       |
| *(automatique)*                | 04 · Ta tranche d'âge         | à la publication d'une soirée, pour les validés hors de sa classe d'âge |

Revenir sur une validation avant l'envoi annule la bienvenue en attente.
Recliquer la même décision ne change rien — ni doublon, ni heure décalée.

### Publier une soirée

`/admin/soirees` : nom, classe d'âge, date, heure (facultative), lieu. Avant
tout envoi, **« Voir qui sera prévenu »** affiche exactement qui recevra
quoi. Publier envoie alors, immédiatement et par lots :

- **03** à tous les profils non retenus ;
- **04** aux validés dont l'âge, **le jour de la soirée**, sort de sa classe
  d'âge.

Ne reçoivent rien : les validés qui ont l'âge (ils attendront leur
invitation), les candidatures pas encore examinées, et les personnes déjà
prévenues lors d'une soirée précédente — personne ne reçoit deux fois le même
message.

> **Les validés du formulaire court n'ont pas de date de naissance.**
> Impossible de savoir s'ils ont l'âge de la soirée : ils ne reçoivent rien
> et l'aperçu les compte à part, en « âge inconnu ».


> Resend n'accepte d'annuler un envoi qu'une fois celui-ci passé en
> « programmé », et ce basculement prend un délai variable — de 3 à 17 secondes
> selon nos mesures. Si tu te ravises dans les toutes premières secondes,
> l'annulation peut échouer : la fiche l'affiche alors en rouge avec un bouton
> **Annuler cet envoi**. Un clic quelques secondes plus tard suffit toujours.
> L'application ne prétend jamais avoir arrêté un envoi qui va partir.

Les photos s'ouvrent en grand d'un clic : flèches pour passer de l'une à
l'autre, un second clic pour zoomer sur un visage, Échap pour refermer.

Une fiche marquée **« à vérifier »** signale un envoi inhabituel (formulaire
rempli très vite, par exemple). La candidature est conservée telle quelle :
c'est souvent simplement quelqu'un de pressé.

> **L'accès est libre pour l'instant.** Cette page montre des noms, des emails
> et des visages : quiconque connaît l'adresse y accède. Elle n'est indexée par
> aucun moteur de recherche, mais pour la fermer vraiment, renseigne
> `ADMIN_CODE` — un code te sera alors demandé à l'entrée, sans autre
> changement.

---

## 7. La recette avant d'ouvrir

- [ ] Le formulaire s'enchaîne sans accroc sur téléphone, en 4G.
- [ ] L'email **01 · Candidature reçue** arrive — regarde aussi les spams.
- [ ] La fiche apparaît dans `/admin` avec ses photos.
- [ ] Valider programme bien l'email 02, et la fiche annonce l'heure d'envoi.
- [ ] Passer `DELAI_REPONSE_MINUTES` à `1440` et `VOTES_REQUIS` à `2`.
- [ ] Exécuter `supabase/05_soirees.sql` avant de publier la première soirée.
- [ ] Renseigner `ADMIN_CODE` avant d'ouvrir les inscriptions au public.

Trois commandes de vérification :

```bash
# Hors ligne : tout, de l'inscription aux emails. Démarre et éteint tout seul.
npm run test:curation

# Hors ligne : le formulaire seul. Demande un « npm run dev » à côté.
npm run test:e2e

# En conditions réelles : écrit vraiment dans ton Supabase et envoie vraiment
# par ton Resend (vers delivered@resend.dev, que personne ne lit), puis efface
# tout. À lancer après chaque déploiement ou changement de clés.
npm run test:reel
```

`test:reel` refuse de démarrer si la base contient déjà des candidatures : il
ne doit jamais tourner à côté de vraies personnes.

Et pour relire les quatre emails :
`https://app.in-love.fr/api/emails/preview?token=<EMAIL_PREVIEW_TOKEN>`
