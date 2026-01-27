const urlParams = new URLSearchParams(window.location.search);
const artistId = urlParams.get('id');

let artist = null;
let artistAlbums = [];
let artistTracks = [];
let currentTab = 'albums';

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function loadArtist() {
    const session = await checkAuth();
    if (!session || !artistId) return;

    const { data } = await supabaseClient
        .from('artists')
        .select('*')
        .eq('id', artistId)
        .single();
    artist = data;

    const { data: albums } = await supabaseClient
        .from('albums')
        .select('*')
        .eq('artist_id', artistId)
        .order('year', { ascending: false });
    artistAlbums = albums || [];

    const { data: tracks } = await supabaseClient
        .from('tracks')
        .select('*')
        .eq('artist_id', artistId)
        .order('created_at', { ascending: false });
    artistTracks = tracks || [];

    // Заполняем фильтр альбомов
    const albumFilter = document.getElementById('album-filter');
    albumFilter.innerHTML = '<option value="all">Все</option><option value="no-album">Синглы</option>';
    artistAlbums.forEach(album => {
        albumFilter.innerHTML += `<option value="${album.id}">${album.title}</option>`;
    });

    renderArtist();
    renderAlbums();
    applyFilters();
}

function getScoreColor(score) {
    if (score >= 9.5) return '#00ff00';
    if (score >= 8.5) return '#40ff00';
    if (score >= 7.5) return '#80ff00';
    if (score >= 6.5) return '#ffff00';
    if (score >= 5.5) return '#ffcc00';
    if (score >= 4.5) return '#ff9900';
    if (score >= 3.5) return '#ff6600';
    if (score >= 2.5) return '#ff3300';
    if (score >= 1.5) return '#ff0000';
    return '#cc0000';
}

function getScoreClass(score) {
    return `score-${Math.min(10, Math.max(1, Math.round(score)))}`;
}

function getTrackCover(track) {
    if (track.image_url) return track.image_url;
    if (track.album_id) {
        const album = artistAlbums.find(a => a.id === track.album_id);
        if (album?.image_url) return album.image_url;
    }
    return null;
}

function renderArtist() {
    if (!artist) return;

    document.getElementById('page-title').textContent = artist.name;
    document.getElementById('add-album-btn').href = `add-album.html?artist=${artistId}`;
    document.getElementById('add-track-btn').href = `rate.html?artist=${artistId}`;
    document.getElementById('edit-artist-btn').href = `edit-artist.html?id=${artistId}`;

    const cover = artist.image_url ? `<img src="${artist.image_url}" alt="">` : '';
    const avgScore = artistTracks.length > 0
        ? (artistTracks.reduce((sum, t) => sum + t.total_score, 0) / artistTracks.length).toFixed(1)
        : '—';

    document.getElementById('artist-info').innerHTML = `
        <div class="detail-cover">${cover || `<span style="font-size:48px">${artist.name.charAt(0)}</span>`}</div>
        <div class="detail-info">
            <div class="detail-title">${artist.name}</div>
            <div class="detail-subtitle">${artistAlbums.length} альбомов • ${artistTracks.length} треков</div>
            <div class="detail-score" style="color: ${getScoreColor(parseFloat(avgScore))}">${avgScore}</div>
        </div>
    `;
}

