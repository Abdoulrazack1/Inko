# Inko — Notice légale et politique d'utilisation

## Nature du projet

Inko est un **framework de lecture** — un cadre logiciel qui charge des
extensions de sources. Le code distribué (le « core ») ne contient
**aucune source de contenu** par défaut : la liste des sources installées
est entièrement déterminée par l'utilisateur final.

Inko ne télécharge ni n'héberge aucune image, aucun texte de chapitre,
aucun fichier de contenu protégé. Lorsqu'une extension est utilisée, les
requêtes vers les serveurs tiers sont effectuées au nom de l'utilisateur,
et les réponses (images, métadonnées) transitent sans copie persistante.

## Responsabilité de l'utilisateur

L'utilisateur est seul responsable :

1. Du choix des extensions qu'il installe.
2. De la légalité des sources accédées par ces extensions dans sa
   juridiction.
3. De l'usage du contenu obtenu (lecture personnelle, partage, etc.).

L'auteur de Inko et ses contributeurs **ne font aucune réclamation** sur
la légalité d'une extension tierce et **déclinent toute responsabilité**
liée à son installation ou à son utilisation.

## Données personnelles

Inko ne collecte **aucune donnée de télémétrie**. Les seules données stockées
sont :

- Côté serveur (si self-hébergé) : compte utilisateur (email + hash mdp),
  favoris, progression de lecture, listes, commentaires — uniquement pour
  l'utilisateur du compte.
- Côté client (navigateur) : préférences de lecture (mode, zoom),
  acceptation de la présente notice.

Aucune donnée ne quitte le serveur self-hébergé de l'utilisateur, à
l'exception des requêtes API directes vers les serveurs des extensions
qu'il a explicitement activées.

## Marques tierces

Tous les noms de produits, marques et logos cités dans la documentation
ou les extensions appartiennent à leurs propriétaires respectifs et sont
utilisés uniquement à des fins d'identification.

## DMCA / Demandes de retrait

Inko n'héberge aucun contenu copyrighté. Les demandes de retrait DMCA
doivent être adressées aux opérateurs des sites tiers, **pas au projet
Inko**.

## Licence

Voir [LICENSE](./LICENSE) — MIT License.
