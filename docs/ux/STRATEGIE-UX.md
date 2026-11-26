# Stratégie d'expérience d'Inko

Comment décider quoi améliorer dans l'interface, comment le vérifier, et comment ne pas le casser ensuite.

## 1. Ce qu'on vise

Inko est un endroit où l'on **lit**. Tout ce qui s'interpose entre le lecteur et la page est un coût.

| Principe | Ce que cela interdit | Comment on le vérifie |
|---|---|---|
| **La lecture d'abord** | un contrôle, une fenêtre ou un message qui couvre la page sans qu'on l'ait demandé | `ux-ecrans`, `lecteur` |
| **Reprendre en un geste** | plus d'un appui entre l'ouverture et la page où l'on s'était arrêté | `ux-parcours` |
| **Rien ne se perd** | une action destructrice sans annulation, un retour arrière qui oublie la position | `ux-retour`, `ux-navigation` |
| **Toujours une réponse** | un appui sans effet visible, une attente muette, un chargement sans fin | `ux-retour`, `chaos`, `boutons` |
| **Un seul langage** | deux formes pour un même bouton, deux mots pour une même chose, « tu » et « vous » | `ux-coherence`, `ux-redaction` |
| **Pour tout le monde, partout** | une action impossible au clavier, au pouce, en anglais, en thème clair ou à 320 px | `interaction`, `mobile`, `parcours` |

## 2. La direction de design (déjà posée, à tenir)

L'édition « Washi » décrite dans le README reste la référence : papier clair par défaut, « Sumi » en sombre ; trois accents qui **signifient** quelque chose (manga, roman, signal fort) ; la corne de page comme signature ; Archivo Narrow pour les titres, IBM Plex Sans pour l'interface, Bitter pour la lecture longue ; des échelles uniques de textes, rayons, espacements, durées et élévations dans `assets/css/global.css`.

La stratégie ne réinvente pas cette direction. Elle mesure **l'écart entre ce qui est écrit dans les jetons et ce qui est affiché**.

## 3. Les dix dimensions

| Dimension | Poids | Sondes | Objectif chiffré à 90 jours |
|---|---:|---|---|
| Efficacité des gestes | 2 | `ux-parcours`, `lecteur` | 10 tâches sur 10 réussies, aucune au-dessus de son budget d'appuis |
| Réponse et états | 1,5 | `ux-retour`, `chaos`, `boutons` | premier retour sous 200 ms ; aucune page muette ou figée en panne |
| Se repérer et revenir | 1,5 | `ux-navigation` | position conservée au retour ; Retour ferme les panneaux ; aucune page orpheline |
| Accessibilité | 1,5 | `interaction`, `a11y-html`, `parcours`, `pages` | aucune violation axe grave dans les deux thèmes ; tout au clavier |
| Téléphone et tailles | 1,5 | `mobile`, `parcours` | aucune cible sous 24 px, 44 px sur les gestes fréquents ; aucun débordement dès 320 px |
| Hiérarchie et lisibilité | 1 | `ux-ecrans` | une action principale par écran ; contenu visible dans la première moitié |
| Mots et langue | 1 | `ux-redaction`, `i18n`, `parcours` | une seule adresse ; zéro jargon hors page Système ; anglais complet |
| Cohérence du design | 1 | `ux-coherence`, `css` | moins de 14 formes de boutons, 5 de champs ; 95 % des textes sur l'échelle |
| Fluidité ressentie | 1 | `pages`, `charge`, `perf-statique` | décalage de mise en page < 0,1 ; aucun gel > 200 ms à 2 000 séries |
| Rendu et images | 0,5 | `ux-visuel`, `ux-ecrans` | aucun changement visuel non voulu publié |

## 4. Comment les notes sont calculées

Les relevés sont regroupés par **famille** (même identifiant). Une famille pèse :

`impact = poids de la gravité × (1 + log₂(nombre d'occurrences))`

avec critique = 12, haute = 6, moyenne = 2, basse = 0,5. Le même défaut répété sur vingt pages pèse donc plus qu'une fois, mais beaucoup moins que vingt défauts différents : il se corrige en un seul endroit.

