# Inko — Audit complet du chantier

> **Version** 2.9.0 (desktop) · 1.4.1 (Android) · **Date de l'audit** {{date}}, complété le 26/11/2026
> **Méthode** : {{nb-sondes}} sondes automatiques (statiques et dynamiques), 7 sondes d'expérience (`docs/ux/`) + lecture ciblée du code + essais en direct sur des serveurs et des bases jetables.
> **Résultat brut** (hors expérience, avant tri des faux positifs) : {{total}} trouvailles — {{gravite:critique}} critiques, {{gravite:haute}} hautes, {{gravite:moyenne}} moyennes, {{gravite:basse}} basses.
> Ce document est **assemblé** : chaque chiffre vient de `docs/audit/sondes.json`, jamais tapé à la main. Il se régénère (voir §17).

---

## Comment lire ce document

Ce n'est pas une liste de reproches : l'application est, sur beaucoup de points, **plus soignée que la moyenne des projets de cette taille** (voir §1.3). C'est un inventaire de tout ce qui reste à faire pour passer de « solide et personnel » à « sérieux et durable » — corriger, ajouter, retravailler, refaire.

**Chaque point** porte un identifiant stable (`SEC-03`, `DAT-02`…) que l'on peut citer dans un commit, une PR ou une conversation, et suit toujours le même schéma :

| Rubrique | Contenu |
|---|---|
| **Gravité** | 🔴 critique (perte de données, faille exploitable, fonction cassée) · 🟠 haute (défaut visible ou risque réel) · 🟡 moyenne (dette qui coûtera) · 🔵 basse (finition) · ⚪ info |
| **Effort** | S ≤ ½ journée · M ≈ 1–2 jours · L ≈ 3–5 jours · XL > 1 semaine |
| **Preuve** | fichier:ligne ou mesure — toujours vérifiable |
| **Correctif** | ce qu'il faut faire, concrètement |
| **Critère d'acceptation** | comment savoir que c'est fini (souvent : « la sonde X ne le signale plus ») |
| **Auto** | 🤖 si un correcteur de `scripts-ci/sondes/correcteurs/` sait le faire seul |

**Les sections** sont ordonnées de ce qui peut faire perdre des données ou ouvrir une porte, à ce qui améliore le confort. La **feuille de route** du §16 les remet en séquence de travail avec les dépendances.

### Ce que « sonde » veut dire ici

Une sonde est un script reproductible (`scripts-ci/sondes/*.js`) qui **mesure** au lieu de supposer. Les sondes sont conçues pour ne lire que le dépôt et votre vraie base ; les parcours d'écriture tournent sur des bases créées puis détruites, sur des serveurs lancés sur d'autres ports. **Une fois, cette règle n'a pas tenu** : voir §1.7.6 (une table vide ajoutée à votre base, sans perte de données). Un garde-fou la fait désormais respecter.

{{tableau-sondes}}

### Limites honnêtes de cet audit

- **Faux positifs assumés et triés.** Les sondes statiques sont volontairement larges. Exemple : la sonde de sécurité a signalé {{mesure:securite.innerHTML_interpolations_a_verifier}} interpolations HTML « à vérifier » ; la première passe en avait relu 9 à la main et conclu qu'aucune n'était exploitable. **La seconde passe en a prouvé une qui l'est** (SEC-15) : elles restent à traiter par un échappement automatique.
- **Ce que les sondes ne voient pas** : la qualité du design, la justesse des textes, la pertinence du produit, la sécurité des sites tiers. Ces points sont traités par lecture et jugement, et signalés comme tels.
- **Instantané.** Les sources externes (MangaDex, SushiScan, Gutenberg…) changent d'un jour à l'autre : l'état du §9 est celui du {{date}}. La CI `sources-health.yml` est faite pour suivre cela dans le temps.
- **Une seule machine.** Les mesures de vitesse viennent d'un PC de bureau. Le WebView Android 8 — la cible la plus contrainte — n'a pas été mesuré en direct ici ; ses risques sont déduits du code et du garde-fou `verifier-android8`.
