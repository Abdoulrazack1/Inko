# Audit des états — ce que la page montre quand l’API se tait

Relevé du 2026-09-09. **Toutes** les requêtes
`/api/**` sont coupées, comme si le hub était éteint. On regarde ce que la
page affiche cinq secondes plus tard.

| Verdict | Sens |
|---|---|
| `EXPLIQUE` | la page dit ce qui se passe — c’est ce qu’on veut |
| `TOURNE ENCORE` | un indicateur de chargement tourne toujours : l’utilisateur attend pour rien |
| `MUET` | du contenu, mais rien qui explique l’absence de données |
| `VIDE` | **rien**. Une panne et une bibliothèque vide se ressemblent alors trait pour trait |

| Page | Verdict | Texte visible | Chargement | Ce qu’on lit |
|---|---|---|---|---|
| accueil | EXPLIQUE | 958 car. | 0 | Accueil ⚠ Impossible de charger la mise en avant La source ou le serveur n'a pas répondu.  |
| catalogue | EXPLIQUE | 1170 car. | 0 | Filtres Réinitialiser GENRES Pas de filtres par genre pour cette source. STATUT En cours T |
| recherche | **MUET** | 121 car. | 0 | Recherche sur toutes les sources Rechercher Tape un titre : Inko cherche sur toutes tes so |
| bibliotheque | EXPLIQUE | 292 car. | 0 | Ma bibliothèque Bibliothèque Signets Téléchargements Aucun ordinateur connecté Cette page  |
| serie | EXPLIQUE | 49 car. | 0 | ⚠ Chargement impossible Failed to fetch Réessayer |
| chapitre | EXPLIQUE | 74 car. | 0 | Lecture ⚠ Chargement impossible Failed to fetch Réessayer ↩ Retour Accueil |
| lecture | EXPLIQUE | 58 car. | 0 | ⚠ Chargement impossible Failed to fetch Réessayer ↩ Retour |
| collections | EXPLIQUE | 251 car. | 0 | Mes listes Organise tes séries en collections : à lire, favoris, pépites, ce que tu veux.  |
| collection-detail | EXPLIQUE | 48 car. | 0 | Connecte-toi pour voir cette liste. ← Mes listes |
| notes | EXPLIQUE | 393 car. | 0 | Journal de lecture Tes pensées, chapitre après chapitre — comme un carnet qui suit ta lect |
| notifications | EXPLIQUE | 422 car. | 0 | Notifications ↻ Actualiser 🔔 Activer le push Me prévenir toutes les 4 heures deux fois pa |
| downloads | EXPLIQUE | 256 car. | 0 | Téléchargements 0 chapitre(s) · 4.9 Mo utilisés sur 3.00 Go disponibles. Le système peut l |
| import | EXPLIQUE | 437 car. | 0 | Importer un livre Ajoute tes propres fichiers EPUB (romans), PDF (livres/BD), CBZ (mangas/ |
| localreader | EXPLIQUE | 121 car. | 0 | ⚠ Lecture impossible Connexion requise — recharge la page pour rétablir la session. Mes fi |
| parametres | EXPLIQUE | 3266 car. | 0 | Paramètres Personnalise ton expérience de lecture. Les réglages du compte sont synchronisé |
| profil | EXPLIQUE | 239 car. | 0 | Aucun ordinateur connecté Cette page lit des données que ton ordinateur synchronise. Sans  |
| u | EXPLIQUE | 66 car. | 0 | Profil public Profil introuvable Aucun utilisateur nommé « demo ». |
| stats | EXPLIQUE | 290 car. | 0 | Tes statistiques Ton activité de lecture sur Inko. Aucun ordinateur connecté Cette page li |
| sources | EXPLIQUE | 769 car. | 0 | Sources Inko fonctionne avec des extensions de sources, réparties en deux familles : les m |
| liste | **MUET** | 78 car. | 0 | Cette liste n’existe pas ou n’est pas partagée publiquement. Aller à l’accueil |
| anilist | **MUET** | 165 car. | 0 | Lier un compte AniList Cette page reçoit la réponse d'AniList après une autorisation. La l |
| confidentialite | EXPLIQUE | 3708 car. | 0 | Politique de confidentialité Dernière mise à jour : 30 juin 2026 Inko est un lecteur de ma |
| offline | EXPLIQUE | 271 car. | 0 | Tu es hors ligne Impossible de joindre Inko pour l'instant. Ce que tu as déjà téléchargé r |

**3 page(s)** ne disent pas à l’utilisateur ce qui se passe.
