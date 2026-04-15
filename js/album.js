const urlParams = new URLSearchParams(window.location.search);
const albumId = urlParams.get('id');

let album = null;
let albumTracks = [];
let allArtists = [];

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function loadAlbum() {
    const session = await checkAuth();
    if (!session || !albumId) return;

    const { data } = await supabaseClient
        .from('albums')
        .select('*')
        .eq('id', albumId)
        .single();
    album = data;

    const { data: tracks } = await supabaseClient
        .from('tracks')
        .select('*')
        .eq('album_id', albumId)
        .order('created_at');
    albumTracks = tracks || [];

    const { data: artists } = await supabaseClient
        .from('artists')
        .select('*')
        .eq('user_id', session.user.id);
    allArtists = artists || [];

    renderAlbum();
    applyFilters();
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

function renderAlbum() {
    if (!album) return;

    document.getElementById('page-title').textContent = album.title;
    
    // Ссылка на редактирование
    const editBtn = document.getElementById('edit-album-btn');
    if (editBtn) editBtn.href = `edit-album.html?id=${albumId}`;

    document.getElementById('add-track-btn').href = `rate.html?album=${albumId}`;

    const artist = allArtists.find(a => a.id === album.artist_id);
    const cover = album.image_url ? `<img src="${album.image_url}" alt="">` : '💿';
    const avgScore = albumTracks.length > 0
        ? (albumTracks.reduce((sum, t) => sum + t.total_score, 0) / albumTracks.length).toFixed(1)
        : '—';

    document.getElementById('album-info').innerHTML = `
        <div class="detail-cover">${cover}</div>
        <div class="detail-info">
            <div class="detail-title">${album.title}</div>
            <div class="detail-subtitle">${artist?.name || album.artist}${album.year ? ` • ${album.year}` : ''}</div>
            <div class="detail-meta">${albumTracks.length} треков</div>
            <div class="detail-score" style="color: ${getScoreColor(parseFloat(avgScore))}">${avgScore}</div>
        </div>
    `;
}

function applyFilters() {
    const sortBy = document.getElementById('sort-select').value;
    const scoreFilter = document.getElementById('score-filter').value;

    let filtered = [...albumTracks];

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
            filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    renderTracks(filtered);
}

function renderTracks(tracks) {
    const list = document.getElementById('album-tracks');
    const empty = document.getElementById('empty-tracks');
    document.getElementById('tracks-count').textContent = `${tracks.length} треков`;

    if (tracks.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    list.innerHTML = tracks.map((track, index) => {
        const scoreClass = getScoreClass(track.total_score);
        const cover = track.image_url 
            ? `<img src="${track.image_url}" alt="">` 
            : (album.image_url ? `<img src="${album.image_url}" alt="">` : '🎵');

        return `
            <div class="track-card" data-id="${track.id}">
                <div class="track-number">${index + 1}</div>
                <div class="track-cover">${cover}</div>
                <div class="track-info">
                    <div class="track-title">${track.title}</div>
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
    const track = albumTracks.find(t => t.id === trackId);
    if (!track) return;

    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const cover = track.image_url 
        ? `<img src="${track.image_url}" alt="">` 
        : (album.image_url ? `<img src="${album.image_url}" alt="">` : '🎵');
    const scoreColor = getScoreColor(track.total_score);

    body.innerHTML = `
        <div class="modal-header">
            <div class="modal-cover">${cover}</div>
            <div>
                <div class="modal-title">${track.title}</div>
                <div class="modal-album">💿 ${album.title}</div>
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
    if (albumTracks.length === 0) {
        alert('Нет треков для статистики');
        return;
    }

    const modal = document.getElementById('stats-modal');
    const body = document.getElementById('stats-modal-body');

    const sorted = [...albumTracks].sort((a, b) => b.total_score - a.total_score);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const avgScore = (albumTracks.reduce((sum, t) => sum + t.total_score, 0) / albumTracks.length).toFixed(2);

    // Средние по критериям
    const avgInstrumental = (albumTracks.reduce((sum, t) => sum + t.instrumental, 0) / albumTracks.length).toFixed(1);
    const avgMeaning = (albumTracks.reduce((sum, t) => sum + t.meaning, 0) / albumTracks.length).toFixed(1);
    const avgVibe = (albumTracks.reduce((sum, t) => sum + t.vibe, 0) / albumTracks.length).toFixed(1);
    const avgStructure = (albumTracks.reduce((sum, t) => sum + t.structure, 0) / albumTracks.length).toFixed(1);
    const avgOriginality = (albumTracks.reduce((sum, t) => sum + t.originality, 0) / albumTracks.length).toFixed(1);
    const avgReplayability = (albumTracks.reduce((sum, t) => sum + t.replayability, 0) / albumTracks.length).toFixed(1);

    const vocalsCount = albumTracks.filter(t => t.has_vocals).length;
    const avgCharisma = vocalsCount > 0 
        ? (albumTracks.filter(t => t.has_vocals).reduce((sum, t) => sum + t.charisma, 0) / vocalsCount).toFixed(1)
        : '—';

    body.innerHTML = `
        <h2 style="margin: 20px; text-align: center;">📊 Статистика альбома</h2>
        
        <div class="stats-section">
            <h3>🏆 Лучший трек</h3>
            <div class="stats-track">
                <span>${best.title}</span>
                <span style="color: ${getScoreColor(best.total_score)}">${best.total_score.toFixed(1)}</span>
            </div>
        </div>

        <div class="stats-section">
            <h3>📉 Худший трек</h3>
            <div class="stats-track">
                <span>${worst.title}</span>
                <span style="color: ${getScoreColor(worst.total_score)}">${worst.total_score.toFixed(1)}</span>
            </div>
        </div>

        <div class="stats-section">
            <h3>📈 Средние оценки по критериям</h3>
            <div class="score-row"><span>Инструментал</span><span style="color: ${getScoreColor(parseFloat(avgInstrumental))}">${avgInstrumental}</span></div>
            ${vocalsCount > 0 ? `<div class="score-row"><span>Харизма</span><span style="color: ${getScoreColor(parseFloat(avgCharisma))}">${avgCharisma}</span></div>` : ''}
            <div class="score-row"><span>Смысл</span><span style="color: ${getScoreColor(parseFloat(avgMeaning))}">${avgMeaning}</span></div>
            <div class="score-row"><span>Вайб</span><span style="color: ${getScoreColor(parseFloat(avgVibe))}">${avgVibe}</span></div>
            <div class="score-row"><span>Структура</span><span style="color: ${getScoreColor(parseFloat(avgStructure))}">${avgStructure}</span></div>
            <div class="score-row"><span>Оригинальность</span><span style="color: ${getScoreColor(parseFloat(avgOriginality))}">${avgOriginality}</span></div>
            <div class="score-row"><span>Репитабельность</span><span style="color: ${getScoreColor(parseFloat(avgReplayability))}">${avgReplayability}</span></div>
        </div>

        <div class="stats-section">
            <h3>📊 Общая информация</h3>
            <div class="score-row"><span>Всего треков</span><span>${albumTracks.length}</span></div>
            <div class="score-row"><span>Средняя оценка</span><span style="color: ${getScoreColor(parseFloat(avgScore))}">${avgScore}</span></div>
            <div class="score-row"><span>Разброс оценок</span><span>${worst.total_score.toFixed(1)} — ${best.total_score.toFixed(1)}</span></div>
        </div>
    `;

    modal.classList.remove('hidden');
}

async function deleteTrack(trackId) {
    if (!confirm('Удалить трек?')) return;
    await supabaseClient.from('tracks').delete().eq('id', trackId);
    document.getElementById('modal').classList.add('hidden');
    loadAlbum();
}

document.getElementById('sort-select').addEventListener('change', applyFilters);
document.getElementById('score-filter').addEventListener('change', applyFilters);

document.getElementById('stats-btn').addEventListener('click', openStatsModal);

document.getElementById('delete-album-btn').addEventListener('click', async () => {
    if (!confirm('Удалить альбом и ВСЕ его треки? Это действие нельзя отменить!')) return;
    if (!confirm('Ты уверен? Все треки будут удалены!')) return;
    
    await supabaseClient.from('tracks').delete().eq('album_id', albumId);
    await supabaseClient.from('albums').delete().eq('id', albumId);
    window.location.href = 'index.html';
});

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

loadAlbum();