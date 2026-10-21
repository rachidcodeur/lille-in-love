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

**« Depuis quand es-tu célibataire ? »** rejoint le formulaire ordinaire,
**après la présentation** — une fois que la personne s'est racontée et a
dit pourquoi elle venait. La question prolonge alors ce qu'elle vient
d'écrire ; placée en cinquième, entre l'orientation et la taille, elle
tombait comme un interrogatoire.

Dans le formulaire ordinaire et pas dans le formulaire avancé : elle se répond d'un geste, elle éclaire la curation pour tout le
monde, et elle n'aurait servi qu'à la moitié des candidatures si elle
avait suivi les autres. Sa réponse a sa propre colonne, `single_since`,
filtrable en curation et sortie dans l'export comme les autres champs du
profil.

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

**Il se propose une fois la candidature envoyée**, dans une seconde carte
sous le remerciement. Il a d'abord été la dernière étape du formulaire ;
le mettre après change tout. La candidature est en sécurité avant qu'on
propose quoi que ce soit, personne n'a plus à refuser une offre pour
pouvoir envoyer, et ce qui se lit là se lit l'esprit tranquille.

Techniquement, cela veut dire revenir écrire sur une fiche déjà
enregistrée — et seulement celle-là. D'où le **jeton à usage unique**
rendu à l'envoi, effacé dès qu'il a servi : un identifiant de fiche
n'autorise pas à écrire des données sensibles. Il ne voyage jamais dans
l'adresse, où il resterait dans l'historique et les journaux ; c'est
d'ailleurs pourquoi l'envoi ne redirige plus vers `/merci` quand le
service se propose.

La carte s'appelle **« Service de matching personnalisé »**, et son texte
ne présente jamais les rencontres comme un coup de chance qu'il faudrait
rattraper : le service s'y ajoute, il ne les corrige pas. Un test vérifie
le titre et l'absence du mot « hasard » — c'est le genre de nuance qu'une
réécriture rapide fait disparaître sans qu'on s'en aperçoive.

**Les questions arrivent toutes à la fois**, et non en étapes : la
personne a déjà dit oui, on n'a plus à la convaincre d'avancer, et voir
l'ensemble permet de jauger ce qui reste et de sauter ce qu'on ne veut
pas dire.

Tout y est facultatif. Le service est un bonus ; une question sans
réponse n'empêche personne d'être mis en relation.

Les titres de section respirent : le souffle est **au-dessus** du trait,
pas en dessous — c'est la distance avec la question précédente qui dit
qu'on change de sujet. Collés, ils se lisaient comme la suite de la
réponse qu'on venait de donner.

Ses choix portent `aria-checked` et la puce du reste du formulaire, et
non un `aria-pressed` à part : c'est sur eux que repose tout le style de
la sélection, et sans eux on cliquait sans que rien ne bouge à l'œil.

Les réponses tiennent dans un champ JSON et non en colonnes : elles sont
nombreuses, elles bougeront, et chaque question ajoutée aurait demandé
une migration.

## Les retouches de la seconde passe

- **Les conditions s'acceptent à la première étape**, liens compris, et
  non plus juste avant d'envoyer. On accepte avant de confier quoi que ce
  soit, pas après seize questions. L'avance automatique du premier choix
  a disparu avec : tourner la page au premier clic empêchait la case
  d'être lue.
- **La durée de célibat s'écrit** — un nombre, puis mois ou années.
  Quatre tranches toutes faites mettaient « huit mois » et « sept ans »
  dans le même panier et obligeaient à arrondir une réponse qu'on connaît
  précisément. « Jamais été en couple » garde son bouton : aucun nombre
  ne le dit. En base : `jamais`, `8_mois`, `3_ans`.
- **Les centres d'intérêt sont facultatifs.** Mieux vaut une case vide que
  trois cochées au hasard pour passer l'étape.
- **Qui vient accompagné reçoit le lien du formulaire**, en entier, avec
  de quoi l'envoyer en un geste. On prenait le prénom de l'autre, et
  c'est tout : il n'était au courant de rien.
- **Google et ChatGPT** rejoignent les sources, et « Autrement » ouvre un
  champ : c'est précisément la réponse dont on a besoin qu'elle soit
  précisée, puisque c'est la seule qu'on n'a pas prévue.
- **La date montre des exemples** (« Ex : 01 ») plutôt que des sigles, et
  la liste des mois commence à janvier. L'entrée vide reste, mais
  `hidden` : la liste déroulée commence donc bien à janvier, et rien
  n'est choisi tant qu'on n'a pas choisi — sans quoi quelqu'un né en mars
  qui ne touche pas au champ enverrait janvier.
- **Le prix a quitté l'en-tête**, et avec lui la mention sur le tarif
  exceptionnel.

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

**Le consentement se donne en tête, avant la première question.** Il a
d'abord été placé tout en bas, puis au milieu, juste devant les blocs
qu'il ouvrait. Les deux fois, quelque chose apparaissait ou disparaissait
en cours de route. En tête, on sait à quoi on s'engage avant de
commencer, et plus rien ne bouge ensuite : origines et religion prennent
leur place dans le fil comme les autres questions.

Sans la case, aucune question ne s'affiche. C'est volontaire : voir des
questions dont les réponses seront jetées par le serveur serait
trompeur.

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
