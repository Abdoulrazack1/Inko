            bannerFallback: 'https://picsum.photos/seed/cyberpunkbanner/1400/400',
            curator: { id: 6, name: 'WebToonF', handle: '@WebToonF', avatar: null },
            mangaIds: [9, 10, 5, 22],
            tags: ['#cyberpunk', '#sci-fi', '#dystopie', '#robots'],
            genre: 'Sci-Fi',
            likes: 3200, followers: 45000, comments: 245,
            seriesCount: 28, chaptersTotal: 560, readers: 14000,
            avgRating: 4.6, completion: 82,
            isEditorPick: false, isTrending: true, isStaffPick: false,
            createdAt: '2024-01-05', updatedAt: '2024-04-07',
            stats: { totalReadTime: '560 h', avgReadTime: '20 h', newThisWeek: 2, completion: 82 },
        },
        {
            id: 7, slug: 'gourmet-culinaire',
            title: 'Gourmet : Mangas Culinaires',
            description: 'Des séries où la nourriture est au cœur de l\'histoire. Du donjon au restaurant, la cuisine comme révélateur de caractère.',
            cover: 'assets/collections/gourmet.jpg',
            coverFallback: 'https://picsum.photos/seed/gourmet/800/300',
            bannerFallback: 'https://picsum.photos/seed/gourmetbanner/1400/400',
            curator: { id: 7, name: 'LunaRead', handle: '@LunaRead', avatar: null },
            mangaIds: [7, 8, 21],
            tags: ['#cuisine', '#food', '#gastronomie', '#donjon'],
            genre: 'Slice of Life',
            likes: 2100, followers: 13400, comments: 134,
            seriesCount: 15, chaptersTotal: 210, readers: 25000,
            avgRating: 4.7, completion: 90,
            isEditorPick: false, isTrending: false, isStaffPick: true,
            createdAt: '2024-03-01', updatedAt: '2024-04-06',
            stats: { totalReadTime: '210 h', avgReadTime: '14 h', newThisWeek: 0, completion: 90 },
        },
        {
            id: 8, slug: 'enquetes-mysteres',
            title: 'Enquêtes Impossibles & Mystères',
            description: 'Pour les amateurs de puzzles narratifs et de détectives atypiques. Sélection des meilleurs polars et thrillers en manga.',
            cover: 'assets/collections/mystere.jpg',
            coverFallback: 'https://picsum.photos/seed/mystere/800/300',
            bannerFallback: 'https://picsum.photos/seed/mysterebanner/1400/400',
            curator: { id: 8, name: 'OldSchool', handle: '@OldSchool', avatar: null },
            mangaIds: [4, 18, 5, 22],
            tags: ['#mystère', '#thriller', '#détective', '#enquête'],
            genre: 'Mystère',
            likes: 1800, followers: 4100, comments: 98,
            seriesCount: 12, chaptersTotal: 380, readers: 7800,
            avgRating: 4.7, completion: 86,
            isEditorPick: false, isTrending: false, isStaffPick: false,
            createdAt: '2024-02-20', updatedAt: '2024-03-28',
            stats: { totalReadTime: '380 h', avgReadTime: '31 h', newThisWeek: 0, completion: 86 },
        },
    ];

    // ── Curateurs ────────────────────────────────────────────────
    const curators = [
        { id: 1, name: 'YunaSimp', handle: '@YunaSimp', avatar: null, collections: 11, followers: 45000, badge: 'Elite', bio: 'Dark fantasy & isekai curator' },
        { id: 2, name: 'DarkReader', handle: '@DarkReader', avatar: null, collections: 45, followers: 38000, badge: 'Top', bio: 'Seinen expert' },
        { id: 3, name: 'MangaQueen', handle: '@MangaQueen', avatar: null, collections: 8, followers: 28000, badge: 'Curateur', bio: 'Romance & Shōjo specialist' },
        { id: 4, name: 'LevelSolo', handle: '@LevelSolo', avatar: null, collections: 23, followers: 21000, badge: 'Pro', bio: 'Thriller & suspense addict' },
        { id: 5, name: 'LunaRead', handle: '@LunaRead', avatar: null, collections: 16, followers: 18000, badge: 'Curateur', bio: 'Slice of life & food manga' },
        { id: 6, name: 'OldSchool', handle: '@OldSchool', avatar: null, collections: 619, followers: 15000, badge: 'Légende', bio: 'Classics & retro manga only' },
        { id: 7, name: 'WebToonF', handle: '@WebToonF', avatar: null, collections: 31, followers: 12000, badge: 'Curateur', bio: 'Webtoons & manhwa curator' },
    ];

    // ── Commentaires récents ──────────────────────────────────────
    const recentComments = [
        { mangaId: 1, user: 'Kuro_88', time: '4j 17h', text: 'L\'arc de Griffith dans la tour est insupportable mais magistral.' },
        { mangaId: 3, user: 'NordikViking', time: '6j 9h', text: 'L\'arc Ketil Farm est une leçon de narration. Yukimura au sommet.' },
        { mangaId: 4, user: 'ThrillerGuru', time: '1sem 2h', text: 'Johan Liebert est l\'antagoniste le plus glaçant de toute la fiction.' },
    ];

    // ── Sondage semaine ───────────────────────────────────────────
    const weeklyPoll = {
        question: 'Quel est votre manga Seinen préféré ?',
        options: [
            { label: 'Berserk', percent: 41 },
            { label: 'Vagabond', percent: 30 },
            { label: 'Monster', percent: 29 },
        ],
    };

    // ── Résultats semaine tendances ───────────────────────────────
    const trendingWeek = [1, 3, 2, 4, 7, 6, 11, 8, 5, 22];

    // ── Reprise de lecture (user simulé) ─────────────────────────
    const readingHistory = [
        { mangaId: 1, chapter: 112, page: 14, lastRead: '2j' },
        { mangaId: 4, chapter: 108, page: 4, lastRead: '4j' },
        { mangaId: 3, chapter: 36, page: null, lastRead: 'Terminé' },
    ];

    // ── Dernières sorties ────────────────────────────────────────
    const latestReleases = [1, 3, 7, 6, 16, 4, 8, 13, 14, 11, 22, 2];

    // ── Recommandations ──────────────────────────────────────────
    const recommended = [
        { mangaId: 9, matchPercent: 98, reason: 'Basé sur votre lecture de Berserk' },
        { mangaId: 14, matchPercent: 94, reason: 'Univers fantastique original' },
        { mangaId: 22, matchPercent: 91, reason: 'Sci-Fi philosophique comme Monster' },
    ];

    // ── Sorties calendrier ───────────────────────────────────────
    const calendarReleases = [
        { mangaId: 1, day: 'AUJOURD\'HUI', time: '18H', chapter: 365 },
        { mangaId: 16, day: 'DEMAIN', time: '10H', chapter: 1451 },
        { mangaId: 3, day: 'VENDREDI', time: null, chapter: 211 },
    ];

    // ── Genres populaires ────────────────────────────────────────
    const popularGenres = ['Action', 'Fantasy', 'Horreur', 'Romance', 'Sci-Fi', 'Sports', 'Comédie', 'Mystère'];
    const genreIcons = { Action: '⚔️', Fantasy: '🐉', Horreur: '🩸', Romance: '❤️', 'Sci-Fi': '🚀', Sports: '🏆', Comédie: '😄', Mystère: '🔍' };

    // ── Top Manga sidebar ────────────────────────────────────────
    const topManga = [1, 3, 15, 2, 4];

    // ── API publique ─────────────────────────────────────────────
    return {
        mangas,
        chapters,
        collections,
        curators,
        recentComments,
        weeklyPoll,
        trendingWeek,
        readingHistory,
        latestReleases,
        recommended,
        calendarReleases,
        popularGenres,
        genreIcons,
        topManga,

        getManga: (id) => mangas.find(m => m.id === id),
        getMangaBySlug: (slug) => mangas.find(m => m.slug === slug),
        getCollection: (id) => collections.find(c => c.id === id),
        getCollectionBySlug: (slug) => collections.find(c => c.slug === slug),
        getChapters: (mangaId) => chapters[mangaId] || [],
        getCurator: (id) => curators.find(c => c.id === id),
        getTrending: () => trendingWeek.map(id => mangas.find(m => m.id === id)).filter(Boolean),
        getLatest: () => latestReleases.map(id => mangas.find(m => m.id === id)).filter(Boolean),
        getTopManga: () => topManga.map(id => mangas.find(m => m.id === id)).filter(Boolean),
        getRecommended: () => recommended.map(r => ({ ...mangas.find(m => m.id === r.mangaId), matchPercent: r.matchPercent, reason: r.reason })).filter(Boolean),
        getSimilar: (mangaId) => {
            const manga = mangas.find(m => m.id === mangaId);
            if (!manga) return [];
            return manga.similarIds.map(id => mangas.find(m => m.id === id)).filter(Boolean);
        },
        searchMangas: (query, filters = {}) => {
            let results = [...mangas];
            if (query) {
                const q = query.toLowerCase();
                results = results.filter(m =>
                    m.title.toLowerCase().includes(q) ||
                    m.author.toLowerCase().includes(q) ||
                    m.tags.some(t => t.toLowerCase().includes(q)) ||
                    m.genres.some(g => g.toLowerCase().includes(q))
                );
            }
            if (filters.status) results = results.filter(m => m.status === filters.status);
            if (filters.demographic) results = results.filter(m => m.demographic === filters.demographic);
            if (filters.genre) results = results.filter(m => m.genres.includes(filters.genre));
            if (filters.minRating) results = results.filter(m => m.rating >= filters.minRating);
            if (filters.isWebtoon !== undefined) results = results.filter(m => m.isWebtoon === filters.isWebtoon);
            if (filters.sort === 'rating') results.sort((a, b) => b.rating - a.rating);
            else if (filters.sort === 'readers') results.sort((a, b) => b.readers - a.readers);
            else if (filters.sort === 'chapters') results.sort((a, b) => b.chapters - a.chapters);
            return results;
        },
    };
})();