function renderAlbums() {
    const list = document.getElementById('artist-albums');
    document.getElementById('albums-count').textContent = `${artistAlbums.length} альбомов`;

    if (artistAlbums.length === 0) {
        list.innerHTML = '<p class="empty-text">Альбомов пока нет</p>';
        return;
    }

    list.innerHTML = artistAlbums.map(album => {
        const albumTracks = artistTracks.filter(t => t.album_id === album.id);
        const avgScore = albumTracks.length > 0
            ? (albumTracks.reduce((sum, t) => sum + t.total_score, 0) / albumTracks.length).toFixed(1)
            : '—';
        const scoreClass = albumTracks.length > 0 ? getScoreClass(parseFloat(avgScore)) : '';
        const cover = album.image_url ? `<img src="${album.image_url}" alt="">` : '💿';

        return `
            <div class="album-card" data-id="${album.id}">
                <div class="album-cover">${cover}</div>
                <div class="album-title">${album.title}</div>
                <div class="album-score ${scoreClass}">${avgScore} (${albumTracks.length})</div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.album-card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = `album.html?id=${card.dataset.id}`;
        });
    });
}

function applyFilters() {
    const sortBy = document.getElementById('sort-select').value;
    const albumFilter = document.getElementById('album-filter').value;
    const scoreFilter = document.getElementById('score-filter').value;

    let filtered = [...artistTracks];

    if (albumFilter === 'no-album') {
        filtered = filtered.filter(t => !t.album_id);
    } else if (albumFilter !== 'all') {
        filtered = filtered.filter(t => t.album_id === albumFilter);
    }

    if (scoreFilter !== 'all') {
        if (scoreFilter === 'low') {
            filtered = filtered.filter(t => t.total_score < 5);
        } else {
            const min = parseFloat(scoreFilter);
            filtered = filtered.filter(t => t.total_score >= min);
        }
    }

    switch (sortBy) {
        case 'score-desc':
            filtered.sort((a, b) => b.total_score - a.total_score);
            break;
        case 'score-asc':
            filtered.sort((a, b) => a.total_score - b.total_score);
            break;
        case 'title':
            filtered.sort((a, b) => a.title.localeCompare(b.title));
            break;
        default:
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    renderTracks(filtered);
}

function renderTracks(tracks) {
    const list = document.getElementById('artist-tracks');
    document.getElementById('tracks-count').textContent = `${tracks.length} треков`;

    if (tracks.length === 0) {
        list.innerHTML = '<p class="empty-text">Треков пока нет</p>';
        return;
    }

    list.innerHTML = tracks.map(track => {
        const scoreClass = getScoreClass(track.total_score);
        const coverUrl = getTrackCover(track);
        const cover = coverUrl ? `<img src="${coverUrl}" alt="">` : '🎵';
        const album = artistAlbums.find(a => a.id === track.album_id);

        return `
            <div class="track-card" data-id="${track.id}">
                <div class="track-cover">${cover}</div>
                <div class="track-info">
                    <div class="track-title">${track.title}</div>
                    <div class="track-artist">${album?.title || 'Сингл'}</div>
                </div>
                <div class="track-score ${scoreClass}">${track.total_score.toFixed(1)}</div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.track-card').forEach(card => {
        card.addEventListener('click', () => openTrackModal(card.dataset.id));
    });
}

function openTrackModal(trackId) {
    const track = artistTracks.find(t => t.id === trackId);
    if (!track) return;

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const coverUrl = getTrackCover(track);
    const cover = coverUrl ? `<img src="${coverUrl}" alt="">` : '🎵';
    const album = artistAlbums.find(a => a.id === track.album_id);
    const scoreColor = getScoreColor(track.total_score);

    body.innerHTML = `
        <div class="modal-header">
            <div class="modal-cover">${cover}</div>
            <div>
                <div class="modal-title">${track.title}</div>
                ${album ? `<div class="modal-album">💿 ${album.title}</div>` : '<div class="modal-album">Сингл</div>'}
                <div class="modal-total" style="color: ${scoreColor}">${track.total_score.toFixed(1)}</div>
            </div>
        </div>
        <div class="modal-scores">
            <div class="score-row"><span class="score-label">Инструментал</span><span class="score-value" style="color: ${getScoreColor(track.instrumental)}">${track.instrumental}</span></div>
            ${track.has_vocals ? `<div class="score-row"><span class="score-label">Харизма</span><span class="score-value" style="color: ${getScoreColor(track.charisma)}">${track.charisma}</span></div>` : ''}
            <div class="score-row"><span class="score-label">Смысл</span><span class="score-value" style="color: ${getScoreColor(track.meaning)}">${track.meaning}</span></div>
            <div class="score-row"><span class="score-label">Вайб</span><span class="score-value" style="color: ${getScoreColor(track.vibe)}">${track.vibe}</span></div>
            <div class="score-row"><span class="score-label">Структура</span><span class="score-value" style="color: ${getScoreColor(track.structure)}">${track.structure}</span></div>
            <div class="score-row"><span class="score-label">Оригинальность</span><span class="score-value" style="color: ${getScoreColor(track.originality)}">${track.originality}</span></div>
            <div class="score-row"><span class="score-label">Репитабельность</span><span class="score-value" style="color: ${getScoreColor(track.replayability)}">${track.replayability}</span></div>
        </div>
        ${track.notes ? `<div class="modal-notes"><strong>Заметки:</strong> ${track.notes}</div>` : ''}
        ${(track.spotify_url || track.youtube_url) ? `
        <div class="modal-links">
            ${track.spotify_url ? `<a href="${track.spotify_url}" target="_blank" class="link-btn spotify">Spotify</a>` : ''}
            ${track.youtube_url ? `<a href="${track.youtube_url}" target="_blank" class="link-btn youtube">YouTube</a>` : ''}
        </div>
        ` : ''}
        <div class="modal-actions-row">
            <a href="edit-track.html?id=${track.id}" class="btn-edit">✏️ Редактировать</a>
            <button class="btn-delete" onclick="deleteTrack('${track.id}')">🗑️</button>
        </div>
    `;

    modal.classList.remove('hidden');
}

