let allTracks = [];
let allAlbums = [];
let allArtists = [];
let userProfile = null;

const LEVELS = [
    { level: 1, xp: 0, title: 'Новичок', icon: '🎒' },
    { level: 2, xp: 50, title: 'Слушатель', icon: '🎧' },
    { level: 3, xp: 150, title: 'Любитель', icon: '🎵' },
    { level: 4, xp: 300, title: 'Меломан', icon: '🎶' },
    { level: 5, xp: 500, title: 'Знаток', icon: '🎼' },
    { level: 6, xp: 800, title: 'Ценитель', icon: '🎹' },
    { level: 7, xp: 1200, title: 'Эксперт', icon: '🎸' },
    { level: 8, xp: 1800, title: 'Критик', icon: '📝' },
    { level: 9, xp: 2500, title: 'Профи', icon: '🏅' },
    { level: 10, xp: 3500, title: 'Мастер', icon: '🎭' },
    { level: 11, xp: 5000, title: 'Гуру', icon: '🧘' },
    { level: 12, xp: 7000, title: 'Виртуоз', icon: '🎻' },
    { level: 13, xp: 10000, title: 'Маэстро', icon: '🎩' },
    { level: 14, xp: 14000, title: 'Легенда', icon: '⭐' },
    { level: 15, xp: 20000, title: 'Элита', icon: '💎' },
    { level: 16, xp: 28000, title: 'Титан', icon: '🏆' },
    { level: 17, xp: 40000, title: 'Мифический', icon: '🔮' },
    { level: 18, xp: 55000, title: 'Божество', icon: '👑' },
    { level: 19, xp: 75000, title: 'Создатель', icon: '🌟' },
    { level: 20, xp: 100000, title: 'Бог музыки', icon: '✨' }
];

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function loadData() {
    const session = await checkAuth();
    if (!session) return;

    const { data: tracks } = await supabaseClient
        .from('tracks')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
    allTracks = tracks || [];

    const { data: albums } = await supabaseClient
        .from('albums')
        .select('*')
        .eq('user_id', session.user.id);
    allAlbums = albums || [];

    const { data: artists } = await supabaseClient
        .from('artists')
        .select('*')
        .eq('user_id', session.user.id);
    allArtists = artists || [];

    // Загружаем или создаём профиль
    let { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

    if (!profile) {
        const { data: newProfile } = await supabaseClient
            .from('user_profiles')
            .insert([{ user_id: session.user.id }])
            .select()
            .single();
        profile = newProfile;
    }

    userProfile = profile;

    // Обновляем XP на основе треков
    await updateXP(session.user.id);

    renderLevelCard();
    renderOverview();
    renderHistory('week');
    populateArtistSelects();
}

async function updateXP(userId) {
    // Базовый XP за контент
    const trackXP = allTracks.length * 5;           // 5 XP за трек
    const albumXP = allAlbums.length * 10;          // 10 XP за альбом
    const artistXP = allArtists.length * 8;         // 8 XP за артиста
    
    // Бонусы за качество
    const perfectTracks = allTracks.filter(t => t.total_score === 10).length;
    const excellentTracks = allTracks.filter(t => t.total_score >= 9 && t.total_score < 10).length;
    const goodTracks = allTracks.filter(t => t.total_score >= 8 && t.total_score < 9).length;
    
    const qualityBonus = (perfectTracks * 15) + (excellentTracks * 8) + (goodTracks * 3);
    
    // Бонус за разнообразие (много разных артистов)
    const diversityBonus = Math.min(allArtists.length * 2, 500);
    
    // Бонус за полноту (альбомы с 5+ треками)
    const fullAlbumsCount = allAlbums.filter(album => {
        const tracks = allTracks.filter(t => t.album_id === album.id);
        return tracks.length >= 5;
    }).length;
    const fullAlbumBonus = fullAlbumsCount * 20;
    
    // Бонус за активность (треки за последние 7 дней)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentTracks = allTracks.filter(t => new Date(t.created_at) >= weekAgo).length;
    const activityBonus = Math.min(recentTracks * 3, 100);
    
    const totalXP = trackXP + albumXP + artistXP + qualityBonus + diversityBonus + fullAlbumBonus + activityBonus;
    
    const newLevel = LEVELS.reduce((acc, lvl) => totalXP >= lvl.xp ? lvl : acc, LEVELS[0]);

    if (totalXP !== userProfile.xp || newLevel.level !== userProfile.level) {
        await supabaseClient
            .from('user_profiles')
            .update({ xp: totalXP, level: newLevel.level, title: newLevel.title })
            .eq('user_id', userId);
        
        userProfile.xp = totalXP;
        userProfile.level = newLevel.level;
        userProfile.title = newLevel.title;
    }
}

function renderLevelCard() {
    const card = document.getElementById('level-card');
    const currentLevel = LEVELS.find(l => l.level === userProfile.level) || LEVELS[0];
    const nextLevel = LEVELS.find(l => l.level === userProfile.level + 1);
    
    const xpForNext = nextLevel ? nextLevel.xp - currentLevel.xp : 0;
    const xpProgress = nextLevel ? userProfile.xp - currentLevel.xp : xpForNext;
    const progressPercent = nextLevel ? (xpProgress / xpForNext * 100) : 100;

    card.innerHTML = `
        <div class="level-header">
            <span class="level-icon">${currentLevel.icon}</span>
            <div class="level-info">
                <div class="level-title">${currentLevel.title}</div>
                <div class="level-number">Уровень ${userProfile.level}</div>
            </div>
            <div class="level-xp">${userProfile.xp} XP</div>
        </div>
        <div class="level-progress">
            <div class="level-progress-bar" style="width: ${progressPercent}%"></div>
        </div>
        <div class="level-next">
            ${nextLevel ? `До "${nextLevel.title}": ${nextLevel.xp - userProfile.xp} XP` : 'Максимальный уровень!'}
        </div>
    `;
}

function getScoreColor(score) {
    if (score >= 8) return '#22c55e';
    if (score >= 7) return '#eab308';
    if (score >= 5) return '#f97316';
    return '#ef4444';
}

function getScoreClass(score) {
    return `score-${Math.min(10, Math.max(1, Math.round(score)))}`;
}

function renderOverview() {
    // Общая статистика
    const totalTracks = allTracks.length;
    const avgScore = totalTracks > 0 
        ? (allTracks.reduce((sum, t) => sum + t.total_score, 0) / totalTracks).toFixed(2) 
        : 0;
    const topScore = totalTracks > 0 ? Math.max(...allTracks.map(t => t.total_score)) : 0;
    const lowScore = totalTracks > 0 ? Math.min(...allTracks.map(t => t.total_score)) : 0;

    document.getElementById('overview-stats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalTracks}</div>
            <div class="stat-label">Треков</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${allAlbums.length}</div>
            <div class="stat-label">Альбомов</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${allArtists.length}</div>
            <div class="stat-label">Артистов</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: ${getScoreColor(avgScore)}">${avgScore}</div>
            <div class="stat-label">Средняя</div>
        </div>
    `;

    // Топ-10 треков
    const topTracks = [...allTracks]
        .sort((a, b) => b.total_score - a.total_score)
        .slice(0, 10);

    document.getElementById('top-tracks').innerHTML = topTracks.map((track, i) => {
        const artist = allArtists.find(a => a.id === track.artist_id);
        return `
            <div class="top-item">
                <span class="top-position">${i + 1}</span>
                <div class="top-info">
                    <div class="top-title">${track.title}</div>
                    <div class="top-subtitle">${artist?.name || track.artist}</div>
                </div>
                <span class="top-score ${getScoreClass(track.total_score)}">${track.total_score.toFixed(1)}</span>
            </div>
        `;
    }).join('');

    // Топ-5 артистов
    const artistsWithScores = allArtists.map(artist => {
        const tracks = allTracks.filter(t => t.artist_id === artist.id);
        const avg = tracks.length > 0 
            ? tracks.reduce((sum, t) => sum + t.total_score, 0) / tracks.length 
            : 0;
        return { ...artist, avgScore: avg, trackCount: tracks.length };
    }).filter(a => a.trackCount > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    document.getElementById('top-artists').innerHTML = artistsWithScores.map((artist, i) => `
        <div class="top-item">
            <span class="top-position">${i + 1}</span>
            <div class="top-info">
                <div class="top-title">${artist.name}</div>
                <div class="top-subtitle">${artist.trackCount} треков</div>
            </div>
            <span class="top-score ${getScoreClass(artist.avgScore)}">${artist.avgScore.toFixed(1)}</span>
        </div>
    `).join('');

    // Топ-5 альбомов
    const albumsWithScores = allAlbums.map(album => {
        const tracks = allTracks.filter(t => t.album_id === album.id);
        const avg = tracks.length > 0 
            ? tracks.reduce((sum, t) => sum + t.total_score, 0) / tracks.length 
            : 0;
        return { ...album, avgScore: avg, trackCount: tracks.length };
    }).filter(a => a.trackCount > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    document.getElementById('top-albums').innerHTML = albumsWithScores.map((album, i) => {
        const artist = allArtists.find(a => a.id === album.artist_id);
        return `
            <div class="top-item">
                <span class="top-position">${i + 1}</span>
                <div class="top-info">
                    <div class="top-title">${album.title}</div>
                    <div class="top-subtitle">${artist?.name || ''}</div>
                </div>
                <span class="top-score ${getScoreClass(album.avgScore)}">${album.avgScore.toFixed(1)}</span>
            </div>
        `;
    }).join('');

    // Распределение оценок
    const distribution = [0,0,0,0,0,0,0,0,0,0];
    allTracks.forEach(t => {
        const idx = Math.min(9, Math.max(0, Math.floor(t.total_score) - 1));
        distribution[idx]++;
    });
    const maxCount = Math.max(...distribution, 1);

    document.getElementById('score-distribution').innerHTML = distribution.map((count, i) => `
        <div class="dist-bar-container">
            <div class="dist-bar" style="height: ${count / maxCount * 100}%; background: ${getScoreColor(i + 1.5)}"></div>
            <div class="dist-label">${i + 1}</div>
            <div class="dist-count">${count}</div>
        </div>
    `).join('');

    // Средние по критериям
    if (allTracks.length > 0) {
        const avgInstrumental = allTracks.reduce((sum, t) => sum + t.instrumental, 0) / allTracks.length;
        const avgMeaning = allTracks.reduce((sum, t) => sum + t.meaning, 0) / allTracks.length;
        const avgVibe = allTracks.reduce((sum, t) => sum + t.vibe, 0) / allTracks.length;
        const avgStructure = allTracks.reduce((sum, t) => sum + t.structure, 0) / allTracks.length;
        const avgOriginality = allTracks.reduce((sum, t) => sum + t.originality, 0) / allTracks.length;
        const avgReplayability = allTracks.reduce((sum, t) => sum + t.replayability, 0) / allTracks.length;

        const vocalsCount = allTracks.filter(t => t.has_vocals).length;
        const avgCharisma = vocalsCount > 0 
            ? allTracks.filter(t => t.has_vocals).reduce((sum, t) => sum + t.charisma, 0) / vocalsCount 
            : 0;

        const criteria = [
            { name: 'Инструментал', value: avgInstrumental },
            { name: 'Харизма', value: avgCharisma },
            { name: 'Смысл', value: avgMeaning },
            { name: 'Вайб', value: avgVibe },
            { name: 'Структура', value: avgStructure },
            { name: 'Оригинальность', value: avgOriginality },
            { name: 'Репитабельность', value: avgReplayability }
        ].sort((a, b) => b.value - a.value);

        document.getElementById('criteria-averages').innerHTML = criteria.map(c => `
            <div class="criteria-row">
                <span class="criteria-name">${c.name}</span>
                <div class="criteria-bar-bg">
                    <div class="criteria-bar" style="width: ${c.value * 10}%; background: ${getScoreColor(c.value)}"></div>
                </div>
                <span class="criteria-value" style="color: ${getScoreColor(c.value)}">${c.value.toFixed(1)}</span>
            </div>
        `).join('');
    }
}

function renderHistory(period) {
    let filtered = [...allTracks];
    const now = new Date();

    if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(t => new Date(t.created_at) >= weekAgo);
    } else if (period === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(t => new Date(t.created_at) >= monthAgo);
    }

    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const list = document.getElementById('history-list');

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-text">Нет оценок за этот период</p>';
        return;
    }

    // Группируем по дате
    const grouped = {};
    filtered.forEach(track => {
        const date = new Date(track.created_at).toLocaleDateString('ru-RU');
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(track);
    });

    list.innerHTML = Object.entries(grouped).map(([date, tracks]) => `
        <div class="history-date">
            <h3>${date}</h3>
            ${tracks.map(track => {
                const artist = allArtists.find(a => a.id === track.artist_id);
                return `
                    <div class="history-item">
                        <div class="history-info">
                            <div class="history-title">${track.title}</div>
                            <div class="history-artist">${artist?.name || track.artist}</div>
                        </div>
                        <span class="history-score ${getScoreClass(track.total_score)}">${track.total_score.toFixed(1)}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `).join('');
}

function populateArtistSelects() {
    const options = allArtists.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    document.getElementById('artist1-select').innerHTML = '<option value="">Выбери артиста 1</option>' + options;
    document.getElementById('artist2-select').innerHTML = '<option value="">Выбери артиста 2</option>' + options;
}

function compareArtists() {
    const id1 = document.getElementById('artist1-select').value;
    const id2 = document.getElementById('artist2-select').value;
    const result = document.getElementById('compare-result');

    if (!id1 || !id2) {
        result.innerHTML = '<p class="empty-text">Выбери двух артистов для сравнения</p>';
        return;
    }

    if (id1 === id2) {
        result.innerHTML = '<p class="empty-text">Выбери разных артистов</p>';
        return;
    }

    const artist1 = allArtists.find(a => a.id === id1);
    const artist2 = allArtists.find(a => a.id === id2);

    const tracks1 = allTracks.filter(t => t.artist_id === id1);
    const tracks2 = allTracks.filter(t => t.artist_id === id2);

    if (tracks1.length === 0 || tracks2.length === 0) {
        result.innerHTML = '<p class="empty-text">У одного из артистов нет треков</p>';
        return;
    }

    const calcAvg = (tracks, field) => tracks.reduce((sum, t) => sum + (t[field] || 0), 0) / tracks.length;

    const criteria = ['instrumental', 'charisma', 'meaning', 'vibe', 'structure', 'originality', 'replayability'];
    const names = ['Инструментал', 'Харизма', 'Смысл', 'Вайб', 'Структура', 'Оригинальность', 'Репитабельность'];

    let wins1 = 0, wins2 = 0;

    const rows = criteria.map((c, i) => {
        const val1 = calcAvg(tracks1, c);
        const val2 = calcAvg(tracks2, c);
        const winner = val1 > val2 ? 1 : val2 > val1 ? 2 : 0;
        if (winner === 1) wins1++;
        if (winner === 2) wins2++;

        return `
            <div class="compare-row">
                <span class="compare-val ${winner === 1 ? 'winner' : ''}" style="color: ${getScoreColor(val1)}">${val1.toFixed(1)}</span>
                <span class="compare-label">${names[i]}</span>
                <span class="compare-val ${winner === 2 ? 'winner' : ''}" style="color: ${getScoreColor(val2)}">${val2.toFixed(1)}</span>
            </div>
        `;
    }).join('');

    const total1 = calcAvg(tracks1, 'total_score');
    const total2 = calcAvg(tracks2, 'total_score');

    result.innerHTML = `
        <div class="compare-header">
            <div class="compare-artist ${wins1 > wins2 ? 'winner' : ''}">
                <div class="compare-name">${artist1.name}</div>
                <div class="compare-tracks">${tracks1.length} треков</div>
            </div>
            <div class="compare-artist ${wins2 > wins1 ? 'winner' : ''}">
                <div class="compare-name">${artist2.name}</div>
                <div class="compare-tracks">${tracks2.length} треков</div>
            </div>
        </div>
        ${rows}
        <div class="compare-row compare-total">
            <span class="compare-val" style="color: ${getScoreColor(total1)}">${total1.toFixed(1)}</span>
            <span class="compare-label">ИТОГО</span>
            <span class="compare-val" style="color: ${getScoreColor(total2)}">${total2.toFixed(1)}</span>
        </div>
        <div class="compare-verdict">
            ${wins1 > wins2 ? `🏆 ${artist1.name} побеждает!` : 
              wins2 > wins1 ? `🏆 ${artist2.name} побеждает!` : '🤝 Ничья!'}
        </div>
    `;
}

// Навигация
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabName = tab.dataset.tab;
        document.getElementById('overview-section').classList.toggle('hidden', tabName !== 'overview');
        document.getElementById('history-section').classList.toggle('hidden', tabName !== 'history');
        document.getElementById('compare-section').classList.toggle('hidden', tabName !== 'compare');
    });
});

document.getElementById('history-period').addEventListener('change', (e) => {
    renderHistory(e.target.value);
});

document.getElementById('artist1-select').addEventListener('change', compareArtists);
document.getElementById('artist2-select').addEventListener('change', compareArtists);

loadData();