# Audit — les contrôles qui répondent sans rien faire

Relevé du 2026-09-09.

Un gestionnaire de clic qui ne fait que déplacer une classe `active` est
**pire qu’un bouton mort** : le bouton s’allume, donc on croit que le filtre
a filtré. L’audit des contrôles ne peut pas le voir — pour lui, la page a
bien changé, alors il conclut « AGIT ».

> ⚠ Heuristique. Un menu qui se ferme au clic dehors ne fait,
> légitimement, que de la présentation. À lire, pas à appliquer.

**1** gestionnaire(s) à regarder.

| Fichier | Ligne | Ce que fait le gestionnaire |
|---|---|---|
| `global.js` | 1941 | `if (dd && dd.style.display === 'block' && !e.target.closest('.notif-wrap')) dd.style.display = 'none';` |