function openStatsModal() {
    if (artistTracks.length === 0) {
        alert('Нет треков для статистики');
        return;
    }

    const modal = document.getElementById('stats-modal');
    const body = document.getElementById('stats-modal-body');

    // Лучший и худший трек
    const sortedTracks = [...artistTracks].sort((a, b) => b.total_score - a.total_score);
    const bestTrack = sortedTracks[0];
    const worstTrack = sortedTracks[sortedTracks.length - 1];

    // Лучший и худший альбом
    let bestAlbum = null;
    let worstAlbum = null;
    if (artistAlbums.length > 0) {
        const albumsWithScores = artistAlbums.map(album => {
            const tracks = artistTracks.filter(t => t.album_id === album.id);
            const avg = tracks.length > 0 
                ? tracks.reduce((sum, t) => sum + t.total_score, 0) / tracks.length 
                : 0;
            return { ...album, avgScore: avg, trackCount: tracks.length };
        }).filter(a => a.trackCount > 0).sort((a, b) => b.avgScore - a.avgScore);

        if (albumsWithScores.length > 0) {
            bestAlbum = albumsWithScores[0];
            worstAlbum = albumsWithScores[albumsWithScores.length - 1];
        }
    }

    const avgScore = (artistTracks.reduce((sum, t) => sum + t.total_score, 0) / artistTracks.length).toFixed(2);
    const singles = artistTracks.filter(t => !t.album_id);

    // Средние по критериям
    const avgInstrumental = (artistTracks.reduce((sum, t) => sum + t.instrumental, 0) / artistTracks.length).toFixed(1);
    const avgMeaning = (artistTracks.reduce((sum, t) => sum + t.meaning, 0) / artistTracks.length).toFixed(1);
    const avgVibe = (artistTracks.reduce((sum, t) => sum + t.vibe, 0) / artistTracks.length).toFixed(1);
    const avgStructure = (artistTracks.reduce((sum, t) => sum + t.structure, 0) / artistTracks.length).toFixed(1);
    const avgOriginality = (artistTracks.reduce((sum, t) => sum + t.originality, 0) / artistTracks.length).toFixed(1);
    const avgReplayability = (artistTracks.reduce((sum, t) => sum + t.replayability, 0) / artistTracks.length).toFixed(1);

    body.innerHTML = `
        <h2 style="margin: 20px; text-align: center;">📊 Статистика артиста</h2>
        
        <div class="stats-section">
            <h3>🏆 Лучший трек</h3>
            <div class="stats-track">
                <span>${bestTrack.title}</span>
                <span style="color: ${getScoreColor(bestTrack.total_score)}">${bestTrack.total_score.toFixed(1)}</span>
            </div>
        </div>

        <div class="stats-section">
            <h3>📉 Худший трек</h3>
            <div class="stats-track">
                <span>${worstTrack.title}</span>
                <span style="color: ${getScoreColor(worstTrack.total_score)}">${worstTrack.total_score.toFixed(1)}</span>
            </div>
        </div>

        ${bestAlbum ? `
        <div class="stats-section">
            <h3>💿 Лучший альбом</h3>
            <div class="stats-track">
                <span>${bestAlbum.title}</span>
                <span style="color: ${getScoreColor(bestAlbum.avgScore)}">${bestAlbum.avgScore.toFixed(1)}</span>
            </div>
        </div>
        ` : ''}

        ${worstAlbum && artistAlbums.length > 1 ? `
        <div class="stats-section">
            <h3>📉 Худший альбом</h3>
            <div class="stats-track">
                <span>${worstAlbum.title}</span>
                <span style="color: ${getScoreColor(worstAlbum.avgScore)}">${worstAlbum.avgScore.toFixed(1)}</span>
            </div>
        </div>
        ` : ''}

        <div class="stats-section">
            <h3>📈 Средние оценки по критериям</h3>
            <div class="score-row"><span>Инструментал</span><span style="color: ${getScoreColor(parseFloat(avgInstrumental))}">${avgInstrumental}</span></div>
            <div class="score-row"><span>Смысл</span><span style="color: ${getScoreColor(parseFloat(avgMeaning))}">${avgMeaning}</span></div>
            <div class="score-row"><span>Вайб</span><span style="color: ${getScoreColor(parseFloat(avgVibe))}">${avgVibe}</span></div>
            <div class="score-row"><span>Структура</span><span style="color: ${getScoreColor(parseFloat(avgStructure))}">${avgStructure}</span></div>
            <div class="score-row"><span>Оригинальность</span><span style="color: ${getScoreColor(parseFloat(avgOriginality))}">${avgOriginality}</span></div>
            <div class="score-row"><span>Репитабельность</span><span style="color: ${getScoreColor(parseFloat(avgReplayability))}">${avgReplayability}</span></div>
        </div>

        <div class="stats-section">
            <h3>📊 Общая информация</h3>
            <div class="score-row"><span>Всего треков</span><span>${artistTracks.length}</span></div>
            <div class="score-row"><span>Альбомов</span><span>${artistAlbums.length}</span></div>
            <div class="score-row"><span>Синглов</span><span>${singles.length}</span></div>
            <div class="score-row"><span>Средняя оценка</span><span style="color: ${getScoreColor(parseFloat(avgScore))}">${avgScore}</span></div>
        </div>
    `;

    modal.classList.remove('hidden');
}