`note d'une dimension = 100 × e^(−somme des impacts / 80)` ; la note d'ensemble est la moyenne des dimensions **mesurées**, pondérée par le tableau ci-dessus.

**Ce qu'une note ne dit pas.** Elle ne mesure ni la beauté, ni le plaisir, ni la compréhension réelle. Elle compare deux états et ordonne le travail. Une dimension à 100 veut dire « les sondes n'ont rien vu », pas « c'est parfait ».

## 5. L'ordre du travail

`priorité = impact ÷ coût` (S = 1, M = 3, L = 8, XL = 20), puis quatre vagues :

1. **Grave et rapide** (haute ou critique, effort S ou M) : tout de suite.
2. **Le reste du grave et les gains faciles** : le sprint suivant.
3. **Chantiers moyens** : planifiés, souvent un composant commun à écrire.
4. **Finitions** : au fil de l'eau, quand on touche l'écran.

Règle transverse : si la même famille touche plus de quatre pages, **on corrige le composant, pas les pages**.

## 6. La boucle

```
OBSERVER → NOTER → COMPARER → PLANIFIER → CORRIGER → VÉRIFIER → RAPPORTER
```

| Commande | Quand |
|---|---|
| `npm run ux` | pendant une évolution : sondes d'expérience, notes, plan |
| `npm run ux -- --sans-sonder` | renoter à partir des relevés existants |
| `npm run ux -- --sondes=ux-parcours,ux-retour` | vérifier un point précis |
| `npm run ux -- --reference` | accepter l'état actuel (notes **et** captures) |
| `npm run ux:barriere` | avant de publier : échoue si une note perd plus de 3 points ou si un défaut grave apparaît |
| `npm run ux -- --appliquer` | appliquer les corrections mécaniques, avec tests et restauration en cas d'échec |
| `npm run sondes:campagne` | rafraîchir aussi les relevés généraux (mobile, clavier, pannes…) |

## 7. Ce que la machine corrige, et ce qu'elle ne corrigera pas

Corrections automatiques (`scripts-ci/sondes/correcteurs/ux.js`) : points de suspension et espaces fines dans les pages, champs à 16 px au téléphone. Elles sont volontairement peu nombreuses.

Tout le reste demande un jugement : hiérarchie, parcours, mots, composants. Un correcteur qui devine est un correcteur qui casse.

## 8. Définition de « fini » pour une évolution d'interface

- [ ] La tâche concernée est dans `ux-parcours` (ou ajoutée), réussie au bureau et au téléphone, dans son budget.
- [ ] Chargement, vide, erreur et hors-ligne ont chacun un écran qui dit quoi faire.
- [ ] Clavier seul, lecteur d'écran (noms accessibles), deux thèmes, 320 px, anglais.
- [ ] Jetons de design uniquement ; composant existant réutilisé.
- [ ] Textes en tutoiement, un verbe par bouton, erreur avec geste proposé.
- [ ] Action destructrice annulable.
- [ ] `npm run ux:barriere` passe ; captures vérifiées puis référence actualisée.

## 9. Ce que les sondes ne remplacent pas

Une fois par version : **cinq lectures observées** (dont une personne qui ne connaît pas l'application) sur les parcours du tableau, sans aide, en notant les hésitations. Une session sur le vrai téléphone Android le plus ancien visé. Une relecture de tous les textes à voix haute. Ces trois gestes trouvent ce qu'aucune sonde ne cherche.

## 10. Feuille de route d'expérience

| Étape | Contenu | Sortie attendue |
|---|---|---|
| 1 — Tenir debout | états d'erreur et d'attente partout, retour arrière fiable, cibles tactiles, barre du bas | dimensions Réponse, Navigation, Téléphone au-dessus de leur note de départ de 20 points |
| 2 — Parler d'une voix | lexique, tutoiement, jargon, anglais complet | Mots et langue ≥ 85 |
| 3 — Un seul système | boutons, champs, fenêtres, menus, listes en composants communs | Cohérence ≥ 85 |
| 4 — Raccourcir | une action principale par écran, contenu plus haut, gestes fréquents sans menu | Efficacité ≥ 90 |
| 5 — Polir | transitions, images, rendu, captures de référence tenues | toutes les dimensions ≥ 85 |
