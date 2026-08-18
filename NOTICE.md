# Inko — Notice légale et politique d'utilisation

## Nature du projet

Inko est un **framework de lecture** — un cadre logiciel qui charge des
extensions de sources. Le code distribué **n'héberge, ne reproduit et ne
met à disposition aucune œuvre** : ni image de planche, ni texte de
chapitre, ni fichier de contenu.

### Ce que la distribution contient réellement

Une version antérieure de ce document affirmait que « le core ne contient
aucune source par défaut ». C'était inexact, et le dire importe : une
notice légale approximative est pire qu'une notice absente, parce qu'elle
ressemble à une déclaration trompeuse.

Les distributions (installeur Windows, APK Android) **embarquent le code
des extensions** — des fichiers d'une trentaine de kilo-octets qui
décrivent *comment interroger* un site : quelles URL appeler, comment lire
la réponse. Ce sont des instructions d'accès, pas du contenu. Aucune œuvre
n'y figure, et aucune n'est téléchargée avant qu'un utilisateur ne demande
explicitement une lecture.

Chaque extension est vérifiée par empreinte SHA-256 avant exécution, sur
le poste comme sur le téléphone : ce qui s'exécute est exactement ce qui a
été publié, et rien d'autre.

### Qui effectue les requêtes

Lorsqu'une source est utilisée, la requête part **au nom de
l'utilisateur**, depuis son matériel, vers un serveur tiers qu'il a choisi
d'interroger — exactement comme le ferait un navigateur ouvert sur le même
site. Les réponses transitent sans copie persistante, sauf téléchargement
hors-ligne demandé explicitement, qui reste sur l'appareil.

⚠ **Depuis l'application Android en mode autonome**, ces requêtes partent
directement du téléphone : l'adresse IP visible des sites est donc celle
de l'utilisateur, et non celle d'un serveur intermédiaire. Voir la page de
confidentialité.

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
