# Lille in Love — inscription

Le questionnaire d'adhésion au club, l'enregistrement des candidatures, le
back-office de curation et la séquence email qui va avec. Remplace le
formulaire Tally embarqué sur `in-love.fr/inscription/`.

**Le principe** : on adhère au club une seule fois, puis on reçoit une
invitation pour chaque soirée. Personne ne remplit deux fois le formulaire, et
personne n'est jamais définitivement écarté.

## Mise en route

→ [`docs/MISE-EN-ROUTE.md`](docs/MISE-EN-ROUTE.md)

```bash
npm install
cp .env.example .env.local   # puis remplis les clés
npm run dev                  # http://localhost:3000 → le back-office

npm run test:curation        # tout, de l'inscription aux emails — sans aucune clé
npm run test:e2e             # le formulaire seul, dans un navigateur
npm run test:reel            # en conditions réelles, puis efface ses traces
```

Les deux premières suites se suffisent à elles-mêmes : `tests/fake-backend/`
tient le rôle de Supabase et de Resend, et rien ne sort de la machine.
`test:reel` vérifie ce qu'elles ne peuvent pas — que les vraies clés, le vrai
stockage et le vrai envoi fonctionnent.

## Les deux parcours

| Parcours    | URL             | Ce qui est demandé                              |
| ----------- | --------------- | ----------------------------------------------- |
| **Court**   | `/embed/court`  | Sexe, prénom, nom, email, photos — 3 écrans     |
| **Complet** | `/embed`        | Les 16 étapes du questionnaire d'origine        |

Dans WordPress, un seul mot les sépare : `data-lil-form="court"` ou
`data-lil-form="complet"`.

## La curation

`/admin` — la liste des candidatures, puis une fiche par personne : photos en
grand, réponses, journal des emails. Valider programme « Bienvenue dans le
club » 24 h plus tard ; refuser n'envoie rien sur le moment.

`/admin/soirees` — publier une soirée envoie « On reviendra vers toi » aux
profils non retenus et « Ta tranche d'âge ouvrira plus tard » aux validés hors
de sa classe d'âge, après un aperçu obligatoire de qui recevra quoi.

L'accès est libre tant que `ADMIN_CODE` est vide — la page n'est indexée nulle
part, mais elle reste visible de qui connaît l'adresse.

## Comment ça s'assemble

```
in-love.fr/inscription/  (WordPress)
   └─ bloc HTML  →  <script src="app.in-love.fr/embed.js">
                       └─ iframe → app.in-love.fr/embed
                                     │
                                     ├─ POST /api/upload       photo → bucket privé
                                     └─ POST /api/inscription  → Supabase
                                                                → Resend (email 01)
```

L'iframe isole complètement le formulaire du thème WordPress, et te laisse le
mettre à jour sans jamais retoucher à la page.

## Le code

| Chemin                        | Rôle                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `src/lib/questions.ts`        | Les deux parcours, décrits une seule fois                |
| `src/lib/decision.ts`         | Les règles de curation et le déclenchement des emails    |
| `src/lib/soirees.ts`          | Qui reçoit quoi à la publication d'une soirée            |
| `src/lib/admin.ts`            | Lecture des candidatures, photos signées, accès          |
| `src/lib/validation.ts`       | La validation serveur — la seule qui fasse autorité      |
| `src/lib/security.ts`         | Hachage d'IP, limitation de débit, CORS                  |
| `src/lib/mailer.ts`           | Envoi Resend, journalisation, anti-doublon               |
| `src/emails/templates.ts`     | Les quatre emails de la séquence                         |
| `src/components/form/`        | Le formulaire multi-étapes                               |
| `src/app/api/`                | `inscription`, `upload`, `health`, `emails/preview`      |
| `src/lib/brand.ts`            | Adresses et liens légaux — un seul endroit à modifier     |
| `supabase/`                   | Le schéma SQL et le bucket photos                        |
| `tests/e2e/`                  | Les parcours, joués dans un navigateur                   |
| `tests/fake-backend/`         | Faux Supabase et faux Resend, pour tester sans clés      |
| `public/embed.js`             | Le pont entre WordPress et l'iframe                      |

### Ajouter ou modifier une question

Édite `src/lib/questions.ts`, puis le champ correspondant dans
`src/lib/validation.ts`, et enfin la colonne dans `supabase/01_schema.sql`.
Le rendu et la navigation suivent tout seuls.

## Ce qui protège le formulaire

- trois champs pièges invisibles, nommés de façon à ce qu'aucun remplissage
  automatique de navigateur ne les touche : seul un robot les remplit, et son
  envoi est ignoré sans qu'on lui dise pourquoi ;
- un formulaire rempli anormalement vite n'est **jamais** écarté — il est
  enregistré et signalé aux curateurs. Perdre une vraie candidature en silence
  coûterait bien plus cher que relire une fiche de trop ;
- 5 candidatures par heure et par IP, 30 photos par 10 minutes ;
- tout est revalidé côté serveur, le navigateur n'a autorité sur rien ;
- les IP ne sont conservées que hachées et salées, jamais en clair ;
- le bucket photos est privé, sans aucune URL publique ;
- la RLS est active et sans policy : hors serveur, les tables sont fermées.

## Encore à faire

- Fermer le back-office (`ADMIN_CODE`) et repasser à deux curateurs
  (`VOTES_REQUIS=2`) avant l'ouverture au public.
- Une identité par curateur : la table `lil_reviews` attend déjà les votes
  nominatifs, seule la connexion manque.
- Les invitations aux soirées, une fois le club constitué.
