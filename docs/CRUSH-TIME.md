# Crush Time — les règles décidées

Ce qui est arrêté, et pourquoi. À relire avant de coder un écran : plusieurs
de ces choix ont l'air arbitraires et ne le sont pas.

---

## Le jeu

| Règle | Détail |
| --- | --- |
| **Un like par crush time** | Trois manches, trois choix. Tenu par une contrainte d'unicité en base, pas par le code |
| **Définitif** | Pas de retour en arrière, pas de « deliker ». C'est ce qui donne au like sa valeur. L'écran confirme avant d'écrire |
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
- **Le profil ouvert** donne prénom, âge, métier, ville, et une présentation
  **coupée vers 140 caractères** — personne ne lit dix lignes debout, et une
  fiche qui s'allonge repousse le bouton hors de l'écran.
- **« Mes matchs » est en haut à droite**, pas en bas : c'est la récompense du
  jeu, elle doit se voir sans être cherchée, et le bas de l'écran disparaît
  sous le pouce et les barres du navigateur.
- **La photo de tête** est celle rangée en position 1 dans le back-office,
  réordonnable par glissé-déposé. Elle décide à peu près seule du sort d'un
  profil.
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

Lien personnel envoyé avant la soirée, **ou** email + code à quatre chiffres
annoncé à voix haute dans la salle. Le second est en pratique la porte
principale : rien à recevoir, rien à attendre, aucun réseau à partager entre
cinquante téléphones. Après l'email, on affiche photo et prénom — « c'est
bien toi ? » — pour rattraper les fautes de frappe.

## L'installation et les notifications

Sur iPhone, le web push n'existe **que** pour une application ajoutée à
l'écran d'accueil. Le parcours d'entrée est donc : **1.** installer l'icône,
**2.** l'ouvrir, **3.** autoriser les notifications. Chaque étape bloque la
suivante.

Deux pièges connus :

- L'application installée a un **stockage séparé de Safari** : l'icône
  s'ouvre déconnectée si son adresse de départ ne porte pas le jeton. Filet
  de secours : email + code à 6 chiffres.
- Un lien ouvert depuis Gmail arrive dans un **navigateur intégré** où
  « Ajouter à l'écran d'accueil » n'existe pas. À détecter, et à dire.

Un **widget** est impossible — réservé aux applications natives. Une icône,
oui.

Le vrai filet, le soir même, reste l'hôte qui annonce à voix haute.

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

`13_crushtime.sql` (le schéma) et `14_ordre_photos.sql` (l'ordre des photos).

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