async function deleteTrack(trackId) {
    if (!confirm('Удалить трек?')) return;
    await supabaseClient.from('tracks').delete().eq('id', trackId);
    document.getElementById('modal').classList.add('hidden');
    loadArtist();
}

// Навигация
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;

        document.getElementById('albums-section').classList.toggle('hidden', currentTab !== 'albums');
        document.getElementById('tracks-section').classList.toggle('hidden', currentTab !== 'tracks');
        document.getElementById('tracks-filters').classList.toggle('hidden', currentTab !== 'tracks');
    });
});

// Фильтры
document.getElementById('sort-select').addEventListener('change', applyFilters);
document.getElementById('album-filter').addEventListener('change', applyFilters);
document.getElementById('score-filter').addEventListener('change', applyFilters);

// Статистика
document.getElementById('stats-btn').addEventListener('click', openStatsModal);

// Удаление артиста
document.getElementById('delete-artist-btn').addEventListener('click', async () => {
    if (!confirm('Удалить артиста, ВСЕ его альбомы и ВСЕ треки? Это действие нельзя отменить!')) return;
    if (!confirm('Ты точно уверен? Это удалит ВСЁ!')) return;
    
    // Удаляем треки
    await supabaseClient.from('tracks').delete().eq('artist_id', artistId);
    // Удаляем альбомы
    await supabaseClient.from('albums').delete().eq('artist_id', artistId);
    // Удаляем артиста
    await supabaseClient.from('artists').delete().eq('id', artistId);
    
    window.location.href = 'index.html';
});

// Модалки
document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
});

document.getElementById('stats-modal-close').addEventListener('click', () => {
    document.getElementById('stats-modal').classList.add('hidden');
});

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') document.getElementById('modal').classList.add('hidden');
});

document.getElementById('stats-modal').addEventListener('click', (e) => {
    if (e.target.id === 'stats-modal') document.getElementById('stats-modal').classList.add('hidden');
});

loadArtist();