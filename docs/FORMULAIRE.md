# Le formulaire d'inscription

Ce qui est arrêté, et pourquoi. Le détail des questions se lit dans
`src/lib/questions.ts` (l'inscription) et `src/lib/matching.ts` (le
service sur mesure) — ils sont écrits pour être lus.

## Ce qui a changé, et ce qui l'a remplacé

**La question sur les enfants a quitté l'inscription.** Elle revient dans
le formulaire avancé, avec deux autres : veux-tu des enfants, et un
partenaire qui en a déjà. Ce sont des questions qui engagent, et elles
avaient leur place plus loin, pas à la quatrième étape d'une inscription.

Les colonnes `has_children` et `children_preference` restent en base :
des centaines de candidatures y ont répondu, et une donnée recueillie ne
s'efface pas parce qu'on cesse de la demander. La fiche les affiche
encore, quand elles existent.

**Rien n'a été ajouté en échange.** L'inscription ordinaire est le moment
où l'on peut perdre quelqu'un : chaque question de plus est une occasion
de fermer l'onglet. « Depuis quand es-tu célibataire ? » est donc dans le
formulaire avancé, avec les autres — mais sa réponse rejoint sa propre
colonne, `single_since`, pour rester filtrable en curation et sortir dans
l'export comme n'importe quel champ du profil.

**Le prix a quitté l'en-tête.** Il variera d'une soirée à l'autre, et
l'annoncer avant même de savoir à laquelle la personne ira revenait à
s'engager sur un chiffre qu'on ne maîtrise pas. Il se dit avec la date et
le lieu, une fois la candidature retenue.

**Les numéros d'étape se calculent.** Ils étaient écrits à la main,
repris de Tally. Retirer une question en plein milieu a suffi pour que
deux étapes portent le même numéro : personne ne pense à renuméroter les
douze suivantes, et l'écran se met à mentir.

## La date de naissance

**Trois cases : le jour, le mois en liste, l'année.** Un sélecteur de
date ouvre un calendrier sur aujourd'hui et oblige à remonter de 1990 au
doigt, mois par mois. Plusieurs personnes s'y sont arrêtées.

Le jour et l'année se tapent au clavier numérique ; seul le mois reste
une liste, parce que « 09 » se retient mal là où « septembre » se
reconnaît. Les trois morceaux vivent dans le composant, et non dans la valeur du
formulaire. C'était l'erreur de la première version : elle recomposait
une date à chaque frappe, et « 1 » tapé dans l'année devenait « 0001 »
sous les doigts. On laisse écrire, et on ne compose que lorsque les trois
cases tiennent debout.

Le résultat est la même date ISO qu'avant : rien ne change pour l'âge, la
curation ou les tranches de soirée, qui lisent la même colonne.

## Le matching sur mesure

Après la dernière question, on propose un accompagnement : chercher dans
le réseau la personne qui correspond, et mettre en relation. Oui ou non.

**Qui dit non envoie sa candidature dans la foulée.** Pas d'étape de
plus, pas de détour. Qui dit oui voit les questions se dérouler sous le
bouton, **toutes à la fois et non en étapes** : la personne a déjà dit
oui, on n'a plus à la convaincre d'avancer, et voir l'ensemble permet de
jauger ce qui reste et de sauter ce qu'on ne veut pas dire.

Tout y est facultatif. Le service est un bonus ; une question sans
réponse n'empêche personne d'être mis en relation.

Ses choix portent `aria-checked` et la puce du reste du formulaire, et
non un `aria-pressed` à part : c'est sur eux que repose tout le style de
la sélection, et sans eux on cliquait sans que rien ne bouge à l'œil.

Les réponses tiennent dans un champ JSON et non en colonnes : elles sont
nombreuses, elles bougeront, et chaque question ajoutée aurait demandé
une migration.

## Ce que le back-office en fait

La fiche affiche « Célibataire depuis » avec le reste, et le matching
dans un bloc **replié** : la curation se fait sur les photos et quelques
mots, pas sur trente lignes de préférences. On l'ouvre le jour où l'on
cherche quelqu'un pour quelqu'un.

Les réponses sensibles y portent une mention et la date du consentement.
Les prénoms et l'export CSV suivent comme avant, avec deux colonnes de
plus : `single_since` et `matching_optin`.

## Les données sensibles, et la loi

Deux sujets du formulaire avancé — **les origines** et **la religion** —
sont des données dites sensibles au sens de **l'article 9 du RGPD**, au
même titre que la santé ou les opinions politiques. Les recueillir est
licite, mais à une condition : un **consentement explicite et distinct**
du reste (art. 9.2.a).

D'où la case à cocher qui ouvre ces deux blocs, et la date conservée dans
`matching_consent_at` : si l'on nous demande un jour sur quelle base ces
informations ont été recueillies, la réponse est à côté d'elles.

Trois précautions, qui tiennent toutes dans le code :

- **Le consentement doit être libre.** Il l'est parce que l'inscription
  aboutit sans lui : refuser le service, ou l'accepter sans cocher la
  case, ne ferme aucune porte.
- **Le tamis est côté serveur.** `nettoyerMatching` écarte les champs
  sensibles sans consentement, même si le navigateur les envoie. Une case
  décochée à l'écran ne prouve rien.
- **On demande des préférences, jamais une appartenance qu'on irait
  imposer à quelqu'un d'autre.** « Aucune préférence » figure en tête de
  la liste des origines : c'est la réponse la plus probable, elle doit
  être la plus facile à donner.

**La nationalité n'est pas une donnée sensible** — c'est une donnée
personnelle ordinaire, traitée comme la ville ou le métier.

Un point qui demandera une décision le jour où le service tournera
vraiment : appliquer des préférences d'origine pour *sélectionner* qui
l'on présente à qui n'est plus tout à fait la même chose que les
recueillir. Les sites de rencontre le font, le cadre le permet sur
consentement, mais cela mérite d'être su plutôt que découvert.
